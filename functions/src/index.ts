/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {onRequest, onCall} from "firebase-functions/v2/https";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {onDocumentCreated} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import {
  requireAuth,
  rateLimit,
  sanitizeInput,
  validateOrigin,
  logSecurityEvent,
} from "./security";

// Initialize Firebase Admin SDK
admin.initializeApp();

const db = admin.firestore();
const storage = admin.storage();

// ========================================
// 1. SCHEDULED FUNCTION: Daily Video Expiration Cleanup
// ========================================

export const cleanupExpiredVideos = onSchedule({
  schedule: "0 6 * * *", // Run daily at 6 AM UTC
  timeZone: "UTC",
  memory: "256MiB",
}, async () => {
  logger.info("Starting daily expired video cleanup");

  try {
    const now = admin.firestore.Timestamp.now();

    // Query for expired videos across all chats
    const expiredVideosQuery = db.collectionGroup("videos")
      .where("expiresAt", "<=", now)
      .where("isExpired", "==", false);

    const expiredVideosSnapshot = await expiredVideosQuery.get();

    const count = expiredVideosSnapshot.size;
    logger.info(`Found ${count} expired videos to process`);

    const batch = db.batch();
    const storageDeletePromises: Promise<void>[] = [];

    for (const videoDoc of expiredVideosSnapshot.docs) {
      const videoData = videoDoc.data();
      const chatId = videoData.chatId;

      // Mark video as expired in Firestore
      batch.update(videoDoc.ref, {
        isExpired: true,
        expiredAt: now,
      });

      // Delete video file from Storage
      try {
        const videoPath = `chats/${chatId}/videos/${videoDoc.id}.mp4`;
        const thumbPath = `chats/${chatId}/thumbnails/${videoDoc.id}.gif`;

        storageDeletePromises.push(
          storage.bucket().file(videoPath).delete()
            .catch(() => logger.warn(`Failed to delete: ${videoPath}`))
            .then(() => undefined)
        );

        storageDeletePromises.push(
          storage.bucket().file(thumbPath).delete()
            .catch(() => {/* Thumbnail might not exist, that's ok */})
            .then(() => undefined)
        );
      } catch (error) {
        const msg = `Error deleting storage files for video ${videoDoc.id}:`;
        logger.error(msg, error);
      }

      // Reset chat streak if video expired without reply
      try {
        const chatRef = db.collection("chats").doc(chatId);
        batch.update(chatRef, {
          streakCount: 0,
          lastUpdated: now,
        });
      } catch (error) {
        const msg = `Error updating chat streak for chat ${chatId}:`;
        logger.error(msg, error);
      }
    }

    // Execute Firestore batch updates
    await batch.commit();

    // Execute storage deletions
    await Promise.allSettled(storageDeletePromises);

    logger.info(`Successfully processed ${count} expired videos`);
  } catch (error) {
    logger.error("Error in cleanupExpiredVideos:", error);
    throw error;
  }
});

// ========================================
// 2. CALLABLE FUNCTION: Create or Get Chat Between Users
// ========================================

interface CreateChatRequest {
  userId1: string;
  userId2: string;
}

interface CreateChatResponse {
  chatId: string;
  isNew: boolean;
  members: string[];
}

export const createChat = onCall<
  CreateChatRequest,
  Promise<CreateChatResponse>
>(
  {cors: true},
  async (request) => {
    // Validate authentication
    requireAuth(request);

    // Sanitize input data
    const sanitizedData = sanitizeInput(request.data);
    const {userId1, userId2} = sanitizedData;
    const uid = request.auth!.uid;

    // Log security event
    logSecurityEvent("chat_creation_attempt", {
      userId: uid,
      targetUsers: [userId1, userId2],
    });

    // Verify user is one of the participants
    if (uid !== userId1 && uid !== userId2) {
      logSecurityEvent("unauthorized_chat_creation", {
        userId: uid,
        attemptedUsers: [userId1, userId2],
      }, "warn");
      const errMsg = "Unauthorized: You can only create chats you're member of";
      throw new Error(errMsg);
    }

    // Validate input
    if (!userId1 || !userId2 || userId1 === userId2) {
      throw new Error("Invalid user IDs provided");
    }

    logger.info(`Creating/finding chat between ${userId1} and ${userId2}`);

    try {
      // Check if chat already exists between these users
      const existingChatQuery = db.collection("chats")
        .where("members", "array-contains", userId1);
      const chatQuery = existingChatQuery
        .where("members", "array-contains", userId2);

      const existingChatSnapshot = await chatQuery.get();

      if (!existingChatSnapshot.empty) {
        const existingChat = existingChatSnapshot.docs[0];
        logger.info(`Found existing chat: ${existingChat.id}`);

        return {
          chatId: existingChat.id,
          isNew: false,
          members: existingChat.data().members,
        };
      }

      // Create new chat
      const now = admin.firestore.Timestamp.now();
      const newChatRef = db.collection("chats").doc();

      await newChatRef.set({
        members: [userId1, userId2],
        createdAt: now,
        lastUpdated: now,
        streakCount: 0,
      });

      logger.info(`Created new chat: ${newChatRef.id}`);

      return {
        chatId: newChatRef.id,
        isNew: true,
        members: [userId1, userId2],
      };
    } catch (error) {
      logger.error("Error in createChat:", error);
      throw new Error(`Failed to create chat: ${error}`);
    }
  }
);

// ========================================
// 3. TRIGGER FUNCTION: Push Notifications for New Videos
// ========================================

export const notifyNewVideo = onDocumentCreated(
  "chats/{chatId}/videos/{videoId}",
  async (event) => {
    const videoData = event.data?.data();
    const chatId = event.params.chatId;
    const videoId = event.params.videoId;

    if (!videoData) {
      logger.error("No video data found");
      return;
    }

    logger.info(`New video uploaded: ${videoId} in chat ${chatId}`);

    try {
      // Get chat data to find recipient
      const chatDoc = await db.collection("chats").doc(chatId).get();
      if (!chatDoc.exists) {
        logger.error(`Chat ${chatId} not found`);
        return;
      }
      const recipientId = videoData.recipientId;
      const senderId = videoData.senderId;

      // Get recipient user data for notification
      const recipientDoc = await db.collection("users").doc(recipientId).get();
      if (!recipientDoc.exists) {
        logger.error(`Recipient ${recipientId} not found`);
        return;
      }

      const senderDoc = await db.collection("users").doc(senderId).get();
      const senderName = senderDoc.exists ?
        senderDoc.data()?.displayName || "Someone" : "Someone";

      // Update chat's last updated time and streak
      await db.collection("chats").doc(chatId).update({
        lastUpdated: admin.firestore.Timestamp.now(),
        lastVideoId: videoId,
        // Note: Streak increment logic should be in client for feedback
      });

      // TODO: Implement push notification sending
      // This would require FCM tokens to be stored in user documents
      // For now, we'll log the notification intent
      const msg = `"${senderName} sent you a Waffle!"`;
      logger.info(`Would send push notification to ${recipientId}: ${msg}`);

      return {
        success: true,
        notificationSent: false, // Will be true when FCM is implemented
        recipientId,
        senderId,
        senderName,
      };
    } catch (error) {
      logger.error("Error in notifyNewVideo:", error);
      throw error;
    }
  }
);

// ========================================
// 4. UTILITY FUNCTION: Health Check
// ========================================

export const healthCheck = onRequest(async (request, response) => {
  // Apply rate limiting
  if (!rateLimit(request, response)) {
    return; // Response already sent by rateLimit
  }

  // Validate origin
  if (!validateOrigin(request)) {
    response.status(403).json({
      error: "Forbidden origin",
      code: "invalid-origin",
    });
    return;
  }

  logger.info("Health check requested");

  try {
    // Quick Firestore connectivity test
    await db.collection("_health").doc("test").set({
      timestamp: admin.firestore.Timestamp.now(),
      status: "ok",
    });

    response.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      services: {
        firestore: "connected",
        storage: "connected",
        functions: "running",
      },
    });
  } catch (error) {
    logger.error("Health check failed:", error);
    response.status(500).json({
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ========================================
// 5. CALLABLE FUNCTION: Get User Stats
// ========================================

interface UserStatsResponse {
  totalChats: number;
  totalVideosReceived: number;
  totalVideosSent: number;
  activeStreaks: number;
  longestStreak: number;
}

export const getUserStats = onCall<
  Record<string, never>,
  Promise<UserStatsResponse>
>(
  {cors: true},
  async (request) => {
    // Validate authentication
    requireAuth(request);
    const uid = request.auth!.uid;

    // Log security event
    logSecurityEvent("user_stats_request", {
      userId: uid,
    });

    logger.info(`Getting stats for user ${uid}`);

    try {
      // Get user's chats
      const userChatsSnapshot = await db.collection("chats")
        .where("members", "array-contains", uid)
        .get();

      let totalVideosReceived = 0;
      let totalVideosSent = 0;
      let activeStreaks = 0;
      let longestStreak = 0;

      // Aggregate stats from all chats
      for (const chatDoc of userChatsSnapshot.docs) {
        const chatData = chatDoc.data();

        // Count active streaks
        if (chatData.streakCount > 0) {
          activeStreaks++;
        }

        // Track longest streak
        if (chatData.streakCount > longestStreak) {
          longestStreak = chatData.streakCount;
        }

        // Count videos in this chat
        const videosSnapshot = await chatDoc.ref.collection("videos").get();

        for (const videoDoc of videosSnapshot.docs) {
          const videoData = videoDoc.data();

          if (videoData.senderId === uid) {
            totalVideosSent++;
          } else if (videoData.recipientId === uid) {
            totalVideosReceived++;
          }
        }
      }

      const stats: UserStatsResponse = {
        totalChats: userChatsSnapshot.size,
        totalVideosReceived,
        totalVideosSent,
        activeStreaks,
        longestStreak,
      };

      logger.info(`Stats for user ${uid}:`, stats);
      return stats;
    } catch (error) {
      logger.error("Error in getUserStats:", error);
      throw new Error(`Failed to get user stats: ${error}`);
    }
  }
);

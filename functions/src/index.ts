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
import {
  processVideoForRAG,
  generateQueryEmbedding,
  searchPinecone,
  generateContextualResponse,
} from "./rag-services";

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
      timestamp: new Date().toISOString(),
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

// ========================================
// 6. FIRESTORE TRIGGER: Process Videos for RAG
// ========================================

export const processVideoRAG = onDocumentCreated({
  document: "chats/{chatId}/videos/{videoId}",
  memory: "1GiB",
  timeoutSeconds: 540, // 9 minutes
}, async (event) => {
    const videoData = event.data?.data();
    const chatId = event.params.chatId;
    const videoId = event.params.videoId;

    if (!videoData) {
      logger.error("No video data found for RAG processing");
      return;
    }

    // Check if RAG processing is already completed or in progress
    if (videoData.ragProcessed === true) {
      logger.info(`RAG already processed for video ${videoId}`);
      return;
    }

    logger.info(`Starting RAG processing for video ${videoId} in chat ${chatId}`);

    try {
      // Mark as processing to avoid duplicate triggers
      await event.data?.ref.update({
        ragProcessing: true,
        ragStartedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Construct video file path in Firebase Storage
      const videoPath = `chats/${chatId}/videos/${videoId}.mp4`;

      // Process video for RAG
      await processVideoForRAG(videoPath, videoId, chatId);

      logger.info(`RAG processing completed for video ${videoId}`);
    } catch (error) {
      logger.error(`Error processing video ${videoId} for RAG:`, error);
      
      // Update document with error status
      try {
        await event.data?.ref.update({
          ragProcessing: false,
          ragProcessed: false,
          ragError: error instanceof Error ? error.message : "Unknown error",
          ragErrorAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (updateError) {
        logger.error("Error updating document with RAG error:", updateError);
      }
    }
  }
);

// ========================================
// 7. CALLABLE FUNCTION: RAG Query Interface
// ========================================

interface RAGQueryRequest {
  query: string;
  chatId: string;
  maxResults?: number;
}

interface RAGQueryResponse {
  response: string;
  sources: Array<{
    videoId: string;
    timestamp: number;
    confidence: number;
    text: string;
  }>;
  processingTimeMs: number;
}

export const queryRAG = onCall<
  RAGQueryRequest,
  Promise<RAGQueryResponse>
>(
  {
    cors: true,
    memory: "512MiB",
    timeoutSeconds: 30,
  },
  async (request) => {
    const startTime = Date.now();
    
    // Validate authentication
    requireAuth(request);
    const uid = request.auth!.uid;

    // Sanitize input data
    const sanitizedData = sanitizeInput(request.data);
    const {query, chatId, maxResults = 5} = sanitizedData;

    // Log security event
    logSecurityEvent("rag_query_request", {
      userId: uid,
      chatId,
      queryLength: query?.length || 0,
    });

    // Validate input
    if (!query || !chatId) {
      throw new Error("Query and chatId are required");
    }

    if (query.length > 500) {
      throw new Error("Query too long (max 500 characters)");
    }

    // Verify user is a member of the chat
    const chatDoc = await db.collection("chats").doc(chatId).get();
    if (!chatDoc.exists) {
      throw new Error("Chat not found");
    }

    const chatData = chatDoc.data();
    if (!chatData?.members?.includes(uid)) {
      logSecurityEvent("unauthorized_rag_query", {
        userId: uid,
        chatId,
      }, "warn");
      throw new Error("Unauthorized: You're not a member of this chat");
    }

    logger.info(`RAG query from user ${uid} in chat ${chatId}: "${query}"`);

    try {
      // Generate query embedding
      const queryEmbedding = await generateQueryEmbedding(query);

      // Search Pinecone for relevant context
      const searchResults = await searchPinecone(
        queryEmbedding,
        chatId,
        maxResults
      );

      // Generate contextual response
      let response = "I don't have enough context to help with that query.";
      const sources: Array<{
        videoId: string;
        timestamp: number;
        confidence: number;
        text: string;
      }> = [];

      if (searchResults.length > 0) {
        response = await generateContextualResponse(query, searchResults);

        // Format sources for response
        sources.push(...searchResults.map(result => ({
          videoId: result.metadata.videoId,
          timestamp: result.metadata.startTime,
          confidence: Math.round(result.score * 100) / 100,
          text: result.metadata.text.substring(0, 150) + "...",
        })));
      }

      const processingTimeMs = Date.now() - startTime;

      logger.info(`RAG query completed in ${processingTimeMs}ms for user ${uid}`);

      return {
        response,
        sources,
        processingTimeMs,
      };
    } catch (error) {
      logger.error(`Error in RAG query for user ${uid}:`, error);
      throw new Error(`RAG query failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
);

// ========================================
// 8. SCHEDULED FUNCTION: Process RAG Backlog
// ========================================

export const processRAGBacklog = onSchedule({
  schedule: "0 */2 * * *", // Run every 2 hours
  timeZone: "UTC",
  memory: "1GiB",
  timeoutSeconds: 540, // 9 minutes
}, async () => {
  logger.info("Starting RAG backlog processing");

  try {
    // Find videos that haven't been processed for RAG yet
    const unprocessedVideosQuery = db.collectionGroup("videos")
      .where("ragProcessed", "!=", true)
      .where("isExpired", "==", false)
      .limit(10); // Process max 10 videos per run to avoid timeout

    const unprocessedVideosSnapshot = await unprocessedVideosQuery.get();
    const count = unprocessedVideosSnapshot.size;

    logger.info(`Found ${count} unprocessed videos for RAG`);

    if (count === 0) {
      logger.info("No videos to process for RAG");
      return;
    }

    const processPromises: Promise<void>[] = [];

    for (const videoDoc of unprocessedVideosSnapshot.docs) {
      const videoData = videoDoc.data();
      const videoId = videoDoc.id;
      const chatId = videoData.chatId;

      // Skip if already processing or recently failed
      if (videoData.ragProcessing === true) {
        logger.info(`Skipping video ${videoId} - already processing`);
        continue;
      }

      // Skip if failed recently (within last 6 hours)
      if (videoData.ragErrorAt) {
        const errorTime = videoData.ragErrorAt.toDate();
        const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
        if (errorTime > sixHoursAgo) {
          logger.info(`Skipping video ${videoId} - failed recently`);
          continue;
        }
      }

      logger.info(`Processing video ${videoId} from chat ${chatId} for RAG`);

      const processVideo = async () => {
        try {
          // Mark as processing
          await videoDoc.ref.update({
            ragProcessing: true,
            ragStartedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          // Construct video file path
          const videoPath = `chats/${chatId}/videos/${videoId}.mp4`;

          // Process video for RAG
          await processVideoForRAG(videoPath, videoId, chatId);

          logger.info(`Backlog RAG processing completed for video ${videoId}`);
        } catch (error) {
          logger.error(`Error in backlog RAG processing for video ${videoId}:`, error);
          
          // Update with error status
          await videoDoc.ref.update({
            ragProcessing: false,
            ragProcessed: false,
            ragError: error instanceof Error ? error.message : "Unknown error",
            ragErrorAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      };

      processPromises.push(processVideo());
    }

    // Process all videos in parallel (with reasonable limits)
    const results = await Promise.allSettled(processPromises);
    
    const successful = results.filter(r => r.status === "fulfilled").length;
    const failed = results.filter(r => r.status === "rejected").length;

    logger.info(`RAG backlog processing completed: ${successful} successful, ${failed} failed`);
  } catch (error) {
    logger.error("Error in processRAGBacklog:", error);
    throw error;
  }
});

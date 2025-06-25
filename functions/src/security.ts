/**
 * Security utilities for Firebase Cloud Functions
 * Implements Firebase security best practices for production deployment
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {Request, Response} from "express";
import {CallableContext} from "firebase-functions/v1/https";

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 100;
const requestCounts = new Map<string, {count: number; resetTime: number}>();

/**
 * Validate that the user is authenticated
 * @param {CallableContext} context - The callable function context
 */
export function requireAuth(context: CallableContext): void {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated to access this function"
    );
  }
}

/**
 * Validate App Check token (when available)
 * This provides an additional layer of security to ensure requests
 * come from your genuine app
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @return {Promise<boolean>} True if valid or allowed, false otherwise
 */
export async function validateAppCheck(
  req: Request,
  res: Response
): Promise<boolean> {
  try {
    const appCheckToken = req.header("X-Firebase-AppCheck");

    if (!appCheckToken) {
      // In development, we might not have App Check enabled
      // In production, this should be required
      const isDevelopment = process.env.NODE_ENV !== "production";
      if (!isDevelopment) {
        res.status(401).json({
          error: "App Check token required",
          code: "app-check-required",
        });
        return false;
      }
      return true; // Allow in development
    }

    // Verify the App Check token
    await admin.appCheck().verifyToken(appCheckToken);
    return true;
  } catch (error) {
    functions.logger.warn("App Check verification failed:", error);
    res.status(401).json({
      error: "Invalid App Check token",
      code: "invalid-app-check-token",
    });
    return false;
  }
}

/**
 * Rate limiting middleware to prevent abuse
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @return {boolean} True if request is allowed, false if rate limited
 */
export function rateLimit(req: Request, res: Response): boolean {
  const clientId = req.ip || "unknown";
  const now = Date.now();

  // Clean up old entries
  for (const [key, value] of requestCounts.entries()) {
    if (now > value.resetTime) {
      requestCounts.delete(key);
    }
  }

  // Check current client
  const clientData = requestCounts.get(clientId);

  if (!clientData) {
    // First request from this client
    requestCounts.set(clientId, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    });
    return true;
  }

  if (now > clientData.resetTime) {
    // Reset window
    requestCounts.set(clientId, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    });
    return true;
  }

  if (clientData.count >= MAX_REQUESTS_PER_WINDOW) {
    res.status(429).json({
      error: "Too many requests",
      code: "rate-limit-exceeded",
      retryAfter: Math.ceil((clientData.resetTime - now) / 1000),
    });
    return false;
  }

  // Increment count
  clientData.count++;
  return true;
}

/**
 * Validate that user is a member of the specified chat
 * @param {string} userId - The user ID to check
 * @param {string} chatId - The chat ID to check membership for
 * @return {Promise<boolean>} True if user is a member, false otherwise
 */
export async function validateChatMembership(
  userId: string,
  chatId: string
): Promise<boolean> {
  try {
    const chatDoc = await admin
      .firestore()
      .collection("chats")
      .doc(chatId)
      .get();

    if (!chatDoc.exists) {
      return false;
    }

    const chatData = chatDoc.data();
    return chatData?.members?.includes(userId) || false;
  } catch (error) {
    functions.logger.error("Error validating chat membership:", error);
    return false;
  }
}

/**
 * Sanitize input to prevent injection attacks
 * @param {any} input - The input to sanitize
 * @return {any} The sanitized input
 */
export function sanitizeInput(input: any): any {
  if (typeof input === "string") {
    // Remove potentially harmful characters
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/javascript:/gi, "")
      .replace(/on\w+\s*=/gi, "")
      .trim();
  }

  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }

  if (typeof input === "object" && input !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[sanitizeInput(key)] = sanitizeInput(value);
    }
    return sanitized;
  }

  return input;
}

/**
 * Validate request origin (CORS-like validation)
 * @param {Request} req - Express request object
 * @return {boolean} True if origin is valid, false otherwise
 */
export function validateOrigin(req: Request): boolean {
  const origin = req.get("Origin");
  const allowedOrigins = [
    "https://waffle.app",
    "https://www.waffle.app",
    "capacitor://localhost", // For mobile app
    "http://localhost:3000", // Development
  ];

  // In production, strictly validate origins
  if (process.env.NODE_ENV === "production") {
    return origin ? allowedOrigins.includes(origin) : false;
  }

  // In development, be more permissive but still log
  if (origin && !allowedOrigins.includes(origin)) {
    functions.logger.warn(`Request from unknown origin: ${origin}`);
  }

  return true;
}

/**
 * Log security events for monitoring
 * @param {string} event - The security event name
 * @param {Record<string, any>} details - Event details
 * @param {"info" | "warn" | "error"} severity - Log severity level
 */
export function logSecurityEvent(
  event: string,
  details: Record<string, any>,
  severity: "info" | "warn" | "error" = "info"
): void {
  const logData = {
    timestamp: new Date().toISOString(),
    event,
    ...details,
  };

  switch (severity) {
  case "error":
    functions.logger.error("Security Event:", logData);
    break;
  case "warn":
    functions.logger.warn("Security Event:", logData);
    break;
  default:
    functions.logger.info("Security Event:", logData);
  }
}

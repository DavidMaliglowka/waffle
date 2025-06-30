/**
 * RAG (Retrieval-Augmented Generation) Services
 * Handles video transcription, embedding generation, semantic search, and AI response generation
 */

import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import {OpenAI} from "openai";
import {Pinecone} from "@pinecone-database/pinecone";
import ffmpeg from "fluent-ffmpeg";
import * as fs from "fs";
import ffmpegPath from "ffmpeg-static";



// Set ffmpeg binary path
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

// Initialize clients lazily to avoid environment variable issues
let openai: OpenAI | null = null;
let pinecone: Pinecone | null = null;

// Debug function removed - using inline env check in functions

function getOpenAIClient(): OpenAI {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is required");
    }
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

function getPineconeClient(): Pinecone {
  if (!pinecone) {
    if (!process.env.PINECONE_API_KEY) {
      throw new Error("PINECONE_API_KEY environment variable is required");
    }
    pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });
  }
  return pinecone;
}

// Constants
const EMBEDDING_MODEL = "text-embedding-ada-002";
const CHAT_MODEL = "gpt-4";
const CHUNK_SIZE = 250; // tokens
const OVERLAP_SIZE = 50; // tokens
const PINECONE_INDEX_NAME = "waffle";
const EMBEDDING_DIMENSION = 1536;

// Types
export interface TranscriptSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

export interface TranscriptResult {
  text: string;
  segments: TranscriptSegment[];
  duration: number;
}

export interface EmbeddingChunk {
  text: string;
  startTime: number;
  endTime: number;
  chunkIndex: number;
  embedding: number[];
}

export interface SearchResult {
  id: string;
  score: number;
  metadata: {
    text: string;
    videoId: string;
    chatId: string;
    timestamp: number;
    startTime: number;
    endTime: number;
  };
}

export interface RAGResponse {
  response: string;
  sources: Array<{
    videoId: string;
    timestamp: number;
    confidence: number;
  }>;
}

/**
 * Extract audio from video file stored in Firebase Storage
 */
export async function extractAudioFromVideo(
  videoPath: string
): Promise<Buffer> {
  const bucket = admin.storage().bucket();
  const tempVideoPath = `/tmp/video_${Date.now()}.mp4`;
  const tempAudioPath = `/tmp/audio_${Date.now()}.wav`;

  try {
    logger.info(`🎬 Starting audio extraction for video: ${videoPath}`);
    logger.info(`📥 FFmpeg path: ${ffmpegPath || 'not found'}`);

    // Download video file to temporary location
    await bucket.file(videoPath).download({destination: tempVideoPath});
    logger.info(`✅ Downloaded video from ${videoPath} to ${tempVideoPath}`);

    // Check if video file was downloaded successfully
    if (!fs.existsSync(tempVideoPath)) {
      throw new Error(`Video file not found after download: ${tempVideoPath}`);
    }
    const videoStats = fs.statSync(tempVideoPath);
    logger.info(`📊 Video file size: ${videoStats.size} bytes`);

    // Extract audio using ffmpeg
    logger.info(`🎵 Starting ffmpeg audio extraction...`);
    await new Promise<void>((resolve, reject) => {
      const command = ffmpeg(tempVideoPath)
        .output(tempAudioPath)
        .audioCodec("pcm_s16le")
        .audioFrequency(16000)
        .audioChannels(1)
        .format("wav")
        .on("start", (commandLine) => {
          logger.info(`🔧 FFmpeg command: ${commandLine}`);
        })
        .on("progress", (progress) => {
          logger.info(`⏳ FFmpeg progress: ${Math.round(progress.percent || 0)}%`);
        })
        .on("end", () => {
          logger.info(`✅ Audio extracted to ${tempAudioPath}`);
          resolve();
        })
        .on("error", (error: any) => {
          logger.error("❌ FFmpeg error:", error);
          reject(error);
        });
      
      command.run();
    });

    // Check if audio file was created successfully
    if (!fs.existsSync(tempAudioPath)) {
      throw new Error(`Audio file not found after extraction: ${tempAudioPath}`);
    }

    // Read the audio file as buffer
    const audioBuffer = fs.readFileSync(tempAudioPath);
    logger.info(`📊 Audio buffer size: ${audioBuffer.length} bytes`);

    // Cleanup temporary files
    fs.unlinkSync(tempVideoPath);
    fs.unlinkSync(tempAudioPath);
    logger.info(`🧹 Cleaned up temporary files`);

    return audioBuffer;
  } catch (error) {
    logger.error("❌ Error extracting audio from video:", error);
    // Cleanup on error
    try {
      if (fs.existsSync(tempVideoPath)) {
        fs.unlinkSync(tempVideoPath);
        logger.info(`🧹 Cleaned up video file: ${tempVideoPath}`);
      }
      if (fs.existsSync(tempAudioPath)) {
        fs.unlinkSync(tempAudioPath);
        logger.info(`🧹 Cleaned up audio file: ${tempAudioPath}`);
      }
    } catch (cleanupError) {
      logger.warn("⚠️ Error cleaning up temp files:", cleanupError);
    }
    throw error;
  }
}

/**
 * Generate transcript from audio buffer using OpenAI Whisper
 */
export async function generateTranscript(
  audioBuffer: Buffer,
  filename = "audio.wav"
): Promise<TranscriptResult> {
  const tempAudioPath = `/tmp/whisper_${Date.now()}.wav`;
  
  try {
    logger.info(`🎙️ Starting transcription with OpenAI Whisper`);
    logger.info(`📊 Audio buffer size: ${audioBuffer.length} bytes`);

    // Write audio buffer to temporary file for OpenAI API
    fs.writeFileSync(tempAudioPath, audioBuffer);
    logger.info(`💾 Wrote audio buffer to temp file: ${tempAudioPath}`);

    // Verify file was written correctly
    if (!fs.existsSync(tempAudioPath)) {
      throw new Error(`Temp audio file not found: ${tempAudioPath}`);
    }
    const fileStats = fs.statSync(tempAudioPath);
    logger.info(`📊 Temp audio file size: ${fileStats.size} bytes`);

    logger.info("📤 Sending audio to OpenAI Whisper for transcription");

    const response = await getOpenAIClient().audio.transcriptions.create({
      file: fs.createReadStream(tempAudioPath),
      model: "whisper-1",
      language: "en",
      response_format: "verbose_json",
      timestamp_granularities: ["segment"],
    });

    logger.info(`✅ Transcription completed. Duration: ${response.duration}s`);
    logger.info(`📝 Transcript text length: ${response.text?.length || 0} characters`);
    logger.info(`🎯 Transcript segments: ${response.segments?.length || 0}`);

    // Cleanup temp file
    fs.unlinkSync(tempAudioPath);
    logger.info(`🧹 Cleaned up temp audio file`);

    return {
      text: response.text,
      segments: response.segments?.map((segment: any, index: number) => ({
        id: index,
        start: segment.start,
        end: segment.end,
        text: segment.text,
      })) || [],
      duration: response.duration || 0,
    };
  } catch (error) {
    logger.error("❌ Error generating transcript:", error);
    
    // Cleanup temp file on error
    try {
      if (fs.existsSync(tempAudioPath)) {
        fs.unlinkSync(tempAudioPath);
        logger.info(`🧹 Cleaned up temp audio file after error`);
      }
    } catch (cleanupError) {
      logger.warn("⚠️ Error cleaning up temp audio file:", cleanupError);
    }
    
    throw error;
  }
}

/**
 * Estimate token count for text (rough approximation)
 */
function estimateTokenCount(text: string): number {
  // Rough approximation: 1 token ≈ 4 characters for English
  return Math.ceil(text.length / 4);
}

/**
 * Create overlapping chunks from transcript segments
 */
export function createOverlappingChunks(
  segments: TranscriptSegment[],
  chunkSize: number = CHUNK_SIZE,
  overlapSize: number = OVERLAP_SIZE
): Array<{
  text: string;
  startTime: number;
  endTime: number;
  chunkIndex: number;
}> {
  const chunks: Array<{
    text: string;
    startTime: number;
    endTime: number;
    chunkIndex: number;
  }> = [];

  let currentChunk: TranscriptSegment[] = [];
  let currentTokenCount = 0;
  let chunkIndex = 0;

  for (const segment of segments) {
    const segmentTokens = estimateTokenCount(segment.text);

    // If adding this segment would exceed chunk size and we have content
    if (currentTokenCount + segmentTokens > chunkSize && currentChunk.length > 0) {
      // Create chunk from current segments
      chunks.push({
        text: currentChunk.map((s) => s.text).join(" "),
        startTime: currentChunk[0].start,
        endTime: currentChunk[currentChunk.length - 1].end,
        chunkIndex: chunkIndex++,
      });

      // Create overlap for next chunk
      const overlapSegments = currentChunk.slice(-Math.ceil(overlapSize / 50));
      currentChunk = overlapSegments;
      currentTokenCount = overlapSegments.reduce(
        (sum, s) => sum + estimateTokenCount(s.text),
        0
      );
    }

    currentChunk.push(segment);
    currentTokenCount += segmentTokens;
  }

  // Add final chunk if there's remaining content
  if (currentChunk.length > 0) {
    chunks.push({
      text: currentChunk.map((s) => s.text).join(" "),
      startTime: currentChunk[0].start,
      endTime: currentChunk[currentChunk.length - 1].end,
      chunkIndex: chunkIndex,
    });
  }

  return chunks;
}

/**
 * Generate embeddings for text chunks
 */
export async function generateEmbeddings(
  chunks: Array<{
    text: string;
    startTime: number;
    endTime: number;
    chunkIndex: number;
  }>
): Promise<EmbeddingChunk[]> {
  const embeddings: EmbeddingChunk[] = [];

  logger.info(`Generating embeddings for ${chunks.length} chunks`);

  for (const [index, chunk] of chunks.entries()) {
    try {
      const response = await getOpenAIClient().embeddings.create({
        model: EMBEDDING_MODEL,
        input: chunk.text,
      });

      embeddings.push({
        text: chunk.text,
        startTime: chunk.startTime,
        endTime: chunk.endTime,
        chunkIndex: chunk.chunkIndex,
        embedding: response.data[0].embedding,
      });

      // Rate limiting - OpenAI allows 3000 RPM for embeddings
      if (index < chunks.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    } catch (error: any) {
      logger.error(`Error generating embedding for chunk ${index}:`, error);
      throw error;
    }
  }

  logger.info(`Generated ${embeddings.length} embeddings`);
  return embeddings;
}

/**
 * Initialize Pinecone index if it doesn't exist
 */
export async function initializePineconeIndex(): Promise<void> {
  try {
    const indexList = await getPineconeClient().listIndexes();
    const existingIndex = indexList.indexes?.find(
      (index) => index.name === PINECONE_INDEX_NAME
    );

    if (!existingIndex) {
      logger.info(`Creating Pinecone index: ${PINECONE_INDEX_NAME}`);

      await getPineconeClient().createIndex({
        name: PINECONE_INDEX_NAME,
        dimension: EMBEDDING_DIMENSION,
        metric: "cosine",
        spec: {
          serverless: {
            cloud: "aws",
            region: "us-east-1",
          },
        },
        deletionProtection: "disabled",
      });

      // Wait for index to be ready
      await waitForIndexReady();
      logger.info(`Pinecone index ${PINECONE_INDEX_NAME} created successfully`);
    } else {
      logger.info(`Pinecone index ${PINECONE_INDEX_NAME} already exists`);
    }
  } catch (error) {
    logger.error("Error initializing Pinecone index:", error);
    throw error;
  }
}

/**
 * Wait for Pinecone index to be ready
 */
async function waitForIndexReady(maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const indexInfo = await getPineconeClient().describeIndex(PINECONE_INDEX_NAME);
      if (indexInfo.status?.ready) {
        return;
      }
    } catch (error) {
      // Index might not be ready yet
    }

    logger.info(`Waiting for index to be ready... attempt ${i + 1}`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error("Index did not become ready within expected time");
}

/**
 * Store embeddings in Pinecone
 */
export async function storeEmbeddingsInPinecone(
  embeddings: EmbeddingChunk[],
  videoId: string,
  chatId: string
): Promise<void> {
  try {
    await initializePineconeIndex();
    const index = getPineconeClient().index(PINECONE_INDEX_NAME);

    // Prepare vectors for upsert
    const vectors = embeddings.map((embedding, idx) => ({
      id: `${videoId}_chunk_${idx}`,
      values: embedding.embedding,
      metadata: {
        text: embedding.text,
        videoId,
        chatId,
        timestamp: Date.now(),
        startTime: embedding.startTime,
        endTime: embedding.endTime,
        chunkIndex: embedding.chunkIndex,
      },
    }));

    // Upsert vectors in batches
    const batchSize = 100;
    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);
      await index.namespace(chatId).upsert(batch);
      logger.info(`Upserted batch ${Math.floor(i / batchSize) + 1} for video ${videoId}`);
    }

    logger.info(`Successfully stored ${vectors.length} embeddings for video ${videoId}`);
  } catch (error) {
    logger.error("Error storing embeddings in Pinecone:", error);
    throw error;
  }
}

/**
 * Search Pinecone for relevant context
 */
export async function searchPinecone(
  queryEmbedding: number[],
  chatId: string,
  topK = 5
): Promise<SearchResult[]> {
  try {
    const index = getPineconeClient().index(PINECONE_INDEX_NAME);

    const queryResponse = await index.namespace(chatId).query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true,
      includeValues: false,
    });

    return queryResponse.matches.map((match: any) => ({
      id: match.id,
      score: match.score || 0,
      metadata: {
        text: match.metadata?.text as string,
        videoId: match.metadata?.videoId as string,
        chatId: match.metadata?.chatId as string,
        timestamp: match.metadata?.timestamp as number,
        startTime: match.metadata?.startTime as number,
        endTime: match.metadata?.endTime as number,
      },
    }));
  } catch (error) {
    logger.error("Error searching Pinecone:", error);
    throw error;
  }
}

/**
 * Generate query embedding
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  try {
    const response = await getOpenAIClient().embeddings.create({
      model: EMBEDDING_MODEL,
      input: query,
    });

    return response.data[0].embedding;
  } catch (error) {
    logger.error("Error generating query embedding:", error);
    throw error;
  }
}

/**
 * Generate contextual response using GPT-4
 */
export async function generateContextualResponse(
  query: string,
  context: SearchResult[]
): Promise<string> {
  try {
    logger.info(`🤖 Generating contextual response for query: "${query}"`);
    logger.info(`📊 Context items: ${context.length}`);
    
    const contextText = context
      .map(
        (item) =>
          `[${Math.round(item.metadata.startTime)}s] ${item.metadata.text}`
      )
      .join("\n\n");

    logger.info(`📝 Context text length: ${contextText.length} characters`);
    logger.info(`📝 Context preview: "${contextText.substring(0, 300)}..."`);

    // Check if this is a summary request and adjust the prompt accordingly
    const isSummaryRequest = query.toLowerCase().includes('summarize') || 
                           query.toLowerCase().includes('summary') ||
                           query.toLowerCase().includes('main topics') ||
                           query.toLowerCase().includes('key takeaways');

    let systemPrompt: string;
    
    if (isSummaryRequest) {
      systemPrompt = `You are an AI assistant that creates clear, concise summaries of video conversations. Based on the provided transcript context, create a summary that works well as bullet points.

Video Transcript Context:
${contextText}

Guidelines:
- Create 3-4 separate sentences, each covering a different aspect of the conversation
- Focus on specific activities, topics, goals, or updates mentioned
- Each sentence should be substantial enough to stand alone as a bullet point
- Keep sentences concise but informative (15-25 words each)
- Use natural, conversational language
- Include specific details when mentioned (projects, activities, achievements, plans)
- Don't mention timestamps or technical details
- Structure as distinct points rather than flowing narrative

Example format: "The person shared updates about their 3D printing hobby. They're working on egg-shaped designs with hand details. A printing competition is coming up that they're excited about. Winning first prize is an important goal for them."`;
    } else {
      systemPrompt = `You are a helpful AI assistant that provides contextual responses based on video conversation transcripts between friends. Use the provided context to give relevant, concise, and helpful suggestions for replies in a casual conversation.

Context from recent conversations:
${contextText}

Guidelines:
- Keep responses conversational and friendly
- Suggest 2-3 brief reply options when appropriate
- Reference specific moments from the context when relevant
- If no relevant context exists, provide general conversation starters
- Keep suggestions under 50 words each
- Format as a simple list with bullet points or numbers`;
    }

    logger.info(`🎯 Using ${isSummaryRequest ? 'summary' : 'conversation'} prompt mode`);

    const response = await getOpenAIClient().chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        {role: "system", content: systemPrompt},
        {role: "user", content: query},
      ],
      max_tokens: 300,
      temperature: 0.7,
    });

    const generatedResponse = response.choices[0]?.message?.content || "No suggestions available.";
    logger.info(`✅ GPT-4 response: "${generatedResponse}"`);

    return generatedResponse;
  } catch (error) {
    logger.error("❌ Error generating contextual response:", error);
    throw error;
  }
}

/**
 * Complete RAG processing pipeline for a video
 */
export async function processVideoForRAG(
  videoPath: string,
  videoId: string,
  chatId: string
): Promise<void> {
  try {
    logger.info(`Starting RAG processing for video ${videoId} in chat ${chatId}`);

    // Step 1: Extract audio from video
    const audioBuffer = await extractAudioFromVideo(videoPath);

    // Step 2: Generate transcript
    const transcript = await generateTranscript(audioBuffer, `${videoId}.wav`);

    // Step 3: Create chunks
    const chunks = createOverlappingChunks(transcript.segments);

    // Step 4: Generate embeddings
    const embeddings = await generateEmbeddings(chunks);

    // Step 5: Store in Pinecone
    await storeEmbeddingsInPinecone(embeddings, videoId, chatId);

    // Step 6: Update Firestore with transcript
    await admin
      .firestore()
      .collection("chats")
      .doc(chatId)
      .collection("videos")
      .doc(videoId)
      .update({
        transcript: transcript.text,
        transcriptSegments: transcript.segments,
        transcriptDuration: transcript.duration,
        transcriptProcessedAt: admin.firestore.FieldValue.serverTimestamp(),
        ragProcessed: true,
      });

    logger.info(`RAG processing completed for video ${videoId}`);
  } catch (error) {
    logger.error(`Error in RAG processing for video ${videoId}:`, error);

    // Update Firestore with error status
    try {
      await admin
        .firestore()
        .collection("chats")
        .doc(chatId)
        .collection("videos")
        .doc(videoId)
        .update({
          ragProcessed: false,
          ragError: error instanceof Error ? error.message : "Unknown error",
          ragErrorAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    } catch (updateError) {
      logger.error("Error updating Firestore with RAG error:", updateError);
    }

    throw error;
  }
}

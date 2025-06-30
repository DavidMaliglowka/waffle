const admin = require('firebase-admin');

// Initialize Firebase Admin with application default credentials
admin.initializeApp({
  projectId: 'snapconnect-30043',
  storageBucket: 'snapconnect-30043.firebasestorage.app'
});

const db = admin.firestore();

async function checkTranscripts() {
  try {
    console.log('🔍 Checking for video transcripts in Firestore...\n');
    
    // Get all chats
    const chatsSnapshot = await db.collection('chats').get();
    
    let foundAny = false;
    
    for (const chatDoc of chatsSnapshot.docs) {
      const chatId = chatDoc.id;
      console.log(`📁 Chat: ${chatId}`);
      
      // Get videos in this chat
      const videosSnapshot = await db.collection('chats').doc(chatId).collection('videos').get();
      
      let chatHasVideos = false;
      
      for (const videoDoc of videosSnapshot.docs) {
        const videoId = videoDoc.id;
        const videoData = videoDoc.data();
        
        chatHasVideos = true;
        console.log(`  🎥 Video: ${videoId}`);
        console.log(`     Duration: ${videoData.duration || 'unknown'}s`);
        console.log(`     Created: ${videoData.createdAt ? videoData.createdAt.toDate() : 'unknown'}`);
        console.log(`     RAG Processed: ${videoData.ragProcessed || false}`);
        console.log(`     Has Transcript: ${!!videoData.transcript}`);
        
        if (videoData.transcript) {
          foundAny = true;
          console.log(`     ✅ Transcript Length: ${videoData.transcript.length} chars`);
          console.log(`     📝 Transcript: "${videoData.transcript}"`);
          
          if (videoData.transcriptSegments) {
            console.log(`     🎯 Segments: ${videoData.transcriptSegments.length}`);
          }
          
          if (videoData.transcriptProcessedAt) {
            console.log(`     ⏰ Processed At: ${videoData.transcriptProcessedAt.toDate()}`);
          }
        }
        
        if (videoData.ragError) {
          console.log(`     ❌ RAG Error: ${videoData.ragError}`);
        }
        
        console.log('');
      }
      
      if (!chatHasVideos) {
        console.log('  (no videos found)');
      }
    }
    
    if (!foundAny) {
      console.log('❌ No transcripts found in any videos');
    }
    
    console.log('✅ Check complete!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error checking transcripts:', error);
    process.exit(1);
  }
}

checkTranscripts(); 
// test/test.js

import fetch from 'node-fetch';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ——— CONFIG ———
const GEMINI_API_KEY = 'AIzaSyDeonumAfAITWCRRiSR8GlTG4KPjF6YTIk';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const MODEL = 'gemini-2.0-flash';

// Sample video URLs
export const VIDEO_URLS = {
  sample2: 'https://storage.googleapis.com/gopro_videos/sample2.mp4',
  sample3: 'https://storage.googleapis.com/gopro_videos/sample3.mp4',
  sample4: 'https://storage.googleapis.com/gopro_videos/sample4.mp4',
  sample5: 'https://storage.googleapis.com/gopro_videos/sample5.mp4'
};

// Node.js-compatible function to fetch and encode video data
async function getVideoData(url) {
  try {
    console.log('[getVideoData] fetching', url);
    const response = await fetch(url);
    console.log('[getVideoData] fetch response.ok =', response.ok);
    if (!response.ok) {
      throw new Error(`Failed to fetch video: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64data = buffer.toString('base64');
    console.log('[getVideoData] returning base64data of length', base64data.length);
    return base64data;
  } catch (error) {
    console.error('Error fetching video:', error);
    throw error;
  }
}

let conversationContext = '';

// Main analysis function that integrates with the existing chat system
export async function analyzeVideoContent(videoId, messageText, videoUrl) {
  try {
    console.log('[analyzeVideoContent] called with', { videoId, messageText, videoUrl });
    console.log('Starting video analysis...');
    console.log('Video URL:', videoUrl);
    console.log('Message:', messageText);
    
    const videoData = await getVideoData(videoUrl);
    console.log('Video data fetched successfully, length:', videoData.length);

    const model = genAI.getGenerativeModel({ model: MODEL });
    
    // Update conversation context with user's message
    conversationContext += `\nUser: ${messageText}`;
    
    const prompt = `
You are having a conversation about a video. You will receive a video [VIDEO_1].

Previous conversation context:
${conversationContext}

Please analyze the video and respond to the latest message. Keep your response natural and conversational.
If the user asks about specific timestamps or segments, include them in your response.
`;

    console.log('Sending request to Gemini...');
    const result = await model.generateContent([
      { text: prompt },
      { text: '[VIDEO_1]' },
      { 
        inlineData: {
          mimeType: 'video/mp4',
          data: videoData
        }
      }
    ]);

    const response = await result.response;
    const responseText = response.text();
    
    // Update conversation context with AI's response
    conversationContext += `\nAssistant: ${responseText}`;
    
    console.log('Received response from Gemini');
    
    // Format the response as a ChatMessage
    return {
      role: 'assistant',
      content: responseText,
      timestamp: new Date().toISOString(),
    };
    
  } catch (err) {
    console.error('Error during video analysis:', err);
    if (err.response) {
      console.error('Response text:', err.response.text());
    }
    throw err;
  }
}

// Reset conversation context
export function resetConversation() {
  conversationContext = '';
}

// Export video URLs for use in other parts of the application
export const getVideoUrls = () => VIDEO_URLS;

console.log('test.js script started');

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Always run the test block for debugging
(async () => {
  try {
    const testAnalysis = async () => {
      console.log('Running testAnalysis...');
      try {
        console.log('About to call analyzeVideoContent...');
        const result = await analyzeVideoContent('sample2', 'What is the main subject or focus of this video?', VIDEO_URLS.sample2);
        console.log('Returned from analyzeVideoContent');
        console.log('\nVideo Analysis Result:');
        console.log(result);
      } catch (error) {
        console.error('Test analysis failed:', error);
      }
      console.log('testAnalysis complete.');
    };
    await testAnalysis();
  } catch (err) {
    console.error('Top-level error:', err);
  }
})();


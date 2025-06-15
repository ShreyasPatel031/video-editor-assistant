import express from 'express';
import fetch from 'node-fetch';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = express.Router();
// Use the same API key as test.js
const GEMINI_API_KEY = 'AIzaSyDeonumAfAITWCRRiSR8GlTG4KPjF6YTIk';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const MODEL = 'gemini-2.0-flash';

let conversationContext = '';

const VIDEO_URLS = {
  sample2: 'https://storage.googleapis.com/gopro_videos/sample2.mp4',
  sample3: 'https://storage.googleapis.com/gopro_videos/sample3.mp4',
  sample4: 'https://storage.googleapis.com/gopro_videos/sample4.mp4',
  sample5: 'https://storage.googleapis.com/gopro_videos/sample5.mp4'
};

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

router.post('/analyze-video', async (req, res) => {
  const { videoUrl, messageText, videoId } = req.body;
  
  if (!videoUrl || !messageText) {
    return res.status(400).json({ error: 'Missing videoUrl or messageText' });
  }

  try {
    // Fetch and encode video
    console.log('[Gemini Backend] Fetching video:', videoUrl);
    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch video: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Video = buffer.toString('base64');
    console.log('[Gemini Backend] Video fetched and encoded, length:', base64Video.length);

    // Update conversation context
    conversationContext += `\nUser: ${messageText}`;
    const prompt = `
You are having a conversation about a video. You will receive a video [VIDEO_1].

Previous conversation context:
${conversationContext}

Please analyze the video and respond to the latest message. Keep your response natural and conversational.
If the user asks about specific timestamps or segments, include them in your response.
`;

    // Call Gemini
    const model = genAI.getGenerativeModel({ model: MODEL });
    console.log('[Gemini Backend] Sending request to Gemini...');
    
    const result = await model.generateContent([
      { text: prompt },
      {
        inlineData: {
          mimeType: 'video/mp4',
          data: base64Video,
        },
      },
    ]);

    const responseText = result.response.text();
    conversationContext += `\nAssistant: ${responseText}`;
    console.log('[Gemini Backend] Received response from Gemini');
    
    res.json({ text: responseText });
  } catch (err) {
    console.error('[Gemini Backend] Error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Reset conversation context
router.post('/reset', (req, res) => {
  conversationContext = '';
  res.json({ status: 'ok' });
});

export default router; 
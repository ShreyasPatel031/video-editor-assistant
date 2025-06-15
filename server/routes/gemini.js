import express from 'express';
import fetch from 'node-fetch';
import { VertexAI } from '@google-cloud/vertexai';
import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';

const router = express.Router();
const CREDENTIALS_PATH = path.resolve('credentials.json');
const credsJson = JSON.parse(fs.readFileSync(CREDENTIALS_PATH,'utf8'));
const vertex = new VertexAI({ project: credsJson.project_id, location: 'global', credentials: credsJson });
const MODEL = 'gemini-2.5-flash-preview-05-20';

let conversationContext = '';

const VIDEO_URLS = {
  GoPro_Sample_1: 'https://storage.googleapis.com/gopro_videos/GoPro_Sample_1.mp4',
  GoPro_Sample_2: 'https://storage.googleapis.com/gopro_videos/GoPro_Sample_2.mp4',
  GoPro_Sample_3: 'https://storage.googleapis.com/gopro_videos/GoPro_Sample_3.mp4',
  GoPro_Sample_4: 'https://storage.googleapis.com/gopro_videos/GoPro_Sample_4.mp4',
  GoPro_Sample_5: 'https://storage.googleapis.com/gopro_videos/GoPro_Sample_5.mp4',
  GoPro_Sample_6: 'https://storage.googleapis.com/gopro_videos/GoPro_Sample_6.mp4',
  GoPro_Sample_7: 'https://storage.googleapis.com/gopro_videos/GoPro_Sample_7.mp4',
  GoPro_Sample_8: 'https://storage.googleapis.com/gopro_videos/GoPro_Sample_8.mp4',
  GoPro_Sample_9: 'https://storage.googleapis.com/gopro_videos/GoPro_Sample_9.mp4'
};

const VIDEO_INFO = [
  { id: 'GoPro_Sample_1', title: 'GoPro Sample 1', url: VIDEO_URLS.GoPro_Sample_1, duration: 10.0 },
  { id: 'GoPro_Sample_2', title: 'GoPro Sample 2', url: VIDEO_URLS.GoPro_Sample_2, duration: 15.81 },
  { id: 'GoPro_Sample_3', title: 'GoPro Sample 3', url: VIDEO_URLS.GoPro_Sample_3, duration: 20.95 },
  { id: 'GoPro_Sample_4', title: 'GoPro Sample 4', url: VIDEO_URLS.GoPro_Sample_4, duration: 18.43 },
  { id: 'GoPro_Sample_5', title: 'GoPro Sample 5', url: VIDEO_URLS.GoPro_Sample_5, duration: 1.96 },
  { id: 'GoPro_Sample_6', title: 'GoPro Sample 6', url: VIDEO_URLS.GoPro_Sample_6, duration: 0 },
  { id: 'GoPro_Sample_7', title: 'GoPro Sample 7', url: VIDEO_URLS.GoPro_Sample_7, duration: 0 },
  { id: 'GoPro_Sample_8', title: 'GoPro Sample 8', url: VIDEO_URLS.GoPro_Sample_8, duration: 0 },
  { id: 'GoPro_Sample_9', title: 'GoPro Sample 9', url: VIDEO_URLS.GoPro_Sample_9, duration: 0 },
];

// Cache for already downloaded & encoded videos { url: base64 }
const videoCache = new Map();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// General chat endpoint (no video)
router.post('/general-chat', async (req, res) => {
  const { messageText } = req.body || {};
  if (!messageText || typeof messageText !== 'string') {
    return res.status(400).json({ error: 'Missing messageText' });
  }

  try {
    console.log('[Gemini Backend] general-chat → Vertex');

    const generativeModel = vertex.preview.getGenerativeModel({ model: MODEL });
    const resp = await generativeModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: messageText }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
    });

    const text = resp.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    res.json({ text });
  } catch (err) {
    console.error('[Gemini Backend] Error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

router.post('/analyze-video', async (req, res) => {
  const { videoUrl, messageText, videoId } = req.body;
  if (!videoUrl || !messageText) {
    return res.status(400).json({ error: 'Missing videoUrl or messageText' });
  }

  try {
    const prompt = `You will receive a tagged video [VIDEO_1].\nRespond in natural language to the user's request.`;
    const parts = [
      { text: prompt },
      { text: '[VIDEO_1]' },
      { fileData: { mimeType: 'video/mp4', fileUri: videoUrl } },
    ];

    console.log('[Gemini Backend] analyze-video request via Vertex');
    const generativeModel = vertex.preview.getGenerativeModel({ model: MODEL });
    const resp = await generativeModel.generateContent({
      contents: [{ role: 'user', parts }],
      generationConfig: { temperature: 0.3 },
    });

    const text = resp.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    res.json({ text });
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

// -----------------------------------------------------------------------------
// Embedding-only search (quick_video_search.py)
// -----------------------------------------------------------------------------

router.post('/embed-search', async (req, res) => {
  const { queryText, topN } = req.body || {};
  if (!queryText || typeof queryText !== 'string') {
    return res.status(400).json({ error: 'Missing queryText' });
  }

  const n = parseInt(topN, 10) > 0 ? parseInt(topN, 10) : 5;

  const scriptPath = path.resolve(process.cwd(), 'Enhanced_GoPro_Search_System', 'quick_video_search.py');

  console.log(`[EmbedSearch] Spawning quick_video_search.py for "${queryText}" (top ${n})`);

  execFile(
    'python3',
    [scriptPath, queryText, String(n)],
    { maxBuffer: 10 * 1024 * 1024 },
    (err, stdout, stderr) => {
      if (err) {
        console.error('[EmbedSearch] Python error:', err);
        console.error(stderr);
        return res.status(500).json({ error: err.message || 'Python error' });
      }

      let parsed;
      try {
        // Extract JSON substring starting at first '{' and ending at last '}'
        const txt = stdout.trim();
        const first = txt.indexOf('{');
        const last = txt.lastIndexOf('}');
        if (first === -1 || last === -1) throw new Error('No JSON braces found');
        const jsonStr = txt.substring(first, last + 1);
        parsed = JSON.parse(jsonStr);
      } catch (e) {
        console.warn('[EmbedSearch] Failed to parse JSON from python stdout');
        return res.status(500).json({ error: 'Invalid JSON from quick_video_search', raw: stdout });
      }

      res.json(parsed);
    }
  );
});

export default router; 
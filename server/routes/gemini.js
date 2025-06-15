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
  sample2: 'https://storage.googleapis.com/gopro_videos/sample2.mp4'
};

const VIDEO_INFO = [
  { id: 'sample2', title: 'GoPro Sample 2', url: VIDEO_URLS.sample2, duration: 15.81 },
  { id: 'sample3', title: 'GoPro Sample 3', url: VIDEO_URLS.sample3, duration: 20.95 },
  { id: 'sample4', title: 'GoPro Sample 4', url: VIDEO_URLS.sample4, duration: 18.43 },
  { id: 'sample5', title: 'GoPro Sample 5', url: VIDEO_URLS.sample5, duration: 1.96 },
];

// Cache for already downloaded & encoded videos { url: base64 }
const videoCache = new Map();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// General chat endpoint (no video)
router.post('/general-chat', async (req, res) => {
  // We ignore messageText for now; vertex_test.py already contains the prompt.

  const scriptPath = path.resolve(process.cwd(), 'vertex_test.py');

  console.log('[Gemini Backend] Spawning Vertex test script…');

  execFile('python3', [scriptPath, '--json'], { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
    if (err) {
      console.error('[Gemini Backend] vertex_test.py error:', err);
      console.error(stderr);
      return res.status(500).json({ error: err.message || 'Python error' });
    }

    let parsed;
    try {
      parsed = JSON.parse(stdout.trim());
    } catch (e) {
      console.warn('[Gemini Backend] Failed to parse JSON from python stdout');
      return res.status(500).json({ error: 'Invalid JSON from vertex_test', raw: stdout });
    }

    res.json({ snippets: parsed });
  });
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
    const [resp] = await vertex.previewServiceClient.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts }],
      generationConfig: { temperature: 0.3 },
    });

    const text = resp.candidates?.[0]?.content?.parts?.[0]?.text || '';
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

export default router; 
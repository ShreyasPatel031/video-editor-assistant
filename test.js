// test/test.js

import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Ajv from 'ajv';

/* --------------------------- CONFIG ---------------------------------- */
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyDeonumAfAITWCRRiSR8GlTG4KPjF6YTIk';
const MODEL = 'gemini-2.5-flash-preview-05-20';

// Videos you want analysed (tag, gs:// or https:// URI)
const GS_VIDEOS = [
  ['2', 'https://storage.googleapis.com/gopro_videos/sample2.mp4'],
  ['3', 'https://storage.googleapis.com/gopro_videos/sample3.mp4'],
  ['4', 'https://storage.googleapis.com/gopro_videos/sample4.mp4'],
];

const PROMPT = `You will receive several tagged videos [VIDEO_1] [VIDEO_2] [VIDEO_3].\n\nProduce ONE JSON array.  Each element must be:\n  {\n    "video_id": "VIDEO_1",        // the tag\n    "start":    "HH:MM:SS",       // two-digit hours, minutes, seconds\n    "end":      "HH:MM:SS|null",  // may be null\n    "description": "visual summary for that slice"\n  }\n\n• Interleave snippets from different videos in chronological or logical order.\n• 3-4 snippets per video (≤10 total).\n• NO ranges like 00:00-00:05, no decimals, no extra keys, no prose outside JSON.`;

const TIME_RE = '^\\d{2}:\\d{2}:\\d{2}$';
const SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      video_id: { type: 'string' },
      start: { type: 'string', pattern: TIME_RE },
      end: { type: 'string', pattern: TIME_RE },
      description: { type: 'string' },
    },
    required: ['video_id', 'start', 'end', 'description'],
  },
};
/* --------------------------------------------------------------------- */

const CACHE_DIR = path.resolve('.cache_videos');
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function cachePathFor(uri) {
  const hash = Buffer.from(uri).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
  return path.join(CACHE_DIR, `${hash}.b64`);
}

function sanitise(txt) {
  // Remove trailing commas and fix malformed times
  return txt
    .trim()
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/"(start|end)"\s*:\s*"(\d{2}:\d{2}:\d{2})[^\"]*"/g, '"$1":"$2"')
    .replace(/"end"\s*:\s*null/g, '"end":"00:00:00"');
}

// Helper: convert gs://bucket/path to public https URL (works for publicly readable objects)
function gsToHttps(gsUri) {
  const match = gsUri.match(/^gs:\/\/([^\/]+)\/(.+)$/);
  if (!match) return gsUri;
  const [, bucket, object] = match;
  // Encode each path component to preserve spaces and parentheses
  const encodedObject = object.split('/').map(encodeURIComponent).join('/');
  return `https://storage.googleapis.com/${bucket}/${encodedObject}`;
}

async function getVideoData(uri) {
  throw new Error('getVideoData should not be called when using fileUri');
}

async function buildParts() {
  const parts = [{ text: PROMPT }];
  for (const [tag, uri] of GS_VIDEOS) {
    parts.push({ text: `[VIDEO_${tag}]` });
    parts.push({ fileData: { mimeType: 'video/mp4', fileUri: uri } });
  }
  return parts;
}

async function run() {
  if (!GEMINI_API_KEY || GEMINI_API_KEY.includes('YOUR_GEMINI_KEY_HERE')) {
    console.error('❌  Set GEMINI_API_KEY environment variable first');
    process.exit(1);
  }

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: MODEL });

  console.log('▶  Sending request to Gemini …');
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: await buildParts() }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
    ],
  });

  let raw = result.response.text();
  console.log('\n--- RAW Gemini output (before sanitise) ---\n');
  console.log(raw);
  console.log('\n--- End RAW ---\n');
  raw = sanitise(raw);
  console.log('\n--- Sanitised output ---\n');
  console.log(raw);
  console.log('\n--- End Sanitised ---\n');

  let snippets;
  try {
    snippets = JSON.parse(raw);
  } catch (err) {
    console.warn('⚠️  JSON parse failed, attempting fallback:', err.message);
    // Last-ditch: wrap in [] if missing
    try {
      snippets = JSON.parse(`[${raw}]`);
    } catch (e2) {
      console.error('❌ Could not parse Gemini output');
      console.error(raw);
      process.exit(1);
    }
  }

  // Validate against schema using ajv
  const ajv = new Ajv({ strict: false });
  const validate = ajv.compile(SCHEMA);
  if (!validate(snippets)) {
    console.warn('⚠️  Gemini output fails schema validation:', validate.errors);
  }

  // Pretty print
  console.log('\n— Gemini Snippets —');
  for (const sn of snippets) {
    const vid = sn.video_id;
    const start = sn.start;
    const end = sn.end ?? '…';
    console.log(`${vid}  🕒 ${start} – ${end}: ${sn.description}`);
  }
}

run().catch((err) => {
  console.error('❌  Unhandled error:', err);
  process.exit(1);
});


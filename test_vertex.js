// test_vertex.js – runs Gemini via Vertex-AI using service-account creds
import fs from 'fs';
import path from 'path';
import {VertexAI} from '@google-cloud/vertexai';
import Ajv from 'ajv';

/************************* CONFIG ***********************************/
const LOCATION = 'us-central1';
const CREDENTIALS_PATH = path.resolve('credentials.json');

const GS_VIDEOS = [
  ['1', 'gs://go_pro_video_test/videoplayback (10).mp4'],
  ['2', 'gs://go_pro_video_test/videoplayback (2).mp4'],
  ['3', 'gs://go_pro_video_test/videoplayback (4).mp4'],
];

const MODEL = 'gemini-2.5-pro-preview-06-05'; // full path not needed, VertexAI resolves publisher

const PROMPT = `You will receive several tagged videos [VIDEO_1] [VIDEO_2] [VIDEO_3].\n\nProduce ONE JSON array.  Each element must be:\n  {\n    \"video_id\": \"VIDEO_1\",        // the tag\n    \"start\":    \"HH:MM:SS\",       // two-digit hours, minutes, seconds\n    \"end\":      \"HH:MM:SS|null\",  // may be null\n    \"description\": \"visual summary for that slice\"\n  }\n\n• Interleave snippets from different videos in chronological or logical order.\n• 3-4 snippets per video (≤10 total).\n• NO ranges like 00:00-00:05, no decimals, no extra keys, no prose outside JSON.`;

/********************************************************************/

const TIME_RE = '^\\d{2}:\\d{2}:\\d{2}$';
const SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      video_id: {type: 'string'},
      start: {type: 'string', pattern: TIME_RE},
      end: {type: 'string', pattern: TIME_RE, nullable: true},
      description: {type: 'string'},
    },
    required: ['video_id', 'start', 'end', 'description'],
  },
};

function sanitise(txt){
  return txt.trim()
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/\"(start|end)\"\s*:\s*\"(\d{2}:\d{2}:\d{2})[^\"]*\"/g,'"$1":"$2"')
    .replace(/\"end\"\s*:\s*null/g,'"end":"00:00:00"');
}

function buildParts(){
  const parts = [{text: PROMPT}];
  for(const [tag,uri] of GS_VIDEOS){
    parts.push({text:`[VIDEO_${tag}]`});
    parts.push({fileData:{mimeType:'video/mp4',fileUri:uri}});
  }
  return parts;
}

async function run(){
  // init Vertex client
  const vertex = new VertexAI({
    project: JSON.parse(fs.readFileSync(CREDENTIALS_PATH,'utf8')).project_id,
    location: LOCATION,
    credentials: JSON.parse(fs.readFileSync(CREDENTIALS_PATH,'utf8')),
  });

  const req = {
    model: MODEL,
    contents: [{role:'user', parts: buildParts()}],
    generationConfig:{
      temperature:0.3,
      maxOutputTokens:4096,
      responseMimeType:'application/json',
    },
    safetySettings:[
      {category:'HARM_CATEGORY_HATE_SPEECH', threshold:'BLOCK_NONE'},
      {category:'HARM_CATEGORY_DANGEROUS_CONTENT', threshold:'BLOCK_NONE'},
      {category:'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold:'BLOCK_NONE'},
      {category:'HARM_CATEGORY_HARASSMENT', threshold:'BLOCK_NONE'},
    ],
    responseSchema: SCHEMA,
  };

  console.log('▶ Sending request to Vertex-AI …');
  const [resp] = await vertex.previewServiceClient.generateContent(req);
  const raw = resp.candidates?.[0]?.content?.parts?.[0]?.text || '';
  console.log('\n--- RAW ---\n', raw, '\n--- END RAW ---');
  const clean = sanitise(raw);
  const snippets = JSON.parse(clean);

  const ajv = new Ajv({strict:false});
  if(!ajv.validate(SCHEMA,snippets)){
    console.warn('⚠ Schema validation errors', ajv.errors);
  }
  console.log('\n— Gemini Snippets —');
  for(const sn of snippets){
    console.log(`${sn.video_id} 🕒 ${sn.start} – ${sn.end ?? '…'}: ${sn.description}`);
  }
}

run().catch(err=>{
  console.error('❌ Error', err);
  process.exit(1);
}); 
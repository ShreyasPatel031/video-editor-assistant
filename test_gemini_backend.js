import fetch from 'node-fetch';

async function testGemini() {
  const res = await fetch('http://localhost:5000/api/gemini/analyze-video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      videoUrl: 'https://storage.googleapis.com/gopro_videos/sample2.mp4',
      messageText: 'Describe the main action in this video.',
      videoId: 'sample2'
    })
  });
  const data = await res.json();
  if (!res.ok) {
    console.error('Error:', data);
    process.exit(1);
  }
  console.log('Gemini response:', data.text);
}

testGemini(); 
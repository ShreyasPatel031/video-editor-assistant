import fetch from 'node-fetch';

const VIDEO_URLS = [
  'https://storage.googleapis.com/gopro_videos/sample2.mp4',
  'https://storage.googleapis.com/gopro_videos/sample3.mp4',
  'https://storage.googleapis.com/gopro_videos/sample4.mp4',
  'https://storage.googleapis.com/gopro_videos/sample5.mp4'
];

const QUESTIONS = [
  'What is the main subject or focus of this video?',
  'Describe the scenery in this video.',
  'Is there any action or movement in the video?',
  'What stands out the most in this video?',
  'Summarize what happens in this video.',
  'What kind of environment is shown?',
  'Is there a vehicle in the video?',
  'What is the weather like?',
  'Are there any people visible?',
  'What is the camera perspective?',
  'Is there any notable color or lighting?',
  'What is the mood of the video?',
  'Is there any water or nature visible?',
  'What is the likely location?',
  'Is the video indoors or outdoors?',
  'What time of day is it?',
  'Is there any text or signage visible?',
  'What is the most interesting moment?',
  'Describe the beginning of the video.',
  'Describe the end of the video.',
  'Is there any sound or music?',
  'What is the speed of movement?',
  'Is the video stable or shaky?',
  'What is the likely purpose of the video?',
  'Is there any danger or excitement?',
  'What is the camera quality?',
  'Is the video edited or raw?',
  'What is the duration of the video?',
  'Is there any slow motion or time lapse?',
  'What is the best frame in the video?'
];

async function runStressTest() {
  let successCount = 0;
  for (let i = 0; i < 30; i++) {
    const videoUrl = VIDEO_URLS[i % VIDEO_URLS.length];
    const messageText = QUESTIONS[i % QUESTIONS.length];
    const videoId = `sample${(i % VIDEO_URLS.length) + 2}`;
    console.log(`\n[${i + 1}/30] Sending request: videoId=${videoId}, question="${messageText}"`);
    try {
      const res = await fetch('http://localhost:5000/api/gemini/analyze-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl, messageText, videoId })
      });
      const data = await res.json();
      if (res.ok && data.text) {
        console.log(`[SUCCESS] Gemini response:`, data.text.slice(0, 300));
        successCount++;
      } else {
        console.error(`[ERROR]`, data);
      }
    } catch (err) {
      console.error(`[EXCEPTION]`, err);
    }
  }
  console.log(`\nTotal successful Gemini responses: ${successCount}/30`);
}

runStressTest(); 
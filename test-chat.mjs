import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = 'AIzaSyAKvr1pQOWZyZq8bCE5a1Bc1qBzDNo-5bw';
const genAI = new GoogleGenerativeAI(API_KEY);

async function testChat() {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-05-20" });
    
    const prompt = `You are a helpful AI assistant for a video editing application. 
    The user's question is: "What are the best video codecs and formats for different use cases (web streaming, archival storage, editing)? Please explain the trade-offs between quality, file size, and compatibility."
    
    Please provide a clear and helpful response.`;

    console.log("Sending request to Gemini API...");
    const result = await model.generateContent(prompt);
    const response = await result.response;
    console.log("\nGemini Response:");
    console.log(response.text());
  } catch (error) {
    console.error("Error:", error);
  }
}

testChat(); 
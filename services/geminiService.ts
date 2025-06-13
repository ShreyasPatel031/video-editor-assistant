// This file MOCKS interactions with the Gemini API.
// In a real application, you would import GoogleGenAI and make actual API calls.
// import { GoogleGenAI, GenerateContentResponse, Chat } from "@google/genai";
import { ChatMessage, GroundingChunk } from '../types';
import { GEMINI_TEXT_MODEL } from '../constants';

// const API_KEY = process.env.API_KEY;
// if (!API_KEY) {
//   console.warn("API_KEY environment variable is not set. Gemini API calls will fail.");
// }
// const ai = new GoogleGenAI({ apiKey: API_KEY! });

const simulateApiCall = <T,>(data: T, delay: number = 500): Promise<T> => {
  return new Promise(resolve => setTimeout(() => resolve(data), delay));
};

export const analyzeVideoContent = async (videoId: string, question: string): Promise<ChatMessage> => {
  console.log(`[Mock Gemini] Analyzing video "${videoId}" for question: "${question}" using ${GEMINI_TEXT_MODEL}`);
  
  let text = `Regarding your video, your question was: "${question}". `;
  const timestampLinks: Array<{ text: string; time: number }> = [];

  if (question.toLowerCase().includes("timestamp") || question.toLowerCase().includes("at what time")) {
    const time1 = Math.floor(Math.random() * 60);
    const time2 = Math.floor(Math.random() * 60);
    text += `I found a relevant moment around ${formatTime(time1)}. There's also something interesting at ${formatTime(time2)}.`;
    timestampLinks.push({ text: `See moment at ${formatTime(time1)}`, time: time1 });
    timestampLinks.push({ text: `Check this part at ${formatTime(time2)}`, time: time2 });
  } else if (question.toLowerCase().includes("summary")) {
    text += `This video appears to contain interesting content. I can help analyze specific segments or answer questions about what you're seeing.`;
  } else {
    text += "I've processed your query. I can help you find specific moments in your video or analyze the content you're working with.";
  }

  const aiResponse: ChatMessage = {
    id: `ai_msg_${Date.now()}`,
    sender: 'ai',
    text: text,
    timestampLinks: timestampLinks,
  };
  return simulateApiCall(aiResponse, 1200);
};

export const generalChat = async (query: string): Promise<ChatMessage> => {
  console.log(`[Mock Gemini] General chat query: "${query}" using ${GEMINI_TEXT_MODEL}`);
  let text = `You asked: "${query}". `;
  if (query.toLowerCase().includes("help") || query.toLowerCase().includes("how to")) {
    text += "I can help you analyze video content or answer questions about video editing. Try opening a video and asking questions about it, or ask me about video editing concepts.";
  } else if (query.toLowerCase().includes("video editing") || query.toLowerCase().includes("editing")) {
    text += "Video editing involves selecting segments, arranging them in sequence, and refining the content. You can use the timeline to select specific portions of your videos and add them to your workspace.";
  } else if (query.toLowerCase().includes("segment")) {
    text += "To create segments, use the arrow markers on the video timeline to select start and end points, then click 'Add Segment' to add them to your workspace.";
  } else {
    text += "This is a general AI response. I am ready to assist with your video editing tasks!";
  }
   const aiResponse: ChatMessage = {
    id: `ai_msg_${Date.now()}`,
    sender: 'ai',
    text: text,
  };
  return simulateApiCall(aiResponse, 700);
};

// Helper to format time for display
export const formatTime = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

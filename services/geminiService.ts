// This file MOCKS interactions with the Gemini API.
// In a real application, you would import GoogleGenAI and make actual API calls.
// import { GoogleGenAI, GenerateContentResponse, Chat } from "@google/genai";
import { ChatMessage, GroundingChunk } from '../types';
import { GEMINI_TEXT_MODEL } from '../constants';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, Part } from '@google/generative-ai';

// const API_KEY = process.env.API_KEY;
// if (!API_KEY) {
//   console.warn("API_KEY environment variable is not set. Gemini API calls will fail.");
// }
// const ai = new GoogleGenAI({ apiKey: API_KEY! });

// API Configuration
const GEMINI_API_KEY = 'AIzaSyAKvr1pQOWZyZq8bCE5a1Bc1qBzDNo-5bw';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const MODEL = 'gemini-2.0-flash';

// Store conversation context per videoId
const videoConversationContexts: Record<string, string> = {};

// Function to fetch and encode video data - using the working implementation from test.js
async function getVideoData(url: string): Promise<string> {
    console.log(`[geminiService.getVideoData] Attempting to fetch video from URL: ${url}`);
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch video: ${response.statusText}`);
        }
        const blob = await response.blob();
        console.log(`[geminiService.getVideoData] Video fetched successfully. Blob size: ${blob.size}, type: ${blob.type}`);
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (typeof reader.result === 'string') {
                    const base64data = reader.result.split(',')[1];
                    resolve(base64data);
                } else {
                    reject(new Error('Failed to read video data as string'));
                }
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error('Error fetching video:', error);
        throw error;
    }
}

// Main analysis function that integrates with the existing chat system
export async function analyzeVideoContent(
    videoId: string,
    messageText: string,
    videoUrl: string
): Promise<ChatMessage> {
    try {
        console.log('[geminiService] Starting video analysis...');
        console.log('[geminiService] Video URL:', videoUrl);
        console.log('[geminiService] Message:', messageText);
        
        const videoData = await getVideoData(videoUrl);
        console.log('[geminiService] Video data fetched successfully');

        const model = genAI.getGenerativeModel({ 
            model: MODEL,
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            ],
        });
        
        // Initialize or get conversation context for this video
        if (!videoConversationContexts[videoId]) {
            videoConversationContexts[videoId] = '';
        }
        
        // Update conversation context with user's message
        videoConversationContexts[videoId] += `\nUser: ${messageText}`;
        
        const prompt = `
You are having a conversation about a video. You will receive a video [VIDEO_1].

Previous conversation context:
${videoConversationContexts[videoId]}

Please analyze the video and respond to the latest message. Keep your response natural and conversational.
If the user asks about specific timestamps or segments, include them in your response.
`;

        console.log('[geminiService] Sending request to Gemini...');
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
        videoConversationContexts[videoId] += `\nAssistant: ${responseText}`;
        
        console.log('[geminiService] Received response from Gemini');
        
        // Format the response as a ChatMessage
        return {
            id: `ai_${videoId}_${Date.now()}`,
    sender: 'ai',
            text: responseText,
            timestamp: Date.now(),
        };
        
    } catch (err) {
        console.error('[geminiService] Error during video analysis:', err);
        if (err.response) {
            console.error('[geminiService] Response text:', err.response.text());
        }
        throw err;
    }
}

// Reset conversation context for a specific video
export function resetConversation(videoId?: string) {
    if (videoId) {
        delete videoConversationContexts[videoId];
    } else {
        Object.keys(videoConversationContexts).forEach(key => {
            delete videoConversationContexts[key];
        });
    }
}

// Keep the general chat function for non-video queries
export const generalChat = async (query: string): Promise<ChatMessage> => {
    console.log(`[geminiService] General chat query: "${query}"`);
    const model = genAI.getGenerativeModel({ model: MODEL });
    
    try {
        const result = await model.generateContent(query);
        const response = await result.response;
        const responseText = response.text();
        
        return {
            id: `ai_general_${Date.now()}`,
    sender: 'ai',
            text: responseText,
            timestamp: Date.now(),
  };
    } catch (err) {
        console.error('[geminiService] Error in general chat:', err);
        throw err;
    }
};

// Helper to format time for display
export const formatTime = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

import { ChatMessage } from '../types';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, Part, SafetyRating, HarmProbability } from '@google/generative-ai';

const GEMINI_API_KEY = 'AIzaSyAKvr1pQOWZyZq8bCE5a1Bc1qBzDNo-5bw'; // As provided
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Single model name configuration
const GEMINI_MODEL_NAME = "gemini-2.0-flash"; 

// Store conversation context per videoId and a global one
const videoConversationContexts: Record<string, string> = {};
let globalConversationContext = '';

// Function to fetch and encode video data
async function getVideoData(url: string): Promise<string> {
    console.log(`[geminiService.getVideoData] Attempting to fetch video from URL: ${url}`);
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`[geminiService.getVideoData] Failed to fetch video. Status: ${response.status}, Text: ${response.statusText}, URL: ${url}`);
            throw new Error(`Failed to fetch video: ${response.status} ${response.statusText} from URL: ${url}`);
        }
        const blob = await response.blob();
        console.log(`[geminiService.getVideoData] Video fetched successfully. Blob size: ${blob.size}, type: ${blob.type}`);
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (reader.result) {
                    const base64data = (reader.result as string).split(',')[1];
                    console.log(`[geminiService.getVideoData] Video successfully read and base64 encoded. Data length: ${base64data?.length}`);
                    resolve(base64data);
                } else {
                    console.error("[geminiService.getVideoData] FileReader failed to read blob (reader.result is null).");
                    reject(new Error("FileReader failed to read blob."));
                }
            };
            reader.onerror = (error) => {
                console.error("[geminiService.getVideoData] FileReader error:", error);
                reject(error || new Error("FileReader error"));
            };
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error(`[geminiService.getVideoData] Error fetching or processing video from ${url}:`, error);
        throw error;
    }
}

export const resetVideoConversation = (videoId: string) => {
    videoConversationContexts[videoId] = '';
};

export const resetGlobalConversation = () => {
    globalConversationContext = '';
};

export const analyzeVideoContent = async (
    videoId: string, // Used to key conversation context
    messageText: string,
    videoUrl?: string
): Promise<ChatMessage> => {
    console.log(`[geminiService.analyzeVideoContent] Called for videoId: ${videoId}, messageText: "${messageText}", videoUrl: ${videoUrl}`);
    if (!videoUrl) {
        console.error("[geminiService.analyzeVideoContent] Video URL is missing.");
        return {
            id: `ai_err_vid_${videoId}_${Date.now()}`,
            sender: 'ai',
            text: "I'm sorry, but a video URL is needed for me to analyze the content. Please ensure the video is loaded correctly.",
            timestampLinks: []
        };
    }

    try {
        const videoData = await getVideoData(videoUrl);
        if (!videoData || videoData.length === 0) {
            console.error("[geminiService.analyzeVideoContent] videoData is empty or null after getVideoData call.");
            throw new Error("Failed to obtain valid video data.");
        }
        console.log(`[geminiService.analyzeVideoContent] Video data obtained. Length: ${videoData.length}. Preparing to send to Gemini.`);

        const model = genAI.getGenerativeModel({ 
            model: GEMINI_MODEL_NAME,
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            ],
        });

        if (!videoConversationContexts[videoId]) {
            videoConversationContexts[videoId] = '';
        }
        // Add only the latest user message to the context for this turn.
        // The full context is built into the prompt itself.
        const currentTurnUserMessage = `User: ${messageText}`;
        videoConversationContexts[videoId] += `\n${currentTurnUserMessage}`;


        // Construct the text part of the prompt
        const textPromptPart = `You are having a conversation about a video. You will receive the video data along with this prompt.
        The video is identified as [VIDEO_1].

        Previous conversation context for this video (video ID: ${videoId}):
        ${videoConversationContexts[videoId].replace(currentTurnUserMessage, '') /* Show context *before* this turn */}

        Based on the video [VIDEO_1] and the entire conversation history, please respond to the latest user message:
        User: "${messageText}"

        Analyze the video content and provide a relevant, conversational response. If the user asks about specific timestamps or segments, try to identify them in [VIDEO_1].`;

        const mimeType = 'video/mp4'; // Assuming mp4 for now. Could be dynamic if we check blob.type

        const requestPayload: Part[] = [
            { text: textPromptPart },
            { 
                inlineData: {
                    mimeType: mimeType,
                    data: videoData
                }
            }
        ];
        
        console.log(`[geminiService.analyzeVideoContent] Sending request to Gemini. Model: ${GEMINI_MODEL_NAME}, MimeType: ${mimeType}, Video Data Length: ${videoData.length}`);
        console.log("[geminiService.analyzeVideoContent] Text prompt being sent to Gemini:", textPromptPart);
        // console.log("[geminiService.analyzeVideoContent] Full request payload (excluding base64 data for brevity):", JSON.stringify(requestPayload.map(p => p.text ? {text: p.text} : {inlineData: {mimeType: p.inlineData?.mimeType, data_length: p.inlineData?.data.length}}), null, 2));

        const result = await model.generateContent(requestPayload);

        const response = result.response;
        const responseText = response.text();
        console.log('[geminiService.analyzeVideoContent] Received response from Gemini:', responseText);

        videoConversationContexts[videoId] += `\nAssistant: ${responseText}`;

        return {
            id: `ai_vid_${videoId}_${Date.now()}`,
            sender: 'ai',
            text: responseText,
            timestampLinks: []
        };

    } catch (err: any) {
        console.error('[geminiService.analyzeVideoContent] Error during video analysis:', err);
        let errorMessage = "Sorry, I encountered an error trying to analyze the video.";
        if (err.message) {
            errorMessage += ` Details: ${err.message}`;
        }
        // More detailed error logging from Gemini if available
        if (err.response && err.response.candidates && err.response.candidates.length > 0) {
            const candidate = err.response.candidates[0];
            if (candidate.finishReason && candidate.finishReason !== 'STOP') {
                errorMessage += ` Gemini Finish Reason: ${candidate.finishReason}.`;
                if (candidate.finishReason === 'SAFETY') {
                    errorMessage += ` The request was blocked due to safety concerns.`;
                    if (candidate.safetyRatings) {
                        const problematicRatings = candidate.safetyRatings.filter(
                            (sr: SafetyRating) => 
                                sr.probability === HarmProbability.MEDIUM || 
                                sr.probability === HarmProbability.HIGH
                        );
                        if (problematicRatings.length > 0) {
                            errorMessage += ` Problematic categories: ${problematicRatings.map((r: SafetyRating) => r.category).join(', ')}.`;
                        }
                    }
                }
            }
        }
        if (err.toString) {
            errorMessage += ` Error details: ${err.toString()}`;
        }
        console.error("[geminiService.analyzeVideoContent] Full error object:", JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
        
        return {
            id: `ai_err_vid_${videoId}_${Date.now()}`,
            sender: 'ai',
            text: errorMessage,
            timestampLinks: []
        };
    }
};

export const generalChat = async (messageText: string): Promise<ChatMessage> => {
    console.log(`[geminiService.generalChat] Received message: ${messageText}`);
    try {
        const model = genAI.getGenerativeModel({ 
            model: GEMINI_MODEL_NAME,
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            ]
        });

        globalConversationContext += `\nUser: ${messageText}`;

        const prompt = `
You are a helpful AI assistant.
Previous conversation context:
${globalConversationContext}

User's latest message: "${messageText}"
Respond to the user's message.
`;
        console.log('[geminiService.generalChat] Sending request to Gemini for general chat...');
        console.log("[geminiService.generalChat] Text prompt being sent to Gemini:", prompt);
        const result = await model.generateContent(prompt);
        const response = result.response;
        const responseText = response.text();
        console.log('[geminiService.generalChat] Received response from Gemini.');
        
        globalConversationContext += `\nAssistant: ${responseText}`;

        return {
            id: `ai_gen_${Date.now()}`,
            sender: 'ai',
            text: responseText,
            timestampLinks: [] // Placeholder
        };

    } catch (err: any) {
        console.error('[geminiService.generalChat] Error during general chat:', err);
        let errorMessage = "Sorry, I encountered an error.";
        if (err.message) {
            errorMessage += ` Details: ${err.message}`;
        }
        if (err.response && err.response.candidates && err.response.candidates.length > 0) {
            const candidate = err.response.candidates[0];
            if (candidate.finishReason && candidate.finishReason !== 'STOP') {
                errorMessage += ` Gemini Finish Reason: ${candidate.finishReason}.`;
                if (candidate.finishReason === 'SAFETY') {
                    errorMessage += ` The request was blocked due to safety concerns.`;
                    if (candidate.safetyRatings) {
                        const problematicRatings = candidate.safetyRatings.filter(
                            (sr: SafetyRating) => 
                                sr.probability === HarmProbability.MEDIUM || 
                                sr.probability === HarmProbability.HIGH
                        );
                        if (problematicRatings.length > 0) {
                            errorMessage += ` Problematic categories: ${problematicRatings.map((r: SafetyRating) => r.category).join(', ')}.`;
                        }
                    }
                }
            }
        }
        if (err.toString) {
            errorMessage += ` Error details: ${err.toString()}`;
        }
        console.error("[geminiService.generalChat] Full error object:", JSON.stringify(err, Object.getOwnPropertyNames(err), 2));

        return {
            id: `ai_err_gen_${Date.now()}`,
            sender: 'ai',
            text: errorMessage,
            timestampLinks: []
        };
    }
};

// Update VIDEO_URLS to reflect the correct GCS URLs from test.js
export const VIDEO_URLS: Record<string, string> = {
    'sample1': 'https://storage.googleapis.com/gopro_videos/sample1.mp4',
    'sample2': 'https://storage.googleapis.com/gopro_videos/sample2.mp4',
    'sample3': 'https://storage.googleapis.com/gopro_videos/sample3.mp4',
    'sample4': 'https://storage.googleapis.com/gopro_videos/sample4.mp4',
    'sample5': 'https://storage.googleapis.com/gopro_videos/sample5.mp4'
}; 
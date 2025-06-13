import { ChatMessage } from '../types';

// Sample video URLs for testing
export const VIDEO_URLS: Record<string, string> = {
    'sample1': '/Video/videoplayback.mp4',
    'sample2': '/Video/videoplayback (1).mp4',
};

let conversationHistory: ChatMessage[] = [];
let conversationContext = '';

export const resetConversation = () => {
    conversationHistory = [];
    conversationContext = '';
};

export const analyzeVideoContent = async (
    videoId: string,
    message: string,
    videoUrl?: string
): Promise<ChatMessage> => {
    try {
        // For now, we'll use a mock response since we're setting up the structure
        const mockResponse: ChatMessage = {
            id: `ai_${Date.now()}`,
            sender: 'ai',
            text: `Analyzing video ${videoId}: ${message}\nVideo URL: ${videoUrl || 'Not provided'}`,
            timestampLinks: []
        };

        // Add to conversation history
        conversationHistory.push(mockResponse);
        
        // Update conversation context
        conversationContext = `${conversationContext}\nUser: ${message}\nAssistant: ${mockResponse.text}`;

        return mockResponse;
    } catch (error) {
        console.error('Error in analyzeVideoContent:', error);
        throw error;
    }
};

export const generalChat = async (message: string): Promise<ChatMessage> => {
    try {
        // For now, return a mock response
        const mockResponse: ChatMessage = {
            id: `ai_${Date.now()}`,
            sender: 'ai',
            text: `General chat response to: ${message}`,
            timestampLinks: []
        };

        return mockResponse;
    } catch (error) {
        console.error('Error in generalChat:', error);
        throw error;
    }
}; 
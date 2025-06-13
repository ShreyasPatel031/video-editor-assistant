import { analyzeVideoContent, resetConversation, VIDEO_URLS } from '../src/services/geminiService';

describe('Gemini Service Integration Tests', () => {
  beforeEach(() => {
    resetConversation();
  });

  it('should analyze video content and return a valid response', async () => {
    const videoId = 'sample1';
    const message = 'What is happening in this video?';
    const videoUrl = VIDEO_URLS[videoId];

    try {
      const response = await analyzeVideoContent(videoId, message, videoUrl);
      
      // Verify response structure
      expect(response).toHaveProperty('role', 'assistant');
      expect(response).toHaveProperty('content');
      expect(response).toHaveProperty('timestamp');
      
      // Verify content is not empty
      expect(response.content.length).toBeGreaterThan(0);
      
      // Log response after assertions
      console.log('Test Response:', response);
      
      // Return a resolved promise to ensure async completion
      return Promise.resolve();
    } catch (error) {
      console.error('Test failed:', error);
      return Promise.reject(error);
    }
  }, 60000); // Increase timeout to 120 seconds for API call
}); 
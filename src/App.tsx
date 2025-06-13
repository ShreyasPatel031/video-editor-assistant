import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { TabDefinition, VideoSource, VideoSegment, ChatMessage, GroundingChunk } from './types';
import { WORKSPACE_TAB_ID, INITIAL_WORKSPACE_TAB } from './constants';
import { WorkspaceView } from './components/WorkspaceView';
import { SourceVideoView } from './components/SourceVideoView';
import * as GeminiService from './services/geminiService';
import { VIDEO_URLS } from './services/geminiService';
import { SearchIcon, CloseIcon, WorkspaceIcon, VideoIcon, ChatIcon, LinkIcon, WarningIcon, FolderOpenIcon, PlusIcon as UploadIcon, MoreHorizontalIcon, ChevronRightIcon as ViewAllIcon } from './components/Icons';
import { Button } from './components/Button';
import { LoadingSpinner } from './components/LoadingSpinner';

const App: React.FC = () => {
  const [globalChatHistory, setGlobalChatHistory] = useState<ChatMessage[]>([]);
  const [isGlobalChatLoading, setIsGlobalChatLoading] = useState(false);
  
  const handleSendGlobalChatMessage = async (messageText: string) => {
    console.log('Assistant Input:', messageText); // Log user input
    
    const userMessage: ChatMessage = { id: `user_${Date.now()}`, sender: 'user', text: messageText };
    setGlobalChatHistory(prev => [...prev, userMessage]);
    setIsGlobalChatLoading(true);

    try {
        // Use the sample1 video as default for global chat
        const videoId = 'sample1';
        const videoUrl = VIDEO_URLS[videoId];
        console.log('Sending to Gemini with video:', videoUrl);
        
        const aiResponse = await GeminiService.analyzeVideoContent(videoId, messageText, videoUrl);
        console.log('Gemini Response:', aiResponse);
        
        setGlobalChatHistory(prev => [...prev, aiResponse]);
    } catch (error) {
      console.error("Error in global chat:", error);
      const errorResponse: ChatMessage = { 
        id: `ai_err_${Date.now()}`, 
        sender: 'ai', 
        text: "Sorry, I encountered an error. Please try again." 
      };
      setGlobalChatHistory(prev => [...prev, errorResponse]);
    } finally {
      setIsGlobalChatLoading(false);
    }
  };

  // ... rest of the existing code ...
}; 
import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from '../types';
import { Button } from '../../components/Button';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { LinkIcon, ChevronRightIcon, TimestampIcon as TimestampClickIcon } from '../../components/Icons'; // Added TimestampClickIcon for potential use

interface ChatPanelProps {
  chatHistory: ChatMessage[];
  onSendMessage: (messageText: string) => Promise<void> | void;
  isLoading: boolean;
  placeholderText?: string;
  title?: string;
  examplePrompts?: { id: string; text: string; action?: string }[];
  className?: string;
  showTitle?: boolean;
  autoScroll?: boolean;
  onTimestampClick?: (time: number) => void; // Added optional onTimestampClick prop
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  chatHistory,
  onSendMessage,
  isLoading,
  placeholderText = "Type your message...",
  title = "Chat",
  examplePrompts,
  className = "",
  showTitle = true,
  autoScroll = true,
  onTimestampClick, // Destructure the new prop
}) => {
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, autoScroll]);

  // useEffect to log chatHistory when it changes
  useEffect(() => {
    console.log('[ChatPanel] chatHistory updated:', JSON.stringify(chatHistory, null, 2));
  }, [chatHistory]);

  const handleSend = (message?: string) => {
    const textToSend = message || chatInput;
    if (textToSend.trim()) {
      onSendMessage(textToSend.trim());
      if (!message) setChatInput('');
    }
  };

  const handleExamplePromptClick = (promptText: string) => {
    setChatInput(promptText);
    // Consider sending directly or focusing input:
    // handleSend(promptText); 
  };

  // Basic timestamp parsing and click handling (can be expanded)
  const renderMessageText = (text: string) => {
    if (!onTimestampClick) return text; // Only process if handler is provided

    // Regex to find timestamps like [mm:ss], [m:ss], [mm:ss.SSS], [m:ss.SSS]
    // or simple seconds like [Ns] or [N.Ns]
    const timestampRegex = /\[(\d{1,2}:\d{2}(?:\.\d{1,3})?|\d+(?:\.\d+)?s)\]/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = timestampRegex.exec(text)) !== null) {
      // Add text before the timestamp
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      
      const timestampStr = match[1];
      let timeInSeconds = -1;

      if (timestampStr.includes(':')) {
        const timeParts = timestampStr.split(':');
        const minutes = parseInt(timeParts[0], 10);
        const seconds = parseFloat(timeParts[1]);
        timeInSeconds = (minutes * 60) + seconds;
      } else if (timestampStr.endsWith('s')) {
        timeInSeconds = parseFloat(timestampStr.substring(0, timestampStr.length - 1));
      }

      if (timeInSeconds !== -1 && !isNaN(timeInSeconds)) {
        parts.push(
          <button 
            key={`ts-${match.index}`}
            onClick={() => onTimestampClick(timeInSeconds)}
            className="text-blue-400 hover:text-blue-300 underline focus:outline-none"
            title={`Jump to ${timestampStr}`}
          >
            {match[0]} {/* Display original matched string e.g., [0:10] */}
          </button>
        );
      } else {
        parts.push(match[0]); // Not a clickable timestamp, push as text
      }
      lastIndex = match.index + match[0].length;
    }

    // Add remaining text after the last timestamp
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? <>{parts.map((part, i) => <React.Fragment key={i}>{part}</React.Fragment>)}</> : text;
  };

  return (
    <div className={`flex flex-col h-full bg-gray-950 min-h-0 ${className}`}>
      {showTitle && title && (
        <h3 className="text-sm font-semibold text-gray-200 p-3 border-b border-gray-800 uppercase tracking-wider flex-shrink-0">
          {title}
        </h3>
      )}
      <div ref={chatContainerRef} className="flex-grow overflow-y-auto mb-2 px-3 space-y-3 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900">
        {chatHistory.length === 0 && !isLoading && examplePrompts && examplePrompts.length > 0 && (
          <div className="text-xs text-gray-500 py-2">
            <p className="mb-2">Try asking:</p>
            <ul className="space-y-1.5">
              {examplePrompts.map(p => (
                <li key={p.id}>
                  <button
                    onClick={() => handleExamplePromptClick(p.text)}
                    className="w-full text-left p-2 bg-gray-800 hover:bg-gray-700 rounded-md text-gray-300 hover:text-gray-100 transition-colors text-xs"
                  >
                    {p.text}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {chatHistory.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div 
              className={`max-w-[85%] lg:max-w-[80%] px-3 py-2 rounded-lg shadow break-words ${
                msg.sender === 'user' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-750 text-gray-200'
              }`}
            >
              {/* Use renderMessageText to make timestamps clickable */}
              <p className="text-sm whitespace-pre-wrap">{renderMessageText(msg.text)}</p>
              {msg.sender === 'ai' && msg.timestampLinks && msg.timestampLinks.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-600 space-y-1">
                  <p className="text-xs text-gray-400 mb-0.5">Sources:</p>
                  {msg.timestampLinks.map((link, idx) => {
                    const webLink = (link as any).uri || (link as any).web?.uri;
                    const webTitle = (link as any).title || (link as any).web?.title || webLink;
                    if (webLink) {
                      return (
                        <a
                          key={idx}
                          href={webLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-xs text-blue-400 hover:text-blue-300 hover:underline truncate"
                          title={webTitle}
                        >
                          <LinkIcon className="w-3 h-3 inline mr-1 opacity-70" />
                          {webTitle}
                        </a>
                      );
                    }
                    return null;
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-xs lg:max-w-sm px-3 py-2 rounded-lg bg-gray-750 text-gray-300">
              <LoadingSpinner size="sm" text="Thinking..." className="p-1" />
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>
      <div className="flex-shrink-0 flex items-center p-3 border-t border-gray-800">
        <input
          type="text"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && !isLoading && !e.shiftKey && (handleSend(), e.preventDefault())}
          placeholder={placeholderText}
          className="flex-grow p-2.5 bg-gray-800 border border-gray-700 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-200 placeholder-gray-500 resize-none"
          disabled={isLoading}
        />
        <Button 
            onClick={() => handleSend()} 
            variant="primary" 
            className="ml-2 px-3 py-2.5" 
            disabled={isLoading || !chatInput.trim()} 
            isLoading={isLoading}
            aria-label="Send message"
        >
          <ChevronRightIcon className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}; 
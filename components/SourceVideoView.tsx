import React, { useState, useEffect, useRef, useCallback } from 'react';
import { VideoSource, ChatMessage, VideoSegment } from '../types';
import { analyzeVideoContent, formatTime } from '../services/geminiService';
import { ChatIcon, PlayIcon, PauseIcon as ActualPauseIcon, PlusIcon, TimestampIcon, LinkIcon, WarningIcon, ChevronLeftIcon, ChevronRightIcon, CheckIcon } from './Icons'; // Added CheckIcon
import { Button } from './Button';
import { LoadingSpinner } from './LoadingSpinner';

const PauseIcon: React.FC<{className?: string}> = ActualPauseIcon;


interface ChatPanelProps {
  videoId: string;
  videoTitle: string;
  videoDuration: number;
  chatHistory: ChatMessage[];
  onSendMessage: (messageText: string) => Promise<void>;
  onTimestampClick: (time: number) => void;
  onAddSegmentToWorkspace: (sourceVideoId: string, sourceVideoTitle: string, segmentTimes: { startTime: number; endTime: number }, thumbnailUrl: string) => Promise<void>;
  isLoading: boolean;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ videoId, videoTitle, videoDuration, chatHistory, onSendMessage, onTimestampClick, onAddSegmentToWorkspace, isLoading }) => {
  const [newMessage, setNewMessage] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleSend = () => {
    if (newMessage.trim()) {
      onSendMessage(newMessage.trim());
      setNewMessage('');
    }
  };
  
  const handleQuickAdd = async (startTime: number) => {
    const endTime = Math.min(startTime + 5, videoDuration > 0 ? videoDuration : startTime + 5);
    const placeholderThumbnail = `https://picsum.photos/seed/quickadd_${videoId}_${startTime}/150/90`;
    onAddSegmentToWorkspace(videoId, videoTitle, { startTime, endTime }, placeholderThumbnail);
  };


  return (
    <div className="bg-gray-950 flex flex-col h-full p-3 border-t border-gray-800">
      <h3 className="text-md font-semibold text-gray-300 mb-3 flex items-center border-b border-gray-800 pb-2">
        <ChatIcon className="mr-2 w-5 h-5" /> AI Chat: <span className="text-gray-400 ml-1.5 truncate">{videoTitle}</span>
      </h3>
      <div className="flex-grow overflow-y-auto mb-3 pr-1 space-y-3 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
        {chatHistory.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-md lg:max-w-lg px-3.5 py-2.5 rounded-lg shadow ${msg.sender === 'user' ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-300'}`}>
              <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
              {msg.timestampLinks && msg.timestampLinks.length > 0 && (
                <div className="mt-2.5 space-y-1.5">
                  {msg.timestampLinks.map((link, index) => (
                    <div key={index} className="flex items-center justify-between text-xs bg-gray-700 p-2 rounded shadow-sm">
                      <button
                        onClick={() => onTimestampClick(link.time)}
                        className="flex items-center text-gray-300 hover:text-white hover:underline"
                        title={`Jump to ${formatTime(link.time)}`}
                      >
                        <TimestampIcon className="w-3.5 h-3.5 mr-1.5" />
                        {link.text}
                      </button>
                       <Button 
                        size="sm" 
                        variant="ghost"
                        className="p-1 text-xs ml-2"
                        onClick={() => handleQuickAdd(link.time) }
                        title="Add ~5s segment from this timestamp to workspace"
                       >
                         <PlusIcon className="w-3.5 h-3.5"/>
                       </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
             <div className="max-w-md lg:max-w-lg px-3.5 py-2.5 rounded-lg bg-gray-800 text-gray-300">
                <LoadingSpinner size="sm" text="AI is thinking..." />
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>
      <div className="flex-shrink-0 flex mt-1">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleSend()}
          placeholder="Ask about this video..."
          className="flex-grow p-2.5 bg-gray-800 border border-gray-700 rounded-l-md focus:ring-1 focus:ring-gray-500 focus:border-gray-500 outline-none text-sm placeholder-gray-500"
          disabled={isLoading}
        />
        <Button onClick={handleSend} variant="primary" className="rounded-l-none px-5" disabled={isLoading || !newMessage.trim()} isLoading={isLoading}>
          Send
        </Button>
      </div>
    </div>
  );
};

interface VideoPlayerProps {
  video: VideoSource;
  currentTime: number; 
  onTimeUpdate: (time: number) => void; 
  onDurationKnown: (duration: number) => void; 
  workspaceSegments: VideoSegment[];
  highlightSegment?: { start: number; end: number };
  selectedStartTime: number;
  selectedEndTime: number;
  onSelectedTimeChange: (type: 'start' | 'end', time: number) => void;
  onAddSegmentToWorkspace: () => Promise<void>; 
  isPlaying: boolean;
  onPlayPauseToggle: () => void;
  segmentAddStatus: 'idle' | 'adding' | 'added' | 'error';
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ 
    video, currentTime, onTimeUpdate, onDurationKnown, workspaceSegments, highlightSegment,
    selectedStartTime, selectedEndTime, onSelectedTimeChange, onAddSegmentToWorkspace,
    isPlaying, onPlayPauseToggle, segmentAddStatus, videoRef
}) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [draggingMarker, setDraggingMarker] = useState<'start' | 'end' | null>(null);
  const [actualVideoDuration, setActualVideoDuration] = useState(video.duration > 0 ? video.duration : 0);

  useEffect(() => {
    const currentUrl = video.url;
    const isBlob = currentUrl?.startsWith('blob:');
    return () => {
      if (isBlob) {
        // console.log(`[VideoPlayer:cleanup] Revoking object URL: ${currentUrl} for video ID: ${video.id}`);
        URL.revokeObjectURL(currentUrl);
      }
    };
  }, [video.url, video.id]);

  useEffect(() => {
    const newActualDuration = video.duration > 0 ? video.duration : 0;
    if (Math.abs(newActualDuration - actualVideoDuration) > 0.001 || (actualVideoDuration === 0 && newActualDuration > 0)) {
        setActualVideoDuration(newActualDuration);
    }
    if (videoRef.current) {
        if (Math.abs(videoRef.current.currentTime - currentTime) > 0.1 && isFinite(currentTime)) {
            videoRef.current.currentTime = currentTime;
        }
    }
  },[video.url, video.duration, currentTime, video.id, actualVideoDuration]);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const handleLoadedMetadataEvent = () => {
      const newDuration = videoElement.duration;
      if (newDuration && isFinite(newDuration) && newDuration > 0) {
        onDurationKnown(newDuration); 
        if (Math.abs(newDuration - actualVideoDuration) > 0.001) {
            setActualVideoDuration(newDuration);
        }
      }
    };
    const handleTimeUpdateEvent = () => onTimeUpdate(videoElement.currentTime);
    const handlePlayEvent = () => { if (!isPlaying) onPlayPauseToggle(); };
    const handlePauseEvent = () => { if (isPlaying) onPlayPauseToggle(); };
    const handleEndedEvent = () => { 
      if (isPlaying) onPlayPauseToggle(); 
      if (videoElement) { videoElement.currentTime = 0; onTimeUpdate(0); }
    };

    videoElement.addEventListener('loadedmetadata', handleLoadedMetadataEvent);
    videoElement.addEventListener('timeupdate', handleTimeUpdateEvent);
    videoElement.addEventListener('play', handlePlayEvent);
    videoElement.addEventListener('pause', handlePauseEvent);
    videoElement.addEventListener('ended', handleEndedEvent);

    if (videoElement.readyState >= 1 && videoElement.duration && isFinite(videoElement.duration) && videoElement.duration > 0) {
        onDurationKnown(videoElement.duration);
        if (Math.abs(videoElement.duration - actualVideoDuration) > 0.001) {
            setActualVideoDuration(videoElement.duration);
        }
    }
    return () => {
      if (!videoRef.current) return;
      videoRef.current.removeEventListener('loadedmetadata', handleLoadedMetadataEvent);
      videoRef.current.removeEventListener('timeupdate', handleTimeUpdateEvent);
      videoRef.current.removeEventListener('play', handlePlayEvent);
      videoRef.current.removeEventListener('pause', handlePauseEvent);
      videoRef.current.removeEventListener('ended', handleEndedEvent);
    };
  }, [onDurationKnown, onTimeUpdate, isPlaying, onPlayPauseToggle, actualVideoDuration]);

  // Handle play/pause state changes
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;
    
    if (isPlaying) {
      videoElement.play().catch(console.error);
    } else {
      videoElement.pause();
    }
  }, [isPlaying]);



  const handleTimelineClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !actualVideoDuration) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const clickPosition = (event.clientX - rect.left) / rect.width;
    const newTime = clickPosition * actualVideoDuration;
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
      onTimeUpdate(newTime);
    }
  }, [actualVideoDuration, onTimeUpdate]);

  const handleMarkerDragStart = useCallback((type: 'start' | 'end') => {
    setDraggingMarker(type);
  }, []);

  const handleMarkerDragEnd = useCallback(() => {
    setDraggingMarker(null);
  }, []);

  const handleMarkerDrag = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!draggingMarker || !timelineRef.current || !actualVideoDuration) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const dragPosition = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const newTime = dragPosition * actualVideoDuration;
    onSelectedTimeChange(draggingMarker, newTime);
  }, [draggingMarker, actualVideoDuration, onSelectedTimeChange]);

  return (
    <div className="flex flex-col h-full bg-gray-900">
      <div className="relative flex-grow">
        <video
          ref={videoRef}
          src={video.url}
          className="w-full h-full object-contain bg-black"
          controls={false}
          playsInline
        />
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
          <div className="flex items-center justify-between mb-2">
            <Button
              variant="ghost"
              className="text-white hover:text-white/80"
              onClick={onPlayPauseToggle}
            >
              {isPlaying ? <PauseIcon className="w-6 h-6" /> : <PlayIcon className="w-6 h-6" />}
            </Button>
            <div className="text-sm text-white">
              {formatTime(currentTime)} / {formatTime(actualVideoDuration)}
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div
              ref={timelineRef}
              className="relative h-2 bg-gray-700 rounded-full cursor-pointer flex-grow"
              onClick={handleTimelineClick}
              onMouseMove={handleMarkerDrag}
              onMouseUp={handleMarkerDragEnd}
              onMouseLeave={handleMarkerDragEnd}
            >
              <div
                className="absolute h-full bg-blue-500 rounded-full"
                style={{ width: `${(currentTime / actualVideoDuration) * 100}%` }}
              />
              {workspaceSegments.map((segment) => (
                <div
                  key={segment.id}
                  className="absolute h-full bg-green-500/50"
                  style={{
                    left: `${(segment.startTime / actualVideoDuration) * 100}%`,
                    width: `${((segment.endTime - segment.startTime) / actualVideoDuration) * 100}%`,
                  }}
                />
              ))}
              {highlightSegment && (
                <div
                  className="absolute h-full bg-yellow-500/50"
                  style={{
                    left: `${(highlightSegment.start / actualVideoDuration) * 100}%`,
                    width: `${((highlightSegment.end - highlightSegment.start) / actualVideoDuration) * 100}%`,
                  }}
                />
              )}
              {/* Selected segment highlight area */}
              <div
                className="absolute h-full bg-gray-500/20 border-l border-r border-gray-400"
                style={{
                  left: `${(selectedStartTime / actualVideoDuration) * 100}%`,
                  width: `${((selectedEndTime - selectedStartTime) / actualVideoDuration) * 100}%`,
                }}
                title={`Selected: ${formatTime(selectedStartTime)} - ${formatTime(selectedEndTime)}`}
              />
              
              {/* Start marker with left arrow */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full cursor-ew-resize border border-gray-400 shadow hover:bg-gray-100 transition-colors flex items-center justify-center"
                style={{ left: `${(selectedStartTime / actualVideoDuration) * 100}%`, marginLeft: '-8px' }}
                onMouseDown={() => handleMarkerDragStart('start')}
                title={`Start: ${formatTime(selectedStartTime)}`}
              >
                <div className="w-0 h-0 border-t-[3px] border-b-[3px] border-r-[4px] border-transparent border-r-gray-600"></div>
              </div>
              
              {/* End marker with right arrow */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full cursor-ew-resize border border-gray-400 shadow hover:bg-gray-100 transition-colors flex items-center justify-center"
                style={{ left: `${(selectedEndTime / actualVideoDuration) * 100}%`, marginLeft: '-8px' }}
                onMouseDown={() => handleMarkerDragStart('end')}
                title={`End: ${formatTime(selectedEndTime)}`}
              >
                <div className="w-0 h-0 border-t-[3px] border-b-[3px] border-l-[4px] border-transparent border-l-gray-600"></div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onAddSegmentToWorkspace}
              disabled={segmentAddStatus === 'adding' || selectedStartTime >= selectedEndTime}
              isLoading={segmentAddStatus === 'adding'}
              className="text-white hover:text-white/80 h-8 px-3"
              title="Add selected segment to workspace"
            >
              {segmentAddStatus === 'added' ? (
                <>
                  <CheckIcon className="w-4 h-4 mr-1" />
                  Added
                </>
              ) : (
                <>
                  <PlusIcon className="w-4 h-4 mr-1" />
                  Add Segment
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
      <div className="flex justify-between items-center p-2 bg-gray-800 border-t border-gray-700">
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (videoRef.current) {
                videoRef.current.currentTime = Math.max(0, currentTime - 5);
                onTimeUpdate(videoRef.current.currentTime);
              }
            }}
          >
            <ChevronLeftIcon className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (videoRef.current) {
                videoRef.current.currentTime = Math.min(actualVideoDuration, currentTime + 5);
                onTimeUpdate(videoRef.current.currentTime);
              }
            }}
          >
            <ChevronRightIcon className="w-4 h-4" />
          </Button>
        </div>
        <div className="text-sm text-gray-400">
          {formatTime(selectedStartTime)} - {formatTime(selectedEndTime)}
        </div>
      </div>
    </div>
  );
};

interface SourceVideoViewProps {
  video: VideoSource;
  chatHistory: ChatMessage[];
  onSendMessage: (messageText: string) => Promise<void>;
  onTimestampClick: (time: number) => void;
  onAddSegmentToWorkspace: (sourceVideoId: string, sourceVideoTitle: string, segmentTimes: { startTime: number; endTime: number }, thumbnailUrl: string) => Promise<void>;
  workspaceSegments: VideoSegment[];
  highlightSegment?: { start: number; end: number };
  isLoading: boolean;
}

export const SourceVideoView: React.FC<SourceVideoViewProps> = ({
  video,
  chatHistory,
  onSendMessage,
  onTimestampClick,
  onAddSegmentToWorkspace,
  workspaceSegments,
  highlightSegment,
  isLoading,
}) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [selectedStartTime, setSelectedStartTime] = useState(0);
  const [selectedEndTime, setSelectedEndTime] = useState(10);
  const [isPlaying, setIsPlaying] = useState(false);
  const [segmentAddStatus, setSegmentAddStatus] = useState<'idle' | 'adding' | 'added' | 'error'>('idle');
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Update selectedEndTime when video duration is known
  useEffect(() => {
    if (videoDuration > 0 && selectedEndTime > videoDuration) {
      setSelectedEndTime(Math.min(10, videoDuration));
    }
  }, [videoDuration, selectedEndTime]);

  const handleSelectedTimeChange = (type: 'start' | 'end', time: number) => {
    if (type === 'start') {
      setSelectedStartTime(Math.min(time, selectedEndTime - 0.1));
    } else {
      setSelectedEndTime(Math.max(time, selectedStartTime + 0.1));
    }
  };

  const handleAddSegment = async () => {
    if (selectedStartTime >= selectedEndTime) return;
    setSegmentAddStatus('adding');
    console.log(`[SourceVideoView] Starting to add segment: ${formatTime(selectedStartTime)} - ${formatTime(selectedEndTime)} from "${video.title}"`);
    
    try {
      // Generate thumbnail from video frame at start time
      let thumbnailUrl = `https://picsum.photos/seed/${video.id}_${selectedStartTime}/150/90`;
      
      if (videoRef.current) {
        try {
          console.log(`[SourceVideoView] Generating thumbnail at time ${selectedStartTime}s for segment`);
          
          // Create a canvas to capture the video frame
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (ctx) {
            // Set canvas dimensions
            canvas.width = 150;
            canvas.height = Math.round((videoRef.current.videoHeight / videoRef.current.videoWidth) * 150) || 90;
            
            // Store current video time to restore later
            const originalTime = videoRef.current.currentTime;
            
            // Create a temporary video element to avoid disrupting playback
            const tempVideo = document.createElement('video');
            tempVideo.crossOrigin = "anonymous";
            tempVideo.src = video.url;
            tempVideo.muted = true;
            
            // Wait for metadata to load
            await new Promise<void>((resolve, reject) => {
              tempVideo.onloadedmetadata = () => {
                tempVideo.currentTime = selectedStartTime;
                resolve();
              };
              tempVideo.onerror = reject;
              setTimeout(() => reject(new Error('Timeout loading video metadata')), 5000);
            });
            
            // Wait for seeking to complete
            await new Promise<void>((resolve, reject) => {
              tempVideo.onseeked = () => {
                try {
                  // Draw the video frame to canvas
                  ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
                  thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8);
                  console.log(`[SourceVideoView] Generated thumbnail from video frame at ${selectedStartTime}s`);
                  resolve();
                } catch (error) {
                  console.error('[SourceVideoView] Error drawing video frame to canvas:', error);
                  reject(error);
                }
              };
              tempVideo.onerror = reject;
              setTimeout(() => reject(new Error('Timeout seeking video')), 3000);
            });
            
            // Clean up
            tempVideo.remove();
          }
        } catch (error) {
          console.error('[SourceVideoView] Error generating thumbnail from video frame:', error);
          console.log('[SourceVideoView] Falling back to placeholder thumbnail');
        }
      }
      
      console.log(`[SourceVideoView] Adding segment to workspace with thumbnail URL:`, thumbnailUrl.substring(0, 50) + '...');
      
      await onAddSegmentToWorkspace(
        video.id,
        video.title,
        { startTime: selectedStartTime, endTime: selectedEndTime },
        thumbnailUrl
      );
      setSegmentAddStatus('added');
      console.log(`✅ [SourceVideoView] Successfully added segment: ${formatTime(selectedStartTime)} - ${formatTime(selectedEndTime)} from "${video.title}"`);
      
      // Reset to next potential segment automatically
      const segmentDuration = selectedEndTime - selectedStartTime;
      setSelectedStartTime(selectedEndTime);
      setSelectedEndTime(Math.min(selectedEndTime + segmentDuration, videoDuration));
      
      setTimeout(() => setSegmentAddStatus('idle'), 3000);
    } catch (error) {
      console.error('[SourceVideoView] Failed to add segment:', error);
      setSegmentAddStatus('error');
      setTimeout(() => setSegmentAddStatus('idle'), 3000);
    }
  };

  const handleTimestampClick = (time: number) => {
    setCurrentTime(time);
    onTimestampClick(time);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-grow min-h-0">
        <VideoPlayer
          video={video}
          currentTime={currentTime}
          onTimeUpdate={setCurrentTime}
          onDurationKnown={setVideoDuration}
          workspaceSegments={workspaceSegments}
          highlightSegment={highlightSegment}
          selectedStartTime={selectedStartTime}
          selectedEndTime={selectedEndTime}
          onSelectedTimeChange={handleSelectedTimeChange}
          onAddSegmentToWorkspace={handleAddSegment}
          isPlaying={isPlaying}
          onPlayPauseToggle={() => setIsPlaying(!isPlaying)}
          segmentAddStatus={segmentAddStatus}
          videoRef={videoRef}
        />
      </div>
      <div className="h-1/3 min-h-[200px]">
        <ChatPanel
          videoId={video.id}
          videoTitle={video.title}
          videoDuration={videoDuration}
          chatHistory={chatHistory}
          onSendMessage={onSendMessage}
          onTimestampClick={handleTimestampClick}
          onAddSegmentToWorkspace={onAddSegmentToWorkspace}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { VideoSource, VideoSegment, GroundingChunk, ChatMessage } from '../src/types';
import { ChatIcon, PlayIcon, PauseIcon as ActualPauseIcon, PlusIcon, TimestampIcon, LinkIcon, WarningIcon, ChevronLeftIcon, ChevronRightIcon, CheckIcon } from './Icons';
import { Button } from './Button';
import { LoadingSpinner } from './LoadingSpinner';
import { ChatPanel as ReusableChatPanel } from '../src/components/ChatPanel';

// Define formatTime utility function here, making it available to VideoPlayer
const formatTime = (totalSeconds: number): string => {
  if (isNaN(totalSeconds) || totalSeconds < 0) totalSeconds = 0;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  // const milliseconds = Math.floor((totalSeconds % 1) * 1000); // Not typically shown in m:ss format

  const paddedSeconds = seconds < 10 ? `0${seconds}` : seconds;

  return `${minutes}:${paddedSeconds}`;
  // More detailed example if needed for other contexts:
  // if (minutes > 0) {
  //   return `${minutes}m${seconds < 10 && minutes > 0 ? '0' : ''}${seconds}s`;
  // } else if (seconds > 0) {
  //   return `${seconds}s`;
  // } else {
  //   return `${totalSeconds.toFixed(1)}s`; 
  // }
};

const PauseIcon: React.FC<{className?: string}> = ActualPauseIcon;

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
      if (isBlob && currentUrl) {
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
  }, [video.url, video.duration, currentTime, video.id]);

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
  }, [onDurationKnown, onTimeUpdate, isPlaying, onPlayPauseToggle, actualVideoDuration, videoRef]);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;
    
    if (isPlaying) {
      videoElement.play().catch(console.error);
    } else {
      videoElement.pause();
    }
  }, [isPlaying, videoRef]);

  const handleTimelineClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !actualVideoDuration) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const clickPosition = (event.clientX - rect.left) / rect.width;
    const newTime = clickPosition * actualVideoDuration;
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
      onTimeUpdate(newTime);
    }
  }, [actualVideoDuration, onTimeUpdate, videoRef]);

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
              <div
                className="absolute h-full bg-gray-500/20 border-l border-r border-gray-400"
                style={{
                  left: `${(selectedStartTime / actualVideoDuration) * 100}%`,
                  width: `${((selectedEndTime - selectedStartTime) / actualVideoDuration) * 100}%`,
                }}
                title={`Selected: ${formatTime(selectedStartTime)} - ${formatTime(selectedEndTime)}`}
              />
              
              <div
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full cursor-ew-resize border border-gray-400 shadow hover:bg-gray-100 transition-colors flex items-center justify-center"
                style={{ left: `${(selectedStartTime / actualVideoDuration) * 100}%`, marginLeft: '-8px' }}
                onMouseDown={() => handleMarkerDragStart('start')}
                title={`Start: ${formatTime(selectedStartTime)}`}
              >
                <div className="w-0 h-0 border-t-[3px] border-b-[3px] border-r-[4px] border-transparent border-r-gray-600"></div>
              </div>
              
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

const exampleVideoPrompts = [
  { id: 'vid_q1', text: "What is the main subject of this video?", action: 'chat' },
  { id: 'vid_q2', text: "Are there any people visible?", action: 'chat' },
  { id: 'vid_q3', text: "Describe the key actions in the first 10 seconds.", action: 'chat' },
];

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
  const videoPlayerRef = useRef<HTMLVideoElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedStartTime, setSelectedStartTime] = useState(0);
  const [selectedEndTime, setSelectedEndTime] = useState(10);
  const [segmentAddStatus, setSegmentAddStatus] = useState<'idle' | 'adding' | 'added' | 'error'>('idle');
  const [actualVideoDuration, setActualVideoDuration] = useState(video.duration > 0 ? video.duration : 0);

  useEffect(() => {
    if (video.duration) {
      setActualVideoDuration(video.duration);
      const defaultEndTime = Math.min(10, video.duration);
      if (selectedEndTime > video.duration || (selectedEndTime === 10 && defaultEndTime < 10) || selectedEndTime === 0 && defaultEndTime > 0) {
        setSelectedEndTime(defaultEndTime);
      }
      if (selectedStartTime >= video.duration || selectedStartTime > defaultEndTime ) {
        setSelectedStartTime(Math.max(0, video.duration - defaultEndTime));
      }
    } else {
        // If video duration is 0 initially, set a sensible default for selection
        setSelectedStartTime(0);
        setSelectedEndTime(10);
    }
    // Reset current time when video changes
    setCurrentTime(0);
    setIsPlaying(false);
  }, [video.id, video.duration]); // Depend on video.id to reset for new videos

  useEffect(() => {
    if (highlightSegment) {
      setSelectedStartTime(highlightSegment.start);
      setSelectedEndTime(highlightSegment.end);
      if (videoPlayerRef.current) {
        videoPlayerRef.current.currentTime = highlightSegment.start;
        setCurrentTime(highlightSegment.start);
      }
    }
  }, [highlightSegment]);
  
  const handleDurationKnown = useCallback((duration: number) => {
    if (duration > 0 && Math.abs(actualVideoDuration - duration) > 0.001) {
        setActualVideoDuration(duration);
        if (selectedStartTime >= duration) setSelectedStartTime(Math.max(0, duration - Math.min(10, duration)));
        if (selectedEndTime === 0 || selectedEndTime > duration) setSelectedEndTime(duration); // if initial selectedEndtime was based on 0 duration
    }
  }, [actualVideoDuration, selectedStartTime, selectedEndTime]);

  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const handlePlayPauseToggle = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  const handleSelectedTimeChange = (type: 'start' | 'end', time: number) => {
    if (type === 'start') {
      setSelectedStartTime(Math.max(0, Math.min(time, selectedEndTime - 0.1)));
    } else {
      setSelectedEndTime(Math.min(actualVideoDuration || Infinity, Math.max(time, selectedStartTime + 0.1)));
    }
  };

  const handleAddCurrentSegmentToWorkspace = async () => {
    if (!videoPlayerRef.current) return;
    if (selectedStartTime >= selectedEndTime) {
      console.warn("[SourceVideoView] Invalid segment: start time is greater than or equal to end time.");
      return;
    }
    setSegmentAddStatus('adding');
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      const aspectRatio = videoPlayerRef.current.videoWidth > 0 ? videoPlayerRef.current.videoHeight / videoPlayerRef.current.videoWidth : 9/16;
      canvas.height = Math.round(aspectRatio * 160);
      if (canvas.height === 0) canvas.height = 90; // Fallback height
      
      const ctx = canvas.getContext('2d');
      let thumbnailUrl = `https://picsum.photos/seed/thumb_${video.id}_${Date.now()}/160/90`;
      
      if (ctx && videoPlayerRef.current.videoWidth > 0 && videoPlayerRef.current.videoHeight > 0) {
        const tempVideoTime = videoPlayerRef.current.currentTime;
        videoPlayerRef.current.currentTime = selectedStartTime;
        // Await a brief moment for the frame to update after setting currentTime
        await new Promise(r => setTimeout(r, 200)); 
        ctx.drawImage(videoPlayerRef.current, 0, 0, canvas.width, canvas.height);
        thumbnailUrl = canvas.toDataURL('image/jpeg', 0.85);
        videoPlayerRef.current.currentTime = tempVideoTime; // Restore video time
      } else {
        console.warn("[SourceVideoView] Could not generate thumbnail from video frame (video dimensions might be 0).");
      }
      
      await onAddSegmentToWorkspace(video.id, video.title, { startTime: selectedStartTime, endTime: selectedEndTime }, thumbnailUrl);
      setSegmentAddStatus('added');
      setTimeout(() => setSegmentAddStatus('idle'), 2000);
    } catch (error) {
      console.error("[SourceVideoView] Error adding segment:", error);
      setSegmentAddStatus('error');
      setTimeout(() => setSegmentAddStatus('idle'), 2000);
    }
  };

  const handleTimestampClickInternal = (time: number) => {
    if (videoPlayerRef.current) {
      videoPlayerRef.current.currentTime = time;
      setCurrentTime(time);
      setIsPlaying(true); // Optionally auto-play
    }
    onTimestampClick(time); // Propagate to App
  };

  return (
    <div className="flex h-full bg-gray-900"> {/* Main flex container: video player and chat side-by-side */}
      {/* VideoPlayer component takes up the main space */}
      <div className="flex-grow flex flex-col p-0 overflow-y-auto"> {/* Video player area, p-0 to ensure player fills space */}
        <div className="flex-grow relative">
          <VideoPlayer 
            video={video}
            currentTime={currentTime}
            onTimeUpdate={handleTimeUpdate}
            onDurationKnown={handleDurationKnown}
            workspaceSegments={workspaceSegments}
            highlightSegment={highlightSegment}
            selectedStartTime={selectedStartTime}
            selectedEndTime={selectedEndTime}
            onSelectedTimeChange={handleSelectedTimeChange}
            onAddSegmentToWorkspace={handleAddCurrentSegmentToWorkspace}
            isPlaying={isPlaying}
            onPlayPauseToggle={handlePlayPauseToggle}
            segmentAddStatus={segmentAddStatus}
            videoRef={videoPlayerRef} 
          />
        </div>
      </div>
      
      {/* ChatPanel on the right side */}
      <div className="w-96 lg:w-[450px] flex-shrink-0 border-l border-gray-800 flex flex-col">
        <ReusableChatPanel 
          chatHistory={chatHistory}
          onSendMessage={onSendMessage}
          isLoading={isLoading}
          title={`AI Chat: ${video.title}`}
          placeholderText={`Ask about ${video.title}...`}
          examplePrompts={exampleVideoPrompts}
          onTimestampClick={handleTimestampClickInternal} // Pass the internal handler
          showTitle={true}
          className="flex-grow" // Make chat panel fill height
        />
      </div>
    </div>
  );
};

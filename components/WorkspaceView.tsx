import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { VideoSegment, VideoSource } from '../src/types';
import { 
    PlayIcon, VideoIcon, CloseIcon, FolderOpenIcon, 
    PauseIcon as ActualPauseIcon, ScissorsIcon, ScriptIcon, RewindIcon, FastForwardIcon, ZoomInIcon, ZoomOutIcon 
} from './Icons';
import { Button } from './Button';

// Define formatTime utility function here
const formatTime = (totalSeconds: number): string => {
  if (isNaN(totalSeconds) || totalSeconds < 0) totalSeconds = 0;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const milliseconds = Math.floor((totalSeconds % 1) * 1000);

  if (minutes > 0) {
    return `${minutes}m${seconds < 10 && minutes > 0 ? '0' : ''}${seconds}s`;
  } else if (seconds > 0) {
    return `${seconds}s`;
  } else {
    // For very short durations, show milliseconds if seconds are 0
    return `${totalSeconds.toFixed(1)}s`; 
  }
};

const PauseIcon: React.FC<{className?: string}> = ActualPauseIcon;

const TIMELINE_HEIGHT = 100; // px for segments
const RULER_HEIGHT = 20; // px for time ruler
const PIXELS_PER_SECOND_DEFAULT = 15; 
const PLAYHEAD_WIDTH = 2; // px

interface TimelineItemProps {
  segment: VideoSegment;
  pixelsPerSecond: number;
  timelineStartOffset: number; 
  isSelected: boolean;
  videoSources: VideoSource[];
  onSelect: (segmentId: string) => void;
  onRemove: (segmentId: string) => void;
  onSegmentClick: (segment: VideoSegment) => void; 
  onTrim: (segmentId: string, newStartTime: number, newEndTime: number) => void;
}

const TimelineItem: React.FC<TimelineItemProps> = ({
  segment,
  pixelsPerSecond,
  timelineStartOffset,
  isSelected,
  videoSources,
  onSelect,
  onRemove,
  onSegmentClick,
  onTrim,
}) => {
  const itemRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [draggingHandle, setDraggingHandle] = useState<'start' | 'end' | null>(null);
  const [initialDragX, setInitialDragX] = useState(0);
  
  const segmentDurationOnTimeline = segment.endTime - segment.startTime;
  const itemWidth = segmentDurationOnTimeline * pixelsPerSecond;
  const itemLeft = timelineStartOffset * pixelsPerSecond;

  const handleMouseDown = (e: React.MouseEvent, handle: 'start' | 'end') => {
    e.stopPropagation();
    setDraggingHandle(handle);
    setInitialDragX(e.clientX);
    document.body.style.cursor = 'ew-resize';
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingHandle || !itemRef.current) return;
      const deltaX = e.clientX - initialDragX;
      const deltaTime = deltaX / pixelsPerSecond;
      let newStartTime = segment.startTime;
      let newEndTime = segment.endTime;

      if (draggingHandle === 'start') {
        const proposedStartTime = segment.startTime + deltaTime;
        newStartTime = Math.max(0, Math.min(proposedStartTime, segment.endTime - 0.1));
      } else {
        const proposedEndTime = segment.endTime + deltaTime;
        newEndTime = Math.max(segment.startTime + 0.1, proposedEndTime);
      }
      
      if (newEndTime > newStartTime) {
        onTrim(segment.id, newStartTime, newEndTime);
      }
    };

    const handleMouseUp = () => {
      setDraggingHandle(null);
      document.body.style.cursor = 'default';
    };

    if (draggingHandle) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingHandle, initialDragX, pixelsPerSecond, segment, onTrim]);

  return (
    <div
      ref={itemRef}
      className={`absolute h-full bg-gray-700 rounded-md flex flex-col items-center justify-between text-white overflow-hidden group cursor-pointer
                  ${isSelected ? 'ring-2 ring-blue-500 z-10' : 'ring-1 ring-gray-600 hover:ring-gray-500'}`}
      style={{ left: `${itemLeft}px`, width: `${itemWidth}px` }}
      onClick={() => onSelect(segment.id)}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      title={`${segment.sourceVideoTitle}\nSegment: ${formatTime(segment.startTime)} - ${formatTime(segment.endTime)}\nDuration: ${formatTime(segmentDurationOnTimeline)}`}
    >
      <img 
        src={segment.thumbnailUrl} 
        alt={segment.sourceVideoTitle} 
        className="w-full h-[70%] object-cover opacity-80 group-hover:opacity-100 transition-opacity"
      />
      <div className="w-full h-[30%] bg-blue-400 opacity-50 flex items-center justify-center">
        {/* Filename display with character limit */}
        {(() => {
          const sourceVideo = videoSources.find(v => v.id === segment.sourceVideoId);
          if (sourceVideo) {
            // Extract filename from URL and limit characters
            const filename = sourceVideo.url.split('/').pop() || 'Unknown';
            const nameWithoutExt = filename.replace(/\.[^/.]+$/, ""); // Remove extension
            const truncated = nameWithoutExt.length > 15 ? nameWithoutExt.substring(0, 15) + '...' : nameWithoutExt;
            return <span className="text-xs text-gray-300 font-mono" title={filename}>{truncated}</span>;
          }
          return <span className="text-xs text-gray-500 font-mono">No file</span>;
        })()}
      </div>
      
      {(isHovering || isSelected || draggingHandle) && (
        <>
          <div
            className="absolute left-0 top-0 h-full w-2 bg-yellow-500 opacity-70 hover:opacity-100 cursor-ew-resize z-20"
            onMouseDown={(e) => handleMouseDown(e, 'start')}
            title="Trim start"
          />
          <div
            className="absolute right-0 top-0 h-full w-2 bg-yellow-500 opacity-70 hover:opacity-100 cursor-ew-resize z-20"
            onMouseDown={(e) => handleMouseDown(e, 'end')}
            title="Trim end"
          />
        </>
      )}
      
      {(isHovering || isSelected) && (
         <div className="absolute top-1 right-1 z-20 flex space-x-1 opacity-80 group-hover:opacity-100">
            <button
              onClick={(e) => { e.stopPropagation(); onSegmentClick(segment); }}
              className="p-0.5 bg-gray-900 bg-opacity-60 hover:bg-opacity-80 rounded text-gray-200 hover:text-white"
              title="Open source video"
            >
              <FolderOpenIcon className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(segment.id); }}
              className="p-0.5 bg-red-700 bg-opacity-60 hover:bg-opacity-80 rounded text-white"
              title="Remove segment"
            >
              <CloseIcon className="w-3 h-3" />
            </button>
         </div>
      )}
    </div>
  );
};


interface TimelineRulerProps {
  duration: number;
  pixelsPerSecond: number;
  playheadTime: number;
  onClickRuler?: (time: number) => void;
}

const TimelineRuler: React.FC<TimelineRulerProps> = ({ duration, pixelsPerSecond, playheadTime, onClickRuler }) => {
  const rulerRef = useRef<HTMLDivElement>(null);
  const [markers, setMarkers] = useState<Array<{time: number, label: string, id: string}>>([]);

  useEffect(() => {
    if (duration === 0) {
        setMarkers([{time: 0, label: "0s", id: "marker_0"}]); // Show "0s" if duration is 0
        return;
    }
    const newMarkers: Array<{time: number, label: string, id: string}> = [];
    const seenTimes = new Set<number>(); // Track seen times to prevent duplicates
    
    // Determine step based on duration to avoid too many markers
    let step = 1; // Default for very short durations
    if (duration > 600) step = 60; // 1 minute steps for long videos
    else if (duration > 120) step = 30; // 30 second steps
    else if (duration > 60) step = 10; // 10 second steps
    else if (duration > 20) step = 5; // 5 second steps
    else step = Math.max(1, Math.floor(duration / 10)); // Dynamic for short durations

    for (let i = 0; i <= duration; i += step) {
      const roundedTime = Math.round(i * 10) / 10; // Round to 1 decimal place
      if (!seenTimes.has(roundedTime)) {
        seenTimes.add(roundedTime);
        const minutes = Math.floor(roundedTime / 60);
        const seconds = Math.floor(roundedTime % 60);
        newMarkers.push({ 
          time: roundedTime, 
          label: minutes > 0 ? `${minutes}m${seconds > 0 ? seconds+'s':''}` : `${seconds}s`,
          id: `marker_${roundedTime}`
        });
      }
    }
    
    // Ensure the very last timestamp (total duration) is shown if not perfectly divisible
    const roundedDuration = Math.round(duration * 10) / 10;
    if (duration > 0 && !seenTimes.has(roundedDuration)) {
        const minutes = Math.floor(roundedDuration / 60);
        const seconds = Math.floor(roundedDuration % 60);
        newMarkers.push({
          time: roundedDuration, 
          label: minutes > 0 ? `${minutes}m${seconds > 0 ? seconds+'s':''}` : `${seconds}s`,
          id: `marker_${roundedDuration}_end`
        });
    }
    setMarkers(newMarkers);
  }, [duration, pixelsPerSecond]);

  const handleRulerClickInternal = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!rulerRef.current || duration === 0 || !onClickRuler) return;
    const rect = rulerRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const newTime = Math.max(0, Math.min((x / rect.width) * duration, duration));
    onClickRuler(newTime);
  };

  return (
    <div 
      ref={rulerRef} 
      className="h-5 text-xs text-gray-500 relative mb-1 cursor-pointer" 
      style={{ width: `${Math.max(20, duration * pixelsPerSecond)}px`}} // Min width to ensure 0s is visible
      onClick={handleRulerClickInternal}
    >
      {markers.map(marker => (
        <div key={marker.id} className="absolute -top-0.5 select-none" style={{ left: `${marker.time * pixelsPerSecond}px`}}>
          <span className="relative left-[-50%]">{marker.label}</span>
          <div className="h-1.5 w-px bg-gray-600 mt-0.5"></div>
        </div>
      ))}
       <div 
        className="absolute top-0 bottom-0 bg-red-500 z-10 pointer-events-none" // Playhead itself should not capture clicks
        style={{ 
            left: `${playheadTime * pixelsPerSecond - (PLAYHEAD_WIDTH / 2)}px`, 
            width: `${PLAYHEAD_WIDTH}px`,
            height: '100%'
        }}
        />
    </div>
  );
};


interface WorkspaceViewProps {
  segments: VideoSegment[];
  videoSources: VideoSource[];
  onSegmentClick: (segment: VideoSegment) => void; 
  onRemoveSegment: (segmentId: string) => void;
  onUpdateSegments: (updatedSegments: VideoSegment[]) => void;
  onAddSegment: (newSegment: Omit<VideoSegment, 'id' | 'thumbnailUrl'>) => void;
  onVideoDropped?: (videoId: string) => void;
}

export const WorkspaceView: React.FC<WorkspaceViewProps> = React.memo((props) => {
  const { segments, videoSources, onSegmentClick, onRemoveSegment, onUpdateSegments, onAddSegment } = props;
  
  const [timelinePlayheadTime, setTimelinePlayheadTime] = useState(0); // General playhead for editing
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [isPlayheadDragging, setIsPlayheadDragging] = useState(false);
  const [isStitchedPlaying, setIsStitchedPlaying] = useState(false);
  const [currentStitchedPlaybackTime, setCurrentStitchedPlaybackTime] = useState(0); // For stitched playback
  const playbackIntervalRef = useRef<number | null>(null);
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [editWithScript, setEditWithScript] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1); // Placeholder
  const pixelsPerSecond = PIXELS_PER_SECOND_DEFAULT * zoomLevel;
  
  // Video ref for immediate control
  const currentVideoRef = useRef<HTMLVideoElement | null>(null);

  // Memoize segments to prevent unnecessary recalculations
  const memoizedSegments = useMemo(() => {
    return segments;
  }, [segments]);

  const stitchedVideoDuration = useMemo(() => {
    const duration = memoizedSegments.reduce((acc, seg) => acc + (seg.endTime - seg.startTime), 0);
    return duration;
  }, [memoizedSegments]);
  
  const totalTimelinePixelWidth = stitchedVideoDuration * pixelsPerSecond;

  useEffect(() => {
    console.log(`[WorkspaceView] Edit with Script mode changed to: ${editWithScript ? 'ON' : 'OFF'}`);
  }, [editWithScript]);

  useEffect(() => {
    if (isStitchedPlaying) {
      setTimelinePlayheadTime(currentStitchedPlaybackTime);
    }
  }, [currentStitchedPlaybackTime, isStitchedPlaying]);



  const handlePlayheadDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsPlayheadDragging(true);
    // Don't auto-pause when dragging - allow scrubbing during playback
  };

  const handleTimelineInteractionCommon = useCallback((clientX: number) => {
    if (!timelineContainerRef.current) return;
    const rect = timelineContainerRef.current.getBoundingClientRect();
    const x = clientX - rect.left; 
    const scrollOffset = timelineContainerRef.current.scrollLeft;
    const newTime = Math.max(0, Math.min((x + scrollOffset) / pixelsPerSecond, stitchedVideoDuration));
    
    setTimelinePlayheadTime(newTime);
    // Always allow scrubbing - update playback time even when playing
    setCurrentStitchedPlaybackTime(newTime);
  }, [pixelsPerSecond, stitchedVideoDuration]);

  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
     if (!isPlayheadDragging) handleTimelineInteractionCommon(e.clientX);
  }, [isPlayheadDragging, handleTimelineInteractionCommon]);

  const handleRulerClick = useCallback((time: number) => {
    setTimelinePlayheadTime(time);
    // Always allow scrubbing - update playback time even when playing
    setCurrentStitchedPlaybackTime(time);
  }, []);
  
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isPlayheadDragging && timelineContainerRef.current) {
         handleTimelineInteractionCommon(e.clientX);
      }
    };
    const handleMouseUp = () => {
      if (isPlayheadDragging) {
        setIsPlayheadDragging(false);
      }
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isPlayheadDragging, handleTimelineInteractionCommon]);

  const handleTrimSegment = (segmentId: string, newSourceStartTime: number, newSourceEndTime: number) => {
    const updated = memoizedSegments.map(s => 
      s.id === segmentId ? { ...s, startTime: newSourceStartTime, endTime: newSourceEndTime } : s
    );
    onUpdateSegments(updated);
  };
  
  const handleSplitClip = () => {
    if (memoizedSegments.length === 0) return;
    setIsStitchedPlaying(false); 

    let segmentUnderPlayhead: VideoSegment | null = null;
    let segmentStartTimeOnTimeline = 0;
    let cumulativeDuration = 0;

    for (const seg of memoizedSegments) {
      const segDuration = seg.endTime - seg.startTime;
      if (timelinePlayheadTime >= cumulativeDuration && timelinePlayheadTime < cumulativeDuration + segDuration) {
        segmentUnderPlayhead = seg;
        segmentStartTimeOnTimeline = cumulativeDuration;
        break;
      }
      cumulativeDuration += segDuration;
    }

    if (!segmentUnderPlayhead) {
      console.warn("[WorkspaceView:handleSplitClip] No segment under playhead to split.");
      return;
    }

    const splitOffsetWithinSegment = timelinePlayheadTime - segmentStartTimeOnTimeline;
    // Ensure split is not too close to segment ends
    if (splitOffsetWithinSegment < 0.1 || (segmentUnderPlayhead.endTime - segmentUnderPlayhead.startTime) - splitOffsetWithinSegment < 0.1) {
      console.warn("[WorkspaceView:handleSplitClip] Split point too close to segment ends.");
      return;
    }
    
    const splitPointInSourceTime = segmentUnderPlayhead.startTime + splitOffsetWithinSegment;
    const originalIndex = memoizedSegments.findIndex(s => s.id === segmentUnderPlayhead!.id);
    if (originalIndex === -1) {
      console.error("[WorkspaceView:handleSplitClip] Original segment not found in array (should not happen).");
      return;
    }

    const segment1Data = { 
        ...segmentUnderPlayhead, 
        endTime: splitPointInSourceTime, 
        id: `split_${segmentUnderPlayhead.id}_part1_${Date.now()}`, 
        thumbnailUrl: `https://picsum.photos/seed/splitA${Date.now()}/150/90` 
    };
    const segment2Data = { 
        ...segmentUnderPlayhead, 
        startTime: splitPointInSourceTime, 
        id: `split_${segmentUnderPlayhead.id}_part2_${Date.now()}`, 
        thumbnailUrl: `https://picsum.photos/seed/splitB${Date.now()}/150/90` 
    };
    
    console.log("[WorkspaceView:handleSplitClip] Splitting segment:", segmentUnderPlayhead, 
                "at timeline playhead time:", timelinePlayheadTime, 
                "which is offset within segment by:", splitOffsetWithinSegment, 
                "resulting in source time:", splitPointInSourceTime);
    console.log("[WorkspaceView:handleSplitClip] New segment 1:", segment1Data);
    console.log("[WorkspaceView:handleSplitClip] New segment 2:", segment2Data);

    const newSegmentsArray = [...memoizedSegments];
    newSegmentsArray.splice(originalIndex, 1, segment1Data, segment2Data);
    
    console.log("[WorkspaceView:handleSplitClip] New segments array after splice:", newSegmentsArray);
    
    onUpdateSegments(newSegmentsArray);
    setSelectedSegmentId(segment2Data.id); // Select the second part of the split
  };

  useEffect(() => {
    if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);

    if (isStitchedPlaying && stitchedVideoDuration > 0) {
      playbackIntervalRef.current = window.setInterval(() => {
        setCurrentStitchedPlaybackTime(prevTime => {
          const newTime = Math.round((prevTime + 0.1) * 10) / 10; // Fix floating point precision
          if (newTime >= stitchedVideoDuration) {
            setIsStitchedPlaying(false);
            return Math.round(stitchedVideoDuration * 10) / 10;
          }
          return newTime;
        });
      }, 100);
    }
    return () => { 
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current); 
      }
    };
  }, [isStitchedPlaying, stitchedVideoDuration]);

  const handlePlayPauseStitched = () => {
    if (stitchedVideoDuration <= 0) return;
    if (isStitchedPlaying) {
      // Immediate pause
      setIsStitchedPlaying(false);
      if (currentVideoRef.current) {
        currentVideoRef.current.pause();
      }
    } else {
      if (currentStitchedPlaybackTime >= stitchedVideoDuration) {
        setCurrentStitchedPlaybackTime(0); // Reset if at end
      }
      // When starting playback, sync playback time to timeline position
      setCurrentStitchedPlaybackTime(timelinePlayheadTime);
      setIsStitchedPlaying(true);
    }
  };

  // Spacebar play/pause functionality - directly trigger the play button click
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger on spacebar and prevent if user is typing in an input
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        // Find and click the actual play/pause button to use exact same logic
        const playButton = document.querySelector('[data-play-pause-button]') as HTMLButtonElement;
        if (playButton) {
          playButton.click();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
  
  // Optimize preview segment calculation with useMemo to prevent frequent re-renders
  const activePreviewSegment = useMemo(() => {
    if (memoizedSegments.length === 0) return null;
    
    const roundedCurrentTime = Math.round(currentStitchedPlaybackTime * 10) / 10;
    let cumulativeTime = 0;
    
    for (const seg of memoizedSegments) {
      const segmentDuration = seg.endTime - seg.startTime;
      if (roundedCurrentTime >= cumulativeTime && roundedCurrentTime < cumulativeTime + segmentDuration) {
        return seg;
      }
      cumulativeTime += segmentDuration;
    }
    
    // Fallback logic
    if (roundedCurrentTime >= stitchedVideoDuration && memoizedSegments.length > 0) {
      return memoizedSegments[memoizedSegments.length - 1]; 
    } else if (memoizedSegments.length > 0) {
      return memoizedSegments[0]; 
    }
    
    return null;
  }, [memoizedSegments, Math.floor(currentStitchedPlaybackTime * 10), stitchedVideoDuration]); // More stable dependencies

  // Sync video position when timeline playhead changes (always, even during playback)
  useEffect(() => {
    if (currentVideoRef.current && activePreviewSegment) {
      // Calculate the relative time within this segment
      let segmentStartInStitched = 0;
      for (const seg of memoizedSegments) {
        if (seg.id === activePreviewSegment.id) break;
        segmentStartInStitched += (seg.endTime - seg.startTime);
      }
      const relativeTime = currentStitchedPlaybackTime - segmentStartInStitched;
      const actualVideoTime = activePreviewSegment.startTime + relativeTime;
      const clampedTime = Math.max(activePreviewSegment.startTime, Math.min(actualVideoTime, activePreviewSegment.endTime));
      
      // Only update if we're in the current segment's range
      if (currentStitchedPlaybackTime >= segmentStartInStitched && 
          currentStitchedPlaybackTime < segmentStartInStitched + (activePreviewSegment.endTime - activePreviewSegment.startTime)) {
        currentVideoRef.current.currentTime = clampedTime;
      }
    }
  }, [currentStitchedPlaybackTime, activePreviewSegment, memoizedSegments]);
   
  // Ultra-stable video key that rarely changes to prevent video recreation
  const videoKey = useMemo(() => {
    if (!activePreviewSegment) return 'no-segment';
    // Only change key every 5 seconds or when segment actually changes
    const timeSlot = Math.floor(currentStitchedPlaybackTime / 5) * 5;
    return `${activePreviewSegment.id}_${timeSlot}`;
  }, [activePreviewSegment?.id, Math.floor(currentStitchedPlaybackTime / 5)]);
  
  let currentTimelineOffset = 0;

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--color-bg-primary)' }}>
      <div className="flex-grow rounded-lg" style={{ background: 'var(--color-bg-secondary)', boxShadow: 'none', border: '1px solid var(--color-divider)' }}>
        {activePreviewSegment ? (
          (() => {
            const sourceVideo = videoSources.find(v => v.id === activePreviewSegment.sourceVideoId);
            if (sourceVideo) {
              return (
                <video
                  key={videoKey}
                  ref={(el) => { currentVideoRef.current = el; }}
                  src={sourceVideo.url}
                  className="w-full h-full object-contain"
                  autoPlay={isStitchedPlaying}
                  muted
                  onLoadedMetadata={(e) => {
                    const video = e.currentTarget;
                    // Use currentStitchedPlaybackTime for accurate positioning
                    const timeToUse = currentStitchedPlaybackTime;
                    
                    // Calculate the relative time within this segment
                    let segmentStartInStitched = 0;
                    for (const seg of memoizedSegments) {
                      if (seg.id === activePreviewSegment.id) break;
                      segmentStartInStitched += (seg.endTime - seg.startTime);
                    }
                    const relativeTime = timeToUse - segmentStartInStitched;
                    const actualVideoTime = activePreviewSegment.startTime + relativeTime;
                    const clampedTime = Math.max(activePreviewSegment.startTime, Math.min(actualVideoTime, activePreviewSegment.endTime));
                    
                    // Force seeking even if time is 0
                    video.currentTime = clampedTime;
                    
                    // Ensure the video is at the correct position
                    if (Math.abs(video.currentTime - clampedTime) > 0.1) {
                      // If seeking didn't work, try again after a short delay
                      setTimeout(() => {
                        video.currentTime = clampedTime;
                      }, 100);
                    }
                  }}
                  onTimeUpdate={(e) => {
                    if (!isStitchedPlaying) return;
                    const video = e.currentTarget;
                    // Ensure video stays within segment bounds
                    if (video.currentTime >= activePreviewSegment.endTime) {
                      video.pause();
                      setIsStitchedPlaying(false);
                    }
                  }}
                  onSeeked={(e) => {
                    // Video has successfully seeked to new position
                    const video = e.currentTarget;
                    if (isStitchedPlaying && video.paused) {
                      // If we were playing but video got paused during seek, resume
                      video.play();
                    }
                  }}
                />
              );
            } else {
              return (
                <div className="w-full h-full flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <VideoIcon className="w-16 h-16 mx-auto mb-2 opacity-50" />
                    <p>Video source not found</p>
                    <p className="text-sm">ID: {activePreviewSegment.sourceVideoId}</p>
                  </div>
                </div>
              );
            }
          })()
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600">
            <div className="text-center">
              <VideoIcon className="w-20 h-20 mx-auto mb-4 opacity-30" />
              <p className="text-lg">No segments in workspace</p>
              <p className="text-sm">Add video segments to start editing</p>
            </div>
          </div>
        )}
         {editWithScript && (
          <div className="absolute top-2 left-2 bg-purple-600 text-white text-xs px-2 py-1 rounded shadow-lg z-10">
            Script Editing Overlay (Placeholder)
          </div>
        )}
      </div>

      <div className="flex-shrink-0 p-3 rounded-lg" style={{ background: 'var(--color-bg-secondary)', boxShadow: 'none', border: '1px solid var(--color-divider)' }}>
        <div className="flex items-center justify-between h-8">
          <div className="flex items-center space-x-3">
            <label htmlFor="editWithScriptToggle" className="flex items-center cursor-pointer text-xs text-gray-400 hover:text-gray-200">
              <div className="relative">
                <input 
                  type="checkbox" 
                  id="editWithScriptToggle" 
                  className="sr-only" 
                  checked={editWithScript} 
                  onChange={() => setEditWithScript(!editWithScript)}
                />
                <div className={`block w-10 h-5 rounded-full transition-colors ${editWithScript ? 'bg-purple-600' : 'bg-gray-700'}`}></div>
                <div className={`dot absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full transition-transform ${editWithScript ? 'transform translate-x-full' : ''}`}></div>
              </div>
              <span className="ml-2 font-medium">Edit with Script</span>
            </label>
            <span className="text-xs text-gray-500">(Mode: {editWithScript ? 'ON' : 'OFF'})</span>
          </div>
          <Button onClick={handleSplitClip} variant="ghost" size="sm" title="Split clip at playhead" disabled={memoizedSegments.length === 0}>
             <ScissorsIcon className="w-4 h-4 mr-1.5"/> Split
          </Button>
        </div>

        {/* Timeline Ruler and Playhead within it */}
        <div className="h-[${RULER_HEIGHT}px] overflow-hidden relative">
            <TimelineRuler 
                duration={stitchedVideoDuration} 
                pixelsPerSecond={pixelsPerSecond} 
                playheadTime={timelinePlayheadTime}
                onClickRuler={handleRulerClick}
            />
        </div>
        
        <div 
          ref={timelineContainerRef}
          className={`h-[${TIMELINE_HEIGHT}px] bg-gray-900 rounded-md relative overflow-x-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-800
                      ${isDragOver ? 'border-blue-500 border-2' : 'border border-gray-700'}`}
          onClick={handleTimelineClick} // This click is for selecting segments or general timeline area if needed.
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              const videoId = e.dataTransfer.getData('text/plain');
              if (videoId && props.onVideoDropped) props.onVideoDropped(videoId);
          }}
        >
          <div 
              className="relative h-full" 
              style={{ width: `${Math.max(totalTimelinePixelWidth, timelineContainerRef.current?.clientWidth || 0)}px`}}
          >
              {memoizedSegments.map((segment) => {
                  const item = (
                      <TimelineItem
                          key={segment.id}
                          segment={segment}
                          pixelsPerSecond={pixelsPerSecond}
                          timelineStartOffset={currentTimelineOffset}
                          isSelected={selectedSegmentId === segment.id}
                          videoSources={videoSources}
                          onSelect={setSelectedSegmentId}
                          onRemove={onRemoveSegment}
                          onSegmentClick={onSegmentClick}
                          onTrim={handleTrimSegment}
                      />
                  );
                  currentTimelineOffset += (segment.endTime - segment.startTime);
                  return item;
              })}
              {/* Draggable Playhead for segment track (visually redundant if ruler playhead is sufficient) */}
              {/* If ruler playhead is the primary, this one might be visually hidden or simplified */}
              <div
                  className="absolute top-0 bottom-0 bg-red-500 z-20 group cursor-ew-resize"
                  style={{ 
                      left: `${timelinePlayheadTime * pixelsPerSecond - (PLAYHEAD_WIDTH / 2)}px`, 
                      width: `${PLAYHEAD_WIDTH}px`,
                  }}
                  onMouseDown={handlePlayheadDragStart}
                  title="Drag to scrub timeline"
              >
                  <div className="absolute -top-2.5 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-red-500 rounded-sm border-2 border-gray-900 rotate-45 group-hover:scale-125 transition-transform">
                     <div className="w-full h-full bg-red-500 transform rotate-[-45deg] rounded-sm"></div>
                  </div>
              </div>
          </div>
          {memoizedSegments.length === 0 && !isDragOver && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-600 pointer-events-none text-sm">
              <p>Timeline empty. Add or drop video segments.</p>
            </div>
          )}
           {isDragOver && (
            <div className="absolute inset-0 flex items-center justify-center text-blue-400 pointer-events-none border-2 border-dashed border-blue-500 rounded-md bg-blue-900 bg-opacity-20">
              <p className="font-medium">Drop video to add</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between h-10 px-1">
          <div className="flex items-center space-x-1">
            <Button variant="ghost" size="sm" title="Previous (placeholder)" className="p-1.5 text-gray-400 hover:text-white"><RewindIcon className="w-5 h-5"/></Button>
            <Button 
              onClick={handlePlayPauseStitched} 
              variant="ghost" 
              size="sm" 
              title={isStitchedPlaying ? "Pause Stitched (Spacebar)" : "Play Stitched (Spacebar)"} 
              className="p-1.5 text-gray-400 hover:text-white"
              data-play-pause-button
            >
              {isStitchedPlaying ? <PauseIcon className="w-6 h-6"/> : <PlayIcon className="w-6 h-6"/>}
            </Button>
            <Button variant="ghost" size="sm" title="Next (placeholder)" className="p-1.5 text-gray-400 hover:text-white"><FastForwardIcon className="w-5 h-5"/></Button>
          </div>
          <div className="text-xs text-gray-300 font-mono">
            {formatTime(currentStitchedPlaybackTime)} / {formatTime(stitchedVideoDuration)}
          </div>
          <div className="flex items-center space-x-1">
            <Button variant="ghost" size="sm" title="Zoom Out (placeholder)" className="p-1.5 text-gray-400 hover:text-white"><ZoomOutIcon className="w-5 h-5"/></Button>
            <input type="range" min="0.5" max="3" step="0.1" value={zoomLevel} onChange={(e) => setZoomLevel(parseFloat(e.target.value))} className="w-20 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer range-sm accent-blue-500" disabled title="Zoom (placeholder)"/>
            <Button variant="ghost" size="sm" title="Zoom In (placeholder)" className="p-1.5 text-gray-400 hover:text-white"><ZoomInIcon className="w-5 h-5"/></Button>
            <Button variant="ghost" size="sm" title="Fit to View (placeholder)" className="text-xs px-2 py-1 text-gray-400 hover:text-white">Fit</Button>
          </div>
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function to prevent unnecessary re-renders
  // Only re-render if segments array actually changed (deep comparison)
  if (prevProps.segments.length !== nextProps.segments.length) return false;
  
  for (let i = 0; i < prevProps.segments.length; i++) {
    const prev = prevProps.segments[i];
    const next = nextProps.segments[i];
    if (prev.id !== next.id || 
        prev.startTime !== next.startTime || 
        prev.endTime !== next.endTime ||
        prev.sourceVideoId !== next.sourceVideoId) {
      return false;
    }
  }
  
  // Check if videoSources array changed
  if (prevProps.videoSources.length !== nextProps.videoSources.length) return false;
  if (prevProps.videoSources.some((v, i) => v.id !== nextProps.videoSources[i]?.id)) return false;
  
  // Props are effectively the same, skip re-render
  return true;
});

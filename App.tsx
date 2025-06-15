import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { TabDefinition, VideoSource, VideoSegment, ChatMessage, GroundingChunk } from './src/types';
import { WORKSPACE_TAB_ID, INITIAL_WORKSPACE_TAB } from './src/constants';
import { WorkspaceView } from './components/WorkspaceView';
import { SourceVideoView } from './components/SourceVideoView';
// MOCK_VIDEO_SOURCES and MOCK_WORKSPACE_SEGMENTS are no longer used for initial state
// import { MOCK_VIDEO_SOURCES, MOCK_WORKSPACE_SEGMENTS } from './services/mockData';
import * as GeminiService from './src/services/geminiService';
import { SearchIcon, CloseIcon, WorkspaceIcon, VideoIcon, ChatIcon, LinkIcon, WarningIcon, FolderOpenIcon, PlusIcon as UploadIcon, MoreHorizontalIcon, ChevronRightIcon as ViewAllIcon } from './components/Icons';
import { Button } from './components/Button';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ChatPanel } from './src/components/ChatPanel';


// --- Left Sidebar ---
interface LeftSidebarProps {
  globalChatHistory: ChatMessage[];
  onSendGlobalChatMessage: (messageText: string) => Promise<void>;
  isGlobalChatLoading: boolean;
  onVideoUploaded: (file: File) => void;
  userUploadedVideos: VideoSource[];
  onOpenUploadedVideo: (video: VideoSource) => void;
  onDragVideoSourceStart?: (event: React.DragEvent, videoId: string) => void;
}

const EXAMPLE_GLOBAL_PROMPTS = [
  { id: 'ex_explain_color', text: "Explain 'color grading'", action: 'chat'},
  { id: 'ex_ideas_doc', text: "Suggest documentary topics", action: 'chat'},
];


const LeftSidebar: React.FC<LeftSidebarProps> = (props) => { 
  const {
    globalChatHistory, 
    onSendGlobalChatMessage, 
    isGlobalChatLoading,
    onVideoUploaded,
    userUploadedVideos,
    onOpenUploadedVideo,
  } = props;

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onVideoUploaded(file);
    }
    if (event.target) {
        event.target.value = ''; 
    }
  };

  return (
    <div className="w-80 lg:w-96 bg-gray-950 p-0 flex flex-col border-r border-gray-800 h-full">
      <div className="p-4 pb-0">
        <Button 
            variant="primary" 
            className="w-full mb-4"
            leftIcon={<UploadIcon className="w-4 h-4"/>}
            onClick={() => fileInputRef.current?.click()}
        >
            Upload
        </Button>
        <input
            type="file"
            ref={fileInputRef}
            accept="video/*,.mp4,.mov,.webm,.ogv"
            onChange={handleFileUpload}
            className="hidden"
        />
      </div>

      {userUploadedVideos.length > 0 && (
        <div className="mb-4 border-t border-gray-800 pt-4 px-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">Your Videos</h3>
          </div>
          <div className="grid grid-cols-3 gap-2.5 max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900 pr-1">
            {userUploadedVideos.map(video => (
              <div 
                key={video.id} 
                className="aspect-video bg-gray-800 rounded-md overflow-hidden cursor-pointer group relative border border-gray-700 hover:border-gray-600"
                onClick={() => onOpenUploadedVideo(video)}
                title={`Open ${video.title}`}
                draggable="true"
                onDragStart={(e) => {
                    if (props.onDragVideoSourceStart) {
                        props.onDragVideoSourceStart(e, video.id);
                    }
                }}
              >
                <img src={video.thumbnailUrl || `https://picsum.photos/seed/${video.id}/160/90`} alt={video.title} className="w-full h-full object-cover group-hover:opacity-80 transition-opacity"/>
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-1.5">
                  <p className="text-xs text-white font-medium truncate group-hover:underline">{video.title}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Replace existing chat UI with ChatPanel */}
      <ChatPanel 
        className="border-t border-gray-800 flex-grow"
        chatHistory={globalChatHistory}
        onSendMessage={onSendGlobalChatMessage}
        isLoading={isGlobalChatLoading}
        examplePrompts={EXAMPLE_GLOBAL_PROMPTS}
        placeholderText="Ask Gemini..."
        title="Assistant"
        showTitle={true}
      />
    </div>
  );
};


// --- Tab Bar ---
interface TabBarProps {
  tabs: TabDefinition[];
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  getVideoTitle: (videoId?: string) => string;
}

const TabBar: React.FC<TabBarProps> = ({ tabs, activeTabId, onSelectTab, onCloseTab, getVideoTitle }) => {
  return (
    <nav className="bg-gray-950 flex border-b border-gray-800 shadow-md">
      {tabs.map(tab => (
        <div
          key={tab.id}
          onClick={() => onSelectTab(tab.id)}
          className={`flex items-center py-2.5 px-4 cursor-pointer border-r border-gray-800 transition-colors duration-150 ease-in-out
                        ${activeTabId === tab.id 
                            ? 'bg-gray-850 text-yellow-400 border-b-2 border-yellow-400' 
                            : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`}
          role="tab"
          aria-selected={activeTabId === tab.id}
          aria-controls={`tabpanel-${tab.id}`}
          tabIndex={0} 
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectTab(tab.id); }}
        >
          {tab.type === 'workspace' ? <WorkspaceIcon className="w-4 h-4 mr-2" /> : <VideoIcon className="w-4 h-4 mr-2" />}
          <span className="text-sm font-medium truncate max-w-[150px] lg:max-w-[200px]">
            {tab.type === 'source' ? getVideoTitle(tab.videoId) : tab.title}
          </span>
          {tab.id !== WORKSPACE_TAB_ID && (
            <button
              onClick={(e) => { e.stopPropagation(); onCloseTab(tab.id); }}
              className="ml-3 p-0.5 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-600"
              aria-label={`Close tab ${tab.type === 'source' ? getVideoTitle(tab.videoId) : tab.title}`}
            >
              <CloseIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ))}
    </nav>
  );
};

// Correct video URLs from test.js
const CORRECT_VIDEO_SOURCES_DATA = [
  { id: 'sample2', title: 'GoPro Sample 2', url: 'https://storage.googleapis.com/gopro_videos/sample2.mp4' },
  { id: 'sample3', title: 'GoPro Sample 3', url: 'https://storage.googleapis.com/gopro_videos/sample3.mp4' },
  { id: 'sample4', title: 'GoPro Sample 4', url: 'https://storage.googleapis.com/gopro_videos/sample4.mp4' },
  { id: 'sample5', title: 'GoPro Sample 5', url: 'https://storage.googleapis.com/gopro_videos/sample5.mp4' }
];

// --- Main App ---
const App: React.FC = () => {
  const [tabs, setTabs] = useState<TabDefinition[]>([INITIAL_WORKSPACE_TAB]);
  const [activeTabId, setActiveTabId] = useState<string>(WORKSPACE_TAB_ID);
  
  // videoSources state is not used for initial data, userUploadedVideos is used for sidebar list
  // const [videoSources, setVideoSources] = useState<VideoSource[]>([]); 
  const [userUploadedVideos, setUserUploadedVideos] = useState<VideoSource[]>([]);
  const [workspaceSegments, setWorkspaceSegments] = useState<VideoSegment[]>([]); 

  const [globalChatHistory, setGlobalChatHistory] = useState<ChatMessage[]>([]);
  const [isGlobalChatLoading, setIsGlobalChatLoading] = useState(false);
  const [videoChatHistories, setVideoChatHistories] = useState<Record<string, ChatMessage[]>>({});
  const [isVideoChatLoading, setIsVideoChatLoading] = useState<Record<string, boolean>>({});
  const [apiKeyStatus, setApiKeyStatus] = useState<'checking' | 'valid' | 'missing'>('checking');

  const loadInitialVideos = async () => {
    try {
      const videos = CORRECT_VIDEO_SOURCES_DATA.map(video => ({
        ...video,
        thumbnailUrl: `https://picsum.photos/seed/${video.id}/160/90`,
        duration: 0
      }));

      // Load durations for each video
      for (const video of videos) {
        try {
          const tempVideo = document.createElement('video');
          tempVideo.src = video.url;
          await new Promise((resolve, reject) => {
            tempVideo.onloadedmetadata = () => {
              video.duration = tempVideo.duration;
              console.log(`[App:loadInitialVideos] Got duration for ${video.title}: ${video.duration}`);
              resolve(null);
            };
            tempVideo.onerror = (err) => {
              console.error(`[App:loadInitialVideos] Error getting duration for: ${video.title}`, err);
              reject(err);
            };
          });
        } catch (err) {
          console.error(`[App:loadInitialVideos] Error loading video: ${video.title}`, err);
        }
      }

      setUserUploadedVideos(videos);
      console.log('[App:loadInitialVideos] Initial videos loaded from GCS URLs:', videos);
    } catch (err) {
      console.error('[App:loadInitialVideos] Error loading initial videos:', err);
    }
  };

  useEffect(() => {
    loadInitialVideos();
  }, []);

  useEffect(() => {
    if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
      setApiKeyStatus('valid');
    } else {
      // console.warn("API_KEY check: process.env.API_KEY is not directly accessible in browser like this. Mocking as 'missing' for UI purposes.");
      setApiKeyStatus('missing'); 
    }
  }, []);

  const getVideoTitle = useCallback((videoId?: string): string => {
    if (!videoId) return 'Unknown Video';
    // Ensure this uses userUploadedVideos which now holds the GCS videos
    return userUploadedVideos.find(v => v.id === videoId)?.title || 'Video Source';
  }, [userUploadedVideos]);


  const openVideoSourceTab = (video: VideoSource, highlightSegment?: { start: number; end: number }) => {
    const tabId = `source_tab_${video.id}`;
    if (!tabs.find(t => t.id === tabId)) {
      const newTab: TabDefinition = { 
        id: tabId, 
        title: video.title, 
        type: 'source', 
        videoId: video.id,
        highlightSegment 
      };
      setTabs(prev => [...prev, newTab]);
    } else {
      setTabs(prevTabs => prevTabs.map(t => 
        t.id === tabId ? { ...t, highlightSegment } : t
      ));
    }
    setActiveTabId(tabId);
  };

  const handleVideoUploaded = (file: File) => {
    console.log(`[App:handleVideoUploaded] File received:`, file);
    const newVideoId = `uploaded_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9]/g, '')}`;
    const objectURL = URL.createObjectURL(file);
    
    const tempVideoElement = document.createElement('video');
    tempVideoElement.src = objectURL; 
    
    const newVideoSourceBase: Omit<VideoSource, 'duration' | 'thumbnailUrl'> & {duration?: number, thumbnailUrl?: string} = {
      id: newVideoId,
      title: file.name,
      url: objectURL, 
      description: `Uploaded video: ${file.name}`,
      file: file,
    };

    tempVideoElement.onloadedmetadata = () => {
        const duration = tempVideoElement.duration;
        console.log(`[App:handleVideoUploaded:onloadedmetadata] Duration: ${duration}`);
        newVideoSourceBase.duration = duration;
        tempVideoElement.currentTime = Math.min(1, duration / 2); 
        tempVideoElement.onseeked = () => {
            // console.log(`[App:handleVideoUploaded:onseeked] Video seeked to ${tempVideoElement.currentTime} for thumbnail.`);
            const canvas = document.createElement('canvas');
            canvas.width = 160; 
            canvas.height = tempVideoElement.videoWidth > 0 ? (tempVideoElement.videoHeight / tempVideoElement.videoWidth) * canvas.width : 90;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(tempVideoElement, 0, 0, canvas.width, canvas.height);
                newVideoSourceBase.thumbnailUrl = canvas.toDataURL('image/jpeg');
                console.log(`[App:handleVideoUploaded:onseeked] Thumbnail generated.`);
            }
            const finalVideoSource = { ...newVideoSourceBase, duration: newVideoSourceBase.duration || 0, thumbnailUrl: newVideoSourceBase.thumbnailUrl || `https://picsum.photos/seed/${newVideoId}/160/90` } as VideoSource;
            console.log(`[App:handleVideoUploaded:onseeked] finalVideoSource before setUserUploadedVideos:`, finalVideoSource);
            setUserUploadedVideos(prev => [...prev, finalVideoSource]);
            console.log(`[App:handleVideoUploaded:onseeked] setUserUploadedVideos called. Opening tab for:`, finalVideoSource);
            openVideoSourceTab(finalVideoSource); 
            tempVideoElement.remove(); 
        }
    };
     tempVideoElement.onerror = () => {
        console.error("[App:handleVideoUploaded:onerror] Error loading video for thumbnail/duration.");
        const finalVideoSource = { ...newVideoSourceBase, duration: 0, thumbnailUrl: `https://picsum.photos/seed/${newVideoId}/160/90` } as VideoSource;
        setUserUploadedVideos(prev => [...prev, finalVideoSource]);
        openVideoSourceTab(finalVideoSource);
        tempVideoElement.remove();
    };
  };


  const handleCloseTab = (tabId: string) => {
    if (tabId === WORKSPACE_TAB_ID) return; 
    setTabs(prev => prev.filter(t => t.id !== tabId));
    if (activeTabId === tabId) {
      setActiveTabId(WORKSPACE_TAB_ID); 
    }
  };

  const handleAddSegmentToWorkspace = async (
    sourceVideoId: string, 
    sourceVideoTitle: string, 
    segmentTimes: { startTime: number; endTime: number },
    thumbnailUrl: string 
  ): Promise<void> => {
    console.log("[App:handleAddSegmentToWorkspace] Received for video:", sourceVideoTitle, "(ID:", sourceVideoId, ") Segment Times:", segmentTimes, "Thumbnail URL:", thumbnailUrl);
    const newSegment: VideoSegment = {
      id: `seg_${sourceVideoId}_${Date.now()}`,
      sourceVideoId,
      sourceVideoTitle,
      startTime: segmentTimes.startTime,
      endTime: segmentTimes.endTime,
      thumbnailUrl: thumbnailUrl, 
    };
    console.log("[App:handleAddSegmentToWorkspace] Creating new segment:", newSegment);
    setWorkspaceSegments(prev => [...prev, newSegment]);
  };

  const handleRemoveWorkspaceSegment = (segmentId: string) => {
    setWorkspaceSegments(prev => prev.filter(s => s.id !== segmentId));
  };
  
  const handleUpdateWorkspaceSegments = (updatedSegments: VideoSegment[]) => {
    console.log("[App:handleUpdateWorkspaceSegments] Received updated segments:", updatedSegments);
    setWorkspaceSegments(updatedSegments);
  };

  const handleNewSegmentRequestFromWorkspace = (segmentData: Omit<VideoSegment, 'id' | 'thumbnailUrl'>) => {
    const newSegment: VideoSegment = {
      ...segmentData, 
      id: `ws_seg_${segmentData.sourceVideoId}_${Date.now()}`, 
      thumbnailUrl: `https://picsum.photos/seed/ws_new_thumb_${Date.now()}/150/90`, 
    };
    setWorkspaceSegments(prev => [...prev, newSegment]);
  };
  
  const handleDragVideoSourceStart = (event: React.DragEvent, videoId: string) => {
    event.dataTransfer.setData('text/plain', videoId);
    event.dataTransfer.effectAllowed = 'copy';
  };

  const handleDropInWorkspace = async (videoId: string) => {
    const videoToDrop = userUploadedVideos.find(v => v.id === videoId); // Changed to userUploadedVideos

    if (videoToDrop) {
      const segmentDuration = Math.min(10, videoToDrop.duration > 0 ? videoToDrop.duration : 10);
      
      let newSegmentThumbnailUrl = `https://picsum.photos/seed/dropped_${Date.now()}/150/90`; 
      if (videoToDrop.url) {
        try {
          const tempVideo = document.createElement('video');
          tempVideo.crossOrigin = "anonymous";
          tempVideo.src = videoToDrop.url;
          await new Promise<void>((resolve, reject) => {
            tempVideo.onloadedmetadata = () => {
              tempVideo.currentTime = 0; 
              resolve();
            };
            tempVideo.onerror = (err) => reject(err);
          });
          await new Promise<void>((resolve, reject) => {
            tempVideo.onseeked = () => {
              const canvas = document.createElement('canvas');
              canvas.width = 150;
              canvas.height = tempVideo.videoWidth > 0 ? (tempVideo.videoHeight / tempVideo.videoWidth) * 150 : 90;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
                newSegmentThumbnailUrl = canvas.toDataURL('image/jpeg');
              }
              resolve();
            };
            tempVideo.onerror = (err) => reject(err);
          });
          tempVideo.remove();
        } catch (error) {
          console.error("Error generating thumbnail for dropped segment:", error);
        }
      }
      await handleAddSegmentToWorkspace(
          videoToDrop.id, 
          videoToDrop.title, 
          {startTime: 0, endTime: segmentDuration}, 
          newSegmentThumbnailUrl
      );
    } else {
      console.warn(`[App] Dropped video with ID ${videoId} not found.`);
    }
  };

  const handleSendGlobalChatMessage = async (messageText: string) => {
    const userMessage: ChatMessage = { 
        id: `user_global_${Date.now()}`, 
        sender: 'user', 
        text: messageText
    };
    setGlobalChatHistory(prev => [...prev, userMessage]);
    setIsGlobalChatLoading(true);

    const lowerMessageText = messageText.toLowerCase();
    let videoToAnalyze: VideoSource | undefined = undefined;

    // First check if the message explicitly mentions a video by title
    for (const video of userUploadedVideos) {
        if (video.title && lowerMessageText.includes(video.title.toLowerCase())) {
            videoToAnalyze = video;
            break;
        }
    }

    if (!videoToAnalyze) {
        const availableVideos = userUploadedVideos.map(v => `"${v.title}"`).join(', ');
        setGlobalChatHistory(prev => [...prev, {
            id: `ai_err_novideo_${Date.now()}`,
            sender: 'ai',
            text: `Please mention which video you would like me to analyze. Available videos: ${availableVideos}.`
        }]);
        setIsGlobalChatLoading(false);
        return;
    }

    try {
        console.log(`[App:handleSendGlobalChatMessage] Analyzing video: ${videoToAnalyze.title} (ID: ${videoToAnalyze.id})`);
        
        const loadingMessage: ChatMessage = {
            id: `ai_loading_${Date.now()}`,
            sender: 'ai',
            text: `Analyzing "${videoToAnalyze.title}"... This may take a moment.`
        };
        setGlobalChatHistory(prev => [...prev, loadingMessage]);

        const response = await fetch('http://localhost:5000/api/gemini/analyze-video', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                videoUrl: videoToAnalyze.url,
                messageText: messageText,
                videoId: videoToAnalyze.id
            })
        });

        if (!response.ok) {
            throw new Error(`Backend API error: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Remove loading message and add AI response
        setGlobalChatHistory(prev => 
            prev.filter(msg => msg.id !== loadingMessage.id).concat({
                id: `ai_${Date.now()}`,
                sender: 'ai',
                text: data.text
            })
        );
    } catch (error) {
        console.error('[App:handleSendGlobalChatMessage] Error:', error);
        
        // Remove loading message and add error message
        setGlobalChatHistory(prev => 
            prev.filter(msg => msg.id.includes('ai_loading_')).concat({
                id: `ai_err_${Date.now()}`,
                sender: 'ai',
                text: 'There was an issue communicating with the AI service. Please try again.'
            })
        );
    } finally {
        setIsGlobalChatLoading(false);
    }
};

  const handleSendVideoChatMessage = async (videoId: string, messageText: string) => {
    const userMessage: ChatMessage = { 
        id: `user_${videoId}_${Date.now()}`, 
        sender: 'user', 
        text: messageText 
    };
    setVideoChatHistories(prev => ({
        ...prev,
        [videoId]: [...(prev[videoId] || []), userMessage]
    }));
    setIsVideoChatLoading(prev => ({ ...prev, [videoId]: true }));

    const currentVideoToAnalyze = userUploadedVideos.find(v => v.id === videoId);
    if (!currentVideoToAnalyze || !currentVideoToAnalyze.url) {
        console.error(`[App:handleSendVideoChatMessage] Video or Video URL not found for ID: ${videoId}`);
        const errorMessage: ChatMessage = {
            id: `ai_err_novideo_${videoId}_${Date.now()}`,
            sender: 'ai',
            text: "Sorry, I couldn't find the video data to analyze. Please ensure the video is loaded correctly."
        };
        setVideoChatHistories(prev => ({
            ...prev,
            [videoId]: [...(prev[videoId] || []), errorMessage]
        }));
        setIsVideoChatLoading(prev => ({ ...prev, [videoId]: false }));
        return;
    }

    try {
        console.log(`[App:handleSendVideoChatMessage] Analyzing video: ${currentVideoToAnalyze.title} (ID: ${videoId})`);
        
        const loadingMessage: ChatMessage = {
            id: `ai_loading_${videoId}_${Date.now()}`,
            sender: 'ai',
            text: 'Analyzing the video... This may take a moment.'
        };
        setVideoChatHistories(prev => ({
            ...prev,
            [videoId]: [...(prev[videoId] || []), loadingMessage]
        }));

        const response = await fetch('http://localhost:5000/api/gemini/analyze-video', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                videoUrl: currentVideoToAnalyze.url,
                messageText: messageText,
                videoId: videoId
            })
        });

        if (!response.ok) {
            throw new Error(`Backend API error: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Remove loading message and add AI response
        setVideoChatHistories(prev => ({
            ...prev,
            [videoId]: [...(prev[videoId] || []).filter(msg => msg.id !== loadingMessage.id), {
                id: `ai_${videoId}_${Date.now()}`,
                sender: 'ai',
                text: data.text
            }]
        }));
    } catch (error) {
        console.error('[App:handleSendVideoChatMessage] Error:', error);
        
        // Remove loading message and add error message
        setVideoChatHistories(prev => ({
            ...prev,
            [videoId]: [...(prev[videoId] || []).filter(msg => !msg.id.includes('ai_loading_')), {
                id: `ai_err_${videoId}_${Date.now()}`,
                sender: 'ai',
                text: 'There was an issue communicating with the AI service. Please try again.'
            }]
        }));
    } finally {
        setIsVideoChatLoading(prev => ({ ...prev, [videoId]: false }));
    }
};
  
  const handleVideoDurationKnown = useCallback((videoId: string, newDuration: number) => {
    setUserUploadedVideos(prevVideos => {
      let changed = false;
      const updatedVideos = prevVideos.map(v => {
        if (v.id === videoId) {
          if (newDuration > 0 && (v.duration === 0 || Math.abs(v.duration - newDuration) > 0.001)) {
            changed = true;
            return { ...v, duration: newDuration };
          }
        }
        return v;
      });
      return changed ? updatedVideos : prevVideos;
    });
  }, []); 


  const activeTabData = useMemo(() => tabs.find(t => t.id === activeTabId), [tabs, activeTabId]);
  
  const activeVideo = useMemo(() => {
    if (activeTabData?.type === 'source' && activeTabData.videoId) {
      const foundVideo = userUploadedVideos.find(v => v.id === activeTabData.videoId);
      return foundVideo;
    }
    return undefined;
  }, [activeTabData, userUploadedVideos]);

  return (
    <div className="h-screen w-screen flex" style={{ background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', fontFamily: 'Loew, Arial, sans-serif' }}>
      <LeftSidebar 
        globalChatHistory={globalChatHistory}
        onSendGlobalChatMessage={handleSendGlobalChatMessage}
        isGlobalChatLoading={isGlobalChatLoading}
        onVideoUploaded={handleVideoUploaded}
        userUploadedVideos={userUploadedVideos}
        onOpenUploadedVideo={(video) => openVideoSourceTab(video)}
        onDragVideoSourceStart={handleDragVideoSourceStart}
      />
      
      <main className="flex-1 flex flex-col overflow-hidden">
        {apiKeyStatus === 'missing' && (
          <div style={{ background: 'var(--color-warning)', color: '#000' }} className="p-2 text-center text-xs font-semibold flex items-center justify-center">
            <WarningIcon className="w-4 h-4 mr-2 text-yellow-900"/>
            Warning: API Key for Gemini is not configured. AI features will use mock data or may not function.
          </div>
        )}
        {apiKeyStatus === 'checking' && (
          <div style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' }} className="p-2 text-center text-xs font-semibold">
            Checking API Key status...
          </div>
        )}
        <TabBar 
            tabs={tabs} 
            activeTabId={activeTabId} 
            onSelectTab={setActiveTabId} 
            onCloseTab={handleCloseTab}
            getVideoTitle={getVideoTitle}
        />

        <div className="flex-grow overflow-y-auto bg-gray-900" role="tabpanel" id={`tabpanel-${activeTabId}`}>
          {activeTabData?.type === 'workspace' && (
            <WorkspaceView 
                segments={workspaceSegments} 
                videoSources={userUploadedVideos}
                onSegmentClick={(segment) => {
                    const videoToOpen = userUploadedVideos.find(v => v.id === segment.sourceVideoId);
                    if (videoToOpen) {
                        openVideoSourceTab(videoToOpen, {start: segment.startTime, end: segment.endTime});
                    } else {
                        console.warn(`Source video ${segment.sourceVideoId} not found among uploaded videos.`);
                    }
                }}
                onRemoveSegment={handleRemoveWorkspaceSegment}
                onUpdateSegments={handleUpdateWorkspaceSegments}
                onAddSegment={handleNewSegmentRequestFromWorkspace}
                onVideoDropped={handleDropInWorkspace} 
            />
          )}
          {activeTabData?.type === 'source' && activeVideo && (
            <SourceVideoView 
              key={activeVideo.id + (activeTabData.highlightSegment ? `_hl_${activeTabData.highlightSegment.start}_${activeTabData.highlightSegment.end}` : '')} 
              video={activeVideo}
              workspaceSegments={workspaceSegments}
              highlightSegment={activeTabData.highlightSegment}
              onAddSegmentToWorkspace={handleAddSegmentToWorkspace}
              chatHistory={videoChatHistories[activeVideo.id] || []}
              onSendMessage={(messageText: string) => handleSendVideoChatMessage(activeVideo.id, messageText)}
              onTimestampClick={(time: number) => {
                console.log(`[App] Timestamp clicked in SourceVideoView: ${time} for video ${activeVideo.title}`);
                // The actual seeking is handled within SourceVideoView.tsx by its handleTimestampClickInternal function.
                // App.tsx is just being notified here.
              }}
              isLoading={!!isVideoChatLoading[activeVideo.id]}
            />
          )}
           {!activeTabData && ( 
             <div className="p-8 text-center text-gray-500">
                <WarningIcon className="w-16 h-16 mx-auto mb-4 text-gray-600"/>
                <h2 className="text-xl">No Active Tab</h2>
                <p>Please select a tab or an error has occurred.</p>
            </div>
           )}
           {activeTabData?.type === 'source' && !activeVideo && (
              <div className="p-8 text-center text-gray-500">
                <VideoIcon className="w-16 h-16 mx-auto mb-4 text-gray-600"/>
                <h2 className="text-xl">Video Not Found</h2>
                <p>The video associated with this tab could not be loaded. It might have been removed or an error occurred.</p>
                <p className="text-xs mt-2">Tab ID: {activeTabData.id}, Video ID: {activeTabData.videoId || 'N/A'}</p>
            </div>
           )}
        </div>
      </main>
    </div>
  );
};

export default App;

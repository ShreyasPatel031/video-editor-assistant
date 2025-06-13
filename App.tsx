import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { TabDefinition, VideoSource, VideoSegment, ChatMessage, GroundingChunk } from './types';
import { WORKSPACE_TAB_ID, INITIAL_WORKSPACE_TAB } from './constants';
import { WorkspaceView } from './components/WorkspaceView';
import { SourceVideoView } from './components/SourceVideoView';
// MOCK_VIDEO_SOURCES and MOCK_WORKSPACE_SEGMENTS are no longer used for initial state
// import { MOCK_VIDEO_SOURCES, MOCK_WORKSPACE_SEGMENTS } from './services/mockData';
import * as GeminiService from './services/geminiService';
import { SearchIcon, CloseIcon, WorkspaceIcon, VideoIcon, ChatIcon, LinkIcon, WarningIcon, FolderOpenIcon, PlusIcon as UploadIcon, MoreHorizontalIcon, ChevronRightIcon as ViewAllIcon } from './components/Icons'; // Removed RecordIcon
import { Button } from './components/Button';
import { LoadingSpinner } from './components/LoadingSpinner';


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

  const [chatInput, setChatInput] = useState('');
  const globalChatEndRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    globalChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [globalChatHistory]);

  const handleGlobalSend = (message?: string) => {
    const textToSend = message || chatInput;
    if (textToSend.trim()) {
      onSendGlobalChatMessage(textToSend.trim());
      if (!message) setChatInput(''); 
    }
  };
  
  const handleExamplePromptClick = (prompt: typeof EXAMPLE_GLOBAL_PROMPTS[0]) => {
    setChatInput(prompt.text);
  };


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
    <div className="w-80 lg:w-96 bg-gray-950 p-4 flex flex-col border-r border-gray-800 h-full">
      <div className="mb-4">
        <Button 
            variant="primary" 
            className="w-full bg-gray-700 hover:bg-gray-600"
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
        <div className="mb-4 border-t border-gray-800 pt-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">Your Videos</h3>
          </div>
          <div className="grid grid-cols-3 gap-2.5 max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900">
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
      
      <div className="flex flex-col flex-grow border-t border-gray-800 pt-4 min-h-0">
        <h3 className="text-sm font-semibold text-gray-200 mb-2 uppercase tracking-wider">Assistant</h3>
        <div className="flex-grow overflow-y-auto mb-3 pr-1 space-y-3 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900">
          {globalChatHistory.length === 0 && !isGlobalChatLoading && (
             <div className="text-xs text-gray-500 py-2">
                <p className="mb-2">I can help you analyze content or brainstorm ideas. Try asking:</p>
                <ul className="space-y-1.5">
                {EXAMPLE_GLOBAL_PROMPTS.map(p => (
                    <li key={p.id}>
                        <button 
                            onClick={() => handleExamplePromptClick(p)}
                            className="w-full text-left p-2 bg-gray-800 hover:bg-gray-700 rounded-md text-gray-300 hover:text-gray-100 transition-colors text-xs"
                        >
                           {p.text}
                        </button>
                    </li>
                ))}
                </ul>
             </div>
          )}
          {globalChatHistory.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs lg:max-w-sm px-3 py-2 rounded-lg shadow ${msg.sender === 'user' ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-300'}`}>
                <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                {msg.sender === 'ai' && msg.timestampLinks && msg.timestampLinks.length > 0 && msg.timestampLinks.some(link => (link as any).uri) && (
                  <div className="mt-2 pt-2 border-t border-gray-700 space-y-1">
                    <p className="text-xs text-gray-400 mb-0.5">Sources:</p>
                    {(msg.timestampLinks as unknown as GroundingChunk[]).map((chunk, idx) => chunk.web && (
                      <a 
                        key={idx} 
                        href={chunk.web.uri} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="block text-xs text-blue-400 hover:text-blue-300 hover:underline truncate"
                        title={chunk.web.title}
                      >
                        <LinkIcon className="w-3 h-3 inline mr-1 opacity-70"/>{chunk.web.title || new URL(chunk.web.uri).hostname}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {isGlobalChatLoading && (
             <div className="flex justify-start">
                 <div className="max-w-xs lg:max-w-sm px-3 py-2 rounded-lg bg-gray-800 text-gray-300">
                    <LoadingSpinner size="sm" text="Thinking..." className="p-1"/>
                </div>
             </div>
          )}
          <div ref={globalChatEndRef} />
        </div>
        <div className="flex-shrink-0 flex">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !isGlobalChatLoading && handleGlobalSend()}
            placeholder="Ask global AI..."
            className="flex-grow p-2.5 bg-gray-800 border border-gray-700 rounded-l-md focus:ring-1 focus:ring-gray-500 focus:border-gray-500 outline-none text-sm text-gray-200 placeholder-gray-500"
            disabled={isGlobalChatLoading}
          />
          <Button onClick={() => handleGlobalSend()} variant="primary" className="rounded-l-none px-5" disabled={isGlobalChatLoading || !chatInput.trim()} isLoading={isGlobalChatLoading}>
            Send
          </Button>
        </div>
      </div>
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

// --- Main App ---
const App: React.FC = () => {
  const [tabs, setTabs] = useState<TabDefinition[]>([INITIAL_WORKSPACE_TAB]);
  const [activeTabId, setActiveTabId] = useState<string>(WORKSPACE_TAB_ID);
  
  const [videoSources, setVideoSources] = useState<VideoSource[]>([]); 
  const [userUploadedVideos, setUserUploadedVideos] = useState<VideoSource[]>([]);
  const [workspaceSegments, setWorkspaceSegments] = useState<VideoSegment[]>([]); 

  const [globalChatHistory, setGlobalChatHistory] = useState<ChatMessage[]>([]);
  const [isGlobalChatLoading, setIsGlobalChatLoading] = useState(false);
  const [videoChatHistories, setVideoChatHistories] = useState<Record<string, ChatMessage[]>>({});
  const [isVideoChatLoading, setIsVideoChatLoading] = useState<Record<string, boolean>>({});
  const [apiKeyStatus, setApiKeyStatus] = useState<'checking' | 'valid' | 'missing'>('checking');

  // Auto-load videos from public/Video folder
  useEffect(() => {
    const loadVideosFromFolder = async () => {
      const videoFiles = [
        'videoplayback.mp4',
        'videoplayback (1).mp4',
        'videoplayback (2).mp4',
        'videoplayback (3).mp4',
        'videoplayback (4).mp4',
        'videoplayback (5).mp4',
        'videoplayback (6).mp4',
        'videoplayback (7).mp4',
        'videoplayback (8).mp4',
        'videoplayback (9).mp4',
        'videoplayback (10).mp4'
      ];

      const loadedVideos: VideoSource[] = [];

      for (const fileName of videoFiles) {
        try {
          const videoUrl = `/Video/${fileName}`;
          const videoId = `auto_${fileName.replace(/[^a-zA-Z0-9]/g, '_')}`;
          
          // Create video element to get duration directly
          const tempVideo = document.createElement('video');
          tempVideo.src = videoUrl;
          tempVideo.preload = 'metadata';
          
          const videoDuration = await new Promise<number>((resolve) => {
            const timeoutId = setTimeout(() => {
              console.log(`[App:loadVideosFromFolder] Timeout loading: ${fileName}`);
              tempVideo.remove();
              resolve(0);
            }, 5000);

            tempVideo.onloadedmetadata = () => {
              clearTimeout(timeoutId);
              const duration = tempVideo.duration;
              console.log(`[App:loadVideosFromFolder] Loaded ${fileName}, duration: ${duration}`);
              tempVideo.remove();
              resolve(duration);
            };
            
            tempVideo.onerror = () => {
              clearTimeout(timeoutId);
              console.log(`[App:loadVideosFromFolder] Error loading: ${fileName}`);
              tempVideo.remove();
              resolve(0);
            };
          });

          if (videoDuration > 0) {
            const videoSource: VideoSource = {
              id: videoId,
              title: fileName.replace('.mp4', ''),
              url: videoUrl,
              description: `Auto-loaded video: ${fileName}`,
              duration: videoDuration,
              thumbnailUrl: `https://picsum.photos/seed/${videoId}/160/90`
            };

            loadedVideos.push(videoSource);
            console.log(`[App:loadVideosFromFolder] Successfully loaded video: ${fileName}`);
          }
        } catch (error) {
          console.log(`[App:loadVideosFromFolder] Could not load video: ${fileName}`, error);
        }
      }

      console.log(`[App:loadVideosFromFolder] Total videos loaded: ${loadedVideos.length}`);
      setUserUploadedVideos(loadedVideos);
    };

    loadVideosFromFolder();
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
    const allVideos = [...videoSources, ...userUploadedVideos]; 
    return allVideos.find(v => v.id === videoId)?.title || 'Video Source';
  }, [videoSources, userUploadedVideos]);


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
    const allVideos = [...videoSources, ...userUploadedVideos]; 
    const videoToDrop = allVideos.find(v => v.id === videoId);

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
            tempVideo.onerror = reject;
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
            tempVideo.onerror = reject;
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
    const userMessage: ChatMessage = { id: `user_${Date.now()}`, sender: 'user', text: messageText };
    setGlobalChatHistory(prev => [...prev, userMessage]);
    setIsGlobalChatLoading(true);

    try {
        const aiResponse = await GeminiService.generalChat(messageText);
        setGlobalChatHistory(prev => [...prev, aiResponse]);
    } catch (error) {
      console.error("Error in global chat:", error);
      const errorResponse: ChatMessage = { id: `ai_err_${Date.now()}`, sender: 'ai', text: "Sorry, I encountered an error. Please try again." };
      setGlobalChatHistory(prev => [...prev, errorResponse]);
    } finally {
      setIsGlobalChatLoading(false);
    }
  };

  const handleSendVideoChatMessage = async (videoId: string, messageText: string) => {
    const userMessage: ChatMessage = { id: `user_${videoId}_${Date.now()}`, sender: 'user', text: messageText };
    setVideoChatHistories(prev => ({
      ...prev,
      [videoId]: [...(prev[videoId] || []), userMessage]
    }));
    setIsVideoChatLoading(prev => ({ ...prev, [videoId]: true }));

    try {
      const aiResponse = await GeminiService.analyzeVideoContent(videoId, messageText);
      setVideoChatHistories(prev => ({
        ...prev,
        [videoId]: [...(prev[videoId] || []), aiResponse]
      }));
    } catch (error) {
      console.error(`Error in chat for video ${videoId}:`, error);
      const errorResponse: ChatMessage = { id: `ai_err_${videoId}_${Date.now()}`, sender: 'ai', text: "Sorry, I had trouble analyzing that. Please try again." };
       setVideoChatHistories(prev => ({
        ...prev,
        [videoId]: [...(prev[videoId] || []), errorResponse]
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
    <div className="h-screen w-screen flex bg-gray-900 text-gray-100 fixed inset-0">
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
          <div className="bg-yellow-600 text-black p-2 text-center text-xs font-semibold flex items-center justify-center">
            <WarningIcon className="w-4 h-4 mr-2 text-yellow-900"/>
            Warning: API Key for Gemini is not configured. AI features will use mock data or may not function.
          </div>
        )}
        {apiKeyStatus === 'checking' && (
          <div className="bg-gray-700 text-white p-2 text-center text-xs font-semibold">
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
                // Handle timestamp click - could set video current time
                console.log(`Timestamp clicked: ${time}`);
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

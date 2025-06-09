
export interface VideoSegment {
  id: string;
  sourceVideoId: string;
  sourceVideoTitle: string;
  startTime: number; // in seconds
  endTime: number; // in seconds
  thumbnailUrl: string; // URL to a thumbnail image
}

export interface VideoSource {
  id: string;
  title: string;
  url: string; // URL to the video file (can be a remote URL for mocks, or an object URL for uploaded files)
  duration: number; // in seconds
  description?: string;
  thumbnailUrl:string;
  file?: File; // The actual file object for uploaded videos
}

export interface TabDefinition {
  id: string;
  title: string;
  type: 'workspace' | 'source';
  videoId?: string; // For source tabs, the ID of the video
  highlightSegment?: { start: number; end: number }; // For source tabs, to highlight a segment
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp?: number; // Optional, if AI response links to a video time
  timestampLinks?: Array<{ text: string; time: number }>;
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
  // Other types of chunks can be added here
}
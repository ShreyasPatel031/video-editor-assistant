export interface TabDefinition {
    id: string;
    title: string;
    type: 'workspace' | 'source';
    videoId?: string;
    highlightSegment?: { start: number; end: number };
}

export interface VideoSource {
    id: string;
    title: string;
    url: string;
    description?: string;
    duration: number;
    thumbnailUrl?: string;
    file?: File;
}

export interface VideoSegment {
    id: string;
    sourceVideoId: string;
    sourceVideoTitle: string;
    startTime: number;
    endTime: number;
    thumbnailUrl: string;
}

export interface ChatMessage {
    id: string;
    sender: 'user' | 'ai';
    text: string;
    timestampLinks?: GroundingChunk[];
}

export interface GroundingChunk {
    web?: {
        uri: string;
        title?: string;
    };
} 

export type Platform = 'instagram' | 'tiktok' | 'kwai' | 'youtube' | 'linkedin';
export type PostType = 'reel' | 'story' | 'feed' | 'shorts' | 'video';
export type VideoFormat = 'horizontal' | 'vertical' | 'square';
export type VideoStatus = 'pending' | 'ready' | 'approved' | 'processing' | 'published' | 'dismissed' | 'uploading' | 'error' | 'scheduled';

// --- USER & SETTINGS ---

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  role: 'admin' | 'user';
  status: 'active' | 'blocked';
  createdAt: string;
}

export interface ProjectStats {
  total: number;
  pendingReview: number; // Uploaded, waiting for approval/dismissal
  approved: number;      // Approved, waiting for distribution
  scheduledOrPublished: number; // Done
  discarded: number;     // Dismissed
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  clientName?: string; // Optional
  agencyName?: string; // Optional
  createdAt: string;
  videoCount: number; // Legacy total count, kept for compatibility but stats.total is preferred
  stats?: ProjectStats;
}

// Deprecated: Client interface is replaced by Project, but kept for type safety on old components if needed briefly
export interface Client {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
  videoCount: number;
}

export interface Integration {
  id: string;
  name: string;
  platform: Platform;
  connectedAt: string;
  config: {
    channelId?: string;
    apiKey?: string;
    clientId?: string;
    accessToken?: string;
    accountId?: string;
    appId?: string;
    expiresAt?: number; // Timestamp (ms) when token expires
  };
  stats?: {
    subscribers: number;
    views: number;
    videoCount: number;
    lastUpdated: string;
  };
}

export interface GlobalSettings {
  instagram?: {
    accessToken: string;
    accountId: string;
    appId: string;
    connectedAt: string;
  };
  integrations?: {
    tiktok: boolean;
    instagram: boolean;
  };
}

// --- VIDEO & DISTRIBUTION ---

export interface DistributionConfig {
  platform: Platform;
  accountId: string;
  postType: PostType;
  externalId?: string; // ID of the post on the external platform (e.g. YouTube Video ID)
  metadata: {
    title?: string;
    caption?: string;
    location?: string;
    collaborators?: string;
    tags?: string;
    playlistId?: string;
    categoryId?: string;
    chapters?: string;
    privacyStatus?: 'public' | 'unlisted' | 'private';
  };
}

export interface VideoAsset {
  id: string;
  userId: string;
  projectId?: string; // Link to the new Project structure
  
  // Basic Info
  title: string;
  url: string;
  thumbnailUrl?: string;
  storagePath: string;
  format: VideoFormat;
  fileSize: number;
  createdAt: string;
  
  // Client Info (Denormalized for Distribution view)
  clientName?: string;
  projectName?: string; // Denormalized for easier display
  clientId?: string; // Legacy support
  
  // Status
  status: VideoStatus;
  scheduledDate?: string;
  
  // Content Data
  transcription?: string;
  description?: string; 
  aiDescription?: string; // Legacy
  
  // Configuration
  distributionConfig?: DistributionConfig[];
  platforms?: Platform[]; 

  // Legacy Metadata Containers
  youtubeMetadata?: YouTubeMetadata;
  instagramMetadata?: SocialMetadata;
  tiktokMetadata?: SocialMetadata;
}

// --- ANALYTICS ---

export interface VideoAnalytics {
  id: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  channelTitle?: string;
  url: string;
}

export interface ChartData {
  name: string;
  fullTitle?: string;
  views: number;
  likes: number;
  revenue: number;
  platform?: Platform;
}

export interface InstagramStats {
  followers_count: number;
  media_count: number;
  id: string;
  username: string;
  profile_picture_url?: string;
}

export interface InstagramMedia {
  id: string;
  caption: string;
  media_type: string;
  media_url: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
  like_count: number;
  comments_count: number;
}

// --- LEGACY/SPECIFIC METADATA TYPES ---

export interface YouTubeMetadata {
  title: string;
  description: string;
  tags: string[];
  categoryId: string;
  playlistId?: string;
  privacyStatus: 'public' | 'unlisted' | 'private';
}

export interface SocialMetadata {
  caption: string;
}

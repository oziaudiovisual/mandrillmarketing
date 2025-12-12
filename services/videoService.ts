import { db, storage } from './firebase';
import { collection, addDoc, query, where, getDocs, doc, updateDoc, deleteDoc, increment, onSnapshot, getDoc, deleteField } from 'firebase/firestore';
// Using namespace import to fix potential module resolution issues
import * as firebaseStorage from 'firebase/storage';
import { VideoAsset, Platform, DistributionConfig, YouTubeMetadata, SocialMetadata, ProjectStats } from '../types';

const VIDEOS_COLLECTION = 'videos';
const PROJECTS_COLLECTION = 'projects';

// --- DATA MAPPING HELPER ---
const mapVideoDoc = (docSnap: any): VideoAsset => {
    const data = docSnap.data();
    return {
        id: docSnap.id,
        ...data,
        description: data.description || data.aiDescription || '',
    } as VideoAsset;
};

// --- HELPER: RECALCULATE PROJECT STATS ---
// This function ensures the project document always reflects accurate counts
const recalculateProjectStats = async (projectId: string) => {
    try {
        const q = query(collection(db, VIDEOS_COLLECTION), where("projectId", "==", projectId));
        const snapshot = await getDocs(q);
        const videos = snapshot.docs.map(mapVideoDoc);

        const stats: ProjectStats = {
            total: videos.length,
            pendingReview: 0,
            approved: 0,
            scheduledOrPublished: 0,
            discarded: 0
        };

        videos.forEach(v => {
            if (v.status === 'dismissed') {
                stats.discarded++;
            } else if (v.status === 'published' || v.status === 'scheduled') {
                stats.scheduledOrPublished++;
            } else if (v.status === 'approved') {
                stats.approved++;
            } else {
                // pending, ready, transcribing, error, uploading
                stats.pendingReview++;
            }
        });

        const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
        await updateDoc(projectRef, { 
            videoCount: stats.total, // Keep legacy field in sync
            stats: stats 
        });

    } catch (error) {
        console.error(`Failed to recalculate stats for project ${projectId}`, error);
    }
};

// --- READ OPERATIONS ---

export const getAllUserVideos = async (userId: string): Promise<VideoAsset[]> => {
  const q = query(collection(db, VIDEOS_COLLECTION), where("userId", "==", userId));
  const querySnapshot = await getDocs(q);
  const videos = querySnapshot.docs.map(mapVideoDoc);
  return videos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

// Updated: Fetch videos for a specific Project
export const getProjectVideos = async (projectId: string): Promise<VideoAsset[]> => {
  const q = query(collection(db, VIDEOS_COLLECTION), where("projectId", "==", projectId));
  const querySnapshot = await getDocs(q);
  const videos = querySnapshot.docs.map(mapVideoDoc);
  return videos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

// --- SUBSCRIPTIONS (REAL-TIME) ---

export const subscribeToDistributionVideos = (userId: string, callback: (videos: VideoAsset[]) => void) => {
  const q = query(
    collection(db, VIDEOS_COLLECTION), 
    where("userId", "==", userId),
    where("status", "in", ["approved"])
  );
  
  return onSnapshot(q, (querySnapshot) => {
    const videos = querySnapshot.docs.map(mapVideoDoc);
    const sorted = videos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    callback(sorted);
  });
};

export const subscribeToAllScheduledVideos = (userId: string, callback: (videos: VideoAsset[]) => void) => {
    const q = query(collection(db, VIDEOS_COLLECTION), where("userId", "==", userId));
    
    return onSnapshot(q, (querySnapshot) => {
      const videos = querySnapshot.docs.map(mapVideoDoc);
      const scheduled = videos.filter(v => 
          v.scheduledDate || 
          v.status === 'scheduled' ||
          v.status === 'published'
      );
      callback(scheduled);
    });
};

export const subscribeToTrafficVideos = (userId: string, callback: (videos: VideoAsset[]) => void) => {
  const q = query(
    collection(db, VIDEOS_COLLECTION), 
    where("userId", "==", userId),
    where("status", "in", ["published", "scheduled"])
  );
  
  return onSnapshot(q, (querySnapshot) => {
    const videos = querySnapshot.docs.map(mapVideoDoc);
    const sorted = videos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    callback(sorted);
  });
};

// --- WRITE OPERATIONS ---

export const saveVideoMetadata = async (videoData: Omit<VideoAsset, 'id'>): Promise<VideoAsset> => {
  const payload = { ...videoData };
  if (payload.aiDescription && !payload.description) {
      payload.description = payload.aiDescription;
  }

  const docRef = await addDoc(collection(db, VIDEOS_COLLECTION), payload);
  
  // Recalculate stats instead of simple increment
  if (videoData.projectId) {
      await recalculateProjectStats(videoData.projectId);
  }
  
  return { id: docRef.id, ...payload } as VideoAsset;
};

export const updateVideoTitle = async (videoId: string, title: string) => {
  const videoRef = doc(db, VIDEOS_COLLECTION, videoId);
  await updateDoc(videoRef, { title });
};

export const updateVideoDescription = async (videoId: string, description: string) => {
    const videoRef = doc(db, VIDEOS_COLLECTION, videoId);
    await updateDoc(videoRef, {
        description: description,
        aiDescription: description 
    });
};

export const updateVideoTranscription = async (videoId: string, transcription: string) => {
  const videoRef = doc(db, VIDEOS_COLLECTION, videoId);
  await updateDoc(videoRef, { transcription });
};

export const updateVideoPlatforms = async (videoId: string, platforms: Platform[]) => {
  const videoRef = doc(db, VIDEOS_COLLECTION, videoId);
  await updateDoc(videoRef, { platforms });
};

export const updateVideoDistributionConfig = async (videoId: string, config: DistributionConfig[]) => {
  const videoRef = doc(db, VIDEOS_COLLECTION, videoId);
  await updateDoc(videoRef, { distributionConfig: config });
};

export const updateVideoMetadata = async (
  videoId: string, 
  metadata: { 
    youtube?: YouTubeMetadata, 
    instagram?: SocialMetadata, 
    tiktok?: SocialMetadata 
  }
) => {
  const videoRef = doc(db, VIDEOS_COLLECTION, videoId);
  const updates: any = {};
  if (metadata.youtube) updates.youtubeMetadata = metadata.youtube;
  if (metadata.instagram) updates.instagramMetadata = metadata.instagram;
  if (metadata.tiktok) updates.tiktokMetadata = metadata.tiktok;

  await updateDoc(videoRef, updates);
};

// --- STATUS ACTIONS ---

export const approveVideo = async (videoId: string) => {
  const videoRef = doc(db, VIDEOS_COLLECTION, videoId);
  await updateDoc(videoRef, { status: 'approved' });
  
  const snap = await getDoc(videoRef);
  if (snap.exists() && snap.data().projectId) {
      await recalculateProjectStats(snap.data().projectId);
  }
};

export const dismissVideo = async (videoId: string) => {
  const videoRef = doc(db, VIDEOS_COLLECTION, videoId);
  await updateDoc(videoRef, { status: 'dismissed' });

  const snap = await getDoc(videoRef);
  if (snap.exists() && snap.data().projectId) {
      await recalculateProjectStats(snap.data().projectId);
  }
};

export const unapproveVideo = async (videoId: string) => {
  const videoRef = doc(db, VIDEOS_COLLECTION, videoId);
  await updateDoc(videoRef, { status: 'pending' });

  const snap = await getDoc(videoRef);
  if (snap.exists() && snap.data().projectId) {
      await recalculateProjectStats(snap.data().projectId);
  }
};

export const markVideoAsProcessing = async (videoId: string, configs: DistributionConfig[], scheduledDate?: string) => {
  const videoRef = doc(db, VIDEOS_COLLECTION, videoId);
  const newStatus = scheduledDate ? 'scheduled' : 'published';
  const platforms = configs.map(c => c.platform);

  const updates: any = {
      status: newStatus,
      platforms: platforms,
      distributionConfig: configs
  };

  if (scheduledDate) {
      updates.scheduledDate = scheduledDate;
  } else {
      updates.scheduledDate = new Date().toISOString();
  }

  await updateDoc(videoRef, updates);

  const snap = await getDoc(videoRef);
  if (snap.exists() && snap.data().projectId) {
      await recalculateProjectStats(snap.data().projectId);
  }
};

export const cancelVideoScheduling = async (videoId: string) => {
  const videoRef = doc(db, VIDEOS_COLLECTION, videoId);
  
  // Need to clear externalId from distributionConfig so we don't try to delete again or have stale refs
  const snap = await getDoc(videoRef);
  let distributionConfig: DistributionConfig[] = [];
  
  if (snap.exists()) {
      distributionConfig = snap.data().distributionConfig || [];
      // Clear externalIds
      distributionConfig = distributionConfig.map(c => {
          const { externalId, ...rest } = c;
          return rest as DistributionConfig;
      });
  }

  await updateDoc(videoRef, {
    status: 'approved',
    scheduledDate: deleteField(),
    distributionConfig: distributionConfig // Save cleaned config
  });

  if (snap.exists() && snap.data().projectId) {
      await recalculateProjectStats(snap.data().projectId);
  }
};

export const deleteVideo = async (videoId: string, storagePath?: string) => {
  try {
    const videoRef = doc(db, VIDEOS_COLLECTION, videoId);
    const videoSnap = await getDoc(videoRef);
    let projectId = '';

    if (videoSnap.exists()) {
      projectId = videoSnap.data().projectId;
    }

    if (storagePath) {
      try {
        const fileRef = firebaseStorage.ref(storage, storagePath);
        await firebaseStorage.deleteObject(fileRef);
      } catch (storageError: any) {
        if (storageError.code !== 'storage/object-not-found') {
          console.warn(`Could not delete file (${storagePath}):`, storageError);
        }
      }
    }

    await deleteDoc(videoRef);

    if (projectId) {
      await recalculateProjectStats(projectId);
    }

  } catch (error) {
    console.error("Error deleting video:", error);
    throw error;
  }
};
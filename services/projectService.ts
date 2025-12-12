
import { db } from './firebase';
import { collection, addDoc, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { Project } from '../types';

const PROJECTS_COLLECTION = 'projects';

export const getProjects = async (userId: string): Promise<Project[]> => {
  // Query only by userId to avoid needing a composite index with createdAt
  const q = query(
    collection(db, PROJECTS_COLLECTION), 
    where("userId", "==", userId)
  );
  
  const querySnapshot = await getDocs(q);
  const projects = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Project));

  // Sort client-side
  return projects.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const createProject = async (
  userId: string, 
  name: string, 
  clientName?: string, 
  agencyName?: string
): Promise<Project> => {
  const payload = {
    userId,
    name,
    clientName: clientName || '',
    agencyName: agencyName || '',
    createdAt: new Date().toISOString(),
    videoCount: 0,
    stats: {
        total: 0,
        pendingReview: 0,
        approved: 0,
        scheduledOrPublished: 0,
        discarded: 0
    }
  };

  const docRef = await addDoc(collection(db, PROJECTS_COLLECTION), payload);
  
  return {
    id: docRef.id,
    ...payload
  };
};

export const updateProject = async (projectId: string, data: Partial<Project>) => {
  const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
  await updateDoc(projectRef, data);
};

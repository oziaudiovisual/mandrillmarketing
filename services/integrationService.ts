import { db } from './firebase';
import { collection, addDoc, getDocs, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { Integration } from '../types';

const INTEGRATIONS_COLLECTION = 'integrations';

export const addIntegration = async (integrationData: Omit<Integration, 'id'>): Promise<Integration> => {
  const docRef = await addDoc(collection(db, INTEGRATIONS_COLLECTION), integrationData);
  return {
    id: docRef.id,
    ...integrationData
  };
};

export const getIntegrations = async (): Promise<Integration[]> => {
  const querySnapshot = await getDocs(collection(db, INTEGRATIONS_COLLECTION));
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Integration));
};

export const deleteIntegration = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, INTEGRATIONS_COLLECTION, id));
};

export const updateIntegrationStats = async (id: string, stats: Integration['stats']) => {
  const docRef = doc(db, INTEGRATIONS_COLLECTION, id);
  await updateDoc(docRef, { stats });
};

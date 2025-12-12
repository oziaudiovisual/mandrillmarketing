import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { GlobalSettings } from '../types';

const SETTINGS_COLLECTION = 'settings';
const GLOBAL_DOC_ID = 'global';

export const getGlobalSettings = async (): Promise<GlobalSettings | null> => {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, GLOBAL_DOC_ID);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as GlobalSettings;
    }
    return null;
  } catch (error) {
    console.error("Error fetching global settings:", error);
    return null;
  }
};

export const updateGlobalSettings = async (data: Partial<GlobalSettings>): Promise<void> => {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, GLOBAL_DOC_ID);
    await setDoc(docRef, data, { merge: true });
  } catch (error) {
    console.error("Error updating global settings:", error);
    throw error;
  }
};

export const clearGlobalIntegration = async (key: keyof GlobalSettings): Promise<void> => {
    try {
        const docRef = doc(db, SETTINGS_COLLECTION, GLOBAL_DOC_ID);
        // We set the specific field to null or delete it logic
        // For merge: true, sending { [key]: deleteField() } is better but let's just nullify properties inside or reset object
        // Simple approach: set it to null or empty object if your type supports it, otherwise specific logic
        
        // Since we want to keep other settings, we need to read first or use dot notation update if not nested
        // But Firestore update with dot notation works best
        
        // Simulating "deletion" by passing null for that specific integration key requires the field to be nullable in types or handled loosely
        // We will pass an empty object or null using 'any' casting for flexibility here
        await setDoc(docRef, { [key]: null }, { merge: true });

    } catch (error) {
        console.error(`Error clearing ${key}:`, error);
        throw error;
    }
}
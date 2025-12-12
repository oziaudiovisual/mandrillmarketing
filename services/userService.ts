import { db, firebaseConfig } from './firebase';
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy, setDoc } from 'firebase/firestore';
import { UserProfile } from '../types';

export const getAllUsers = async (): Promise<UserProfile[]> => {
  const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as UserProfile);
};

/**
 * Creates a new user in Firebase Auth and Firestore without logging out the current admin.
 * Uses a secondary Firebase App instance.
 */
export const createUserSystem = async (email: string, password: string, displayName: string, role: 'admin' | 'user') => {
  // 1. Initialize a secondary app to avoid changing the current user's auth state
  const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
  const secondaryAuth = getAuth(secondaryApp);

  try {
    // 2. Create Authentication User
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const uid = userCredential.user.uid;

    // 3. Create Firestore Profile (Using the main app's Firestore 'db')
    const userProfile: UserProfile = {
      uid: uid,
      email: email,
      displayName: displayName,
      role: role,
      status: 'active',
      createdAt: new Date().toISOString()
    };

    await setDoc(doc(db, "users", uid), userProfile);

    // 4. Cleanup: Sign out the secondary user and return
    await signOut(secondaryAuth);
    return userProfile;

  } catch (error: any) {
    console.error("Error creating user:", error);
    throw error;
  }
  // Note: We leave the secondary app initialized, but that's fine for the lifecycle of the admin session.
};

export const updateUserDetails = async (uid: string, data: { displayName?: string, role?: 'admin' | 'user', status?: 'active' | 'blocked' }) => {
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, data);
};

export const toggleUserStatus = async (uid: string, currentStatus: 'active' | 'blocked') => {
  const newStatus = currentStatus === 'active' ? 'blocked' : 'active';
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, {
    status: newStatus
  });
  return newStatus;
};

export const deleteUserSystem = async (uid: string) => {
  // Note: This only deletes the Firestore record. 
  // To delete from Firebase Auth, you typically need the Admin SDK (backend).
  // Deleting the profile prevents access due to AuthContext checks.
  const userRef = doc(db, "users", uid);
  await deleteDoc(userRef);
};
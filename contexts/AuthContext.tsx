import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { doc, getDoc, setDoc, getDocs, collection, limit, query } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  isAdmin: boolean;
  loading: boolean;
  signup: (email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          // 1. Check if User Profile exists in Firestore
          const docRef = doc(db, "users", currentUser.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const profile = docSnap.data() as UserProfile;
            
            // Check Blocked Status
            if (profile.status === 'blocked') {
                await signOut(auth);
                alert("Sua conta foi bloqueada pelo administrador.");
                setUser(null);
                setUserProfile(null);
                setLoading(false);
                return;
            }

            setUser(currentUser);
            setUserProfile(profile);
          } else {
            // 2. Profile doesn't exist (New User). Determine Role.
            const usersRef = collection(db, "users");
            const q = query(usersRef, limit(1));
            const querySnapshot = await getDocs(q);
            
            // If DB is empty, this is the first user => Admin. Else => User.
            const isFirstUser = querySnapshot.empty;
            const newRole = isFirstUser ? 'admin' : 'user';

            const newProfile: UserProfile = {
              uid: currentUser.uid,
              email: currentUser.email || '',
              displayName: currentUser.displayName || '', // Default to Auth displayName if available
              role: newRole,
              status: 'active',
              createdAt: new Date().toISOString()
            };

            await setDoc(docRef, newProfile);
            setUser(currentUser);
            setUserProfile(newProfile);
          }
        } catch (error) {
          console.error("Auth Profile Error:", error);
          setUser(null);
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signup = async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email, password);
    // Profile creation handled by onAuthStateChanged
  };

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setUserProfile(null);
  };

  return (
    <AuthContext.Provider value={{ 
        user, 
        userProfile, 
        isAdmin: userProfile?.role === 'admin',
        loading, 
        signup, 
        login, 
        logout 
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
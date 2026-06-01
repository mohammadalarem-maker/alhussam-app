import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signInWithEmailAndPassword,
  GoogleAuthProvider, 
  signOut, 
  User,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, getDoc, setDoc, query, where, getDocs, collection, limit, updateDoc, deleteDoc } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  role: string | null;
  status: string | null;
  login: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          // Role sync logic:
          // 1. Check if user is owner
          // 2. Check if user is pre-registered in 'users' collection by email
          
          const isAdminEmail = firebaseUser.email?.trim().toLowerCase() === 'faremazen3@gmail.com';
          const userEmail = firebaseUser.email?.trim().toLowerCase();
          
          let preRegisteredDoc: any = null;
          if (userEmail) {
            try {
              const q = query(collection(db, 'users'), where('email', '==', userEmail), limit(1));
              const querySnap = await getDocs(q);
              if (!querySnap.empty) {
                preRegisteredDoc = querySnap.docs[0];
              }
            } catch (queryErr) {
              console.error("Error checking user registration:", queryErr);
            }
          }

          const now = new Date().toISOString();
          
          if (preRegisteredDoc || isAdminEmail) {
            const userData = preRegisteredDoc?.data() || {};
            if (userData.status === 'suspended') {
              await signOut(auth);
              setUser(null);
              setRole(null);
              setStatus('suspended');
              setLoading(false);
              return;
            }

            const updatedRole = isAdminEmail ? 'admin' : (userData.role || 'sales');
            const userStatus = userData.status || 'active';
            
            // Migrate document to use the user's UID as document ID so that firestore.rules can read it at /users/{userId}
            if (preRegisteredDoc) {
              const userData = preRegisteredDoc.data() || {};
              const userDocRef = doc(db, 'users', firebaseUser.uid);
              
              // We set the document at the real UID path
              await setDoc(userDocRef, {
                ...userData,
                uid: firebaseUser.uid,
                lastLogin: now,
                displayName: firebaseUser.displayName || userData.displayName || '',
                email: userEmail
              }, { merge: true });

              // If the old pre-registered document ID wasn't the UID, delete it to prevent duplicates
              if (preRegisteredDoc.id !== firebaseUser.uid) {
                try {
                  await deleteDoc(preRegisteredDoc.ref);
                  console.log(`Successfully migrated user document ID from ${preRegisteredDoc.id} to UID ${firebaseUser.uid}`);
                } catch (delError) {
                  console.error("Failed to delete stale user document, but migration succeeded:", delError);
                }
              }
            } else if (isAdminEmail) {
              // Create owner doc if missing
              const userDocRef = doc(db, 'users', firebaseUser.uid);
              await setDoc(userDocRef, {
                email: userEmail,
                role: 'admin',
                status: 'active',
                displayName: firebaseUser.displayName || 'Owner',
                createdAt: now,
                lastLogin: now,
                uid: firebaseUser.uid
              }, { merge: true });
            }
            
            setUser(firebaseUser);
            setRole(updatedRole);
            setStatus(userStatus);
          } else {
            // User not pre-registered by admin - reject
            await signOut(auth);
            setUser(null);
            setRole(null);
            setStatus('unauthorized');
          }
        } else {
          setUser(null);
          setRole(null);
          setStatus(null);
        }
      } catch (err) {
        console.error("Auth state handling error:", err);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const loginWithEmail = async (email: string, password: string) => {
    // Before signing in, we theoretically want to check if the user is allowed.
    // But we can't query Firestore for the user if we aren't signed in (usually).
    // So we sign in first, and the onAuthStateChanged will kick them out if not allowed.
    await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    await signOut(auth);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  return (
    <AuthContext.Provider value={{ user, loading, role, status, login, loginWithEmail, logout, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

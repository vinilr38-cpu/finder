import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc 
} from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  // Real-time listener for Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Fetch user profile from Firestore users/{uid}
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const firestoreData = userDocSnap.data();
            const fullProfile = {
              id: firebaseUser.uid,
              uid: firebaseUser.uid,
              ...firestoreData
            };
            setUser(fullProfile);
            setRole(firestoreData.role || 'customer');
          } else {
            // Default profile fallback if Firestore document does not exist yet
            const defaultProfile = {
              id: firebaseUser.uid,
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              name: firebaseUser.displayName || 'User',
              role: 'customer',
              createdAt: Date.now()
            };
            setUser(defaultProfile);
            setRole('customer');
          }
        } catch (error) {
          console.error('Error fetching Firestore user profile:', error);
          setUser({
            id: firebaseUser.uid,
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            name: firebaseUser.displayName || 'User',
            role: 'customer'
          });
          setRole('customer');
        }
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 1. Sign Up: creates Firebase Auth account and stores full profile in Firestore users/{uid}
  const signup = async (email, password, profileData) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;

    const assignedRole = profileData.role || 'customer';

    // Base profile document
    const userProfile = {
      uid: firebaseUser.uid,
      id: firebaseUser.uid,
      name: profileData.name.trim(),
      email: firebaseUser.email,
      role: assignedRole,
      createdAt: Date.now(),
      ...(assignedRole === 'provider' ? {
        serviceCategory: profileData.serviceCategory || 'Plumber',
        price: Number(profileData.price) || 500,
        phone: profileData.phone?.trim() || '',
        isOnline: true, // Default isOnline: true for providers
        lat: profileData.lat !== undefined && profileData.lat !== null && !isNaN(Number(profileData.lat))
          ? Number(profileData.lat)
          : 17.385044,
        lng: profileData.lng !== undefined && profileData.lng !== null && !isNaN(Number(profileData.lng))
          ? Number(profileData.lng)
          : 78.486671
      } : {})
    };

    // Save full profile to Firestore users collection using Firebase Auth uid as doc ID
    await setDoc(doc(db, 'users', firebaseUser.uid), userProfile);

    setUser(userProfile);
    setRole(assignedRole);
    return userProfile;
  };

  // 2. Login: signs in with Email and Password, then loads users/{uid} from Firestore
  const login = async (email, password) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;

    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const userDocSnap = await getDoc(userDocRef);

    let userProfile;
    if (userDocSnap.exists()) {
      userProfile = {
        id: firebaseUser.uid,
        uid: firebaseUser.uid,
        ...userDocSnap.data()
      };
    } else {
      userProfile = {
        id: firebaseUser.uid,
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        name: firebaseUser.displayName || 'User',
        role: 'customer',
        createdAt: Date.now()
      };
      await setDoc(userDocRef, userProfile);
    }

    setUser(userProfile);
    setRole(userProfile.role || 'customer');
    return userProfile;
  };

  // 3. Logout: signs out from Firebase
  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setRole(null);
  };

  const value = {
    user,
    role,
    loading,
    isAuthenticated: Boolean(user),
    signup,
    login,
    logout,
    setRole
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

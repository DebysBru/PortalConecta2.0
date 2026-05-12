'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getUserRole, ensureUser } from '@/actions/admin';
import { UserRole } from '@prisma/client';

type AuthState = {
  user: FirebaseUser | null;
  userRole: UserRole | null;
  supabaseUserId: string | null;
  isMasterAdmin: boolean;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

const MASTER_ADMIN_EMAIL = 'bru.mkt2024@gmail.com';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [supabaseUserId, setSupabaseUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser?.email) {
        try {
          const { id, role } = await ensureUser(firebaseUser.email, firebaseUser.displayName ?? undefined);
          setUserRole(role);
          setSupabaseUserId(id);
        } catch {
          // DB unreachable — derive role from email so master admin can still access the panel
          const fallbackRole: UserRole | null =
            firebaseUser.email === MASTER_ADMIN_EMAIL ? 'ADMINISTRADOR' : null;
          setUserRole(fallbackRole);
        }
      } else {
        setUserRole(null);
        setSupabaseUserId(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUserRole(null);
    setSupabaseUserId(null);
  };

  const isMasterAdmin = user?.email === MASTER_ADMIN_EMAIL;
  const isAdmin = userRole === 'ADMINISTRADOR' || userRole === 'EDITOR_IFIZINHA' || userRole === 'EQUIPE_PROJETO';

  return (
    <AuthContext.Provider value={{
      user, userRole, supabaseUserId,
      isMasterAdmin, isAdmin,
      loading, signIn, signInWithGoogle, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

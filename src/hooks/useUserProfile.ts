// src/hooks/useUserProfile.ts
import { useEffect, useMemo, useState, useCallback } from 'react';
import { onSnapshot, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { ensureUserProfile } from '../services/statsElo.service';

export type UserRole = 'player' | 'referee' | 'admin';

export type UserProfile = {
  email: string;
  displayName?: string;
  role?: UserRole;
  isActive?: boolean;
  updatedAt?: any;
};

export function useUserProfile() {
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // Suivre l'auth pour (re)abonner le snapshot quand l'utilisateur change
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUid(u?.uid ?? null);
    });
    return unsubAuth;
  }, []);

  // Abonnement live au document /users/{uid}
  useEffect(() => {
    if (!uid) {
      setProfile(null);
      setLoading(false);
      return;
    }
    ensureUserProfile(uid).catch((e) => setError(e as Error));
    setLoading(true);
    const ref = doc(db, 'users', uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setProfile((snap.exists() ? (snap.data() as UserProfile) : null));
        setLoading(false);
      },
      (e) => {
        setError(e as Error);
        setLoading(false);
      }
    );
    return unsub;
  }, [uid]);

  // Upsert générique (utile si le doc n'existe pas encore)
  const upsertProfile = useCallback(
    async (partial: Partial<UserProfile>) => {
      if (!uid) throw new Error('Not authenticated');
      const ref = doc(db, 'users', uid);
      await setDoc(
        ref,
        { ...partial, updatedAt: serverTimestamp() },
        { merge: true }
      );
    },
    [uid]
  );

  // Setter de rôle (crée le doc si nécessaire)
  const setUserRole = useCallback(
    async (next: UserRole) => {
      if (!uid) throw new Error('Not authenticated');
      const ref = doc(db, 'users', uid);
      // tente update, sinon set (au cas où le doc n'existe pas)
      try {
        await updateDoc(ref, { role: next, updatedAt: serverTimestamp() });
      } catch {
        await setDoc(ref, { role: next, updatedAt: serverTimestamp() }, { merge: true });
      }
    },
    [uid]
  );

  // Helper pour le switch "Je suis arbitre"
  const toggleReferee = useCallback(async (value: boolean) => {
    await setUserRole(value ? 'referee' : 'player');
  }, [setUserRole]);

  return useMemo(
    () => ({ uid, profile, loading, error, upsertProfile, setUserRole, toggleReferee }),
    [uid, profile, loading, error, upsertProfile, setUserRole, toggleReferee]
  );
}

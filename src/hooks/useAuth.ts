import { useCallback, useEffect, useState } from 'react';
import { auth, db } from '../services/firebase';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { DEFAULT_ELO, DEFAULT_STATS } from '../services/statsElo.service';

export function useAuth() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const signInEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }, []);

  const signUpEmail = useCallback(async (email: string, password: string, pseudo?: string, isReferee?: boolean) => {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    if (pseudo) {
      await updateProfile(cred.user, { displayName: pseudo });
    }

    // Create or merge a profile document for this user
    await setDoc(
      doc(db, 'users', cred.user.uid),
      {
        email: cred.user.email ?? email.trim(),
        displayName: pseudo || cred.user.displayName || email.split('@')[0],
        role: isReferee ? 'referee' : 'player',
        isActive: true,
        elo: DEFAULT_ELO,
        stats: DEFAULT_STATS,
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  return { user, loading, signInEmail, signUpEmail, logout };
}

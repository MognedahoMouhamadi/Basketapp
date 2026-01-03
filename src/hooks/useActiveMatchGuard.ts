// src/hooks/useActiveMatchGuard.ts
import { collectionGroup, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';

// Returns true if user is already in an active match (open or running)
export async function hasActiveMatch(uid: string): Promise<boolean> {
  if (!uid) return false;
  const q = query(collectionGroup(db, 'participants'), where('uid', '==', uid));
  const snap = await getDocs(q);
  if (snap.empty) return false;
  const matchRefs = snap.docs
    .map((docSnap) => docSnap.ref.parent.parent)
    .filter(Boolean);
  const matchSnaps = await Promise.all(matchRefs.map((ref) => getDoc(ref!)));
  return matchSnaps.some((m) => {
    if (!m.exists()) return false;
    const status = (m.data() as any)?.status;
    return status === 'open' || status === 'running';
  });
}

// src/hooks/useActiveMatchGuard.ts
import { collectionGroup, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { normalizeMatchStatus } from '../services/matchStatus';

// Returns true if user is already in an active match (open or running)
export async function hasActiveMatch(uid: string): Promise<boolean> {
  if (!uid) return false;
  try {
    const q = query(collectionGroup(db, 'participants'), where('uid', '==', uid));
    const snap = await getDocs(q);
    if (snap.empty) return false;
    const matchRefs = snap.docs
      .map((docSnap) => docSnap.ref.parent.parent)
      .filter(Boolean);
    const matchSnaps = await Promise.all(matchRefs.map((ref) => getDoc(ref!)));
    return matchSnaps.some((m) => {
      if (!m.exists()) return false;
      const status = normalizeMatchStatus((m.data() as any)?.status);
      return status === 'open' || status === 'running';
    });
  } catch (err: any) {
    if (err?.code === 'failed-precondition') {
      console.warn('hasActiveMatch index missing, skipping guard');
      return false;
    }
    throw err;
  }
}

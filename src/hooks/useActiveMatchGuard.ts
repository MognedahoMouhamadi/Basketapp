// src/hooks/useActiveMatchGuard.ts
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';

// Returns true if user is already in an active match (open or running)
export async function hasActiveMatch(uid: string): Promise<boolean> {
  if (!uid) return false;
  const q = query(
    collection(db, 'matches'),
    where('status', 'in', ['open', 'running'])
  );
  const snap = await getDocs(q);
  return snap.docs.some((docSnap) => {
    const data = docSnap.data() as any;
    const playersA: any[] = Array.isArray(data.playersA) ? data.playersA : [];
    const playersB: any[] = Array.isArray(data.playersB) ? data.playersB : [];
    return (
      playersA.some((p) => p?.uid === uid) ||
      playersB.some((p) => p?.uid === uid)
    );
  });
}

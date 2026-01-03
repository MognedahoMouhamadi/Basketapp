// src/hooks/listenOpenMatches.ts
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';

export function listenOpenMatches(
  onChange: (docs: any[]) => void,
  onError?: (e: any) => void
) {
  const ref = collection(db, 'matches');
  const q = query(
    ref,
    where('status', '==', 'open'),
    where('visibility', '==', 'open'),
    orderBy('createdAtClient', 'desc'),
    limit(50)
  );

  return onSnapshot(q, (snap) => {
    const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
    onChange(list);
  }, onError);
}


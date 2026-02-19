// scripts/backfillMatchPlayers.ts
// One-off maintenance script to normalize playersA/playersB entries
// - Ensures each player object has a non-empty displayName
// - Never writes serverTimestamp() inside arrays
// - Keeps updatedAt untouched here (optional to set at root if desired)

import { collection, doc, getDocs, limit, query, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../src/services/firebase';

type Player = { uid?: string; displayName?: string; joinedAt?: number } | string;

async function lookupDisplayName(uid: string): Promise<string | undefined> {
  try {
    const fallbackDisplayName = undefined;
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) return fallbackDisplayName;

    const data = snap.data() as any;
    return data?.displayName ?? fallbackDisplayName;
  } catch {
    return undefined;
  }
}

function normalizePlayer(p: Player): Player {
  if (typeof p === 'string') return p; // legacy string format, keep as-is
  if (!p) return p;
  const uid = String((p as any)?.uid ?? '').trim();
  const displayName = String(((p as any)?.displayName ?? '').trim());
  return {
    ...p,
    uid,
    displayName: displayName || 'Anonyme',
  } as any;
}

async function backfill() {
  const q = query(collection(db, 'matches'), limit(500));
  const snap = await getDocs(q);

  for (const docSnap of snap.docs) {
    const data = docSnap.data() as any;
    const A: Player[] = Array.isArray(data?.playersA) ? data.playersA.slice() : [];
    const B: Player[] = Array.isArray(data?.playersB) ? data.playersB.slice() : [];

    let changed = false;
    for (let i = 0; i < A.length; i++) {
      const p = A[i];
      if (typeof p !== 'string') {
        const dn = (p?.displayName ?? '').trim();
        if (!dn) {
          const guess = p?.uid ? (await lookupDisplayName(String(p.uid))) : undefined;
          A[i] = { ...p, displayName: guess || 'Anonyme' } as any;
          changed = true;
        }
      }
    }
    for (let i = 0; i < B.length; i++) {
      const p = B[i];
      if (typeof p !== 'string') {
        const dn = (p?.displayName ?? '').trim();
        if (!dn) {
          const guess = p?.uid ? (await lookupDisplayName(String(p.uid))) : undefined;
          B[i] = { ...p, displayName: guess || 'Anonyme' } as any;
          changed = true;
        }
      }
    }

    if (changed) {
      await updateDoc(doc(db, 'matches', docSnap.id), {
        playersA: A,
        playersB: B,
      });
      // eslint-disable-next-line no-console
      console.log('Backfilled', docSnap.id);
    }
  }
}

backfill()
  .then(() => {
    // eslint-disable-next-line no-console
    console.log('Backfill completed');
  })
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error('Backfill failed', e);
    process.exit(1);
  });

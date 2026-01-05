// scripts/backfillUserElo.ts
import {
  collection,
  getDocs,
  orderBy,
  query,
  startAfter,
  limit,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../src/services/firebase';
import { DEFAULT_ELO } from '../src/services/statsElo.service';

const BATCH_SIZE = 500;

async function backfillElo() {
  let lastDoc: any = null;
  let totalUpdated = 0;

  while (true) {
    const q = lastDoc
      ? query(collection(db, 'users'), orderBy('__name__'), startAfter(lastDoc), limit(BATCH_SIZE))
      : query(collection(db, 'users'), orderBy('__name__'), limit(BATCH_SIZE));

    const snap = await getDocs(q);
    if (snap.empty) break;

    const batch = writeBatch(db);
    let batchUpdates = 0;

    for (const docSnap of snap.docs) {
      const data = docSnap.data() as any;
      if (typeof data?.elo !== 'number') {
        batch.set(docSnap.ref, { elo: DEFAULT_ELO }, { merge: true });
        batchUpdates += 1;
      }
    }

    if (batchUpdates > 0) {
      await batch.commit();
      totalUpdated += batchUpdates;
      // eslint-disable-next-line no-console
      console.log('Backfilled batch', batchUpdates);
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < BATCH_SIZE) break;
  }

  // eslint-disable-next-line no-console
  console.log('Backfill completed', totalUpdated);
}

backfillElo().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('Backfill failed', e);
  process.exit(1);
});

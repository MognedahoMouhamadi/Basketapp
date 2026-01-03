// src/hooks/useSaveMatch.ts
// Minimal Firestore writer for match recaps with dynamic imports.

type Stats = Record<string, { points?: number; fouls?: number; blocks?: number }>;

export type SaveMatchInput = {
  name?: string;
  place?: string;
  format?: '3v3'|'4v4'|'5v5'|string;
  playersA: string[];
  playersB: string[];
  stats: Stats;
  ts?: number; // override timestamp if needed
};

export async function saveMatchToFirestore(input: SaveMatchInput): Promise<string | null> {
  const { name = 'Match', place, format, playersA, playersB, stats } = input;
  const ts = input.ts ?? Date.now();

  const sum = (ids: string[]) => ids.reduce((acc, id) => acc + (stats[id]?.points ?? 0), 0);
  const scoreA = sum(playersA);
  const scoreB = sum(playersB);

  const matchDoc = {
    name,
    place: place ?? null,
    format: format ?? null,
    ts,
    status: 'closed' as const,
    playersA,
    playersB,
    scoreA,
    scoreB,
  } as const;

  // Try React Native Firebase first
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const rnfb = await (Function('return import("@react-native-firebase/firestore")')() as Promise<any>);
    const firestore = rnfb?.default?.();
    if (firestore) {
      const mRef = await firestore.collection('matches').add(matchDoc);
      const batch = firestore.batch();
      const playersRef = mRef.collection('players');

      const push = (playerId: string, team: 'A' | 'B') => {
        const st = stats[playerId] ?? {};
        const ref = playersRef.doc(playerId);
        batch.set(ref, {
          playerId,
          team,
          points: st.points ?? 0,
          fouls: st.fouls ?? 0,
          blocks: st.blocks ?? 0,
        });
      };
      playersA.forEach(id => push(id, 'A'));
      playersB.forEach(id => push(id, 'B'));
      await batch.commit();
      return mRef.id as string;
    }
  } catch {}

  // Try Firebase JS SDK (web v9)
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const mod = await (Function('return import("firebase/firestore")')() as Promise<any>);
    const { getFirestore, collection, addDoc, doc, writeBatch } = mod ?? {};
    if (getFirestore && collection && addDoc && writeBatch && doc) {
      const db = getFirestore();
      const matchesCol = collection(db, 'matches');
      const mRef = await addDoc(matchesCol, matchDoc);
      const batch = writeBatch(db);
      const playersCol = collection(mRef, 'players');

      const push = (playerId: string, team: 'A' | 'B') => {
        const st = stats[playerId] ?? {};
        const pref = doc(playersCol, playerId);
        batch.set(pref, {
          playerId,
          team,
          points: st.points ?? 0,
          fouls: st.fouls ?? 0,
          blocks: st.blocks ?? 0,
        });
      };
      playersA.forEach(id => push(id, 'A'));
      playersB.forEach(id => push(id, 'B'));
      await batch.commit();
      return mRef.id as string;
    }
  } catch {}

  // No SDK available; succeed silently with null id
  return null;
}

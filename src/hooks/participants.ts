// src/hooks/participants.ts
// Minimal helpers to add a participant with a role under a match.

export type ParticipantRole = 'player' | 'referee';

export async function addParticipant(
  matchId: string,
  uid: string,
  role: ParticipantRole,
) {
  const joinedAt = Date.now();

  // Try React Native Firebase first
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const rnfb = await (Function('return import("@react-native-firebase/firestore")')() as Promise<any>);
    const firestore = rnfb?.default?.();
    if (firestore) {
      const ref = firestore
        .collection('matches')
        .doc(matchId)
        .collection('participants')
        .doc(uid);
      await ref.set({ role, joinedAt }, { merge: true });
      return true;
    }
  } catch {}

  // Try Firebase Web v9 modular
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const mod = await (Function('return import("firebase/firestore")')() as Promise<any>);
    const { getFirestore, doc, collection, setDoc } = mod ?? {};
    if (getFirestore && doc && collection && setDoc) {
      const db = getFirestore();
      const matchRef = doc(db, 'matches', matchId);
      const parts = collection(matchRef, 'participants');
      const pref = doc(parts, uid);
      await setDoc(pref, { role, joinedAt }, { merge: true });
      return true;
    }
  } catch {}

  return false;
}


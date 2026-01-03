// src/hooks/useMatchParticipants.ts
import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

export type Participant = {
  uid: string;
  team?: 'A' | 'B' | null;
  role?: 'player' | 'referee';
  displayName?: string | null;
  joinedAt?: any;
};

export function useMatchParticipants(matchId?: string | null) {
  const [participants, setParticipants] = useState<Participant[]>([]);

  useEffect(() => {
    if (!matchId) {
      setParticipants([]);
      return;
    }
    const ref = collection(db, 'matches', String(matchId), 'participants');
    const unsub = onSnapshot(ref, (snap) => {
      const items = snap.docs.map((d) => ({
        uid: d.id,
        ...(d.data() as any),
      })) as Participant[];
      setParticipants(items);
    });
    return () => unsub();
  }, [matchId]);

  const playersA = useMemo(
    () => participants.filter((p) => p.team === 'A'),
    [participants]
  );
  const playersB = useMemo(
    () => participants.filter((p) => p.team === 'B'),
    [participants]
  );

  return { participants, playersA, playersB } as const;
}

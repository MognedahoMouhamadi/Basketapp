// src/hooks/usePlayerStats.ts
import { useEffect, useState } from 'react';
import { db } from '../services/firebase';
import {
  doc, collection, getDoc, getDocs,
  query, orderBy, limit
} from 'firebase/firestore';

type AnyRec = Record<string, any>;
export type EloPoint = { t?: string; ts?: number; elo: number };

export function usePlayerStats(uid: string) {
  const [player, setPlayer] = useState<AnyRec | null>(null);
  const [history, setHistory] = useState<EloPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!uid) {
        setPlayer(null);
        setHistory([]);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        // /players/{uid}/stats: summary puis latest
        const playerRef = doc(db, 'players', uid);
        const statsColRef = collection(playerRef, 'stats');

        let stats: AnyRec | null = null;

        const summarySnap = await getDoc(doc(statsColRef, 'summary'));
        if (summarySnap.exists()) {
          stats = summarySnap.data();
        } else {
          const latestQ = query(statsColRef, orderBy('updatedAt', 'desc'), limit(1));
          const latestSnap = await getDocs(latestQ);
          latestSnap.forEach(d => { if (!stats) stats = d.data(); });
        }

        // /players/{uid}/eloHistory (ascendant)
        const eloColRef = collection(playerRef, 'eloHistory');
        const eloQ = query(eloColRef, orderBy('ts', 'asc'));
        const eloSnap = await getDocs(eloQ);
        const eloHist: EloPoint[] = [];
        eloSnap.forEach(d => eloHist.push(d.data() as EloPoint));

        if (!cancelled) {
          setPlayer(stats ?? null);
          setHistory(eloHist);
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e instanceof Error ? e : new Error(String(e)));
          setPlayer(null);
          setHistory([]);
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [uid]);

  return { player, history, loading, error } as const;
}

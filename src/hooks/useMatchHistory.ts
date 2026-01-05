// src/hooks/useMatchHistory.ts
import { useEffect, useMemo, useState } from 'react';
import { collection, collectionGroup, getDoc, getDocs, orderBy, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { normalizeMatchStatus } from '../services/matchStatus';

export type MatchHistoryItem = {
  id: string;
  name?: string;
  place?: string;
  format?: string;
  category?: string;
  winnerTeam?: string;
  status?: string;
  scoreA?: number;
  scoreB?: number;
  createdBy?: string | null;
  creatorId?: string | null;
  startedAt?: any;
  endedAt?: any;
  updatedAt?: any;
  playersA?: string[];
  playersB?: string[];
  participantUids?: string[];
};

const sortByEnd = (a: MatchHistoryItem, b: MatchHistoryItem) => {
  const ta = (a.endedAt?.toMillis?.() ?? a.endedAt ?? a.updatedAt?.toMillis?.() ?? a.updatedAt ?? 0) as number;
  const tb = (b.endedAt?.toMillis?.() ?? b.endedAt ?? b.updatedAt?.toMillis?.() ?? b.updatedAt ?? 0) as number;
  return tb - ta;
};

export function useMatchHistory() {
  const [data, setData] = useState<MatchHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      setError(null);
      try {
        const q = query(
          collection(db, 'matches'),
          where('status', 'in', ['finished', 'closed']),
          orderBy('endedAt', 'desc')
        );
        const snap = await getDocs(q);
        const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as MatchHistoryItem[];
        setData(
          items
            .map((m) => ({ ...m, status: normalizeMatchStatus(m.status) }))
            .sort(sortByEnd)
        );
      } catch (err: any) {
        if (err?.code === 'failed-precondition') {
          try {
            const qFallback = query(collection(db, 'matches'), where('status', 'in', ['finished', 'closed']));
            const snap = await getDocs(qFallback);
            const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as MatchHistoryItem[];
            setData(items.map((m) => ({ ...m, status: normalizeMatchStatus(m.status) })).sort(sortByEnd));
            setLoading(false);
            return;
          } catch (e: any) {
            setError(e as Error);
          }
        } else {
          setError(err as Error);
        }
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  return { data, loading, error } as const;
}

export function useUserMatchHistory(uid?: string | null) {
  const [data, setData] = useState<MatchHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetch = async () => {
      if (!uid) {
        setData([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const q = query(
          collection(db, 'matches'),
          where('participantUids', 'array-contains', uid),
          where('status', 'in', ['finished', 'closed']),
          orderBy('endedAt', 'desc')
        );
        const snap = await getDocs(q);
        const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as MatchHistoryItem[];
        setData(
          items
            .map((m) => ({ ...m, status: normalizeMatchStatus(m.status) }))
            .sort(sortByEnd)
        );
      } catch (err: any) {
        if (err?.code === 'failed-precondition') {
          try {
            const qFallback = query(
              collection(db, 'matches'),
              where('participantUids', 'array-contains', uid)
            );
            const snap = await getDocs(qFallback);
            const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as MatchHistoryItem[];
            const filtered = items
              .map((m) => ({ ...m, status: normalizeMatchStatus(m.status) }))
              .filter((m) => m.status === 'finished');
            setData(filtered.sort(sortByEnd));
            setLoading(false);
            return;
          } catch (e: any) {
            setError(e as Error);
          }
        } else {
          setError(err as Error);
        }
        // Last-resort: collectionGroup on participants to locate match docs.
        try {
          const pq = query(collectionGroup(db, 'participants'), where('uid', '==', uid));
          const psnap = await getDocs(pq);
          const matchRefs = psnap.docs.map((d) => d.ref.parent.parent).filter(Boolean);
          const msnaps = await Promise.all(matchRefs.map((ref) => getDoc(ref!)));
          const items = msnaps
            .filter((m) => m.exists())
            .map((m) => ({ id: m.id, ...(m.data() as any) })) as MatchHistoryItem[];
          const filtered = items
            .map((m) => ({ ...m, status: normalizeMatchStatus(m.status) }))
            .filter((m) => m.status === 'finished');
          setData(filtered.sort(sortByEnd));
        } catch (e: any) {
          setError(e as Error);
        }
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [uid]);

  return { data, loading, error } as const;
}

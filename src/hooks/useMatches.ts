// src/hooks/useMatches.ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import type {
  DocumentData,
  FirestoreError,
  Query,
  QueryDocumentSnapshot,
  QuerySnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import type { MatchPlayer } from '../services/matchService';
import type { ScoreEventType } from '../services/matchScoring';

export type Team = 'A' | 'B';
export type EventType = ScoreEventType;

export type MatchEvent = {
  ts: number;
  team: Team;
  playerId: string;
  type: EventType;
};

export type PlayerStats = { points?: number; fouls?: number; blocks?: number };

export function useMatch(playersA: string[], playersB: string[]) {
  const [stats, setStats] = useState<Record<string, PlayerStats>>({});
  const [history, setHistory] = useState<MatchEvent[]>([]);
  const [redoStack, setRedoStack] = useState<MatchEvent[]>([]);

  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const applyEvent = useCallback((e: MatchEvent, dir: 1 | -1) => {
    setStats(prev => {
      const cur = { ...(prev[e.playerId] ?? {}) } as PlayerStats;
      switch (e.type) {
        case 'PLUS2':
          cur.points = (cur.points ?? 0) + 2 * dir;
          break;
        case 'PLUS3':
          cur.points = (cur.points ?? 0) + 3 * dir;
          break;
        case 'FOUL':
          cur.fouls = (cur.fouls ?? 0) + 1 * dir;
          break;
        case 'BLOCK':
          cur.blocks = (cur.blocks ?? 0) + 1 * dir;
          break;
      }
      // Ensure no negative values
      cur.points = Math.max(0, cur.points ?? 0);
      cur.fouls = Math.max(0, cur.fouls ?? 0);
      cur.blocks = Math.max(0, cur.blocks ?? 0);
      return { ...prev, [e.playerId]: cur };
    });
  }, []);

  const push = useCallback((e: MatchEvent) => {
    applyEvent(e, 1);
    setHistory(h => [...h, e]);
    setRedoStack([]);
  }, [applyEvent]);

  const undo = useCallback(() => {
    setHistory(h => {
      if (h.length === 0) return h;
      const next = h.slice(0, -1);
      const last = h[h.length - 1];
      applyEvent(last, -1);
      setRedoStack(r => [...r, last]);
      return next;
    });
  }, [applyEvent]);

  const redo = useCallback(() => {
    setRedoStack(r => {
      if (r.length === 0) return r;
      const next = r.slice(0, -1);
      const last = r[r.length - 1];
      applyEvent(last, 1);
      setHistory(h => [...h, last]);
      return next;
    });
  }, [applyEvent]);

  // Timer controls
  const start = useCallback(() => {
    if (running) return;
    setRunning(true);
  }, [running]);

  const pause = useCallback(() => {
    setRunning(false);
  }, []);

  const restart = useCallback(() => {
    setSeconds(0);
  }, []);

  useEffect(() => {
    if (running && !timerRef.current) {
      timerRef.current = setInterval(() => {
        setSeconds(s => s + 1);
      }, 1000);
    }
    if (!running && timerRef.current) {
      clearInterval(timerRef.current!);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current!);
        timerRef.current = null;
      }
    };
  }, [running]);

  // Derived scores
  const scoreA = useMemo(() =>
    playersA.reduce((acc, id) => acc + (stats[id]?.points ?? 0), 0)
  , [playersA, stats]);

  const scoreB = useMemo(() =>
    playersB.reduce((acc, id) => acc + (stats[id]?.points ?? 0), 0)
  , [playersB, stats]);

  return {
    playersA,
    playersB,
    stats,
    push,
    undo,
    redo,
    history,
    seconds,
    running,
    start,
    pause,
    restart,
    scoreA,
    scoreB,
  } as const;
}

// ---- Open matches list (Firestore live query)
export type MatchItem = {
  id: string;
  name: string;
  place: string;
  format: string;
  status: 'open'|'running'|'closed'|'finished'|string;
  playersA?: MatchPlayer[];
  playersB?: MatchPlayer[];
  participantsCountA?: number;
  participantsCountB?: number;
};

export function useOpenMatches() {
  const [data, setData] = useState<MatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    // Prefer ordering by createdAt desc, but gracefully fall back if index is missing.
    const qPrimary = query(
      collection(db, 'matches'),
      where('status', '==', 'open'),
      orderBy('createdAtClient', 'desc')
    );
    let cleanup: Unsubscribe | null = null;
    const subscribe = (qArg: Query<DocumentData>): Unsubscribe => onSnapshot(
      qArg,
      (snap: QuerySnapshot<DocumentData>) => {
        const items = snap.docs.map((docSnap: QueryDocumentSnapshot<DocumentData>) => ({
          id: docSnap.id,
          ...(docSnap.data() as Record<string, unknown>),
        })) as MatchItem[];
        setData(items);
        setLoading(false);
      },
      (err: FirestoreError) => {
        console.warn('useOpenMatches snapshot error:', err.code, err.message);
        // If missing index, retry without orderBy and sort client-side.
        if (err.code === 'failed-precondition') {
          const qFallback = query(collection(db, 'matches'), where('status', '==', 'open'));
          cleanup = subscribe(qFallback);
          return;
        }
        // For other errors, surface once and stop loading.
        setLoading(false);
      }
    );
    cleanup = subscribe(qPrimary);
    return () => { if (cleanup) cleanup(); };
  }, []);

  // If the backend didn’t order (fallback path), keep most recent first.
  const ordered = useMemo(() => {
    return [...data].sort((a, b) => {
      const ta = (a as any).createdAtClient ?? (a as any).createdAt?.toMillis?.() ?? (a as any).createdAt ?? 0;
      const tb = (b as any).createdAtClient ?? (b as any).createdAt?.toMillis?.() ?? (b as any).createdAt ?? 0;
      return tb - ta;
    });
  }, [data]);

  return { data: ordered, loading };
}

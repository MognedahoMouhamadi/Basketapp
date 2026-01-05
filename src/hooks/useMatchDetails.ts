import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

export type MatchDetailsDoc = {
  id: string;
  name?: string;
  place?: string;
  format?: string;
  category?: string;
  status?: string;
  scoreA?: number;
  scoreB?: number;
  endedAt?: any;
  winnerTeam?: string;
};

export type ParticipantStats = {
  pts?: number;
  blocks?: number;
  fouls?: number;
  twoPts?: number;
  threePts?: number;
};

export type MatchParticipant = {
  uid: string;
  team?: 'A' | 'B' | null;
  displayName?: string | null;
  stats?: ParticipantStats;
};

export function useMatchDetails(matchId?: string | null) {
  const [match, setMatch] = useState<MatchDetailsDoc | null>(null);
  const [participants, setParticipants] = useState<MatchParticipant[]>([]);
  const [loadingMatch, setLoadingMatch] = useState(false);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!matchId) {
      setMatch(null);
      setLoadingMatch(false);
      return;
    }
    setError(null);
    setLoadingMatch(true);
    const ref = doc(db, 'matches', String(matchId));
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setMatch({ id: snap.id, ...(snap.data() as any) } as MatchDetailsDoc);
        } else {
          setMatch(null);
        }
        setLoadingMatch(false);
      },
      (err) => {
        setError(err as Error);
        setLoadingMatch(false);
      }
    );
    return () => unsub();
  }, [matchId]);

  useEffect(() => {
    if (!matchId) {
      setParticipants([]);
      setLoadingParticipants(false);
      return;
    }
    setError(null);
    setLoadingParticipants(true);
    const ref = collection(db, 'matches', String(matchId), 'participants');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const items = snap.docs.map((d) => ({
          uid: d.id,
          ...(d.data() as any),
        })) as MatchParticipant[];
        setParticipants(items);
        setLoadingParticipants(false);
      },
      (err) => {
        setError(err as Error);
        setLoadingParticipants(false);
      }
    );
    return () => unsub();
  }, [matchId]);

  const teamA = useMemo(
    () => participants.filter((p) => p.team === 'A'),
    [participants]
  );
  const teamB = useMemo(
    () => participants.filter((p) => p.team === 'B'),
    [participants]
  );

  return {
    match,
    participants,
    teamA,
    teamB,
    loading: loadingMatch || loadingParticipants,
    error,
  } as const;
}

// src/services/matchService.ts
import {
  addDoc,
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../services/firebase';

// ---- Types -----------------------------------------------------------------
export type MatchCategory = 'public' | 'ranked' | 'tournament';
export type MatchStatus = 'open' | 'running' | 'closed';
export type MatchVisibility = 'public' | 'private' | 'tournament';

export type MatchPlayerStats = {
  pts: number;
  fouls: number;
  blocks: number;
};

export type MatchPlayer = {
  uid: string;
  displayName: string;
  joinedAt: number;
  stats?: MatchPlayerStats;
};

export type CreateMatchInput = {
  category: MatchCategory;
  creatorId: string;
  tournamentId?: string | null;
  name?: string | null;
  place?: string | null;
  format?: string | null;
  visibility?: MatchVisibility;
};

const inferVisibility = (input: CreateMatchInput): MatchVisibility => {
  if (input.visibility) return input.visibility;
  if (input.category === 'tournament') return 'tournament';
  return 'public';
};

// ---- Match creation --------------------------------------------------------
export async function createMatch(input: CreateMatchInput) {
  const now = Date.now();
  const base = {
    category: input.category,
    status: 'open' as MatchStatus,
    visibility: inferVisibility(input),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdAtClient: now,
    startedAt: null as number | null,
    endedAt: null as number | null,
    creatorId: input.creatorId,
    refereeId: input.creatorId,
    tournamentId: input.category === 'tournament' ? (input.tournamentId ?? null) : null,
    playersA: [] as MatchPlayer[],
    playersB: [] as MatchPlayer[],
    allowJoinInRunning: input.category === 'public',
    name: input.name ?? '',
    place: input.place ?? '',
    format: input.format ?? '',
    scoreA: 0,
    scoreB: 0,
  };
  const ref = await addDoc(collection(db, 'matches'), base);
  return ref.id as string;
}

// ---- Lifecycle transitions -------------------------------------------------
export async function startMatch(matchId: string) {
  const mref = doc(db, 'matches', matchId);
  await updateDoc(mref, {
    status: 'running',
    startedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  } as any);
}

export async function endMatch(
  matchId: string,
  finalScore?: { scoreA?: number; scoreB?: number } | null
) {
  const mref = doc(db, 'matches', matchId);
  const patch: Record<string, unknown> = {
    status: 'closed',
    endedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (finalScore) {
    if (typeof finalScore.scoreA === 'number') patch.scoreA = finalScore.scoreA;
    if (typeof finalScore.scoreB === 'number') patch.scoreB = finalScore.scoreB;
  }
  await updateDoc(mref, patch);
}

// ---- Client-side join (fallback when Cloud Functions are unavailable) ------
type JoinUser = { uid: string; displayName?: string | null };

const playerIdOf = (p: any) => {
  if (!p) return '';
  if (typeof p === 'string') return p;
  return String(p.uid ?? p.displayName ?? '');
};

export async function joinTeamLocal(
  matchId: string,
  team: 'A' | 'B' | null,
  user: JoinUser
) {
  if (!user?.uid) throw new Error('Not authenticated');
  const mref = doc(db, 'matches', matchId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(mref);
    if (!snap.exists()) throw new Error('Match introuvable');
    const data = snap.data() as any;
    let playersA: any[] = Array.isArray(data.playersA) ? [...data.playersA] : [];
    let playersB: any[] = Array.isArray(data.playersB) ? [...data.playersB] : [];
    const uid = String(user.uid);
    playersA = playersA.filter((p) => playerIdOf(p) !== uid);
    playersB = playersB.filter((p) => playerIdOf(p) !== uid);
    const player = {
      uid,
      displayName: String(user.displayName ?? uid),
      joinedAt: Date.now(),
      stats: { pts: 0, fouls: 0, blocks: 0 },
    };
    if (team === 'A') playersA.push(player);
    if (team === 'B') playersB.push(player);
    tx.update(mref, {
      playersA,
      playersB,
      updatedAt: serverTimestamp(),
    });
  });
}

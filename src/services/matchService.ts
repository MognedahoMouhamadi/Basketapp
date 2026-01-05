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
import type { ScoreEventType } from './matchScoring';

// ---- Types -----------------------------------------------------------------
export type MatchCategory = 'public' | 'ranked' | 'tournament';
export type MatchStatus = 'open' | 'running' | 'closed' | 'finished';
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
  description?: string | null;
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
    createdBy: input.creatorId,
    refereeId: input.creatorId,
    tournamentId: input.category === 'tournament' ? (input.tournamentId ?? null) : null,
    participantsCountA: 0,
    participantsCountB: 0,
    participantUids: [] as string[],
    allowJoinInRunning: input.category === 'public',
    name: input.name ?? '',
    place: input.place ?? '',
    format: input.format ?? '',
    description: input.description ?? '',
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

export async function startMatchLocal(matchId: string) {
  return startMatch(matchId);
}

export async function endMatch(
  matchId: string,
  finalScore?: { scoreA?: number; scoreB?: number } | null
) {
  const mref = doc(db, 'matches', matchId);
  const patch: Record<string, unknown> = {
    status: 'finished',
    endedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (finalScore) {
    if (typeof finalScore.scoreA === 'number') patch.scoreA = finalScore.scoreA;
    if (typeof finalScore.scoreB === 'number') patch.scoreB = finalScore.scoreB;
  }
  await updateDoc(mref, patch);
}

export async function pushEventLocal(params: {
  matchId: string;
  kind: ScoreEventType;
  uid: string;
  team: 'A' | 'B';
  points?: number;
}) {
  const { matchId, kind, uid, team, points } = params;
  const mref = doc(db, 'matches', matchId);
  const pref = doc(db, 'matches', matchId, 'participants', uid);
  await runTransaction(db, async (tx) => {
    const matchSnap = await tx.get(mref);
    if (!matchSnap.exists()) throw new Error('Match introuvable');
    const m = matchSnap.data() as any;
    const scoreA = Number(m.scoreA ?? 0);
    const scoreB = Number(m.scoreB ?? 0);
    const existingUids = Array.isArray(m.participantUids) ? [...m.participantUids] : [];

    let nextScoreA = scoreA;
    let nextScoreB = scoreB;
    const delta = Number(points ?? 0);
    if ((kind === 'PLUS2' || kind === 'PLUS3') && delta > 0) {
      if (team === 'A') nextScoreA += delta;
      if (team === 'B') nextScoreB += delta;
    }

    const prefSnap = await tx.get(pref);
    const prev = prefSnap.exists() ? (prefSnap.data() as any) : {};
    const stats = { ...(prev.stats ?? {}) } as any;
    if (kind === 'PLUS2' || kind === 'PLUS3') {
      stats.pts = Math.max(0, Number(stats.pts ?? stats.points ?? 0) + delta);
    } else if (kind === 'FOUL') {
      stats.fouls = Math.max(0, Number(stats.fouls ?? 0) + 1);
    } else if (kind === 'BLOCK') {
      stats.blocks = Math.max(0, Number(stats.blocks ?? 0) + 1);
    }

    tx.set(
      pref,
      { uid, team, role: prev.role ?? 'player', stats, updatedAt: serverTimestamp() },
      { merge: true }
    );

    tx.update(mref, {
      scoreA: nextScoreA,
      scoreB: nextScoreB,
      participantUids: existingUids.includes(uid) ? existingUids : [...existingUids, uid],
      updatedAt: serverTimestamp(),
    });
  });
}

// ---- Client-side join (fallback when Cloud Functions are unavailable) ------
type JoinUser = { uid: string; displayName?: string | null };

export async function joinTeamLocal(
  matchId: string,
  team: 'A' | 'B' | null,
  user: JoinUser
) {
  if (!user?.uid) throw new Error('Not authenticated');
  const mref = doc(db, 'matches', matchId);
  const pref = doc(db, 'matches', matchId, 'participants', user.uid);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(mref);
    if (!snap.exists()) throw new Error('Match introuvable');
    const data = snap.data() as any;
    const prevSnap = await tx.get(pref);
    const prevTeam = prevSnap.exists() ? (prevSnap.data() as any)?.team : null;
    let countA = Number(data.participantsCountA ?? 0);
    let countB = Number(data.participantsCountB ?? 0);
    const existingUids = Array.isArray(data.participantUids) ? [...data.participantUids] : [];
    const uidStr = String(user.uid);

    const dec = (t: 'A' | 'B') => {
      if (t === 'A') countA = Math.max(0, countA - 1);
      if (t === 'B') countB = Math.max(0, countB - 1);
    };
    const inc = (t: 'A' | 'B') => {
      if (t === 'A') countA += 1;
      if (t === 'B') countB += 1;
    };

    if (prevTeam && prevTeam !== team) dec(prevTeam);
    if (team && prevTeam !== team) inc(team);

    let participantUids = existingUids.filter((id) => id !== uidStr);
    if (team) participantUids = [...participantUids, uidStr];

    if (team) {
      tx.set(
        pref,
        {
          uid: uidStr,
          displayName: String(user.displayName ?? uidStr),
          team,
          role: 'player',
          joinedAt: prevSnap.exists()
            ? (prevSnap.data() as any)?.joinedAt ?? serverTimestamp()
            : serverTimestamp(),
        },
        { merge: true }
      );
    } else if (prevSnap.exists()) {
      tx.delete(pref);
    }

    tx.update(mref, {
      participantsCountA: countA,
      participantsCountB: countB,
      participantUids,
      updatedAt: serverTimestamp(),
    });
  });
}

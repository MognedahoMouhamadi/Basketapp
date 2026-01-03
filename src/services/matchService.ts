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
    participantsCountA: 0,
    participantsCountB: 0,
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

    if (team) {
      tx.set(
        pref,
        {
          uid: String(user.uid),
          displayName: String(user.displayName ?? user.uid),
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
      updatedAt: serverTimestamp(),
    });
  });
}

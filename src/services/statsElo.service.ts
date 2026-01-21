// src/services/statsElo.service.ts
import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { computeRankedEloUpdate } from './eloRankedMath';

export const DEFAULT_ELO = 1000;
export const DEFAULT_STATS = {
  matches: 0,
  points: 0,
  threePts: 0,
  twoPts: 0,
  blocks: 0,
  fouls: 0,
  wins: 0,
  losses: 0,
};

type WinnerTeam = 'A' | 'B' | 'draw' | null;
type TeamKey = 'A' | 'B';

type RankedMatchSnapshot = {
  id: string;
  scoreA?: number;
  scoreB?: number;
  winnerTeam?: unknown;
  teamA: string[];
  teamB: string[];
};

const toNumber = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const computeWinner = (scoreA?: unknown, scoreB?: unknown): WinnerTeam => {
  if (typeof scoreA !== 'number' || typeof scoreB !== 'number') return null;
  if (scoreA > scoreB) return 'A';
  if (scoreB > scoreA) return 'B';
  return 'draw';
};

const normalizeParticipantStats = (raw: any) => {
  const stats = raw?.stats ?? raw ?? {};
  const pointsRaw = toNumber(stats.pts ?? stats.points ?? 0);
  const threePtsRaw = Math.max(0, toNumber(stats.threePts ?? stats.threes ?? 0));
  let twoPtsRaw = Math.max(0, toNumber(stats.twoPts ?? stats.twos ?? 0));
  if (!twoPtsRaw && pointsRaw) {
    twoPtsRaw = Math.max(0, pointsRaw - threePtsRaw);
  }
  const points = pointsRaw || Math.max(0, twoPtsRaw + threePtsRaw);

  return {
    points,
    threePts: threePtsRaw,
    twoPts: twoPtsRaw,
    blocks: Math.max(0, toNumber(stats.blocks ?? 0)),
    fouls: Math.max(0, toNumber(stats.fouls ?? 0)),
  };
};

const chunkArray = <T,>(input: T[], size: number) => {
  const chunks: T[][] = [];
  for (let i = 0; i < input.length; i += size) {
    chunks.push(input.slice(i, i + size));
  }
  return chunks;
};

export async function ensureUserProfile(uid: string) {
  if (!uid) throw new Error('Missing user id');
  const ref = doc(db, 'users', uid);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const patch: Record<string, unknown> = {};

    if (!snap.exists()) {
      tx.set(
        ref,
        { elo: DEFAULT_ELO, stats: DEFAULT_STATS, updatedAt: serverTimestamp() },
        { merge: true }
      );
      return;
    }

    const data = snap.data() as any;
    if (typeof data?.elo !== 'number') patch.elo = DEFAULT_ELO;

    const stats = data?.stats ?? {};
    if (typeof stats?.matches !== 'number') patch['stats.matches'] = 0;
    if (typeof stats?.points !== 'number') patch['stats.points'] = 0;
    if (typeof stats?.threePts !== 'number') patch['stats.threePts'] = 0;
    if (typeof stats?.twoPts !== 'number') patch['stats.twoPts'] = 0;
    if (typeof stats?.blocks !== 'number') patch['stats.blocks'] = 0;
    if (typeof stats?.fouls !== 'number') patch['stats.fouls'] = 0;
    if (typeof stats?.wins !== 'number') patch['stats.wins'] = 0;
    if (typeof stats?.losses !== 'number') patch['stats.losses'] = 0;

    if (Object.keys(patch).length > 0) {
      patch.updatedAt = serverTimestamp();
      tx.set(ref, patch, { merge: true });
    }
  });
}

export async function commitStats(matchId: string) {
  if (!matchId) throw new Error('Missing match id');
  const matchRef = doc(db, 'matches', matchId);
  const [matchSnap, partsSnap] = await Promise.all([
    getDoc(matchRef),
    getDocs(collection(matchRef, 'participants')),
  ]);

  if (!matchSnap.exists()) throw new Error('Match not found');
  const perUser: Record<
    string,
    {
      team: TeamKey;
      matches: number;
      points: number;
      threePts: number;
      twoPts: number;
      blocks: number;
      fouls: number;
    }
  > = {};

  for (const docSnap of partsSnap.docs) {
    const data = docSnap.data() as any;
    const team = data?.team as TeamKey;
    const uid = String(data?.uid ?? docSnap.id ?? '');
    if (!uid || (team !== 'A' && team !== 'B')) continue;

    const stats = normalizeParticipantStats(data);
    if (!perUser[uid]) {
      perUser[uid] = {
        team,
        matches: 0,
        points: 0,
        threePts: 0,
        twoPts: 0,
        blocks: 0,
        fouls: 0,
      };
    }

    perUser[uid].matches += 1;
    perUser[uid].points += stats.points;
    perUser[uid].threePts += stats.threePts;
    perUser[uid].twoPts += stats.twoPts;
    perUser[uid].blocks += stats.blocks;
    perUser[uid].fouls += stats.fouls;
  }

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(matchRef);
    if (!snap.exists()) throw new Error('Match not found');
    const data = snap.data() as any;
    if (data?.statsCommitted) return;
    const winnerTeam = computeWinner(data?.scoreA, data?.scoreB);

    tx.update(matchRef, {
      winnerTeam: winnerTeam ?? null,
      statsCommitted: true,
      updatedAt: serverTimestamp(),
    });

    for (const [uid, totals] of Object.entries(perUser)) {
      const userRef = doc(db, 'users', uid);
      const patch: Record<string, unknown> = {
        'stats.matches': increment(totals.matches),
      };
      if (totals.points) patch['stats.points'] = increment(totals.points);
      if (totals.threePts) patch['stats.threePts'] = increment(totals.threePts);
      if (totals.twoPts) patch['stats.twoPts'] = increment(totals.twoPts);
      if (totals.blocks) patch['stats.blocks'] = increment(totals.blocks);
      if (totals.fouls) patch['stats.fouls'] = increment(totals.fouls);
      const isWin = winnerTeam && winnerTeam !== 'draw' ? winnerTeam === totals.team : false;
      const isLoss = winnerTeam && winnerTeam !== 'draw' ? winnerTeam !== totals.team : false;
      if (isWin) patch['stats.wins'] = increment(1);
      if (isLoss) patch['stats.losses'] = increment(1);

      tx.set(userRef, patch, { merge: true });
    }
  });
}

export async function commitElo(matchId: string) {
  if (!matchId) throw new Error('Missing match id');
  const matchRef = doc(db, 'matches', matchId);
  const [matchSnap, partsSnap] = await Promise.all([
    getDoc(matchRef),
    getDocs(collection(matchRef, 'participants')),
  ]);

  if (!matchSnap.exists()) throw new Error('Match not found');
  const matchData = matchSnap.data() as any;
  const isRanked = matchData?.category === 'ranked' || matchData?.isRanked === true;

  const teamA: string[] = [];
  const teamB: string[] = [];
  for (const docSnap of partsSnap.docs) {
    const data = docSnap.data() as any;
    const team = data?.team as TeamKey;
    const uid = String(data?.uid ?? docSnap.id ?? '');
    if (!uid || (team !== 'A' && team !== 'B')) continue;
    if (team === 'A') teamA.push(uid);
    if (team === 'B') teamB.push(uid);
  }

  if (!isRanked) {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(matchRef);
      if (!snap.exists()) throw new Error('Match not found');
      const data = snap.data() as any;
      if (data?.eloCommitted) return;
      tx.update(matchRef, { eloCommitted: true, updatedAt: serverTimestamp() });
    });
    return;
  }

  if (!teamA.length || !teamB.length) {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(matchRef);
      if (!snap.exists()) throw new Error('Match not found');
      const data = snap.data() as any;
      if (data?.eloCommitted) return;
      tx.update(matchRef, { eloCommitted: true, updatedAt: serverTimestamp() });
    });
    return;
  }

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(matchRef);
    if (!snap.exists()) throw new Error('Match not found');
    const data = snap.data() as any;
    if (data?.eloCommitted) return;

    const rawWinner = String(data?.winnerTeam ?? '').toLowerCase();
    const winnerTeam =
      rawWinner === 'a' ? 'A' : rawWinner === 'b' ? 'B' : rawWinner === 'draw' ? 'draw' : null;
    const resolvedWinner = winnerTeam ?? computeWinner(data?.scoreA, data?.scoreB);
    const scoreA =
      resolvedWinner === 'A' ? 1 : resolvedWinner === 'B' ? 0 : 0.5;

    const currentElosA: Record<string, number> = {};
    const currentElosB: Record<string, number> = {};

    for (const uid of teamA) {
      const userRef = doc(db, 'users', uid);
      const userSnap = await tx.get(userRef);
      const current = toNumber(userSnap.data()?.elo, DEFAULT_ELO);
      currentElosA[uid] = current;
    }

    for (const uid of teamB) {
      const userRef = doc(db, 'users', uid);
      const userSnap = await tx.get(userRef);
      const current = toNumber(userSnap.data()?.elo, DEFAULT_ELO);
      currentElosB[uid] = current;
    }

    const currentElos = new Map<string, number>();
    for (const uid of teamA) currentElos.set(uid, currentElosA[uid]);
    for (const uid of teamB) currentElos.set(uid, currentElosB[uid]);
    const { deltas, after } = computeRankedEloUpdate({
      teamAIds: teamA,
      teamBIds: teamB,
      currentElosByPlayerId: currentElos,
      winnerTeam: resolvedWinner ?? null,
      scoreA: data?.scoreA,
      scoreB: data?.scoreB,
      kFactor: 24,
      defaultElo: DEFAULT_ELO,
    });

    for (const uid of teamA) {
      const userRef = doc(db, 'users', uid);
      const next = after[uid] ?? Math.round(currentElosA[uid]);
      const delta = deltas[uid] ?? 0;
      tx.set(userRef, { elo: next }, { merge: true });
      const partRef = doc(db, 'matches', matchId, 'participants', uid);
      tx.set(
        partRef,
        { elo: { before: currentElosA[uid], delta, after: next } },
        { merge: true }
      );
    }

    for (const uid of teamB) {
      const userRef = doc(db, 'users', uid);
      const next = after[uid] ?? Math.round(currentElosB[uid]);
      const delta = deltas[uid] ?? 0;
      tx.set(userRef, { elo: next }, { merge: true });
      const partRef = doc(db, 'matches', matchId, 'participants', uid);
      tx.set(
        partRef,
        { elo: { before: currentElosB[uid], delta, after: next } },
        { merge: true }
      );
    }

    tx.update(matchRef, { eloCommitted: true, updatedAt: serverTimestamp() });
  });
}

export async function finalizeMatchAndCommit(matchId: string) {
  if (!matchId) throw new Error('Missing match id');
  await commitStats(matchId);
  await commitElo(matchId);
}

export async function recalcRankedEloFromScratch() {
  const matchesSnap = await getDocs(
    query(collection(db, 'matches'), orderBy('endedAt', 'asc'))
  );

  const rankedMatches: RankedMatchSnapshot[] = [];
  const userIds = new Set<string>();

  for (const matchDoc of matchesSnap.docs) {
    const data = matchDoc.data() as any;
    if (!data?.endedAt) continue;
    const isRanked = data?.category === 'ranked' || data?.isRanked === true;
    if (!isRanked) continue;

    const partsSnap = await getDocs(collection(matchDoc.ref, 'participants'));
    const teamA: string[] = [];
    const teamB: string[] = [];

    for (const partDoc of partsSnap.docs) {
      const part = partDoc.data() as any;
      const team = part?.team as TeamKey;
      const uid = String(part?.uid ?? partDoc.id ?? '');
      if (!uid) continue;
      if (team === 'A') teamA.push(uid);
      if (team === 'B') teamB.push(uid);
      if (team === 'A' || team === 'B') userIds.add(uid);
    }

    rankedMatches.push({
      id: matchDoc.id,
      scoreA: data?.scoreA,
      scoreB: data?.scoreB,
      winnerTeam: data?.winnerTeam,
      teamA,
      teamB,
    });
  }

  const allUserIds = Array.from(userIds);
  for (const chunk of chunkArray(allUserIds, 450)) {
    const batch = writeBatch(db);
    for (const uid of chunk) {
      const userRef = doc(db, 'users', uid);
      batch.set(userRef, { elo: DEFAULT_ELO }, { merge: true });
    }
    await batch.commit();
  }

  const currentElos = new Map<string, number>();
  for (const uid of allUserIds) currentElos.set(uid, DEFAULT_ELO);

  for (const match of rankedMatches) {
    const rawWinner = String(match.winnerTeam ?? '').toLowerCase();
    const winnerTeam =
      rawWinner === 'a' ? 'A' : rawWinner === 'b' ? 'B' : rawWinner === 'draw' ? 'draw' : null;
    const resolvedWinner = winnerTeam ?? computeWinner(match.scoreA, match.scoreB);
    const scoreA = resolvedWinner === 'A' ? 1 : resolvedWinner === 'B' ? 0 : 0.5;

    const matchRef = doc(db, 'matches', match.id);

    if (!match.teamA.length || !match.teamB.length) {
      await runTransaction(db, async (tx) => {
        tx.update(matchRef, { eloCommitted: true, updatedAt: serverTimestamp() });
      });
      continue;
    }

    let sumA = 0;
    let sumB = 0;
    for (const uid of match.teamA) sumA += currentElos.get(uid) ?? DEFAULT_ELO;
    for (const uid of match.teamB) sumB += currentElos.get(uid) ?? DEFAULT_ELO;

    const avgA = sumA / match.teamA.length;
    const avgB = sumB / match.teamB.length;
    const expectedA = 1 / (1 + Math.pow(10, (avgB - avgA) / 400));
    const kFactor = 24;
    const deltaA = Math.round(kFactor * (scoreA - expectedA));
    const deltaB = -deltaA;

    const batch = writeBatch(db);

    for (const uid of match.teamA) {
      const before = currentElos.get(uid) ?? DEFAULT_ELO;
      const after = Math.round(before + deltaA);
      currentElos.set(uid, after);
      const userRef = doc(db, 'users', uid);
      batch.set(userRef, { elo: after }, { merge: true });
      const partRef = doc(db, 'matches', match.id, 'participants', uid);
      batch.set(partRef, { elo: { before, delta: deltaA, after } }, { merge: true });
    }

    for (const uid of match.teamB) {
      const before = currentElos.get(uid) ?? DEFAULT_ELO;
      const after = Math.round(before + deltaB);
      currentElos.set(uid, after);
      const userRef = doc(db, 'users', uid);
      batch.set(userRef, { elo: after }, { merge: true });
      const partRef = doc(db, 'matches', match.id, 'participants', uid);
      batch.set(partRef, { elo: { before, delta: deltaB, after } }, { merge: true });
    }

    batch.update(matchRef, { eloCommitted: true, updatedAt: serverTimestamp() });
    await batch.commit();
  }

  return { matches: rankedMatches.length, users: allUserIds.length };
}

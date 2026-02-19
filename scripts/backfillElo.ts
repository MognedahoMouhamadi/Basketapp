// scripts/backfillElo.ts
import admin from 'firebase-admin';

type TeamKey = 'A' | 'B';
type WinnerTeam = 'A' | 'B' | 'draw';

const DEFAULT_ELO = 1000;
const DEFAULT_K = 24;

type Flags = {
  force: boolean;
  updateUsers: boolean;
  limit?: number;
  kFactor: number;
};

const parseFlags = (): Flags => {
  const args = new Set(process.argv.slice(2));
  const flagValue = (name: string) => {
    for (const arg of args) {
      if (arg.startsWith(`${name}=`)) return arg.split('=')[1];
    }
    return undefined;
  };
  return {
    force: args.has('--force'),
    updateUsers: args.has('--update-users'),
    limit: flagValue('--limit') ? Number(flagValue('--limit')) : undefined,
    kFactor: flagValue('--k') ? Number(flagValue('--k')) : DEFAULT_K,
  };
};

const asNumber = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const computeWinner = (match: admin.firestore.DocumentData): WinnerTeam | null => {
  const raw = String(match?.winnerTeam ?? '').toLowerCase();
  if (raw === 'a') return 'A';
  if (raw === 'b') return 'B';
  if (raw === 'draw') return 'draw';
  const scoreA = asNumber(match?.scoreA, NaN);
  const scoreB = asNumber(match?.scoreB, NaN);
  if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB)) return null;
  if (scoreA > scoreB) return 'A';
  if (scoreB > scoreA) return 'B';
  return 'draw';
};

const getScoreAFromWinner = (winner: WinnerTeam): number => {
  if (winner === 'A') return 1;
  if (winner === 'B') return 0;
  return 0.5;
};

const initAdmin = () => {
  if (admin.apps.length > 0) return;
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
};

const getMatches = async (
  db: admin.firestore.Firestore,
  limit?: number
) => {
  const baseFilters = (q: admin.firestore.Query) =>
    q
      .where('status', '==', 'finished')
      .where('endedAt', '!=', null)
      .orderBy('endedAt', 'asc');

  const rankedSnap = await baseFilters(
    db.collection('matches').where('category', '==', 'ranked')
  ).get();

  const flaggedSnap = await baseFilters(
    db.collection('matches').where('isRanked', '==', true)
  ).get();

  const map = new Map<string, admin.firestore.QueryDocumentSnapshot>();
  for (const docSnap of rankedSnap.docs) map.set(docSnap.id, docSnap);
  for (const docSnap of flaggedSnap.docs) map.set(docSnap.id, docSnap);

  const sorted = Array.from(map.values()).sort((a, b) => {
    const ta = a.data()?.endedAt?.toMillis?.() ?? 0;
    const tb = b.data()?.endedAt?.toMillis?.() ?? 0;
    return ta - tb;
  });

  return limit ? sorted.slice(0, limit) : sorted;
};

const readParticipants = async (
  db: admin.firestore.Firestore,
  matchId: string
) => {
  const snap = await db.collection('matches').doc(matchId).collection('participants').get();
  const teamA: string[] = [];
  const teamB: string[] = [];
  const all: string[] = [];
  const byUid = new Map<string, admin.firestore.DocumentData>();

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const uid = String(data?.uid ?? docSnap.id ?? '');
    const team = data?.team as TeamKey | undefined;
    if (!uid || (team !== 'A' && team !== 'B')) continue;
    all.push(uid);
    byUid.set(uid, data);
    if (team === 'A') teamA.push(uid);
    if (team === 'B') teamB.push(uid);
  }

  return { teamA, teamB, all, byUid };
};

const ensureMap = (map: Map<string, number>, uid: string) => {
  if (!map.has(uid)) map.set(uid, DEFAULT_ELO);
  return map.get(uid) ?? DEFAULT_ELO;
};

const computeDelta = (avgA: number, avgB: number, scoreA: number, kFactor: number) => {
  const expectedA = 1 / (1 + Math.pow(10, (avgB - avgA) / 400));
  return Math.round(kFactor * (scoreA - expectedA));
};

const main = async () => {
  const flags = parseFlags();
  initAdmin();
  const db = admin.firestore();

  const matches = await getMatches(db, flags.limit);
  console.log(`Found ${matches.length} ranked matches`);
  const eloByUid = new Map<string, number>();

  let processed = 0;
  let skipped = 0;
  const skipReasons: Record<string, number> = {};

  for (const docSnap of matches) {
    const matchId = docSnap.id;
    const data = docSnap.data();

    if (data?.eloCommitted && !flags.force) {
      skipped += 1;
      skipReasons.eloCommitted = (skipReasons.eloCommitted ?? 0) + 1;
      continue;
    }

    if (!data?.endedAt) {
      console.warn(`Skip ${matchId}: missing endedAt`);
      skipped += 1;
      skipReasons.missingEndedAt = (skipReasons.missingEndedAt ?? 0) + 1;
      continue;
    }

    const winner = computeWinner(data);
    if (!winner) {
      console.warn(`Skip ${matchId}: missing score or winner`);
      skipped += 1;
      skipReasons.missingScore = (skipReasons.missingScore ?? 0) + 1;
      continue;
    }

    const { teamA, teamB } = await readParticipants(db, matchId);
    if (!teamA.length || !teamB.length) {
      console.warn(`Skip ${matchId}: missing team participants`);
      skipped += 1;
      skipReasons.missingParticipants = (skipReasons.missingParticipants ?? 0) + 1;
      continue;
    }

    const avgA =
      teamA.reduce((sum, uid) => sum + ensureMap(eloByUid, uid), 0) / teamA.length;
    const avgB =
      teamB.reduce((sum, uid) => sum + ensureMap(eloByUid, uid), 0) / teamB.length;
    const scoreA = getScoreAFromWinner(winner);
    const deltaA = computeDelta(avgA, avgB, scoreA, flags.kFactor);
    const deltaB = -deltaA;

    const batch = db.batch();
    for (const uid of teamA) {
      const before = ensureMap(eloByUid, uid);
      const after = Math.round(before + deltaA);
      eloByUid.set(uid, after);
      const ref = db.doc(`matches/${matchId}/participants/${uid}`);
      batch.set(ref, { elo: { before, delta: deltaA, after } }, { merge: true });
    }
    for (const uid of teamB) {
      const before = ensureMap(eloByUid, uid);
      const after = Math.round(before + deltaB);
      eloByUid.set(uid, after);
      const ref = db.doc(`matches/${matchId}/participants/${uid}`);
      batch.set(ref, { elo: { before, delta: deltaB, after } }, { merge: true });
    }
    const matchPatch: Record<string, unknown> = {
      eloCommitted: true,
      eloSummary: {
        teamAEloAvgBefore: Math.round(avgA),
        teamBEloAvgBefore: Math.round(avgB),
        delta: deltaA,
      },
    };
    if (!data?.winnerTeam || flags.force) matchPatch.winnerTeam = winner;
    batch.set(db.doc(`matches/${matchId}`), matchPatch, { merge: true });
    await batch.commit();
    processed += 1;
    console.log(`Processed ${matchId} (deltaA ${deltaA}, deltaB ${deltaB})`);
  }

  if (flags.updateUsers) {
    const entries = Array.from(eloByUid.entries());
    const chunkSize = 500;
    for (let i = 0; i < entries.length; i += chunkSize) {
      const chunk = entries.slice(i, i + chunkSize);
      const batch = db.batch();
      for (const [uid, elo] of chunk) {
        batch.set(db.doc(`users/${uid}`), { elo }, { merge: true });
      }
      await batch.commit();
    }
    console.log(`Updated users elo: ${entries.length}`);
  }

  console.log(`Done. processed=${processed} skipped=${skipped}`);
  if (Object.keys(skipReasons).length) {
    console.log('Skip reasons:', skipReasons);
  }
};

main().catch((err) => {
  console.error('Backfill failed', err);
  process.exit(1);
});

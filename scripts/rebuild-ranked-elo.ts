#!/usr/bin/env ts-node
/* eslint-disable no-console */
/**
 * HOW TO RUN
 * 1) Install deps: npm install firebase-admin
 * 2) Run with ts-node:
 *    npx ts-node scripts/rebuild-ranked-elo.ts --commit --algoVersion v1
 * 3) Or build and run:
 *    npx tsc scripts/rebuild-ranked-elo.ts --outDir dist
 *    node dist/rebuild-ranked-elo.js --commit
 *
 * Notes:
 * - Uses GOOGLE_APPLICATION_CREDENTIALS if set.
 * - Falls back to ./serviceAccount.json if present.
 */

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import admin from 'firebase-admin';

type Args = {
  dryRun: boolean;
  commit: boolean;
  algoVersion: string;
  limit?: number;
  fromDate?: string;
  validateOnly: boolean;
};

type MatchDoc = {
  id: string;
  ref: FirebaseFirestore.DocumentReference;
  data: FirebaseFirestore.DocumentData;
};

type ParticipantDoc = {
  uid: string;
  team: 'A' | 'B' | null;
};

type MatchExtract = {
  matchId: string;
  teamAPlayerIds: string[];
  teamBPlayerIds: string[];
  scoreA?: number;
  scoreB?: number;
  winnerTeam?: WinnerTeam;
};

type EloUpdateResult = {
  deltas: Record<string, number>;
  after: Record<string, number>;
};

type PendingMatchUpdate = {
  ref: FirebaseFirestore.DocumentReference;
  eloDeltaByPlayerId: Record<string, number>;
  eloAfterByPlayerId: Record<string, number>;
  eloAlgoVersion: string;
};

const DEFAULT_ELO = 1000;
type WinnerTeam = 'A' | 'B' | 'draw' | null;
type ComputeRankedEloUpdate = (params: {
  teamAIds: string[];
  teamBIds: string[];
  currentElosByPlayerId: Map<string, number>;
  winnerTeam?: WinnerTeam;
  scoreA?: number;
  scoreB?: number;
  kFactor?: number;
  defaultElo?: number;
}) => EloUpdateResult;

let computeRankedEloUpdateFn: ComputeRankedEloUpdate | null = null;

function loadEnvFileIfPresent(): void {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const rawValue = trimmed.slice(eq + 1).trim();
    if (!key || process.env[key]) continue;
    const value = rawValue.replace(/^['"]|['"]$/g, '');
    process.env[key] = value;
  }
}

function ensureProjectIdEnv(): void {
  if (process.env.GOOGLE_CLOUD_PROJECT) return;
  const fallback =
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  if (fallback) process.env.GOOGLE_CLOUD_PROJECT = fallback;
}

function getProjectIdFromEnv(): string | undefined {
  return (
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.FIREBASE_PROJECT_ID ||
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID
  );
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    dryRun: true,
    commit: false,
    algoVersion: 'v1',
    validateOnly: false,
  };

  const flags = new Set<string>();
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const [rawKey, rawValue] = token.split('=');
    const key = rawKey.replace(/^--/, '');
    const next = rawValue ?? argv[i + 1];

    if (key === 'commit') {
      args.commit = true;
      args.dryRun = false;
      flags.add(key);
      continue;
    }
    if (key === 'dryRun') {
      args.dryRun = true;
      args.commit = false;
      flags.add(key);
      continue;
    }
    if (key === 'validateOnly') {
      args.validateOnly = true;
      flags.add(key);
      continue;
    }
    if (key === 'algoVersion' && next) {
      args.algoVersion = String(next);
      if (!rawValue) i += 1;
      continue;
    }
    if (key === 'limit' && next) {
      const n = Number(next);
      if (Number.isFinite(n) && n > 0) args.limit = n;
      if (!rawValue) i += 1;
      continue;
    }
    if (key === 'fromDate' && next) {
      args.fromDate = String(next);
      if (!rawValue) i += 1;
      continue;
    }
  }

  if (!flags.has('commit') && !flags.has('dryRun')) {
    args.dryRun = true;
    args.commit = false;
  }

  return args;
}

function initAdmin(): FirebaseFirestore.Firestore {
  if (admin.apps.length > 0) return admin.firestore();

  const credsPathFromEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const projectId = getProjectIdFromEnv();
  if (credsPathFromEnv && fs.existsSync(credsPathFromEnv)) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId,
    });
    return admin.firestore();
  }

  const localPath = path.resolve(process.cwd(), 'serviceAccount.json');
  if (fs.existsSync(localPath)) {
    const json = JSON.parse(fs.readFileSync(localPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(json),
      projectId: projectId ?? json.project_id,
    });
    return admin.firestore();
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
      projectId,
    });
    return admin.firestore();
  }

  admin.initializeApp({ projectId });
  return admin.firestore();
}

async function loadComputeRankedEloUpdate(): Promise<ComputeRankedEloUpdate> {
  const modulePath = path.resolve(process.cwd(), 'src/services/eloRankedMath.ts');
  const moduleUrl = pathToFileURL(modulePath).href;
  const mod = await import(moduleUrl);
  if (typeof mod.computeRankedEloUpdate !== 'function') {
    throw new Error('computeRankedEloUpdate export not found in src/services/eloRankedMath.ts');
  }
  return mod.computeRankedEloUpdate as ComputeRankedEloUpdate;
}

async function fetchPlayers(db: FirebaseFirestore.Firestore): Promise<string[]> {
  const snap = await db.collection('players').get();
  const ids: string[] = [];
  snap.forEach((doc) => ids.push(doc.id));
  return ids;
}

async function fetchRankedMatches(
  db: FirebaseFirestore.Firestore,
  fromDate?: string
): Promise<MatchDoc[]> {
  const categorySnap = await db
    .collection('matches')
    .where('category', '==', 'ranked')
    .get();
  const matches: MatchDoc[] = [];
  const fromTs = fromDate ? Date.parse(fromDate) : null;

  const addIfValid = (doc: FirebaseFirestore.QueryDocumentSnapshot) => {
    const data = doc.data();
    const endedAt = normalizeToMillis(data.endedAt);
    if (!endedAt) return;
    if (fromTs && endedAt < fromTs) return;
    matches.push({ id: doc.id, ref: doc.ref, data });
  };

  categorySnap.forEach(addIfValid);

  return matches;
}

function normalizeToMillis(value: unknown): number | null {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const ts = value as FirebaseFirestore.Timestamp;
  if (typeof ts?.toMillis === 'function') return ts.toMillis();
  return null;
}

function sortMatches(matches: MatchDoc[]): MatchDoc[] {
  return matches.sort((a, b) => {
    const aEnded = normalizeToMillis(a.data.endedAt) ?? 0;
    const bEnded = normalizeToMillis(b.data.endedAt) ?? 0;
    if (aEnded !== bEnded) return aEnded - bEnded;
    const aCreated = normalizeToMillis(a.data.createdAt) ?? 0;
    const bCreated = normalizeToMillis(b.data.createdAt) ?? 0;
    if (aCreated !== bCreated) return aCreated - bCreated;
    return a.id.localeCompare(b.id);
  });
}

function validateMatchDoc(match: MatchDoc): string[] {
  const errors: string[] = [];
  const endedAt = normalizeToMillis(match.data.endedAt);
  if (!endedAt) errors.push('endedAt missing or invalid');
  return errors;
}

async function fetchParticipants(match: MatchDoc): Promise<ParticipantDoc[]> {
  const snap = await match.ref.collection('participants').get();
  const participants: ParticipantDoc[] = [];
  snap.forEach((doc) => {
    const data = doc.data() as any;
    const uid = String(data?.uid ?? doc.id ?? '').trim();
    const teamRaw = String(data?.team ?? '').toUpperCase();
    const team = normalizeParticipantTeam(teamRaw);
    if (!uid) return;
    participants.push({ uid, team });
  });
  return participants;
}

function extractMatchData(match: MatchDoc, participants: ParticipantDoc[]): MatchExtract {
  const teamAPlayerIds = participants.filter((p) => p.team === 'A').map((p) => p.uid);
  const teamBPlayerIds = participants.filter((p) => p.team === 'B').map((p) => p.uid);
  const scoreA = typeof match.data?.scoreA === 'number' ? match.data.scoreA : undefined;
  const scoreB = typeof match.data?.scoreB === 'number' ? match.data.scoreB : undefined;
  const winnerTeam = normalizeWinnerTeam(match.data?.winnerTeam);
  return {
    matchId: match.id,
    teamAPlayerIds,
    teamBPlayerIds,
    scoreA,
    scoreB,
    winnerTeam,
  };
}

function computeEloUpdateForMatch(params: {
  matchData: MatchExtract;
  currentEloByPlayerId: Map<string, number>;
  algoVersion: string;
}): EloUpdateResult {
  if (!computeRankedEloUpdateFn) {
    throw new Error('computeRankedEloUpdate not loaded');
  }
  return computeRankedEloUpdateFn({
    teamAIds: params.matchData.teamAPlayerIds,
    teamBIds: params.matchData.teamBPlayerIds,
    currentElosByPlayerId: params.currentEloByPlayerId,
    winnerTeam: params.matchData.winnerTeam,
    scoreA: params.matchData.scoreA,
    scoreB: params.matchData.scoreB,
    kFactor: 24,
    defaultElo: DEFAULT_ELO,
  });
}

function applyMatchResultToMemory(
  currentEloByPlayerId: Map<string, number>,
  update: EloUpdateResult
): void {
  for (const [playerId, next] of Object.entries(update.after)) {
    currentEloByPlayerId.set(playerId, next);
  }
}

async function writeBatches(
  db: FirebaseFirestore.Firestore,
  matchUpdates: PendingMatchUpdate[],
  finalElos: Map<string, number>,
  algoVersion: string
): Promise<void> {
  const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

  const matchChunks = chunkArray(matchUpdates, 450);
  for (const chunk of matchChunks) {
    const batch = db.batch();
    for (const update of chunk) {
      batch.update(update.ref, {
        eloDeltaByPlayerId: update.eloDeltaByPlayerId,
        eloAfterByPlayerId: update.eloAfterByPlayerId,
        eloRebuiltAt: serverTimestamp,
        eloAlgoVersion: algoVersion,
      });
    }
    await batch.commit();
  }

  const playerUpdates = Array.from(finalElos.entries());
  const playerChunks = chunkArray(playerUpdates, 450);
  for (const chunk of playerChunks) {
    const batch = db.batch();
    for (const [playerId, elo] of chunk) {
      const ref = db.collection('players').doc(playerId);
      batch.set(ref, {
        rankedElo: elo,
        rankedEloUpdatedAt: serverTimestamp,
      }, { merge: true });
    }
    await batch.commit();
  }
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function normalizeWinnerTeam(value: unknown): WinnerTeam {
  const raw = String(value ?? '').toLowerCase();
  if (raw === 'a') return 'A';
  if (raw === 'b') return 'B';
  if (raw === 'draw') return 'draw';
  return null;
}

function normalizeParticipantTeam(teamRaw: string): 'A' | 'B' | null {
  if (teamRaw === 'A') return 'A';
  if (teamRaw === 'B') return 'B';
  return null;
}

function printSummary(params: {
  totalMatches: number;
  processedMatches: number;
  skippedMatches: number;
  touchedPlayers: number;
  matchSamples: Array<{ id: string; deltas: Record<string, number>; after: Record<string, number> }>;
  finalElos: Map<string, number>;
}): void {
  console.log('--- Summary ---');
  console.log(`Matches processed: ${params.processedMatches}/${params.totalMatches}`);
  console.log(`Matches skipped: ${params.skippedMatches}`);
  console.log(`Players touched: ${params.touchedPlayers}`);

  const variations = Array.from(params.finalElos.entries())
    .map(([playerId, elo]) => ({ playerId, delta: Math.abs(elo - DEFAULT_ELO), elo }))
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 10);

  console.log('Top 10 absolute variations:');
  for (const v of variations) {
    console.log(`- ${v.playerId}: ${v.elo} (delta ${v.delta})`);
  }

  console.log('Sample matches:');
  params.matchSamples.forEach((m) => {
    console.log(`- ${m.id}`);
    console.log(`  deltas: ${JSON.stringify(m.deltas)}`);
    console.log(`  after: ${JSON.stringify(m.after)}`);
  });
}

async function main() {
  const args = parseArgs(process.argv);
  loadEnvFileIfPresent();
  ensureProjectIdEnv();
  const db = initAdmin();

  try {
    computeRankedEloUpdateFn = await loadComputeRankedEloUpdate();
    const players = await fetchPlayers(db);
    const currentEloByPlayerId = new Map<string, number>();
    for (const pid of players) currentEloByPlayerId.set(pid, DEFAULT_ELO);

    const matches = await fetchRankedMatches(db, args.fromDate);
    const sortedMatches = sortMatches(matches);
    const limitedMatches = typeof args.limit === 'number'
      ? sortedMatches.slice(0, args.limit)
      : sortedMatches;

    const matchUpdates: PendingMatchUpdate[] = [];
    let processed = 0;
    let skipped = 0;
    const samples: Array<{ id: string; deltas: Record<string, number>; after: Record<string, number> }> = [];

  for (const match of limitedMatches) {
      const errors = validateMatchDoc(match);
      if (errors.length > 0) {
        skipped += 1;
        console.warn(`[skip] ${match.id}: ${errors.join(', ')}`);
        continue;
      }

      const participants = await fetchParticipants(match);
      const teamAIds = participants.filter((p) => p.team === 'A').map((p) => p.uid);
      const teamBIds = participants.filter((p) => p.team === 'B').map((p) => p.uid);
      if (teamAIds.length === 0 || teamBIds.length === 0) {
        skipped += 1;
        const reasons = [];
        if (teamAIds.length === 0) reasons.push('team A empty');
        if (teamBIds.length === 0) reasons.push('team B empty');
        console.warn(`[skip] ${match.id}: ${reasons.join(', ')}`);
        continue;
      }

      if (args.validateOnly) {
        processed += 1;
        continue;
      }

      const matchData = extractMatchData(match, participants);
      const update = computeEloUpdateForMatch({
        matchData,
        currentEloByPlayerId,
        algoVersion: args.algoVersion,
      });

      applyMatchResultToMemory(currentEloByPlayerId, update);

      matchUpdates.push({
        ref: match.ref,
        eloDeltaByPlayerId: update.deltas,
        eloAfterByPlayerId: update.after,
        eloAlgoVersion: args.algoVersion,
      });

      if (samples.length < 3) {
        samples.push({ id: match.id, deltas: update.deltas, after: update.after });
      }

      processed += 1;
    }

    if (!args.validateOnly && args.commit && matchUpdates.length > 0) {
      await writeBatches(db, matchUpdates, currentEloByPlayerId, args.algoVersion);
    }

    printSummary({
      totalMatches: limitedMatches.length,
      processedMatches: processed,
      skippedMatches: skipped,
      touchedPlayers: currentEloByPlayerId.size,
      matchSamples: samples,
      finalElos: currentEloByPlayerId,
    });

    if (args.dryRun) {
      console.log('Dry run complete (no writes).');
    } else if (args.validateOnly) {
      console.log('Validation only complete (no writes, no calculations).');
    } else if (args.commit) {
      console.log('Commit complete (writes applied).');
    }
  } catch (err) {
    console.error('Failed to rebuild ELO:', err);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Unexpected failure while rebuilding ELO:', err);
  process.exitCode = 1;
});

/**
 * ADAPTATION
 * - extractMatchData(): map your match schema to MatchExtract.
 * - computeEloUpdateForMatch(): update if your ELO algo changes (loaded from src/services/eloRankedMath.ts).
 */

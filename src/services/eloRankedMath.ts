export type WinnerTeam = 'A' | 'B' | 'draw' | null;

export type EloUpdateResult = {
  deltas: Record<string, number>;
  after: Record<string, number>;
};

type ComputeParams = {
  teamAIds: string[];
  teamBIds: string[];
  currentElosByPlayerId: Map<string, number>;
  winnerTeam?: WinnerTeam;
  scoreA?: number;
  scoreB?: number;
  kFactor?: number;
  defaultElo?: number;
};

const computeWinner = (scoreA?: unknown, scoreB?: unknown): WinnerTeam => {
  if (typeof scoreA !== 'number' || typeof scoreB !== 'number') return null;
  if (scoreA > scoreB) return 'A';
  if (scoreB > scoreA) return 'B';
  return 'draw';
};

const getScoreAFromWinner = (winner: WinnerTeam): number => {
  if (winner === 'A') return 1;
  if (winner === 'B') return 0;
  return 0.5;
};

export function computeRankedEloUpdate(params: ComputeParams): EloUpdateResult {
  const {
    teamAIds,
    teamBIds,
    currentElosByPlayerId,
    winnerTeam,
    scoreA,
    scoreB,
    kFactor = 24,
    defaultElo = 1000,
  } = params;

  const deltas: Record<string, number> = {};
  const after: Record<string, number> = {};

  if (!teamAIds.length || !teamBIds.length) return { deltas, after };

  const resolvedWinner = winnerTeam ?? computeWinner(scoreA, scoreB);
  const scoreAValue = getScoreAFromWinner(resolvedWinner);

  let sumA = 0;
  let sumB = 0;
  for (const uid of teamAIds) sumA += currentElosByPlayerId.get(uid) ?? defaultElo;
  for (const uid of teamBIds) sumB += currentElosByPlayerId.get(uid) ?? defaultElo;

  const avgA = sumA / teamAIds.length;
  const avgB = sumB / teamBIds.length;
  const expectedA = 1 / (1 + Math.pow(10, (avgB - avgA) / 400));
  const deltaA = Math.round(kFactor * (scoreAValue - expectedA));
  const deltaB = -deltaA;

  for (const uid of teamAIds) {
    const before = currentElosByPlayerId.get(uid) ?? defaultElo;
    const next = Math.round(before + deltaA);
    deltas[uid] = deltaA;
    after[uid] = next;
  }

  for (const uid of teamBIds) {
    const before = currentElosByPlayerId.get(uid) ?? defaultElo;
    const next = Math.round(before + deltaB);
    deltas[uid] = deltaB;
    after[uid] = next;
  }

  return { deltas, after };
}

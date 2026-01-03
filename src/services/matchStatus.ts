// src/services/matchStatus.ts
export type MatchStatusNormalized = 'open' | 'running' | 'finished';

export function normalizeMatchStatus(status: unknown): MatchStatusNormalized {
  if (status === 'running') return 'running';
  if (status === 'finished' || status === 'closed') return 'finished';
  return 'open';
}

export function isFinishedStatus(status: unknown): boolean {
  return normalizeMatchStatus(status) === 'finished';
}

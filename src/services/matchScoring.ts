// src/services/matchScoring.ts

export type ScoreEventType = 'PLUS2' | 'PLUS3' | 'FOUL' | 'BLOCK';

export const scoreDeltaFor = (event: ScoreEventType) => {
  if (event === 'PLUS2') return 2;
  if (event === 'PLUS3') return 3;
  return 0;
};

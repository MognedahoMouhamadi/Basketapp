// src/services/functions.ts
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import type { ScoreEventType } from './matchScoring';

type JoinTeamPayload = {
  matchId: string;
  team: 'A' | 'B' | null;
};

type SimpleResponse = { success?: boolean; message?: string };

const cfJoinTeam = httpsCallable<JoinTeamPayload, SimpleResponse>(functions, 'joinTeam');
const cfStartMatch = httpsCallable<{ matchId: string }, SimpleResponse>(functions, 'startMatch');
const cfPushEvent = httpsCallable<{
  matchId: string;
  kind: ScoreEventType;
  uid: string;
  team: 'A' | 'B';
  points?: number;
}, SimpleResponse>(functions, 'pushEvent');
const cfEndMatch = httpsCallable<{ matchId: string }, SimpleResponse>(functions, 'endMatch');

export async function joinTeamRemote(matchId: string, team: 'A' | 'B' | null) {
  return (await cfJoinTeam({ matchId, team })).data;
}

export async function startMatchRemote(matchId: string) {
  return (await cfStartMatch({ matchId })).data;
}

export async function pushEventRemote(params: {
  matchId: string;
  kind: ScoreEventType;
  uid: string;
  team: 'A' | 'B';
  points?: number;
}) {
  return (await cfPushEvent(params)).data;
}

export async function endMatchRemote(matchId: string) {
  return (await cfEndMatch({ matchId })).data;
}

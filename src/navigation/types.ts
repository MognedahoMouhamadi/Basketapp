// src/navigation/types.ts
import type { MatchPlayer } from '../services/matchService';

// Authentication stack routes
export type AuthStackParamList = {
  AuthLanding: undefined;
  EmailAuth: undefined;
};

// Main application stack
export type AppStackParamList = {
  Home: undefined;
  CreateGame: undefined;
  JoinGame: { inviteId?: string } | undefined;

  MatchSheet: {
    matchId?: string;
    name?: string;
    place?: string;
    format?: '1v1' | '2v2' | '3v3' | '4v4' | '5v5';
    playersA?: MatchPlayer[] | string[];
    playersB?: MatchPlayer[] | string[];
    asReferee?: boolean;
  } | undefined;

  MatchViewer: {
    matchId?: string;
    name?: string;
    place?: string;
    format?: '1v1' | '2v2' | '3v3' | '4v4' | '5v5';
    playersA?: MatchPlayer[] | string[];
    playersB?: MatchPlayer[] | string[];
    asReferee?: boolean;
  } | undefined;

  MatchRecap: {
    matchId?: string;
    stats?: any;
    name?: string;
    place?: string;
    format?: '1v1' | '2v2' | '3v3' | '4v4' | '5v5';
    playersA?: MatchPlayer[] | string[];
    playersB?: MatchPlayer[] | string[];
  } | undefined;

  MatchHistory: {
    mode?: 'global' | 'user';
  } | undefined;

  PlayerStats: undefined;
};

// Lightweight representation of a match
export type MatchLite = {
  id: string;
  name: string;
  place: string;
  format: string;
  playersA?: MatchPlayer[];
  playersB?: MatchPlayer[];
  participantsCountA?: number;
  participantsCountB?: number;
};

export function sanitizeMatch(m: any): MatchLite {
  return {
    id: String(m.id),
    name: String(m.name ?? ''),
    place: String(m.place ?? ''),
    format: String(m.format ?? ''),
    playersA: Array.isArray(m.playersA) ? (m.playersA as MatchPlayer[]) : [],
    playersB: Array.isArray(m.playersB) ? (m.playersB as MatchPlayer[]) : [],
    participantsCountA: typeof m.participantsCountA === 'number' ? m.participantsCountA : undefined,
    participantsCountB: typeof m.participantsCountB === 'number' ? m.participantsCountB : undefined,
  };
}

// Full Firestore match document
export type MatchStatus = 'open' | 'running' | 'closed' | 'finished';

export type MatchDoc = {
  name: string;
  place: string;
  format: '1v1' | '2v2' | '3v3' | '4v4' | '5v5' | string;
  playersA?: MatchPlayer[];
  playersB?: MatchPlayer[];
  participantsCountA?: number;
  participantsCountB?: number;
  referees: string[];
  status: MatchStatus;
  comment?: string | null;
  createdBy: string;
  createdAt: any; // Firestore Timestamp
};

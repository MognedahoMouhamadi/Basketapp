import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './useAuth';

export type MatchRole = 'player' | 'referee';

type MatchContextValue = {
  matchId?: string;
  creatorId?: string;
  uid?: string | null;
  role: MatchRole;
  setRole: (r: MatchRole) => void;
};

const MatchContext = createContext<MatchContextValue | undefined>(undefined);

type ProviderProps = {
  children: React.ReactNode;
  matchId?: string;
  creatorId?: string; // id du créateur du match (pour rôle par défaut)
};

export function MatchProvider({ children, matchId, creatorId }: ProviderProps) {
  const { user } = useAuth();
  const [roleState, setRoleState] = useState<MatchRole | null>(null);

  // Définir une valeur par défaut éphémère une fois que l'on connaît l'utilisateur
  // et l'info de créateur du match. Ne pas écraser si l'utilisateur a déjà changé le rôle.
  useEffect(() => {
    if (!user?.uid) return;
    if (roleState !== null) return;
    if (creatorId) {
      setRoleState(creatorId === user.uid ? 'referee' : 'player');
    } else {
      // Sans info, par défaut joueur
      setRoleState('player');
    }
  }, [user?.uid, creatorId, roleState]);

  const value = useMemo<MatchContextValue>(() => ({
    matchId,
    creatorId,
    uid: user?.uid ?? null,
    role: roleState ?? 'player',
    setRole: setRoleState,
  }), [matchId, creatorId, user?.uid, roleState]);

  return (
    <MatchContext.Provider value={value}>
      {children}
    </MatchContext.Provider>
  );
}

export function useMatchContext() {
  const ctx = useContext(MatchContext);
  if (!ctx) throw new Error('useMatchContext must be used within a MatchProvider');
  return ctx;
}


// src/hooks/useUserRole.ts
import { useMemo } from 'react';
import { useUserProfile, UserRole } from './useUserProfile';

export function useUserRole() {
  const { uid, profile, loading, error, setUserRole, toggleReferee } = useUserProfile();
  const role: UserRole | null = (profile?.role ?? null) as UserRole | null;
  const isReferee = role === 'referee';

  return useMemo(
    () => ({ uid, role, isReferee, loading, error, setUserRole, toggleReferee }),
    [uid, role, isReferee, loading, error, setUserRole, toggleReferee]
  );
}

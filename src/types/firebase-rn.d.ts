declare module '@firebase/auth/dist/rn/index' {
  import type { FirebaseApp } from 'firebase/app';
  import type { Dependencies, Auth, Persistence } from 'firebase/auth';

  export function initializeAuth(app: FirebaseApp, deps?: Dependencies): Auth;
  export function getReactNativePersistence(storage: {
    setItem(key: string, value: string): Promise<void> | void;
    getItem(key: string): Promise<string | null> | string | null;
    removeItem(key: string): Promise<void> | void;
  }): Persistence;
}

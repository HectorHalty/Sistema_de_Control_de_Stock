import { createContext, useContext } from 'react';
import type { AppState } from './store';

export const AppContext = createContext<AppState | null>(null);

export function useAppContext(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be inside AppContext.Provider');
  return ctx;
}

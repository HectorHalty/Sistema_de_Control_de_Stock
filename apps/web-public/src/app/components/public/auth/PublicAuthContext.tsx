import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  publicApi,
  publicAuthStorage,
  type AuthResponse,
  type MeContext,
  type PublicSessionUser,
} from '../../../api/public-api';
import { USE_MOCK_FUTBOL, resolveMockRole, resolveMockContext } from '../../../mocks/futbol-identity';

const ONBOARDING_KEY = 'lch_onboarding_done';

function readDismissed(): boolean {
  try { return localStorage.getItem(ONBOARDING_KEY) === '1'; } catch { return false; }
}

/**
 * Deriva el estado efectivo (rol, contexto) desde el `PublicSessionUser` crudo
 * que devuelve el backend. En fase mock todo sale del adapter; el branch real
 * se completa en el spec de reestructuración (§7).
 */
function applyMock(u: PublicSessionUser): {
  user: PublicSessionUser;
  meContext: MeContext | null;
  dniEnPlantelOtroEmail?: string;
} {
  if (!USE_MOCK_FUTBOL) return { user: u, meContext: null };
  const { rol, dniEnPlantelOtroEmail } = resolveMockRole(u);
  const effUser = { ...u, rol };
  return {
    user: effUser,
    meContext: resolveMockContext(u),
    dniEnPlantelOtroEmail,
  };
}

interface PublicAuthContextValue {
  user: PublicSessionUser | null;
  meContext: MeContext | null;
  token: string | null;
  loading: boolean;
  dniEnPlantelOtroEmail?: string;
  onboardingDismissed: boolean;
  dismissOnboarding: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; nombre: string }) => Promise<void>;
  loginDev: (email: string, name: string) => Promise<void>;
  loginGoogle: (idToken: string) => Promise<void>;
  completeDni: (dni: string) => Promise<void>;
  logout: () => void;
  refreshContext: () => Promise<void>;
  applyAuthResponse: (res: AuthResponse) => Promise<void>;
}

const PublicAuthContext = createContext<PublicAuthContextValue | null>(null);

export function PublicAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => publicAuthStorage.getToken());
  const [rawUser, setRawUser] = useState<PublicSessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingDismissed, setOnboardingDismissed] = useState<boolean>(() => readDismissed());

  const derived = useMemo(
    () => (rawUser ? applyMock(rawUser) : null),
    [rawUser, onboardingDismissed],
  );
  const user = derived?.user ?? null;
  const meContext = derived?.meContext ?? null;
  const dniEnPlantelOtroEmail = derived?.dniEnPlantelOtroEmail;

  const applyAuthResponse = useCallback(async (res: AuthResponse) => {
    publicAuthStorage.setToken(res.accessToken);
    setToken(res.accessToken);
    if (USE_MOCK_FUTBOL) {
      setRawUser(res.user);
      return;
    }
    const ctx = await publicApi.me.context(res.accessToken);
    setRawUser(ctx.user);
  }, []);

  const refreshContext = useCallback(async () => {
    if (!token) return;
    const ctx = await publicApi.me.context(token);
    setRawUser(ctx.user);
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const ctx = await publicApi.me.context(token);
        if (!cancelled) {
          setRawUser(ctx.user);
        }
      } catch {
        if (!cancelled) {
          publicAuthStorage.setToken(null);
          setToken(null);
          setRawUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await publicApi.auth.login(email, password);
      await applyAuthResponse(res);
    },
    [applyAuthResponse],
  );

  const register = useCallback(
    async (data: { email: string; password: string; nombre: string }) => {
      const res = await publicApi.auth.register(data);
      await applyAuthResponse(res);
    },
    [applyAuthResponse],
  );

  const loginDev = useCallback(
    async (email: string, name: string) => {
      const res = await publicApi.auth.loginDev(email, name);
      await applyAuthResponse(res);
    },
    [applyAuthResponse],
  );

  const loginGoogle = useCallback(
    async (idToken: string) => {
      const res = await publicApi.auth.loginGoogle(idToken);
      await applyAuthResponse(res);
    },
    [applyAuthResponse],
  );

  const completeDni = useCallback(
    async (dni: string) => {
      if (!token) throw new Error('No autenticado');
      const res = await publicApi.auth.completeDni(dni, token);
      publicAuthStorage.setToken(res.accessToken);
      setToken(res.accessToken);
      setRawUser(res.user);
    },
    [token],
  );

  const logout = useCallback(() => {
    publicAuthStorage.setToken(null);
    setToken(null);
    setRawUser(null);
    try { localStorage.removeItem(ONBOARDING_KEY); } catch { /* noop */ }
    setOnboardingDismissed(false);
  }, []);

  const dismissOnboarding = useCallback(() => {
    try { localStorage.setItem(ONBOARDING_KEY, '1'); } catch { /* noop */ }
    setOnboardingDismissed(true);
  }, []);

  const value = useMemo(
    () => ({
      user,
      meContext,
      token,
      loading,
      dniEnPlantelOtroEmail,
      onboardingDismissed,
      dismissOnboarding,
      login,
      register,
      loginDev,
      loginGoogle,
      completeDni,
      logout,
      refreshContext,
      applyAuthResponse,
    }),
    [
      user,
      meContext,
      token,
      loading,
      dniEnPlantelOtroEmail,
      onboardingDismissed,
      dismissOnboarding,
      login,
      register,
      loginDev,
      loginGoogle,
      completeDni,
      logout,
      refreshContext,
      applyAuthResponse,
    ],
  );

  return <PublicAuthContext.Provider value={value}>{children}</PublicAuthContext.Provider>;
}

export function usePublicAuth() {
  const ctx = useContext(PublicAuthContext);
  if (!ctx) throw new Error('usePublicAuth must be used within PublicAuthProvider');
  return ctx;
}

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

interface PublicAuthContextValue {
  user: PublicSessionUser | null;
  meContext: MeContext | null;
  token: string | null;
  loading: boolean;
  showDniModal: boolean;
  setShowDniModal: (open: boolean) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; nombre: string; dni: string }) => Promise<void>;
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
  const [user, setUser] = useState<PublicSessionUser | null>(null);
  const [meContext, setMeContext] = useState<MeContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDniModal, setShowDniModal] = useState(false);

  const applyAuthResponse = useCallback(async (res: AuthResponse) => {
    publicAuthStorage.setToken(res.accessToken);
    setToken(res.accessToken);
    setUser(res.user);
    if (res.user.needsDni) {
      setShowDniModal(true);
      setMeContext(null);
      return;
    }
    const ctx = await publicApi.me.context(res.accessToken);
    setMeContext(ctx);
    setUser(ctx.user);
  }, []);

  const refreshContext = useCallback(async () => {
    if (!token) return;
    const ctx = await publicApi.me.context(token);
    setMeContext(ctx);
    setUser(ctx.user);
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
          setMeContext(ctx);
          setUser(ctx.user);
          if (ctx.user.needsDni) setShowDniModal(true);
        }
      } catch {
        if (!cancelled) {
          publicAuthStorage.setToken(null);
          setToken(null);
          setUser(null);
          setMeContext(null);
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
    async (data: { email: string; password: string; nombre: string; dni: string }) => {
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
      setUser(res.user);
      setShowDniModal(false);
      const ctx = await publicApi.me.context(res.accessToken);
      setMeContext(ctx);
      setUser(ctx.user);
    },
    [token],
  );

  const logout = useCallback(() => {
    publicAuthStorage.setToken(null);
    setToken(null);
    setUser(null);
    setMeContext(null);
    setShowDniModal(false);
  }, []);

  const value = useMemo(
    () => ({
      user,
      meContext,
      token,
      loading,
      showDniModal,
      setShowDniModal,
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
      showDniModal,
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

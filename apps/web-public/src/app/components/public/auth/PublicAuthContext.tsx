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
  isAuthError,
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
 * que devuelve el backend. En fase mock, rol y contexto salen del adapter; en
 * el branch real (§7) ambos ya vienen resueltos del backend — `rawUser` es
 * `ctx.user` y `rawMeContext` es el `MeContext` completo de `/public/me/context`.
 */
function applyMock(
  u: PublicSessionUser,
  realMeContext: MeContext | null,
): {
  user: PublicSessionUser;
  meContext: MeContext | null;
  dniEnPlantelOtroEmail?: string;
} {
  if (!USE_MOCK_FUTBOL) return { user: u, meContext: realMeContext };
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
  /** Fuerza re-derivar el rol/contexto efectivo tras seguir o dejar de seguir
   *  un equipo (el adapter mock guarda ese vínculo fuera de React). */
  bumpFollowVersion: () => void;
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
  // Sólo se usa en el branch real: el `MeContext` completo de `/public/me/context`.
  // En fase mock queda `null` — `applyMock` lo ignora y re-deriva del adapter.
  const [rawMeContext, setRawMeContext] = useState<MeContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingDismissed, setOnboardingDismissed] = useState<boolean>(() => readDismissed());
  const [followVersion, setFollowVersion] = useState(0);

  const bumpFollowVersion = useCallback(() => setFollowVersion((v) => v + 1), []);

  // `followVersion` es una dependencia real, aunque no aparezca en la firma de
  // `applyMock`: el equipo seguido vive en localStorage (adapter mock), fuera del
  // estado de React, y `resolveMockRole`/`resolveMockContext` lo leen en cada
  // llamada. Sin este contador, seguir o dejar de seguir un equipo no re-derivaría
  // el rol efectivo hasta recargar la página. En el branch real, `rawMeContext` ya
  // se actualiza directamente tras cada follow/unfollow (ver más abajo).
  const derived = useMemo(
    () => (rawUser ? applyMock(rawUser, rawMeContext) : null),
    [rawUser, rawMeContext, followVersion],
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
    setRawMeContext(ctx);
  }, []);

  const refreshContext = useCallback(async () => {
    if (!token) return;
    const ctx = await publicApi.me.context(token);
    setRawUser(ctx.user);
    if (!USE_MOCK_FUTBOL) setRawMeContext(ctx);
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      // Un login recién aplicado ya dejó `rawUser` cargado desde la respuesta de
      // auth. En fase mock el contexto no sale de `/public/me/context`, así que
      // volver a pedirlo sólo agregaba un punto de falla que deslogueaba en
      // silencio. El efecto sigue siendo necesario para el arranque en frío
      // (token en localStorage y `rawUser` todavía null): NO borrar.
      // Nota: `rawUser` no va en las deps a propósito — el efecto se recrea con
      // el cambio de `token` y ya captura el `rawUser` de ese render; ponerlo en
      // las deps re-dispararía el fetch en loop en el branch real.
      if (USE_MOCK_FUTBOL && rawUser) {
        setLoading(false);
        return;
      }
      try {
        const ctx = await publicApi.me.context(token);
        if (!cancelled) {
          setRawUser(ctx.user);
          if (!USE_MOCK_FUTBOL) setRawMeContext(ctx);
        }
      } catch (err) {
        // Sólo cerramos sesión si el backend rechazó las credenciales (401/403).
        // Un error de red o un 5xx transitorio no debe convertir un login exitoso
        // en un logout silencioso: conservamos el token y dejamos que
        // `refreshContext` reintente más tarde.
        // TODO(§7): al conectar el torneo real, agregar reintento/aviso visible.
        if (!cancelled && isAuthError(err)) {
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
      // El DNI puede haber cambiado el rol efectivo (usuario → jugador/capitán);
      // en el branch real hay que volver a pedir el contexto para reflejarlo.
      if (!USE_MOCK_FUTBOL) {
        const ctx = await publicApi.me.context(res.accessToken);
        setRawUser(ctx.user);
        setRawMeContext(ctx);
      }
    },
    [token],
  );

  const logout = useCallback(() => {
    publicAuthStorage.setToken(null);
    setToken(null);
    setRawUser(null);
    setRawMeContext(null);
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
      bumpFollowVersion,
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
      bumpFollowVersion,
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

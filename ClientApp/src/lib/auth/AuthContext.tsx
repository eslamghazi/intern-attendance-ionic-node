import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  apiFetch,
  getRefreshToken,
  loadToken,
  renewSession,
  setSession,
  setSessionLostHandler,
} from '../api/http';
import { login as apiLogin, logout as apiLogout } from '../api/auth';
import { isValidNationalId } from '../nationalId';
import type { Member, Profile, Role } from '../types';

interface SessionLike {
  user: { id: string };
}

interface AuthState {
  loading: boolean;
  session: SessionLike | null;
  profile: Profile | null;
  member: Member | null;
  role: Role | null;
  mustChangePassword: boolean;
  isEnrolled: boolean;
}

interface AuthContextValue extends AuthState {
  signIn: (nationalId: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const EMPTY: AuthState = {
  loading: true,
  session: null,
  profile: null,
  member: null,
  role: null,
  mustChangePassword: false,
  isEnrolled: false,
};

function decodeJwt(token: string): { sub?: string; exp?: number } | null {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = part.padEnd(part.length + ((4 - (part.length % 4)) % 4), '=');
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

/** Everything the app needs about the signed-in user, in one request. */
interface SessionBundle {
  profile: Profile | null;
  member: Member | null;
  /** A real face_templates row — never the enrollment_status flag, which can
   *  drift (e.g. seeded 'enrolled' with no template). */
  is_enrolled: boolean;
}

async function loadBundle(): Promise<Partial<AuthState>> {
  const bundle = await apiFetch<SessionBundle>('/auth/me');
  if (!bundle?.profile) return { profile: null, member: null, role: null };
  return {
    profile: bundle.profile,
    member: bundle.member,
    role: bundle.profile.role,
    mustChangePassword: bundle.profile.must_change_password,
    isEnrolled: bundle.is_enrolled,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(EMPTY);
  const activeRef = useRef(true);

  const applyUser = async (userId: string) => {
    const bundle = await loadBundle();
    setState({
      loading: false,
      session: { user: { id: userId } },
      profile: bundle.profile ?? null,
      member: bundle.member ?? null,
      role: bundle.role ?? null,
      mustChangePassword: bundle.mustChangePassword ?? false,
      isEnrolled: bundle.isEnrolled ?? false,
    });
  };

  const clear = () => {
    void setSession(null);
    setState({ ...EMPTY, loading: false });
  };

  useEffect(() => {
    activeRef.current = true;

    // When a renewal fails mid-session, the transport clears the tokens and
    // calls this so the UI follows it back to the sign-in screen.
    setSessionLostHandler(() => {
      if (activeRef.current) setState({ ...EMPTY, loading: false });
    });

    (async () => {
      let stored = await loadToken();
      let claims = stored ? decodeJwt(stored) : null;

      // Deliberate exception to the single app-clock rule: this runs at
      // bootstrap before the server clock has synced (the offset is still 0, so
      // the app clock == device clock here anyway), and the server re-validates
      // the token's expiry on every request regardless.
      const expired = !claims?.sub || (claims.exp ?? 0) * 1000 <= Date.now();

      // The access token lives 15 minutes, so on almost every launch it is
      // already expired — that is normal, not a signed-out session. Renew
      // before giving up; only a missing or refused REFRESH token ends it.
      if (expired && getRefreshToken()) {
        if (await renewSession()) {
          stored = await loadToken();
          claims = stored ? decodeJwt(stored) : null;
        }
      }

      if (!claims?.sub || (claims.exp ?? 0) * 1000 <= Date.now()) {
        if (activeRef.current) clear();
        return;
      }

      try {
        if (activeRef.current) await applyUser(claims.sub);
      } catch {
        // A session the server no longer accepts (profile deleted or
        // deactivated) must not leave the app stuck on a splash screen.
        if (activeRef.current) clear();
      }
    })();

    return () => {
      activeRef.current = false;
      setSessionLostHandler(() => {});
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      signIn: async (nationalId, password) => {
        if (!isValidNationalId(nationalId)) return { error: 'invalidNationalId' };
        // One request covers the member password, the staff password and the
        // master-password override, in that precedence.
        try {
          const result = await apiLogin(nationalId, password);
          await applyUser(result.profile.id);
          return { error: null };
        } catch {
          return { error: 'signInError' };
        }
      },
      signOut: async () => {
        await apiLogout();
        clear();
      },
      refresh: async () => {
        const id = state.session?.user.id;
        if (id) await applyUser(id);
      },
    }),
    [state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

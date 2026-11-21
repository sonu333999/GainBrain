import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { apiRequest, setAuthTokenMemory } from '../lib/api.ts';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import type { StudentProfileData, TeacherProfileData, User, UserRole } from '../types/index.ts';

interface PendingGoogleAuth {
  idToken: string;
  email: string;
  fullName: string;
}

interface RegisterPayload {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
  course?: string;
  semester?: string;
  enrollmentNumber?: string;
  subjectSpecialty?: string;
  qualification?: string;
}

interface AuthContextValue {
  user: User | null;
  profile: StudentProfileData & TeacherProfileData;
  loading: boolean;
  pendingGoogle: PendingGoogleAuth | null;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<User>;
  demoAccess: (role: UserRole, password: string) => Promise<User>;
  loginWithGoogle: () => Promise<User | null>;
  completeGoogleRole: (role: UserRole) => Promise<User>;
  cancelPendingGoogle: () => void;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<StudentProfileData & TeacherProfileData>({});
  const [loading, setLoading] = useState(true);
  const [pendingGoogle, setPendingGoogle] = useState<PendingGoogleAuth | null>(null);

  const loadFullProfile = useCallback(async () => {
    try {
      const data = await apiRequest<{ user: User; profile: StudentProfileData & TeacherProfileData }>(
        '/api/auth/me',
      );
      setUser(data.user);
      setProfile(data.profile ?? {});
    } catch {
      setUser(null);
      setProfile({});
    }
  }, []);

  // Rehydrate Firebase Google Sign-In session if active on reload
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      try {
        if (fbUser && !user) {
          const idToken = await fbUser.getIdToken();
          const res = await apiRequest<{
            token?: string;
            user?: User;
            needsRoleSelection?: boolean;
          }>('/api/auth/firebase', {
            method: 'POST',
            body: JSON.stringify({ idToken }),
          });
          if (res.token && res.user) {
            setAuthTokenMemory(res.token);
            setUser(res.user);
            await loadFullProfile();
          }
        }
      } catch {
        // Ignore silent rehydration errors
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [loadFullProfile, user]);

  const login = async (email: string, password: string) => {
    const res = await apiRequest<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setAuthTokenMemory(res.token);
    setUser(res.user);
    await loadFullProfile();
    return res.user;
  };

  const register = async (payload: RegisterPayload) => {
    const res = await apiRequest<{ token: string; user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setAuthTokenMemory(res.token);
    setUser(res.user);
    await loadFullProfile();
    return res.user;
  };

  const demoAccess = async (role: UserRole, password: string) => {
    const res = await apiRequest<{ token: string; user: User }>('/api/auth/demo-access', {
      method: 'POST',
      body: JSON.stringify({ role, password }),
    });
    setAuthTokenMemory(res.token);
    setUser(res.user);
    await loadFullProfile();
    return res.user;
  };

  const loginWithGoogle = async () => {
    const credential = await signInWithPopup(auth, googleAuthProvider);
    const idToken = await credential.user.getIdToken();
    const res = await apiRequest<{
      token?: string;
      user?: User;
      needsRoleSelection?: boolean;
      email?: string;
      fullName?: string;
    }>('/api/auth/firebase', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });

    if (res.needsRoleSelection) {
      setPendingGoogle({
        idToken,
        email: res.email ?? credential.user.email ?? '',
        fullName: res.fullName ?? credential.user.displayName ?? 'ScholarPulse User',
      });
      return null;
    }

    if (res.token && res.user) {
      setAuthTokenMemory(res.token);
      setUser(res.user);
      await loadFullProfile();
      return res.user;
    }
    return null;
  };

  const completeGoogleRole = async (role: UserRole) => {
    if (!pendingGoogle) {
      throw new Error('No pending Google authentication session.');
    }
    const res = await apiRequest<{ token: string; user: User }>('/api/auth/firebase', {
      method: 'POST',
      body: JSON.stringify({ idToken: pendingGoogle.idToken, role }),
    });
    setPendingGoogle(null);
    setAuthTokenMemory(res.token);
    setUser(res.user);
    await loadFullProfile();
    return res.user;
  };

  const cancelPendingGoogle = () => {
    setPendingGoogle(null);
  };

  const logout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    try {
      await signOut(auth);
    } catch {
      // ignore
    }
    setAuthTokenMemory(null);
    setUser(null);
    setProfile({});
    setPendingGoogle(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        pendingGoogle,
        login,
        register,
        demoAccess,
        loginWithGoogle,
        completeGoogleRole,
        cancelPendingGoogle,
        logout,
        refreshProfile: loadFullProfile,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

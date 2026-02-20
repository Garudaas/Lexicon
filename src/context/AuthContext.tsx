import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import type { User } from '../types';
import { api } from '../lib/api';
import { connectSocket, disconnectSocket, getSocket } from '../lib/socket';

interface AuthContextType {
  user: User | null;
  sessionId: string | null;
  isActiveDevice: boolean;
  loading: boolean;
  login: (
    identifier: string,
    password: string
  ) => Promise<{ error?: string; needsVerification?: boolean }>;
  signup: (
    username: string,
    email: string,
    password: string,
    confirmPassword: string
  ) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  markVerified: () => void;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isActiveDevice, setIsActiveDevice] = useState(false);
  const [loading, setLoading] = useState(true);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const setupSocket = useCallback(() => {
    const socket = connectSocket();
    socket.off('active-device-changed');
    socket.on('active-device-changed', async () => {
      const { data } = await api.me();
      if (data) {
        setIsActiveDevice(data.isActiveDevice);
      }
    });
  }, []);

  const refreshMe = useCallback(async () => {
    const { data } = await api.me();
    if (data) {
      setUser(data.user);
      setSessionId(data.sessionId);
      setIsActiveDevice(data.isActiveDevice);
    }
  }, []);

  useEffect(() => {
    async function init() {
      const { data } = await api.me();
      if (data) {
        setUser(data.user);
        setSessionId(data.sessionId);
        setIsActiveDevice(data.isActiveDevice);
        setupSocket();
      }
      setLoading(false);
    }
    init();
  }, [setupSocket]);

  const login = useCallback(
    async (identifier: string, password: string) => {
      const { data, error } = await api.login(identifier, password);
      if (error) return { error };
      if (data) {
        setUser(data.user);
        setSessionId(data.sessionId);
        setIsActiveDevice(data.isActiveDevice);
        setupSocket();
        return { needsVerification: data.needsVerification };
      }
      return { error: 'Unexpected error.' };
    },
    [setupSocket]
  );

  const signup = useCallback(
    async (username: string, email: string, password: string, confirmPassword: string) => {
      const { data, error } = await api.signup(username, email, password, confirmPassword);
      if (error) return { error };
      if (data) {
        setUser(data.user);
        setSessionId(data.sessionId);
        setIsActiveDevice(data.isActiveDevice);
        setupSocket();
      }
      return {};
    },
    [setupSocket]
  );

  const logout = useCallback(async () => {
    await api.logout();
    disconnectSocket();
    setUser(null);
    setSessionId(null);
    setIsActiveDevice(false);
  }, []);

  const markVerified = useCallback(() => {
    setUser((prev) => (prev ? { ...prev, verified: true } : prev));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        sessionId,
        isActiveDevice,
        loading,
        login,
        signup,
        logout,
        markVerified,
        refreshMe,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

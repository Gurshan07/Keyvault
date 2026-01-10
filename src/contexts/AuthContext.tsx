import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  initializeGoogleAuth, 
  signIn as googleSignIn, 
  signOut as googleSignOut,
  GoogleUser,
  setAccessToken
} from '@/lib/google-auth';

interface AuthContextType {
  user: GoogleUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [accessToken, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        await initializeGoogleAuth();
        setIsInitialized(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize Google Auth');
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, []);

  const signIn = useCallback(async () => {
    if (!isInitialized) {
      setError('Google Auth not initialized');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { accessToken: token, user: userData } = await googleSignIn();
      setToken(token);
      setAccessToken(token);
      setUser(userData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized]);

  const signOut = useCallback(() => {
    googleSignOut();
    setUser(null);
    setToken(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isAuthenticated: !!user && !!accessToken,
        isLoading,
        error,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

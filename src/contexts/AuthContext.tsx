import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { 
  initializeGoogleAuth, 
  signIn as googleSignIn, 
  signOut as googleSignOut,
  getStoredAuth,
  GoogleUser,
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

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [accessToken, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        // Load stored auth data first
        const { accessToken: storedToken, user: storedUser } = getStoredAuth();
        
        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(storedUser);
        }

        // Then initialize Google Auth
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
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
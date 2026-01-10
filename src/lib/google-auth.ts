// Google OAuth Configuration

declare const google: {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        callback: (response: { access_token: string; error?: string }) => void;
      }) => { callback: (response: { access_token: string; error?: string }) => void; requestAccessToken: (opts?: { prompt?: string }) => void };
      revoke: (token: string, callback: () => void) => void;
    };
  };
};

// Google Client ID - This is a publishable key, safe to include in client code
// For Vercel deployment, set VITE_GOOGLE_CLIENT_ID environment variable
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID 
const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  picture: string;
}

export interface AuthState {
  user: GoogleUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
}

type TokenClient = ReturnType<typeof google.accounts.oauth2.initTokenClient>;
let tokenClient: TokenClient | null = null;
let accessToken: string | null = null;
let isScriptLoaded = false;

const loadGoogleScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (isScriptLoaded && typeof google !== 'undefined') {
      resolve();
      return;
    }

    // Check if script already exists
    const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existingScript) {
      // Script exists, wait for it to load
      if (typeof google !== 'undefined') {
        isScriptLoaded = true;
        resolve();
      } else {
        existingScript.addEventListener('load', () => {
          isScriptLoaded = true;
          resolve();
        });
        existingScript.addEventListener('error', () => reject(new Error('Failed to load Google Identity Services')));
      }
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      isScriptLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
};

export const initializeGoogleAuth = async (): Promise<void> => {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('Google Client ID not configured');
  }

  await loadGoogleScript();
  
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: SCOPES,
    callback: () => {}, // Will be set on sign in
  });
};

export const signIn = (): Promise<{ accessToken: string; user: GoogleUser }> => {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error('Google Auth not initialized'));
      return;
    }

    tokenClient.callback = async (response) => {
      if (response.error) {
        reject(new Error(response.error));
        return;
      }

      accessToken = response.access_token;
      
      try {
        const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        
        if (!userResponse.ok) {
          throw new Error('Failed to fetch user info');
        }
        
        const userData = await userResponse.json();
        const user: GoogleUser = {
          id: userData.id,
          email: userData.email,
          name: userData.name,
          picture: userData.picture,
        };
        
        resolve({ accessToken, user });
      } catch (error) {
        reject(error);
      }
    };

    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
};

export const signOut = (): void => {
  if (accessToken) {
    google.accounts.oauth2.revoke(accessToken, () => {
      accessToken = null;
    });
  }
};

export const getAccessToken = (): string | null => accessToken;

export const setAccessToken = (token: string): void => {
  accessToken = token;
};

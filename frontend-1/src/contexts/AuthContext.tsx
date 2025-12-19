'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import {
  AuthUser,
  signIn as authSignIn,
  signUp as authSignUp,
  signOut as authSignOut,
  confirmSignUp as authConfirmSignUp,
  resendConfirmationCode,
  forgotPassword as authForgotPassword,
  confirmForgotPassword as authConfirmForgotPassword,
  getCurrentUser,
  getGoogleSignInUrl,
  handleOAuthCallback,
  refreshSession,
  SignInParams,
  SignUpParams,
  ConfirmSignUpParams,
} from '@/lib/auth';

// ============================================
// Types
// ============================================

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (params: SignInParams) => Promise<void>;
  signUp: (params: SignUpParams) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  confirmSignUp: (params: ConfirmSignUpParams) => Promise<void>;
  resendCode: (email: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  confirmForgotPassword: (email: string, code: string, newPassword: string) => Promise<void>;
  signInWithGoogle: () => void;
  handleCallback: (code: string) => Promise<void>;
}

// ============================================
// Context
// ============================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// ============================================
// Provider
// ============================================

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Try to get current user from stored tokens
        const currentUser = getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
          // Try to refresh the session in the background
          refreshSession().catch(() => {
            // If refresh fails, clear the user
            setUser(null);
          });
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  // Sign in with email/password
  const signIn = useCallback(async (params: SignInParams) => {
    setIsLoading(true);
    try {
      const authUser = await authSignIn(params);
      setUser(authUser);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Sign up with email/password
  const signUp = useCallback(async (params: SignUpParams) => {
    setIsLoading(true);
    try {
      const result = await authSignUp(params);
      return { needsConfirmation: !result.userConfirmed };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    setIsLoading(true);
    try {
      await authSignOut();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Confirm sign up with verification code
  const confirmSignUp = useCallback(async (params: ConfirmSignUpParams) => {
    setIsLoading(true);
    try {
      await authConfirmSignUp(params);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Resend confirmation code
  const resendCode = useCallback(async (email: string) => {
    await resendConfirmationCode(email);
  }, []);

  // Forgot password
  const forgotPassword = useCallback(async (email: string) => {
    await authForgotPassword(email);
  }, []);

  // Confirm forgot password with code and new password
  const confirmForgotPassword = useCallback(
    async (email: string, code: string, newPassword: string) => {
      await authConfirmForgotPassword(email, code, newPassword);
    },
    []
  );

  // Sign in with Google (redirect to Cognito hosted UI)
  const signInWithGoogle = useCallback(() => {
    const url = getGoogleSignInUrl();
    window.location.href = url;
  }, []);

  // Handle OAuth callback
  const handleCallback = useCallback(async (code: string) => {
    setIsLoading(true);
    try {
      const authUser = await handleOAuthCallback(code);
      setUser(authUser);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: user !== null,
    signIn,
    signUp,
    signOut,
    confirmSignUp,
    resendCode,
    forgotPassword,
    confirmForgotPassword,
    signInWithGoogle,
    handleCallback,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;


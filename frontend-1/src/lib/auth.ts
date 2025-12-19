// ============================================
// Authentication Library - AWS Cognito
// ============================================

// Cognito configuration - these will be populated from environment variables
const COGNITO_CONFIG = {
  userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '',
  clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '',
  region: process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1',
  domain: process.env.NEXT_PUBLIC_COGNITO_DOMAIN || '',
};

// Types
export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  emailVerified: boolean;
}

export interface AuthTokens {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface SignUpParams {
  email: string;
  password: string;
  name?: string;
}

export interface SignInParams {
  email: string;
  password: string;
}

export interface ConfirmSignUpParams {
  email: string;
  code: string;
}

// Storage keys
const STORAGE_KEYS = {
  tokens: 'auth_tokens',
  user: 'auth_user',
};

// ============================================
// Token Management
// ============================================

export function getStoredTokens(): AuthTokens | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.tokens);
    if (!stored) return null;
    
    const tokens = JSON.parse(stored) as AuthTokens;
    
    // Check if tokens are expired
    if (tokens.expiresAt < Date.now()) {
      clearStoredAuth();
      return null;
    }
    
    return tokens;
  } catch {
    return null;
  }
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.user);
    if (!stored) return null;
    return JSON.parse(stored) as AuthUser;
  } catch {
    return null;
  }
}

function storeAuth(tokens: AuthTokens, user: AuthUser): void {
  if (typeof window === 'undefined') return;
  
  localStorage.setItem(STORAGE_KEYS.tokens, JSON.stringify(tokens));
  localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
  // Also store userId for API compatibility
  localStorage.setItem('userId', user.id);
}

export function clearStoredAuth(): void {
  if (typeof window === 'undefined') return;
  
  localStorage.removeItem(STORAGE_KEYS.tokens);
  localStorage.removeItem(STORAGE_KEYS.user);
  localStorage.removeItem('userId');
}

// ============================================
// JWT Decoding (without external library)
// ============================================

function decodeJwt(token: string): Record<string, unknown> {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return {};
  }
}

function extractUserFromIdToken(idToken: string): AuthUser {
  const payload = decodeJwt(idToken);
  return {
    id: (payload.sub as string) || '',
    email: (payload.email as string) || '',
    name: (payload.name as string) || (payload.email as string)?.split('@')[0],
    emailVerified: (payload.email_verified as boolean) || false,
  };
}

// ============================================
// Cognito API Helpers
// ============================================

async function cognitoRequest(
  action: string,
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const response = await fetch(
    `https://cognito-idp.${COGNITO_CONFIG.region}.amazonaws.com/`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': `AWSCognitoIdentityProviderService.${action}`,
      },
      body: JSON.stringify(params),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.message || 'Authentication failed');
    (error as Error & { code?: string }).code = data.__type?.split('#')[1] || 'UnknownError';
    throw error;
  }

  return data;
}

// ============================================
// Authentication Functions
// ============================================

export async function signUp(params: SignUpParams): Promise<{ userConfirmed: boolean }> {
  const { email, password, name } = params;

  const userAttributes = [
    { Name: 'email', Value: email },
  ];
  
  if (name) {
    userAttributes.push({ Name: 'name', Value: name });
  }

  const response = await cognitoRequest('SignUp', {
    ClientId: COGNITO_CONFIG.clientId,
    Username: email,
    Password: password,
    UserAttributes: userAttributes,
  });

  return {
    userConfirmed: response.UserConfirmed as boolean,
  };
}

export async function confirmSignUp(params: ConfirmSignUpParams): Promise<void> {
  const { email, code } = params;

  await cognitoRequest('ConfirmSignUp', {
    ClientId: COGNITO_CONFIG.clientId,
    Username: email,
    ConfirmationCode: code,
  });
}

export async function resendConfirmationCode(email: string): Promise<void> {
  await cognitoRequest('ResendConfirmationCode', {
    ClientId: COGNITO_CONFIG.clientId,
    Username: email,
  });
}

export async function signIn(params: SignInParams): Promise<AuthUser> {
  const { email, password } = params;

  const response = await cognitoRequest('InitiateAuth', {
    ClientId: COGNITO_CONFIG.clientId,
    AuthFlow: 'USER_PASSWORD_AUTH',
    AuthParameters: {
      USERNAME: email,
      PASSWORD: password,
    },
  });

  const authResult = response.AuthenticationResult as {
    AccessToken: string;
    IdToken: string;
    RefreshToken: string;
    ExpiresIn: number;
  };

  if (!authResult) {
    throw new Error('Authentication failed');
  }

  const tokens: AuthTokens = {
    accessToken: authResult.AccessToken,
    idToken: authResult.IdToken,
    refreshToken: authResult.RefreshToken,
    expiresAt: Date.now() + authResult.ExpiresIn * 1000,
  };

  const user = extractUserFromIdToken(authResult.IdToken);
  storeAuth(tokens, user);

  return user;
}

export async function signOut(): Promise<void> {
  const tokens = getStoredTokens();
  
  if (tokens?.accessToken) {
    try {
      await cognitoRequest('GlobalSignOut', {
        AccessToken: tokens.accessToken,
      });
    } catch {
      // Ignore errors during sign out
    }
  }

  clearStoredAuth();
}

export async function refreshSession(): Promise<AuthTokens | null> {
  const tokens = getStoredTokens();
  
  if (!tokens?.refreshToken) {
    return null;
  }

  try {
    const response = await cognitoRequest('InitiateAuth', {
      ClientId: COGNITO_CONFIG.clientId,
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      AuthParameters: {
        REFRESH_TOKEN: tokens.refreshToken,
      },
    });

    const authResult = response.AuthenticationResult as {
      AccessToken: string;
      IdToken: string;
      ExpiresIn: number;
    };

    if (!authResult) {
      clearStoredAuth();
      return null;
    }

    const newTokens: AuthTokens = {
      accessToken: authResult.AccessToken,
      idToken: authResult.IdToken,
      refreshToken: tokens.refreshToken, // Refresh token doesn't change
      expiresAt: Date.now() + authResult.ExpiresIn * 1000,
    };

    const user = extractUserFromIdToken(authResult.IdToken);
    storeAuth(newTokens, user);

    return newTokens;
  } catch {
    clearStoredAuth();
    return null;
  }
}

export async function forgotPassword(email: string): Promise<void> {
  await cognitoRequest('ForgotPassword', {
    ClientId: COGNITO_CONFIG.clientId,
    Username: email,
  });
}

export async function confirmForgotPassword(
  email: string,
  code: string,
  newPassword: string
): Promise<void> {
  await cognitoRequest('ConfirmForgotPassword', {
    ClientId: COGNITO_CONFIG.clientId,
    Username: email,
    ConfirmationCode: code,
    Password: newPassword,
  });
}

// ============================================
// OAuth / Social Login
// ============================================

export function getGoogleSignInUrl(): string {
  const redirectUri = typeof window !== 'undefined' 
    ? `${window.location.origin}/auth/callback`
    : '';
  
  const params = new URLSearchParams({
    client_id: COGNITO_CONFIG.clientId,
    response_type: 'code',
    scope: 'email openid profile',
    redirect_uri: redirectUri,
    identity_provider: 'Google',
  });

  return `${COGNITO_CONFIG.domain}/oauth2/authorize?${params}`;
}

export async function handleOAuthCallback(code: string): Promise<AuthUser> {
  const redirectUri = typeof window !== 'undefined'
    ? `${window.location.origin}/auth/callback`
    : '';

  const response = await fetch(`${COGNITO_CONFIG.domain}/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: COGNITO_CONFIG.clientId,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to exchange authorization code');
  }

  const data = await response.json();

  const tokens: AuthTokens = {
    accessToken: data.access_token,
    idToken: data.id_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  const user = extractUserFromIdToken(data.id_token);
  storeAuth(tokens, user);

  return user;
}

// ============================================
// Utility Functions
// ============================================

export function isAuthenticated(): boolean {
  const tokens = getStoredTokens();
  return tokens !== null && tokens.expiresAt > Date.now();
}

export function getCurrentUser(): AuthUser | null {
  if (!isAuthenticated()) {
    return null;
  }
  return getStoredUser();
}

export function getAccessToken(): string | null {
  const tokens = getStoredTokens();
  return tokens?.accessToken || null;
}

export function getIdToken(): string | null {
  const tokens = getStoredTokens();
  return tokens?.idToken || null;
}

// Alias for signOut for convenience
export const logout = signOut;


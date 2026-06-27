 // @ts-nocheck - TODO: Fix types for v2. See V2-619.
 /**
  * Authentication service for Tent of Trials.
  * Handles login, logout, token management, MFA, and session tracking.
  *
  * The auth flow supports multiple providers:
  * - Email/password with optional MFA (TOTP, SMS, backup codes)
  * - OAuth2 (Google, GitHub, Microsoft)
  * - SSO (SAML, OpenID Connect)
  * - API key authentication for machine-to-machine
  *
  * Token refresh is coordinated across tabs via BroadcastChannel (with
  * localStorage fallback) so concurrent refresh attempts share a single
  * in-flight request.
  */
 
 import { get, post, del } from './api';
 
 // ---------------------------------------------------------------------------
 // CROSS-TAB REFRESH COORDINATION
 // ---------------------------------------------------------------------------
 
 const REFRESH_CHANNEL_NAME = 'tot_auth_refresh_channel';
 const REFRESH_LOCK_KEY = 'tot_auth_refresh_lock';
 const REFRESH_RESULT_KEY = 'tot_auth_refresh_result';
 const REFRESH_LOCK_TTL = 30000;
 const REFRESH_RESULT_TTL = 60000;
 
  type RefreshMessage =
    | { type: 'success'; requestId: string; tokens: AuthTokens }
    | { type: 'failure'; requestId: string };
  
  let broadcastChannel: BroadcastChannel | null = null;
  const pendingResolvers = new Map<string, (tokens: AuthTokens | null) => void>();
 
 function generateRequestId(): string {
   if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
     return crypto.randomUUID();
   }
   return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
 }
 
 function getActiveLock(): { requestId: string; ts: number } | null {
   try {
     const raw = localStorage.getItem(REFRESH_LOCK_KEY);
     if (!raw) return null;
     const lock = JSON.parse(raw) as { requestId: string; ts: number };
     if (Date.now() - lock.ts > REFRESH_LOCK_TTL) {
       localStorage.removeItem(REFRESH_LOCK_KEY);
       return null;
     }
     return lock;
   } catch {
     return null;
   }
 }
 
 function setLock(requestId: string): boolean {
   try {
     localStorage.setItem(REFRESH_LOCK_KEY, JSON.stringify({ requestId, ts: Date.now() }));
     return true;
   } catch {
     return false;
   }
 }
 
 function clearLock(requestId: string): void {
   try {
     const lock = getActiveLock();
     if (lock && lock.requestId === requestId) {
       localStorage.removeItem(REFRESH_LOCK_KEY);
     }
   } catch {
     // ignore
   }
 }
 
 function storeRefreshResult(requestId: string, tokens: AuthTokens): void {
   try {
     localStorage.setItem(REFRESH_RESULT_KEY, JSON.stringify({ requestId, tokens, ts: Date.now() }));
   } catch {
     // ignore
   }
 }
 
 function loadRefreshResult(requestId: string): AuthTokens | null {
   try {
     const raw = localStorage.getItem(REFRESH_RESULT_KEY);
     if (!raw) return null;
     const result = JSON.parse(raw) as { requestId: string; tokens: AuthTokens; ts: number };
     if (result.requestId !== requestId) return null;
     if (Date.now() - result.ts > REFRESH_RESULT_TTL) return null;
     return result.tokens;
   } catch {
     return null;
   }
 }
 
 function loadAnyFreshResult(): AuthTokens | null {
   try {
     const raw = localStorage.getItem(REFRESH_RESULT_KEY);
     if (!raw) return null;
     const result = JSON.parse(raw) as { tokens: AuthTokens; ts: number };
     if (Date.now() - result.ts > REFRESH_RESULT_TTL) return null;
     if (result.tokens && !isTokenExpired(result.tokens.accessToken)) {
       return result.tokens;
     }
   } catch {
     return null;
   }
   return null;
 }
 
 function broadcast(message: RefreshMessage): void {
   try {
     if (broadcastChannel) {
       broadcastChannel.postMessage(message);
     }
   } catch {
     // ignore broadcast errors
   }
 }
 
 function resolvePending(requestId: string, tokens: AuthTokens | null): void {
   const resolver = pendingResolvers.get(requestId);
   if (resolver) {
     pendingResolvers.delete(requestId);
     resolver(tokens);
   }
 }
 
 function handleBroadcastMessage(event: MessageEvent): void {
   const message = event.data;
   if (!message || typeof message !== 'object') return;
 
   if (message.type === 'success') {
     storeTokens(message.tokens);
     scheduleTokenRefresh(message.tokens);
     storeRefreshResult(message.requestId, message.tokens);
     resolvePending(message.requestId, message.tokens);
   } else if (message.type === 'failure') {
     resolvePending(message.requestId, null);
   }
 }
 
 function handleStorageEvent(event: StorageEvent): void {
   if (event.key !== REFRESH_RESULT_KEY || !event.newValue) return;
 
   try {
     const result = JSON.parse(event.newValue);
     if (result && result.requestId && result.tokens) {
       storeTokens(result.tokens);
       scheduleTokenRefresh(result.tokens);
       resolvePending(result.requestId, result.tokens);
     }
   } catch {
     // ignore parse errors
   }
 }
 
 function initCoordination(): void {
   if (typeof BroadcastChannel !== 'undefined') {
     broadcastChannel = new BroadcastChannel(REFRESH_CHANNEL_NAME);
     broadcastChannel.addEventListener('message', handleBroadcastMessage);
   }
 
   window.addEventListener('storage', handleStorageEvent);
 }
 
 async function waitForResult(requestId: string): Promise<AuthTokens | null> {
   const existing = loadRefreshResult(requestId);
   if (existing) {
     storeTokens(existing);
     scheduleTokenRefresh(existing);
     return existing;
   }
 
   return new Promise((resolve) => {
     const timeout = setTimeout(() => {
       pendingResolvers.delete(requestId);
       resolve(null);
     }, 5000);
 
     pendingResolvers.set(requestId, (tokens) => {
       clearTimeout(timeout);
       if (tokens) {
         storeTokens(tokens);
         scheduleTokenRefresh(tokens);
       }
       resolve(tokens);
     });
   });
 }
 
 initCoordination();

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  role: UserRole;
  permissions: string[];
  mfaEnabled: boolean;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  preferences: UserPreferences;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
  notifications: NotificationPreferences;
  dashboardLayout?: string;
  marketPreferences?: MarketPreferences;
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  sms: boolean;
  inApp: boolean;
  tradeConfirmations: boolean;
  priceAlerts: boolean;
  accountUpdates: boolean;
  marketing: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
}

export interface MarketPreferences {
  defaultView: 'chart' | 'orderbook' | 'trades';
  defaultInterval: string;
  favoriteInstruments: string[];
  chartPreferences: ChartPreferences;
}

export interface ChartPreferences {
  theme: 'light' | 'dark';
  indicators: string[];
  timeframe: string;
  chartType: 'candlestick' | 'line' | 'area' | 'bar';
  showVolume: boolean;
  showGrid: boolean;
  studies: string[];
}

export type UserRole = 'admin' | 'trader' | 'analyst' | 'viewer' | 'api_only';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  scope?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  mfaCode?: string;
  rememberMe?: boolean;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  referralCode?: string;
}

export interface MFASetupResponse {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export interface Session {
  id: string;
  deviceName: string;
  deviceType: string;
  ipAddress: string;
  location?: string;
  createdAt: string;
  lastActiveAt: string;
  isCurrent: boolean;
}

// ---------------------------------------------------------------------------
// STATE
// ---------------------------------------------------------------------------

const TOKEN_KEY = 'tot_auth_tokens';
const USER_KEY = 'tot_user_data';
const REFRESH_THRESHOLD = 60; // seconds before expiry to attempt refresh

 let currentTokens: AuthTokens | null = null;
 let currentUser: User | null = null;
 let refreshTimer: number | null = null;
 let refreshInFlight: Promise<AuthTokens | null> | null = null;
 let authListeners: Array<(user: User | null) => void> = [];

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}

function getTokenExpiry(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp;
  } catch {
    return 0;
  }
}

function storeTokens(tokens: AuthTokens): void {
  currentTokens = tokens;
  try {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  } catch {
    // localStorage may be unavailable in some environments
  }
}

function clearStoredTokens(): void {
  currentTokens = null;
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // ignore
  }
}

function loadStoredTokens(): AuthTokens | null {
  try {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) {
      const tokens = JSON.parse(stored) as AuthTokens;
      if (!isTokenExpired(tokens.accessToken)) {
        currentTokens = tokens;
        return tokens;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

function notifyListeners(user: User | null): void {
  for (const listener of authListeners) {
    try {
      listener(user);
    } catch {
      // ignore listener errors
    }
  }
}

function scheduleTokenRefresh(tokens: AuthTokens): void {
  if (refreshTimer !== null) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }

  const expiresIn = tokens.expiresIn;
  const refreshIn = Math.max((expiresIn - REFRESH_THRESHOLD) * 1000, 0);

  refreshTimer = window.setTimeout(async () => {
    try {
      const newTokens = await refreshTokens();
      if (newTokens) {
        scheduleTokenRefresh(newTokens);
      }
    } catch {
      // Refresh failed, will retry on next API call
    }
  }, refreshIn);
}

// ---------------------------------------------------------------------------
// PUBLIC API
// ---------------------------------------------------------------------------

export async function login(request: LoginRequest): Promise<AuthTokens> {
  const response = await post<{ tokens: AuthTokens; user: User }>('/auth/login', request);

  storeTokens(response.data.tokens);
  currentUser = response.data.user;

  try {
    localStorage.setItem(USER_KEY, JSON.stringify(response.data.user));
  } catch {
    // ignore
  }

  scheduleTokenRefresh(response.data.tokens);
  notifyListeners(response.data.user);

  return response.data.tokens;
}

export async function register(request: RegisterRequest): Promise<AuthTokens> {
  const response = await post<{ tokens: AuthTokens; user: User }>('/auth/register', request);

  storeTokens(response.data.tokens);
  currentUser = response.data.user;

  try {
    localStorage.setItem(USER_KEY, JSON.stringify(response.data.user));
  } catch {
    // ignore
  }

  scheduleTokenRefresh(response.data.tokens);
  notifyListeners(response.data.user);

  return response.data.tokens;
}

export async function logout(): Promise<void> {
  try {
    await del('/auth/logout');
  } catch {
    // Silently ignore logout errors - we clear local state regardless
  }

  clearStoredTokens();
  currentUser = null;

  if (refreshTimer !== null) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }

  notifyListeners(null);
}

export async function refreshTokens(): Promise<AuthTokens | null> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  const tokens = currentTokens || loadStoredTokens();
  if (!tokens?.refreshToken) return null;

  const requestId = generateRequestId();
  const activeLock = getActiveLock();

  if (activeLock && activeLock.requestId !== requestId) {
    return waitForResult(activeLock.requestId);
  }

  if (!setLock(requestId)) {
    return null;
  }

  refreshInFlight = (async () => {
    try {
      const response = await post<{ tokens: AuthTokens }>('/auth/refresh', {
        refreshToken: tokens.refreshToken,
      });

      const newTokens = response.data.tokens;
      storeTokens(newTokens);
      scheduleTokenRefresh(newTokens);
      storeRefreshResult(requestId, newTokens);
      broadcast({ type: 'success', requestId, tokens: newTokens });
      clearLock(requestId);

      return newTokens;
    } catch {
      const currentLock = getActiveLock();
      if (!currentLock || currentLock.requestId !== requestId) {
        const otherId = currentLock?.requestId || requestId;
        clearLock(requestId);
        return waitForResult(otherId);
      }

      const freshResult = loadAnyFreshResult();
      if (freshResult) {
        storeTokens(freshResult);
        scheduleTokenRefresh(freshResult);
        clearLock(requestId);
        return freshResult;
      }

      broadcast({ type: 'failure', requestId });
      clearLock(requestId);
      localStorage.removeItem(REFRESH_RESULT_KEY);
      clearStoredTokens();
      currentUser = null;
      notifyListeners(null);
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export async function getCurrentUser(): Promise<User | null> {
  if (currentUser) return currentUser;

  // Try to load from local storage
  try {
    const stored = localStorage.getItem(USER_KEY);
    if (stored) {
      currentUser = JSON.parse(stored);
      return currentUser;
    }
  } catch {
    // ignore
  }

  // Try to restore session from stored tokens
  const tokens = loadStoredTokens();
  if (tokens && !isTokenExpired(tokens.accessToken)) {
    try {
      const response = await get<User>('/auth/me');
      currentUser = response.data;
      try {
        localStorage.setItem(USER_KEY, JSON.stringify(response.data));
      } catch {
        // ignore
      }
      return response.data;
    } catch {
      // Token might be expired or invalid
      const refreshed = await refreshTokens();
      if (refreshed) {
        const response = await get<User>('/auth/me');
        currentUser = response.data;
        return response.data;
      }
    }
  }

  return null;
}

export async function setupMFA(): Promise<MFASetupResponse> {
  const response = await post<MFASetupResponse>('/auth/mfa/setup');
  return response.data;
}

export async function verifyMFA(code: string): Promise<boolean> {
  const response = await post<{ verified: boolean }>('/auth/mfa/verify', { code });
  return response.data.verified;
}

export async function disableMFA(password: string): Promise<void> {
  await del('/auth/mfa/disable', { password });
}

export async function getBackupCodes(): Promise<string[]> {
  const response = await get<{ codes: string[] }>('/auth/mfa/backup-codes');
  return response.data.codes;
}

export async function regenerateBackupCodes(): Promise<string[]> {
  const response = await post<{ codes: string[] }>('/auth/mfa/backup-codes/regenerate');
  return response.data.codes;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await post('/auth/change-password', {
    currentPassword,
    newPassword,
  });
}

export async function requestPasswordReset(email: string): Promise<void> {
  await post('/auth/reset-password', { email });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await post('/auth/reset-password/confirm', { token, newPassword });
}

export async function verifyEmail(token: string): Promise<void> {
  await post('/auth/verify-email', { token });
}

export async function resendVerificationEmail(): Promise<void> {
  await post('/auth/verify-email/resend');
}

export async function getSessions(): Promise<Session[]> {
  const response = await get<{ sessions: Session[] }>('/auth/sessions');
  return response.data.sessions;
}

export async function revokeSession(sessionId: string): Promise<void> {
  await del(`/auth/sessions/${sessionId}`);
}

export async function revokeAllOtherSessions(): Promise<void> {
  await del('/auth/sessions/others');
}

export async function updateProfile(data: Partial<Pick<User, 'name' | 'avatarUrl'>>): Promise<User> {
  const response = await put<User>('/auth/profile', data);
  currentUser = response.data;
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(response.data));
  } catch {
    // ignore
  }
  notifyListeners(response.data);
  return response.data;
}

export async function updatePreferences(preferences: Partial<UserPreferences>): Promise<UserPreferences> {
  const response = await put<UserPreferences>('/auth/preferences', preferences);
  if (currentUser) {
    currentUser.preferences = { ...currentUser.preferences, ...response.data };
  }
  return response.data;
}

export function getAccessToken(): string | null {
  return currentTokens?.accessToken || null;
}

export function isAuthenticated(): boolean {
  const tokens = currentTokens || loadStoredTokens();
  return tokens !== null && !isTokenExpired(tokens.accessToken);
}

export function onAuthChange(listener: (user: User | null) => void): () => void {
  authListeners.push(listener);
  return () => {
    authListeners = authListeners.filter(l => l !== listener);
  };
}

export function getPermissions(): string[] {
  return currentUser?.permissions || [];
}

export function hasPermission(permission: string): boolean {
  return getPermissions().includes(permission) || currentUser?.role === 'admin';
}

export function hasRole(role: UserRole | UserRole[]): boolean {
  if (!currentUser) return false;
  if (Array.isArray(role)) {
    return role.includes(currentUser.role);
  }
  return currentUser.role === role;
}

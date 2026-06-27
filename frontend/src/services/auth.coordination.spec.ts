import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AuthTokens } from './auth';

function createJwt(expOffsetSeconds = 3600, jti?: string): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expOffsetSeconds, sub: 'test-user', jti: jti || Math.random().toString(36).slice(2) }));
  return `${header}.${payload}.signature`;
}

const mockPost = vi.fn();
const mockChannelInstance = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  postMessage: vi.fn(),
  close: vi.fn(),
};
const mockBroadcastChannel = vi.fn(() => mockChannelInstance);

vi.mock('./api', () => ({
  post: (...args: unknown[]) => mockPost(...args),
  get: vi.fn(),
  del: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
}));

function setupGlobals() {
  vi.stubGlobal('BroadcastChannel', mockBroadcastChannel);
  vi.stubGlobal('crypto', {
    randomUUID: vi.fn(() => `uuid-${Math.random().toString(36).slice(2)}`),
  });
}

beforeEach(() => {
  mockPost.mockReset();
  mockChannelInstance.addEventListener.mockReset();
  mockChannelInstance.removeEventListener.mockReset();
  mockChannelInstance.postMessage.mockReset();
  mockBroadcastChannel.mockClear();
  localStorage.clear();
  sessionStorage.clear();
  setupGlobals();
});

async function loadAuth() {
  vi.resetModules();
  return await import('./auth');
}

describe('refreshTokens coordination', () => {
  it('shares in-flight refresh request in the same tab', async () => {
    const auth = await loadAuth();

    const tokens: AuthTokens = {
      accessToken: createJwt(),
      refreshToken: 'refresh-1',
      expiresIn: 3600,
      tokenType: 'Bearer',
    };

    localStorage.setItem('tot_auth_tokens', JSON.stringify(tokens));
    const newAccessToken = createJwt();
    mockPost.mockResolvedValueOnce({ data: { tokens: { ...tokens, accessToken: newAccessToken } } });

    const p1 = auth.refreshTokens();
    const p2 = auth.refreshTokens();

    const [result1, result2] = await Promise.all([p1, p2]);

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(result1).not.toBeNull();
    expect(result2).not.toBeNull();
    expect(result1?.accessToken).toBe(newAccessToken);
    expect(result2?.accessToken).toBe(newAccessToken);
  });

  it('coordinates cross-tab success via BroadcastChannel', async () => {
    const auth = await loadAuth();

    const tokens: AuthTokens = {
      accessToken: createJwt(),
      refreshToken: 'refresh-1',
      expiresIn: 3600,
      tokenType: 'Bearer',
    };

    localStorage.setItem('tot_auth_tokens', JSON.stringify(tokens));
    localStorage.setItem('tot_auth_refresh_lock', JSON.stringify({
      requestId: 'other-request-id',
      ts: Date.now(),
    }));

    const newAccessToken = createJwt();
    const messageTokens = { ...tokens, accessToken: newAccessToken };

    const promise = auth.refreshTokens();

    const initCall = mockChannelInstance.addEventListener.mock.calls.find(
      (call) => call[0] === 'message'
    );
    const messageHandler = initCall?.[1] as ((event: MessageEvent) => void) | undefined;

    if (messageHandler) {
      messageHandler({
        data: {
          type: 'success',
          requestId: 'other-request-id',
          tokens: messageTokens,
        },
      } as MessageEvent);
    }

    const result = await promise;
    expect(result).not.toBeNull();
    expect(result?.accessToken).toBe(newAccessToken);
    expect(localStorage.getItem('tot_auth_tokens')).toContain(newAccessToken);
  });

  it('handles refresh failure without clearing valid tokens when another tab has fresh result', async () => {
    const auth = await loadAuth();

    const tokens: AuthTokens = {
      accessToken: createJwt(),
      refreshToken: 'refresh-1',
      expiresIn: 3600,
      tokenType: 'Bearer',
    };

    localStorage.setItem('tot_auth_tokens', JSON.stringify(tokens));
    const freshAccessToken = createJwt();
    localStorage.setItem('tot_auth_refresh_result', JSON.stringify({
      requestId: 'other-request-id',
      tokens: { ...tokens, accessToken: freshAccessToken },
      ts: Date.now(),
    }));

    mockPost.mockRejectedValueOnce(new Error('Network error'));

    const result = await auth.refreshTokens();

    expect(result).not.toBeNull();
    expect(result?.accessToken).toBe(freshAccessToken);
    expect(localStorage.getItem('tot_auth_tokens')).toContain(freshAccessToken);
  });
});

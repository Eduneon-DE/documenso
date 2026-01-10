import { OAuth2Client } from 'arctic';
import axios, { type AxiosError, type AxiosInstance, type AxiosResponse } from 'axios';

import { env } from '@documenso/lib/utils/env';
import { prisma } from '@documenso/prisma';

import type { CockpitUserListItem } from './types';

const COCKPIT_API_URL = 'http://localhost:5000/api/v1';

// Buffer time before expiration to refresh (5 minutes)
const TOKEN_REFRESH_BUFFER_SECONDS = 5 * 60;

/**
 * Fetch OpenID configuration from well-known endpoint
 */
const getTokenEndpoint = async (): Promise<string | null> => {
  const wellKnownUrl = env('NEXT_PRIVATE_OIDC_WELL_KNOWN');
  if (!wellKnownUrl) return null;

  try {
    const response = await fetch(wellKnownUrl);
    const config = await response.json();
    return config.token_endpoint || null;
  } catch (error) {
    console.error('[Cockpit] Failed to fetch OpenID configuration:', error);
    return null;
  }
};

/**
 * Refresh the access token using the refresh token
 */
const refreshAccessToken = async (
  accountId: string,
  refreshToken: string,
): Promise<string | null> => {
  const clientId = env('NEXT_PRIVATE_OIDC_CLIENT_ID');
  const clientSecret = env('NEXT_PRIVATE_OIDC_CLIENT_SECRET');
  const tokenEndpoint = await getTokenEndpoint();

  if (!clientId || !clientSecret || !tokenEndpoint) {
    console.error('[Cockpit] Missing OIDC configuration for token refresh');
    return null;
  }

  try {
    const oAuthClient = new OAuth2Client(clientId, clientSecret, '');

    const tokens = await oAuthClient.refreshAccessToken(tokenEndpoint, refreshToken, [
      'openid',
      'email',
      'profile',
    ]);

    const newAccessToken = tokens.accessToken();
    const newExpiresAt = tokens.accessTokenExpiresAt();
    const newRefreshToken = tokens.hasRefreshToken() ? tokens.refreshToken() : null;

    // Update database with new tokens
    await prisma.account.update({
      where: { id: accountId },
      data: {
        access_token: newAccessToken,
        expires_at: Math.floor(newExpiresAt.getTime() / 1000),
        ...(newRefreshToken ? { refresh_token: newRefreshToken } : {}),
      },
    });

    console.log('[Cockpit] Successfully refreshed access token');
    return newAccessToken;
  } catch (error) {
    console.error('[Cockpit] Failed to refresh access token:', error);
    return null;
  }
};

/**
 * Create Axios instance with interceptors for Cockpit API
 */
const createCockpitClient = (accessToken: string): AxiosInstance => {
  const client = axios.create({
    baseURL: COCKPIT_API_URL,
    timeout: 30000,
  });

  // Request interceptor - set auth token
  client.interceptors.request.use(
    (config) => {
      config.headers.Authorization = `Bearer ${accessToken}`;
      config.headers['Content-Type'] = 'application/json';
      return config;
    },
    (error: AxiosError) => {
      throw error;
    },
  );

  // Response interceptor
  client.interceptors.response.use(
    (response: AxiosResponse) => response.data,
    (error: AxiosError) => {
      console.error('[Cockpit] API Error:', error.response?.status, error.response?.data);
      throw error;
    },
  );

  return client;
};

/**
 * Get user's OIDC access token from Account table.
 * Automatically refreshes the token if it's expired or about to expire.
 */
export const getUserAccessToken = async (userId: number): Promise<string | null> => {
  const account = await prisma.account.findFirst({
    where: { userId, provider: 'oidc' },
    select: {
      id: true,
      access_token: true,
      refresh_token: true,
      expires_at: true,
    },
  });

  if (!account?.access_token) {
    console.log('[Cockpit] getUserAccessToken: No access token found for user', userId);
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = account.expires_at ?? 0;
  const isExpired = expiresAt > 0 && expiresAt - TOKEN_REFRESH_BUFFER_SECONDS < now;

  console.log('[Cockpit] getUserAccessToken:', {
    userId,
    hasToken: true,
    expiresAt: expiresAt ? new Date(expiresAt * 1000).toISOString() : 'unknown',
    isExpired,
    hasRefreshToken: !!account.refresh_token,
  });

  // If token is expired or about to expire, try to refresh
  if (isExpired && account.refresh_token) {
    console.log('[Cockpit] Access token expired, attempting refresh...');
    const newAccessToken = await refreshAccessToken(account.id, account.refresh_token);
    if (newAccessToken) {
      return newAccessToken;
    }
    // If refresh failed, return the old token (it might still work briefly)
    console.warn('[Cockpit] Token refresh failed, returning potentially expired token');
  }

  return account.access_token;
};

export type PaginatedResponse<T> = {
  data: T[];
  count: number;
};

/**
 * Get users from Cockpit
 */
export const getUsers = async (
  accessToken: string,
  params: {
    search?: string;
    take?: number;
    skip?: number;
    status?: string[];
  } = {},
): Promise<PaginatedResponse<CockpitUserListItem>> => {
  const client = createCockpitClient(accessToken);

  // Build params object, only include search if it's non-empty
  const queryParams: Record<string, unknown> = {
    take: params.take || 20,
    skip: params.skip || 0,
    status: params.status || ['Active', 'Pending'],
  };

  // Only add search param if it has a value (empty string should not be sent)
  if (params.search) {
    queryParams.search = params.search;
  }

  return client.get('/users', { params: queryParams });
};

/**
 * Search users by name/email
 */
export const searchUsers = async (
  accessToken: string,
  query: string,
  limit = 10,
): Promise<CockpitUserListItem[]> => {
  console.log('[Cockpit] searchUsers called:', { query, limit });
  const result = await getUsers(accessToken, { search: query, take: limit });
  console.log('[Cockpit] searchUsers result:', { count: result?.data?.length || 0 });
  return result?.data || [];
};

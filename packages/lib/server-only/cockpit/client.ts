import { OAuth2Client } from 'arctic';
import axios, { type AxiosError, type AxiosInstance, type AxiosResponse } from 'axios';

import { env } from '@documenso/lib/utils/env';
import { prisma } from '@documenso/prisma';

import type {
  CockpitCurrentUser,
  CockpitUserListItem,
  CockpitUserPreferences,
  DocumensoConfig,
  DocumensoConfigMeta,
  PaginatedResponse,
} from './types';

// Use environment variable for Cockpit API URL
const getCockpitApiUrl = () => env('COCKPIT_API_URL') || 'http://localhost:5000/api/v1';

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
      'offline_access',
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
    baseURL: getCockpitApiUrl(),
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
      const status = error.response?.status;

      // Only log non-404 errors (404 is expected for missing configs)
      if (status !== 404) {
        const errorInfo = {
          status,
          data: error.response?.data,
          url: error.config?.url,
          method: error.config?.method,
        };
        console.error('[Cockpit] API Error:', errorInfo);
      }

      // Create a clean error to throw (without axios internals)
      const cleanError = new Error(
        `Cockpit API Error: ${status} - ${JSON.stringify(error.response?.data)}`,
      );
      throw cleanError;
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

// ============================================================================
// User API
// ============================================================================

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

// ============================================================================
// Auth API
// ============================================================================

/**
 * Get current user from Cockpit (/auth/me)
 * Returns the authenticated user with organization context.
 */
export const getCurrentUser = async (accessToken: string): Promise<CockpitCurrentUser | null> => {
  try {
    const client = createCockpitClient(accessToken);
    return await client.get('/auth/me');
  } catch (error) {
    console.error('[Cockpit] Failed to get current user:', error);
    return null;
  }
};

// ============================================================================
// User Preferences API
// ============================================================================

/**
 * Get user preferences from Cockpit.
 * Includes locale/language preference.
 */
export const getUserPreferences = async (
  accessToken: string,
): Promise<CockpitUserPreferences | null> => {
  try {
    const client = createCockpitClient(accessToken);
    return await client.get('/user-preferences');
  } catch (error) {
    console.error('[Cockpit] Failed to get user preferences:', error);
    return null;
  }
};

/**
 * Get user's preferred locale from Cockpit.
 * Returns the locale string (e.g., 'de', 'en') or null if not set.
 */
export const getUserLocale = async (accessToken: string): Promise<string | null> => {
  const preferences = await getUserPreferences(accessToken);
  return preferences?.preferences?.locale ?? null;
};

// ============================================================================
// Helper: Get user data with preferences (combines /auth/me + /user-preferences)
// ============================================================================

export type CockpitUserWithPreferences = {
  user: CockpitCurrentUser;
  preferences: CockpitUserPreferences | null;
  locale: string | null;
};

/**
 * Get current user along with their preferences.
 * Useful for getting user info + locale in a single call.
 */
export const getCurrentUserWithPreferences = async (
  accessToken: string,
): Promise<CockpitUserWithPreferences | null> => {
  const [user, preferences] = await Promise.all([
    getCurrentUser(accessToken),
    getUserPreferences(accessToken),
  ]);

  if (!user) {
    return null;
  }

  return {
    user,
    preferences,
    locale: preferences?.preferences?.locale ?? null,
  };
};

// ============================================================================
// Documenso Configuration API
// ============================================================================

const DOCUMENSO_CONFIG_IDENTIFIER = 'documenso';

/**
 * Get all Documenso configs accessible to user from Cockpit.
 * Returns array of configs (may include parent org's config).
 */
export const getDocumensoConfigs = async (accessToken: string): Promise<DocumensoConfig[]> => {
  try {
    const client = createCockpitClient(accessToken);
    const configs = await client.get('/configs', {
      params: { identifier: DOCUMENSO_CONFIG_IDENTIFIER },
    });
    return (configs as unknown as DocumensoConfig[]) || [];
  } catch (error) {
    console.error('[Cockpit] Error fetching Documenso configs:', error);
    return [];
  }
};

/**
 * Get Documenso configuration from Cockpit for the user's organization.
 *
 * For reading: Returns user's org config, or falls back to parent org's config.
 * For writing: Use getDocumensoConfigForUpdate to get only user's own config.
 */
export const getDocumensoConfig = async (accessToken: string): Promise<DocumensoConfig | null> => {
  try {
    // Get user info and configs in parallel
    const [currentUser, configs] = await Promise.all([
      getCurrentUser(accessToken),
      getDocumensoConfigs(accessToken),
    ]);

    if (!currentUser || configs.length === 0) return null;

    const userOrgId = currentUser.organization.id;

    // First try to find user's own org config
    const ownConfig = configs.find((c) => c.organizationId === userOrgId);
    if (ownConfig) return ownConfig;

    // Fall back to parent org's config (for reading/applying settings)
    return configs[0];
  } catch (error) {
    console.error('[Cockpit] Error fetching Documenso config:', error);
    return null;
  }
};

/**
 * Get Documenso config that belongs to user's own organization (for updates).
 * Returns null if user's org doesn't have its own config.
 * Does NOT return parent org's config since user shouldn't update that.
 */
export const getDocumensoConfigForUpdate = async (
  accessToken: string,
): Promise<DocumensoConfig | null> => {
  try {
    // Get user info and configs in parallel
    const [currentUser, configs] = await Promise.all([
      getCurrentUser(accessToken),
      getDocumensoConfigs(accessToken),
    ]);

    if (!currentUser) return null;

    const userOrgId = currentUser.organization.id;

    // Only return config if it belongs to user's own org
    return configs.find((c) => c.organizationId === userOrgId) || null;
  } catch (error) {
    console.error('[Cockpit] Error fetching Documenso config for update:', error);
    return null;
  }
};

/**
 * Get just the Documenso settings (meta field) from Cockpit.
 * Returns null if config doesn't exist.
 */
export const getDocumensoSettings = async (
  accessToken: string,
): Promise<DocumensoConfigMeta | null> => {
  const config = await getDocumensoConfig(accessToken);
  return config?.meta ?? null;
};

/**
 * Create or update Documenso configuration in Cockpit.
 * This pushes settings from Documenso to Cockpit.
 *
 * @param accessToken - The OIDC access token
 * @param settings - The Documenso settings to save
 * @param existingConfigId - Optional ID of existing config (for updates)
 * @returns The saved config or null if failed
 */
export const upsertDocumensoConfig = async (
  accessToken: string,
  settings: DocumensoConfigMeta,
  existingConfigId?: number,
): Promise<DocumensoConfig | null> => {
  try {
    const client = createCockpitClient(accessToken);
    const payload = {
      ...(existingConfigId ? { id: existingConfigId } : {}),
      identifier: DOCUMENSO_CONFIG_IDENTIFIER,
      meta: {
        documensoConfig: settings,
      },
    };

    console.log('[Cockpit] Upserting Documenso config:', payload);
    const result = await client.post('/configs', payload);
    return result as unknown as DocumensoConfig;
  } catch (error) {
    console.error('[Cockpit] Failed to upsert Documenso config:', error);
    return null;
  }
};

// ============================================================================
// Combined Helper: Get all user context for Documenso
// ============================================================================

export type DocumensoUserContext = {
  user: CockpitCurrentUser;
  preferences: CockpitUserPreferences | null;
  locale: string | null;
  orgConfig: DocumensoConfigMeta | null;
};

/**
 * Get complete user context for Documenso in a single call.
 * Fetches user info, preferences, and organization's Documenso config in parallel.
 *
 * This is the recommended way to get all context needed when a user logs in.
 */
export const getDocumensoUserContext = async (
  accessToken: string,
): Promise<DocumensoUserContext | null> => {
  const [user, preferences, orgConfig] = await Promise.all([
    getCurrentUser(accessToken),
    getUserPreferences(accessToken),
    getDocumensoSettings(accessToken),
  ]);

  if (!user) {
    return null;
  }

  return {
    user,
    preferences,
    locale: preferences?.preferences?.locale ?? null,
    orgConfig,
  };
};

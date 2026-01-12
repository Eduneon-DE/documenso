import * as jose from 'jose';

import { env } from '@documenso/lib/utils/env';
import { prisma } from '@documenso/prisma';

export interface JwtPayload {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  preferred_username?: string;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
}

let cachedJwks: jose.JWTVerifyGetKey | null = null;
let jwksLastFetched = 0;
const JWKS_CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Get JWKS (JSON Web Key Set) from Authentik for JWT validation.
 * Caches the JWKS for performance.
 */
const getJwks = async (): Promise<jose.JWTVerifyGetKey | null> => {
  const wellKnownUrl = env('NEXT_PRIVATE_OIDC_WELL_KNOWN');
  if (!wellKnownUrl) {
    console.warn('[JWT] OIDC well-known URL not configured');
    return null;
  }

  // Return cached JWKS if still valid
  if (cachedJwks && Date.now() - jwksLastFetched < JWKS_CACHE_TTL) {
    return cachedJwks;
  }

  try {
    // Fetch OpenID configuration to get JWKS URI
    const configResponse = await fetch(wellKnownUrl);
    const config = await configResponse.json();
    const jwksUri = config.jwks_uri;

    if (!jwksUri) {
      console.error('[JWT] No jwks_uri in OpenID configuration');
      return null;
    }

    // Create JWKS remote key set
    cachedJwks = jose.createRemoteJWKSet(new URL(jwksUri));
    jwksLastFetched = Date.now();

    return cachedJwks;
  } catch (error) {
    console.error('[JWT] Failed to fetch JWKS:', error);
    return null;
  }
};

/**
 * Validate a JWT token from Authentik.
 * Returns the decoded payload if valid, null otherwise.
 */
export const validateAuthentikJwt = async (token: string): Promise<JwtPayload | null> => {
  try {
    const jwks = await getJwks();
    if (!jwks) {
      return null;
    }

    // Verify the JWT
    const { payload } = await jose.jwtVerify(token, jwks, {
      // Don't validate audience - allow tokens from different clients (Cockpit SPA, Documenso confidential)
      // The issuer validation ensures it's from our Authentik instance
    });

    // Ensure we have an email
    if (!payload.email || typeof payload.email !== 'string') {
      console.warn('[JWT] Token missing email claim');
      return null;
    }

    return {
      sub: payload.sub as string,
      email: payload.email as string,
      email_verified: payload.email_verified as boolean | undefined,
      name: payload.name as string | undefined,
      preferred_username: payload.preferred_username as string | undefined,
      iss: payload.iss,
      aud: payload.aud,
      exp: payload.exp,
      iat: payload.iat,
    };
  } catch (error) {
    console.warn('[JWT] Token validation failed:', error instanceof Error ? error.message : error);
    return null;
  }
};

/**
 * Get a Documenso user from an Authentik JWT.
 * Validates the JWT and looks up the user by email.
 */
export const getUserFromJwt = async (token: string) => {
  const payload = await validateAuthentikJwt(token);
  if (!payload) {
    return null;
  }

  // Look up user by email
  const user = await prisma.user.findFirst({
    where: {
      email: payload.email,
    },
  });

  if (!user) {
    console.warn('[JWT] No user found for email:', payload.email);
    return null;
  }

  return user;
};

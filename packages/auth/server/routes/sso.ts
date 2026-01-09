import { sValidator } from '@hono/standard-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { OidcAuthOptions } from '../config';
import { onAuthorize } from '../lib/utils/authorizer';
import { getOpenIdConfiguration } from '../lib/utils/open-id';
import type { HonoAuthContext } from '../types/context';

const ZSsoTokenSchema = z.object({
  accessToken: z.string().min(1),
  redirectPath: z.string().optional(),
});

/**
 * SSO route for token-based authentication.
 * Allows users already authenticated with the identity provider (e.g., from Cockpit)
 * to seamlessly authenticate with Documenso using their existing access token.
 */
export const ssoRoute = new Hono<HonoAuthContext>()
  /**
   * Token-based SSO endpoint.
   * Validates an access token against the OIDC provider's userinfo endpoint
   * and creates a Documenso session if valid.
   */
  .post('/token', sValidator('json', ZSsoTokenSchema), async (c) => {
    const { accessToken, redirectPath } = c.req.valid('json');

    if (!OidcAuthOptions.clientId || !OidcAuthOptions.wellKnownUrl) {
      throw new AppError(AppErrorCode.NOT_SETUP, {
        message: 'OIDC is not configured',
      });
    }

    // Get the userinfo endpoint from OIDC configuration
    const config = await getOpenIdConfiguration(OidcAuthOptions.wellKnownUrl, {
      requiredScopes: OidcAuthOptions.scope,
    });

    if (!config.userinfo_endpoint) {
      throw new AppError(AppErrorCode.NOT_SETUP, {
        message: 'OIDC provider does not support userinfo endpoint',
      });
    }

    // Validate the access token by calling the userinfo endpoint
    const userinfoResponse = await fetch(config.userinfo_endpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userinfoResponse.ok) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'Invalid or expired access token',
      });
    }

    const userinfo = await userinfoResponse.json();

    const email = userinfo.email;
    const name = userinfo.name || userinfo.preferred_username || email.split('@')[0];
    const sub = userinfo.sub;

    if (!email || !sub) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Token does not contain required user information',
      });
    }

    // Find or create user
    let user = await prisma.user.findFirst({
      where: { email },
      select: { id: true },
    });

    if (!user) {
      // Create new user
      user = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            email,
            name,
            emailVerified: new Date(),
          },
        });

        // Link the OIDC account
        await tx.account.create({
          data: {
            type: 'oauth',
            provider: OidcAuthOptions.id,
            providerAccountId: sub,
            access_token: accessToken,
            token_type: 'Bearer',
            userId: newUser.id,
          },
        });

        return newUser;
      });
    } else {
      // Check if account link exists, create if not
      const existingAccount = await prisma.account.findFirst({
        where: {
          provider: OidcAuthOptions.id,
          userId: user.id,
        },
      });

      if (!existingAccount) {
        await prisma.account.create({
          data: {
            type: 'oauth',
            provider: OidcAuthOptions.id,
            providerAccountId: sub,
            access_token: accessToken,
            token_type: 'Bearer',
            userId: user.id,
          },
        });
      }
    }

    // Create session
    await onAuthorize({ userId: user.id }, c);

    return c.json({
      success: true,
      redirectPath: redirectPath || '/',
    });
  });

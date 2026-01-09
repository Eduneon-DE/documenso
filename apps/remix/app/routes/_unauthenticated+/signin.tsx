import { useEffect, useRef, useState } from 'react';

import { Trans } from '@lingui/react/macro';
import { Link, redirect } from 'react-router';

import { authClient } from '@documenso/auth/client';
import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';
import {
  IS_GOOGLE_SSO_ENABLED,
  IS_MICROSOFT_SSO_ENABLED,
  IS_OIDC_SSO_ENABLED,
  OIDC_PROVIDER_LABEL,
} from '@documenso/lib/constants/auth';
import { env } from '@documenso/lib/utils/env';
import { isValidReturnTo, normalizeReturnTo } from '@documenso/lib/utils/is-valid-return-to';

import { SignInForm } from '~/components/forms/signin';
import { appMetaTags } from '~/utils/meta';

import type { Route } from './+types/signin';

const COCKPIT_TOKEN_KEY = 'token';

export function meta() {
  return appMetaTags('Sign In');
}

export async function loader({ request }: Route.LoaderArgs) {
  const { isAuthenticated } = await getOptionalSession(request);

  // SSR env variables.
  const isGoogleSSOEnabled = IS_GOOGLE_SSO_ENABLED;
  const isMicrosoftSSOEnabled = IS_MICROSOFT_SSO_ENABLED;
  const isOIDCSSOEnabled = IS_OIDC_SSO_ENABLED;
  const oidcProviderLabel = OIDC_PROVIDER_LABEL;
  const oidcAutoRedirect = isOIDCSSOEnabled && env('NEXT_PUBLIC_OIDC_AUTO_REDIRECT') === 'true';

  let returnTo = new URL(request.url).searchParams.get('returnTo') ?? undefined;

  returnTo = isValidReturnTo(returnTo) ? normalizeReturnTo(returnTo) : undefined;

  if (isAuthenticated) {
    throw redirect(returnTo || '/');
  }

  return {
    isGoogleSSOEnabled,
    isMicrosoftSSOEnabled,
    isOIDCSSOEnabled,
    oidcProviderLabel,
    oidcAutoRedirect,
    returnTo,
  };
}

export default function SignIn({ loaderData }: Route.ComponentProps) {
  const {
    isGoogleSSOEnabled,
    isMicrosoftSSOEnabled,
    isOIDCSSOEnabled,
    oidcProviderLabel,
    oidcAutoRedirect,
    returnTo,
  } = loaderData;

  const [isEmbeddedRedirect, setIsEmbeddedRedirect] = useState(false);
  const [isAutoRedirecting, setIsAutoRedirecting] = useState(true);
  const [statusMessage, setStatusMessage] = useState('Checking authentication...');
  const hasTriggeredAuth = useRef(false);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    setIsEmbeddedRedirect(params.get('embedded') === 'true');
  }, []);

  useEffect(() => {
    if (hasTriggeredAuth.current) return;
    hasTriggeredAuth.current = true;

    const attemptAuth = async () => {
      // First, check if there's a Cockpit token in localStorage (shared origin)
      const cockpitToken = localStorage.getItem(COCKPIT_TOKEN_KEY);

      if (cockpitToken) {
        setStatusMessage('Authenticating with Eduneon...');
        try {
          const response = await fetch('/api/auth/sso/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              accessToken: cockpitToken,
              redirectPath: returnTo,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            // Session cookie is set, redirect to dashboard
            window.location.href = data.redirectPath || '/';
            return;
          }
        } catch (error) {
          console.error('SSO token auth failed:', error);
        }
      }

      // Fall back to OIDC auto-redirect if enabled
      if (oidcAutoRedirect) {
        setStatusMessage('Redirecting to Eduneon login...');
        try {
          await authClient.oidc.signIn({ redirectPath: returnTo });
          return;
        } catch (error) {
          console.error('OIDC redirect failed:', error);
        }
      }

      // Show login form if all auto-auth methods fail
      setIsAutoRedirecting(false);
    };

    void attemptAuth();
  }, [oidcAutoRedirect, returnTo]);

  if (isAutoRedirecting) {
    return (
      <div className="w-screen max-w-lg px-4">
        <div className="z-10 rounded-xl border border-border bg-neutral-100 p-6 text-center dark:bg-background">
          <p className="text-muted-foreground">{statusMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen max-w-lg px-4">
      <div className="z-10 rounded-xl border border-border bg-neutral-100 p-6 dark:bg-background">
        <h1 className="text-2xl font-semibold">
          <Trans>Sign in to your account</Trans>
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          <Trans>Welcome back, we are lucky to have you.</Trans>
        </p>
        <hr className="-mx-6 my-4" />

        <SignInForm
          isGoogleSSOEnabled={isGoogleSSOEnabled}
          isMicrosoftSSOEnabled={isMicrosoftSSOEnabled}
          isOIDCSSOEnabled={isOIDCSSOEnabled}
          oidcProviderLabel={oidcProviderLabel}
          returnTo={returnTo}
        />

        {!isEmbeddedRedirect && env('NEXT_PUBLIC_DISABLE_SIGNUP') !== 'true' && (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Trans>
              Don't have an account?{' '}
              <Link
                to={returnTo ? `/signup?returnTo=${encodeURIComponent(returnTo)}` : '/signup'}
                className="text-documenso-700 duration-200 hover:opacity-70"
              >
                Sign up
              </Link>
            </Trans>
          </p>
        )}
      </div>
    </div>
  );
}

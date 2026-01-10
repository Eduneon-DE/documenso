import { getCurrentUser, getUserAccessToken } from '@documenso/lib/server-only/cockpit/client';

import { authenticatedProcedure } from '../trpc';
import { ZGetCockpitBrandingResponseSchema } from './get-cockpit-branding.types';

export const getCockpitBrandingRoute = authenticatedProcedure
  .output(ZGetCockpitBrandingResponseSchema)
  .query(async ({ ctx }) => {
    const userId = ctx.user.id;

    ctx.logger.info({
      message: 'Fetching Cockpit branding for user',
      userId,
    });

    // Get the user's OIDC access token
    const accessToken = await getUserAccessToken(userId);

    if (!accessToken) {
      ctx.logger.info({
        message: 'No Cockpit access token found for user',
        userId,
      });

      return {
        logoUrl: null,
        logoBase64: null,
        logoContentType: null,
        organizationName: null,
      };
    }

    // Fetch current user from Cockpit (includes organization with logo)
    const cockpitUser = await getCurrentUser(accessToken);

    if (!cockpitUser) {
      ctx.logger.info({
        message: 'Could not fetch Cockpit user data',
        userId,
      });

      return {
        logoUrl: null,
        logoBase64: null,
        logoContentType: null,
        organizationName: null,
      };
    }

    // Extract logo URL from organization (check both 'link' and 'url' fields)
    const logo = cockpitUser.organization?.logo;
    const logoUrl = logo?.link || logo?.url || null;
    const organizationName = cockpitUser.organization?.name || null;

    ctx.logger.info({
      message: 'Fetched Cockpit branding info',
      userId,
      hasLogo: !!logoUrl,
      logoUrl,
      organizationName,
      rawLogo: logo,
    });

    // If we have a logo URL, fetch it and convert to base64
    let logoBase64: string | null = null;
    let logoContentType: string | null = null;

    if (logoUrl) {
      try {
        const response = await fetch(logoUrl);

        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          logoBase64 = buffer.toString('base64');
          logoContentType = response.headers.get('content-type') || 'image/png';

          ctx.logger.info({
            message: 'Successfully fetched and converted logo to base64',
            userId,
            contentType: logoContentType,
            size: buffer.length,
          });
        } else {
          ctx.logger.warn({
            message: 'Failed to fetch logo from Cockpit',
            userId,
            status: response.status,
            logoUrl,
          });
        }
      } catch (error) {
        ctx.logger.error({
          message: 'Error fetching logo from Cockpit',
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
          logoUrl,
        });
      }
    }

    return {
      logoUrl,
      logoBase64,
      logoContentType,
      organizationName,
    };
  });

import type { OrganisationGlobalSettings } from '@prisma/client';
import { DocumentVisibility } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import {
  getCurrentUser,
  getDocumensoConfigForUpdate,
  getDocumensoSettings,
  getUserAccessToken,
  getUserPreferences,
  upsertDocumensoConfig,
} from './client';
import type { DocumensoConfigMeta } from './types';

/**
 * Maps Cockpit's DocumentVisibility values to Documenso's enum.
 */
const mapDocumentVisibility = (
  visibility: string | null | undefined,
): DocumentVisibility | undefined => {
  if (!visibility) return undefined;

  const mapping: Record<string, DocumentVisibility> = {
    EVERYONE: DocumentVisibility.EVERYONE,
    MANAGER_AND_ABOVE: DocumentVisibility.MANAGER_AND_ABOVE,
    ADMIN: DocumentVisibility.ADMIN,
  };

  return mapping[visibility];
};

/**
 * Sync Cockpit configuration to Documenso's OrganisationGlobalSettings.
 *
 * This function fetches the Documenso config from Cockpit (managed by school board admin)
 * and updates the user's organisation settings accordingly. It should be called
 * during SSO login to ensure settings are in sync.
 *
 * Synced settings:
 * - Document defaults (language, timezone, date format, visibility)
 * - Signature type settings (which types are enabled: typed, upload, draw)
 * - Certificate/audit settings
 * - Email settings (reply-to)
 *
 * NOT synced (organization-specific in Documenso):
 * - Branding (logo, company name, colors) - each org sets their own
 * - User signatures - created directly in Documenso by each user
 *
 * @param userId - The Documenso user ID
 * @param accessToken - The OIDC access token for Cockpit API calls
 * @returns true if sync succeeded, false if failed or skipped
 */
export const syncCockpitConfigToOrganisation = async (
  userId: number,
  accessToken: string,
): Promise<boolean> => {
  try {
    console.log('[Cockpit] Starting config sync for user:', userId);

    // Fetch Cockpit data in parallel
    const [cockpitConfig, userPreferences, currentUser] = await Promise.all([
      getDocumensoSettings(accessToken),
      getUserPreferences(accessToken),
      getCurrentUser(accessToken),
    ]);

    if (!currentUser) {
      console.log('[Cockpit] Could not get current user, skipping sync');
      return false;
    }

    // Find the user's organisation (in Cockpit mode, user should have one org)
    const organisationMember = await prisma.organisationMember.findFirst({
      where: { userId },
      include: {
        organisation: {
          include: {
            organisationGlobalSettings: true,
          },
        },
      },
    });

    if (!organisationMember?.organisation) {
      console.log('[Cockpit] No organisation found for user, skipping sync');
      return false;
    }

    const { organisation } = organisationMember;
    const settingsId = organisation.organisationGlobalSettings.id;
    const currentSettings = organisation.organisationGlobalSettings;

    // Build update data from Cockpit config
    const updateData: Record<string, unknown> = {};

    // Set default branding from organization if not already configured
    // Organization logo from Cockpit is used as default branding logo
    const orgLogo = currentUser.organization.logo?.url || currentUser.organization.logo?.link;
    const orgName = currentUser.organization.name;

    if (!currentSettings.brandingLogo && orgLogo) {
      updateData.brandingLogo = orgLogo;
      updateData.brandingEnabled = true;
      console.log('[Cockpit] Setting default branding logo from organization');
    }

    if (!currentSettings.brandingCompanyDetails && orgName) {
      updateData.brandingCompanyDetails = orgName;
    }

    // Sync document defaults (from school board config, applies to all sub-orgs)
    if (cockpitConfig?.documentDefaults) {
      const { language, timezone, dateFormat, documentVisibility } = cockpitConfig.documentDefaults;
      if (language !== undefined) updateData.documentLanguage = language || 'en';
      if (timezone !== undefined) updateData.documentTimezone = timezone;
      if (dateFormat !== undefined) updateData.documentDateFormat = dateFormat;
      const mappedVisibility = mapDocumentVisibility(documentVisibility);
      if (mappedVisibility) updateData.documentVisibility = mappedVisibility;
    }

    // Sync user's locale preference to document language if not set in org config
    if (!cockpitConfig?.documentDefaults?.language && userPreferences?.preferences?.locale) {
      updateData.documentLanguage = userPreferences.preferences.locale;
    }

    // Sync signature settings
    if (cockpitConfig?.signatureSettings) {
      const { typedSignatureEnabled, uploadSignatureEnabled, drawSignatureEnabled } =
        cockpitConfig.signatureSettings;
      if (typedSignatureEnabled !== undefined)
        updateData.typedSignatureEnabled = typedSignatureEnabled;
      if (uploadSignatureEnabled !== undefined)
        updateData.uploadSignatureEnabled = uploadSignatureEnabled;
      if (drawSignatureEnabled !== undefined)
        updateData.drawSignatureEnabled = drawSignatureEnabled;
    }

    // Sync certificate/audit settings
    if (cockpitConfig?.certificateSettings) {
      const { includeSenderDetails, includeSigningCertificate, includeAuditLog } =
        cockpitConfig.certificateSettings;
      if (includeSenderDetails !== undefined)
        updateData.includeSenderDetails = includeSenderDetails;
      if (includeSigningCertificate !== undefined)
        updateData.includeSigningCertificate = includeSigningCertificate;
      if (includeAuditLog !== undefined) updateData.includeAuditLog = includeAuditLog;
    }

    // Sync email settings
    if (cockpitConfig?.emailSettings) {
      const { replyToEmail } = cockpitConfig.emailSettings;
      if (replyToEmail !== undefined) updateData.emailReplyTo = replyToEmail;
    }

    // Only update if there are changes
    if (Object.keys(updateData).length === 0) {
      console.log('[Cockpit] No config changes to sync');
      return true;
    }

    // Validate at least one signature type is enabled
    const finalTypedEnabled =
      updateData.typedSignatureEnabled ?? currentSettings.typedSignatureEnabled;
    const finalUploadEnabled =
      updateData.uploadSignatureEnabled ?? currentSettings.uploadSignatureEnabled;
    const finalDrawEnabled =
      updateData.drawSignatureEnabled ?? currentSettings.drawSignatureEnabled;

    if (!finalTypedEnabled && !finalUploadEnabled && !finalDrawEnabled) {
      console.warn('[Cockpit] Invalid config: At least one signature type must be enabled');
      // Don't apply signature settings if all would be disabled
      delete updateData.typedSignatureEnabled;
      delete updateData.uploadSignatureEnabled;
      delete updateData.drawSignatureEnabled;
    }

    // Update the organisation settings
    await prisma.organisationGlobalSettings.update({
      where: { id: settingsId },
      data: updateData,
    });

    console.log('[Cockpit] Successfully synced config to organisation:', {
      organisationId: organisation.id,
      updatedFields: Object.keys(updateData),
    });

    return true;
  } catch (error) {
    console.error('[Cockpit] Failed to sync config:', error);
    return false;
  }
};

/**
 * Maps Documenso's DocumentVisibility enum to Cockpit's string values.
 */
const mapDocumentVisibilityToCockpit = (
  visibility: DocumentVisibility | undefined,
): DocumensoConfigMeta['documentDefaults']['documentVisibility'] | undefined => {
  if (!visibility) return undefined;

  const mapping: Record<DocumentVisibility, 'EVERYONE' | 'MANAGER_AND_ABOVE' | 'ADMIN'> = {
    [DocumentVisibility.EVERYONE]: 'EVERYONE',
    [DocumentVisibility.MANAGER_AND_ABOVE]: 'MANAGER_AND_ABOVE',
    [DocumentVisibility.ADMIN]: 'ADMIN',
  };

  return mapping[visibility];
};

/**
 * Sync Documenso organisation settings TO Cockpit.
 *
 * This function pushes settings from Documenso to Cockpit's config.
 * Should be called after organisation settings are updated in Documenso.
 *
 * @param userId - The Documenso user ID (to get access token)
 * @param settings - The organisation settings that were updated
 * @returns true if sync succeeded, false if failed or skipped
 */
export const syncOrganisationToCockpit = async (
  userId: number,
  settings: Partial<OrganisationGlobalSettings>,
): Promise<boolean> => {
  try {
    console.log('[Cockpit] Starting reverse sync to Cockpit for user:', userId);

    // Get user's access token (handles expiration and refresh automatically)
    const accessToken = await getUserAccessToken(userId);

    if (!accessToken) {
      console.log('[Cockpit] No OIDC access token found, skipping Cockpit sync');
      return false;
    }

    // Get current user to check if they're from parent org
    const currentUser = await getCurrentUser(accessToken);
    if (!currentUser) {
      console.log('[Cockpit] Could not get current user, skipping Cockpit sync');
      return false;
    }

    // Check if user is from parent organization (no parentOrganization means they ARE the parent)
    const isParentOrg = !currentUser.organization.parentOrganization;

    // Get user's own org config (not parent's) for update
    const existingConfig = await getDocumensoConfigForUpdate(accessToken);

    // Get organization logo from Cockpit (always use org's logo for branding)
    const orgLogo = currentUser.organization.logo?.url || currentUser.organization.logo?.link;

    // Build Cockpit config from Documenso settings
    // Document settings are only synced by parent org
    // Branding is organization-specific (each org manages their own)
    const cockpitSettings: DocumensoConfigMeta = {
      // Branding - each org can update their own
      // Logo always comes from organization's logo in Cockpit
      branding: {
        enabled: settings.brandingEnabled ?? undefined,
        logo: orgLogo ?? undefined,
        companyName: settings.brandingCompanyDetails ?? undefined,
      },
    };

    // Only parent org can sync document settings
    if (isParentOrg) {
      cockpitSettings.documentDefaults = {
        language: settings.documentLanguage as 'de' | 'en' | undefined,
        timezone: settings.documentTimezone ?? undefined,
        dateFormat: settings.documentDateFormat ?? undefined,
        documentVisibility: mapDocumentVisibilityToCockpit(settings.documentVisibility),
      };
      cockpitSettings.signatureSettings = {
        typedSignatureEnabled: settings.typedSignatureEnabled ?? undefined,
        uploadSignatureEnabled: settings.uploadSignatureEnabled ?? undefined,
        drawSignatureEnabled: settings.drawSignatureEnabled ?? undefined,
      };
      cockpitSettings.certificateSettings = {
        includeSenderDetails: settings.includeSenderDetails ?? undefined,
        includeSigningCertificate: settings.includeSigningCertificate ?? undefined,
        includeAuditLog: settings.includeAuditLog ?? undefined,
      };
      cockpitSettings.emailSettings = {
        replyToEmail: settings.emailReplyTo ?? undefined,
      };
    }

    // Upsert config to Cockpit
    const result = await upsertDocumensoConfig(accessToken, cockpitSettings, existingConfig?.id);

    if (result) {
      console.log('[Cockpit] Successfully synced organisation settings to Cockpit:', {
        configId: result.id,
        isParentOrg,
        syncedFields: isParentOrg ? 'all' : 'branding only',
      });
      return true;
    }

    return false;
  } catch (error) {
    console.error('[Cockpit] Failed to sync organisation settings to Cockpit:', error);
    return false;
  }
};

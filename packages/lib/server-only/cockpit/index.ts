export {
  // Token management
  getUserAccessToken,
  // User API
  getUsers,
  searchUsers,
  // Auth API
  getCurrentUser,
  // User Preferences API
  getUserPreferences,
  getUserLocale,
  // Combined helpers
  getCurrentUserWithPreferences,
  // Documenso Configuration API
  getDocumensoConfig,
  getDocumensoSettings,
  getDocumensoUserContext,
} from './client';

// Config sync
export { syncCockpitConfigToOrganisation, syncOrganisationToCockpit } from './sync-config';

// JWT validation for Cockpit/Authentik tokens
export { getUserFromJwt, validateAuthentikJwt } from './validate-jwt';

// Upsert config
export { upsertDocumensoConfig } from './client';

export type { CockpitUserWithPreferences, DocumensoUserContext } from './client';

export type {
  CockpitUserListItem,
  CockpitCurrentUser,
  CockpitUserPreferences,
  CockpitAuthAccount,
  CockpitOrganization,
  PaginatedResponse,
  // Documenso config types
  DocumensoConfig,
  DocumensoConfigMeta,
  CockpitConfig,
} from './types';

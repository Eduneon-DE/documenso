/**
 * Types for Cockpit API integration.
 * These types mirror the Cockpit API response structure.
 */

export interface CockpitUser {
  id: number;
  firstName: string;
  lastName?: string;
  fullName?: string;
  telephone?: string;
  position?: string;
  office?: string;
  subjectArea?: string;
  department?: string;
  avatarId?: number;
}

export interface CockpitAttachment {
  id: number;
  url?: string;
  link?: string;
  filename?: string;
}

export interface CockpitOrganizationCategory {
  id: number;
  name: string;
}

export interface CockpitPlanAccessControl {
  id: number;
  // Add more fields as needed
}

export interface CockpitOrganization {
  id: number;
  name: string;
  logo?: CockpitAttachment;
  planAccessControl?: CockpitPlanAccessControl;
  organizationCategory?: CockpitOrganizationCategory;
  parentOrganization?: CockpitOrganization;
  subOrganizations?: { id: number; name: string }[];
}

export interface CockpitAccessibleOrganization {
  id: number;
  organizationId: number;
  authenticationAccountId: number;
  organization?: CockpitOrganization;
}

export interface CockpitRole {
  id: number;
  name: string;
  description?: string;
}

export interface CockpitDepartment {
  id: number;
  name: string;
  parentDepartment?: CockpitDepartment;
  subDepartments?: CockpitDepartment[];
}

export interface CockpitAuthAccount {
  id: number;
  email: string;
  isTwoFaVerified?: boolean;
  user: CockpitUser & {
    avatar?: CockpitAttachment;
  };
  access?: CockpitAccessibleOrganization[];
  organization: CockpitOrganization & {
    access?: CockpitAccessibleOrganization[];
  };
  role: CockpitRole;
  department?: CockpitDepartment;
  isParentOrgUser?: boolean;
  isAdminUser?: boolean;
  isParentOrgAdmin?: boolean;
}

/**
 * User list item returned by Cockpit's /users endpoint.
 * This is a subset of CockpitAuthAccount with the fields commonly returned in list views.
 */
export interface CockpitUserListItem {
  id: number;
  email: string;
  status: string;
  type: string;
  organizationId: number;
  user: {
    id: number;
    firstName: string;
    lastName?: string;
    fullName?: string;
    avatar?: CockpitAttachment;
  };
  organization?: {
    id: number;
    name: string;
  };
  role?: CockpitRole;
  department?: CockpitDepartment;
}

/**
 * User preferences stored in Cockpit.
 * Includes locale/language preference.
 */
export interface CockpitUserPreferences {
  id: number;
  authenticationAccountId: number;
  preferences: {
    locale?: string | null;
    tableConfig?: Record<string, unknown>;
    dashboard?: Record<string, unknown[]>;
    inventory?: {
      selectedOrganizationId?: number | null;
    };
    notifications?: Record<
      string,
      {
        isEmailNotificationEnabled: boolean;
        isDashboardNotificationEnabled: boolean;
        durationType?: string | null;
        duration?: number | null;
      }
    >;
    event?: {
      notifyBefore?: number | null;
    };
  };
}

/**
 * Current user response from /auth/me endpoint.
 * Returns the full authenticated user with organization context.
 */
export type CockpitCurrentUser = CockpitAuthAccount;

/**
 * Paginated response wrapper.
 */
export interface PaginatedResponse<T> {
  data: T[];
  count: number;
}

// ============================================================================
// Documenso Configuration (stored in Cockpit's Config model)
// ============================================================================

/**
 * Documenso settings stored in Cockpit's Config model.
 * Managed by school board admin, applied to all sub-organizations.
 */
export interface DocumensoConfigMeta {
  // Branding settings
  branding?: {
    enabled?: boolean;
    logo?: string; // URL to logo
    companyName?: string;
    brandColor?: string;
  };

  // Default document settings
  documentDefaults?: {
    language?: string; // 'de' | 'en'
    timezone?: string;
    dateFormat?: string;
    signingOrder?: 'PARALLEL' | 'SEQUENTIAL';
    documentVisibility?: 'EVERYONE' | 'MANAGER_AND_ABOVE' | 'ADMIN';
  };

  // Signature settings
  signatureSettings?: {
    typedSignatureEnabled?: boolean;
    uploadSignatureEnabled?: boolean;
    drawSignatureEnabled?: boolean;
  };

  // Certificate & Audit settings
  certificateSettings?: {
    includeSenderDetails?: boolean;
    includeSigningCertificate?: boolean;
    includeAuditLog?: boolean;
  };

  // Email settings
  emailSettings?: {
    senderName?: string;
    replyToEmail?: string;
  };
}

/**
 * Cockpit Config model structure (from Cockpit's /configs API)
 */
export interface CockpitConfig {
  id: number;
  uuid: string;
  isShared: boolean;
  identifier: string | null;
  name: string | null;
  key: string | null;
  meta: Record<string, unknown> | null;
  organizationId: number | null;
  organization?: CockpitOrganization;
  createdBy: number | null;
  updatedBy: number | null;
}

/**
 * Documenso-specific config with typed meta
 */
export interface DocumensoConfig extends Omit<CockpitConfig, 'meta'> {
  identifier: 'documenso';
  meta: DocumensoConfigMeta | null;
}

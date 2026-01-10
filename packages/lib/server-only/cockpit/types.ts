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

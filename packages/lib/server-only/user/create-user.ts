import { hash } from '@node-rs/bcrypt';
import type { User } from '@prisma/client';
import { OrganisationType } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { IS_COCKPIT_MODE } from '../../constants/app';
import { SALT_ROUNDS } from '../../constants/auth';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { INTERNAL_CLAIM_ID, internalClaims } from '../../types/subscription';
import { prefixedId } from '../../universal/id';
import { getCurrentUser } from '../cockpit/client';
import { syncCockpitConfigToOrganisation } from '../cockpit/sync-config';
import {
  createOrganisation,
  createPersonalOrganisation,
} from '../organisation/create-organisation';
import { createTeam } from '../team/create-team';

export interface CreateUserOptions {
  name: string;
  email: string;
  password: string;
  signature?: string | null;
}

export const createUser = async ({ name, email, password, signature }: CreateUserOptions) => {
  const hashedPassword = await hash(password, SALT_ROUNDS);

  const userExists = await prisma.user.findFirst({
    where: {
      email: email.toLowerCase(),
    },
  });

  if (userExists) {
    throw new AppError(AppErrorCode.ALREADY_EXISTS);
  }

  const user = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        password: hashedPassword, // Todo: (RR7) Drop password.
        signature,
      },
    });

    // Todo: (RR7) Migrate to use this after RR7.
    // await tx.account.create({
    //   data: {
    //     userId: user.id,
    //     type: 'emailPassword', // Todo: (RR7)
    //     provider: 'DOCUMENSO', // Todo: (RR7) Enums
    //     providerAccountId: user.id.toString(),
    //     password: hashedPassword,
    //   },
    // });

    return user;
  });

  // Not used at the moment, uncomment if required.
  await onCreateUserHook(user).catch((err) => {
    // Todo: (RR7) Add logging.
    console.error(err);
  });

  return user;
};

export type OnCreateUserHookOptions = {
  accessToken?: string;
};

/**
 * Should be run after a user is created, example during email password signup or google sign in.
 *
 * For Cockpit mode (OIDC login), creates an organization based on the Cockpit organization data
 * instead of a personal organization.
 *
 * @returns User
 */
export const onCreateUserHook = async (user: User, options?: OnCreateUserHookOptions) => {
  const { accessToken } = options || {};

  // In Cockpit mode with access token, create organization from Cockpit data
  if (IS_COCKPIT_MODE() && accessToken) {
    try {
      const cockpitUser = await getCurrentUser(accessToken);

      if (cockpitUser?.organization) {
        const orgName = cockpitUser.organization.name || 'Organisation';

        // Create an organization (not personal) with Cockpit org name
        const organisation = await createOrganisation({
          name: orgName,
          userId: user.id,
          type: OrganisationType.ORGANISATION,
          claim: internalClaims[INTERNAL_CLAIM_ID.FREE],
        });

        if (organisation) {
          // Create a default team for the organization
          await createTeam({
            userId: user.id,
            teamName: orgName,
            teamUrl: prefixedId('team'),
            organisationId: organisation.id,
            inheritMembers: true,
          }).catch((err) => {
            console.error('[Cockpit] Failed to create team:', err);
          });

          // Sync Cockpit config to the new organisation (sets default branding from org logo)
          await syncCockpitConfigToOrganisation(user.id, accessToken).catch((err) => {
            console.error('[Cockpit] Failed to sync config on user creation:', err);
          });
        }

        return user;
      }
    } catch (error) {
      console.error('[Cockpit] Failed to create organisation from Cockpit data:', error);
      // Fall through to create personal organisation as fallback
    }
  }

  // Default: create personal organisation
  await createPersonalOrganisation({ userId: user.id });

  return user;
};

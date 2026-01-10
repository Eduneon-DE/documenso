import { EnvelopeType, Prisma } from '@prisma/client';
import { z } from 'zod';

import { getUserAccessToken, searchUsers } from '@documenso/lib/server-only/cockpit';
import { buildTeamWhereQuery } from '@documenso/lib/utils/teams';
import { prisma } from '@documenso/prisma';

// Simple email validation
const isValidEmail = (email: string): boolean => {
  return z.string().email().safeParse(email).success;
};

export type GetRecipientSuggestionsOptions = {
  userId: number;
  teamId: number;
  query: string;
  take?: number;
  skip?: number;
};

export type RecipientSuggestion = {
  name: string | null;
  email: string;
  avatarUrl?: string | null;
  organizationName?: string | null;
};

export type GetRecipientSuggestionsResult = {
  suggestions: RecipientSuggestion[];
  hasMore: boolean;
  nextSkip: number;
};

export const getRecipientSuggestions = async ({
  userId,
  teamId,
  query,
  take = 10,
  skip = 0,
}: GetRecipientSuggestionsOptions): Promise<GetRecipientSuggestionsResult> => {
  const trimmedQuery = query.trim();

  // Fetch Cockpit users (even with empty query for default suggestions)
  let cockpitSuggestions: RecipientSuggestion[] = [];

  try {
    const accessToken = await getUserAccessToken(userId);

    if (accessToken) {
      // Fetch more than needed to handle pagination properly
      const cockpitUsers = await searchUsers(accessToken, trimmedQuery, take + skip + 1);

      cockpitSuggestions = cockpitUsers.map((u) => {
        const avatarUrl = u.user?.avatar?.link || null;
        console.log('[Cockpit] User avatar data:', {
          email: u.email,
          avatar: u.user?.avatar,
          avatarUrl,
        });
        return {
          name: u.user?.fullName || `${u.user?.firstName} ${u.user?.lastName || ''}`.trim(),
          email: u.email,
          avatarUrl,
          organizationName: u.organization?.name || null,
        };
      });
    }
  } catch (error) {
    // Silently fail - fall back to Documenso suggestions only
    console.error('[Cockpit] Error fetching user suggestions:', error);
  }

  const nameEmailFilter = trimmedQuery
    ? {
        OR: [
          {
            name: {
              contains: trimmedQuery,
              mode: Prisma.QueryMode.insensitive,
            },
          },
          {
            email: {
              contains: trimmedQuery,
              mode: Prisma.QueryMode.insensitive,
            },
          },
        ],
      }
    : {};

  const recipients = await prisma.recipient.findMany({
    where: {
      envelope: {
        type: EnvelopeType.DOCUMENT,
        team: buildTeamWhereQuery({ teamId, userId }),
      },
      // Ensure email is not empty
      email: {
        not: '',
      },
      ...nameEmailFilter,
    },
    select: {
      name: true,
      email: true,
      envelope: {
        select: {
          createdAt: true,
        },
      },
    },
    distinct: ['email'],
    orderBy: {
      envelope: {
        createdAt: 'desc',
      },
    },
    // Fetch more to handle deduplication and pagination
    take: take + skip + 10,
  });

  // Merge: Cockpit users first, then Documenso recipients (deduplicated by email)
  const seenEmails = new Set<string>();
  const allSuggestions: RecipientSuggestion[] = [];

  // Add Cockpit users first
  for (const suggestion of cockpitSuggestions) {
    if (!seenEmails.has(suggestion.email.toLowerCase()) && isValidEmail(suggestion.email)) {
      seenEmails.add(suggestion.email.toLowerCase());
      allSuggestions.push(suggestion);
    }
  }

  // Add Documenso recipients that aren't already in the list
  for (const recipient of recipients) {
    if (!seenEmails.has(recipient.email.toLowerCase()) && isValidEmail(recipient.email)) {
      seenEmails.add(recipient.email.toLowerCase());
      allSuggestions.push({
        name: recipient.name,
        email: recipient.email,
      });
    }
  }

  // Fallback to team members if no results from Cockpit or previous recipients
  if (allSuggestions.length < skip + take && teamId) {
    const teamMembers = await prisma.organisationMember.findMany({
      where: {
        user: {
          ...nameEmailFilter,
          NOT: { id: userId },
        },
        organisationGroupMembers: {
          some: {
            group: {
              teamGroups: {
                some: { teamId },
              },
            },
          },
        },
      },
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
      take: take + skip,
    });

    for (const member of teamMembers) {
      if (!seenEmails.has(member.user.email.toLowerCase()) && isValidEmail(member.user.email)) {
        seenEmails.add(member.user.email.toLowerCase());
        allSuggestions.push({
          name: member.user.name,
          email: member.user.email,
        });
      }
    }
  }

  // Apply pagination
  const paginatedSuggestions = allSuggestions.slice(skip, skip + take);
  const hasMore = allSuggestions.length > skip + take;

  return {
    suggestions: paginatedSuggestions,
    hasMore,
    nextSkip: skip + take,
  };
};

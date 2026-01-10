import { getRecipientSuggestions } from '@documenso/lib/server-only/recipient/get-recipient-suggestions';

import { authenticatedProcedure } from '../trpc';
import {
  ZGetRecipientSuggestionsRequestSchema,
  ZGetRecipientSuggestionsResponseSchema,
} from './find-recipient-suggestions.types';

/**
 * @private
 */
export const findRecipientSuggestionsRoute = authenticatedProcedure
  .input(ZGetRecipientSuggestionsRequestSchema)
  .output(ZGetRecipientSuggestionsResponseSchema)
  .query(async ({ input, ctx }) => {
    const { teamId, user } = ctx;
    const { query, take, cursor } = input;

    ctx.logger.info({
      input: {
        query,
        take,
        cursor,
      },
    });

    const result = await getRecipientSuggestions({
      userId: user.id,
      teamId,
      query,
      take,
      skip: cursor,
    });

    return {
      results: result.suggestions,
      hasMore: result.hasMore,
      nextCursor: result.nextSkip,
    };
  });

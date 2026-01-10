import { z } from 'zod';

export const ZGetRecipientSuggestionsRequestSchema = z.object({
  query: z.string().default(''),
  take: z.number().min(1).max(50).default(10),
  cursor: z.number().min(0).default(0),
});

export const ZGetRecipientSuggestionsResponseSchema = z.object({
  results: z.array(
    z.object({
      name: z.string().nullable(),
      email: z.string().email(),
      avatarUrl: z.string().nullable().optional(),
      organizationName: z.string().nullable().optional(),
    }),
  ),
  hasMore: z.boolean(),
  nextCursor: z.number(),
});

export type TGetRecipientSuggestionsRequestSchema = z.infer<
  typeof ZGetRecipientSuggestionsRequestSchema
>;

export type TGetRecipientSuggestionsResponseSchema = z.infer<
  typeof ZGetRecipientSuggestionsResponseSchema
>;

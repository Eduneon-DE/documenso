import { z } from 'zod';

export const ZGetCockpitBrandingResponseSchema = z.object({
  logoUrl: z.string().nullable(),
  logoBase64: z.string().nullable(),
  logoContentType: z.string().nullable(),
  organizationName: z.string().nullable(),
});

export type TGetCockpitBrandingResponse = z.infer<typeof ZGetCockpitBrandingResponseSchema>;

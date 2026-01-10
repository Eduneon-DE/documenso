import { useEffect, useRef, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, useLingui } from '@lingui/react/macro';
import type { TeamGlobalSettings } from '@prisma/client';
import { Loader } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { Textarea } from '@documenso/ui/primitives/textarea';

import { useOptionalCurrentTeam } from '~/providers/team';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const ZBrandingPreferencesFormSchema = z.object({
  brandingEnabled: z.boolean().nullable(),
  brandingLogo: z
    .instanceof(File)
    .refine((file) => file.size <= MAX_FILE_SIZE, 'File size must be less than 5MB')
    .refine(
      (file) => ACCEPTED_FILE_TYPES.includes(file.type),
      'Only .jpg, .png, and .webp files are accepted',
    )
    .nullish(),
  brandingUrl: z.string().url().optional().or(z.literal('')),
  brandingCompanyDetails: z.string().max(500).optional(),
});

export type TBrandingPreferencesFormSchema = z.infer<typeof ZBrandingPreferencesFormSchema>;

type SettingsSubset = Pick<
  TeamGlobalSettings,
  'brandingEnabled' | 'brandingLogo' | 'brandingUrl' | 'brandingCompanyDetails'
>;

export type BrandingPreferencesFormProps = {
  canInherit?: boolean;
  settings: SettingsSubset;
  onFormSubmit: (data: TBrandingPreferencesFormSchema) => Promise<void>;
  context: 'Team' | 'Organisation';
  hideBrandWebsite?: boolean;
  enableCockpitSync?: boolean;
};

export function BrandingPreferencesForm({
  canInherit = false,
  settings,
  onFormSubmit,
  context,
  hideBrandWebsite = false,
  enableCockpitSync = false,
}: BrandingPreferencesFormProps) {
  const { t } = useLingui();

  const team = useOptionalCurrentTeam();
  const organisation = useCurrentOrganisation();

  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [hasLoadedPreview, setHasLoadedPreview] = useState(false);
  const [isSyncingFromCockpit, setIsSyncingFromCockpit] = useState(false);
  const hasAutoSynced = useRef(false);

  // Fetch Cockpit branding if sync is enabled
  const { data: cockpitBranding } = trpc.organisation.branding.getCockpitBranding.useQuery(
    undefined,
    { enabled: enableCockpitSync },
  );

  const form = useForm<TBrandingPreferencesFormSchema>({
    defaultValues: {
      brandingEnabled: settings.brandingEnabled ?? null,
      brandingUrl: settings.brandingUrl ?? '',
      brandingLogo: undefined,
      brandingCompanyDetails: settings.brandingCompanyDetails ?? '',
    },
    resolver: zodResolver(ZBrandingPreferencesFormSchema),
  });

  const isBrandingEnabled = form.watch('brandingEnabled');

  // Compute preview URL: prioritize Cockpit data URL (always works), then settings API endpoint
  useEffect(() => {
    // First priority: Cockpit branding data URL (works immediately, no API call needed)
    if (enableCockpitSync && cockpitBranding?.logoBase64 && cockpitBranding?.logoContentType) {
      const dataUrl = `data:${cockpitBranding.logoContentType};base64,${cockpitBranding.logoBase64}`;
      setPreviewUrl(dataUrl);
    }
    // Second priority: existing logo in settings (uses API endpoint)
    else if (settings.brandingLogo) {
      try {
        const file = JSON.parse(settings.brandingLogo);
        if ('type' in file && 'data' in file) {
          const logoUrl =
            context === 'Team'
              ? `${NEXT_PUBLIC_WEBAPP_URL()}/api/branding/logo/team/${team?.id}`
              : `${NEXT_PUBLIC_WEBAPP_URL()}/api/branding/logo/organisation/${organisation?.id}`;
          setPreviewUrl(logoUrl);
        }
      } catch (e) {
        console.error('Failed to parse brandingLogo:', e);
      }
    }

    setHasLoadedPreview(true);
  }, [
    settings.brandingLogo,
    context,
    team?.id,
    organisation?.id,
    enableCockpitSync,
    cockpitBranding?.logoBase64,
    cockpitBranding?.logoContentType,
  ]);

  // Auto-sync logo from Cockpit to Documenso database (one-time save)
  useEffect(() => {
    const syncLogoFromCockpit = async () => {
      // Only sync if: enabled, Cockpit has logo data, Documenso doesn't have one, and hasn't synced yet
      if (
        !enableCockpitSync ||
        !cockpitBranding?.logoBase64 ||
        !cockpitBranding?.logoContentType ||
        settings.brandingLogo ||
        hasAutoSynced.current ||
        isSyncingFromCockpit
      ) {
        return;
      }

      hasAutoSynced.current = true;
      setIsSyncingFromCockpit(true);

      try {
        // Convert base64 to blob then to File for form submission
        const byteCharacters = atob(cockpitBranding.logoBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: cockpitBranding.logoContentType });

        const extension = cockpitBranding.logoContentType.split('/')[1] || 'png';
        const fileName = `cockpit-logo.${extension}`;
        const file = new File([blob], fileName, { type: cockpitBranding.logoContentType });

        if (file.size > MAX_FILE_SIZE) {
          console.warn('Cockpit logo file is too large (max 5MB), skipping auto-sync');
          return;
        }

        form.setValue('brandingLogo', file);

        // Auto-save to Documenso database
        const formData = form.getValues();
        await onFormSubmit({
          ...formData,
          brandingLogo: file,
        });

        console.log('Auto-synced and saved logo from Cockpit successfully');
      } catch (error) {
        console.error('Failed to auto-sync logo from Cockpit:', error);
      } finally {
        setIsSyncingFromCockpit(false);
      }
    };

    void syncLogoFromCockpit();
  }, [
    cockpitBranding?.logoBase64,
    cockpitBranding?.logoContentType,
    enableCockpitSync,
    settings.brandingLogo,
    isSyncingFromCockpit,
    form,
    onFormSubmit,
  ]);

  // Cleanup blob URLs on unmount (for manually uploaded files)
  useEffect(() => {
    return () => {
      if (previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onFormSubmit)}>
        <fieldset className="flex h-full flex-col gap-y-4" disabled={form.formState.isSubmitting}>
          <FormField
            control={form.control}
            name="brandingEnabled"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>
                  <Trans>Enable Custom Branding</Trans>
                </FormLabel>

                <FormControl>
                  <Select
                    {...field}
                    value={field.value === null ? '-1' : field.value.toString()}
                    onValueChange={(value) =>
                      field.onChange(value === 'true' ? true : value === 'false' ? false : null)
                    }
                  >
                    <SelectTrigger
                      className="bg-background text-muted-foreground"
                      data-testid="enable-branding"
                    >
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent className="z-[9999]">
                      <SelectItem value="true">
                        <Trans>Yes</Trans>
                      </SelectItem>

                      <SelectItem value="false">
                        <Trans>No</Trans>
                      </SelectItem>

                      {canInherit && (
                        <SelectItem value={'-1'}>
                          <Trans>Inherit from organisation</Trans>
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </FormControl>

                <FormDescription>
                  {context === 'Team' ? (
                    <Trans>Enable custom branding for all documents in this team</Trans>
                  ) : (
                    <Trans>Enable custom branding for all documents in this organisation</Trans>
                  )}
                </FormDescription>
              </FormItem>
            )}
          />

          <div className="relative flex w-full flex-col gap-y-4">
            {!isBrandingEnabled && <div className="absolute inset-0 z-[9998] bg-background/60" />}

            <FormField
              control={form.control}
              name="brandingLogo"
              render={({ field: { value: _value, onChange, ...field } }) => (
                <FormItem className="flex-1">
                  <FormLabel>
                    <Trans>Branding Logo</Trans>
                  </FormLabel>

                  <div className="flex flex-col gap-4">
                    <div className="relative h-48 w-full overflow-hidden rounded-lg border border-border bg-background">
                      {previewUrl ? (
                        <img
                          src={previewUrl}
                          alt="Logo preview"
                          className="h-full w-full object-contain p-4"
                        />
                      ) : (
                        <div className="relative flex h-full w-full flex-col items-center justify-center gap-3 bg-muted/20 text-sm text-muted-foreground dark:bg-muted">
                          {isSyncingFromCockpit ? (
                            <>
                              <Loader className="h-6 w-6 animate-spin" />
                              <span>
                                <Trans>Syncing logo from Cockpit...</Trans>
                              </span>
                            </>
                          ) : (
                            <Trans>Please upload a logo</Trans>
                          )}

                          {!hasLoadedPreview && (
                            <div className="absolute inset-0 z-[999] flex items-center justify-center bg-muted dark:bg-muted">
                              <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="relative">
                      <FormControl className="relative">
                        <Input
                          type="file"
                          accept={ACCEPTED_FILE_TYPES.join(',')}
                          disabled={!isBrandingEnabled}
                          onChange={(e) => {
                            const file = e.target.files?.[0];

                            if (file) {
                              if (previewUrl.startsWith('blob:')) {
                                URL.revokeObjectURL(previewUrl);
                              }

                              const objectUrl = URL.createObjectURL(file);

                              setPreviewUrl(objectUrl);

                              onChange(file);
                            }
                          }}
                          className={cn(
                            'h-auto p-2',
                            'file:text-primary hover:file:bg-primary/90',
                            'file:mr-4 file:cursor-pointer file:rounded-md file:border-0',
                            'file:p-2 file:py-2 file:font-medium',
                            'file:bg-primary file:text-primary-foreground',
                            !isBrandingEnabled && 'cursor-not-allowed',
                          )}
                          {...field}
                        />
                      </FormControl>

                      <div className="absolute right-2 top-0 inline-flex h-full items-center justify-center">
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="text-xs text-destructive"
                          onClick={() => {
                            setPreviewUrl('');
                            onChange(null);
                          }}
                        >
                          <Trans>Remove</Trans>
                        </Button>
                      </div>
                    </div>

                    <FormDescription>
                      <Trans>Upload your brand logo (max 5MB, JPG, PNG, or WebP)</Trans>

                      {canInherit && (
                        <span>
                          {'. '}
                          <Trans>Leave blank to inherit from the organisation.</Trans>
                        </span>
                      )}
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            {!hideBrandWebsite && (
              <FormField
                control={form.control}
                name="brandingUrl"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>
                      <Trans>Brand Website</Trans>
                    </FormLabel>

                    <FormControl>
                      <Input
                        type="url"
                        placeholder="https://example.com"
                        disabled={!isBrandingEnabled}
                        {...field}
                      />
                    </FormControl>

                    <FormDescription>
                      <Trans>Your brand website URL</Trans>

                      {canInherit && (
                        <span>
                          {'. '}
                          <Trans>Leave blank to inherit from the organisation.</Trans>
                        </span>
                      )}
                    </FormDescription>
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="brandingCompanyDetails"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>
                    <Trans>Brand Details</Trans>
                  </FormLabel>

                  <FormControl>
                    <Textarea
                      placeholder={t`Enter your brand details`}
                      className="min-h-[100px] resize-y"
                      disabled={!isBrandingEnabled}
                      {...field}
                    />
                  </FormControl>

                  <FormDescription>
                    <Trans>Additional brand information to display at the bottom of emails</Trans>

                    {canInherit && (
                      <span>
                        {'. '}
                        <Trans>Leave blank to inherit from the organisation.</Trans>
                      </span>
                    )}
                  </FormDescription>
                </FormItem>
              )}
            />
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '8px',
              borderTop: '1px solid #EBE9F1',
              paddingTop: '24px',
              marginTop: '8px',
            }}
          >
            <Button type="submit" loading={form.formState.isSubmitting}>
              <Trans>Update</Trans>
            </Button>
          </div>
        </fieldset>
      </form>
    </Form>
  );
}

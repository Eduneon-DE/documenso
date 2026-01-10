import { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, useLingui } from '@lingui/react/macro';
import { CircularProgress } from '@mui/material';
import { FileTextIcon, PaletteIcon, SettingsIcon, UserIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { DocumentSignatureType } from '@documenso/lib/constants/document';
import type { SUPPORTED_LANGUAGE_CODES } from '@documenso/lib/constants/i18n';
import { putFile } from '@documenso/lib/universal/upload/put-file';
import { trpc } from '@documenso/trpc/react';
import { WrappedDialog } from '@documenso/ui/components/common/wrapped-dialog';
import { type WrappedTabItem, WrappedTabs } from '@documenso/ui/components/common/wrapped-tabs';
import { Button } from '@documenso/ui/primitives/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { SignaturePadDialog } from '@documenso/ui/primitives/signature-pad/signature-pad-dialog';
import { useToast } from '@documenso/ui/primitives/use-toast';

import {
  BrandingPreferencesForm,
  type TBrandingPreferencesFormSchema,
} from '~/components/forms/branding-preferences-form';
import {
  DocumentPreferencesForm,
  type TDocumentPreferencesFormSchema,
} from '~/components/forms/document-preferences-form';

// Profile form schema
const ZProfileFormSchema = z.object({
  name: z.string().trim().min(1, { message: 'Please enter a valid name.' }),
  signature: z.string().min(1, { message: 'Signature cannot be empty.' }),
});

type TProfileFormSchema = z.infer<typeof ZProfileFormSchema>;

export type SettingsDialogProps = {
  trigger?: React.ReactNode;
};

export const SettingsDialog = ({ trigger }: SettingsDialogProps) => {
  const { t } = useLingui();
  const { toast } = useToast();
  const { user, refreshSession } = useSession();
  const organisation = useCurrentOrganisation();

  const [isOpen, setIsOpen] = useState(false);

  // Profile form
  const profileForm = useForm<TProfileFormSchema>({
    values: {
      name: user.name ?? '',
      signature: user.signature || '',
    },
    resolver: zodResolver(ZProfileFormSchema),
  });

  const { mutateAsync: updateProfile } = trpc.profile.updateProfile.useMutation();

  const onProfileSubmit = async ({ name, signature }: TProfileFormSchema) => {
    try {
      await updateProfile({ name, signature });
      await refreshSession();
      toast({
        title: t`Profile updated`,
        description: t`Your profile has been updated successfully.`,
      });
    } catch {
      toast({
        title: t`An error occurred`,
        description: t`We could not update your profile. Please try again.`,
        variant: 'destructive',
      });
    }
  };

  // Organisation settings query
  const trpcUtils = trpc.useUtils();
  const { data: organisationWithSettings, isLoading: isLoadingOrganisation } =
    trpc.organisation.get.useQuery(
      { organisationReference: organisation.url },
      { enabled: isOpen },
    );

  const { mutateAsync: updateOrganisationSettings } = trpc.organisation.settings.update.useMutation(
    {
      onSuccess: () => {
        // Refetch organisation settings to get updated data
        void trpcUtils.organisation.get.invalidate({ organisationReference: organisation.url });
      },
    },
  );

  const onDocumentPreferencesSubmit = async (data: TDocumentPreferencesFormSchema) => {
    try {
      const {
        documentVisibility,
        documentLanguage,
        documentTimezone,
        documentDateFormat,
        includeSenderDetails,
        includeSigningCertificate,
        includeAuditLog,
        signatureTypes,
        delegateDocumentOwnership,
        aiFeaturesEnabled,
      } = data;

      if (
        documentVisibility === null ||
        documentLanguage === null ||
        documentDateFormat === null ||
        includeSenderDetails === null ||
        includeSigningCertificate === null ||
        includeAuditLog === null ||
        aiFeaturesEnabled === null
      ) {
        return;
      }

      await updateOrganisationSettings({
        organisationId: organisation.id,
        data: {
          documentVisibility,
          documentLanguage: documentLanguage as (typeof SUPPORTED_LANGUAGE_CODES)[number],
          documentTimezone,
          documentDateFormat,
          includeSenderDetails,
          includeSigningCertificate,
          includeAuditLog,
          typedSignatureEnabled: signatureTypes.includes(DocumentSignatureType.TYPE),
          uploadSignatureEnabled: signatureTypes.includes(DocumentSignatureType.UPLOAD),
          drawSignatureEnabled: signatureTypes.includes(DocumentSignatureType.DRAW),
          delegateDocumentOwnership,
          aiFeaturesEnabled,
        },
      });

      toast({
        title: t`Document preferences updated`,
        description: t`Your document preferences have been updated.`,
      });
    } catch {
      toast({
        title: t`Something went wrong`,
        description: t`We could not update your document preferences.`,
        variant: 'destructive',
      });
    }
  };

  const onBrandingPreferencesSubmit = async (data: TBrandingPreferencesFormSchema) => {
    try {
      const { brandingEnabled, brandingLogo, brandingUrl, brandingCompanyDetails } = data;

      let uploadedBrandingLogo: string | undefined = '';

      if (brandingLogo) {
        uploadedBrandingLogo = JSON.stringify(await putFile(brandingLogo));
      }

      await updateOrganisationSettings({
        organisationId: organisation.id,
        data: {
          brandingEnabled: brandingEnabled ?? undefined,
          brandingLogo: uploadedBrandingLogo,
          brandingUrl,
          brandingCompanyDetails,
        },
      });

      toast({
        title: t`Branding preferences updated`,
        description: t`Your branding preferences have been updated.`,
      });
    } catch {
      toast({
        title: t`Something went wrong`,
        description: t`We could not update your branding preferences.`,
        variant: 'destructive',
      });
    }
  };

  // Profile tab content
  const ProfileContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ color: '#5E5873', fontWeight: 500, fontSize: '18px', margin: 0 }}>
          <Trans>Profile</Trans>
        </h2>
        <p style={{ color: '#B9B9C3', fontSize: '14px', marginTop: '4px', marginBottom: 0 }}>
          <Trans>Manage your signature.</Trans>
        </p>
      </div>

      <Form {...profileForm}>
        <form
          onSubmit={profileForm.handleSubmit(onProfileSubmit)}
          style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
        >
          <FormField
            control={profileForm.control}
            name="signature"
            render={({ field: { onChange, value } }) => (
              <FormItem>
                <FormLabel style={{ fontSize: '14px', fontWeight: 500, color: '#5E5873' }}>
                  <Trans>Signature</Trans>
                </FormLabel>
                <FormControl>
                  <SignaturePadDialog
                    disabled={profileForm.formState.isSubmitting}
                    fullName={user.name ?? ''}
                    value={value}
                    onChange={(v) => onChange(v ?? '')}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              borderTop: '1px solid #EBE9F1',
              paddingTop: '24px',
            }}
          >
            <Button type="submit" loading={profileForm.formState.isSubmitting}>
              <Trans>Save Changes</Trans>
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );

  // Document tab content
  const DocumentContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ color: '#5E5873', fontWeight: 500, fontSize: '18px', margin: 0 }}>
          <Trans>Document Preferences</Trans>
        </h2>
        <p style={{ color: '#B9B9C3', fontSize: '14px', marginTop: '4px', marginBottom: 0 }}>
          <Trans>Configure default settings for your documents.</Trans>
        </p>
      </div>

      {isLoadingOrganisation || !organisationWithSettings ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
          <CircularProgress size={24} sx={{ color: '#4a86e8' }} />
        </div>
      ) : (
        <DocumentPreferencesForm
          canInherit={false}
          isAiFeaturesConfigured={false}
          hideLanguageAndTimezone
          hideDelegateDocumentOwnership
          settings={organisationWithSettings.organisationGlobalSettings}
          onFormSubmit={onDocumentPreferencesSubmit}
        />
      )}
    </div>
  );

  // Branding tab content
  const BrandingContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ color: '#5E5873', fontWeight: 500, fontSize: '18px', margin: 0 }}>
          <Trans>Branding</Trans>
        </h2>
        <p style={{ color: '#B9B9C3', fontSize: '14px', marginTop: '4px', marginBottom: 0 }}>
          <Trans>Customize the look and feel of your documents.</Trans>
        </p>
      </div>

      {isLoadingOrganisation || !organisationWithSettings ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
          <CircularProgress size={24} sx={{ color: '#4a86e8' }} />
        </div>
      ) : (
        <BrandingPreferencesForm
          context="Organisation"
          hideBrandWebsite
          enableCockpitSync
          settings={organisationWithSettings.organisationGlobalSettings}
          onFormSubmit={onBrandingPreferencesSubmit}
        />
      )}
    </div>
  );

  const tabs: WrappedTabItem[] = [
    {
      label: t`Profile`,
      value: 'profile',
      icon: <UserIcon size={18} />,
      component: ProfileContent,
    },
    {
      label: t`Document`,
      value: 'document',
      icon: <FileTextIcon size={18} />,
      component: DocumentContent,
    },
    {
      label: t`Branding`,
      value: 'branding',
      icon: <PaletteIcon size={18} />,
      component: BrandingContent,
    },
  ];

  return (
    <WrappedDialog
      title={t`Settings`}
      open={isOpen}
      onOpen={() => setIsOpen(true)}
      onClose={() => setIsOpen(false)}
      actionComponent={
        trigger ?? (
          <Button
            variant="outline"
            className="relative h-10 w-10 rounded-lg"
            data-testid="settings-button"
          >
            <SettingsIcon className="h-5 w-5 flex-shrink-0 text-muted-foreground transition-colors hover:text-foreground" />
          </Button>
        )
      }
      content={<WrappedTabs tabs={tabs} defaultValue="profile" />}
    />
  );
};

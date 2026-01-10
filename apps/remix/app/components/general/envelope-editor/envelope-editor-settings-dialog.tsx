import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import {
  DocumentDistributionMethod,
  DocumentVisibility,
  EnvelopeType,
  SendStatus,
} from '@prisma/client';
import { InfoIcon, MailIcon, SettingsIcon, ShieldIcon, X } from 'lucide-react';
import ReactDOM from 'react-dom';
import { useForm } from 'react-hook-form';
import { match } from 'ts-pattern';
import { z } from 'zod';

import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { DATE_FORMATS, DEFAULT_DOCUMENT_DATE_FORMAT } from '@documenso/lib/constants/date-formats';
import {
  DOCUMENT_DISTRIBUTION_METHODS,
  DOCUMENT_SIGNATURE_TYPES,
} from '@documenso/lib/constants/document';
import { SUPPORTED_LANGUAGE_CODES, isValidLanguageCode } from '@documenso/lib/constants/i18n';
import { DEFAULT_DOCUMENT_TIME_ZONE, TIME_ZONES } from '@documenso/lib/constants/time-zones';
import { AppError } from '@documenso/lib/errors/app-error';
import {
  ZDocumentAccessAuthTypesSchema,
  ZDocumentActionAuthTypesSchema,
} from '@documenso/lib/types/document-auth';
import { ZDocumentEmailSettingsSchema } from '@documenso/lib/types/document-email';
import {
  type TDocumentMetaDateFormat,
  ZDocumentMetaDateFormatSchema,
  ZDocumentMetaTimezoneSchema,
} from '@documenso/lib/types/document-meta';
import { extractDocumentAuthMethods } from '@documenso/lib/utils/document-auth';
import { isValidRedirectUrl } from '@documenso/lib/utils/is-valid-redirect-url';
import {
  DocumentSignatureType,
  canAccessTeamDocument,
  extractTeamSignatureSettings,
} from '@documenso/lib/utils/teams';
import { trpc } from '@documenso/trpc/react';
import { DocumentEmailCheckboxes } from '@documenso/ui/components/document/document-email-checkboxes';
import {
  DocumentGlobalAuthAccessSelect,
  DocumentGlobalAuthAccessTooltip,
} from '@documenso/ui/components/document/document-global-auth-access-select';
import {
  DocumentGlobalAuthActionSelect,
  DocumentGlobalAuthActionTooltip,
} from '@documenso/ui/components/document/document-global-auth-action-select';
import { DocumentSendEmailMessageHelper } from '@documenso/ui/components/document/document-send-email-message-helper';
import { DocumentSignatureSettingsTooltip } from '@documenso/ui/components/document/document-signature-settings-tooltip';
import {
  DocumentVisibilitySelect,
  DocumentVisibilityTooltip,
} from '@documenso/ui/components/document/document-visibility-select';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Combobox } from '@documenso/ui/primitives/combobox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { MultiSelectCombobox } from '@documenso/ui/primitives/multi-select-combobox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { Textarea } from '@documenso/ui/primitives/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@documenso/ui/primitives/tooltip';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useCurrentTeam } from '~/providers/team';

export const ZAddSettingsFormSchema = z.object({
  externalId: z.string().optional(),
  visibility: z.nativeEnum(DocumentVisibility).optional(),
  globalAccessAuth: z
    .array(z.union([ZDocumentAccessAuthTypesSchema, z.literal('-1')]))
    .transform((val) => (val.length === 1 && val[0] === '-1' ? [] : val))
    .optional()
    .default([]),
  globalActionAuth: z.array(ZDocumentActionAuthTypesSchema).optional().default([]),
  meta: z.object({
    subject: z.string(),
    message: z.string(),
    timezone: ZDocumentMetaTimezoneSchema.default(DEFAULT_DOCUMENT_TIME_ZONE),
    dateFormat: ZDocumentMetaDateFormatSchema.default(DEFAULT_DOCUMENT_DATE_FORMAT),
    distributionMethod: z
      .nativeEnum(DocumentDistributionMethod)
      .optional()
      .default(DocumentDistributionMethod.EMAIL),
    redirectUrl: z
      .string()
      .optional()
      .refine((value) => value === undefined || value === '' || isValidRedirectUrl(value), {
        message:
          'Please enter a valid URL, make sure you include http:// or https:// part of the url.',
      }),
    language: z
      .union([z.string(), z.enum(SUPPORTED_LANGUAGE_CODES)])
      .optional()
      .default('en'),
    emailId: z.string().nullable(),
    emailReplyTo: z.preprocess(
      (val) => (val === '' ? undefined : val),
      z.string().email().optional(),
    ),
    emailSettings: ZDocumentEmailSettingsSchema,
    signatureTypes: z.array(z.nativeEnum(DocumentSignatureType)).min(1, {
      message: msg`At least one signature type must be enabled`.id,
    }),
  }),
});

type EnvelopeEditorSettingsTabType = 'general' | 'email' | 'security';

const tabs = [
  {
    id: 'general',
    title: msg`General`,
    icon: SettingsIcon,
    description: msg`Configure document settings and options before sending.`,
  },
  {
    id: 'email',
    title: msg`Email`,
    icon: MailIcon,
    description: msg`Configure email settings for the document`,
  },
  {
    id: 'security',
    title: msg`Security`,
    icon: ShieldIcon,
    description: msg`Configure security settings for the document`,
  },
] as const;

type TAddSettingsFormSchema = z.infer<typeof ZAddSettingsFormSchema>;

type EnvelopeEditorSettingsDialogProps = {
  trigger?: React.ReactNode;
};

export const EnvelopeEditorSettingsDialog = ({ trigger }: EnvelopeEditorSettingsDialogProps) => {
  const { t, i18n } = useLingui();
  const { toast } = useToast();

  const { envelope, updateEnvelopeAsync } = useCurrentEnvelopeEditor();

  const team = useCurrentTeam();
  const organisation = useCurrentOrganisation();

  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<EnvelopeEditorSettingsTabType>('general');

  // Handle mounting for portal
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Lock body scroll when dialog is open
  useEffect(() => {
    if (!mounted) return;
    if (open) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [open, mounted]);

  const { documentAuthOption } = extractDocumentAuthMethods({
    documentAuth: envelope.authOptions,
  });

  const createDefaultValues = () => {
    return {
      externalId: envelope.externalId || '',
      visibility: envelope.visibility || '',
      globalAccessAuth: documentAuthOption?.globalAccessAuth || [],
      globalActionAuth: documentAuthOption?.globalActionAuth || [],
      meta: {
        subject: envelope.documentMeta.subject ?? '',
        message: envelope.documentMeta.message ?? '',
        timezone: envelope.documentMeta.timezone ?? DEFAULT_DOCUMENT_TIME_ZONE,
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        dateFormat: (envelope.documentMeta.dateFormat ??
          DEFAULT_DOCUMENT_DATE_FORMAT) as TDocumentMetaDateFormat,
        distributionMethod:
          envelope.documentMeta.distributionMethod || DocumentDistributionMethod.EMAIL,
        redirectUrl: envelope.documentMeta.redirectUrl ?? '',
        language: envelope.documentMeta.language ?? 'en',
        emailId: envelope.documentMeta.emailId ?? null,
        emailReplyTo: envelope.documentMeta.emailReplyTo ?? undefined,
        emailSettings: ZDocumentEmailSettingsSchema.parse(envelope.documentMeta.emailSettings),
        signatureTypes: extractTeamSignatureSettings(envelope.documentMeta),
      },
    };
  };

  const form = useForm<TAddSettingsFormSchema>({
    resolver: zodResolver(ZAddSettingsFormSchema),
    defaultValues: createDefaultValues(),
  });

  const envelopeHasBeenSent =
    envelope.type === EnvelopeType.DOCUMENT &&
    envelope.recipients.some((recipient) => recipient.sendStatus === SendStatus.SENT);

  const emailSettings = form.watch('meta.emailSettings');

  const { data: emailData, isLoading: isLoadingEmails } =
    trpc.enterprise.organisation.email.find.useQuery({
      organisationId: organisation.id,
      perPage: 100,
    });

  const emails = emailData?.data || [];

  const canUpdateVisibility = canAccessTeamDocument(team.currentTeamRole, envelope.visibility);

  const onFormSubmit = async (data: TAddSettingsFormSchema) => {
    const {
      timezone,
      dateFormat,
      redirectUrl,
      language,
      signatureTypes,
      distributionMethod,
      emailId,
      emailSettings,
      message,
      subject,
      emailReplyTo,
    } = data.meta;

    const parsedGlobalAccessAuth = z
      .array(ZDocumentAccessAuthTypesSchema)
      .safeParse(data.globalAccessAuth);

    try {
      await updateEnvelopeAsync({
        data: {
          externalId: data.externalId || null,
          visibility: data.visibility,
          globalAccessAuth: parsedGlobalAccessAuth.success ? parsedGlobalAccessAuth.data : [],
          globalActionAuth: data.globalActionAuth ?? [],
        },
        meta: {
          timezone,
          dateFormat,
          redirectUrl,
          emailId,
          message,
          subject,
          emailReplyTo,
          emailSettings,
          distributionMethod,
          language: isValidLanguageCode(language) ? language : undefined,
          drawSignatureEnabled: signatureTypes.includes(DocumentSignatureType.DRAW),
          typedSignatureEnabled: signatureTypes.includes(DocumentSignatureType.TYPE),
          uploadSignatureEnabled: signatureTypes.includes(DocumentSignatureType.UPLOAD),
        },
      });

      setOpen(false);

      toast({
        title: t`Success`,
        description: t`Envelope updated`,
        duration: 5000,
      });
    } catch (err) {
      const error = AppError.parseError(err);

      console.error(error);

      toast({
        title: t`An unknown error occurred`,
        description: t`We encountered an unknown error while attempting to update the envelope. Please try again later.`,
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    if (
      !form.formState.touchedFields.meta?.timezone &&
      !envelopeHasBeenSent &&
      !envelope.documentMeta.timezone
    ) {
      form.setValue('meta.timezone', Intl.DateTimeFormat().resolvedOptions().timeZone);
    }
  }, [
    envelopeHasBeenSent,
    form,
    form.setValue,
    form.formState.touchedFields.meta?.timezone,
    envelope.documentMeta.timezone,
  ]);

  useEffect(() => {
    form.reset(createDefaultValues());
    setActiveTab('general');
  }, [open, form]);

  const selectedTab = tabs.find((tab) => tab.id === activeTab);

  if (!selectedTab) {
    return null;
  }

  const TriggerButton = trigger ? (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      onClick={(e) => {
        e.stopPropagation();
        setOpen(true);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.stopPropagation();
          setOpen(true);
        }
      }}
    >
      {trigger}
    </div>
  ) : (
    <Button
      className="flex-shrink-0"
      variant="secondary"
      onClick={(e) => {
        e.stopPropagation();
        setOpen(true);
      }}
    >
      <Trans>Settings</Trans>
    </Button>
  );

  if (!mounted || !open) {
    return TriggerButton;
  }

  return (
    <>
      {TriggerButton}
      {ReactDOM.createPortal(
        <>
          {/* Backdrop */}
          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
          <div
            role="presentation"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 10000,
            }}
            onClick={() => !form.formState.isSubmitting && setOpen(false)}
          />
          {/* Dialog Content */}
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              maxWidth: '900px',
              width: 'calc(100% - 64px)',
              maxHeight: 'calc(100vh - 64px)',
              overflow: 'hidden',
              boxShadow:
                '0px 11px 15px -7px rgba(0,0,0,0.2), 0px 24px 38px 3px rgba(0,0,0,0.14), 0px 9px 46px 8px rgba(0,0,0,0.12)',
              zIndex: 10001,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Dialog Header - full width */}
            <div
              style={{
                padding: '12px 24px',
                borderBottom: '1px solid #EBE9F1',
                backgroundColor: '#ffffff',
                flexShrink: 0,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  fontWeight: 500,
                  color: '#5E5873',
                  fontSize: '16px',
                }}
              >
                <Trans>Document Settings</Trans>
              </span>
              <button
                type="button"
                onClick={() => !form.formState.isSubmitting && setOpen(false)}
                aria-label="Close dialog"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '8px',
                  cursor: 'pointer',
                  color: '#5E5873',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px',
                }}
                className="transition-opacity hover:opacity-70"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body: Sidebar + Content */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                flex: 1,
                minHeight: 0,
                overflow: 'hidden',
              }}
            >
              {/* Sidebar */}
              <div
                style={{
                  width: '240px',
                  flexShrink: 0,
                  borderRight: '1px solid #EBE9F1',
                  backgroundColor: '#F9F9F9',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <nav
                  style={{
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  {tabs.map((tab) => (
                    <Button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      variant="ghost"
                      className={cn('w-full justify-start', {
                        'bg-secondary': activeTab === tab.id,
                      })}
                    >
                      <tab.icon className="mr-2 h-5 w-5" />
                      {t(tab.title)}
                    </Button>
                  ))}
                </nav>
              </div>

              {/* Content */}
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  minWidth: 0,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '16px 24px',
                    borderBottom: '1px solid #EBE9F1',
                    backgroundColor: '#ffffff',
                  }}
                >
                  <h3
                    style={{
                      fontWeight: 500,
                      fontSize: '16px',
                      color: '#5E5873',
                      margin: 0,
                    }}
                  >
                    {t(selectedTab?.title ?? '')}
                  </h3>
                  <p
                    style={{
                      fontSize: '14px',
                      color: '#B9B9C3',
                      margin: '4px 0 0 0',
                    }}
                  >
                    {t(selectedTab?.description ?? '')}
                  </p>
                </div>

                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onFormSubmit)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      flex: 1,
                      overflow: 'hidden',
                    }}
                  >
                    <fieldset
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '24px',
                        padding: '24px',
                        overflowY: 'auto',
                        flex: 1,
                        minHeight: 0,
                      }}
                      disabled={form.formState.isSubmitting}
                      key={activeTab}
                    >
                      {match(activeTab)
                        .with('general', () => (
                          <>
                            <FormField
                              control={form.control}
                              name="meta.signatureTypes"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="flex flex-row items-center">
                                    <Trans>Allowed Signature Types</Trans>
                                    <DocumentSignatureSettingsTooltip />
                                  </FormLabel>

                                  <FormControl>
                                    <MultiSelectCombobox
                                      options={Object.values(DOCUMENT_SIGNATURE_TYPES).map(
                                        (option) => ({
                                          label: t(option.label),
                                          value: option.value,
                                        }),
                                      )}
                                      selectedValues={field.value}
                                      onChange={field.onChange}
                                      className="w-full bg-background"
                                      emptySelectionPlaceholder="Select signature types"
                                    />
                                  </FormControl>

                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="meta.dateFormat"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>
                                    <Trans>Date Format</Trans>
                                  </FormLabel>

                                  <FormControl>
                                    <Select
                                      value={field.value}
                                      onValueChange={field.onChange}
                                      disabled={envelopeHasBeenSent}
                                    >
                                      <SelectTrigger className="bg-background">
                                        <SelectValue />
                                      </SelectTrigger>

                                      <SelectContent>
                                        {DATE_FORMATS.map((format) => (
                                          <SelectItem key={format.key} value={format.value}>
                                            {format.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </FormControl>

                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="meta.timezone"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>
                                    <Trans>Time Zone</Trans>
                                  </FormLabel>

                                  <FormControl>
                                    <Combobox
                                      className="bg-background"
                                      options={TIME_ZONES}
                                      value={field.value}
                                      onChange={(value) => value && field.onChange(value)}
                                      disabled={envelopeHasBeenSent}
                                    />
                                  </FormControl>

                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="externalId"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="flex flex-row items-center">
                                    <Trans>External ID</Trans>{' '}
                                    <Tooltip>
                                      <TooltipTrigger type="button">
                                        <InfoIcon className="mx-2 h-4 w-4" />
                                      </TooltipTrigger>

                                      <TooltipContent className="max-w-xs text-muted-foreground">
                                        <Trans>
                                          Add an external ID to the document. This can be used to
                                          identify the document in external systems.
                                        </Trans>
                                      </TooltipContent>
                                    </Tooltip>
                                  </FormLabel>

                                  <FormControl>
                                    <Input className="bg-background" {...field} />
                                  </FormControl>

                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="meta.redirectUrl"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="flex flex-row items-center">
                                    <Trans>Redirect URL</Trans>{' '}
                                    <Tooltip>
                                      <TooltipTrigger type="button">
                                        <InfoIcon className="mx-2 h-4 w-4" />
                                      </TooltipTrigger>

                                      <TooltipContent className="max-w-xs text-muted-foreground">
                                        <Trans>
                                          Add a URL to redirect the user to once the document is
                                          signed
                                        </Trans>
                                      </TooltipContent>
                                    </Tooltip>
                                  </FormLabel>

                                  <FormControl>
                                    <Input className="bg-background" {...field} />
                                  </FormControl>

                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="meta.distributionMethod"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="flex flex-row items-center">
                                    <Trans>Document Distribution Method</Trans>
                                    <Tooltip>
                                      <TooltipTrigger type="button">
                                        <InfoIcon className="mx-2 h-4 w-4" />
                                      </TooltipTrigger>

                                      <TooltipContent className="max-w-md space-y-2 p-4 text-foreground">
                                        <h2>
                                          <strong>
                                            <Trans>Document Distribution Method</Trans>
                                          </strong>
                                        </h2>

                                        <p>
                                          <Trans>
                                            This is how the document will reach the recipients once
                                            the document is ready for signing.
                                          </Trans>
                                        </p>

                                        <ul className="ml-3.5 list-outside list-disc space-y-0.5 py-2">
                                          <li>
                                            <Trans>
                                              <strong>Email</strong> - The recipient will be emailed
                                              the document to sign, approve, etc.
                                            </Trans>
                                          </li>
                                          <li>
                                            <Trans>
                                              <strong>None</strong> - We will generate links which
                                              you can send to the recipients manually.
                                            </Trans>
                                          </li>
                                        </ul>

                                        <Trans>
                                          <strong>Note</strong> - If you use Links in combination
                                          with direct templates, you will need to manually send the
                                          links to the remaining recipients.
                                        </Trans>
                                      </TooltipContent>
                                    </Tooltip>
                                  </FormLabel>

                                  <FormControl>
                                    <Select {...field} onValueChange={field.onChange}>
                                      <SelectTrigger className="bg-background text-muted-foreground">
                                        <SelectValue data-testid="documentDistributionMethodSelectValue" />
                                      </SelectTrigger>

                                      <SelectContent position="popper">
                                        {Object.values(DOCUMENT_DISTRIBUTION_METHODS).map(
                                          ({ value, description }) => (
                                            <SelectItem key={value} value={value}>
                                              {i18n._(description)}
                                            </SelectItem>
                                          ),
                                        )}
                                      </SelectContent>
                                    </Select>
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </>
                        ))
                        .with('email', () => (
                          <>
                            {organisation.organisationClaim.flags.emailDomains && (
                              <FormField
                                control={form.control}
                                name="meta.emailId"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>
                                      <Trans>Email Sender</Trans>
                                    </FormLabel>

                                    <FormControl>
                                      <Select
                                        {...field}
                                        value={field.value === null ? '-1' : field.value}
                                        onValueChange={(value) =>
                                          field.onChange(value === '-1' ? null : value)
                                        }
                                      >
                                        <SelectTrigger
                                          loading={isLoadingEmails}
                                          className="bg-background"
                                        >
                                          <SelectValue />
                                        </SelectTrigger>

                                        <SelectContent>
                                          {emails.map((email) => (
                                            <SelectItem key={email.id} value={email.id}>
                                              {email.email}
                                            </SelectItem>
                                          ))}

                                          <SelectItem value={'-1'}>Documenso</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </FormControl>

                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            )}

                            <FormField
                              control={form.control}
                              name="meta.emailReplyTo"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>
                                    <Trans>
                                      Reply To Email{' '}
                                      <span className="text-muted-foreground">(Optional)</span>
                                    </Trans>
                                  </FormLabel>

                                  <FormControl>
                                    <Input {...field} />
                                  </FormControl>

                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="meta.subject"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>
                                    <Trans>
                                      Subject{' '}
                                      <span className="text-muted-foreground">(Optional)</span>
                                    </Trans>
                                  </FormLabel>

                                  <FormControl>
                                    <Input {...field} />
                                  </FormControl>

                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="meta.message"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="flex flex-row items-center">
                                    <Trans>
                                      Message{' '}
                                      <span className="text-muted-foreground">(Optional)</span>
                                    </Trans>
                                    <Tooltip>
                                      <TooltipTrigger type="button">
                                        <InfoIcon className="mx-2 h-4 w-4" />
                                      </TooltipTrigger>
                                      <TooltipContent className="p-4 text-muted-foreground">
                                        <DocumentSendEmailMessageHelper />
                                      </TooltipContent>
                                    </Tooltip>
                                  </FormLabel>

                                  <FormControl>
                                    <Textarea
                                      className="h-16 resize-none bg-background"
                                      {...field}
                                    />
                                  </FormControl>

                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <DocumentEmailCheckboxes
                              value={emailSettings}
                              onChange={(value) => form.setValue('meta.emailSettings', value)}
                            />
                          </>
                        ))
                        .with('security', () => (
                          <>
                            {organisation.organisationClaim.flags.cfr21 && (
                              <FormField
                                control={form.control}
                                name="globalActionAuth"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="flex flex-row items-center">
                                      <Trans>Recipient action authentication</Trans>
                                      <DocumentGlobalAuthActionTooltip />
                                    </FormLabel>

                                    <FormControl>
                                      <DocumentGlobalAuthActionSelect
                                        value={field.value}
                                        disabled={field.disabled}
                                        onValueChange={field.onChange}
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            )}

                            <FormField
                              control={form.control}
                              name="globalAccessAuth"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="flex flex-row items-center">
                                    <Trans>Document access</Trans>
                                    <DocumentGlobalAuthAccessTooltip />
                                  </FormLabel>

                                  <FormControl>
                                    <DocumentGlobalAuthAccessSelect
                                      value={field.value}
                                      disabled={field.disabled}
                                      onValueChange={field.onChange}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="visibility"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="flex flex-row items-center">
                                    <Trans>Document visibility</Trans>
                                    <DocumentVisibilityTooltip />
                                  </FormLabel>

                                  <FormControl>
                                    <DocumentVisibilitySelect
                                      canUpdateVisibility={canUpdateVisibility}
                                      currentTeamMemberRole={team.currentTeamRole}
                                      {...field}
                                      onValueChange={field.onChange}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </>
                        ))
                        .exhaustive()}
                    </fieldset>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '8px',
                        padding: '16px 24px',
                        borderTop: '1px solid #EBE9F1',
                        backgroundColor: '#ffffff',
                      }}
                    >
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={form.formState.isSubmitting}
                        onClick={() => setOpen(false)}
                      >
                        <Trans>Cancel</Trans>
                      </Button>

                      <Button type="submit" loading={form.formState.isSubmitting}>
                        <Trans>Update</Trans>
                      </Button>
                    </div>
                  </form>
                </Form>
              </div>
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  );
};

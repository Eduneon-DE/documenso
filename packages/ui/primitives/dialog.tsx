import * as React from 'react';

import { Trans } from '@lingui/react/macro';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

import { cn } from '../lib/utils';

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogClose = DialogPrimitive.Close;

const DialogPortal = ({ children, ...props }: DialogPrimitive.DialogPortalProps) => (
  <DialogPrimitive.Portal {...props}>
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </div>
  </DialogPrimitive.Portal>
);

DialogPortal.displayName = DialogPrimitive.Portal.displayName;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      zIndex: 10000,
    }}
    className={cn('animate-in fade-in-0', className)}
    {...props}
  />
));

DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    position?: 'start' | 'end' | 'center';
    hideClose?: boolean;
    overlayClassName?: string;
  }
>(
  (
    { className, children, overlayClassName, position = 'center', hideClose = false, ...props },
    ref,
  ) => (
    <DialogPortal>
      <DialogOverlay className={cn(overlayClassName)} />
      <DialogPrimitive.Content
        ref={ref}
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          maxWidth: '500px',
          width: 'calc(100% - 64px)',
          maxHeight: 'calc(100% - 64px)',
          margin: '32px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow:
            '0px 11px 15px -7px rgba(0,0,0,0.2), 0px 24px 38px 3px rgba(0,0,0,0.14), 0px 9px 46px 8px rgba(0,0,0,0.12)',
          zIndex: 10001,
          position: 'relative',
        }}
        className={cn('animate-in fade-in-0 zoom-in-95', className)}
        {...props}
      >
        {children}
        {!hideClose && (
          <DialogPrimitive.Close
            data-testid="btn-dialog-close"
            style={{
              position: 'absolute',
              right: '16px',
              top: '12px',
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
            <X className="h-5 w-5" />
            <span className="sr-only">
              <Trans>Close</Trans>
            </span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  ),
);

DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, style, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    style={{
      padding: '16px 24px',
      borderBottom: '1px solid #EBE9F1',
      backgroundColor: '#ffffff',
      ...style,
    }}
    className={cn('flex flex-col space-y-1.5', className)}
    {...props}
  />
);

DialogHeader.displayName = 'DialogHeader';

const DialogFooter = ({ className, style, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    style={{
      padding: '16px 24px',
      borderTop: '1px solid #EBE9F1',
      backgroundColor: '#ffffff',
      ...style,
    }}
    className={cn(
      'flex flex-col-reverse space-y-2 space-y-reverse sm:flex-row sm:justify-end sm:space-x-2 sm:space-y-0',
      className,
    )}
    {...props}
  />
);

DialogFooter.displayName = 'DialogFooter';

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, style, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    style={{
      fontWeight: 500,
      color: '#5E5873',
      fontSize: '16px',
      margin: 0,
      ...style,
    }}
    className={cn('truncate', className)}
    {...props}
  />
));

DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, style, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    style={{
      fontSize: '14px',
      color: '#B9B9C3',
      marginTop: '4px',
      ...style,
    }}
    className={cn(className)}
    {...props}
  />
));

DialogDescription.displayName = DialogPrimitive.Description.displayName;

// New component for dialog body content (between header and footer)
const DialogBody = ({ className, style, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    style={{
      padding: '24px',
      backgroundColor: '#ffffff',
      overflow: 'auto',
      flex: 1,
      ...style,
    }}
    className={cn(className)}
    {...props}
  />
);

DialogBody.displayName = 'DialogBody';

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogOverlay,
  DialogTitle,
  DialogDescription,
  DialogPortal,
  DialogClose,
  DialogBody,
};

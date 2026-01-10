import type { ReactElement, ReactNode, SyntheticEvent } from 'react';
import { useEffect, useState } from 'react';

import { IconButton } from '@mui/material';
import { X } from 'lucide-react';

interface DialogContentPropsType {
  handleClose?: () => void;
}

export interface WrappedDialogProps {
  buttonLabel?: string;
  title?: ReactNode | string;
  content: ReactElement<DialogContentPropsType> | ReactNode;
  actionEl?: ReactElement | null;
  disabled?: boolean;
  actionComponent?: ReactElement;
  labelAction?: ReactElement;
  titleEndElement?: ReactElement | null;
  hide?: boolean;
  open?: boolean;
  autoOpen?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
}

export const WrappedDialog = (props: WrappedDialogProps) => {
  const {
    title,
    buttonLabel,
    hide,
    content,
    actionEl,
    disabled = false,
    actionComponent,
    autoOpen = false,
    onClose,
    open: openState,
    labelAction,
    titleEndElement,
    onOpen,
  } = props;

  const [open, setOpen] = useState(autoOpen || openState || false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDialogOpen = openState !== undefined ? openState : open;

  // Lock body scroll when dialog is open
  useEffect(() => {
    if (!mounted) return;

    if (isDialogOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isDialogOpen, mounted]);

  const handleClickOpen = (event: SyntheticEvent) => {
    event.stopPropagation();
    setOpen(true);
    if (onOpen) onOpen();
  };

  const handleClose = () => {
    setOpen(false);
    if (onClose) {
      onClose();
    }
  };

  if (hide) return null;

  const contentWithHandleClose =
    content && typeof content === 'object' && 'type' in content
      ? { ...content, props: { ...content.props, handleClose } }
      : content || <div>Please Provide the content on props</div>;

  const ClickableElement = () => {
    if (actionEl) {
      return (
        <IconButton disabled={disabled} onClick={handleClickOpen}>
          {actionEl}
        </IconButton>
      );
    }
    if (actionComponent) {
      return (
        <button
          type="button"
          onClick={handleClickOpen}
          disabled={disabled}
          className="appearance-none"
          style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
        >
          {actionComponent}
        </button>
      );
    }

    if (!buttonLabel) return null;

    return (
      <button
        type="button"
        onClick={handleClickOpen}
        disabled={disabled}
        className="rounded bg-[#4a86e8] px-4 py-2 text-sm font-medium text-white hover:bg-[#3a76d8] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {buttonLabel ?? (typeof title === 'string' ? title : null)}
      </button>
    );
  };

  // Handle escape key to close dialog
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      handleClose();
    }
  };

  // Custom modal implementation with explicit inline styles
  if (!mounted || !isDialogOpen) {
    return <ClickableElement />;
  }

  return (
    <>
      <ClickableElement />
      {/* Modal Backdrop */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        role="presentation"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1300,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onClick={handleClose}
        onKeyDown={handleKeyDown}
      >
        {/* Dialog Paper */}
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="dialog-title"
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            maxWidth: '900px',
            width: 'calc(100% - 64px)',
            maxHeight: 'calc(100% - 64px)',
            margin: '32px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow:
              '0px 11px 15px -7px rgba(0,0,0,0.2), 0px 24px 38px 3px rgba(0,0,0,0.14), 0px 9px 46px 8px rgba(0,0,0,0.12)',
          }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {/* Dialog Title */}
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
            <div
              data-component="dialog-title"
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: '16px',
                flex: 1,
                minWidth: 0,
              }}
            >
              {typeof title === 'string' ? (
                <span
                  id="dialog-title"
                  style={{
                    fontWeight: 500,
                    color: '#5E5873',
                    fontSize: '16px',
                  }}
                >
                  {title}
                </span>
              ) : (
                title
              )}
              {labelAction && <div>{labelAction}</div>}
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: '16px',
                flexShrink: 0,
              }}
            >
              {titleEndElement && <div>{titleEndElement}</div>}
              <button
                type="button"
                data-component={`close-icon-${title}`}
                onClick={handleClose}
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
              >
                <X size={20} />
              </button>
            </div>
          </div>
          {/* Dialog Content */}
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              backgroundColor: '#ffffff',
              minHeight: 0,
              overscrollBehavior: 'contain',
            }}
          >
            {contentWithHandleClose}
          </div>
        </div>
      </div>
    </>
  );
};

export default WrappedDialog;

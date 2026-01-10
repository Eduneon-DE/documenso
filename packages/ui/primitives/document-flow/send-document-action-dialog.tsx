import { useState } from 'react';

import { Trans } from '@lingui/react/macro';
import { Loader } from 'lucide-react';

import type { ButtonProps } from '../button';
import { Button } from '../button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../dialog';

export type SendDocumentActionDialogProps = ButtonProps & {
  loading?: boolean;
};

export const SendDocumentActionDialog = ({
  loading,
  className,
  ...props
}: SendDocumentActionDialogProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" className={className}>
          {loading && <Loader className="mr-2 h-5 w-5 animate-spin text-documenso" />}
          <Trans>Send</Trans>
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Send Document</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>
              You are about to send this document to the recipients. Are you sure you want to
              continue?
            </Trans>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            <Trans>Cancel</Trans>
          </Button>

          <Button className={className} {...props}>
            {loading && <Loader className="mr-2 h-5 w-5 animate-spin" />}
            <Trans>Send</Trans>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

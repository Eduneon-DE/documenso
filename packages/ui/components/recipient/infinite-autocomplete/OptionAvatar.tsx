import type { ReactNode } from 'react';

import Avatar from '@mui/material/Avatar';

// Generate avatar color and initials from name
const stringAvatar = (name: string) => {
  const nameParts = name.split(' ').filter(Boolean);
  const initials =
    nameParts.length >= 2 ? `${nameParts[0][0]}${nameParts[1][0]}` : nameParts[0]?.[0] || '?';

  // Generate a consistent color based on the name
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);

  return {
    sx: {
      bgcolor: `hsl(${hue}, 60%, 50%)`,
    },
    children: initials.toUpperCase(),
  };
};

// Check if string is a valid URL
const isUrl = (str: string): boolean => {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
};

type OptionAvatarProps<TData> = {
  option: (TData & { name?: string }) | null;
  getImageUrl?: (data: TData) => string | null | undefined | ReactNode;
  size?: number;
};

const OptionAvatar = <TData,>({ option, getImageUrl, size = 25 }: OptionAvatarProps<TData>) => {
  const imageUrl = option ? getImageUrl?.(option as TData) || '' : '';
  const name = (option as { name?: string })?.name || '';
  const avatarDetail = stringAvatar(name);
  const isImageUrl = typeof imageUrl === 'string' && isUrl(imageUrl);

  if (imageUrl === 'NO_IMAGE') {
    return null;
  }

  if (typeof imageUrl !== 'string') {
    return (
      <Avatar
        slotProps={{ img: { loading: 'lazy' } }}
        sx={{
          width: size,
          height: size,
          ml: 1,
        }}
        variant="rounded"
      >
        {imageUrl}
      </Avatar>
    );
  }

  return (
    <Avatar
      slotProps={{ img: { loading: 'lazy' } }}
      sx={{
        width: size,
        height: size,
        fontSize: '14px',
        ml: 1,
        ...(!isImageUrl ? avatarDetail.sx : {}),
        '& img': {
          filter: !isImageUrl ? 'invert(1) brightness(2) contrast(2)' : undefined,
        },
      }}
      variant="rounded"
      src={typeof imageUrl === 'string' ? imageUrl : undefined}
    >
      {avatarDetail.children}
    </Avatar>
  );
};

export default OptionAvatar;

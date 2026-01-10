import type { HTMLAttributes, ReactNode } from 'react';

import { Trans } from '@lingui/react/macro';
import type { AutocompleteRenderOptionState, SxProps, Theme } from '@mui/material';
import Avatar from '@mui/material/Avatar';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import OptionAvatar from './OptionAvatar';

export type OptionType<TData> = TData & {
  name?: string;
  label?: string;
  email?: string;
  disabled?: boolean;
  isNewOption?: boolean;
  inputValue?: string;
  level?: number;
  _originalName?: string;
  _displayName?: string;
};

type DefaultOptionProps<TData> = {
  props: HTMLAttributes<HTMLLIElement> & { key: string; sx?: SxProps<Theme> };
  option: OptionType<TData>;
  options?: OptionType<TData>[];
  state: AutocompleteRenderOptionState;
  optionProps?: {
    getLabel?: (option: TData) => ReactNode;
    getSecondaryLabel?: (option: TData) => ReactNode;
    getLabelTooltip?: (option: TData) => ReactNode;
    getImageUrl?: (data: TData) => string | null | undefined | ReactNode;
    hideAvatar?: boolean;
  };
  upsertNewOptionProps?: {
    key: string;
    getLabel?: (option: TData) => ReactNode;
  };
  multiple?: boolean;
};

// Generate color from string (like Cockpit)
const stringToColor = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str?.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = '#';
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xff;
    color += `00${value.toString(16)}`.slice(-2);
  }
  return color;
};

// Get initials from name
const getInitials = (name = ''): string => {
  const [first = '', second = ''] = name.trim().split(/\s+/);
  return ((first[0] || '') + (second[0] || '')).toUpperCase() || '?';
};

const DefaultOption = <TData,>({
  option,
  optionProps,
  upsertNewOptionProps,
  props,
  state,
}: DefaultOptionProps<TData>) => {
  const isNewOption = Boolean(option.isNewOption);
  const hasCustomImageUrl = !!optionProps?.getImageUrl && !optionProps?.hideAvatar;

  // Get display name and email
  const displayName = option._displayName || option.name || option.label || '';
  const email = option.email || '';

  // Use upsertNewOptionProps.getLabel for new options, otherwise use optionProps.getLabel
  const primaryLabel = isNewOption
    ? (upsertNewOptionProps?.getLabel?.(option) ?? (
        <>
          <Trans>Add</Trans> "{option.label || option.name}"
        </>
      ))
    : (optionProps?.getLabel?.(option) ?? displayName);

  // Secondary label (email) - only for non-new options
  const secondaryLabel = !isNewOption
    ? (optionProps?.getSecondaryLabel?.(option) ?? (email && email !== displayName ? email : null))
    : null;

  const labelTooltip = optionProps?.getLabelTooltip?.(option) ?? '';

  return (
    <Tooltip title={labelTooltip} followCursor={true} arrow placement="bottom">
      <ListItem
        dense
        disablePadding
        {...props}
        style={{
          backgroundColor: state.selected ? '#f2f5f7' : '#ffffff',
          pointerEvents: option?.disabled ? 'none' : 'auto',
          opacity: option?.disabled ? 0.5 : 1,
        }}
      >
        <ListItemButton
          dense
          disabled={option?.disabled}
          style={{
            backgroundColor: state.selected ? '#f2f5f7' : '#ffffff',
            color: '#6d6d6d',
            borderLeft: isNewOption ? '3px solid #4caf50' : undefined,
            padding: '6px 12px',
          }}
        >
          <ListItemIcon sx={{ minWidth: 40 }}>
            {hasCustomImageUrl ? (
              <OptionAvatar option={option} getImageUrl={optionProps?.getImageUrl} />
            ) : (
              <Avatar
                variant="rounded"
                sx={{
                  height: 28,
                  width: 28,
                  fontSize: 12,
                  fontWeight: 600,
                  bgcolor: isNewOption ? '#4caf50' : stringToColor(displayName),
                }}
              >
                {isNewOption ? '+' : getInitials(displayName)}
              </Avatar>
            )}
          </ListItemIcon>
          <ListItemText
            sx={{ my: 0 }}
            primary={
              <Typography
                component="span"
                sx={{
                  fontSize: '14px',
                  fontWeight: 500,
                  color: isNewOption ? '#4caf50' : '#374151',
                  display: 'block',
                  lineHeight: 1.3,
                }}
              >
                {primaryLabel}
              </Typography>
            }
            secondary={
              secondaryLabel ? (
                <Typography
                  component="span"
                  sx={{
                    fontSize: '12px',
                    color: '#6b7280',
                    display: 'block',
                    lineHeight: 1.3,
                  }}
                >
                  {secondaryLabel}
                </Typography>
              ) : null
            }
          />
        </ListItemButton>
      </ListItem>
    </Tooltip>
  );
};

export default DefaultOption;

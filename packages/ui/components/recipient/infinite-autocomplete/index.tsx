import type { FC, HTMLAttributes, ReactNode, SyntheticEvent } from 'react';
import { useMemo } from 'react';

import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';
import { Trans } from '@lingui/react/macro';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import InputAdornment from '@mui/material/InputAdornment';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import TextField from '@mui/material/TextField';
import { ThemeProvider, styled } from '@mui/material/styles';

import DefaultOption, { type OptionType } from './DefaultOption';
import OptionAvatar from './OptionAvatar';
import { muiTheme } from './theme';

// Z-index for popper
const Z_INDEX_POPPER = 1305;

// Group Header for grouped options
export const GroupHeader: FC<HTMLAttributes<HTMLDivElement>> = styled('div')(() => ({
  position: 'sticky',
  top: '0px',
  padding: '7px 6px',
  zIndex: 10,
  fontSize: '14px',
  fontWeight: 600,
  color: '#5f5b5b',
  background: '#f1f1f1',
  borderBottom: '1px solid #e0e0e0',
  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
}));

export type InfiniteAsyncAutocompleteProps<TData extends { id?: number | string }> = {
  // Value and change handlers (replaces Controller)
  value: TData | TData[] | null;
  inputValue: string;
  onInputChange: (value: string) => void;
  onChange: (value: TData | TData[] | null) => void;

  // Options
  options: OptionType<TData>[];

  // Loading states
  loading?: boolean;
  loadingMore?: boolean;

  // Infinite scroll
  hasNextPage?: boolean;
  fetchNextPage?: () => void;

  // Configuration
  multiple?: boolean;
  disabled?: boolean;
  placeholder?: string;
  limitTags?: number;
  freeSolo?: boolean;

  // Option rendering
  optionProps?: {
    getLabel?: (option: TData) => ReactNode;
    getSecondaryLabel?: (option: TData) => ReactNode;
    getLabelTooltip?: (option: TData) => ReactNode;
    getImageUrl?: (data: TData) => string | null | undefined | ReactNode;
    hideAvatar?: boolean;
  };

  // Grouping
  groupBy?: (option: OptionType<TData>) => string;

  // Create new option
  upsertNewOptionProps?: {
    key: string;
    getLabel?: (option: TData) => ReactNode;
  };

  // Input props
  inputProps?: {
    maxLength?: number;
    'data-testid'?: string;
    error?: boolean;
    helperText?: string;
  };

  // Custom styling
  sx?: Record<string, unknown>;

  // Callbacks
  onOpen?: () => void;
};

export const InfiniteAsyncAutocomplete = <
  TData extends { id?: number | string; name?: string | null },
>({
  value,
  inputValue,
  onInputChange,
  onChange,
  options,
  loading = false,
  loadingMore = false,
  hasNextPage = false,
  fetchNextPage,
  multiple = false,
  disabled = false,
  placeholder = '',
  limitTags = 3,
  freeSolo = false,
  optionProps,
  groupBy,
  upsertNewOptionProps,
  inputProps,
  sx,
  onOpen,
}: InfiniteAsyncAutocompleteProps<TData>) => {
  const getImageUrl = optionProps?.getImageUrl;

  // Create Emotion cache with prepend to inject MUI styles before Tailwind
  const muiCache = useMemo(
    () =>
      createCache({
        key: 'mui',
        prepend: true,
      }),
    [],
  );

  const handleScroll = (event: SyntheticEvent) => {
    const target = event.target as HTMLDivElement;
    const isAtEndOfList = target.scrollTop + target.clientHeight >= target.scrollHeight - 20;
    if (isAtEndOfList && hasNextPage && !loadingMore && fetchNextPage) {
      fetchNextPage();
    }
  };

  return (
    <CacheProvider value={muiCache}>
      <ThemeProvider theme={muiTheme}>
        <Box
          className="mui-autocomplete-wrapper"
          style={{
            backgroundColor: '#ffffff',
          }}
        >
          <Autocomplete
            openOnFocus
            onOpen={onOpen}
            autoHighlight
            clearOnBlur={false}
            selectOnFocus={false}
            handleHomeEndKeys={false}
            forcePopupIcon
            renderOption={(props, option, state) => (
              <DefaultOption
                props={props}
                option={option}
                options={options}
                optionProps={optionProps}
                upsertNewOptionProps={upsertNewOptionProps}
                state={state}
                multiple={multiple}
              />
            )}
            freeSolo={freeSolo}
            getOptionDisabled={(option) => option.disabled ?? false}
            onInputChange={(_event, newInputValue, reason) => {
              if (reason === 'reset') return;
              onInputChange(newInputValue);
            }}
            renderTags={(tagValue: (TData & { name?: string; label?: string })[], getTagProps) =>
              tagValue?.map((option, index) => {
                const imgUrl = getImageUrl?.(option);
                const hasAvatar = imgUrl && !optionProps?.hideAvatar;
                const { key: _key, ...otherTagProps } = getTagProps({ index });
                const chipKey = `chip-${index}-${option.name || option.label}`;
                return (
                  <Chip
                    key={chipKey}
                    {...(hasAvatar
                      ? {
                          avatar: (
                            <OptionAvatar option={option} getImageUrl={getImageUrl} size={20} />
                          ),
                        }
                      : {})}
                    label={option.name || option.label}
                    {...otherTagProps}
                    size="small"
                  />
                );
              })
            }
            // Don't filter client-side - filtering is done server-side
            filterOptions={(opts, params) => {
              const filtered = [...opts];
              const { inputValue: filterInput } = params;

              // Suggest the creation of a new value if it doesn't exist
              if (upsertNewOptionProps && filterInput !== '') {
                const isExisting = opts.some(
                  (option) =>
                    filterInput === option.name ||
                    filterInput === (option as { title?: string }).title,
                );

                if (!isExisting) {
                  const tempId = `temp_${Date.now()}_${filterInput.replace(/[^a-zA-Z0-9]/g, '_')}`;
                  const newOption = {
                    id: tempId,
                    [upsertNewOptionProps.key]: filterInput,
                    label: filterInput,
                    isNewOption: true,
                  } as unknown as OptionType<TData>;
                  filtered.push(newOption);
                }
              }
              return filtered;
            }}
            value={value as OptionType<TData> | OptionType<TData>[] | null}
            inputValue={inputValue}
            limitTags={limitTags}
            fullWidth
            onChange={(_event, newValue) => {
              onChange(newValue as TData | TData[] | null);
            }}
            groupBy={groupBy}
            renderGroup={(params) => (
              <li key={params.key}>
                {params.group && <GroupHeader>{params.group}</GroupHeader>}
                <Box>{params.children}</Box>
              </li>
            )}
            isOptionEqualToValue={(option, val) => {
              return option?.id === ((val as TData)?.id || val);
            }}
            multiple={multiple}
            disableCloseOnSelect={multiple}
            options={options}
            loading={loading}
            disabled={disabled}
            getOptionLabel={(option) =>
              (option as OptionType<TData>)?.name ?? (option as OptionType<TData>)?.label ?? ''
            }
            loadingText={
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  padding: '8px 12px',
                }}
              >
                <CircularProgress size={16} />
                <span style={{ fontSize: '14px', color: '#6d6d6d' }}>
                  <Trans>Loading suggestions...</Trans>
                </span>
              </Box>
            }
            noOptionsText={
              <span
                style={{
                  fontSize: '14px',
                  color: '#6d6d6d',
                  padding: '8px 12px',
                  display: 'block',
                }}
              >
                <Trans>No suggestions found</Trans>
              </span>
            }
            sx={{
              width: '100%',
              backgroundColor: 'white',
              '& .MuiAutocomplete-inputRoot': { p: 0.1 },
              ...sx,
            }}
            renderInput={(params) => {
              let selectedOption: (TData & { name?: string; isNewOption?: boolean }) | null = null;
              if (!multiple && value) {
                selectedOption = options?.find((o) => o.id === (value as TData)?.id) ?? null;
              }

              return (
                <TextField
                  {...params}
                  variant="outlined"
                  size="small"
                  error={inputProps?.error}
                  helperText={inputProps?.helperText}
                  disabled={disabled}
                  placeholder={placeholder}
                  data-testid={inputProps?.['data-testid']}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: '#ffffff',
                      borderRadius: '6px',
                      fontSize: '14px',
                      minHeight: '40px',
                      height: '40px',
                      '& fieldset': {
                        borderColor: '#d1d5db',
                        borderWidth: '1px',
                      },
                      '&:hover fieldset': {
                        borderColor: '#9ca3af',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#000000',
                        borderWidth: '1px',
                      },
                      '&.Mui-disabled': {
                        backgroundColor: '#f5f5f5',
                      },
                    },
                    '& .MuiOutlinedInput-input': {
                      padding: '6px 12px',
                      color: '#374151',
                      fontWeight: 500,
                      fontSize: '14px',
                      '&::placeholder': {
                        color: '#9ca3af',
                        opacity: 1,
                      },
                    },
                  }}
                  slotProps={{
                    htmlInput: {
                      ...params.inputProps,
                      maxLength: inputProps?.maxLength,
                    },
                    input: {
                      ...params.InputProps,
                      ...(!multiple && value && getImageUrl && !selectedOption?.isNewOption
                        ? {
                            startAdornment: (
                              <InputAdornment position="start" key={(value as TData)?.id}>
                                <OptionAvatar option={selectedOption} getImageUrl={getImageUrl} />
                              </InputAdornment>
                            ),
                          }
                        : {}),
                      // Keep original endAdornment (popup icon), loading is shown in listbox
                      endAdornment: params.InputProps.endAdornment,
                    },
                  }}
                />
              );
            }}
            slotProps={{
              popper: {
                sx: { zIndex: Z_INDEX_POPPER },
                style: { zIndex: Z_INDEX_POPPER },
              },
              paper: {
                sx: { maxHeight: 300 },
                style: {
                  backgroundColor: '#ffffff',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                  border: '1px solid #e5e7eb',
                  marginTop: '4px',
                },
                onScroll: handleScroll,
              },
            }}
            slots={{
              listbox: (listboxProps) => {
                const { children, ...other } = listboxProps;
                return (
                  <List
                    {...other}
                    style={{
                      backgroundColor: '#ffffff',
                      padding: '4px',
                      maxHeight: '300px',
                      overflow: 'auto',
                    }}
                  >
                    {children}
                    {loadingMore && (
                      <ListItem sx={{ justifyContent: 'center', py: 1 }}>
                        <CircularProgress size={20} />
                      </ListItem>
                    )}
                  </List>
                );
              },
            }}
          />
        </Box>
      </ThemeProvider>
    </CacheProvider>
  );
};

export { OptionAvatar, DefaultOption };
export type { OptionType };

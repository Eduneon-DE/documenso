import { InfiniteAsyncAutocomplete, type OptionType } from './infinite-autocomplete';

export type RecipientAutoCompleteOption = {
  email: string;
  name: string | null;
  avatarUrl?: string | null;
  organizationName?: string | null;
};

type RecipientMuiAutocompleteProps = {
  type: 'email' | 'text';
  value: string;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  loadingMore?: boolean;
  options: RecipientAutoCompleteOption[];
  onSelect: (option: RecipientAutoCompleteOption) => void;
  onSearchQueryChange: (query: string) => void;
  onOpen?: () => void;
  hasNextPage?: boolean;
  fetchNextPage?: () => void;
  maxLength?: number;
  'data-testid'?: string;
};

// Option type with id for InfiniteAsyncAutocomplete
type OptionWithId = RecipientAutoCompleteOption & {
  id: string;
  isNewOption?: boolean;
  label?: string;
  avatarUrl?: string | null;
  organizationName?: string | null;
};

export const RecipientMuiAutocomplete = ({
  // type is kept for API compatibility but not used internally
  type: _type,
  value,
  placeholder,
  disabled,
  loading,
  loadingMore,
  options = [],
  onSelect,
  onSearchQueryChange,
  onOpen,
  hasNextPage,
  fetchNextPage,
  maxLength,
  'data-testid': dataTestId,
}: RecipientMuiAutocompleteProps) => {
  // Convert options to include id (using email as unique identifier)
  const optionsWithId = options.map((opt) => ({
    ...opt,
    id: opt.email,
    // Use name for display, fallback to email
    name: opt.name || opt.email,
  })) as OptionType<OptionWithId>[];

  return (
    <InfiniteAsyncAutocomplete<OptionWithId>
      value={null}
      inputValue={value}
      onInputChange={onSearchQueryChange}
      onChange={(newValue) => {
        if (newValue && !Array.isArray(newValue)) {
          // For new options, use the label as email
          const email = newValue.isNewOption ? newValue.label || newValue.email : newValue.email;
          onSelect({
            email,
            name: newValue.isNewOption ? null : newValue.name,
          });
        }
      }}
      onOpen={onOpen}
      options={optionsWithId}
      loading={loading}
      loadingMore={loadingMore}
      hasNextPage={hasNextPage}
      fetchNextPage={fetchNextPage}
      disabled={disabled}
      placeholder={placeholder}
      freeSolo={true}
      optionProps={{
        getLabel: (option) => {
          // For new options, just show the typed value
          if (option.isNewOption) {
            return option.label || option.email;
          }
          // For existing options, show name with organization in secondary style
          const name = option.name || option.email;
          if (option.organizationName) {
            return (
              <>
                {name}{' '}
                <span style={{ fontSize: '12px', color: '#6b7280' }}>
                  ({option.organizationName})
                </span>
              </>
            );
          }
          return name;
        },
        getSecondaryLabel: (option) => {
          // For new options, no secondary label
          if (option.isNewOption) {
            return null;
          }
          // Show email as secondary text
          return option.email;
        },
        getImageUrl: (option) => {
          // Return avatar URL for Cockpit users
          return option.avatarUrl || null;
        },
      }}
      upsertNewOptionProps={{
        key: 'email',
        getLabel: (option) => option.label || option.email,
      }}
      inputProps={{
        maxLength,
        'data-testid': dataTestId,
      }}
    />
  );
};

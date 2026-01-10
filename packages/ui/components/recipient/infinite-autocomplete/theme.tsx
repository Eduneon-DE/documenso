import { createTheme } from '@mui/material/styles';

// Z-index for MUI popper
const Z_INDEX_POPPER = 1305;

// Light theme for MUI components - using !important to override Tailwind
export const muiTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#000000',
    },
    background: {
      default: '#ffffff',
      paper: '#ffffff',
    },
    text: {
      primary: '#54585d',
      secondary: '#6d6d6d',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  },
  components: {
    MuiInputBase: {
      styleOverrides: {
        root: {
          backgroundColor: '#ffffff !important',
          color: '#54585d !important',
          '&.Mui-disabled': {
            backgroundColor: '#f0f0f0 !important',
          },
        },
        input: {
          backgroundColor: '#ffffff !important',
          color: '#54585d !important',
          '&::placeholder': {
            color: '#9ca3af !important',
            opacity: '1 !important',
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: '#ffffff !important',
          '&.Mui-disabled': {
            backgroundColor: '#f0f0f0 !important',
          },
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: '#d1d5db !important',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#9ca3af !important',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#000000 !important',
            borderWidth: '1px !important',
          },
        },
        input: {
          backgroundColor: '#ffffff !important',
          color: '#54585d !important',
          fontWeight: 500,
          fontSize: '14px',
          padding: '10px 12px !important',
          '&::placeholder': {
            color: '#9ca3af !important',
            opacity: '1 !important',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          backgroundColor: '#ffffff !important',
          borderRadius: '5px',
          '& .MuiInputBase-root': {
            backgroundColor: '#ffffff !important',
          },
        },
      },
    },
    MuiAutocomplete: {
      defaultProps: {
        slotProps: {
          popper: {
            sx: { zIndex: Z_INDEX_POPPER },
          },
        },
      },
      styleOverrides: {
        root: {
          '& .MuiInputBase-root': {
            backgroundColor: '#ffffff !important',
          },
        },
        inputRoot: {
          backgroundColor: '#ffffff !important',
          padding: '2px 8px !important',
        },
        input: {
          backgroundColor: '#ffffff !important',
          color: '#54585d !important',
        },
        paper: {
          backgroundColor: '#ffffff !important',
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1) !important',
          border: '1px solid #e5e7eb !important',
          marginTop: '4px !important',
        },
        listbox: {
          backgroundColor: '#ffffff !important',
          padding: '4px !important',
          maxHeight: '300px !important',
        },
        option: {
          backgroundColor: '#ffffff !important',
          color: '#6d6d6d !important',
          fontSize: '14px !important',
          '&[aria-selected="true"]': {
            backgroundColor: '#f2f5f7 !important',
          },
          '&.Mui-focused': {
            backgroundColor: '#f2f5f7 !important',
          },
          '&:hover': {
            backgroundColor: '#f2f5f7 !important',
          },
        },
        noOptions: {
          backgroundColor: '#ffffff !important',
          color: '#6d6d6d !important',
          fontSize: '14px !important',
        },
        loading: {
          backgroundColor: '#ffffff !important',
          color: '#6d6d6d !important',
          fontSize: '14px !important',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: '#ffffff !important',
        },
      },
    },
    MuiList: {
      styleOverrides: {
        root: {
          backgroundColor: '#ffffff !important',
          padding: '0 !important',
        },
      },
    },
    MuiListItem: {
      styleOverrides: {
        root: {
          backgroundColor: '#ffffff !important',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          backgroundColor: '#ffffff !important',
          color: '#6d6d6d !important',
          '&:hover': {
            backgroundColor: '#f2f5f7 !important',
          },
          '&.Mui-selected': {
            backgroundColor: '#f2f5f7 !important',
          },
        },
      },
    },
    MuiListItemText: {
      styleOverrides: {
        primary: {
          color: '#6d6d6d !important',
          fontSize: '14px !important',
        },
      },
    },
    MuiPopper: {
      defaultProps: {
        style: { zIndex: Z_INDEX_POPPER },
      },
    },
  },
});

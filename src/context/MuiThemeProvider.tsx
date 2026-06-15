'use client';

import React from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

const theme = createTheme({
  palette: {
    primary: {
      main: '#0a5bd7',
      light: '#2691f5',
      dark: '#0848ab',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#475569', // Slate-600
      light: '#64748b', // Slate-500
      dark: '#334155', // Slate-700
      contrastText: '#ffffff',
    },
    background: {
      default: '#f8fafc', // Slate-50
      paper: '#ffffff',
    },
    text: {
      primary: '#0f172a', // Slate-900
      secondary: '#475569', // Slate-600
    },
  },
  typography: {
    fontFamily: [
      'Outfit',
      'Inter',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
    h1: { fontWeight: 900 },
    h2: { fontWeight: 900 },
    h3: { fontWeight: 900 },
    h4: { fontWeight: 800 },
    h5: { fontWeight: 800 },
    h6: { fontWeight: 700 },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
    body1: { fontWeight: 500 },
    body2: { fontWeight: 500 },
    button: { fontWeight: 700, textTransform: 'none' },
  },
  shape: {
    borderRadius: 12,
  },
  shadows: [
    'none',
    '0px 1px 3px rgba(0, 0, 0, 0.05)',
    '0px 2px 8px rgba(0, 0, 0, 0.05)',
    '0px 4px 12px rgba(0, 0, 0, 0.06)',
    '0px 8px 20px rgba(0, 0, 0, 0.06)',
    '0px 12px 24px rgba(0, 0, 0, 0.07)',
    '0px 16px 32px rgba(0, 0, 0, 0.07)',
    '0px 24px 48px rgba(0, 0, 0, 0.08)',
    ...Array(17).fill('none'), // fill rest to complete 25 shadows
  ] as any,
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '12px',
          padding: '10px 20px',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(10, 91, 215, 0.15)',
          },
        },
        contained: {
          backgroundImage: 'linear-gradient(to right, #0a5bd7, #2691f5)',
          color: '#ffffff',
          border: 'none',
          '&:hover': {
            backgroundImage: 'linear-gradient(to right, #0952c3, #1f80dc)',
          },
        },
        outlined: {
          borderColor: '#e2e8f0',
          color: '#475569',
          '&:hover': {
            backgroundColor: '#f8fafc',
            borderColor: '#cbd5e1',
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: '24px',
          padding: '12px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.08)',
          backgroundImage: 'none',
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontSize: '1.25rem',
          fontWeight: 900,
          color: '#0f172a',
          paddingBottom: '8px',
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          paddingTop: '8px !important',
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        size: 'small',
      },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: '12px',
            backgroundColor: '#f8fafc',
            '& fieldset': {
              borderColor: '#e2e8f0',
            },
            '&:hover fieldset': {
              borderColor: '#cbd5e1',
            },
            '&.Mui-focused': {
              backgroundColor: '#ffffff',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#0a5bd7',
              borderWidth: '2px',
            },
          },
        },
      },
    },
    MuiSelect: {
      defaultProps: {
        size: 'small',
      },
      styleOverrides: {
        root: {
          borderRadius: '12px',
          backgroundColor: '#f8fafc',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: '#e2e8f0',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#cbd5e1',
          },
          '&.Mui-focused': {
            backgroundColor: '#ffffff',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#0a5bd7',
            borderWidth: '2px',
          },
        },
      },
    },
    MuiFormControl: {
      defaultProps: {
        size: 'small',
      },
    },
    MuiTable: {
      styleOverrides: {
        root: {
          borderCollapse: 'collapse',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          border: '1px solid #e2e8f0',
          padding: '8px 16px',
          fontSize: '0.875rem',
          whiteSpace: 'nowrap',
        },
        head: {
          backgroundColor: '#f1f5f9',
          color: '#334155',
          fontWeight: 900,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontSize: '0.75rem',
          padding: '8px 16px',
        },
        body: {
          color: '#334155',
          fontWeight: 500,
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: 'background-color 0.2s ease',
          '&:hover': {
            backgroundColor: '#f8fafc',
          },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid #f1f5f9',
          minHeight: '40px',
        },
        indicator: {
          backgroundColor: '#0a5bd7',
          height: '2px',
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'uppercase',
          fontSize: '0.75rem',
          fontWeight: 900,
          letterSpacing: '0.05em',
          minHeight: '40px',
          padding: '8px 16px',
          color: '#94a3b8',
          '&.Mui-selected': {
            color: '#0a5bd7',
          },
          '&:hover': {
            color: '#475569',
          },
        },
      },
    },
  },
});

export function MuiThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
export default MuiThemeProvider;

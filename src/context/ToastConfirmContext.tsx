'use client';

import React, { createContext, useContext, useState } from 'react';
import { Snackbar, Alert, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button } from '@mui/material';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  severity?: 'error' | 'warning' | 'info';
}

interface ToastState {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'warning' | 'info';
}

interface ConfirmState {
  open: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  severity: 'error' | 'warning' | 'info';
  resolve: ((val: boolean) => void) | null;
}

interface ToastConfirmContextType {
  showToast: (message: string, severity?: ToastState['severity']) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ToastConfirmContext = createContext<ToastConfirmContextType | null>(null);

export function useToastConfirm() {
  const context = useContext(ToastConfirmContext);
  if (!context) {
    throw new Error('useToastConfirm must be used within a ToastConfirmProvider');
  }
  return context;
}

export function ToastConfirmProvider({ children }: { children: React.ReactNode }) {
  // Toast State
  const [toast, setToast] = useState<ToastState>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Confirm Dialog State
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    open: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    severity: 'warning',
    resolve: null,
  });

  const showToast = (message: string, severity: ToastState['severity'] = 'success') => {
    setToast({ open: true, message, severity });
  };

  const handleToastClose = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') return;
    setToast(prev => ({ ...prev, open: false }));
  };

  const confirm = (options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({
        open: true,
        title: options.title,
        message: options.message,
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        severity: options.severity || 'warning',
        resolve,
      });
    });
  };

  const handleConfirmAction = (value: boolean) => {
    if (confirmState.resolve) {
      confirmState.resolve(value);
    }
    setConfirmState(prev => ({ ...prev, open: false, resolve: null }));
  };

  return (
    <ToastConfirmContext.Provider value={{ showToast, confirm }}>
      {children}

      {/* Toast Snackbar */}
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={handleToastClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleToastClose}
          severity={toast.severity}
          variant="filled"
          sx={{ 
            borderRadius: '16px', 
            fontWeight: 600, 
            boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
            minWidth: '250px'
          }}
        >
          {toast.message}
        </Alert>
      </Snackbar>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmState.open}
        onClose={() => handleConfirmAction(false)}
        maxWidth="xs"
        fullWidth
        sx={{
          '& .MuiPaper-root': {
            borderRadius: '24px',
            padding: '16px',
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 950, fontSize: '1.25rem', pb: 1 }}>
          {confirmState.title}
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: 'text.secondary', fontWeight: 500, fontSize: '0.9rem' }}>
            {confirmState.message}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1.5 }}>
          <Button
            onClick={() => handleConfirmAction(false)}
            variant="outlined"
            fullWidth
            sx={{
              borderRadius: '12px',
              fontWeight: 700,
              py: 1.2
            }}
          >
            {confirmState.cancelText}
          </Button>
          <Button
            onClick={() => handleConfirmAction(true)}
            variant="contained"
            color={confirmState.severity === 'error' ? 'error' : 'primary'}
            fullWidth
            sx={{
              borderRadius: '12px',
              fontWeight: 700,
              py: 1.2,
              backgroundColor: confirmState.severity === 'error' ? '#ef4444' : undefined,
              '&:hover': {
                backgroundColor: confirmState.severity === 'error' ? '#dc2626' : undefined,
              }
            }}
          >
            {confirmState.confirmText}
          </Button>
        </DialogActions>
      </Dialog>
    </ToastConfirmContext.Provider>
  );
}

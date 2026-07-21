'use client';

import React, { ReactNode } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton, CircularProgress, Button,
} from '@mui/material';
import { X } from 'lucide-react';

/**
 * The one dialog.
 *
 * Eight screens had hand-rolled this, and every one of them pinned
 * `!rounded-2xl` onto the paper — overriding the 24px the theme already sets,
 * because Emotion injects after Tailwind and the only way to win that argument
 * is `!important`. Eight dialogs, three corner radii, and a stack of `!` that
 * exists purely to undo the design system.
 *
 * So the radius, the padding and the title weight are the theme's, stated
 * nowhere here. What a caller passes is what a caller actually decides: what
 * it says, what it contains, and what the buttons do.
 */
export default function AppDialog({
  open,
  onClose,
  title,
  subtitle,
  children,
  /** Anything extra to the LEFT of confirm/cancel — a delete, a secondary path. */
  extraActions,
  confirmText,
  onConfirm,
  confirmDisabled,
  confirmColor = 'primary',
  cancelText = 'Cancel',
  busy,
  maxWidth = 'xs',
  /** A form dialog wants the divider; a short question looks boxed-in with it. */
  dividers = true,
  /**
   * `stacked` gives the confirm button the full width of the dialog and a
   * bigger hit area. That is for the gate desk: a guard is standing up, often
   * one-handed, on a tablet on a bracket, and a 36px button at the end of a row
   * is the difference between the software being used and the paper book
   * coming back out.
   */
  actionsLayout = 'inline',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  extraActions?: ReactNode;
  confirmText?: string;
  onConfirm?: () => void;
  confirmDisabled?: boolean;
  confirmColor?: 'primary' | 'error' | 'warning';
  cancelText?: string;
  busy?: boolean;
  maxWidth?: 'xs' | 'sm' | 'md';
  dividers?: boolean;
  actionsLayout?: 'inline' | 'stacked';
}) {
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth={maxWidth}>
      <DialogTitle className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          {title}
          {subtitle && <span className="block text-sm font-medium text-slate-500 mt-1">{subtitle}</span>}
        </span>
        <IconButton size="small" onClick={onClose} disabled={busy} aria-label="Close">
          <X className="w-4.5 h-4.5 text-slate-400" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers={dividers} className="flex flex-col gap-4">
        {children}
      </DialogContent>

      {actionsLayout === 'stacked' ? (
        <DialogActions className="flex-col items-stretch gap-2">
          {onConfirm && (
            <Button fullWidth variant="contained" size="large" color={confirmColor} onClick={onConfirm}
              disabled={busy || confirmDisabled}
              startIcon={busy ? <CircularProgress size={18} color="inherit" /> : undefined}>
              {confirmText || 'Save'}
            </Button>
          )}
          {extraActions}
        </DialogActions>
      ) : (
        <DialogActions>
          {extraActions}
          <div className="flex-1" />
          <Button onClick={onClose} disabled={busy} color="inherit">{cancelText}</Button>
          {onConfirm && (
            <Button variant="contained" color={confirmColor} onClick={onConfirm}
              disabled={busy || confirmDisabled}
              startIcon={busy ? <CircularProgress size={16} color="inherit" /> : undefined}>
              {confirmText || 'Save'}
            </Button>
          )}
        </DialogActions>
      )}
    </Dialog>
  );
}

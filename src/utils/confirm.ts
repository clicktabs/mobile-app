import { showToast, type ToastType } from '../components/Toast';
import { requestConfirm, type ConfirmOptions } from '../components/ConfirmDialog';

/**
 * Cross-platform in-app confirm (branded modal — no window.confirm / Alert).
 */
export function confirmAction(
  title: string,
  message?: string,
  options?: Omit<ConfirmOptions, 'title' | 'message'>,
): Promise<boolean> {
  return requestConfirm({
    title,
    message,
    confirmLabel: options?.confirmLabel || 'OK',
    cancelLabel: options?.cancelLabel || 'Cancel',
    destructive: options?.destructive,
    icon: options?.icon,
  });
}

function inferType(title: string, message?: string): ToastType {
  const t = `${title} ${message || ''}`.toLowerCase();
  if (
    t.includes('fail') ||
    t.includes('error') ||
    t.includes('invalid') ||
    t.includes('missing') ||
    t.includes('could not') ||
    t.includes('required')
  ) {
    return 'error';
  }
  if (
    t.includes('success') ||
    t.includes('saved') ||
    t.includes('sent') ||
    t.includes('recorded') ||
    t.includes('created') ||
    t.includes('completed') ||
    t.includes('updated') ||
    t.includes('clocked') ||
    t.includes('downloaded') ||
    t.includes('checked') ||
    t.includes('claim submitted') ||
    t.includes('approved') ||
    t.includes('accepted')
  ) {
    return 'success';
  }
  return 'info';
}

/** Nice in-app toast (replaces Alert.alert / window.alert). */
export function showAlert(title: string, message?: string, type?: ToastType) {
  showToast(title, message, type || inferType(title, message));
}

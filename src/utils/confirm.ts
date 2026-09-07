import { Alert, Platform } from 'react-native';
import { showToast, type ToastType } from '../components/Toast';

/**
 * Cross-platform confirm. RN Alert multi-button dialogs are unreliable on web
 * (Expo web), so web uses window.confirm and always resolves a boolean.
 */
export function confirmAction(
  title: string,
  message?: string,
): Promise<boolean> {
  if (Platform.OS === 'web') {
    const text = message ? `${title}\n\n${message}` : title;
    return Promise.resolve(
      typeof window !== 'undefined' ? window.confirm(text) : true,
    );
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'OK', style: 'destructive', onPress: () => resolve(true) },
    ]);
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
    t.includes('checked')
  ) {
    return 'success';
  }
  return 'info';
}

/** Nice in-app toast (replaces Alert.alert / window.alert). */
export function showAlert(title: string, message?: string, type?: ToastType) {
  showToast(title, message, type || inferType(title, message));
}

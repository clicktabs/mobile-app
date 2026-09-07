import { Alert, Platform } from 'react-native';

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

/** Simple alert that works on web (window.alert) and native. */
export function showAlert(title: string, message?: string) {
  if (Platform.OS === 'web') {
    const text = message ? `${title}\n\n${message}` : title;
    if (typeof window !== 'undefined') window.alert(text);
    return;
  }
  Alert.alert(title, message);
}

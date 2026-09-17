import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { ConnectivityProvider } from './src/context/ConnectivityContext';
import { ToastProvider } from './src/components/Toast';
import { ConfirmProvider } from './src/components/ConfirmDialog';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ToastProvider>
          <ConfirmProvider>
            <AuthProvider>
              {/* Inside AuthProvider: reconnecting flushes queued work, which needs a token. */}
              <ConnectivityProvider>
                <StatusBar style="dark" />
                <RootNavigator />
              </ConnectivityProvider>
            </AuthProvider>
          </ConfirmProvider>
        </ToastProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

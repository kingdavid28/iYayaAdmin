import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {Provider as PaperProvider} from 'react-native-paper';
import FlashMessage from 'react-native-flash-message';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {AuthProvider} from './src/contexts/AuthContext';
import {OrganizationProvider} from './src/contexts/OrganizationContext';
import {AppNavigator} from './src/navigation/AppNavigator';

export default function App() {
  return (
    <AuthProvider>
      <OrganizationProvider>
        <PaperProvider>
          <SafeAreaProvider>
            <NavigationContainer>
              <AppNavigator />
              <FlashMessage position="top" />
            </NavigationContainer>
          </SafeAreaProvider>
        </PaperProvider>
      </OrganizationProvider>
    </AuthProvider>
  );
}
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import Constants from 'expo-constants';
import api from '../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

WebBrowser.maybeCompleteAuthSession();

const webClientId = Constants.expoConfig?.extra?.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '331902106096-hii2m9gobtqlbrf5tnjiga0bkmaklek7.apps.googleusercontent.com';
const androidClientId = Constants.expoConfig?.extra?.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '331902106096-c760a65priggnn6jvmlv0bvesc3vos16.apps.googleusercontent.com';
const iosClientId = Constants.expoConfig?.extra?.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '331902106096-cbtatvcvva8pheag3c992dpskihrm324.apps.googleusercontent.com';

export const useGoogleAuth = () => {
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId,
    androidClientId,
    iosClientId,
    // Use web client ID as fallback for iOS
    expoClientId: webClientId,
  });

  return { request, response, promptAsync };
};

export const googleAuthService = {
  async processAuthResponse(response: any) {
    try {
      if (response?.type === 'success') {
        const { authentication } = response;
        
        // Get user info from Google
        const userInfoResponse = await fetch(
          'https://www.googleapis.com/userinfo/v2/me',
          {
            headers: { Authorization: `Bearer ${authentication?.accessToken}` },
          }
        );
        const userInfo = await userInfoResponse.json();
        
        // Send to backend
        const backendResponse = await api.post('/auth/google', {
          idToken: authentication?.idToken,
          accessToken: authentication?.accessToken,
          email: userInfo.email,
          name: userInfo.name,
          profileImage: userInfo.picture,
        });
        
        if (backendResponse.data.token) {
          await AsyncStorage.setItem('authToken', backendResponse.data.token);
        }
        
        return backendResponse.data;
      }
      throw new Error('Authentication cancelled or failed');
    } catch (error) {
      console.error('Google sign-in error:', error);
      throw error;
    }
  },
};

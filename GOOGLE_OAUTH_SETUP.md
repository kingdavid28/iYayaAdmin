# Google OAuth Setup Guide

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a project** → **New Project**
3. Enter project name: `iYaya Admin`
4. Click **Create**

## Step 2: Enable Google Sign-In API

1. In the left sidebar, click **APIs & Services** → **Library**
2. Search for "Google Sign-In API" or "Google+ API"
3. Click on it and press **Enable**

## Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **External** (for public apps) or **Internal** (for organization only)
3. Click **Create**
4. Fill in required fields:
   - **App name**: iYaya Admin
   - **User support email**: your email
   - **Developer contact email**: your email
5. Click **Save and Continue**
6. Skip **Scopes** (click Save and Continue)
7. Add test users if needed
8. Click **Save and Continue**

## Step 4: Create OAuth Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Select **Application type**:

### For Web Application:
- **Application type**: Web application
- **Name**: iYaya Web Client
- **Authorized JavaScript origins**: 
  - `http://localhost:19006`
  - `https://i-yaya-admin.vercel.app`
- **Authorized redirect URIs**:
  - `http://localhost:19006/auth/callback`
  - `https://i-yaya-admin.vercel.app/auth/callback`
- Click **Create**
- Copy **Client ID** and **Client Secret**

### For Android:
- **Application type**: Android
- **Name**: iYaya Android
- **Package name**: `com.iyayaadmin` (from your app.json)
- **SHA-1 certificate fingerprint**: Get it by running:
  ```bash
  cd android
  ./gradlew signingReport
  ```
  Copy the SHA-1 from the output
- Click **Create**
- Copy **Client ID**

### For iOS:
- **Application type**: iOS
- **Name**: iYaya iOS
- **Bundle ID**: `com.iyayaadmin` (from your app.json)
- Click **Create**
- Copy **Client ID**

## Step 5: Install React Native Google Sign-In

```bash
npm install @react-native-google-signin/google-signin
```

### For Android:
No additional setup needed with Expo.

### For iOS:
```bash
cd ios && pod install && cd ..
```

## Step 6: Configure Your App

### Update `app.json`:
```json
{
  "expo": {
    "android": {
      "googleServicesFile": "./google-services.json",
      "config": {
        "googleSignIn": {
          "apiKey": "YOUR_ANDROID_API_KEY",
          "certificateHash": "YOUR_SHA1_HASH"
        }
      }
    },
    "ios": {
      "googleServicesFile": "./GoogleService-Info.plist",
      "config": {
        "googleSignIn": {
          "reservedClientId": "YOUR_IOS_CLIENT_ID"
        }
      }
    }
  }
}
```

### Update `.env`:
```env
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your_web_client_id_here
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=your_android_client_id_here
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your_ios_client_id_here
```

## Step 7: Implement Google Sign-In in Your App

Create `src/services/googleAuthService.ts`:

```typescript
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import Constants from 'expo-constants';
import api from '../config/api';

GoogleSignin.configure({
  webClientId: Constants.expoConfig?.extra?.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  offlineAccess: true,
  forceCodeForRefreshToken: true,
});

export const googleAuthService = {
  async signIn() {
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      
      // Send to backend
      const response = await api.post('/auth/google', {
        idToken: userInfo.idToken,
        email: userInfo.user.email,
        name: userInfo.user.name,
        profileImage: userInfo.user.photo,
      });
      
      return response.data;
    } catch (error) {
      console.error('Google sign-in error:', error);
      throw error;
    }
  },

  async signOut() {
    try {
      await GoogleSignin.signOut();
    } catch (error) {
      console.error('Google sign-out error:', error);
    }
  },

  async getCurrentUser() {
    try {
      const userInfo = await GoogleSignin.signInSilently();
      return userInfo;
    } catch (error) {
      return null;
    }
  },
};
```

## Step 8: Add Google Sign-In Button to LoginScreen

Update `src/screens/auth/LoginScreen.tsx`:

```typescript
import { googleAuthService } from '../../services/googleAuthService';

// Inside your component:
const handleGoogleSignIn = async () => {
  try {
    setLoading(true);
    const result = await googleAuthService.signIn();
    
    // Store token
    await AsyncStorage.setItem('authToken', result.token);
    
    // Navigate or update context
    // Your auth context will handle the rest
  } catch (error) {
    Alert.alert('Error', 'Google sign-in failed');
  } finally {
    setLoading(false);
  }
};

// Add button in your JSX:
<Button
  mode="outlined"
  onPress={handleGoogleSignIn}
  icon="google"
  style={styles.googleButton}
>
  Sign in with Google
</Button>
```

## Step 9: Test Your Implementation

### Test on Web:
```bash
npm run web
```

### Test on Android:
```bash
npm run android
```

### Test on iOS:
```bash
npm run ios
```

## Troubleshooting

### Error: "Developer Error" or "API not enabled"
- Make sure Google Sign-In API is enabled in Google Cloud Console
- Wait 5-10 minutes after enabling the API

### Error: "DEVELOPER_ERROR" on Android
- Check SHA-1 certificate fingerprint matches
- Verify package name matches exactly
- Rebuild the app after configuration changes

### Error: "Sign in failed" on iOS
- Verify Bundle ID matches
- Check iOS Client ID is correct
- Run `pod install` after configuration

### Error: "Invalid client" 
- Double-check all Client IDs are correct
- Ensure OAuth consent screen is configured
- Add your email as a test user if using External user type

## Security Best Practices

1. **Never commit credentials** - Use environment variables
2. **Restrict API keys** - Set application restrictions in Google Cloud Console
3. **Use HTTPS** - Always use HTTPS in production
4. **Validate tokens** - Backend should verify Google ID tokens
5. **Rotate secrets** - Periodically rotate client secrets

## Production Checklist

- [ ] OAuth consent screen published (not in testing mode)
- [ ] Production domains added to authorized origins
- [ ] API keys restricted by application
- [ ] Environment variables set in production
- [ ] Test with real users
- [ ] Monitor Google Cloud Console for errors
- [ ] Set up error logging

## Support Links

- [Google Sign-In Documentation](https://developers.google.com/identity/sign-in/web/sign-in)
- [React Native Google Sign-In](https://github.com/react-native-google-signin/google-signin)
- [Google Cloud Console](https://console.cloud.google.com/)
- [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)

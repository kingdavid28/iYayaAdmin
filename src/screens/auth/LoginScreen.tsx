import React, {useState, useContext} from 'react';
import {
  View,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Card,
} from 'react-native-paper';
import {AuthContext} from '../../contexts/AuthContext';
import {useGoogleAuth, googleAuthService} from '../../services/googleAuthService';
import {useEffect} from 'react';

interface LoginScreenProps {
  navigation: any;
}

export default function LoginScreen({navigation}: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const {login} = useContext(AuthContext);
  const {request, response, promptAsync} = useGoogleAuth();

  useEffect(() => {
    if (response) {
      handleGoogleResponse();
    }
  }, [response]);

  const handleGoogleResponse = async () => {
    setLoading(true);
    try {
      await googleAuthService.processAuthResponse(response);
    } catch (error: any) {
      Alert.alert('Error', 'Google sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await promptAsync();
    } catch (error: any) {
      Alert.alert('Error', 'Could not start Google sign-in.');
    }
  };

  const handleLogin = async () => {
    // Basic front-end validation for empty inputs
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing information', 'Enter both email and password to continue.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (error: any) {
      const message = typeof error?.message === 'string' ? error.message : 'Login failed.';
      if (message.toLowerCase().includes('invalid login credentials')) {
        Alert.alert('Invalid credentials', 'Email or password is incorrect. Please try again or reset your password.');
      } else {
        Alert.alert('Login Failed', message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.content}>
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="headlineMedium" style={styles.title}>
                iYaya Admin
              </Text>
              <Text variant="bodyLarge" style={styles.subtitle}>
                Sign in to your admin account
              </Text>

              <TextInput
                label="Email"
                value={email}
                onChangeText={setEmail}
                mode="outlined"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                style={styles.input}
                disabled={loading}
                // @ts-ignore - Web-only props
                id="email"
                name="email"
              />

              <TextInput
                label="Password"
                value={password}
                onChangeText={setPassword}
                mode="outlined"
                secureTextEntry
                autoComplete="current-password"
                textContentType="password"
                style={styles.input}
                disabled={loading}
                // @ts-ignore - Web-only props
                id="password"
                name="password"
              />

              <Button
                mode="contained"
                onPress={handleLogin}
                style={styles.button}
                disabled={loading}
                loading={loading}>
                {loading ? 'Signing In...' : 'Sign In'}
              </Button>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              <Button
                mode="outlined"
                onPress={handleGoogleSignIn}
                icon="google"
                style={styles.googleButton}
                disabled={loading}>
                Sign in with Google
              </Button>

              <Button
                mode="text"
                onPress={() => navigation.navigate('AdminSignup')}
                style={styles.linkButton}
                disabled={loading}>
                Don't have an account? Create Admin Account
              </Button>
            </Card.Content>
          </Card>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  card: {
    elevation: 4,
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
    color: '#3f51b5',
    fontWeight: 'bold',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 32,
    color: '#666',
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginTop: 16,
    paddingVertical: 8,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd',
  },
  dividerText: {
    marginHorizontal: 10,
    color: '#666',
    fontSize: 14,
  },
  googleButton: {
    borderColor: '#4285f4',
    borderWidth: 1,
  },
  linkButton: {
    marginTop: 16,
  },
});

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
  SegmentedButtons,
} from 'react-native-paper';
import { AuthContext } from '../../contexts/AuthContext';

interface AdminSignupScreenProps {
  navigation: any;
}

type AdminRole = 'admin' | 'superadmin';

interface AdminSignupFormState {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: AdminRole;
}

// Authorized Super Admin email
const SUPER_ADMIN_EMAIL = 'reycelrcentino@gmail.com';

export default function AdminSignupScreen({navigation}: AdminSignupScreenProps) {
  const [formData, setFormData] = useState<AdminSignupFormState>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'admin',
  });
  const [loading, setLoading] = useState(false);
  const { signup } = useContext(AuthContext);

  const handleSignup = async () => {
    // Validation
    if (!formData.name || !formData.email || !formData.password || !formData.confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    // Super Admin email restriction
    if (formData.role === 'superadmin' && formData.email !== SUPER_ADMIN_EMAIL) {
      Alert.alert(
        'Access Denied', 
        'Super Admin accounts can only be created by the authorized administrator. Please contact the system administrator or create a regular Admin account instead.',
        [
          {
            text: 'Create Admin Instead',
            onPress: () => updateFormData('role', 'admin'),
          },
          {
            text: 'OK',
            style: 'cancel',
          },
        ]
      );
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters long');
      return;
    }

    setLoading(true);
    try {
      // Use centralized API service instead of hardcoded localhost
      const payload = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        userType: formData.role,
      };

      // Use Firebase signup via AuthContext instead of raw fetch
      await signup(payload);

      Alert.alert(
        'Success',
        `${formData.role === 'superadmin' ? 'Super Admin' : 'Admin'} account created successfully!`,
        [
          {
            text: 'Go to Login',
            onPress: () => navigation.navigate('Login'),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Signup Failed', error.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const updateFormData = <K extends keyof AdminSignupFormState>(
    field: K,
    value: AdminSignupFormState[K],
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
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
                Create Admin Account
              </Text>
              <Text variant="bodyLarge" style={styles.subtitle}>
                Register as an administrator
              </Text>

              <TextInput
                label="Full Name"
                value={formData.name}
                onChangeText={(value) => updateFormData('name', value)}
                mode="outlined"
                autoComplete="name"
                textContentType="name"
                style={styles.input}
                disabled={loading}
                // @ts-ignore - Web-only props
                id="name"
                name="name"
              />

              <TextInput
                label="Email"
                value={formData.email}
                onChangeText={(value) => updateFormData('email', value)}
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

              <Text variant="bodyMedium" style={styles.roleLabel}>
                Account Type
              </Text>
              <SegmentedButtons
                value={formData.role}
                onValueChange={(value) => updateFormData('role', value as AdminRole)}
                buttons={[
                  {
                    value: 'admin',
                    label: 'Admin',
                    icon: 'account-supervisor',
                  },
                  {
                    value: 'superadmin',
                    label: 'Super Admin',
                    icon: 'account-star',
                  },
                ]}
                style={styles.segmentedButtons}
              />

              <TextInput
                label="Password"
                value={formData.password}
                onChangeText={(value) => updateFormData('password', value)}
                mode="outlined"
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
                style={styles.input}
                disabled={loading}
                // @ts-ignore - Web-only props
                id="password"
                name="password"
              />

              <TextInput
                label="Confirm Password"
                value={formData.confirmPassword}
                onChangeText={(value) => updateFormData('confirmPassword', value)}
                mode="outlined"
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
                style={styles.input}
                disabled={loading}
                // @ts-ignore - Web-only props
                id="confirmPassword"
                name="confirmPassword"
              />

              <Button
                mode="contained"
                onPress={handleSignup}
                style={styles.button}
                disabled={loading}
                loading={loading}>
                {loading ? 'Creating Account...' : 'Create Account'}
              </Button>

              <Button
                mode="text"
                onPress={() => navigation.navigate('Login')}
                style={styles.linkButton}
                disabled={loading}>
                Already have an account? Sign In
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
    // Use boxShadow on web to avoid deprecation warnings
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      },
    }),
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
  roleLabel: {
    marginBottom: 8,
    marginTop: 8,
    color: '#666',
  },
  segmentedButtons: {
    marginBottom: 16,
  },
  button: {
    marginTop: 16,
    paddingVertical: 8,
  },
  linkButton: {
    marginTop: 8,
  },
});

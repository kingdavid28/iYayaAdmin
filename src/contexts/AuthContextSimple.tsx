// Simplified AuthContext for React 19 compatibility using Supabase
import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (userData: SignupData) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  loading: boolean;
}

interface SignupData {
  name: string;
  email: string;
  password: string;
  role: User['role'];
  userType: string;
}

// Create context with default values
export const AuthContext = React.createContext<AuthContextType>({
  user: null,
  login: async () => {},
  signup: async () => ({ success: false, message: '' }),
  logout: async () => {},
  loading: true,
});

interface AuthProviderProps {
  children: React.ReactNode;
}

// Simple state management without hooks
let currentUser: User | null = null;
let isLoading = true;
let listeners: Array<() => void> = [];

const ALLOWED_ADMIN_ROLES: User['role'][] = ['admin', 'superadmin'];

const notifyListeners = () => {
  listeners.forEach(listener => listener());
};

const setUser = (user: User | null) => {
  currentUser = user;
  notifyListeners();
};

const setLoading = (loading: boolean) => {
  isLoading = loading;
  notifyListeners();
};

const buildUserFromProfile = (authUser: any, profile: any | null): User => {
  const email = authUser.email ?? profile?.email ?? '';
  const nameFromProfile = profile?.name as string | undefined;
  const metadataName = (authUser.user_metadata?.full_name as string | undefined) ?? (email ? email.split('@')[0] : undefined);
  const resolvedName = nameFromProfile || metadataName || 'Admin User';
  const roleFromProfile = profile?.role as User['role'] | undefined;
  const metadataRole = authUser.user_metadata?.role as User['role'] | undefined;
  const resolvedRole: User['role'] = roleFromProfile || metadataRole || 'admin';

  return {
    id: authUser.id,
    email,
    name: resolvedName,
    role: resolvedRole,
    userType: profile?.userType || resolvedRole,
    status: (profile?.status as User['status']) ?? 'active',
    phone: profile?.phone ?? undefined,
    profileImage: profile?.profile_image ?? undefined,
    createdAt: profile?.created_at ?? authUser.created_at ?? new Date().toISOString(),
    lastLogin: new Date().toISOString(),
    permissions: (authUser.user_metadata?.permissions as string[] | undefined) ?? [],
  };
};

const syncProfile = async (authUser: any) => {
  try {
    const { data: profile, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    let resolvedProfile = profile ?? null;

    if (!profile && !error) {
      const payload = {
        email: authUser.email,
        name: (authUser.user_metadata?.full_name as string | undefined) ?? authUser.email ?? 'Admin User',
        role: (authUser.user_metadata?.role as User['role'] | undefined) ?? 'admin',
        status: 'active',
      };

      const { data: insertedProfile, error: insertError } = await supabase
        .from('users')
        .insert(payload)
        .select('*')
        .single();

      if (insertError) {
        console.warn('Failed to create Supabase user profile:', insertError);
      } else {
        resolvedProfile = insertedProfile;
      }
    } else if (error) {
      console.warn('Failed to load Supabase profile:', error);
    }

    const normalizedUser = buildUserFromProfile(authUser, resolvedProfile);

    if (!ALLOWED_ADMIN_ROLES.includes(normalizedUser.role)) {
      console.warn('[AuthSimple] Blocked sign-in for disallowed role:', normalizedUser.role);
      await supabase.auth.signOut();
      setUser(null);
      await AsyncStorage.removeItem('userData');
      throw new Error('Access restricted: only admin accounts may sign in.');
    }

    setUser(normalizedUser);
    await AsyncStorage.setItem('userData', JSON.stringify(normalizedUser));
  } catch (profileError) {
    console.error('❌ Unable to sync Supabase profile:', profileError);
    setUser(null);
    await AsyncStorage.removeItem('userData');
  }
};

// Initialize Supabase Auth
const initializeSupabaseAuth = async () => {
  try {
    console.log('🔄 Initializing Supabase Auth...');

    // Check for existing session
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;

    if (session?.user) {
      await syncProfile(session.user);
    } else {
      // Try to load from cached user data
      const cached = await AsyncStorage.getItem('userData');
      if (cached) {
        const parsed: User = JSON.parse(cached);
        setUser(parsed);
      }
    }

    setLoading(false);

    // Listen for auth state changes
    supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Auth state changed:', event, session?.user ? 'User logged in' : 'User logged out');

      if (session?.user) {
        try {
          await syncProfile(session.user);
        } catch (syncError) {
          console.warn('[AuthSimple] Failed to sync profile during initialization:', syncError);
          await supabase.auth.signOut();
        }
      } else {
        setUser(null);
        await AsyncStorage.removeItem('userData');
      }

      setLoading(false);
    });
  } catch (error) {
    console.error('❌ Supabase Auth initialization failed:', error);
    setLoading(false);
  }
};

const login = async (email: string, password: string) => {
  try {
    console.log('🔐 Attempting Supabase login for:', email);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.session?.user) {
      console.error('❌ Supabase login failed:', error);
      throw new Error(error?.message ?? 'Login failed');
    }

    console.log('✅ Supabase login successful:', data.session.user.id);
    await syncProfile(data.session.user);
  } catch (error: any) {
    console.error('❌ Supabase login failed:', error);

    // Provide user-friendly error messages
    let errorMessage = 'Login failed';
    if (error.message?.includes('Invalid login credentials')) {
      errorMessage = 'Invalid email or password';
    } else if (error.message?.includes('Email not confirmed')) {
      errorMessage = 'Please check your email and confirm your account';
    } else if (error.message) {
      errorMessage = error.message;
    }

    throw new Error(errorMessage);
  }
};

const signup = async (userData: SignupData) => {
  try {
    console.log('📝 Attempting Supabase signup for:', userData.email);

    // Super Admin email restriction - CRITICAL SECURITY CHECK
    const SUPER_ADMIN_EMAIL = 'reycelrcentino@gmail.com';
    if (userData.role === 'superadmin' && userData.email.toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase()) {
      throw new Error('Super Admin accounts can only be created by the authorized administrator.');
    }

    if (!ALLOWED_ADMIN_ROLES.includes(userData.role)) {
      throw new Error('Only admin accounts can be created in this application.');
    }

    const { data, error } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
      options: {
        data: {
          role: userData.role,
          name: userData.name,
        },
      },
    });

    if (error) {
      console.error('❌ Supabase signup failed:', error);
      throw new Error(error.message);
    }

    const authUser = data.user;

    if (authUser) {
      const { error: insertError } = await supabase.from('users').insert({
        email: userData.email,
        name: userData.name,
        role: userData.role,
        status: 'active',
      });

      if (insertError && insertError.code !== '23505') {
        console.warn('Supabase user profile insert failed (continuing):', insertError.message);
      }

      await syncProfile(authUser);
    }

    const needsEmailVerification = !data.session;

    return {
      success: true,
      message: needsEmailVerification
        ? 'Account created. Please check your email to confirm your address.'
        : 'Account created successfully.',
    };
  } catch (error: any) {
    console.error('❌ Supabase signup failed:', error);

    // Provide user-friendly error messages
    let errorMessage = 'Signup failed';
    if (error.message?.includes('User already registered')) {
      errorMessage = 'Email already exists';
    } else if (error.message?.includes('Password should be')) {
      errorMessage = 'Password is too weak. Please choose a stronger password';
    } else if (error.message) {
      errorMessage = error.message;
    }

    throw new Error(errorMessage);
  }
};

const logout = async () => {
  try {
    console.log('🚪 Logging out...');
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('❌ Supabase logout failed:', error);
    }

    setUser(null);
    await AsyncStorage.removeItem('userData');
    console.log('✅ Logout successful');
  } catch (error) {
    console.error('❌ Logout error:', error);
    // Even if logout fails, clear local state
    await AsyncStorage.removeItem('userData');
    setUser(null);
  }
};

// Initialize Supabase when module loads
initializeSupabaseAuth();

// Simple class component to avoid hooks
class AuthProviderClass extends React.Component<AuthProviderProps> {
  private forceUpdateBound: () => void;

  constructor(props: AuthProviderProps) {
    super(props);
    this.forceUpdateBound = this.forceUpdate.bind(this);
  }

  componentDidMount() {
    listeners.push(this.forceUpdateBound);
  }

  componentWillUnmount() {
    listeners = listeners.filter(l => l !== this.forceUpdateBound);
  }

  render() {
    const value: AuthContextType = {
      user: currentUser,
      login,
      signup,
      logout,
      loading: isLoading,
    };

    return React.createElement(AuthContext.Provider, { value }, this.props.children);
  }
}

export const AuthProvider = AuthProviderClass;

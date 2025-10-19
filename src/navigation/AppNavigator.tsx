import React, {useContext} from 'react';
import {createStackNavigator} from '@react-navigation/stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {View, ActivityIndicator, StyleSheet} from 'react-native';
import {AuthContext} from '../contexts/AuthContext';
import LoginScreen from '../screens/auth/LoginScreen';
import AdminSignupScreen from '../screens/auth/AdminSignupScreen';
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import UsersScreen from '../screens/users/UsersScreen';
import UserDetailScreen from '../screens/users/UserDetailScreen';
import JobsScreen from '../screens/jobs/JobsScreen';
import JobDetailScreen from '../screens/jobs/JobDetailScreen';
import BookingsScreen from '../screens/bookings/BookingsScreen';
import BookingDetailScreen from '../screens/bookings/BookingDetailScreen';
import AuditLogsScreen from '../screens/audit/AuditLogsScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import ManagementHubScreen from '../screens/management/ManagementHubScreen';
import ReviewsManagementScreen from '../screens/management/ReviewsManagementScreen';
import ChildrenManagementScreen from '../screens/management/ChildrenManagementScreen';
import NotificationsManagementScreen from '../screens/management/NotificationsManagementScreen';
import AnalyticsManagementScreen from '../screens/management/AnalyticsManagementScreen';
import PaymentsManagementScreen from '../screens/management/PaymentsManagementScreen';
import {Icon} from 'react-native-elements';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();
const ManagementStack = createStackNavigator();

function ManagementStackNavigator() {
  return (
    <ManagementStack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#3f51b5',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}>
      <ManagementStack.Screen
        name="ManagementHub"
        component={ManagementHubScreen}
        options={{title: 'Management Center'}}
      />
      <ManagementStack.Screen
        name="ReviewsManagement"
        component={ReviewsManagementScreen}
        options={{title: 'Reviews Management'}}
      />
      <ManagementStack.Screen
        name="ChildrenManagement"
        component={ChildrenManagementScreen}
        options={{title: 'Children Management'}}
      />
      <ManagementStack.Screen
        name="NotificationsManagement"
        component={NotificationsManagementScreen}
        options={{title: 'Notifications'}}
      />
      <ManagementStack.Screen
        name="AnalyticsManagement"
        component={AnalyticsManagementScreen}
        options={{title: 'Analytics & Insights'}}
      />
      <ManagementStack.Screen
        name="PaymentsManagement"
        component={PaymentsManagementScreen}
        options={{title: 'Payments Management'}}
      />
    </ManagementStack.Navigator>
  );
}

function AdminTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        tabBarIcon: ({focused, color, size}) => {
          let iconName: string;

          switch (route.name) {
            case 'Dashboard':
              iconName = 'dashboard';
              break;
            case 'Users':
              iconName = 'people';
              break;
            case 'Jobs':
              iconName = 'work';
              break;
            case 'Bookings':
              iconName = 'calendar-today';
              break;
            case 'Messages':
              iconName = 'message';
              break;
            case 'Audit':
              iconName = 'history';
              break;
            case 'Management':
              iconName = 'admin-panel-settings';
              break;
            case 'Settings':
              iconName = 'settings';
              break;
            default:
              iconName = 'help-outline';
              break;
          }

          return <Icon name={iconName} size={size} color={color} type="material" />;
        },
        tabBarActiveTintColor: '#3f51b5',
        tabBarInactiveTintColor: 'gray',
        headerStyle: {
          backgroundColor: '#3f51b5',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}>
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Users" component={UsersScreen} />
      <Tab.Screen name="Jobs" component={JobsScreen} />
      <Tab.Screen name="Bookings" component={BookingsScreen} />
      <Tab.Screen name="Messages" component={DashboardScreen} options={{ tabBarButton: () => null }} />
      <Tab.Screen name="Audit" component={AuditLogsScreen} />
      <Tab.Screen name="Management" component={ManagementStackNavigator} options={{headerShown: false}} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const {user, loading} = useContext(AuthContext);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3f51b5" />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#3f51b5',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}>
      {user ? (
        <>
          <Stack.Screen
            name="Main"
            component={AdminTabNavigator}
            options={{headerShown: false}}
          />
          <Stack.Screen name="UserDetail" component={UserDetailScreen} />
          <Stack.Screen name="JobDetail" component={JobDetailScreen} />
          <Stack.Screen name="BookingDetail" component={BookingDetailScreen} />
        </>
      ) : (
        <>
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{headerShown: false}}
          />
          <Stack.Screen
            name="AdminSignup"
            component={AdminSignupScreen}
            options={{headerShown: false}}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
  },
});

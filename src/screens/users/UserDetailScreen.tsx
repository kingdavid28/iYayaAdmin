import React, {useEffect, useState} from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import {
  Text,
  Card,
  Button,
  Chip,
  ActivityIndicator,
  useTheme,
  Portal,
  Dialog,
  TextInput,
} from 'react-native-paper';
import {Icon} from 'react-native-elements';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {adminApi} from '../../services/apiService';
import {User} from '../../types';
import {SkeletonBlock, SkeletonCircle} from '../../components/skeletons/Skeleton';

type RootStackParamList = {
  UserDetail: { userId: string };
};

type UserDetailScreenRouteProp = RouteProp<RootStackParamList, 'UserDetail'>;
type UserDetailScreenNavigationProp = StackNavigationProp<RootStackParamList>;

export default function UserDetailScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusDialogVisible, setStatusDialogVisible] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [updating, setUpdating] = useState(false);

  const navigation = useNavigation<UserDetailScreenNavigationProp>();
  const route = useRoute<UserDetailScreenRouteProp>();
  const theme = useTheme();

  const { userId } = route.params;

  const statusColors = {
    active: '#4caf50',
    suspended: '#ff9800',
    banned: '#f44336',
  };

  const loadUser = async () => {
    try {
      const response = await adminApi.getUserById(userId);
      if (response.success && response.data) {
        const rawUser = response.data as User;
        const normalizedUser: User = {
          ...rawUser,
          userType: rawUser.userType ?? rawUser.role,
        };
        setUser(normalizedUser);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load user details');
      navigation.goBack();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!userId) {
      Alert.alert('Error', 'User ID is missing. Cannot load user details.', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
      return;
    }
    loadUser();
  }, [userId]);

  const onRefresh = () => {
    setRefreshing(true);
    loadUser();
  };

  const handleStatusUpdate = async () => {
    if (!newStatus || !user) return;

    setUpdating(true);
    try {
      await adminApi.updateUserStatus(userId, newStatus, statusReason);
      Alert.alert('Success', `User status updated to ${newStatus}`);
      setStatusDialogVisible(false);
      setNewStatus('');
      setStatusReason('');
      loadUser();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update user status');
    } finally {
      setUpdating(false);
    }
  };

  const showStatusDialog = (status: string) => {
    setNewStatus(status);
    setStatusDialogVisible(true);
  };

  const isInitialLoading = loading && !user;

  if (isInitialLoading) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.skeletonContent}>
        <Card style={styles.headerCard}>
          <Card.Content>
            <View style={styles.skeletonHeader}>
              <SkeletonCircle size={60} />
              <View style={styles.skeletonHeaderInfo}>
                <SkeletonBlock height={22} width="65%" />
                <SkeletonBlock height={16} width="55%" />
                <SkeletonBlock height={14} width="40%" />
              </View>
            </View>
            <View style={styles.skeletonChipRow}>
              <SkeletonBlock height={32} width={110} borderRadius={18} />
              <SkeletonBlock height={32} width={110} borderRadius={18} />
            </View>
          </Card.Content>
        </Card>
        <Card style={styles.detailsCard}>
          <Card.Content>
            <SkeletonBlock height={20} width="50%" borderRadius={6} />
            <View style={styles.skeletonInfoRow}>
              <SkeletonBlock height={16} width="60%" />
            </View>
            <View style={styles.skeletonInfoRow}>
              <SkeletonBlock height={16} width="70%" />
            </View>
            <View style={styles.skeletonInfoRow}>
              <SkeletonBlock height={16} width="55%" />
            </View>
          </Card.Content>
        </Card>
        <Card style={styles.actionsCard}>
          <Card.Content>
            <SkeletonBlock height={20} width="40%" borderRadius={6} />
            <View style={styles.skeletonActionButtons}>
              <SkeletonBlock height={40} width="60%" borderRadius={10} />
              <SkeletonBlock height={40} width="60%" borderRadius={10} />
              <SkeletonBlock height={40} width="60%" borderRadius={10} />
            </View>
          </Card.Content>
        </Card>
      </ScrollView>
    );
  }

  if (!user) {
    return (
      <View style={styles.errorContainer}>
        <Text>User not found</Text>
        <Button onPress={() => navigation.goBack()}>Go Back</Button>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }>
      <View style={styles.content}>
        <Card style={styles.headerCard}>
          <Card.Content>
            <View style={styles.userHeader}>
              <View style={styles.userAvatar}>
                <Text style={styles.avatarText}>
                  {user.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.userInfo}>
                <Text variant="headlineMedium" style={styles.userName}>
                  {user.name}
                </Text>
                <Text variant="bodyLarge" style={styles.userEmail}>
                  {user.email}
                </Text>
                <View style={styles.userMeta}>
                  <Chip
                    style={[
                      styles.statusChip,
                      { backgroundColor: statusColors[user.status as keyof typeof statusColors] || '#666' }
                    ]}
                    textStyle={{ color: 'white' }}>
                    {user.status}
                  </Chip>
                  <Chip
                    mode="outlined"
                    style={styles.typeChip}
                    textStyle={styles.typeChipText}
                    compact
                  >
                    {user.userType ?? user.role ?? 'Unknown'}
                  </Chip>
                </View>
              </View>
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.detailsCard}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.sectionTitle}>
              User Information
            </Text>

            {user.phone && (
              <View style={styles.infoRow}>
                <Icon name="phone" type="material" color="#666" size={20} />
                <Text style={styles.infoText}>{user.phone}</Text>
              </View>
            )}

            <View style={styles.infoRow}>
              <Icon name="calendar-today" type="material" color="#666" size={20} />
              <Text style={styles.infoText}>
                Joined {new Date(user.createdAt).toLocaleDateString()}
              </Text>
            </View>

            {user.lastLogin && (
              <View style={styles.infoRow}>
                <Icon name="access-time" type="material" color="#666" size={20} />
                <Text style={styles.infoText}>
                  Last login {new Date(user.lastLogin).toLocaleDateString()}
                </Text>
              </View>
            )}
          </Card.Content>
        </Card>

        <Card style={styles.actionsCard}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.sectionTitle}>
              Actions
            </Text>

            <View style={styles.actionsGrid}>
              {user.status === 'active' && (
                <Button
                  mode="outlined"
                  onPress={() => showStatusDialog('suspended')}
                  style={[styles.actionButton, { borderColor: '#ff9800' }]}
                  textColor="#ff9800">
                  Suspend User
                </Button>
              )}

              {user.status === 'suspended' && (
                <Button
                  mode="outlined"
                  onPress={() => showStatusDialog('active')}
                  style={[styles.actionButton, { borderColor: '#4caf50' }]}
                  textColor="#4caf50">
                  Activate User
                </Button>
              )}

              <Button
                mode="outlined"
                onPress={() => showStatusDialog('banned')}
                style={[styles.actionButton, { borderColor: '#f44336' }]}
                textColor="#f44336">
                Ban User
              </Button>
            </View>
          </Card.Content>
        </Card>
      </View>

      <Portal>
        <Dialog
          visible={statusDialogVisible}
          onDismiss={() => setStatusDialogVisible(false)}>
          <Dialog.Title>Update User Status</Dialog.Title>
          <Dialog.Content>
            <Text>Change user status to: {newStatus}</Text>
            <TextInput
              label="Reason (optional)"
              value={statusReason}
              onChangeText={setStatusReason}
              style={styles.reasonInput}
              multiline
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setStatusDialogVisible(false)}>
              Cancel
            </Button>
            <Button
              onPress={handleStatusUpdate}
              loading={updating}
              disabled={updating}>
              Update
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
  },
  skeletonContent: {
    padding: 16,
    gap: 16,
  },
  skeletonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 12,
  },
  skeletonHeaderInfo: {
    flex: 1,
    gap: 8,
  },
  skeletonChipRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  skeletonInfoRow: {
    marginTop: 16,
  },
  skeletonActionButtons: {
    marginTop: 16,
    gap: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    padding: 16,
  },
  headerCard: {
    marginBottom: 16,
    elevation: 4,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#3f51b5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userEmail: {
    color: '#666',
    marginBottom: 8,
  },
  userMeta: {
    flexDirection: 'row',
    gap: 8,
  },
  statusChip: {
    height: 34,
    width: 75,
    },
  typeChip: {
    minWidth: 75,
    minHeight: 32,
    borderRadius: 18,
    borderColor: '#3f51b5',
    justifyContent: 'center',
  },
  typeChipText: {
    color: '#3f51b5',
    fontWeight: '600',
    textTransform: 'capitalize',
    letterSpacing: 0.2,
  },
  detailsCard: {
    marginBottom: 16,
    elevation: 2,
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#3f51b5',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoText: {
    marginLeft: 12,
    flex: 1,
  },
  actionsCard: {
    marginBottom: 16,
    elevation: 2,
  },
  actionsGrid: {
    gap: 12,
  },
  actionButton: {
    borderWidth: 1,
  },
  reasonInput: {
    marginTop: 16,
  },
});

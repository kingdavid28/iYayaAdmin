import React from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Alert,
  ScrollView,
  Animated,
  TouchableOpacity
} from 'react-native';
import {
  Text,
  FAB,
  Searchbar,
  Chip,
  useTheme,
  Avatar,
  Badge,
  Surface,
  Button,
  Menu,
  Divider,
  Portal,
  Dialog,
  TextInput,
  HelperText,
  Checkbox,
  IconButton,
  RadioButton
} from 'react-native-paper';
import {Icon} from 'react-native-elements';
import {useNavigation} from '@react-navigation/native';
// import profilePlaceholder from '../../../assets/profile-placeholder.png'; // Temporarily disabled due to corruption
const profilePlaceholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDEyOCAxMjgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiBmaWxsPSIjRjVGNUY1Ii8+CjxjaXJjbGUgY3g9IjY0IiBjeT0iNDgiIHI9IjIwIiBmaWxsPSIjQ0NDQ0NDIi8+CjxwYXRoIGQ9Ik0zMiA5NkM0MCA4OCA1NiA4MCA2NCA4MFM4OCA4OCA5NiA5NlM4OCAxMTIgNjQgMTEyUzMyIDEwNCAzMiA5NloiIGZpbGw9IiNDQ0NDQ0QiLz4KPC9zdmc+';
import {Platform} from 'react-native';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {StackNavigationProp} from '@react-navigation/stack';
import {User} from '../../types';
import {
  fetchUsers,
  updateUserStatus,
  createUser,
  updateUser,
  deleteUser,
  bulkUpdateUserStatus,
  type FetchUsersOptions,
  type CreateUserPayload,
  type UpdateUserPayload
} from '../../services/usersService';
import {SkeletonBlock, SkeletonCircle} from '../../components/skeletons/Skeleton';

const STATUS_CONFIG = {
  active: { color: '#4caf50', label: 'Active', icon: 'check-circle' },
  suspended: { color: '#ff9800', label: 'Suspended', icon: 'pause-circle' },
  banned: { color: '#f44336', label: 'Banned', icon: 'close-circle' },
  inactive: { color: '#9e9e9e', label: 'Inactive', icon: 'minus-circle' }
} as const;

type StatusKey = keyof typeof STATUS_CONFIG;

type RootStackParamList = {
  UserDetail: { userId: string };
};

type UsersScreenNavigationProp = StackNavigationProp<RootStackParamList>;

export default function UsersScreen() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserType, setSelectedUserType] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [userStats, setUserStats] = useState({total: 0, active: 0, suspended: 0, banned: 0, inactive: 0});
  const [menuUserId, setMenuUserId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [statusTarget, setStatusTarget] = useState<{ user: User; status: StatusKey } | null>(null);
  const [statusDialogVisible, setStatusDialogVisible] = useState(false);
  const [statusReason, setStatusReason] = useState('');
  const [bulkStatusDialogVisible, setBulkStatusDialogVisible] = useState(false);
  const [bulkStatusTarget, setBulkStatusTarget] = useState<StatusKey>('active');
  const [userFormVisible, setUserFormVisible] = useState(false);
  const [userFormMode, setUserFormMode] = useState<'create' | 'edit'>('create');
  const [userFormLoading, setUserFormLoading] = useState(false);
  const [userFormErrors, setUserFormErrors] = useState<{ email?: string; password?: string }>({});
  const [userFormData, setUserFormData] = useState<UserFormState>({
    email: '',
    password: '',
    role: 'parent',
    name: '',
    phone: '',
    status: 'active',
    reason: ''
  });
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [targetUser, setTargetUser] = useState<User | null>(null);

  const navigation = useNavigation<UsersScreenNavigationProp>();
  const theme = useTheme();

  const userTypes = [
    { label: 'All Users', value: 'all', icon: 'account-group' },
    { label: 'Parents', value: 'parent', icon: 'baby-face-outline' },
    { label: 'Caregivers', value: 'caregiver', icon: 'account-heart' },
    { label: 'Admins', value: 'admin', icon: 'shield-account' },
    { label: 'Super Admins', value: 'superadmin', icon: 'crown' },
  ];

  type UserFormState = Partial<CreateUserPayload & UpdateUserPayload> & { id?: string };

  const statusOptions = useMemo(() => Object.keys(STATUS_CONFIG) as StatusKey[], []);

  const resetUserForm = useCallback(() => {
    setUserFormData({
      email: '',
      password: '',
      role: 'parent',
      name: '',
      phone: '',
      status: 'active',
      reason: ''
    });
    setUserFormErrors({});
  }, []);

  const loadUsers = useCallback(async (pageNum = 1, refresh = false, overrides: Partial<FetchUsersOptions> = {}) => {
    try {
      if (pageNum === 1 && !refresh) {
        setLoading(true);
      }

      const userTypeFilter = overrides.userType ?? selectedUserType;
      const searchFilter = overrides.search ?? searchQuery;
      const limit = overrides.limit ?? 20;

      const options: FetchUsersOptions = {
        page: pageNum,
        limit,
        userType: userTypeFilter && userTypeFilter !== 'all' ? userTypeFilter : undefined,
        search: searchFilter?.trim() || undefined,
      };

      const { users: fetchedUsers, pagination, stats } = await fetchUsers(options);

      if (refresh || pageNum === 1) {
        setUsers(fetchedUsers);
      } else {
        setUsers(prev => [...prev, ...fetchedUsers]);
      }

      setHasMore(pagination.hasMore);
      setPage(pagination.page);
      setUserStats(stats);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load users');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery, selectedUserType]);

  useEffect(() => {
    loadUsers(1, true);
  }, [loadUsers]);

  const onRefresh = () => {
    setRefreshing(true);
    loadUsers(1, true);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setPage(1);
  };

  const handleUserTypeChange = (userType: string) => {
    setSelectedUserType(userType);
    setPage(1);
    exitSelectionMode();
  };

  const toggleSelection = useCallback((userId: string) => {
    setSelectionMode(true);
    setSelectedUserIds(prev => {
      if (prev.includes(userId)) {
        const next = prev.filter(id => id !== userId);
        if (next.length === 0) {
          setSelectionMode(false);
        }
        return next;
      }
      return [...prev, userId];
    });
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedUserIds([]);
  }, []);

  const openStatusDialog = (user: User, status: StatusKey) => {
    setStatusTarget({ user, status });
    setStatusReason('');
    setStatusDialogVisible(true);
  };

  const confirmStatusUpdate = async () => {
    if (!statusTarget?.user) return;
    try {
      await updateUserStatus(statusTarget.user.id, statusTarget.status, statusReason.trim() || undefined);
      Alert.alert('Success', `Status updated to ${STATUS_CONFIG[statusTarget.status].label}`);
      setStatusDialogVisible(false);
      setStatusTarget(null);
      loadUsers(page, true);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update user status');
    }
  };

  const openBulkStatusDialog = (status: StatusKey) => {
    if (selectedUserIds.length === 0) {
      Alert.alert('No users selected', 'Select at least one user to update status.');
      return;
    }
    setBulkStatusTarget(status);
    setStatusReason('');
    setBulkStatusDialogVisible(true);
  };

  const confirmBulkStatusUpdate = async () => {
    if (selectedUserIds.length === 0) return;
    try {
      await bulkUpdateUserStatus({
        userIds: selectedUserIds,
        status: bulkStatusTarget,
        reason: statusReason.trim() || undefined
      });
      Alert.alert('Success', `Updated ${selectedUserIds.length} users to ${STATUS_CONFIG[bulkStatusTarget].label}`);
      setBulkStatusDialogVisible(false);
      exitSelectionMode();
      loadUsers(1, true);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update user statuses');
    }
  };

  const openUserForm = (mode: 'create' | 'edit', user?: User) => {
    setUserFormMode(mode);
    if (mode === 'edit' && user) {
      setUserFormData({
        id: user.id,
        email: user.email,
        password: '',
        role: user.role,
        name: user.name ?? '',
        phone: user.phone ?? '',
        status: user.status,
        reason: ''
      });
    } else {
      resetUserForm();
    }
    setUserFormErrors({});
    setUserFormVisible(true);
  };

  const validateUserForm = () => {
    const errors: { email?: string; password?: string } = {};
    if (!userFormData.email?.trim()) {
      errors.email = 'Email is required';
    }
    if (userFormMode === 'create') {
      if (!userFormData.password || userFormData.password.trim().length < 8) {
        errors.password = 'Password must be at least 8 characters';
      }
    } else if (userFormData.password && userFormData.password.trim().length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }
    setUserFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const buildCreatePayload = (): CreateUserPayload => ({
    email: userFormData.email!.trim(),
    password: userFormData.password?.trim(),
    role: userFormData.role ?? 'parent',
    name: userFormData.name?.trim() || undefined,
    phone: userFormData.phone?.trim() || undefined,
    status: userFormData.status ?? 'active'
  });

  const buildUpdatePayload = (): UpdateUserPayload => ({
    email: userFormData.email?.trim() || undefined,
    password: userFormData.password?.trim() || undefined,
    role: userFormData.role,
    name: userFormData.name?.trim() || undefined,
    phone: userFormData.phone?.trim() || undefined,
    status: userFormData.status,
    reason: userFormData.reason?.trim() || undefined
  });

  const submitUserForm = async () => {
    if (!validateUserForm()) return;
    setUserFormLoading(true);
    try {
      if (userFormMode === 'create') {
        await createUser(buildCreatePayload());
        Alert.alert('Success', 'User created successfully');
      } else if (userFormData.id) {
        await updateUser(userFormData.id, buildUpdatePayload());
        Alert.alert('Success', 'User updated successfully');
      }
      setUserFormVisible(false);
      loadUsers(1, true);
    } catch (error: any) {
      Alert.alert('Error', error.message || `Failed to ${userFormMode === 'create' ? 'create' : 'update'} user`);
    } finally {
      setUserFormLoading(false);
    }
  };

  const confirmDeleteUser = async () => {
    if (!targetUser) return;
    try {
      await deleteUser(targetUser.id);
      Alert.alert('Success', 'User deleted successfully');
      setDeleteDialogVisible(false);
      loadUsers(1, true);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to delete user');
    }
  };

  const navigateToUserDetail = (user: User) => {
    if (!user.id) {
      Alert.alert('Error', 'User ID is missing. Cannot view user details.');
      return;
    }
    navigation.navigate('UserDetail', { userId: user.id });
  };

  const renderUserCard = ({ item: user }: { item: User }) => {
    if (!user.id) {
      return null;
    }

    const statusInfo = STATUS_CONFIG[user.status as StatusKey];
    const userTypeInfo = userTypes.find(type => type.value === user.userType);
    const isSelected = selectedUserIds.includes(user.id);
    const roleLabel = userTypeInfo?.label || (user.role ? `${user.role.charAt(0).toUpperCase()}${user.role.slice(1)}` : 'User');
    const roleIcon = userTypeInfo?.icon || 'account';
    const joinDate = user.createdAt ? new Date(user.createdAt) : null;

    return (
      <Animated.View style={styles.userCardContainer}>
        <Surface
          style={[
            styles.userCard,
            isSelected && styles.userCardSelected
          ]}
          elevation={isSelected ? 5 : 2}>
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={() => {
              if (selectionMode) {
                toggleSelection(user.id);
              } else {
                navigateToUserDetail(user);
              }
            }}
            onLongPress={() => toggleSelection(user.id)}>
            <View style={styles.userCardInner}>
              <View style={styles.userHeaderWrapper}>
                <View style={styles.userHeader}>
                  <View style={styles.userAvatarContainer}>
                    <Avatar.Image
                      size={60}
                      source={user.profileImage ? { uri: user.profileImage } : { uri: profilePlaceholder }}
                      style={styles.userAvatar}
                    />
                    <Badge
                      size={16}
                    style={[
                      styles.statusBadge,
                      { backgroundColor: statusInfo?.color || theme.colors.primary }
                    ]}
                  />
                  {selectionMode && (
                    <View style={styles.selectionCheckboxWrapper}>
                      <Checkbox
                        status={isSelected ? 'checked' : 'unchecked'}
                        onPress={() => toggleSelection(user.id)}
                      />
                    </View>
                  )}
                </View>

                <View style={styles.userHeaderContent}>
                  <View style={styles.userNameRow}>
                    <Text variant="titleMedium" style={styles.userName} numberOfLines={1}>
                      {user.name || 'Unnamed User'}
                    </Text>
                  </View>

                  <View style={styles.userChipRow}>
                    <Chip
                      icon={roleIcon}
                      style={styles.roleChip}
                      textStyle={styles.roleChipText}
                    >
                      {roleLabel}
                    </Chip>
                    <Chip
                      icon={statusInfo?.icon || 'radiobox-marked'}
                      style={[
                        styles.statusChip,
                        styles.statusChipElevated,
                        { backgroundColor: statusInfo?.color || theme.colors.primary }
                      ]}
                      textStyle={styles.statusChipText}
                    >
                      {statusInfo?.label || user.status}
                    </Chip>
                  </View>

                  <View style={styles.userMetaItem}>
                    <Icon
                      name="email-outline"
                      type="material-community"
                      size={16}
                      color="#607d8b"
                      style={styles.metaIcon}
                    />
                    <Text variant="bodyMedium" style={styles.userEmail} numberOfLines={1}>
                      {user.email}
                    </Text>
                  </View>

                  {user.phone && (
                    <View style={styles.userMetaItem}>
                      <Icon
                        name="phone"
                        type="material-community"
                        size={16}
                        color="#607d8b"
                        style={styles.metaIcon}
                      />
                      <Text variant="bodySmall" style={styles.userPhone}>
                        {user.phone}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              </View>

              <View style={styles.userMetaRow}>
                {joinDate && (
                  <View style={styles.metaPill}>
                    <Icon
                      name="calendar-month"
                      type="material-community"
                      size={16}
                      color="#4059ad"
                    />
                    <Text variant="bodySmall" style={styles.metaPillText}>
                      Joined {joinDate.toLocaleDateString()}
                    </Text>
                  </View>
                )}
                {user.caregiverProfile?.hourly_rate && (
                  <View style={styles.metaPill}>
                    <Icon
                      name="cash"
                      type="material-community"
                      size={16}
                      color="#4059ad"
                    />
                    <Text variant="bodySmall" style={styles.metaPillText}>
                      ₱{user.caregiverProfile.hourly_rate}/hr
                    </Text>
                  </View>
                )}
                {user.caregiverProfile?.background_check_status && (
                  <View style={styles.metaPill}>
                    <Icon
                      name="shield-check"
                      type="material-community"
                      size={16}
                      color="#4059ad"
                    />
                    <Text variant="bodySmall" style={styles.metaPillText}>
                      Background: {user.caregiverProfile.background_check_status}
                    </Text>
                  </View>
                )}
              </View>

              {!!user.statusReason && (
                <View style={styles.statusReasonContainer}>
                  <Icon
                    name="information-outline"
                    type="material-community"
                    size={16}
                    color="#ff9800"
                  />
                  <Text variant="bodySmall" style={styles.statusReasonText} numberOfLines={3}>
                    {user.statusReason}
                  </Text>
                </View>
              )}

              <Divider style={styles.divider} />

              <View style={styles.userActions}>
                <View style={styles.actionButtons}>
                  <Button
                    mode="contained-tonal"
                    icon="eye"
                    onPress={() => navigateToUserDetail(user)}
                    style={styles.actionButton}
                    labelStyle={styles.actionButtonText}
                  >
                    View Profile
                  </Button>

                  <Menu
                    visible={menuUserId === user.id}
                    onDismiss={() => setMenuUserId(null)}
                    anchor={
                      <Button
                        mode="outlined"
                        icon="dots-vertical"
                        onPress={() => setMenuUserId(user.id)}
                        style={styles.actionButton}
                        labelStyle={styles.actionButtonText}
                      >
                        Actions
                      </Button>
                    }
                  >
                    <Menu.Item
                      leadingIcon="account-edit"
                      onPress={() => {
                        setMenuUserId(null);
                        openUserForm('edit', user);
                      }}
                      title="Edit User"
                    />
                    {statusOptions
                      .filter((status) => status !== user.status)
                      .map((status) => (
                        <Menu.Item
                          key={`${user.id}-${status}`}
                          leadingIcon={STATUS_CONFIG[status].icon}
                          onPress={() => {
                            setMenuUserId(null);
                            openStatusDialog(user, status);
                          }}
                          title={`Set ${STATUS_CONFIG[status].label}`}
                        />
                      ))}
                    <Divider />
                    <Menu.Item
                      leadingIcon="delete"
                      title="Delete User"
                      titleStyle={{ color: '#f44336' }}
                      onPress={() => {
                        setMenuUserId(null);
                        setTargetUser(user);
                        setDeleteDialogVisible(true);
                      }}
                    />
                  </Menu>
                </View>

                {selectionMode && !isSelected ? null : (
                  <View style={styles.statusContainer}>
                    <Text variant="labelSmall" style={styles.statusMetaLabel}>
                      Last Updated
                    </Text>
                    <Text variant="bodySmall" style={styles.statusMetaValue}>
                      {user.statusUpdatedAt ? new Date(user.statusUpdatedAt).toLocaleString() : '—'}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        </Surface>
      </Animated.View>
    );
  };

  const renderStatsCard = () => (
    <Surface style={styles.statsCard} elevation={1}>
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text variant="headlineSmall" style={styles.statNumber}>
            {userStats.total}
          </Text>
          <Text variant="bodySmall" style={styles.statLabel}>
            Total Users
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text variant="headlineSmall" style={[styles.statNumber, {color: '#4caf50'}]}>
            {userStats.active}
          </Text>
          <Text variant="bodySmall" style={styles.statLabel}>
            Active
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text variant="headlineSmall" style={[styles.statNumber, {color: '#ff9800'}]}>
            {userStats.suspended}
          </Text>
          <Text variant="bodySmall" style={styles.statLabel}>
            Suspended
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text variant="headlineSmall" style={[styles.statNumber, {color: '#f44336'}]}>
            {userStats.banned}
          </Text>
          <Text variant="bodySmall" style={styles.statLabel}>
            Banned
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text variant="headlineSmall" style={[styles.statNumber, {color: '#9e9e9e'}]}>
            {userStats.inactive}
          </Text>
          <Text variant="bodySmall" style={styles.statLabel}>
            Inactive
          </Text>
        </View>
      </View>
    </Surface>
  );

  const isInitialLoading = loading && users.length === 0;

  if (isInitialLoading) {
    return (
      <View style={styles.loadingContainer}>
        <FlatList
          data={Array.from({length: 6})}
          keyExtractor={(_, index) => `user-skeleton-${index}`}
          contentContainerStyle={styles.skeletonList}
          showsVerticalScrollIndicator={false}
          renderItem={({index}) => (
            <Surface style={styles.skeletonCard} elevation={1} key={`user-skeleton-card-${index}`}>
              <View style={styles.skeletonHeaderRow}>
                <SkeletonCircle size={48} />
                <View style={styles.skeletonHeaderInfo}>
                  <SkeletonBlock height={18} width="70%" />
                  <SkeletonBlock height={14} width="55%" />
                  <SkeletonBlock height={12} width="40%" />
                </View>
              </View>
              <View style={styles.skeletonMetaRow}>
                <SkeletonBlock height={12} width="32%" />
                <SkeletonBlock height={12} width="28%" />
                <SkeletonBlock height={12} width="24%" />
              </View>
              <View style={styles.skeletonActionRow}>
                {Array.from({length: 3}).map((_, actionIndex) => (
                  <SkeletonBlock key={`user-skeleton-action-${index}-${actionIndex}`} height={32} width={85} borderRadius={16} />
                ))}
              </View>
            </Surface>
          )}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text variant="headlineSmall" style={styles.headerTitle}>
            User Management
          </Text>
          <Icon
            name="account-group"
            type="material-community"
            color={theme.colors.primary}
            size={28}
          />
        </View>

        <Searchbar
          placeholder="Search users by name, email, or phone..."
          onChangeText={handleSearch}
          value={searchQuery}
          style={styles.searchBar}
          iconColor={theme.colors.primary}
        />

        {renderStatsCard()}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filtersContainer}>
          {userTypes.map(type => (
            <Chip
              key={type.value}
              selected={selectedUserType === type.value}
              onPress={() => handleUserTypeChange(type.value)}
              style={[
                styles.filterChip,
                selectedUserType === type.value && styles.filterChipSelected
              ]}
              icon={type.icon}>
              {type.label}
            </Chip>
          ))}
        </ScrollView>
      </View>

      {selectionMode && (
        <Surface style={styles.selectionBar} elevation={2}>
          <Text style={styles.selectionText}>{selectedUserIds.length} selected</Text>
          <View style={styles.selectionActions}>
            <Button
              mode="contained"
              onPress={() => openBulkStatusDialog(bulkStatusTarget)}
              style={styles.selectionActionButton}
            >
              Bulk Status
            </Button>
            <Button
              mode="text"
              onPress={exitSelectionMode}
              style={styles.selectionActionButton}
            >
              Clear
            </Button>
          </View>
          <IconButton icon="close" onPress={exitSelectionMode} accessibilityLabel="Exit selection mode" />
        </Surface>
      )}

      <FlatList
        data={users}
        renderItem={renderUserCard}
        keyExtractor={(item, index) => (item.id ? item.id.toString() : `user-${index}`)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
        onEndReached={() => {
          if (hasMore && !loading) {
            loadUsers(page + 1);
          }
        }}
        onEndReachedThreshold={0.1}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon
              name="account-search"
              type="material-community"
              size={64}
              color="#ccc"
            />
            <Text variant="titleMedium" style={styles.emptyTitle}>
              No users found
            </Text>
            <Text variant="bodyMedium" style={styles.emptySubtitle}>
              Try adjusting your search or filters
            </Text>
          </View>
        }
        contentContainerStyle={users.length === 0 ? styles.emptyListContainer : styles.listContent}
      />

      <FAB
        icon="account-plus"
        onPress={() => openUserForm('create')}
        style={styles.fab}
        color="white"
      />

      <Portal>
        <Dialog
          visible={statusDialogVisible}
          onDismiss={() => {
            setStatusDialogVisible(false);
            setStatusTarget(null);
            setStatusReason('');
          }}>
          <Dialog.Title>Update Status</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogDescription}>
              {statusTarget?.user?.name || 'User'} will be set to {statusTarget ? STATUS_CONFIG[statusTarget.status].label : 'the selected status'}.
            </Text>
            <TextInput
              label="Reason (optional)"
              value={statusReason}
              onChangeText={setStatusReason}
              mode="outlined"
              multiline
              numberOfLines={3}
              style={styles.dialogInput}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => {
                setStatusDialogVisible(false);
                setStatusTarget(null);
                setStatusReason('');
              }}
            >
              Cancel
            </Button>
            <Button onPress={confirmStatusUpdate}>Update</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={bulkStatusDialogVisible}
          onDismiss={() => {
            setBulkStatusDialogVisible(false);
            setStatusReason('');
          }}>
          <Dialog.Title>Bulk Status Update</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogDescription}>
              Apply a status to {selectedUserIds.length} selected users.
            </Text>
            <RadioButton.Group
              onValueChange={(value) => setBulkStatusTarget(value as StatusKey)}
              value={bulkStatusTarget}>
              {statusOptions.map((status) => (
                <RadioButton.Item
                  key={`bulk-radio-${status}`}
                  label={STATUS_CONFIG[status].label}
                  value={status}
                />
              ))}
            </RadioButton.Group>
            <TextInput
              label="Reason (optional)"
              value={statusReason}
              onChangeText={setStatusReason}
              mode="outlined"
              multiline
              numberOfLines={3}
              style={styles.dialogInput}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => {
                setBulkStatusDialogVisible(false);
                setStatusReason('');
              }}
            >
              Cancel
            </Button>
            <Button onPress={confirmBulkStatusUpdate}>Apply</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={userFormVisible}
          onDismiss={() => {
            setUserFormVisible(false);
            resetUserForm();
          }}>
          <View style={styles.userFormWrapper}>
            <Surface style={styles.userFormSurface} elevation={4}>
              <View style={styles.userFormContainer}>
                <View style={styles.userFormHeader}>
                  <Avatar.Icon
                    icon={userFormMode === 'create' ? 'account-plus' : 'account-edit'}
                    size={48}
                    style={styles.userFormAvatar}
                  />
                  <View>
                    <Text variant="titleMedium" style={styles.userFormTitle}>
                      {userFormMode === 'create' ? 'Create New User' : 'Edit User'}
                    </Text>
                    <Text variant="bodySmall" style={styles.userFormSubtitle}>
                      Complete the details below to {userFormMode === 'create' ? 'add a new account' : 'update the user profile'}.
                    </Text>
                  </View>
                </View>

                <Divider style={styles.userFormDivider} />

                <View style={styles.userFormContentWrapper}>
                  <ScrollView style={styles.userFormScroll} contentContainerStyle={styles.userFormBody}>
                    <Text variant="labelLarge" style={styles.formSectionLabel}>
                      Account Details
                    </Text>
                    <View style={styles.formRow}>
                      <TextInput
                        label="Email"
                        mode="outlined"
                        value={userFormData.email ?? ''}
                        onChangeText={(value) => setUserFormData((prev) => ({ ...prev, email: value }))}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        style={[styles.dialogInput, styles.formFieldHalf]}
                        error={!!userFormErrors.email}
                      />
                      <TextInput
                        label="Password"
                        mode="outlined"
                        secureTextEntry
                        value={userFormData.password ?? ''}
                        onChangeText={(value) => setUserFormData((prev) => ({ ...prev, password: value }))}
                        style={[styles.dialogInput, styles.formFieldHalf]}
                        placeholder={userFormMode === 'edit' ? 'Leave blank to keep current password' : undefined}
                        error={!!userFormErrors.password}
                      />
                    </View>
                    <View style={styles.helperRow}>
                      <HelperText type="error" visible={!!userFormErrors.email}>
                        {userFormErrors.email}
                      </HelperText>
                      <HelperText type="error" visible={!!userFormErrors.password}>
                        {userFormErrors.password}
                      </HelperText>
                    </View>

                    <Text variant="labelLarge" style={styles.formSectionLabel}>
                      Profile Information
                    </Text>
                    <View style={styles.formRow}>
                      <TextInput
                        label="Name"
                        mode="outlined"
                        value={userFormData.name ?? ''}
                        onChangeText={(value) => setUserFormData((prev) => ({ ...prev, name: value }))}
                        style={[styles.dialogInput, styles.formFieldHalf]}
                      />
                      <TextInput
                        label="Phone"
                        mode="outlined"
                        value={userFormData.phone ?? ''}
                        onChangeText={(value) => setUserFormData((prev) => ({ ...prev, phone: value }))}
                        style={[styles.dialogInput, styles.formFieldHalf]}
                        keyboardType="phone-pad"
                      />
                    </View>

                    <Text variant="labelLarge" style={styles.formSectionLabel}>
                      Role & Status
                    </Text>
                    <View style={styles.radioGroupRow}>
                      <View style={styles.radioGroupCard}>
                        <Text style={styles.radioGroupTitle}>Role</Text>
                        <RadioButton.Group
                          onValueChange={(value) => setUserFormData((prev) => ({ ...prev, role: value }))}
                          value={userFormData.role ?? 'parent'}>
                          {userTypes
                            .filter((type) => type.value !== 'all')
                            .map((type) => (
                              <RadioButton.Item
                                key={`role-${type.value}`}
                                label={type.label}
                                value={type.value}
                              />
                            ))}
                        </RadioButton.Group>
                      </View>

                      <View style={styles.radioGroupCard}>
                        <Text style={styles.radioGroupTitle}>Status</Text>
                        <RadioButton.Group
                          onValueChange={(value) => setUserFormData((prev) => ({ ...prev, status: value }))}
                          value={userFormData.status ?? 'active'}>
                          {statusOptions.map((status) => (
                            <RadioButton.Item
                              key={`status-${status}`}
                              label={STATUS_CONFIG[status].label}
                              value={status}
                            />
                          ))}
                        </RadioButton.Group>
                      </View>
                    </View>

                    {userFormMode === 'edit' && (
                      <View style={styles.reasonCard}>
                        <Text variant="labelLarge" style={styles.formSectionLabel}>
                          Status Reason
                        </Text>
                        <TextInput
                          label="Status change reason (optional)"
                          mode="outlined"
                          value={userFormData.reason ?? ''}
                          onChangeText={(value) => setUserFormData((prev) => ({ ...prev, reason: value }))}
                          multiline
                          numberOfLines={3}
                          style={styles.dialogInput}
                        />
                      </View>
                    )}
                  </ScrollView>
                </View>

                <Divider style={styles.userFormDivider} />

                <View style={styles.userFormActions}>
                  <Button
                    mode="text"
                    onPress={() => {
                      setUserFormVisible(false);
                      resetUserForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    mode="contained"
                    icon={userFormMode === 'create' ? 'check' : 'content-save'}
                    loading={userFormLoading}
                    onPress={submitUserForm}
                    disabled={userFormLoading}
                    style={styles.userFormSubmit}
                  >
                    {userFormMode === 'create' ? 'Create User' : 'Save Changes'}
                  </Button>
                </View>
              </View>
            </Surface>
          </View>
        </Dialog>

        <Dialog
          visible={deleteDialogVisible}
          onDismiss={() => {
            setDeleteDialogVisible(false);
            setTargetUser(null);
          }}>
          <Dialog.Title>Delete User</Dialog.Title>
          <Dialog.Content>
            <Text>
              Are you sure you want to delete{' '}
              <Text style={styles.boldText}>{targetUser?.name || targetUser?.email}</Text>? This will deactivate their account.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => {
                setDeleteDialogVisible(false);
                setTargetUser(null);
              }}
            >
              Cancel
            </Button>
            <Button onPress={confirmDeleteUser}>Delete</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 16,
    color: '#546e7a',
  },
  skeletonList: {
    width: '100%',
    padding: 16,
    gap: 16,
  },
  skeletonCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowOffset: {width: 0, height: 2},
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
      web: {
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
      },
      default: {},
    }),
  },
  skeletonHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 12,
  },
  skeletonHeaderInfo: {
    flex: 1,
    gap: 8,
  },
  skeletonMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  skeletonActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  header: {
    backgroundColor: 'white',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontWeight: 'bold',
    color: '#333',
  },
  searchBar: {
    marginBottom: 16,
    elevation: 2,
  },
  statsCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    color: '#666',
    marginTop: 4,
  },
  filtersContainer: {
    marginBottom: 8,
  },
  filterChip: {
    marginRight: 8,
    backgroundColor: '#f0f0f0',
  },
  filterChipSelected: {
    backgroundColor: '#e3f2fd',
  },
  userCardContainer: {
    marginHorizontal: 16,
    marginVertical: 6,
  },
  userCard: {
    borderRadius: 12,
    backgroundColor: 'white',
    marginBottom: 4,
  },
  userCardSelected: {
    borderWidth: 2,
    borderColor: '#3f51b5',
    backgroundColor: '#f2f5ff',
  },
  userCardInner: {
    padding: 16,
    gap: 16,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  userHeaderWrapper: {
    gap: 12,
  },
  userAvatarContainer: {
    position: 'relative',
    marginRight: 4,
  },
  userAvatar: {
    backgroundColor: '#e3f2fd',
  },
  statusBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderWidth: 2,
    borderColor: 'white',
  },
  selectionCheckboxWrapper: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: 'white',
    borderRadius: 12,
  },
  userHeaderContent: {
    flex: 1,
    gap: 8,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  userName: {
    fontWeight: 'bold',
    color: '#212121',
    flex: 1,
  },
  roleChip: {
    minHeight: 28,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: '#e8f0fe',
    justifyContent: 'center',
  },
  roleChipText: {
    color: '#1a237e',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 16,
  },
  userMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaIcon: {
    marginRight: 2,
  },
  userEmail: {
    color: '#546e7a',
  },
  userPhone: {
    color: '#546e7a',
  },
  statusChip: {
    height: 28,
  },
  statusChipElevated: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowOffset: {width: 0, height: 2},
        shadowRadius: 3,
      },
      android: {
        elevation: 1,
      },
      web: {
        boxShadow: '0 2px 4px rgba(0,0,0,0.12)',
      },
      default: {},
    }),
  },
  statusChipText: {
    color: 'white',
    fontSize: 12,
    lineHeight: 14,
    fontWeight: 'bold',
  },
  userMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef2ff',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  metaPillText: {
    color: '#3949ab',
    fontSize: 12,
  },
  statusReasonContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#fff8e1',
    borderRadius: 8,
    padding: 12,
  },
  statusReasonText: {
    color: '#bf360c',
    flex: 1,
  },
  userFormWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  userFormSurface: {
    borderRadius: 16,
    backgroundColor: 'white',
  },
  userFormContainer: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 16,
  },
  userFormContentWrapper: {
    maxHeight: 460,
  },
  userFormScroll: {
    paddingHorizontal: 4,
  },
  userFormHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  userFormAvatar: {
    backgroundColor: '#e8f0fe',
  },
  userFormTitle: {
    color: '#1a237e',
    fontWeight: '700',
  },
  userFormSubtitle: {
    color: '#546e7a',
    marginTop: 4,
  },
  userFormDivider: {
    marginHorizontal: 4,
  },
  userFormBody: {
    gap: 12,
  },
  formSectionLabel: {
    color: '#1a237e',
    fontWeight: '600',
    marginBottom: 8,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  formFieldHalf: {
    flex: 1,
    minWidth: '48%',
  },
  helperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  radioGroupRow: {
    flexDirection: 'column',
    gap: 12,
  },
  radioGroupCard: {
    flex: 1,
    backgroundColor: '#f5f7ff',
    borderRadius: 12,
    padding: 12,
  },
  radioGroupTitle: {
    fontWeight: '600',
    color: '#1a237e',
    marginBottom: 8,
  },
  reasonCard: {
    backgroundColor: '#fff3e0',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
  },
  userFormActions: {
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  userFormSubmit: {
    borderRadius: 24,
  },
  divider: {
    marginVertical: 12,
    backgroundColor: '#e0e0e0',
  },
  userActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    borderColor: '#c5cae9',
  },
  actionButtonText: {
    fontSize: 12,
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  statusMetaLabel: {
    textTransform: 'uppercase',
    fontSize: 10,
    color: '#90a4ae',
  },
  statusMetaValue: {
    fontSize: 12,
    color: '#455a64',
    marginTop: 2,
  },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#e8f0fe',
  },
  selectionText: {
    fontWeight: '600',
    color: '#1a237e',
  },
  selectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectionActionButton: {
    marginRight: 12,
  },
  emptyListContainer: {
    flexGrow: 1,
  },
  listContent: {
    paddingBottom: 120,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyTitle: {
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#999',
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    bottom: 0,
    right: 0,
  },
  dialogDescription: {
    marginBottom: 12,
    color: '#607d8b',
  },
  dialogInput: {
    marginBottom: 12,
  },
  radioLabel: {
    marginTop: 8,
    fontWeight: '600',
    color: '#1a237e',
  },
  boldText: {
    fontWeight: 'bold',
  },
});

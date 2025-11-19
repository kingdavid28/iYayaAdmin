// src/screens/management/ChildrenManagementScreen.tsx
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Alert, FlatList, RefreshControl, StyleSheet, View} from 'react-native';
import {
  ActivityIndicator,
  Avatar,
  Button,
  Card,
  Chip,
  FAB,
  List,
  Searchbar,
  Surface,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import {Icon} from 'react-native-elements';
import type {MD3Theme} from 'react-native-paper';
import {ChildProfile} from '../../types';
import {
  updateChildNotes,
  deleteChildProfile,
} from '../../services/childrenService';
import {useOrganization} from '../../contexts/OrganizationContext';
import {useChildren} from '../../hooks/useChildren';

type RiskFilter = 'all' | 'allergies' | 'notes' | 'specialNeeds';

interface ChildrenStats {
  total: number;
  allergies: number;
  notes: number;
  specialNeeds: number;
  withNotes: number;
}

type StatIconStyleKey = 'statIconWarning' | 'statIconCritical' | 'statIconInfo' | 'statIconSuccess';

const RISK_FILTERS: {label: string; value: RiskFilter; icon: string}[] = [
  {label: 'All Profiles', value: 'all', icon: 'account-group'},
  {label: 'Allergies', value: 'allergies', icon: 'medical-bag'},
  {label: 'Notes', value: 'notes', icon: 'note-text'},
  {label: 'Special Needs', value: 'specialNeeds', icon: 'wheelchair-accessibility'},
];

function useDebouncedValue<T>(value: T, delay = 400) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [delay, value]);

  return debouncedValue;
}

const formatDate = (value?: string | null) => {
  if (!value) {
    return 'Unknown';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const formatEmergencyContact = (contact?: Record<string, unknown> | null) => {
  if (!contact || typeof contact !== 'object') {
    return undefined;
  }
  const entries = Object.entries(contact).filter(([key, value]) => key !== 'adminNotes' && value != null && `${value}`.trim().length > 0);
  if (entries.length === 0) {
    return undefined;
  }
  return entries.map(([key, value]) => `${key}: ${String(value)}`).join('\n');
};

export default function ChildrenManagementScreen() {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const {organizationId} = useOrganization();
  const {children, loading, error, refresh} = useChildren({organizationId});
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRisk, setSelectedRisk] = useState<RiskFilter>('all');
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [saveLoadingId, setSaveLoadingId] = useState<string | null>(null);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);
  const debouncedQuery = useDebouncedValue(searchQuery);

  const stats = useMemo<ChildrenStats>(() => {
    return children.reduce(
      (acc, child) => {
        const allergies = Boolean(child.allergies && child.allergies.trim());
        const hasNotes = Boolean(child.notes && child.notes.trim());
        const specialNeeds = Boolean(child.specialNeeds && child.specialNeeds.trim());
        const notes = (child.emergencyContact as Record<string, unknown> | null)?.adminNotes as string | undefined;

        if (allergies) {
          acc.allergies += 1;
        }
        if (hasNotes) {
          acc.notes += 1;
        }
        if (specialNeeds) {
          acc.specialNeeds += 1;
        }
        if (notes && notes.trim().length > 0) {
          acc.withNotes += 1;
        }

        acc.total += 1;
        return acc;
      },
      {total: 0, allergies: 0, notes: 0, specialNeeds: 0, withNotes: 0} satisfies ChildrenStats,
    );
  }, [children]);

  const filteredChildren = useMemo(() => {
    return children.filter(child => {
      // Filter by risk type
      const matchesFilter = selectedRisk === 'all' || 
        (selectedRisk === 'allergies' && child.allergies) ||
        (selectedRisk === 'notes' && child.notes) ||
        (selectedRisk === 'specialNeeds' && child.specialNeeds);
      
      // Filter by search query
      const matchesSearch = !debouncedQuery || 
        child.name.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
        (child.parentInfo?.name && child.parentInfo.name.toLowerCase().includes(debouncedQuery.toLowerCase()));
      
      return matchesFilter && matchesSearch;
    });
  }, [children, selectedRisk, debouncedQuery]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const handleNotesChange = useCallback((childId: string, text: string) => {
    setNoteDrafts(prev => ({...prev, [childId]: text}));
  }, []);

  const handleUpdate = useCallback(
    async (child: ChildProfile) => {
      const currentContact = (child.emergencyContact as Record<string, unknown> | null) ?? null;
      const existingNotes = (currentContact?.adminNotes as string | undefined) ?? '';
      const draftNotes = noteDrafts[child.id];
      const nextNotes = draftNotes ?? existingNotes;

      if ((nextNotes ?? '').trim() === (existingNotes ?? '').trim()) {
        Alert.alert('No changes detected', 'Update the notes before saving.');
        return;
      }

      setSaveLoadingId(child.id);
      try {
        await updateChildNotes(child.id, currentContact, nextNotes?.trim() ?? '');
        setNoteDrafts(prev => {
          const next = {...prev};
          delete next[child.id];
          return next;
        });
        await refresh();
        Alert.alert('Success', 'Child profile notes updated.');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update child profile';
        Alert.alert('Error', message);
      } finally {
        setSaveLoadingId(null);
      }
    },
    [refresh, noteDrafts],
  );

  const handleDelete = useCallback(
    (child: ChildProfile) => {
      Alert.alert(
        'Remove Child Profile',
        `Are you sure you want to remove ${child.name}'s profile? This action cannot be undone.`,
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              setDeleteLoadingId(child.id);
              try {
                await deleteChildProfile(child.id);
                setNoteDrafts(prev => {
                  const next = {...prev};
                  delete next[child.id];
                  return next;
                });
                await refresh();
                Alert.alert('Deleted', 'Child profile removed.');
              } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to delete child profile';
                Alert.alert('Error', message);
              } finally {
                setDeleteLoadingId(null);
              }
            },
          },
        ],
      );
    },
    [refresh],
  );

  const renderStatsCard = useCallback(
    (icon: string, label: string, value: number, styleKey: StatIconStyleKey) => (
      <Card style={styles.statCard}>
        <Card.Content style={styles.statContent}>
          <Avatar.Icon size={40} icon={icon} style={[styles.statIcon, styles[styleKey]]} color={theme.colors.onPrimary} />
          <View style={styles.statTextGroup}>
            <Text variant="titleLarge" style={styles.statValue}>
              {value}
            </Text>
            <Text variant="bodySmall" style={styles.statLabel}>
              {label}
            </Text>
          </View>
        </Card.Content>
      </Card>
    ),
    [theme.colors.onPrimary],
  );

  const renderListHeader = useCallback(() => (
    <View style={styles.headerContainer}>
      <Text variant="headlineMedium" style={styles.title}>
        Children Management
      </Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        Review child safety information, capture admin notes, and track caregiver readiness.
      </Text>

      <View style={styles.statsContainer}>
        {renderStatsCard('shield-alert', 'With allergies', stats.allergies, 'statIconWarning')}
        {renderStatsCard('note-text', 'Parent notes', stats.notes, 'statIconCritical')}
        {renderStatsCard('human-wheelchair', 'Special needs', stats.specialNeeds, 'statIconInfo')}
        {renderStatsCard('notebook-edit', 'Profiles w/ notes', stats.withNotes, 'statIconSuccess')}
      </View>

      <Searchbar
        placeholder="Search by child or parent"
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={styles.searchbar}
      />

      <View style={styles.chipRow}>
        {RISK_FILTERS.map(filter => (
          <Chip
            key={filter.value}
            icon={filter.icon}
            mode={selectedRisk === filter.value ? 'flat' : 'outlined'}
            style={styles.filterChip}
            onPress={() => setSelectedRisk(filter.value)}>
            {`${filter.label} (${filter.value === 'all' ? stats.total : stats[filter.value]})`}
          </Chip>
        ))}
      </View>
    </View>
  ), [renderStatsCard, searchQuery, selectedRisk, stats]);

  const renderChildCard = useCallback(
    ({item}: {item: ChildProfile}) => {
      const contact = (item.emergencyContact as Record<string, unknown> | null) ?? null;
      const existingNotes = (contact?.adminNotes as string | undefined) ?? '';
      const draftNotes = noteDrafts[item.id];
      const notesValue = draftNotes ?? existingNotes;

      return (
        <Surface style={styles.card} elevation={2}>
          <View style={styles.cardInner}>
            <View style={styles.headerRow}>
              <View style={styles.headerInfo}>
                <Avatar.Icon size={42} icon="baby-face-outline" style={styles.avatar} />
                <View style={styles.headerText}>
                  <Text variant="titleMedium">{item.name}</Text>
                  <Text variant="bodySmall" style={styles.subtleText}>
                    {item.parentInfo?.name || `Parent ID: ${item.parentId}`}
                  </Text>
                </View>
              </View>
              <Chip icon="calendar" compact style={styles.dateChip}>
                {formatDate(item.createdAt)}
              </Chip>
            </View>

            <List.Section>
              {item.specialNeeds ? (
                <List.Item
                  title="Special Needs"
                  description={item.specialNeeds}
                  left={props => <List.Icon {...props} icon="human-wheelchair" color="#7b1fa2" />}
                />
              ) : null}
              {item.allergies ? (
                <List.Item
                  title="Allergies"
                  description={item.allergies}
                  left={props => <List.Icon {...props} icon="alert-decagram" color="#ef6c00" />}
                />
              ) : null}
              {item.notes ? (
                <List.Item
                  title="Parent Notes"
                  description={item.notes}
                  left={props => <List.Icon {...props} icon="hospital-box" color="#c62828" />}
                />
              ) : null}
              {formatEmergencyContact(contact) ? (
                <List.Item
                  title="Emergency Contact"
                  description={formatEmergencyContact(contact)}
                  descriptionNumberOfLines={6}
                  left={props => <List.Icon {...props} icon="phone" color="#00838f" />}
                />
              ) : null}
            </List.Section>

            <TextInput
              mode="outlined"
              label="Admin notes"
              placeholder="Document safety checks, follow-up actions, or caregiver guidance"
              value={notesValue ?? ''}
              onChangeText={text => handleNotesChange(item.id, text)}
              style={styles.notesInput}
              multiline
            />

            <View style={styles.actionsRow}>
              <Button
                mode="contained"
                icon="content-save"
                onPress={() => handleUpdate(item)}
                loading={saveLoadingId === item.id}
                disabled={saveLoadingId === item.id}
                style={styles.actionButton}>
                Save Notes
              </Button>
              <Button
                mode="outlined"
                icon="delete"
                textColor={theme.colors.error}
                onPress={() => handleDelete(item)}
                loading={deleteLoadingId === item.id}
                disabled={deleteLoadingId === item.id}
                style={styles.actionButton}>
                Remove
              </Button>
            </View>
          </View>
        </Surface>
      );
    },
    [deleteLoadingId, handleDelete, handleNotesChange, handleUpdate, noteDrafts, saveLoadingId, theme.colors.error],
  );

  const renderEmptyComponent = useCallback(() => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Loading children...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Icon name="error-outline" size={48} color={theme.colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <Button
            mode="contained"
            onPress={refresh}
            style={styles.retryButton}
          >
            Retry
          </Button>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Icon name="baby-face-outline" type="material-community" size={48} color={theme.colors.outline} />
        <Text style={styles.emptyText}>No children found</Text>
        {debouncedQuery ? (
          <Button
            mode="text"
            onPress={() => setSearchQuery('')}
          >
            Clear search
          </Button>
        ) : null}
      </View>
    );
  }, [debouncedQuery, error, loading, refresh, styles, theme.colors.error, theme.colors.outline]);

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredChildren}
        keyExtractor={item => item.id}
        renderItem={renderChildCard}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.colors.primary} />}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={renderEmptyComponent}
        ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
        keyboardShouldPersistTaps="handled"
      />

      <FAB icon="refresh" style={styles.fab} onPress={handleRefresh} disabled={loading} />
    </View>
  );
}

const createStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#f5f5f5',
    },
    listContent: {
      padding: 16,
      paddingBottom: 96,
    },
    listSeparator: {
      height: 12,
    },
    headerContainer: {
      marginBottom: 16,
    },
    title: {
      textAlign: 'center',
      color: '#3f51b5',
      fontWeight: 'bold',
      marginBottom: 8,
    },
    subtitle: {
      textAlign: 'center',
      color: '#616161',
      marginBottom: 16,
    },
    statsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 16,
    },
    statCard: {
      flexBasis: '48%',
      flexGrow: 1,
      borderRadius: 16,
      backgroundColor: '#fff',
      elevation: 2,
    },
    statContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    statIcon: {
      backgroundColor: '#3f51b5',
    },
    statIconWarning: {
      backgroundColor: '#fb8c00',
    },
    statIconCritical: {
      backgroundColor: '#e53935',
    },
    statIconInfo: {
      backgroundColor: '#7b1fa2',
    },
    statIconSuccess: {
      backgroundColor: '#43a047',
    },
    statTextGroup: {
      flexShrink: 1,
    },
    statValue: {
      fontWeight: '700',
    },
    statLabel: {
      color: '#616161',
    },
    searchbar: {
      marginBottom: 12,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    filterChip: {
      backgroundColor: '#e8eaf6',
    },
    card: {
      elevation: 2,
      backgroundColor: '#ffffff',
    },
    cardInner: {
      padding: 16,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    headerInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 12,
    },
    headerText: {
      flexShrink: 1,
    },
    avatar: {
      backgroundColor: '#3f51b5',
    },
    subtleText: {
      color: '#616161',
    },
    dateChip: {
      backgroundColor: '#e3f2fd',
    },
    notesInput: {
      marginTop: 12,
      marginBottom: 12,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: 12,
    },
    actionButton: {
      flex: 1,
    },
    fab: {
      position: 'absolute',
      right: 16,
      bottom: 16,
      backgroundColor: '#3f51b5',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    loadingText: {
      marginTop: 16,
      color: theme.colors.onSurfaceVariant,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    errorText: {
      marginVertical: 16,
      textAlign: 'center',
      color: theme.colors.error,
    },
    retryButton: {
      marginTop: 16,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    emptyText: {
      marginTop: 16,
      textAlign: 'center',
      color: theme.colors.onSurfaceVariant,
    },
  });
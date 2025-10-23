import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Alert, FlatList, RefreshControl, StyleSheet, View} from 'react-native';
import {
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
import {ChildProfile} from '../../types';
import {
  fetchChildren as fetchChildrenService,
  updateChildNotes,
  deleteChildProfile,
} from '../../services/childrenService';
import {supabase} from '../../config/supabase';

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
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [loading, setLoading] = useState(true);
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

  const loadChildren = useCallback(
    async (options?: {silent?: boolean}) => {
      if (!options?.silent) {
        setLoading(true);
      }
      try {
        const fetchedChildren = await fetchChildrenService({
          search: debouncedQuery.trim() ? debouncedQuery.trim() : undefined,
        });
        console.log('[children] fetched', fetchedChildren.length);
        setChildren(fetchedChildren);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load child profiles';
        Alert.alert('Error', message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [debouncedQuery],
  );

  useEffect(() => {
    loadChildren();
  }, [loadChildren]);

  useEffect(() => {
    supabase.auth.getSession().then(result => {
      console.log('[auth] session', result.data.session?.user?.email);
    });
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadChildren({silent: true});
  }, [loadChildren]);

  const filteredChildren = useMemo(() => {
    return children.filter(child => {
      switch (selectedRisk) {
        case 'allergies':
          return Boolean(child.allergies && child.allergies.trim());
        case 'notes':
          return Boolean(child.notes && child.notes.trim());
        case 'specialNeeds':
          return Boolean(child.specialNeeds && child.specialNeeds.trim());
        default:
          return true;
      }
    });
  }, [children, selectedRisk]);

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
        await loadChildren({silent: true});
        Alert.alert('Success', 'Child profile notes updated.');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update child profile';
        Alert.alert('Error', message);
      } finally {
        setSaveLoadingId(null);
      }
    },
    [loadChildren, noteDrafts],
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
                setChildren(prev => prev.filter(existing => existing.id !== child.id));
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
    [],
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
                    {item.parentInfo?.name ?? 'Parent name unavailable'}
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
          {Array.from({length: 4}).map((_, index) => (
            <Surface key={`skeleton-${index}`} style={styles.card} elevation={2}>
              <View style={styles.cardInner}>
                <View style={[styles.headerRow, styles.skeletonHeader]}>
                  <View style={styles.headerInfo}>
                    <View style={styles.skeletonAvatar} />
                    <View style={styles.headerText}>
                      <View style={styles.skeletonLineLarge} />
                      <View style={styles.skeletonLineSmall} />
                    </View>
                  </View>
                  <View style={styles.skeletonChip} />
                </View>
                <View style={styles.skeletonBlock} />
                <View style={styles.skeletonBlock} />
                <View style={styles.skeletonButtonRow}>
                  <View style={styles.skeletonButton} />
                  <View style={styles.skeletonButton} />
                </View>
              </View>
            </Surface>
          ))}
        </View>
      );
    }

    return (
      <Card style={styles.emptyCard}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.emptyTitle}>
            No child profiles found
          </Text>
          <Text variant="bodyMedium" style={styles.emptyText}>
            Try refreshing or adjusting your filters. Confirm parents have added children in the mobile app.
          </Text>
        </Card.Content>
      </Card>
    );
  }, [loading]);

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

      <FAB icon="refresh" style={styles.fab} onPress={() => loadChildren()} disabled={loading} />
    </View>
  );
}

const styles = StyleSheet.create({
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
    gap: 12,
  },
  emptyCard: {
    backgroundColor: '#fff',
    elevation: 1,
  },
  emptyTitle: {
    textAlign: 'center',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  emptyText: {
    textAlign: 'center',
    color: '#616161',
  },
  skeletonHeader: {
    alignItems: 'center',
  },
  skeletonAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
  },
  skeletonLineLarge: {
    height: 16,
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
    marginBottom: 8,
    width: '70%',
  },
  skeletonLineSmall: {
    height: 12,
    backgroundColor: '#e0e0e0',
    borderRadius: 6,
    width: '45%',
  },
  skeletonChip: {
    width: 72,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e0e0e0',
  },
  skeletonBlock: {
    height: 18,
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
    marginTop: 10,
  },
  skeletonButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  skeletonButton: {
    flex: 1,
    height: 40,
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
  },
});

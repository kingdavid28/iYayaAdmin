import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Alert, RefreshControl, ScrollView, StyleSheet, View} from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  FAB,
  List,
  Searchbar,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import {Icon} from 'react-native-elements';
import {ChildProfile} from '../../types';
import {
  fetchChildren as fetchChildrenService,
  updateChildNotes,
  deleteChildProfile,
} from '../../services/childrenService';

interface ChildEditorState {
  childId: string | null;
  notes: string;
}

export default function ChildrenManagementScreen() {
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRisk, setSelectedRisk] = useState<'all' | 'allergies' | 'medical' | 'specialNeeds'>('all');
  const [editorState, setEditorState] = useState<ChildEditorState>({childId: null, notes: ''});
  const theme = useTheme();

  const loadChildren = useCallback(async () => {
    try {
      if (!refreshing) {
        setLoading(true);
      }
      const fetchedChildren = await fetchChildrenService({
        search: searchQuery.trim() || undefined,
      });
      setChildren(fetchedChildren);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load child profiles');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing, searchQuery]);

  useEffect(() => {
    loadChildren();
  }, [loadChildren]);

  const filteredChildren = useMemo(() => {
    return children.filter(child => {
      switch (selectedRisk) {
        case 'allergies':
          return Boolean(child.allergies);
        case 'medical':
          return Boolean(child.medicalConditions);
        case 'specialNeeds':
          return Boolean(child.specialNeeds);
        default:
          return true;
      }
    });
  }, [children, selectedRisk]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadChildren();
  };

  const handleUpdate = async (child: ChildProfile) => {
    if (!editorState.notes.trim()) {
      Alert.alert('Missing notes', 'Please add notes before saving.');
      return;
    }

    try {
      await updateChildNotes(child.id, child.emergencyContact ?? null, editorState.notes.trim());
      setEditorState({childId: null, notes: ''});
      await loadChildren();
      Alert.alert('Success', 'Child profile updated with admin notes.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update child profile');
    }
  };

  const handleDelete = (child: ChildProfile) => {
    Alert.alert(
      'Remove Child Profile',
      `Are you sure you want to remove ${child.name}'s profile? This action cannot be undone.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteChildProfile(child.id);
              setEditorState({childId: null, notes: ''});
              await loadChildren();
              Alert.alert('Deleted', 'Child profile removed.');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete child profile');
            }
          },
        },
      ],
    );
  };

  const renderRiskChips = () => (
    <View style={styles.chipRow}>
      {(
        [
          {label: 'All Profiles', value: 'all' as const, icon: 'people'},
          {label: 'Allergies', value: 'allergies' as const, icon: 'healing'},
          {label: 'Medical', value: 'medical' as const, icon: 'local-hospital'},
          {label: 'Special Needs', value: 'specialNeeds' as const, icon: 'accessibility'},
        ] as const
      ).map(filter => (
        <Chip
          key={filter.value}
          icon={filter.icon}
          style={styles.filterChip}
          mode={selectedRisk === filter.value ? 'flat' : 'outlined'}
          onPress={() => setSelectedRisk(filter.value)}>
          {filter.label}
        </Chip>
      ))}
    </View>
  );

  const renderChildCard = (child: ChildProfile) => {
    const existingNotes = (child.emergencyContact as Record<string, any> | null)?.adminNotes ?? '';
    const currentNotes = editorState.childId === child.id ? editorState.notes : existingNotes;
    return (
      <Card key={child.id} style={styles.card}>
        <Card.Content>
          <View style={styles.header}>
            <View style={styles.headerInfo}>
              <Icon name="child-care" type="material" color={theme.colors.primary} size={26} />
              <View style={styles.headerText}>
                <Text variant="titleMedium">{child.name}</Text>
                <Text variant="bodySmall" style={styles.subtleText}>
                  Parent: {child.parentInfo?.name ?? child.parentId}
                </Text>
              </View>
            </View>
            <Chip icon="cake" style={styles.ageChip}>
              {new Date(child.dateOfBirth).toLocaleDateString()}
            </Chip>
          </View>

          <List.Section>
            {child.specialNeeds ? (
              <List.Item
                title="Special Needs"
                description={child.specialNeeds}
                left={props => <List.Icon {...props} icon="accessibility" color="#673ab7" />}
              />
            ) : null}
            {child.allergies ? (
              <List.Item
                title="Allergies"
                description={child.allergies}
                left={props => <List.Icon {...props} icon="healing" color="#e65100" />}
              />
            ) : null}
            {child.medicalConditions ? (
              <List.Item
                title="Medical Conditions"
                description={child.medicalConditions}
                left={props => <List.Icon {...props} icon="local-hospital" color="#b71c1c" />}
              />
            ) : null}
            {child.emergencyContact ? (
              <List.Item
                title="Emergency Contact"
                description={JSON.stringify(child.emergencyContact, null, 2)}
                descriptionNumberOfLines={6}
                left={props => <List.Icon {...props} icon="phone" color="#0097a7" />}
              />
            ) : null}
          </List.Section>

          <TextInput
            mode="outlined"
            label="Admin notes"
            placeholder="Document safety checks or follow-up"
            value={currentNotes}
            onChangeText={text => setEditorState({childId: child.id, notes: text})}
            style={styles.notesInput}
            multiline
          />

          <View style={styles.actionsRow}>
            <Button
              mode="contained"
              icon="check"
              onPress={() => handleUpdate(child)}
              style={styles.actionButton}>
              Save Notes
            </Button>
            <Button
              mode="outlined"
              icon="delete"
              textColor={theme.colors.error}
              onPress={() => handleDelete(child)}
              style={styles.actionButton}>
              Remove
            </Button>
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
        <Text variant="headlineMedium" style={styles.title}>
          Children Management
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Review child safety information to ensure caregiver readiness.
        </Text>

        <Searchbar
          placeholder="Search by child or parent"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={loadChildren}
          style={styles.searchbar}
        />

        {renderRiskChips()}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>Loading child profiles...</Text>
          </View>
        ) : filteredChildren.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.emptyTitle}>
                No child profiles found
              </Text>
              <Text variant="bodyMedium" style={styles.emptyText}>
                Try refreshing or adjusting your filters.
              </Text>
            </Card.Content>
          </Card>
        ) : (
          filteredChildren.map(renderChildCard)
        )}
      </ScrollView>

      <FAB icon="refresh" onPress={loadChildren} style={styles.fab} disabled={loading} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 96,
  },
  title: {
    textAlign: 'center',
    color: '#3f51b5',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    color: '#666',
    marginBottom: 16,
  },
  searchbar: {
    marginBottom: 12,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  filterChip: {
    marginRight: 8,
    marginBottom: 8,
  },
  loadingContainer: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerText: {
    marginLeft: 12,
    flexShrink: 1,
  },
  subtleText: {
    color: '#666',
  },
  ageChip: {
    backgroundColor: '#e3f2fd',
  },
  notesInput: {
    marginTop: 12,
    marginBottom: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    marginRight: 8,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#3f51b5',
  },
  emptyCard: {
    padding: 12,
    elevation: 0,
    backgroundColor: '#fff',
  },
  emptyTitle: {
    textAlign: 'center',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
  },
});

import React, { useEffect, useState } from 'react';
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
  Portal,
  Dialog,
  TextInput,
} from 'react-native-paper';
import { Icon } from 'react-native-elements';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Job } from '../../types';
import {
  fetchJobById,
  approveJob,
  rejectJob,
  cancelJob,
  completeJob,
  reopenJob,
  updateJob,
  deleteJob,
} from '../../services/jobsService';
import { SkeletonBlock } from '../../components/skeletons/Skeleton';

type RootStackParamList = {
  JobDetail: { jobId: string; editMode?: boolean };
};

type JobDetailScreenRouteProp = RouteProp<RootStackParamList, 'JobDetail'>;
type JobDetailScreenNavigationProp = StackNavigationProp<RootStackParamList>;

export default function JobDetailScreen() {
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editDialogVisible, setEditDialogVisible] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Edit state
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editBudget, setEditBudget] = useState('');
  const [editHourlyRate, setEditHourlyRate] = useState('');

  const navigation = useNavigation<JobDetailScreenNavigationProp>();
  const route = useRoute<JobDetailScreenRouteProp>();

  const { jobId, editMode } = route.params;

  const statusColors: Record<string, string> = {
    pending: '#ff9800',
    open: '#4caf50',
    confirmed: '#2196f3',
    completed: '#673ab7',
    cancelled: '#f44336',
    active: '#4caf50',
    inactive: '#9e9e9e',
  };

  const formatBudgetDetails = (budget: number, hourlyRate?: number) => {
    if (budget > 0 && hourlyRate && hourlyRate > 0) {
      return `Budget: ₱${budget.toLocaleString()} | Hourly: ₱${hourlyRate.toLocaleString()}`;
    } else if (budget > 0) {
      return `Budget: ₱${budget.toLocaleString()}`;
    } else if (hourlyRate && hourlyRate > 0) {
      return `Hourly Rate: ₱${hourlyRate.toLocaleString()}`;
    }
    return "Pricing to be discussed";
  };

  const formatStatusLabel = (status: string) =>
    status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadJob = async () => {
    try {
      console.log('[JobDetailScreen] Loading job:', jobId);
      const fetchedJob = await fetchJobById(jobId);
      if (fetchedJob) {
        console.log('[JobDetailScreen] Job loaded successfully:', {
          id: fetchedJob.id,
          title: fetchedJob.title,
          status: fetchedJob.status,
          budget: fetchedJob.budget,
          hourly_rate: (fetchedJob as any).hourly_rate,
          location: fetchedJob.location,
          parent: fetchedJob.parentId?.name,
          caregiver: fetchedJob.caregiverId?.name,
          updatedAt: fetchedJob.updatedAt,
        });
        setJob(fetchedJob);
        setLastUpdated(new Date());
        // Initialize edit form
        setEditTitle(fetchedJob.title);
        setEditDescription(fetchedJob.description);
        setEditLocation(fetchedJob.location);
        setEditBudget(fetchedJob.budget.toString());
        setEditHourlyRate((fetchedJob as any).hourly_rate?.toString() || '');
      } else {
        console.log('[JobDetailScreen] Job not found');
        Alert.alert('Error', 'Job not found');
        navigation.goBack();
      }
    } catch (error: any) {
      console.error('[JobDetailScreen] Error loading job:', error);
      Alert.alert('Error', error.message || 'Failed to load job details');
      navigation.goBack();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!jobId) {
      Alert.alert('Error', 'Job ID is missing. Cannot load job details.', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
      return;
    }
    loadJob();
  }, [jobId]);

  // Auto-open edit dialog when in edit mode
  useEffect(() => {
    if (job && editMode && !loading) {
      setEditDialogVisible(true);
    }
  }, [job, editMode, loading]);

  const onRefresh = () => {
    setRefreshing(true);
    loadJob();
  };

  const handleJobAction = async (action: 'approve' | 'reject' | 'cancel' | 'complete' | 'reopen') => {
    const actionConfig: Record<typeof action, { title: string; message: string; success: string }> = {
      approve: {
        title: 'Approve Job',
        message: 'Are you sure you want to approve this job?',
        success: 'Job approved successfully.',
      },
      reject: {
        title: 'Reject Job',
        message: 'Are you sure you want to reject this job?',
        success: 'Job rejected successfully.',
      },
      cancel: {
        title: 'Cancel Job',
        message: 'Are you sure you want to cancel this job?',
        success: 'Job cancelled successfully.',
      },
      complete: {
        title: 'Complete Job',
        message: 'Mark this job as completed?',
        success: 'Job marked as completed.',
      },
      reopen: {
        title: 'Reopen Job',
        message: 'Reopen this job for further action?',
        success: 'Job reopened successfully.',
      },
    };

    Alert.alert(actionConfig[action].title, actionConfig[action].message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          try {
            const actionFunctions = {
              approve: approveJob,
              reject: rejectJob,
              cancel: cancelJob,
              complete: completeJob,
              reopen: reopenJob,
            };

            await actionFunctions[action](jobId);
            Alert.alert('Success', actionConfig[action].success);
            console.log('[JobDetailScreen] Status changed, refreshing data...');
            await loadJob(); // Immediately refresh data after status change
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Operation failed');
          }
        },
      },
    ]);
  };

  const handleEditJob = async () => {
    if (!job) return;

    setUpdating(true);
    try {
      await updateJob(jobId, {
        title: editTitle,
        description: editDescription,
        location: editLocation,
        budget: parseFloat(editBudget) || undefined,
        hourly_rate: parseFloat(editHourlyRate) || undefined,
      });

      Alert.alert('Success', 'Job updated successfully');
      console.log('[JobDetailScreen] Job updated, refreshing data...');
      setEditDialogVisible(false);
      await loadJob(); // Refresh data after edit
    } catch (error: any) {
      console.error('[JobDetailScreen] Edit job error:', error);
      Alert.alert('Error', error.message || 'Failed to update job');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteJob = async () => {
    if (!job) return;

    setUpdating(true);
    try {
      await deleteJob(jobId, 'Deleted by administrator');
      Alert.alert('Success', 'Job deleted successfully');
      setDeleteDialogVisible(false);
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to delete job');
    } finally {
      setUpdating(false);
    }
  };

  const showEditDialog = () => {
    setEditDialogVisible(true);
  };

  const showDeleteDialog = () => {
    setDeleteDialogVisible(true);
  };

  const isInitialLoading = loading && !job;

  if (isInitialLoading) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.skeletonContent}>
        <Card style={styles.headerCard}>
          <Card.Content>
            <View style={styles.skeletonHeader}>
              <View style={styles.skeletonHeaderInfo}>
                <SkeletonBlock height={24} width="70%" />
                <SkeletonBlock height={16} width="50%" />
                <View style={styles.skeletonChipRow}>
                  <SkeletonBlock height={32} width={100} borderRadius={18} />
                  <SkeletonBlock height={32} width={120} borderRadius={18} />
                </View>
              </View>
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.detailsCard}>
          <Card.Content>
            <SkeletonBlock height={20} width="50%" borderRadius={6} />
            <View style={styles.skeletonInfoRow}>
              <SkeletonBlock height={16} width="80%" />
            </View>
            <View style={styles.skeletonInfoRow}>
              <SkeletonBlock height={16} width="60%" />
            </View>
            <View style={styles.skeletonInfoRow}>
              <SkeletonBlock height={16} width="70%" />
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.actionsCard}>
          <Card.Content>
            <SkeletonBlock height={20} width="40%" borderRadius={6} />
            <View style={styles.skeletonActionButtons}>
              <SkeletonBlock height={40} width="45%" borderRadius={10} />
              <SkeletonBlock height={40} width="45%" borderRadius={10} />
            </View>
          </Card.Content>
        </Card>
      </ScrollView>
    );
  }

  if (!job) {
    return (
      <View style={styles.errorContainer}>
        <Text>Job not found</Text>
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
            <View style={styles.jobHeader}>
              <View style={styles.jobInfo}>
                <View style={styles.titleRow}>
                  <Text variant="headlineMedium" style={styles.jobTitle}>
                    {job.title}
                  </Text>
                  <Button
                    mode="text"
                    onPress={onRefresh}
                    loading={refreshing}
                    disabled={refreshing}
                    style={styles.refreshButton}>
                    <Icon name="refresh" type="material" size={20} color="#2196f3" />
                  </Button>
                </View>
                <Text variant="bodyLarge" style={styles.jobDescription}>
                  {job.description}
                </Text>
                <View style={styles.jobMeta}>
                  <View style={styles.metaRow}>
                    <Chip
                      style={[
                        styles.statusChip,
                        { backgroundColor: statusColors[job.status] || '#666' }
                      ]}
                      textStyle={{ color: 'white' }}>
                      {formatStatusLabel(job.status)}
                    </Chip>
                    <Text variant="bodySmall" style={styles.jobBudget}>
                      💰 {formatBudgetDetails(job.budget, (job as any).hourly_rate)}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.detailsCard}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.sectionTitle}>
              Job Details
            </Text>

            <View style={styles.infoRow}>
              <Icon name="info" type="material" color="#666" size={20} />
              <Text style={styles.infoText}>
                Status: {formatStatusLabel(job.status)}
                {job.status === 'confirmed' && ' - Job confirmed with caregiver'}
                {job.status === 'completed' && ' - Job completed successfully'}
                {job.status === 'cancelled' && ' - Job was cancelled'}
                {job.status === 'open' && ' - Awaiting caregiver applications'}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Icon name="account-balance-wallet" type="material" color="#4caf50" size={20} />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoText}>{formatBudgetDetails(job.budget, (job as any).hourly_rate)}</Text>
                {job.budget > 0 && (
                  <Text style={styles.infoSubText}>Total budget for the job</Text>
                )}
                {(job as any).hourly_rate && (job as any).hourly_rate > 0 && (
                  <Text style={styles.infoSubText}>Rate per hour of service</Text>
                )}
                {job.budget === 0 && !(job as any).hourly_rate && (
                  <Text style={styles.infoSubText}>Pricing will be discussed with caregiver</Text>
                )}
              </View>
            </View>

            <View style={styles.infoRow}>
              <Icon name="location-on" type="material" color="#666" size={20} />
              <Text style={styles.infoText}>{job.location}</Text>
            </View>

            <View style={styles.infoRow}>
              <Icon name="person" type="material" color="#666" size={20} />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoText}>
                  Parent: {job.parentId?.name || `Parent ${job.parentId?.email?.split('@')[0] || 'User'}`}
                </Text>
                {job.parentId?.email && (
                  <Text style={styles.infoSubText}>{job.parentId.email}</Text>
                )}
                {!job.parentId?.email && job.parentId && (
                  <Text style={styles.infoSubText}>Contact information not available</Text>
                )}
              </View>
            </View>

            {job.caregiverId && (
              <View style={styles.infoRow}>
                <Icon name="support-agent" type="material" color="#666" size={20} />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoText}>
                    Caregiver: {job.caregiverId?.name || `Caregiver ${job.caregiverId?.email?.split('@')[0] || 'User'}`}
                  </Text>
                  {job.caregiverId?.email && (
                    <Text style={styles.infoSubText}>{job.caregiverId.email}</Text>
                  )}
                  {!job.caregiverId?.email && (
                    <Text style={styles.infoSubText}>Contact information not available</Text>
                  )}
                </View>
              </View>
            )}

            {!job.caregiverId && (
              <View style={styles.infoRow}>
                <Icon name="support-agent" type="material" color="#999" size={20} />
                <Text style={styles.infoText}>No caregiver assigned</Text>
              </View>
            )}

            <View style={styles.infoRow}>
              <Icon name="calendar-today" type="material" color="#666" size={20} />
              <Text style={styles.infoText}>
                Created {new Date(job.createdAt).toLocaleDateString()} at {new Date(job.createdAt).toLocaleTimeString()}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Icon name="update" type="material" color="#666" size={20} />
              <Text style={styles.infoText}>
                Updated {new Date(job.updatedAt).toLocaleDateString()} at {new Date(job.updatedAt).toLocaleTimeString()}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Icon name="refresh" type="material" color="#2196f3" size={20} />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoText}>
                  {lastUpdated
                    ? `Last updated ${lastUpdated.toLocaleTimeString()}`
                    : 'Data loaded successfully'
                  }
                </Text>
                <Text style={styles.infoSubText}>
                  {refreshing ? 'Refreshing...' : 'Pull down or tap refresh button to update'}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.actionsCard}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.sectionTitle}>
              Actions
            </Text>

            <View style={styles.actionsGrid}>
              <Button
                mode="outlined"
                onPress={showEditDialog}
                style={[styles.actionButton, { borderColor: '#2196f3' }]}
                textColor="#2196f3">
                <Icon name="edit" type="material" size={16} />
                Edit Job
              </Button>

              {['pending', 'open', 'inactive'].includes(job.status) && (
                <Button
                  mode="outlined"
                  onPress={() => handleJobAction('approve')}
                  style={[styles.actionButton, { borderColor: '#4caf50' }]}
                  textColor="#4caf50">
                  <Icon name="check-circle" type="material" size={16} />
                  Approve
                </Button>
              )}

              {['pending', 'open', 'inactive'].includes(job.status) && (
                <Button
                  mode="outlined"
                  onPress={() => handleJobAction('reject')}
                  style={[styles.actionButton, { borderColor: '#ff5722' }]}
                  textColor="#ff5722">
                  <Icon name="highlight-off" type="material" size={16} />
                  Reject
                </Button>
              )}

              {['confirmed', 'open', 'active'].includes(job.status) && (
                <Button
                  mode="outlined"
                  onPress={() => handleJobAction('complete')}
                  style={[styles.actionButton, { borderColor: '#673ab7' }]}
                  textColor="#673ab7">
                  <Icon name="task-alt" type="material" size={16} />
                  Complete
                </Button>
              )}

              {job.status !== 'cancelled' && (
                <Button
                  mode="outlined"
                  onPress={() => handleJobAction('cancel')}
                  style={[styles.actionButton, { borderColor: '#f44336' }]}
                  textColor="#f44336">
                  <Icon name="cancel" type="material" size={16} />
                  Cancel
                </Button>
              )}

              {['cancelled', 'completed', 'inactive'].includes(job.status) && (
                <Button
                  mode="outlined"
                  onPress={() => handleJobAction('reopen')}
                  style={[styles.actionButton, { borderColor: '#ff9800' }]}
                  textColor="#ff9800">
                  <Icon name="autorenew" type="material" size={16} />
                  Reopen
                </Button>
              )}

              <Button
                mode="outlined"
                onPress={showDeleteDialog}
                style={[styles.actionButton, { borderColor: '#f44336' }]}
                textColor="#f44336">
                <Icon name="delete" type="material" size={16} />
                Delete
              </Button>
            </View>
          </Card.Content>
        </Card>
      </View>

      {/* Edit Dialog */}
      <Portal>
        <Dialog
          visible={editDialogVisible}
          onDismiss={() => setEditDialogVisible(false)}
          style={styles.dialog}>
          <Dialog.Title>Edit Job</Dialog.Title>
          <Dialog.ScrollArea style={styles.dialogScrollArea}>
            <ScrollView>
              <TextInput
                label="Job Title"
                value={editTitle}
                onChangeText={setEditTitle}
                style={styles.dialogInput}
              />
              <TextInput
                label="Description"
                value={editDescription}
                onChangeText={setEditDescription}
                style={styles.dialogInput}
                multiline
                numberOfLines={3}
              />
              <TextInput
                label="Location"
                value={editLocation}
                onChangeText={setEditLocation}
                style={styles.dialogInput}
              />
              <TextInput
                label="Budget (₱)"
                value={editBudget}
                onChangeText={setEditBudget}
                style={styles.dialogInput}
                keyboardType="numeric"
              />
              <TextInput
                label="Hourly Rate (₱)"
                value={editHourlyRate}
                onChangeText={setEditHourlyRate}
                style={styles.dialogInput}
                keyboardType="numeric"
              />
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setEditDialogVisible(false)}>
              Cancel
            </Button>
            <Button
              onPress={handleEditJob}
              loading={updating}
              disabled={updating}>
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Delete Dialog */}
      <Portal>
        <Dialog
          visible={deleteDialogVisible}
          onDismiss={() => setDeleteDialogVisible(false)}>
          <Dialog.Title>Delete Job</Dialog.Title>
          <Dialog.Content>
            <Text>Are you sure you want to delete this job? This action cannot be undone.</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteDialogVisible(false)}>
              Cancel
            </Button>
            <Button
              onPress={handleDeleteJob}
              loading={updating}
              disabled={updating}
              textColor="#f44336">
              Delete
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
  skeletonContent: {
    padding: 16,
    gap: 16,
  },
  skeletonHeader: {
    gap: 12,
  },
  skeletonHeaderInfo: {
    flex: 1,
    gap: 8,
  },
  skeletonChipRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  skeletonInfoRow: {
    marginTop: 16,
  },
  skeletonActionButtons: {
    marginTop: 16,
    gap: 12,
  },
  content: {
    padding: 16,
  },
  headerCard: {
    marginBottom: 16,
    elevation: 4,
  },
  jobHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  jobInfo: {
    flex: 1,
  },
  jobTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  jobDescription: {
    color: '#666',
    marginBottom: 12,
  },
  jobMeta: {
    flexDirection: 'column',
    gap: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  refreshButton: {
    marginLeft: 8,
  },
  statusChip: {
    alignSelf: 'flex-start',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  jobBudget: {
    color: '#4caf50',
    fontWeight: 'bold',
    fontSize: 14,
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
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  infoTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  infoText: {
    fontSize: 14,
    marginBottom: 2,
  },
  infoSubText: {
    fontSize: 12,
    color: '#666',
  },
  actionsCard: {
    marginBottom: 16,
    elevation: 2,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    minWidth: '45%',
    borderWidth: 1,
    marginBottom: 4,
  },
  dialog: {
    maxHeight: '80%',
  },
  dialogScrollArea: {
    maxHeight: 400,
  },
  dialogInput: {
    marginBottom: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
});

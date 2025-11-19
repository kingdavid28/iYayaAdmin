import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Alert,
  Platform,
} from "react-native";
import {
  Text,
  Card,
  FAB,
  Searchbar,
  Chip,
  Surface,
} from "react-native-paper";
import { Icon } from "react-native-elements";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { Job } from "../../types";
import {
  fetchJobs,
  approveJob,
  rejectJob,
  cancelJob,
  completeJob,
  reopenJob,
  type FetchJobsOptions,
} from "../../services/jobsService";
import { SkeletonBlock, SkeletonCircle } from "../../components/skeletons/Skeleton";

type RootStackParamList = {
  JobDetail: { jobId: string; editMode?: boolean };
};

type JobsScreenNavigationProp = StackNavigationProp<RootStackParamList>;

export default function JobsScreen() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [jobStats, setJobStats] = useState({
    total: 0,
    active: 0,
    filled: 0,
    completed: 0,
    cancelled: 0,
  });
  const navigation = useNavigation<JobsScreenNavigationProp>();

  const jobStatuses = useMemo(
    () => [
      { label: "All Jobs", value: "all" },
      { label: "Active", value: "active" },
      { label: "Filled", value: "filled" },
      { label: "Completed", value: "completed" },
      { label: "Cancelled", value: "cancelled" },
    ],
  []);

  const statusColors: Record<string, string> = {
    active: "#4caf50",
    filled: "#2196f3",
    completed: "#673ab7",
    cancelled: "#f44336",
  };

  const formatBudgetDisplay = (budget: number) => {
    if (budget > 0) {
      return `₱${budget}`;
    }
    return "Contact for pricing";
  };

  const formatStatusLabel = (status: string) =>
    status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

  const loadJobs = useCallback(
    async (pageNum = 1, refresh = false, overrides: Partial<FetchJobsOptions> = {}) => {
      if (pageNum === 1 && !refresh) {
        setLoading(true);
      }

      try {
        const statusFilter = overrides.status ?? selectedStatus;
        const searchFilter = overrides.search ?? searchQuery;
        const limit = overrides.limit ?? 20;

        const options: FetchJobsOptions = {
          page: pageNum,
          limit,
          status: statusFilter !== "all" ? statusFilter : undefined,
          search: searchFilter?.trim() || undefined,
        };

        const { jobs: fetchedJobs, pagination, stats } = await fetchJobs(options);

        if (refresh || pageNum === 1) {
          setJobs(fetchedJobs);
        } else {
          setJobs((prev) => [...prev, ...fetchedJobs]);
        }

        setHasMore(pagination.hasMore);
        setPage(pagination.page);
        setJobStats(stats);
      } catch (error: any) {
        Alert.alert("Error", error.message || "Failed to load jobs");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [searchQuery, selectedStatus],
  );

  useEffect(() => {
    loadJobs(1, true);
  }, [loadJobs]);

  const onRefresh = () => {
    setRefreshing(true);
    loadJobs(1, true);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setPage(1);
    loadJobs(1, true, { search: query });
  };

  const handleStatusChange = (status: string) => {
    setSelectedStatus(status);
    setPage(1);
    loadJobs(1, true, { status });
  };

  const handleJobAction = (
    job: Job,
    action: "approve" | "reject" | "cancel" | "complete" | "reopen",
  ) => {
    const actionConfig: Record<
      typeof action,
      {
        title: string;
        message: string;
        success: string;
        execute: (jobId: string) => Promise<Job>;
      }
    > = {
      approve: {
        title: "Approve Job",
        message: "Are you sure you want to approve this job?",
        success: "Job approved successfully.",
        execute: (jobId: string) => approveJob(jobId),
      },
      reject: {
        title: "Reject Job",
        message: "Are you sure you want to reject this job?",
        success: "Job rejected successfully.",
        execute: (jobId: string) => rejectJob(jobId),
      },
      cancel: {
        title: "Cancel Job",
        message: "Are you sure you want to cancel this job?",
        success: "Job cancelled successfully.",
        execute: (jobId: string) => cancelJob(jobId),
      },
      complete: {
        title: "Complete Job",
        message: "Mark this job as completed?",
        success: "Job marked as completed.",
        execute: (jobId: string) => completeJob(jobId),
      },
      reopen: {
        title: "Reopen Job",
        message: "Reopen this job for further action?",
        success: "Job reopened successfully.",
        execute: (jobId: string) => reopenJob(jobId),
      },
    };

    const config = actionConfig[action];
    Alert.alert(config.title, config.message, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: async () => {
          try {
            await config.execute(job.id);
            Alert.alert("Success", config.success);
            loadJobs(1, true);
          } catch (error: any) {
            Alert.alert("Error", error.message || "Operation failed");
          }
        },
      },
    ]);
  };

  const navigateToJobDetail = (job: Job) => {
    if (!job.id) {
      Alert.alert("Error", "Job ID is missing. Cannot view job details.");
      return;
    }
    navigation.navigate("JobDetail", { jobId: job.id });
  };

  const navigateToJobEdit = (job: Job) => {
    if (!job.id) {
      Alert.alert("Error", "Job ID is missing. Cannot edit job.");
      return;
    }
    navigation.navigate("JobDetail", { jobId: job.id, editMode: true });
  };

  const renderJobCard = ({ item: job }: { item: Job }) => (
    <Card style={styles.jobCard} onPress={() => navigateToJobDetail(job)}>
      <Card.Content>
        <View style={styles.jobHeader}>
          <View style={styles.jobInfo}>
            <Text variant="titleMedium" style={styles.jobTitle}>
              {job.title}
            </Text>
            <Text variant="bodyMedium" style={styles.jobDescription}>
              {job.description.length > 100
                ? `${job.description.substring(0, 100)}...`
                : job.description}
            </Text>
            <Text variant="bodySmall" style={styles.jobLocation}>
              📍 {job.location}
            </Text>
            <Text variant="bodySmall" style={styles.jobBudget}>
              💰 {formatBudgetDisplay(job.budget)}
            </Text>
          </View>
          <View style={styles.jobActions}>
            <Chip
              style={[
                styles.statusChip,
                { backgroundColor: statusColors[job.status] || "#666" },
              ]}
              textStyle={styles.statusChipLabel}
            >
              {formatStatusLabel(job.status)}
            </Chip>
          </View>
        </View>

        <View style={styles.jobMeta}>
          <Text variant="bodySmall" style={styles.jobParent}>
            Parent: {job.parentId.name} ({job.parentId.email})
          </Text>
          {job.caregiverId && (
            <Text variant="bodySmall" style={styles.jobCaregiver}>
              Caregiver: {job.caregiverId.name} ({job.caregiverId.email})
            </Text>
          )}
        </View>

        <View style={styles.jobActionsRow}>
          <Icon
            name="visibility"
            type="material"
            color="#4caf50"
            size={20}
            onPress={() => navigateToJobDetail(job)}
          />
          <Icon
            name="edit"
            type="material"
            color="#2196f3"
            size={20}
            onPress={() => navigateToJobEdit(job)}
          />
          <View style={styles.actionButtons}>
            {/* Approve: move from active to filled */}
            {job.status === "active" && (
              <Icon
                name="check-circle"
                type="material"
                color="#4caf50"
                size={20}
                onPress={() => handleJobAction(job, "approve")}
              />
            )}
            {/* Reject: treat as cancelled */}
            {job.status === "active" && (
              <Icon
                name="highlight-off"
                type="material"
                color="#ff5722"
                size={20}
                onPress={() => handleJobAction(job, "reject")}
              />
            )}
            {/* Complete from filled */}
            {job.status === "filled" && (
              <Icon
                name="task-alt"
                type="material"
                color="#2196f3"
                size={20}
                onPress={() => handleJobAction(job, "complete")}
              />
            )}
            {/* Cancel from active or filled */}
            {["active", "filled"].includes(job.status) && (
              <Icon
                name="cancel"
                type="material"
                color="#f44336"
                size={20}
                onPress={() => handleJobAction(job, "cancel")}
              />
            )}
            {/* Reopen moves cancelled/completed back to active */}
            {["cancelled", "completed"].includes(job.status) && (
              <Icon
                name="autorenew"
                type="material"
                color="#ff9800"
                size={20}
                onPress={() => handleJobAction(job, "reopen")}
              />
            )}
          </View>
        </View>
      </Card.Content>
    </Card>
  );

  const isInitialLoading = loading && jobs.length === 0;

  if (isInitialLoading) {
    return (
      <View style={styles.loadingContainer}>
        <FlatList
          data={Array.from({ length: 4 })}
          keyExtractor={(_, index) => `job-skeleton-${index}`}
          renderItem={({ index }) => (
            <View style={styles.skeletonCard}>
              <SkeletonBlock height={20} width="55%" />
              <SkeletonBlock height={14} width="80%" />
              <SkeletonBlock height={14} width="65%" />
              <View style={styles.skeletonMetaRow}>
                <SkeletonBlock height={12} width="60%" />
                <SkeletonBlock height={12} width="40%" />
              </View>
              <View style={styles.skeletonActionRow}>
                {Array.from({ length: 3 }).map((_, actionIndex) => (
                  <SkeletonCircle key={`skeleton-circle-${index}-${actionIndex}`} size={28} />
                ))}
              </View>
            </View>
          )}
          contentContainerStyle={styles.skeletonList}
          showsVerticalScrollIndicator={false}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Searchbar
          placeholder="Search jobs..."
          onChangeText={handleSearch}
          value={searchQuery}
          style={styles.searchBar}
        />

        <Surface style={styles.statsCard} elevation={1}>
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text variant="headlineSmall" style={styles.statNumber}>
                {jobStats.total}
              </Text>
              <Text variant="bodySmall" style={styles.statLabel}>
                Total
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text
                variant="headlineSmall"
                style={[styles.statNumber, styles.statActive]}
              >
                {jobStats.active}
              </Text>
              <Text variant="bodySmall" style={styles.statLabel}>
                Active
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text
                variant="headlineSmall"
                style={[styles.statNumber, styles.statInactive]}
              >
                {jobStats.filled}
              </Text>
              <Text variant="bodySmall" style={styles.statLabel}>
                Filled
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text
                variant="headlineSmall"
                style={[styles.statNumber, styles.statCompleted]}
              >
                {jobStats.completed}
              </Text>
              <Text variant="bodySmall" style={styles.statLabel}>
                Completed
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text
                variant="headlineSmall"
                style={[styles.statNumber, styles.statCancelled]}
              >
                {jobStats.cancelled}
              </Text>
              <Text variant="bodySmall" style={styles.statLabel}>
                Cancelled
              </Text>
            </View>
          </View>
        </Surface>

        <View style={styles.filters}>
          {jobStatuses.map((status) => (
            <Chip
              key={status.value}
              selected={selectedStatus === status.value}
              onPress={() => handleStatusChange(status.value)}
              style={styles.filterChip}
            >
              {status.label}
            </Chip>
          ))}
        </View>
      </View>

      <FlatList
        data={jobs}
        renderItem={renderJobCard}
        keyExtractor={(job) => job.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onEndReached={() => {
          if (hasMore && !loading) {
            loadJobs(page + 1);
          }
        }}
        onEndReachedThreshold={0.1}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text>No jobs found</Text>
          </View>
        }
      />

      <FAB
        icon="briefcase-outline"
        onPress={() => Alert.alert("Create Job", "Feature coming soon!")}
        style={styles.fab}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  skeletonList: {
    width: "100%",
    paddingHorizontal: 16,
    gap: 16,
  },
  skeletonCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    gap: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
      web: {
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
      },
      default: {},
    }),
  },
  skeletonTitle: {
    height: 20,
    width: "60%",
    backgroundColor: "#e0e0e0",
    borderRadius: 10,
  },
  skeletonLineShort: {
    height: 14,
    width: "40%",
    backgroundColor: "#e0e0e0",
    borderRadius: 8,
  },
  skeletonLine: {
    height: 14,
    width: "80%",
    backgroundColor: "#e0e0e0",
    borderRadius: 8,
  },
  skeletonFooter: {
    height: 18,
    width: "50%",
    backgroundColor: "#e0e0e0",
    borderRadius: 9,
  },
  skeletonMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  skeletonActionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  loadingText: {
    marginTop: 16,
  },
  header: {
    padding: 16,
    backgroundColor: "white",
    elevation: 2,
  },
  searchBar: {
    marginBottom: 16,
  },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  filterChip: {
    marginRight: 8,
    marginBottom: 8,
  },
  statsCard: {
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    paddingVertical: 12,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 8,
  },
  statItem: {
    alignItems: "center",
  },
  statNumber: {
    fontWeight: "bold",
    color: "#333",
  },
  statLabel: {
    color: "#666",
    marginTop: 4,
  },
  statActive: {
    color: "#4caf50",
  },
  statInactive: {
    color: "#ff9800",
  },
  statCompleted: {
    color: "#2196f3",
  },
  statCancelled: {
    color: "#f44336",
  },
  jobCard: {
    margin: 8,
    elevation: 2,
  },
  jobHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  jobInfo: {
    flex: 1,
  },
  jobTitle: {
    fontWeight: "bold",
    marginBottom: 4,
  },
  jobDescription: {
    color: "#666",
    marginBottom: 8,
  },
  jobLocation: {
    color: "#666",
    marginBottom: 4,
  },
  jobBudget: {
    color: "#4caf50",
    fontWeight: "bold",
    marginBottom: 8,
  },
  jobActions: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 8,
  },
  statusChip: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    minHeight: 28,
    justifyContent: "center",
  },
  statusChipLabel: {
    color: "#fff",
    fontWeight: "600",
    lineHeight: 16,
  },
  jobMeta: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  jobParent: {
    color: "#666",
    marginBottom: 4,
  },
  jobCaregiver: {
    color: "#666",
  },
  jobActionsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
  },
  fab: {
    position: "absolute",
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: "#3f51b5",
  },
});

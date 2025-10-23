import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Alert,
} from "react-native";
import {
  Text,
  Card,
  FAB,
  Chip,
  Menu,
  ActivityIndicator,
  useTheme,
} from "react-native-paper";
import { Icon } from "react-native-elements";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { Booking } from "../../types";
import {
  fetchBookings,
  updateBookingStatus,
  confirmBooking,
  startBooking,
  completeBooking,
  cancelBooking,
  type FetchBookingsOptions,
} from "../../services/bookingsService";
import { SkeletonBlock, SkeletonCircle } from "../../components/skeletons/Skeleton";

type RootStackParamList = {
  BookingDetail: { bookingId: string; booking?: Booking };
};

type BookingsScreenNavigationProp = StackNavigationProp<RootStackParamList>;

export default function BookingsScreen() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [menuVisibleId, setMenuVisibleId] = useState<string | null>(null);
  const navigation = useNavigation<BookingsScreenNavigationProp>();
  const theme = useTheme();

  const bookingStatuses = useMemo(
    () => [
      { label: "All Bookings", value: "all" },
      { label: "Pending", value: "pending" },
      { label: "Confirmed", value: "confirmed" },
      { label: "In Progress", value: "in_progress" },
      { label: "Completed", value: "completed" },
      { label: "Cancelled", value: "cancelled" },
      { label: "No Show", value: "no_show" },
    ],
  []);

  const statusColors: Record<string, string> = {
    pending: "#ff9800",
    confirmed: "#2196f3",
    in_progress: "#9c27b0",
    completed: "#4caf50",
    cancelled: "#f44336",
    no_show: "#795548",
  };

  const formatStatusLabel = (status: string) =>
    status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

  const loadBookings = useCallback(
    async (pageNum = 1, refresh = false, overrides: Partial<FetchBookingsOptions> = {}) => {
      if (pageNum === 1 && !refresh) {
        setLoading(true);
      }

      try {
        const statusFilter = overrides.status ?? selectedStatus;
        const limit = overrides.limit ?? 20;

        const options: FetchBookingsOptions = {
          page: pageNum,
          limit,
          status: statusFilter !== "all" ? statusFilter : undefined,
        };

        const { bookings: fetchedBookings, pagination } = await fetchBookings(options);

        if (refresh || pageNum === 1) {
          setBookings(fetchedBookings);
        } else {
          setBookings((prev) => [...prev, ...fetchedBookings]);
        }

        setHasMore(pagination.hasMore);
        setPage(pagination.page);
      } catch (error: any) {
        Alert.alert("Error", error.message || "Failed to load bookings");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedStatus],
  );

  useEffect(() => {
    loadBookings(1, true);
  }, [loadBookings]);

  const onRefresh = () => {
    setRefreshing(true);
    loadBookings(1, true);
  };

  const handleStatusChange = (status: string) => {
    setSelectedStatus(status);
    setPage(1);
  };

  const handleBookingAction = (
    booking: Booking,
    action: "confirm" | "start" | "complete" | "cancel" | "no_show",
  ) => {
    const actionConfig: Record<
      typeof action,
      {
        title: string;
        message: string;
        success: string;
        execute: () => Promise<Booking>;
      }
    > = {
      confirm: {
        title: "Confirm Booking",
        message: "Confirm this booking?",
        success: "Booking confirmed successfully.",
        execute: () => confirmBooking(booking.id),
      },
      start: {
        title: "Start Booking",
        message: "Mark this booking as in progress?",
        success: "Booking marked as in progress.",
        execute: () => startBooking(booking.id),
      },
      complete: {
        title: "Complete Booking",
        message: "Mark this booking as completed?",
        success: "Booking marked as completed.",
        execute: () => completeBooking(booking.id),
      },
      cancel: {
        title: "Cancel Booking",
        message: "Cancel this booking?",
        success: "Booking cancelled successfully.",
        execute: () => cancelBooking(booking.id),
      },
      no_show: {
        title: "Mark No Show",
        message: "Mark this booking as no-show?",
        success: "Booking marked as no-show.",
        execute: () => updateBookingStatus(booking.id, "no_show"),
      },
    };

    const config = actionConfig[action];

    Alert.alert(config.title, config.message, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: async () => {
          try {
            await config.execute();
            Alert.alert("Success", config.success);
            loadBookings(1, true);
          } catch (error: any) {
            Alert.alert("Error", error.message || "Operation failed");
          }
        },
      },
    ]);
  };

  const navigateToBookingDetail = (booking: Booking) => {
    navigation.navigate("BookingDetail", { bookingId: booking.id, booking });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const renderBookingCard = ({ item: booking }: { item: Booking }) => (
    <Card
      style={styles.bookingCard}
      onPress={() => navigateToBookingDetail(booking)}
      accessible
      accessibilityRole="button"
      accessibilityHint="Opens booking details"
    >
      <Card.Content>
        <View style={styles.bookingHeader}>
          <View style={styles.bookingInfo}>
            <Text variant="titleMedium" style={styles.bookingJob}>
              {booking.jobId.title}
            </Text>
            <Text variant="bodySmall" style={styles.bookingLocation}>
              📍 {booking.jobId.location}
            </Text>
            <Text variant="bodySmall" style={styles.bookingDates}>
              📅 {formatDate(booking.startDate)} - {formatDate(booking.endDate)}
            </Text>
            <Text variant="bodySmall" style={styles.bookingHours}>
              ⏰ {booking.totalHours} hours • ₱{booking.hourlyRate}/hr
            </Text>
            <Text variant="bodySmall" style={styles.bookingTotal}>
              💰 Total: ₱{booking.totalAmount}
            </Text>
          </View>
          <View style={styles.bookingActions}>
            <Chip
              style={[
                styles.statusChip,
                { backgroundColor: statusColors[booking.status] || "#666" },
              ]}
              textStyle={styles.statusChipLabel}
            >
              {formatStatusLabel(booking.status)}
            </Chip>
          </View>
        </View>

        <View style={styles.bookingMeta}>
          <Text variant="bodySmall" style={styles.bookingParent}>
            👤 Parent: {booking.parentId.name}
          </Text>
          <Text variant="bodySmall" style={styles.bookingCaregiver}>
            👩‍⚕️ Caregiver: {booking.caregiverId.name}
          </Text>
        </View>

        <View style={styles.bookingActionsRow}>
          <Icon
            name="visibility"
            type="material"
            color="#4caf50"
            size={20}
            onPress={() => navigateToBookingDetail(booking)}
            accessibilityLabel="View booking details"
          />
          <Icon
            name="edit"
            type="material"
            color="#2196f3"
            size={20}
            onPress={() => navigateToBookingDetail(booking)}
            accessibilityLabel="Edit booking"
          />
          <Menu
            visible={menuVisibleId === booking.id}
            onDismiss={() => setMenuVisibleId(null)}
            anchor={
              <Icon
                name="more-vert"
                type="material"
                color="#666"
                size={20}
                onPress={() => setMenuVisibleId(booking.id)}
              />
            }
          >
            <Menu.Item
              title="View Details"
              onPress={() => {
                setMenuVisibleId(null);
                navigateToBookingDetail(booking);
              }}
            />
            <Menu.Item
              title="Mark Confirmed"
              onPress={() => {
                setMenuVisibleId(null);
                handleBookingAction(booking, "confirm");
              }}
            />
            <Menu.Item
              title="Mark In Progress"
              onPress={() => {
                setMenuVisibleId(null);
                handleBookingAction(booking, "start");
              }}
            />
            <Menu.Item
              title="Mark Completed"
              onPress={() => {
                setMenuVisibleId(null);
                handleBookingAction(booking, "complete");
              }}
            />
            <Menu.Item
              title="Cancel Booking"
              onPress={() => {
                setMenuVisibleId(null);
                handleBookingAction(booking, "cancel");
              }}
            />
            <Menu.Item
              title="Mark No Show"
              onPress={() => {
                setMenuVisibleId(null);
                handleBookingAction(booking, "no_show");
              }}
            />
          </Menu>
        </View>
      </Card.Content>
    </Card>
  );

  const isInitialLoading = loading && bookings.length === 0;

  if (isInitialLoading) {
    return (
      <View style={styles.loadingContainer}>
        <FlatList
          data={Array.from({ length: 4 })}
          keyExtractor={(_, index) => `booking-skeleton-${index}`}
          renderItem={({ index }) => (
            <View style={styles.skeletonCard}>
              <SkeletonBlock height={20} width="60%" />
              <SkeletonBlock height={14} width="70%" />
              <SkeletonBlock height={14} width="50%" />
              <View style={styles.skeletonMetaRow}>
                <SkeletonBlock height={12} width="45%" />
                <SkeletonBlock height={12} width="35%" />
              </View>
              <View style={styles.skeletonActionRow}>
                {Array.from({ length: 3 }).map((_, actionIndex) => (
                  <SkeletonCircle key={`booking-skeleton-${index}-action-${actionIndex}`} size={28} />
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
        <View style={styles.filters}>
          {bookingStatuses.map((status) => (
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
        data={bookings}
        renderItem={renderBookingCard}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onEndReached={() => {
          if (hasMore && !loading) {
            loadBookings(page + 1);
          }
        }}
        onEndReachedThreshold={0.1}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text>No bookings found</Text>
          </View>
        }
      />

      <FAB
        icon="calendar-plus"
        onPress={() => Alert.alert("Create Booking", "Feature coming soon!")}
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
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 1,
    gap: 12,
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
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  filterChip: {
    marginRight: 8,
    marginBottom: 8,
  },
  bookingCard: {
    margin: 8,
    elevation: 2,
  },
  bookingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  bookingInfo: {
    flex: 1,
  },
  bookingJob: {
    fontWeight: "bold",
    marginBottom: 4,
  },
  bookingLocation: {
    color: "#666",
    marginBottom: 4,
  },
  bookingDates: {
    color: "#666",
    marginBottom: 4,
  },
  bookingHours: {
    color: "#666",
    marginBottom: 4,
  },
  bookingTotal: {
    color: "#4caf50",
    fontWeight: "bold",
    marginBottom: 8,
  },
  bookingActions: {
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
  bookingMeta: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  bookingParent: {
    color: "#666",
    marginBottom: 4,
  },
  bookingCaregiver: {
    color: "#666",
  },
  bookingActionsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#eee",
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

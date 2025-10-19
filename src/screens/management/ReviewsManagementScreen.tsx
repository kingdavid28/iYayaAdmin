import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {View, StyleSheet, ScrollView, RefreshControl, Alert} from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  FAB,
  Searchbar,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import {Icon} from 'react-native-elements';
import {Review} from '../../types';
import {
  fetchReviews,
  updateReviewStatus,
  deleteReview,
} from '../../services/reviewsService';

interface ReviewActionState {
  note: string;
  reviewId: string | null;
}

const STATUS_FILTERS: Array<{label: string; value: 'all' | 'published' | 'hidden'}> = [
  {label: 'All', value: 'all'},
  {label: 'Published', value: 'published'},
  {label: 'Hidden', value: 'hidden'},
];

const RATING_FILTERS = [0, 5, 4, 3, 2, 1] as const;

export default function ReviewsManagementScreen() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]['value']>('all');
  const [ratingFilter, setRatingFilter] = useState<(typeof RATING_FILTERS)[number]>(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionState, setActionState] = useState<ReviewActionState>({note: '', reviewId: null});
  const theme = useTheme();

  const filteredReviews = useMemo(() => {
    return reviews.filter(review => {
      const matchesStatus =
        statusFilter === 'all' || (review.status ?? 'published') === statusFilter;
      const matchesRating = ratingFilter === 0 || review.rating === ratingFilter;
      const matchesSearch =
        !searchQuery.trim() ||
        review.comment?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        review.reviewerInfo?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        review.revieweeInfo?.name?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesRating && matchesSearch;
    });
  }, [ratingFilter, reviews, searchQuery, statusFilter]);

  const loadReviews = useCallback(async () => {
    try {
      if (!refreshing) {
        setLoading(true);
      }
      const fetchedReviews = await fetchReviews({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        rating: ratingFilter > 0 ? ratingFilter : undefined,
        search: searchQuery.trim() ? searchQuery.trim() : undefined,
      });
      setReviews(fetchedReviews);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load reviews');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [ratingFilter, refreshing, searchQuery, statusFilter]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadReviews();
  };

  const handleChangeStatus = async (reviewId: string, status: 'published' | 'hidden') => {
    try {
      const note = actionState.reviewId === reviewId ? actionState.note.trim() : '';
      await updateReviewStatus(reviewId, status, note || undefined);
      setActionState({note: '', reviewId: null});
      await loadReviews();
      Alert.alert('Success', `Review has been ${status === 'hidden' ? 'hidden' : 'published'}.`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Unable to update review status');
    }
  };

  const handleDelete = (reviewId: string) => {
    Alert.alert(
      'Delete Review',
      'Are you sure you want to permanently delete this review?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteReview(reviewId);
              setActionState({note: '', reviewId: null});
              await loadReviews();
              Alert.alert('Deleted', 'Review removed successfully.');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete review');
            }
          },
        },
      ],
    );
  };

  const renderReviewCard = (review: Review) => {
    const status = review.status ?? 'published';
    return (
      <Card key={review.id} style={styles.card}>
        <Card.Content>
          <View style={styles.headerRow}>
            <View style={styles.reviewerInfo}>
              <Icon name="person" type="material" color={theme.colors.primary} size={22} />
              <View style={styles.headerText}>
                <Text variant="titleMedium">{review.reviewerInfo?.name ?? 'Anonymous'}</Text>
                <Text variant="bodySmall" style={styles.emailText}>
                  {review.reviewerInfo?.email ?? 'No email provided'}
                </Text>
              </View>
            </View>
            <Chip
              icon="star"
              style={styles.ratingChip}
              textStyle={styles.ratingText}>
              {review.rating.toFixed(1)}
            </Chip>
          </View>

          <View style={styles.divider} />

          <Text variant="bodyMedium" style={styles.commentText}>
            {review.comment ?? 'No comment provided.'}
          </Text>

          <View style={styles.metaRow}>
            <Chip icon="person-pin" style={styles.metaChip}>
              {review.revieweeInfo?.name ?? 'Unknown caregiver'}
            </Chip>
            <Chip icon="event" style={styles.metaChip}>
              {new Date(review.createdAt).toLocaleDateString()}
            </Chip>
            <Chip icon="check-circle" style={styles.metaChip}>
              {status === 'hidden' ? 'Hidden' : 'Published'}
            </Chip>
          </View>

          <TextInput
            mode="outlined"
            label="Moderation note (optional)"
            placeholder="Document reason for action"
            value={actionState.reviewId === review.id ? actionState.note : ''}
            onChangeText={value => setActionState({reviewId: review.id, note: value})}
            style={styles.noteInput}
            multiline
          />

          <View style={styles.actionsRow}>
            <Button
              mode="contained"
              icon={status === 'hidden' ? 'eye' : 'eye-off'}
              onPress={() => handleChangeStatus(review.id, status === 'hidden' ? 'published' : 'hidden')}
              style={styles.actionButton}>
              {status === 'hidden' ? 'Publish' : 'Hide'}
            </Button>
            <Button
              mode="outlined"
              icon="delete"
              textColor={theme.colors.error}
              onPress={() => handleDelete(review.id)}
              style={styles.actionButton}>
              Delete
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
          Reviews Management
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Moderate caregiver feedback, resolve disputes, and ensure quality service.
        </Text>

        <Searchbar
          placeholder="Search by reviewer, caregiver, or comment"
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchbar}
        />

        <View style={styles.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {STATUS_FILTERS.map(filter => (
              <Chip
                key={filter.value}
                mode={statusFilter === filter.value ? 'flat' : 'outlined'}
                onPress={() => setStatusFilter(filter.value)}
                style={styles.filterChip}>
                {filter.label}
              </Chip>
            ))}
            {RATING_FILTERS.map(rating => (
              <Chip
                key={rating}
                mode={ratingFilter === rating ? 'flat' : 'outlined'}
                onPress={() => setRatingFilter(rating)}
                style={styles.filterChip}
                icon="star">
                {rating === 0 ? 'All Ratings' : `${rating} Stars`}
              </Chip>
            ))}
          </ScrollView>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>Loading reviews...</Text>
          </View>
        ) : filteredReviews.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.emptyTitle}>
                No reviews found
              </Text>
              <Text variant="bodyMedium" style={styles.emptyText}>
                Adjust your filters or refresh to see the latest reviews.
              </Text>
            </Card.Content>
          </Card>
        ) : (
          filteredReviews.map(renderReviewCard)
        )}
      </ScrollView>

      <FAB icon="refresh" onPress={loadReviews} style={styles.fab} disabled={loading} />
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
  filterRow: {
    marginBottom: 16,
  },
  filterChip: {
    marginRight: 8,
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  headerText: {
    marginLeft: 12,
    flexShrink: 1,
  },
  emailText: {
    color: '#666',
  },
  ratingChip: {
    backgroundColor: '#ffca28',
  },
  ratingText: {
    fontWeight: 'bold',
  },
  divider: {
    marginVertical: 12,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e0e0e0',
  },
  commentText: {
    marginBottom: 12,
    color: '#424242',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  metaChip: {
    marginRight: 8,
    marginBottom: 8,
  },
  noteInput: {
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

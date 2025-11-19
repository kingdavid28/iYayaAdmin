import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {View, StyleSheet, FlatList, ScrollView, RefreshControl, Alert, Animated, Vibration, Platform} from 'react-native';
import {
  Button,
  Card,
  Chip,
  FAB,
  Searchbar,
  Text,
  TextInput,
  useTheme,
  Surface,
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
  const [updatingReview, setUpdatingReview] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'rating'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const theme = useTheme();

  const filteredReviews = useMemo(() => {
    let filtered = reviews.filter(review => {
      const matchesStatus =
        statusFilter === 'all' || (review.status ?? 'published') === statusFilter;
      const matchesRating = ratingFilter === 0 || review.rating === ratingFilter;
      const matchesSearch =
        !searchQuery.trim() ||
        review.comment?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (review.reviewerInfo?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
        (review.revieweeInfo?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
      return matchesStatus && matchesRating && matchesSearch;
    });

    // Sort the filtered reviews
    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'date') {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortBy === 'rating') {
        comparison = a.rating - b.rating;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [ratingFilter, reviews, searchQuery, statusFilter, sortBy, sortOrder]);

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
    if (updatingReview) return; // Prevent multiple clicks
    setUpdatingReview(reviewId);
    Vibration.vibrate(50);
    try {
      const note = actionState.reviewId === reviewId ? actionState.note.trim() : '';
      await updateReviewStatus(reviewId, status, note || undefined);
      setActionState({note: '', reviewId: null});
      await loadReviews();
      Alert.alert('Success', `Review has been ${status === 'hidden' ? 'hidden' : 'published'}.`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Unable to update review status');
    } finally {
      setUpdatingReview(null);
    }
  };

  const handleDelete = (reviewId: string) => {
    Vibration.vibrate(100);
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

  const renderReviewCard = (review: Review, theme: any) => {
    const status = review.status ?? 'published';

    return (
      <Animated.View style={{ opacity: 1 }}>
        <Surface style={[styles.card, {backgroundColor: theme.colors.surface}]} elevation={4}>
          <View style={styles.cardContentWrapper}>
            <Card.Content style={styles.cardContent}>
              <View style={styles.headerRow}>
                <View style={styles.reviewerInfo}>
                  <Icon name="person" type="material" color={theme.colors.primary} size={28} />
                  <View style={styles.headerText}>
                    <Text variant="titleMedium" style={[styles.reviewerName, {color: theme.colors.onSurface}]}>
                      {review.reviewerInfo?.name ?? 'Reviewer not specified'}
                    </Text>
                    <Text variant="bodySmall" style={[styles.emailText, {color: theme.colors.onSurfaceVariant}]}>
                      {review.reviewerInfo?.email ?? 'Email not available'}
                    </Text>
                  </View>
                </View>
                <Chip
                  icon="star"
                  style={[styles.ratingChip, {backgroundColor: theme.colors.secondaryContainer}]}
                  textStyle={[styles.ratingText, {color: theme.colors.onSecondaryContainer}]}>
                  {review.rating.toFixed(1)}
                </Chip>
              </View>

              <View style={[styles.divider, {backgroundColor: theme.colors.outlineVariant}]} />

              <Text variant="bodyMedium" style={[styles.commentText, {color: theme.colors.onSurface, lineHeight: 22}]}>
                {review.comment ?? 'No comment provided.'}
              </Text>

              <View style={styles.metaRow}>
                <Chip icon="account" style={[styles.metaChip, {backgroundColor: theme.colors.tertiaryContainer}]}>
                  {review.revieweeInfo?.name ?? 'Unknown caregiver'}
                </Chip>
                <Chip icon="calendar" style={[styles.metaChip, {backgroundColor: theme.colors.tertiaryContainer}]}>
                  {new Date(review.createdAt).toLocaleDateString()}
                </Chip>
                <Chip
                  icon="check-circle"
                  style={[
                    styles.metaChip,
                    styles.statusChip,
                    {backgroundColor: status === 'hidden' ? theme.colors.errorContainer : theme.colors.primaryContainer}
                  ]}
                  textStyle={{color: status === 'hidden' ? theme.colors.onErrorContainer : theme.colors.onPrimaryContainer}}>
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
                theme={{
                  colors: {
                    ...theme.colors,
                    outline: theme.colors.outlineVariant,
                  },
                }}
              />

              <View style={styles.actionsRow}>
                <Button
                  mode={status === 'hidden' ? 'contained' : 'outlined'}
                  icon={status === 'hidden' ? 'eye' : 'eye-off'}
                  onPress={() => handleChangeStatus(review.id, status === 'hidden' ? 'published' : 'hidden')}
                  style={[
                    styles.actionButton,
                    styles.hideButton,
                    {
                      backgroundColor: status === 'hidden' ? theme.colors.primary : 'white',
                      elevation: status === 'hidden' ? 2 : 0,
                      borderWidth: status === 'hidden' ? 0 : 1,
                    }
                  ]}
                  labelStyle={[
                    styles.actionButtonText,
                    { color: status === 'hidden' ? theme.colors.onPrimary : theme.colors.primary }
                  ]}
                  contentStyle={styles.buttonContent}
                  compact={true}
                  loading={updatingReview === review.id}
                  disabled={updatingReview !== null}>
                  {status === 'hidden' ? 'Publish' : 'Hide'}
                </Button>
                <Button
                  mode="contained"
                  icon="delete"
                  onPress={() => handleDelete(review.id)}
                  style={[
                    styles.actionButton,
                    styles.deleteButton,
                    {
                      backgroundColor: '#B00020',
                    }
                  ]}
                  labelStyle={[
                    styles.actionButtonText,
                    { color: theme.colors.onError }
                  ]}
                  contentStyle={styles.buttonContent}
                  compact={true}>
                  Delete
                </Button>
              </View>
            </Card.Content>
          </View>
        </Surface>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, {backgroundColor: theme.colors.background}]}>
      <FlatList
        data={filteredReviews}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => renderReviewCard(item, theme)}
        ListHeaderComponent={() => (
          <>
            <Text variant="headlineMedium" style={[styles.title, {color: theme.colors.primary}]}>
              Reviews Management
            </Text>
            <Text variant="bodyLarge" style={[styles.subtitle, {color: theme.colors.onSurfaceVariant}]}>
              Moderate caregiver feedback, resolve disputes, and ensure quality service.
            </Text>
            <Searchbar
              placeholder="Search by reviewer, caregiver, or comment"
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={[styles.searchbar, {backgroundColor: theme.colors.surface}]}
              theme={{
                colors: {
                  ...theme.colors,
                  elevation: {level1: theme.colors.elevation.level1},
                },
              }}
            />
            <View style={styles.filterRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.sortContainer}>
                  <Text variant="bodySmall" style={{color: theme.colors.onSurfaceVariant, marginRight: 8}}>
                    Sort by:
                  </Text>
                  <Chip
                    mode={sortBy === 'date' ? 'flat' : 'outlined'}
                    onPress={() => {
                      setSortBy('date');
                      setSortOrder(sortBy === 'date' && sortOrder === 'desc' ? 'asc' : 'desc');
                    }}
                    style={[
                      styles.sortChip,
                      sortBy === 'date' && {backgroundColor: theme.colors.primaryContainer}
                    ]}
                    icon="calendar">
                    Date {sortBy === 'date' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
                  </Chip>
                  <Chip
                    mode={sortBy === 'rating' ? 'flat' : 'outlined'}
                    onPress={() => {
                      setSortBy('rating');
                      setSortOrder(sortBy === 'rating' && sortOrder === 'desc' ? 'asc' : 'desc');
                    }}
                    style={[
                      styles.sortChip,
                      sortBy === 'rating' && {backgroundColor: theme.colors.primaryContainer}
                    ]}
                    icon="star">
                    Rating {sortBy === 'rating' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
                  </Chip>
                </View>
                {STATUS_FILTERS.map(filter => (
                  <Chip
                    key={filter.value}
                    mode={statusFilter === filter.value ? 'flat' : 'outlined'}
                    onPress={() => setStatusFilter(filter.value)}
                    style={[
                      styles.filterChip,
                      statusFilter === filter.value && {backgroundColor: theme.colors.primaryContainer}
                    ]}>
                    {filter.label}
                  </Chip>
                ))}
                {RATING_FILTERS.map(rating => (
                  <Chip
                    key={rating}
                    mode={ratingFilter === rating ? 'flat' : 'outlined'}
                    onPress={() => setRatingFilter(rating)}
                    style={[
                      styles.filterChip,
                      ratingFilter === rating && {backgroundColor: theme.colors.primaryContainer}
                    ]}
                    icon="star">
                    {rating === 0 ? 'All Ratings' : `${rating} Stars`}
                  </Chip>
                ))}
              </ScrollView>
            </View>
          </>
        )}
        ListEmptyComponent={() => (
          loading ? (
            <View>
              {Array.from({length: 3}).map((_, index) => (
                <View key={index} style={styles.skeletonCard}>
                  <View style={styles.skeletonHeader}>
                    <View style={styles.skeletonAvatar} />
                    <View style={styles.skeletonTextContainer}>
                      <View style={styles.skeletonTitle} />
                      <View style={styles.skeletonSubtitle} />
                    </View>
                    <View style={styles.skeletonChip} />
                  </View>
                  <View style={styles.skeletonDivider} />
                  <View style={styles.skeletonContent} />
                  <View style={styles.skeletonMeta}>
                    <View style={styles.skeletonMetaChip} />
                    <View style={styles.skeletonMetaChip} />
                  </View>
                  <View style={styles.skeletonInput} />
                  <View style={styles.skeletonActions}>
                    <View style={styles.skeletonButton} />
                    <View style={styles.skeletonButton} />
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Surface style={[styles.emptyCard, {backgroundColor: theme.colors.surface}]} elevation={1}>
              <Card.Content>
                <Text variant="titleMedium" style={[styles.emptyTitle, {color: theme.colors.onSurface}]}>
                  No reviews found
                </Text>
                <Text variant="bodyMedium" style={[styles.emptyText, {color: theme.colors.onSurfaceVariant}]}>
                  Adjust your filters or refresh to see the latest reviews.
                </Text>
              </Card.Content>
            </Surface>
          )
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      />
      <FAB
        icon="refresh"
        onPress={loadReviews}
        style={[styles.fab, {backgroundColor: theme.colors.primary}]}
        disabled={loading}
        accessibilityLabel="Refresh reviews list"
        accessibilityHint="Reloads the list of reviews from the server"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 96,
  },
  title: {
    textAlign: 'center',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  searchbar: {
    marginBottom: 12,
    elevation: 1,
  },
  filterRow: {
    marginBottom: 16,
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  sortChip: {
    marginRight: 8,
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
  },
  card: {
    marginBottom: 16,
    borderRadius: 16,
  },
  cardContentWrapper: {
    overflow: 'hidden',
    borderRadius: 16,
  },
  cardContent: {
    padding: 20,
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
  reviewerName: {
    fontWeight: '600',
  },
  emailText: {
    marginTop: 2,
  },
  ratingChip: {
    minWidth: 60,
    justifyContent: 'center',
  },
  ratingText: {
    fontWeight: 'bold',
  },
  divider: {
    marginVertical: 16,
    height: 1,
  },
  commentText: {
    marginBottom: 16,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  metaChip: {
    marginRight: 8,
    marginBottom: 8,
  },
  statusChip: {
    marginBottom: 0,
  },
  noteInput: {
    marginBottom: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    minHeight: Platform.select({ web: 32, default: 36 }),
    justifyContent: 'center',
    paddingVertical: Platform.select({ web: 0, default: 4 }),
  },
  hideButton: {
    borderWidth: 1,
    borderColor: '#6200EE',
    backgroundColor: 'white',
    ...Platform.select({
      ios: {
        shadowColor: 'transparent',
      },
      android: {},
      web: {},
      default: {
        shadowColor: 'transparent',
      },
    }),
  },
  deleteButton: {
    backgroundColor: '#B00020',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 6px rgba(176,0,32,0.3)',
      },
      android: {
        elevation: 2,
      },
      ios: {
        shadowColor: '#B00020',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
      },
      default: {
        shadowColor: '#B00020',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
      },
    }),
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  buttonContent: {
    height: Platform.select({ web: 32, default: 36 }),
    paddingVertical: 0,
    paddingHorizontal: 8,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
  emptyCard: {
    padding: 16,
    borderRadius: 8,
  },
  emptyTitle: {
    textAlign: 'center',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyText: {
    textAlign: 'center',
  },
  skeletonCard: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#e0e0e0',
    borderRadius: 12,
  },
  skeletonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  skeletonAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#c0c0c0',
  },
  skeletonTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  skeletonTitle: {
    width: 120,
    height: 16,
    backgroundColor: '#c0c0c0',
    marginBottom: 4,
  },
  skeletonSubtitle: {
    width: 100,
    height: 12,
    backgroundColor: '#c0c0c0',
  },
  skeletonChip: {
    width: 50,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#c0c0c0',
  },
  skeletonDivider: {
    width: '100%',
    height: 1,
    backgroundColor: '#c0c0c0',
    marginBottom: 8,
  },
  skeletonContent: {
    width: '80%',
    height: 14,
    backgroundColor: '#c0c0c0',
    marginBottom: 4,
  },
  skeletonMeta: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  skeletonMetaChip: {
    width: 80,
    height: 20,
    backgroundColor: '#c0c0c0',
    marginRight: 8,
  },
  skeletonInput: {
    width: '100%',
    height: 60,
    borderRadius: 4,
    backgroundColor: '#c0c0c0',
    marginBottom: 8,
  },
  skeletonActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  skeletonButton: {
    flex: 1,
    height: 30,
    backgroundColor: '#c0c0c0',
    marginRight: 8,
  },
});

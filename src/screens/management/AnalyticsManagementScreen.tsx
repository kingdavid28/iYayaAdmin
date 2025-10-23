import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {RefreshControl, ScrollView, StyleSheet, View} from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  FAB,
  Surface,
  Text,
  useTheme,
} from 'react-native-paper';
import {Icon} from 'react-native-elements';
import {AnalyticsSummaryResponse, AnalyticsTrendPoint} from '../../types';
import {fetchAnalyticsSummary} from '../../services/analyticsService';

const TIMEFRAMES = ['7d', '30d', '90d', '180d'] as const;

interface TrendChartProps {
  title: string;
  icon: string;
  data?: AnalyticsTrendPoint[];
  color: string;
}

const TrendChart = ({title, icon, data, color}: TrendChartProps) => {
  const theme = useTheme();
  const safeData = data?.slice(-10) ?? [];

  return (
    <Card style={styles.chartCard}>
      <Card.Title
        title={title}
        left={props => <Icon {...props} name={icon} type="material" color={color} size={24} />}
      />
      <Card.Content>
        {safeData.length === 0 ? (
          <Text style={styles.emptyChartText}>Not enough data to display.</Text>
        ) : (
          <View style={styles.chartContainer}>
            {safeData.map(point => (
              <View key={point.date} style={styles.chartBarWrapper}>
                <View style={styles.chartBarLabel}>
                  <Text variant="bodySmall" style={styles.chartLabelText}>
                    {new Date(point.date).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.chartBarTrack}>
                  <View
                    style={[
                      styles.chartBar,
                      {
                        width: `${Math.min(100, point.value)}%`,
                        backgroundColor: color,
                      },
                    ]}
                  />
                </View>
                <Text variant="bodySmall" style={styles.chartValueText}>
                  {point.value.toLocaleString()}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Card.Content>
    </Card>
  );
};

export default function AnalyticsManagementScreen() {
  const theme = useTheme();
  const [summary, setSummary] = useState<AnalyticsSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeframe, setTimeframe] = useState<(typeof TIMEFRAMES)[number]>('30d');

  const loadData = useCallback(async () => {
    try {
      if (!refreshing) {
        setLoading(true);
      }
      const summaryResponse = await fetchAnalyticsSummary(timeframe as typeof TIMEFRAMES[number]);
      setSummary(summaryResponse);
    } catch (error: any) {
      setSummary(null);
      console.error('Failed to load analytics summary', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing, timeframe]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const overviewCards = useMemo(() => {
    if (!summary) {
      return [];
    }
    return [
      {
        title: 'Total Users',
        icon: 'people',
        color: '#3f51b5',
        metric: summary.overview.users,
      },
      {
        title: 'Active Caregivers',
        icon: 'favorite',
        color: '#f44336',
        metric: summary.overview.caregivers,
      },
      {
        title: 'Open Jobs',
        icon: 'work',
        color: '#ff9800',
        metric: summary.overview.jobs,
      },
      {
        title: 'Completed Bookings',
        icon: 'event-available',
        color: '#4caf50',
        metric: summary.overview.bookings,
      },
      summary.overview.revenue
        ? {
            title: 'Revenue',
            icon: 'attach-money',
            color: '#00c853',
            metric: summary.overview.revenue,
          }
        : null,
    ].filter(Boolean) as Array<{
      title: string;
      icon: string;
      color: string;
      metric: AnalyticsSummaryResponse['overview']['users'];
    }>;
  }, [summary]);

  const renderDelta = (delta?: number, deltaType?: 'increase' | 'decrease' | 'stable') => {
    if (delta === undefined || deltaType === undefined) {
      return null;
    }
    let deltaColor = '#9e9e9e';
    let icon: 'arrow-upward' | 'arrow-downward' | 'drag-handle' = 'drag-handle';
    if (deltaType === 'increase') {
      deltaColor = '#4caf50';
      icon = 'arrow-upward';
    } else if (deltaType === 'decrease') {
      deltaColor = '#f44336';
      icon = 'arrow-downward';
    }
    return (
      <View style={styles.deltaRow}>
        <Icon name={icon} type="material" color={deltaColor} size={16} />
        <Text style={[styles.deltaText, {color: deltaColor}]}>
          {delta > 0 ? `+${delta}%` : `${delta}%`} vs prev period
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {setRefreshing(true); loadData();}} />}>
        <Text variant="headlineMedium" style={styles.title}>
          Analytics & Insights
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Monitor platform health and spot trends across key metrics.
        </Text>

        <View style={styles.timeframeRow}>
          {TIMEFRAMES.map(option => (
            <Chip
              key={option}
              mode={timeframe === option ? 'flat' : 'outlined'}
              style={styles.timeframeChip}
              onPress={() => setTimeframe(option)}>
              Last {option}
            </Chip>
          ))}
        </View>

        {loading ? (
          <View style={styles.skeletonContainer}>
            <View style={styles.skeletonOverviewRow}>
              {Array.from({length: 4}).map((_, index) => (
                <Surface key={`overview-skeleton-${index}`} style={[styles.overviewCard, styles.skeletonCard]} elevation={2}>
                  <View style={[styles.skeletonBlock, styles.skeletonIcon]} />
                  <View style={[styles.skeletonBlock, styles.skeletonMetric]} />
                  <View style={[styles.skeletonBlock, styles.skeletonLabel]} />
                  <View style={[styles.skeletonBlock, styles.skeletonDelta]} />
                </Surface>
              ))}
            </View>

            {Array.from({length: 3}).map((_, index) => (
              <Card key={`trend-skeleton-${index}`} style={[styles.chartCard, styles.skeletonCard]}>
                <Card.Content>
                  <View style={[styles.skeletonBlock, styles.skeletonTitle]} />
                  <View style={styles.skeletonChartWrapper}>
                    {Array.from({length: 4}).map((__, barIndex) => (
                      <View key={`trend-skeleton-${index}-bar-${barIndex}`} style={styles.skeletonChartRow}>
                        <View style={[styles.skeletonBlock, styles.skeletonChartLabel]} />
                        <View style={styles.skeletonChartTrack}>
                          <View style={[styles.skeletonBlock, styles.skeletonChartBar]} />
                        </View>
                      </View>
                    ))}
                  </View>
                </Card.Content>
              </Card>
            ))}
          </View>
        ) : !summary ? (
          <Card style={styles.emptyCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.emptyTitle}>
                Analytics unavailable
              </Text>
              <Text variant="bodyMedium" style={styles.emptyText}>
                Check your backend endpoint or try again later.
              </Text>
            </Card.Content>
          </Card>
        ) : (
          <>
            <View style={styles.overviewGrid}>
              {overviewCards.map(card => (
                <Surface key={card.title} style={styles.overviewCard} elevation={2}>
                  <View style={styles.overviewIconWrapper}>
                    <Icon name={card.icon} type="material" color={card.color} size={30} />
                  </View>
                  <Text variant="titleLarge" style={styles.overviewValue}>
                    {card.metric.value.toLocaleString()}
                  </Text>
                  <Text variant="bodyMedium" style={styles.overviewLabel}>
                    {card.title}
                  </Text>
                  {renderDelta(card.metric.delta, card.metric.deltaType)}
                </Surface>
              ))}
            </View>

            <TrendChart
              title="Bookings Trend"
              icon="event"
              data={summary.trends.bookings}
              color={theme.colors.primary}
            />
            <TrendChart
              title="Revenue Trend"
              icon="trending-up"
              data={summary.trends.revenue}
              color="#00c853"
            />
            <TrendChart
              title="New Users Trend"
              icon="person-add"
              data={summary.trends.newUsers}
              color="#ff9800"
            />
          </>
        )}
      </ScrollView>

      <FAB icon="refresh" onPress={loadData} style={styles.fab} disabled={loading} />
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
  timeframeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  timeframeChip: {
    marginHorizontal: 4,
    marginVertical: 4,
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
  overviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  overviewCard: {
    width: '48%',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  overviewIconWrapper: {
    alignSelf: 'flex-start',
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0f0ff',
    marginBottom: 12,
  },
  overviewValue: {
    fontWeight: 'bold',
    color: '#212121',
  },
  overviewLabel: {
    color: '#757575',
    marginBottom: 6,
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deltaText: {
    marginLeft: 4,
    fontSize: 12,
  },
  chartCard: {
    marginBottom: 16,
    elevation: 2,
  },
  emptyChartText: {
    textAlign: 'center',
    color: '#666',
    paddingVertical: 16,
  },
  chartContainer: {
    paddingVertical: 8,
  },
  chartBarWrapper: {
    marginBottom: 12,
  },
  chartBarLabel: {
    marginBottom: 4,
  },
  chartLabelText: {
    color: '#757575',
  },
  chartBarTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#e0e0e0',
  },
  chartBar: {
    height: '100%',
    borderRadius: 5,
  },
  chartValueText: {
    marginTop: 4,
    color: '#424242',
  },
  skeletonContainer: {
    gap: 16,
  },
  skeletonOverviewRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  skeletonCard: {
    backgroundColor: '#f7f7f7',
  },
  skeletonBlock: {
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
  },
  skeletonIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    marginBottom: 12,
  },
  skeletonMetric: {
    height: 24,
    width: '60%',
    marginBottom: 8,
  },
  skeletonLabel: {
    height: 16,
    width: '40%',
    marginBottom: 12,
  },
  skeletonDelta: {
    height: 14,
    width: '50%',
  },
  skeletonTitle: {
    height: 20,
    width: '45%',
    marginBottom: 16,
  },
  skeletonChartWrapper: {
    gap: 12,
  },
  skeletonChartRow: {
    gap: 12,
  },
  skeletonChartLabel: {
    height: 14,
    width: '30%',
  },
  skeletonChartTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#eeeeee',
  },
  skeletonChartBar: {
    height: '100%',
    width: '70%',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#3f51b5',
  },
});

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {AppState, AppStateStatus, RefreshControl, ScrollView, StyleSheet, View} from 'react-native';
import {FAB, Snackbar, Text} from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Asset} from 'expo-asset';
import {fetchDashboardStats} from '../../services/dashboardService';
import {DashboardStats} from '../../types';
import type {StatCardItem} from './components/StatCardGrid';
import StatCardGrid from './components/StatCardGrid';
import {SkeletonBlock, SkeletonCircle} from '../../components/skeletons/Skeleton';

type SectionKey = 'users' | 'jobs' | 'bookings' | 'applications';

type SectionStatus = {
  loading: boolean;
  error: string | null;
  lastUpdated?: string;
};

type StatDefinition = {
  section: SectionKey;
  title: string;
  path: readonly (keyof DashboardStats | string)[];
  icon: string;
  color: string;
};

const SECTION_KEYS: readonly SectionKey[] = ['users', 'jobs', 'bookings', 'applications'];

const DEFAULT_STATS: DashboardStats = {
  users: {total: 0, active: 0, suspended: 0},
  jobs: {total: 0, active: 0},
  bookings: {total: 0, completed: 0},
  applications: {pending: 0, approved: 0},
};

const STAT_CACHE_KEY = 'dashboard.stats.v2';
const CACHE_TTL_MS = 5 * 60 * 1000;

type CachedDashboardStats = {
  data: DashboardStats;
  timestamps: Partial<Record<SectionKey, number>>;
};

const sectionList: SectionKey[] = ['users', 'jobs', 'bookings', 'applications'];

const getExpiredSections = (timestamps: Partial<Record<SectionKey, number>> | undefined) => {
  const now = Date.now();
  return sectionList.filter(section => {
    const sectionTimestamp = timestamps?.[section];
    if (!sectionTimestamp) {
      return true;
    }
    return now - sectionTimestamp > CACHE_TTL_MS;
  });
};

const applySectionResult = (
  partial: Partial<DashboardStats>,
  section: SectionKey,
  result: DashboardStats,
) => {
  switch (section) {
    case 'users':
      partial.users = result.users;
      break;
    case 'jobs':
      partial.jobs = result.jobs;
      break;
    case 'bookings':
      partial.bookings = result.bookings;
      break;
    case 'applications':
      partial.applications = result.applications;
      break;
    default:
      break;
  }
};

const STAT_DEFINITIONS: StatDefinition[] = [
  {
    section: 'users',
    title: 'Total Users',
    path: ['users', 'total'],
    icon: 'people',
    color: '#3f51b5',
  },
  {
    section: 'users',
    title: 'Active Users',
    path: ['users', 'active'],
    icon: 'person',
    color: '#4caf50',
  },
  {
    section: 'users',
    title: 'Suspended Users',
    path: ['users', 'suspended'],
    icon: 'person-off',
    color: '#f44336',
  },
  {
    section: 'jobs',
    title: 'Total Jobs',
    path: ['jobs', 'total'],
    icon: 'work',
    color: '#ff9800',
  },
  {
    section: 'jobs',
    title: 'Active Jobs',
    path: ['jobs', 'active'],
    icon: 'work-outline',
    color: '#2196f3',
  },
  {
    section: 'bookings',
    title: 'Total Bookings',
    path: ['bookings', 'total'],
    icon: 'event',
    color: '#9c27b0',
  },
  {
    section: 'bookings',
    title: 'Completed Bookings',
    path: ['bookings', 'completed'],
    icon: 'check-circle',
    color: '#4caf50',
  },
  {
    section: 'applications',
    title: 'Pending Applications',
    path: ['applications', 'pending'],
    icon: 'pending',
    color: '#ff5722',
  },
];

export default function DashboardScreen() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const [sectionStatus, setSectionStatus] = useState<Record<SectionKey, SectionStatus>>({
    users: {loading: true, error: null},
    jobs: {loading: true, error: null},
    bookings: {loading: true, error: null},
    applications: {loading: true, error: null},
  });

  const isLoadingRef = useRef(false);
  const statsRef = useRef<DashboardStats | null>(null);

  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  const updateSectionStatus = useCallback((updates: Partial<Record<SectionKey, Partial<SectionStatus>>>) => {
    setSectionStatus(prev => {
      const next: Record<SectionKey, SectionStatus> = {...prev};
      Object.entries(updates).forEach(([key, value]) => {
        if (!value) {
          return;
        }
        const sectionKey = key as SectionKey;
        next[sectionKey] = {
          ...next[sectionKey],
          ...value,
        };
      });
      return next;
    });
  }, []);

  const loadDashboard = useCallback(
    async ({sections, silentRefresh}: {sections?: SectionKey[]; silentRefresh?: boolean} = {}) => {
      if (isLoadingRef.current && !sections) {
        return;
      }

      const requestedSections = sections && sections.length > 0 ? sections : SECTION_KEYS;

      isLoadingRef.current = true;
      if (silentRefresh) {
        setRefreshing(true);
      }

      updateSectionStatus(
        requestedSections.reduce<Partial<Record<SectionKey, Partial<SectionStatus>>>>((acc, key) => {
          acc[key] = {loading: true, error: null};
          return acc;
        }, {}),
      );

      try {
        const cachedEntries = await AsyncStorage.multiGet([STAT_CACHE_KEY]);
        let cached: CachedDashboardStats | null = null;
        const cachedValue = cachedEntries?.[0]?.[1];
        if (cachedValue) {
          try {
            cached = JSON.parse(cachedValue) as CachedDashboardStats;
          } catch (parseError) {
            console.warn('Failed to parse cached dashboard stats:', parseError);
          }
        }

        const staleSections = getExpiredSections(cached?.timestamps);
        const sectionsToFetch = requestedSections.filter(section => staleSections.includes(section) || !cached?.data);

        let latestStats = cached?.data ?? null;
        let latestTimestamps = {...(cached?.timestamps ?? {})};

        if (latestStats) {
          setStats(prev => prev ?? latestStats!);
        }

        if (sectionsToFetch.length > 0) {
          const fetchPromises = sectionsToFetch.map(section =>
            fetchDashboardStats([section])
              .then(result => ({section, data: result}))
              .catch((error: unknown) => ({section, error})),
          );

          const settled = await Promise.all(fetchPromises);
          const statusUpdates: Partial<Record<SectionKey, Partial<SectionStatus>>> = {};
          const partial: Partial<DashboardStats> = {};

          settled.forEach(item => {
            if ('data' in item) {
              const {section, data} = item;
              applySectionResult(partial, section, data);
              latestTimestamps[section] = Date.now();
              statusUpdates[section] = {
                loading: false,
                error: null,
                lastUpdated: new Date().toISOString(),
              };
            } else {
              const {section, error} = item;
              const message = error instanceof Error ? error.message : 'Failed to load data';
              statusUpdates[section] = {
                loading: false,
                error: message,
              };
            }
          });

          setStats(prev => {
            const next: DashboardStats = {
              users: partial.users ?? prev?.users ?? DEFAULT_STATS.users,
              jobs: partial.jobs ?? prev?.jobs ?? DEFAULT_STATS.jobs,
              bookings: partial.bookings ?? prev?.bookings ?? DEFAULT_STATS.bookings,
              applications: partial.applications ?? prev?.applications ?? DEFAULT_STATS.applications,
            };
            latestStats = next;
            return next;
          });

          updateSectionStatus(statusUpdates);

          if (latestStats) {
            try {
              const payload: CachedDashboardStats = {
                data: latestStats,
                timestamps: latestTimestamps,
              };
              await AsyncStorage.setItem(STAT_CACHE_KEY, JSON.stringify(payload));
            } catch (storageError) {
              console.warn('Failed to cache dashboard stats:', storageError);
            }
          }
        } else if (latestStats) {
          updateSectionStatus(
            requestedSections.reduce<Partial<Record<SectionKey, Partial<SectionStatus>>>>((acc, section) => {
              const timestamp = latestTimestamps[section];
              acc[section] = {
                loading: false,
                error: null,
                lastUpdated: timestamp ? new Date(timestamp).toISOString() : undefined,
              };
              return acc;
            }, {}),
          );
        }

        if (!latestStats) {
          setStats(DEFAULT_STATS);
        }
      } catch (error) {
        console.error('Error loading dashboard:', error);
        const message = error instanceof Error ? error.message : 'Failed to load dashboard data.';
        updateSectionStatus(
          requestedSections.reduce<Partial<Record<SectionKey, Partial<SectionStatus>>>>((acc, key) => {
            acc[key] = {loading: false, error: message};
            return acc;
          }, {}),
        );
      } finally {
        if (!silentRefresh) {
          setIsInitialLoad(false);
        }
        isLoadingRef.current = false;
        setRefreshing(false);
      }
    },
    [updateSectionStatus],
  );

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const cached = await AsyncStorage.getItem(STAT_CACHE_KEY);
        if (cached && isMounted) {
          try {
            const parsed = JSON.parse(cached) as CachedDashboardStats;
            if (parsed?.data) {
              setStats(parsed.data);
              statsRef.current = parsed.data;
              updateSectionStatus(
                SECTION_KEYS.reduce<Partial<Record<SectionKey, Partial<SectionStatus>>>>((acc, key) => {
                  const timestamp = parsed.timestamps?.[key];
                  acc[key] = {
                    loading: false,
                    error: null,
                    lastUpdated: timestamp ? new Date(timestamp).toISOString() : undefined,
                  };
                  return acc;
                }, {}),
              );
              const stale = getExpiredSections(parsed.timestamps);
              if (stale.length === 0) {
                setIsInitialLoad(false);
              }
            } else {
              await AsyncStorage.removeItem(STAT_CACHE_KEY);
            }
          } catch (parseError) {
            console.warn('Failed to parse cached dashboard stats:', parseError);
            await AsyncStorage.removeItem(STAT_CACHE_KEY);
          }
        }
      } catch (cacheError) {
        console.warn('Failed to read cached dashboard stats:', cacheError);
      } finally {
        if (isMounted) {
          loadDashboard({silentRefresh: Boolean(statsRef.current)});
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [loadDashboard, updateSectionStatus]);

  useEffect(() => {
    return () => {
      isLoadingRef.current = false;
    };
  }, []);

  const onRefresh = useCallback(() => {
    loadDashboard({silentRefresh: true});
  }, [loadDashboard]);

  const getValueFromStats = useCallback(
    (statPath: readonly (keyof DashboardStats | string)[]) => {
      if (!stats) {
        return undefined;
      }
      return statPath.reduce<any>((acc, key) => (acc ? acc[key as keyof typeof acc] : undefined), stats);
    },
    [stats],
  );

  const handleRetry = useCallback(
    (section: SectionKey) => {
      loadDashboard({sections: [section], silentRefresh: Boolean(statsRef.current)});
    },
    [loadDashboard],
  );

  const cards = useMemo<StatCardItem[]>(
    () =>
      STAT_DEFINITIONS.map(def => {
        const sectionState = sectionStatus[def.section];
        const value = getValueFromStats(def.path);
        return {
          key: `${def.section}:${def.title}`,
          title: def.title,
          icon: def.icon,
          color: def.color,
          value: typeof value === 'number' ? value : Number(value) || 0,
          loading: sectionState?.loading ?? false,
          error: sectionState?.error ?? null,
          onRetry: () => handleRetry(def.section),
          showSkeleton: (sectionState?.loading ?? false) && !sectionState?.error,
        };
      }),
    [getValueFromStats, handleRetry, sectionStatus, stats, isInitialLoad],
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <Text variant="headlineMedium" style={styles.title}>
          Today’s Overview
        </Text>
        {isInitialLoad && !stats ? (
          <View style={styles.skeletonGrid}>
            {Array.from({length: 6}).map((_, index) => (
              <View style={styles.skeletonCard} key={`dashboard-skeleton-${index}`}>
                <View style={styles.skeletonCardHeader}>
                  <SkeletonCircle size={40} />
                  <View style={styles.skeletonCardInfo}>
                    <SkeletonBlock height={18} width="65%" />
                    <SkeletonBlock height={14} width="45%" />
                  </View>
                </View>
                <SkeletonBlock height={14} width="80%" />
              </View>
            ))}
          </View>
        ) : (
          <StatCardGrid cards={cards} />
        )}
      </ScrollView>
      <FAB icon="refresh" onPress={onRefresh} style={styles.fab} disabled={refreshing} />
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  title: {
    marginBottom: 24,
    textAlign: 'center',
    color: '#3f51b5',
    fontWeight: 'bold',
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
  },
  skeletonCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: {width: 0, height: 2},
    shadowRadius: 4,
    elevation: 1,
    gap: 12,
  },
  skeletonCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  skeletonCardInfo: {
    flex: 1,
    gap: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    marginBottom: 16,
    elevation: 2,
  },
  statContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIconContainer: {
    marginRight: 16,
  },
  statTextContainer: {
    flex: 1,
  },
  statValue: {
    fontWeight: 'bold',
    color: '#333',
  },
  statTitle: {
    color: '#666',
  },
  cardSpinner: {
    marginLeft: 8,
  },
  cardErrorContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eee',
    paddingTop: 8,
    marginTop: 8,
  },
  cardErrorText: {
    color: '#d32f2f',
    marginBottom: 4,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#3f51b5',
  },
  skeletonBase: {
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  shimmerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 8,
  },
  skeletonIconContainer: {
    marginRight: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skeletonIcon: {
    width: 32,
    height: 32,
  },
  skeletonLineShort: {
    width: 60,
    height: 18,
    marginBottom: 8,
  },
  skeletonLineLong: {
    width: '80%',
    height: 12,
  },
});
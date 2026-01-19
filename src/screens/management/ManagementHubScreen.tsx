// src/screens/management/ManagementHubScreen.tsx
import React, {useCallback, useState} from 'react';
import {View, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Vibration} from 'react-native';
import {Card, Text, useTheme, Surface, ActivityIndicator} from 'react-native-paper';
import {Icon} from 'react-native-elements';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {useChildren} from '../../hooks/useChildren';
import {useOrganization} from '../../contexts/OrganizationContext';
import {fetchReviews} from '../../services/reviewsService';
import {fetchNotificationStats} from '../../services/notificationsService';

interface ManagementItem {
  title: string;
  description: string;
  icon: string;
  iconType?: string;
  color: string;
  route: keyof ManagementRoutes;
  count?: number;
}

export type ManagementRoutes = {
  ReviewsManagement: undefined;
  ChildrenManagement: undefined;
  NotificationsManagement: undefined;
  AnalyticsManagement: undefined;
  PaymentsManagement: undefined;
  PointsManagement: undefined; // Added Points Management
};

export default function ManagementHubScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const {width} = Dimensions.get('window');
  const isTablet = width >= 768;
  const {organizationId} = useOrganization();

  const {children, loading: childrenLoading} = useChildren({organizationId});
  const [reviewCount, setReviewCount] = useState<number>(0);
  const [reviewsLoading, setReviewsLoading] = useState<boolean>(true);
  const [notificationsLoading, setNotificationsLoading] = useState<boolean>(true);
  const [unreadNotifications, setUnreadNotifications] = useState<number>(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const loadData = async () => {
        setReviewsLoading(true);
        setNotificationsLoading(true);

        const [reviewsResult, statsResult] = await Promise.allSettled([
          fetchReviews(),
          fetchNotificationStats(),
        ]);

        if (!active) {
          return;
        }

        if (reviewsResult.status === 'fulfilled') {
          setReviewCount(reviewsResult.value.length);
        } else {
          console.error('[ManagementHub] Failed to load reviews count', reviewsResult.reason);
          setReviewCount(0);
        }

        if (statsResult.status === 'fulfilled') {
          setUnreadNotifications(statsResult.value.unread ?? 0);
        } else {
          console.error('[ManagementHub] Failed to load notification stats', statsResult.reason);
          setUnreadNotifications(0);
        }

        setReviewsLoading(false);
        setNotificationsLoading(false);
      };

      loadData();

      return () => {
        active = false;
      };
    }, []),
  );

  const loading = childrenLoading || reviewsLoading || notificationsLoading;

  const MANAGEMENT_ITEMS: ManagementItem[] = [
    {
      title: 'Reviews Management',
      description: 'Moderate caregiver reviews',
      icon: 'rate-review',
      color: '#ff9800',
      route: 'ReviewsManagement',
      count: reviewCount,
    },
    {
      title: 'Children Profiles',
      description: 'Manage child information',
      icon: 'baby-face-outline',
      iconType: 'material-community',
      color: '#4caf50',
      route: 'ChildrenManagement',
      count: children.length,
    },
    {
      title: 'Notifications',
      description: 'System notifications',
      icon: 'notifications',
      color: '#3f51b5',
      route: 'NotificationsManagement',
      count: unreadNotifications,
    },
    {
      title: 'Analytics',
      description: 'Platform metrics',
      icon: 'insights',
      color: '#9c27b0',
      route: 'AnalyticsManagement'
    },
    {
      title: 'Payments',
      description: 'Transaction oversight',
      icon: 'payment',
      color: '#f44336',
      route: 'PaymentsManagement'
    },
    {
      title: 'Points System',
      description: 'Caregiver points & tiers',
      icon: 'stars',
      color: '#ff5722',
      route: 'PointsManagement'
    },
  ];

  const handleNavigate = (route: ManagementItem['route']) => {
    Vibration.vibrate(50);
    navigation.navigate(route as never);
  };

  const renderItem = (item: ManagementItem) => {
    const cardWidth = isTablet ? '48%' : '100%';

    return (
      <TouchableOpacity
        key={item.title}
        onPress={() => handleNavigate(item.route)}
        activeOpacity={0.9}
        style={[styles.gridItem, {width: cardWidth}]}
      >
        <Surface style={styles.card} elevation={2}>
          <View style={[styles.cardInner, {backgroundColor: item.color}]}> 
            <Card.Content style={styles.cardContent}>
              <View style={styles.iconContainer}>
                <Icon
                  name={item.icon}
                  type={item.iconType ?? 'material'}
                  size={32}
                  color="white"
                />
              </View>
              <Text variant="titleMedium" style={styles.cardTitle}>
                {item.title}
              </Text>
              <Text variant="bodySmall" style={styles.cardDescription}>
                {item.description}
              </Text>
              {item.count !== undefined && (
                <Text variant="labelLarge" style={styles.countBadge}>
                  {item.count}
                </Text>
              )}
            </Card.Content>
          </View>
        </Surface>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, {backgroundColor: theme.colors.background}]}>
        <ActivityIndicator size="large" style={styles.loader} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, {backgroundColor: theme.colors.background}]}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={[styles.title, {color: theme.colors.primary}]}>
          Management Hub
        </Text>
        <Text variant="bodyLarge" style={[styles.subtitle, {color: theme.colors.onSurfaceVariant}]}>
          Administrative dashboard
        </Text>
      </View>
      
      <View style={[styles.grid, isTablet && styles.gridTablet]}>
        {MANAGEMENT_ITEMS.map(renderItem)}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    paddingBottom: 8,
  },
  title: {
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
    gap: 12,
  },
  gridTablet: {
    justifyContent: 'center',
  },
  gridItem: {
    minWidth: 160,
  },
  card: {
    borderRadius: 12,
    minHeight: 180,
    justifyContent: 'center',
  },
  cardInner: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardContent: {
    alignItems: 'center',
    padding: 16,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    color: 'white',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  cardDescription: {
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  countBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
    color: 'white',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
  },
});
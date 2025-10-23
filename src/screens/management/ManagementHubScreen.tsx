import React, {useState, useEffect} from 'react';
import {View, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Vibration} from 'react-native';
import {Card, Text, useTheme, Surface} from 'react-native-paper';
import {Icon} from 'react-native-elements';
import {useNavigation} from '@react-navigation/native';

interface ManagementItem {
  title: string;
  description: string;
  icon: string;
  color: string;
  route: keyof ManagementRoutes;
}

export type ManagementRoutes = {
  ReviewsManagement: undefined;
  ChildrenManagement: undefined;
  NotificationsManagement: undefined;
  AnalyticsManagement: undefined;
  PaymentsManagement: undefined;
};

const MANAGEMENT_ITEMS: ManagementItem[] = [
  {
    title: 'Reviews Management',
    description: 'Moderate caregiver reviews and handle disputes.',
    icon: 'rate-review',
    color: '#ff9800',
    route: 'ReviewsManagement',
  },
  {
    title: 'Children Profiles',
    description: 'Review and manage child safety information.',
    icon: 'child-care',
    color: '#4caf50',
    route: 'ChildrenManagement',
  },
  {
    title: 'Notifications Center',
    description: 'Send and monitor system notifications.',
    icon: 'notifications-active',
    color: '#3f51b5',
    route: 'NotificationsManagement',
  },
  {
    title: 'Analytics & Insights',
    description: 'Track platform performance metrics.',
    icon: 'insights',
    color: '#9c27b0',
    route: 'AnalyticsManagement',
  },
  {
    title: 'Payments Oversight',
    description: 'Resolve payment issues and refunds.',
    icon: 'payment',
    color: '#f44336',
    route: 'PaymentsManagement',
  },
];

export default function ManagementHubScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const {width} = Dimensions.get('window');
  const isTablet = width >= 768;
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading for demonstration; replace with actual loading logic
    const timer = setTimeout(() => setLoading(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleNavigate = (route: ManagementItem['route']) => {
    Vibration.vibrate(50);
    // @ts-expect-error - navigation types handled by stack configuration
    navigation.navigate(route);
  };

  const renderItem = (item: ManagementItem, index: number) => {
    const cardWidth = isTablet ? '48%' : '100%';

    return (
      <TouchableOpacity
        key={item.title}
        onPress={() => handleNavigate(item.route)}
        activeOpacity={0.9}
        style={[styles.gridItem, {width: cardWidth}]}
        accessibilityLabel={`Navigate to ${item.title}`}
        accessibilityHint={item.description}
        accessibilityRole="button">
        <Surface style={[styles.card, {backgroundColor: theme.colors.surface}]} elevation={2}>
          <View style={styles.cardContentWrapper}>
            <Card.Content style={styles.cardContent}>
              <View style={[styles.iconContainer, {backgroundColor: item.color}]}>
                <Icon
                  name={item.icon === 'child-care' ? 'people-outline' : item.icon}
                  type="material"
                  size={32}
                  accessibilityLabel={`${item.title} icon`}
                />
              </View>
              <Text variant="titleMedium" style={[styles.cardTitle, {color: theme.colors.onSurface}]}>
                {item.title}
              </Text>
              <Text
                variant="bodySmall"
                style={[styles.cardDescription, {color: theme.colors.onSurfaceVariant}]}>
                {item.description}
              </Text>
            </Card.Content>
          </View>
        </Surface>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <ScrollView style={[styles.container, {backgroundColor: theme.colors.background}]}>
        <View style={styles.content}>
          <View style={styles.skeletonTitle} />
          <View style={styles.skeletonSubtitle} />
          <View style={[styles.grid, isTablet && styles.gridTablet]}>
            {Array.from({length: 5}).map((_, index) => (
              <View key={index} style={[styles.skeletonCard, {width: isTablet ? '48%' : '100%'}]}>
                <View style={styles.skeletonIcon} />
                <View style={styles.skeletonText} />
                <View style={styles.skeletonTextSmall} />
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={[styles.container, {backgroundColor: theme.colors.background}]}>
      <View style={styles.content}>
        <Text variant="headlineMedium" style={[styles.title, {color: theme.colors.primary}]}>
          Management Center
        </Text>
        <Text variant="bodyLarge" style={[styles.subtitle, {color: theme.colors.onSurfaceVariant}]}>
          Access critical administrative tools for the Iyaya platform.
        </Text>
        <View style={[styles.grid, isTablet && styles.gridTablet]}>
          {MANAGEMENT_ITEMS.map(renderItem)}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  title: {
    marginBottom: 8,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridTablet: {
    justifyContent: 'flex-start',
    gap: 16,
  },
  gridItem: {
    marginBottom: 16,
  },
  card: {
    borderRadius: 12,
    minHeight: 160,
  },
  cardContentWrapper: {
    borderRadius: 12,
  },
  cardContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  cardTitle: {
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  cardDescription: {
    textAlign: 'center',
    lineHeight: 16,
  },
  skeletonTitle: {
    width: 200,
    height: 28,
    backgroundColor: '#e0e0e0',
    marginBottom: 8,
    alignSelf: 'center',
  },
  skeletonSubtitle: {
    width: 300,
    height: 18,
    backgroundColor: '#e0e0e0',
    marginBottom: 24,
    alignSelf: 'center',
  },
  skeletonCard: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#e0e0e0',
    borderRadius: 12,
    alignItems: 'center',
  },
  skeletonIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#c0c0c0',
    marginBottom: 16,
  },
  skeletonText: {
    width: 120,
    height: 18,
    backgroundColor: '#c0c0c0',
    marginBottom: 8,
  },
  skeletonTextSmall: {
    width: 100,
    height: 14,
    backgroundColor: '#c0c0c0',
  },
});

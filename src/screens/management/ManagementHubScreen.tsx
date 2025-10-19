import React from 'react';
import {View, StyleSheet, ScrollView, TouchableOpacity} from 'react-native';
import {Card, Text, useTheme} from 'react-native-paper';
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

  const handleNavigate = (route: ManagementItem['route']) => {
    // @ts-expect-error - navigation types handled by stack configuration
    navigation.navigate(route);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="headlineMedium" style={styles.title}>
        Management Center
      </Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        Access critical administrative tools for the Iyaya platform.
      </Text>
      <View style={styles.grid}>
        {MANAGEMENT_ITEMS.map(item => (
          <TouchableOpacity
            key={item.title}
            onPress={() => handleNavigate(item.route)}
            activeOpacity={0.8}
            style={styles.gridItem}>
            <Card style={styles.card}>
              <Card.Content style={styles.cardContent}>
                <View style={[styles.iconContainer, {backgroundColor: item.color}]}>
                  <Icon name={item.icon} type="material" color="#fff" size={28} />
                </View>
                <Text variant="titleMedium" style={styles.cardTitle}>
                  {item.title}
                </Text>
                <Text variant="bodySmall" style={[styles.cardDescription, {color: theme.colors.onSurfaceVariant}]}> 
                  {item.description}
                </Text>
              </Card.Content>
            </Card>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 16,
  },
  title: {
    marginBottom: 8,
    textAlign: 'center',
    color: '#3f51b5',
    fontWeight: 'bold',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 24,
    color: '#666',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridItem: {
    width: '48%',
    marginBottom: 16,
  },
  card: {
    height: 170,
    borderRadius: 12,
    elevation: 2,
  },
  cardContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  cardDescription: {
    textAlign: 'center',
  },
});

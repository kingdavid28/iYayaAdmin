import React from 'react';
import {
  View,
  StyleSheet,
} from 'react-native';
import {
  Text,
  Card,
  useTheme,
} from 'react-native-paper';

export default function BookingDetailScreen() {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="headlineMedium" style={styles.title}>
            Booking Details
          </Text>
          <Text variant="bodyLarge" style={styles.message}>
            Booking detail view coming soon!
          </Text>
        </Card.Content>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    elevation: 4,
  },
  title: {
    textAlign: 'center',
    marginBottom: 16,
    color: '#3f51b5',
  },
  message: {
    textAlign: 'center',
    color: '#666',
  },
});

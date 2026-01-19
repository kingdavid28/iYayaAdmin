import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, StyleSheet } from 'react-native';
import { awardPoints, getCaregiverPoints } from '../../services/solanaPaymentsService';

export default function PointsManagementScreen() {
  const [caregiverId, setCaregiverId] = useState('123e4567-e89b-12d3-a456-426614174000');
  const [rating, setRating] = useState('5');
  const [pointsSummary, setPointsSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleAwardPoints = async () => {
    setLoading(true);
    try {
      const result = await awardPoints({
        caregiverId,
        rating: parseInt(rating),
        punctual: true
      });
      
      Alert.alert('Success', `Points awarded! Total: ${result.totalPoints}, Tier: ${result.tier}`);
      loadPointsSummary();
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadPointsSummary = async () => {
    try {
      const summary = await getCaregiverPoints(caregiverId);
      setPointsSummary(summary);
    } catch (error) {
      console.error('Error loading points:', error);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Points Management</Text>
      
      <TextInput
        placeholder="Caregiver ID"
        value={caregiverId}
        onChangeText={setCaregiverId}
        style={styles.input}
      />
      
      <TextInput
        placeholder="Rating (1-5)"
        value={rating}
        onChangeText={setRating}
        keyboardType="numeric"
        style={styles.input}
      />
      
      <TouchableOpacity
        onPress={handleAwardPoints}
        disabled={loading}
        style={[styles.button, styles.primaryButton]}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Processing...' : 'Award Points'}
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        onPress={loadPointsSummary}
        style={[styles.button, styles.secondaryButton]}
      >
        <Text style={styles.buttonText}>Load Points Summary</Text>
      </TouchableOpacity>
      
      {pointsSummary && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Points Summary</Text>
          <Text style={styles.summaryText}>Total Points: {pointsSummary.summary?.total_points || 0}</Text>
          <Text style={styles.summaryText}>Tier: {pointsSummary.summary?.tier || 'Bronze'}</Text>
          <Text style={styles.summaryText}>Recent Entries: {pointsSummary.recent?.length || 0}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    backgroundColor: 'white',
  },
  button: {
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#2196F3',
  },
  secondaryButton: {
    backgroundColor: '#FF9800',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  summaryCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  summaryText: {
    fontSize: 16,
    marginBottom: 5,
    color: '#666',
  },
});
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Card, Chip, Button, TextInput, Menu } from 'react-native-paper';
import { reportsService, Report } from '../../services/reportsService';

export default function ReportDetailScreen({ route, navigation }: any) {
  const { reportId } = route.params;
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [resolution, setResolution] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);

  useEffect(() => {
    loadReport();
  }, [reportId]);

  const loadReport = async () => {
    try {
      setLoading(true);
      const response = await reportsService.getReportById(reportId);
      setReport(response.data);
      setAdminNotes(response.data.admin_notes || '');
      setResolution(response.data.resolution || '');
    } catch (error) {
      console.error('Failed to load report:', error);
      Alert.alert('Error', 'Failed to load report details');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (status: string) => {
    try {
      setLoading(true);
      await reportsService.updateReportStatus(reportId, {
        status,
        adminNotes,
        resolution: status === 'resolved' ? resolution : undefined,
      });
      Alert.alert('Success', 'Report status updated');
      loadReport();
    } catch (error) {
      console.error('Failed to update status:', error);
      Alert.alert('Error', 'Failed to update report status');
    } finally {
      setLoading(false);
      setMenuVisible(false);
    }
  };

  if (!report) return <View style={styles.container}><Text>Loading...</Text></View>;

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.title}>{report.title}</Text>
          
          <View style={styles.chips}>
            <Chip style={styles.chip}>{report.report_type.replace(/_/g, ' ')}</Chip>
            <Chip style={styles.chip}>{report.severity}</Chip>
            <Chip style={[styles.chip, styles.statusChip]}>{report.status}</Chip>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Reporter</Text>
            <Text>{report.reporter?.name} ({report.reporter?.email})</Text>
            <Text style={styles.role}>{report.reporter?.role}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Reported User</Text>
            <Text>{report.reported_user?.name} ({report.reported_user?.email})</Text>
            <Text style={styles.role}>{report.reported_user?.role}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Description</Text>
            <Text>{report.description}</Text>
          </View>

          {report.booking_id && (
            <View style={styles.section}>
              <Text style={styles.label}>Related Booking</Text>
              <Text>{report.booking_id}</Text>
            </View>
          )}

          {report.job_id && (
            <View style={styles.section}>
              <Text style={styles.label}>Related Job</Text>
              <Text>{report.job_id}</Text>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.label}>Admin Notes</Text>
            <TextInput
              mode="outlined"
              multiline
              numberOfLines={4}
              value={adminNotes}
              onChangeText={setAdminNotes}
              placeholder="Add admin notes..."
            />
          </View>

          {report.status === 'under_review' && (
            <View style={styles.section}>
              <Text style={styles.label}>Resolution</Text>
              <TextInput
                mode="outlined"
                multiline
                numberOfLines={4}
                value={resolution}
                onChangeText={setResolution}
                placeholder="Enter resolution details..."
              />
            </View>
          )}

          <View style={styles.actions}>
            <Menu
              visible={menuVisible}
              onDismiss={() => setMenuVisible(false)}
              anchor={
                <Button mode="contained" onPress={() => setMenuVisible(true)} loading={loading}>
                  Update Status
                </Button>
              }
            >
              <Menu.Item onPress={() => updateStatus('pending')} title="Pending" />
              <Menu.Item onPress={() => updateStatus('under_review')} title="Under Review" />
              <Menu.Item onPress={() => updateStatus('resolved')} title="Resolved" />
              <Menu.Item onPress={() => updateStatus('dismissed')} title="Dismissed" />
            </Menu>
          </View>

          <Text style={styles.timestamp}>
            Created: {new Date(report.created_at).toLocaleString()}
          </Text>
          {report.reviewed_at && (
            <Text style={styles.timestamp}>
              Reviewed: {new Date(report.reviewed_at).toLocaleString()} by {report.reviewer?.name}
            </Text>
          )}
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  card: { margin: 16 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  chip: { marginRight: 8, marginBottom: 8 },
  statusChip: { backgroundColor: '#2196f3' },
  section: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: 'bold', marginBottom: 4, color: '#666' },
  role: { fontSize: 12, color: '#999', fontStyle: 'italic' },
  actions: { marginTop: 16, marginBottom: 16 },
  timestamp: { fontSize: 12, color: '#999', marginTop: 8 },
});

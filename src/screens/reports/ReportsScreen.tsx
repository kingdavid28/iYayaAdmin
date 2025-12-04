import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, Card, Chip, Searchbar, Button, Menu } from 'react-native-paper';
import { reportsService, Report } from '../../services/reportsService';

export default function ReportsScreen({ navigation }: any) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);

  useEffect(() => {
    loadReports();
  }, [statusFilter, severityFilter]);

  const loadReports = async () => {
    try {
      setLoading(true);
      const response = await reportsService.getReports({
        status: statusFilter || undefined,
        severity: severityFilter || undefined,
        search: search || undefined,
      });
      setReports(response.reports || []);
    } catch (error) {
      console.error('Failed to load reports:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return '#d32f2f';
      case 'high': return '#f57c00';
      case 'medium': return '#fbc02d';
      case 'low': return '#388e3c';
      default: return '#757575';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#ff9800';
      case 'under_review': return '#2196f3';
      case 'resolved': return '#4caf50';
      case 'dismissed': return '#9e9e9e';
      default: return '#757575';
    }
  };

  const renderReport = ({ item }: { item: Report }) => (
    <TouchableOpacity onPress={() => navigation.navigate('ReportDetail', { reportId: item.id })}>
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.header}>
            <Text style={styles.title}>{item.title}</Text>
            <Chip
              style={[styles.chip, { backgroundColor: getSeverityColor(item.severity) }]}
              textStyle={styles.chipText}
            >
              {item.severity.toUpperCase()}
            </Chip>
          </View>
          
          <Text style={styles.type}>{item.report_type.replace(/_/g, ' ').toUpperCase()}</Text>
          
          <View style={styles.userInfo}>
            <Text style={styles.label}>Reporter: </Text>
            <Text>{item.reporter?.name || 'Unknown'}</Text>
          </View>
          
          <View style={styles.userInfo}>
            <Text style={styles.label}>Reported: </Text>
            <Text>{item.reported_user?.name || 'Unknown'}</Text>
          </View>
          
          <View style={styles.footer}>
            <Chip
              style={[styles.statusChip, { backgroundColor: getStatusColor(item.status) }]}
              textStyle={styles.chipText}
            >
              {item.status.replace(/_/g, ' ').toUpperCase()}
            </Chip>
            <Text style={styles.date}>
              {new Date(item.created_at).toLocaleDateString()}
            </Text>
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="Search reports..."
        onChangeText={setSearch}
        value={search}
        onSubmitEditing={loadReports}
        style={styles.searchbar}
      />
      
      <View style={styles.filters}>
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <Button mode="outlined" onPress={() => setMenuVisible(true)}>
              Filters
            </Button>
          }
        >
          <Menu.Item onPress={() => { setStatusFilter(''); setMenuVisible(false); }} title="All Status" />
          <Menu.Item onPress={() => { setStatusFilter('pending'); setMenuVisible(false); }} title="Pending" />
          <Menu.Item onPress={() => { setStatusFilter('under_review'); setMenuVisible(false); }} title="Under Review" />
          <Menu.Item onPress={() => { setStatusFilter('resolved'); setMenuVisible(false); }} title="Resolved" />
        </Menu>
      </View>

      <FlatList
        data={reports}
        renderItem={renderReport}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadReports(); }} />
        }
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  searchbar: { margin: 16 },
  filters: { paddingHorizontal: 16, marginBottom: 8 },
  list: { padding: 16 },
  card: { marginBottom: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 16, fontWeight: 'bold', flex: 1 },
  type: { fontSize: 12, color: '#666', marginBottom: 8 },
  userInfo: { flexDirection: 'row', marginBottom: 4 },
  label: { fontWeight: 'bold' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  chip: { paddingHorizontal: 8 },
  chipText: { color: '#fff', fontSize: 10 },
  statusChip: { paddingHorizontal: 12 },
  date: { fontSize: 12, color: '#666' },
});

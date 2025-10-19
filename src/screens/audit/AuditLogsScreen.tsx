import React, {useEffect, useState} from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Alert,
} from 'react-native';
import {
  Text,
  Card,
  ActivityIndicator,
  useTheme,
  Chip,
} from 'react-native-paper';
import {Icon} from 'react-native-elements';
import {AuditLog} from '../../types';
import {fetchAuditLogs, type FetchAuditLogsOptions} from '../../services/auditService';

export default function AuditLogsScreen() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const theme = useTheme();

  const loadAuditLogs = async (pageNum = 1, refresh = false) => {
    try {
      const options: FetchAuditLogsOptions = {
        page: pageNum,
        limit: 20,
      };

      const { logs: fetchedLogs, pagination } = await fetchAuditLogs(options);

      if (refresh || pageNum === 1) {
        setLogs(fetchedLogs);
      } else {
        setLogs(prev => [...prev, ...fetchedLogs]);
      }

      setHasMore(pagination.hasMore);
      setPage(pagination.page);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAuditLogs(1, true);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadAuditLogs(1, true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getActionIcon = (action: string) => {
    const actionLower = action.toLowerCase();
    if (actionLower.includes('update') || actionLower.includes('edit')) {
      return 'edit';
    } else if (actionLower.includes('delete') || actionLower.includes('remove')) {
      return 'delete';
    } else if (actionLower.includes('create') || actionLower.includes('add')) {
      return 'add';
    } else if (actionLower.includes('login')) {
      return 'login';
    } else if (actionLower.includes('logout')) {
      return 'logout';
    } else if (actionLower.includes('verify')) {
      return 'verified';
    }
    return 'info';
  };

  const getActionColor = (action: string) => {
    const actionLower = action.toLowerCase();
    if (actionLower.includes('delete') || actionLower.includes('ban') || actionLower.includes('suspend')) {
      return '#f44336';
    } else if (actionLower.includes('update') || actionLower.includes('edit')) {
      return '#ff9800';
    } else if (actionLower.includes('create') || actionLower.includes('add') || actionLower.includes('verify')) {
      return '#4caf50';
    }
    return '#2196f3';
  };

  const renderLogItem = ({ item: log }: { item: AuditLog }) => (
    <Card style={styles.logCard}>
      <Card.Content>
        <View style={styles.logHeader}>
          <View style={styles.logIconContainer}>
            <Icon
              name={getActionIcon(log.action)}
              type="material"
              color={getActionColor(log.action)}
              size={24}
            />
          </View>
          <View style={styles.logInfo}>
            <Text variant="titleMedium" style={styles.logAction}>
              {log.action.replace(/_/g, ' ')}
            </Text>
            <Text variant="bodySmall" style={styles.logTimestamp}>
              {formatDate(log.timestamp)}
            </Text>
          </View>
        </View>

        <View style={styles.logDetails}>
          <Text variant="bodySmall" style={styles.logAdmin}>
            Admin: {log.adminId.name} ({log.adminId.email})
          </Text>

          {log.targetId && (
            <Text variant="bodySmall" style={styles.logTarget}>
              Target ID: {log.targetId}
            </Text>
          )}

          {log.details.method && (
            <Text variant="bodySmall" style={styles.logMethod}>
              Method: {log.details.method.toUpperCase()}
            </Text>
          )}

          {log.details.ip && (
            <Text variant="bodySmall" style={styles.logIP}>
              IP: {log.details.ip}
            </Text>
          )}
        </View>

        {log.details.details && Object.keys(log.details.details).length > 0 && (
          <View style={styles.logMetadata}>
            {Object.entries(log.details.details).map(([key, value]) => (
              <Chip key={key} style={styles.metaChip}>
                {key}: {String(value)}
              </Chip>
            ))}
          </View>
        )}
      </Card.Content>
    </Card>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading audit logs...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.title}>
          Admin Activity Logs
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Track all administrative actions
        </Text>
      </View>

      <FlatList
        data={logs}
        renderItem={renderLogItem}
        keyExtractor={item => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onEndReached={() => {
          if (hasMore && !loading) {
            loadAuditLogs(page + 1);
          }
        }}
        onEndReachedThreshold={0.1}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text>No audit logs found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
  },
  header: {
    padding: 16,
    backgroundColor: 'white',
    elevation: 2,
  },
  title: {
    color: '#3f51b5',
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#666',
    marginTop: 4,
  },
  logCard: {
    margin: 8,
    elevation: 2,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  logIconContainer: {
    marginRight: 12,
  },
  logInfo: {
    flex: 1,
  },
  logAction: {
    fontWeight: 'bold',
    color: '#333',
  },
  logTimestamp: {
    color: '#666',
    marginTop: 2,
  },
  logDetails: {
    marginBottom: 12,
  },
  logAdmin: {
    color: '#666',
    marginBottom: 4,
  },
  logTarget: {
    color: '#666',
    marginBottom: 4,
  },
  logMethod: {
    color: '#666',
    marginBottom: 4,
  },
  logIP: {
    color: '#666',
    marginBottom: 4,
  },
  logMetadata: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  metaChip: {
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#e3f2fd',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
});

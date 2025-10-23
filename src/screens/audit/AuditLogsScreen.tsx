import React, {useEffect, useState} from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Alert,
} from 'react-native';
import {Text, Card, ActivityIndicator, useTheme} from 'react-native-paper';
import {Icon} from 'react-native-elements';
import {AuditLog} from '../../types';
import {fetchAuditLogs, type FetchAuditLogsOptions} from '../../services/auditService';

const formatAction = (action: string) =>
  action
    .replace(/[-_]+/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

const formatDetailKey = (key: string) =>
  key
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase())
    .trim();

const stringifyDetailValue = (value: unknown): string => {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value === null || value === undefined) {
    return '';
  }
  if (Array.isArray(value)) {
    return value.map(item => stringifyDetailValue(item)).join(', ');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return '';
};

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

  const renderLogItem = ({item: log}: {item: AuditLog}) => {
    const detailEntries: Array<[string, unknown]> = [];
    const appendEntries = (source?: Record<string, unknown>) => {
      if (!source || typeof source !== 'object') {
        return;
      }
      Object.entries(source).forEach(([key, value]) => {
        if (key === 'method' || key === 'ip' || key === 'details') {
          return;
        }
        if (value === null || value === undefined || value === '') {
          return;
        }
        detailEntries.push([key, value]);
      });
    };

    appendEntries(log.details);

    const nestedDetails = log.details['details'];
    if (nestedDetails && typeof nestedDetails === 'object' && !Array.isArray(nestedDetails)) {
      appendEntries(nestedDetails as Record<string, unknown>);
    }

    appendEntries(log.metadata);

    const actionSource = typeof log.details['method'] === 'string' ? log.details['method'] : undefined;
    const ipAddress = typeof log.ip === 'string' && log.ip.length > 0
      ? log.ip
      : typeof log.details['ip'] === 'string'
        ? log.details['ip']
        : undefined;
    const adminName = log.adminId?.name?.trim();
    const adminEmail = log.adminId?.email?.trim();
    const performerText = adminName && adminEmail
      ? `${adminName} (${adminEmail})`
      : adminName ?? adminEmail ?? 'System Action';

    return (
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
                {formatAction(log.action)}
              </Text>
              <Text variant="bodySmall" style={styles.logTimestamp}>
                {formatDate(log.timestamp)}
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text variant="bodySmall" style={[styles.infoText, {color: theme.colors.onSurface}]}> 
              <Text style={[styles.infoLabel, {color: theme.colors.onSurfaceVariant}]}>Performed by: </Text>
              {performerText}
            </Text>
            {log.targetId ? (
              <Text variant="bodySmall" style={[styles.infoText, {color: theme.colors.onSurface}]}> 
                <Text style={[styles.infoLabel, {color: theme.colors.onSurfaceVariant}]}>Target: </Text>
                {log.targetId}
              </Text>
            ) : null}
            {actionSource ? (
              <Text variant="bodySmall" style={[styles.infoText, {color: theme.colors.onSurface}]}> 
                <Text style={[styles.infoLabel, {color: theme.colors.onSurfaceVariant}]}>Action Source: </Text>
                {actionSource.toUpperCase()}
              </Text>
            ) : null}
            {ipAddress ? (
              <Text variant="bodySmall" style={[styles.infoText, {color: theme.colors.onSurface}]}> 
                <Text style={[styles.infoLabel, {color: theme.colors.onSurfaceVariant}]}>IP Address: </Text>
                {ipAddress}
              </Text>
            ) : null}
          </View>

          {detailEntries.length > 0 ? (
            <View style={styles.section}>
              <Text variant="bodySmall" style={[styles.sectionTitle, {color: theme.colors.primary}]}>Additional Details</Text>
              {detailEntries.map(([key, value]) => {
                const formattedValue = stringifyDetailValue(value);
                if (!formattedValue) {
                  return null;
                }
                return (
                  <Text
                    key={key}
                    variant="bodySmall"
                    style={[styles.infoText, {color: theme.colors.onSurface}]}
                  >
                    <Text style={[styles.infoLabel, {color: theme.colors.onSurfaceVariant}]}>
                      {`${formatDetailKey(key)}: `}
                    </Text>
                    {formattedValue}
                  </Text>
                );
              })}
            </View>
          ) : null}
        </Card.Content>
      </Card>
    );
  };

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
  section: {
    marginTop: 12,
  },
  infoText: {
    marginBottom: 6,
  },
  infoLabel: {
    fontWeight: '600',
  },
  sectionTitle: {
    marginBottom: 6,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
});

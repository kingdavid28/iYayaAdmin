import React, {useEffect, useMemo, useState} from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import {
  Text,
  Card,
  Switch,
  Button,
  ActivityIndicator,
  useTheme,
  Portal,
  Dialog,
  TextInput,
} from 'react-native-paper';
import {Icon} from 'react-native-elements';
import {adminApi} from '../../services/apiService';
import {SystemSettings} from '../../types';

export default function SettingsScreen() {
  const DEFAULT_SETTINGS: SystemSettings = useMemo(
    () => ({
      maintenanceMode: false,
      registrationEnabled: true,
      emailVerificationRequired: true,
      backgroundCheckRequired: true,
    }),
    [],
  );

  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exportDialogVisible, setExportDialogVisible] = useState(false);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
  const [exportUserType, setExportUserType] = useState<string>('');
  const theme = useTheme();

  const loadSettings = async () => {
    try {
      const response = await adminApi.getSettings();
      if (response.success && response.data) {
        const normalized = {
          ...DEFAULT_SETTINGS,
          ...(response.data as Partial<SystemSettings>),
        } satisfies SystemSettings;
        setSettings(normalized);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load settings');
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSettingChange = async (key: keyof SystemSettings, value: boolean) => {
    setSaving(true);
    try {
      const updatedSettings: SystemSettings = {
        ...settings,
        [key]: value,
      };
      const response = await adminApi.updateSettings(updatedSettings);

      if (response.success && response.data) {
        const normalized = {
          ...DEFAULT_SETTINGS,
          ...(response.data as Partial<SystemSettings>),
        } satisfies SystemSettings;
        setSettings(normalized);
        Alert.alert('Success', 'Settings updated successfully');
      } else {
        throw new Error('Failed to update settings');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update settings');
      setSettings(prev => ({...prev}));
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    try {
      const response = await adminApi.exportUsers(exportFormat, exportUserType || undefined);

      // In a real app, you would handle the file download here
      Alert.alert(
        'Export Started',
        `User data export has been initiated in ${exportFormat.toUpperCase()} format. You will receive a notification when ready.`
      );

      setExportDialogVisible(false);
      setExportUserType('');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to export data');
    }
  };

  const SettingItem = ({
    title,
    description,
    value,
    onValueChange,
    icon,
    disabled = false,
  }: {
    title: string;
    description: string;
    value: boolean;
    onValueChange: (value: boolean) => void;
    icon: string;
    disabled?: boolean;
  }) => (
    <Card style={styles.settingCard}>
      <Card.Content>
        <View style={styles.settingRow}>
          <View style={styles.settingIcon}>
            <Icon name={icon} type="material" color="#3f51b5" size={24} />
          </View>
          <View style={styles.settingInfo}>
            <Text variant="titleMedium" style={styles.settingTitle}>
              {title}
            </Text>
            <Text variant="bodySmall" style={styles.settingDescription}>
              {description}
            </Text>
          </View>
          <Switch
            value={value}
            onValueChange={onValueChange}
            disabled={disabled || saving}
          />
        </View>
      </Card.Content>
    </Card>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text variant="headlineMedium" style={styles.title}>
          System Settings
        </Text>

        <Card style={styles.sectionCard}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.sectionTitle}>
              General Settings
            </Text>

            <SettingItem
              title="Maintenance Mode"
              description="Enable maintenance mode to prevent user access"
              value={settings.maintenanceMode}
              onValueChange={(value) => handleSettingChange('maintenanceMode', value)}
              icon="build"
            />

            <SettingItem
              title="User Registration"
              description="Allow new users to register accounts"
              value={settings.registrationEnabled}
              onValueChange={(value) => handleSettingChange('registrationEnabled', value)}
              icon="person-add"
            />

            <SettingItem
              title="Email Verification"
              description="Require email verification for new accounts"
              value={settings.emailVerificationRequired}
              onValueChange={(value) => handleSettingChange('emailVerificationRequired', value)}
              icon="email"
            />

            <SettingItem
              title="Background Check"
              description="Require background checks for caregivers"
              value={settings.backgroundCheckRequired}
              onValueChange={(value) => handleSettingChange('backgroundCheckRequired', value)}
              icon="security"
            />
          </Card.Content>
        </Card>

        <Card style={styles.sectionCard}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.sectionTitle}>
              Data Management
            </Text>

            <Button
              mode="outlined"
              onPress={() => setExportDialogVisible(true)}
              style={styles.actionButton}
              icon="download">
              Export User Data
            </Button>
          </Card.Content>
        </Card>

        <Card style={styles.sectionCard}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.sectionTitle}>
              System Information
            </Text>

            <View style={styles.infoRow}>
              <Icon name="info" type="material" color="#666" size={20} />
              <Text style={styles.infoText}>
                iYaya Admin Panel v1.0.0
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Icon name="computer" type="material" color="#666" size={20} />
              <Text style={styles.infoText}>
                Environment: {__DEV__ ? 'Development' : 'Production'}
              </Text>
            </View>
          </Card.Content>
        </Card>
      </View>

      <Portal>
        <Dialog
          visible={exportDialogVisible}
          onDismiss={() => setExportDialogVisible(false)}>
          <Dialog.Title>Export User Data</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogText}>
              Choose the format and user type for export:
            </Text>

            <View style={styles.dialogOptions}>
              <Button
                mode={exportFormat === 'json' ? 'contained' : 'outlined'}
                onPress={() => setExportFormat('json')}
                style={styles.formatButton}>
                JSON Format
              </Button>
              <Button
                mode={exportFormat === 'csv' ? 'contained' : 'outlined'}
                onPress={() => setExportFormat('csv')}
                style={styles.formatButton}>
                CSV Format
              </Button>
            </View>

            <TextInput
              label="User Type (optional)"
              value={exportUserType}
              onChangeText={setExportUserType}
              placeholder="parent, caregiver, admin, superadmin"
              style={styles.exportInput}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setExportDialogVisible(false)}>
              Cancel
            </Button>
            <Button onPress={handleExport} loading={saving}>
              Export
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
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
  content: {
    padding: 16,
  },
  title: {
    marginBottom: 24,
    textAlign: 'center',
    color: '#3f51b5',
    fontWeight: 'bold',
  },
  sectionCard: {
    marginBottom: 16,
    elevation: 2,
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#3f51b5',
  },
  settingCard: {
    marginBottom: 8,
    elevation: 1,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIcon: {
    marginRight: 16,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontWeight: 'bold',
  },
  settingDescription: {
    color: '#666',
  },
  actionButton: {
    marginTop: 8,
    borderColor: '#3f51b5',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoText: {
    marginLeft: 12,
    color: '#666',
  },
  dialogText: {
    marginBottom: 16,
  },
  dialogOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  formatButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  exportInput: {
    marginTop: 8,
  },
});

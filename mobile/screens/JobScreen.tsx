import React, { useEffect, useState } from 'react';
import { View, Text, Button, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { supabase } from '../utils/supabaseClient';
import { t } from '../utils/i18n';

type Props = NativeStackScreenProps<RootStackParamList, 'Job'>;

interface Project {
  id: string;
  title: string;
  reference: string | null;
  start_date: string | null;
  start_time: string | null;
  site_address: string | null;
  project_manager_name: string | null;
  project_manager_phone: string | null;
  site_manager_name: string | null;
  site_manager_phone: string | null;
}

export default function JobScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProject = async () => {
      const { data, error } = await supabase.from('projects').select('*').eq('id', id).single();
      if (error || !data) {
        Alert.alert('Error', error?.message || 'Project not found');
        navigation.goBack();
        return;
      }
      setProject(data as Project);
      setLoading(false);
    };
    fetchProject();
  }, [id]);

  if (loading || !project) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const handleStart = () => {
    navigation.navigate('FloorPlan', { id: project.id });
  };

  const handleTasks = () => {
    navigation.navigate('Tasks', { id: project.id });
  };

  const handleForms = () => {
    navigation.navigate('Forms', { id: project.id });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{project.title}</Text>
      <Text>Project Reference: {project.reference || 'N/A'}</Text>
      <Text>
        Start: {project.start_date || 'N/A'} {project.start_time || ''}
      </Text>
      <Text>Site Address: {project.site_address || 'N/A'}</Text>
      <Text>
        Project Manager: {project.project_manager_name || 'N/A'} ({project.project_manager_phone || 'N/A'})
      </Text>
      <Text>
        Site Manager: {project.site_manager_name || 'N/A'} ({project.site_manager_phone || 'N/A'})
      </Text>
      <Button title={t('startJob')} onPress={handleStart} />
      <View style={{ height: 8 }} />
      <Button title="View Tasks" onPress={handleTasks} />
      <View style={{ height: 8 }} />
      <Button title="Forms" onPress={handleForms} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, marginBottom: 16, fontWeight: 'bold' },
});
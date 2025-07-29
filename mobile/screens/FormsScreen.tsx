import React, { useEffect, useState } from 'react';
import { View, Text, Button, ActivityIndicator, FlatList, Alert, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { supabase } from '../utils/supabaseClient';
import { t } from '../utils/i18n';

type Props = NativeStackScreenProps<RootStackParamList, 'Forms'>;

interface FormDefinition {
  id: string;
  name: string;
  schema: any;
}

export default function FormsScreen({ route, navigation }: Props) {
  const { id: projectId } = route.params;
  const [forms, setForms] = useState<FormDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchForms = async () => {
      const { data, error } = await supabase
        .from('forms')
        .select('*')
        .or(`project_id.eq.${projectId},project_id.is.null`);
      if (error) {
        Alert.alert('Error', error.message);
      } else {
        const defs = (data || []).map((f: any) => ({
          id: f.id,
          name: f.name,
          schema: typeof f.schema === 'string' ? JSON.parse(f.schema) : f.schema,
        })) as FormDefinition[];
        setForms(defs);
      }
      setLoading(false);
    };
    fetchForms();
  }, [projectId]);

  const handleSelect = (form: FormDefinition) => {
    navigation.navigate('FormFill', { id: projectId, formId: form.id });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('forms')}</Text>
      {forms.length === 0 ? (
        <Text>{t('noForms')}</Text>
      ) : (
        <FlatList
          data={forms}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.itemRow}>
              <Text style={{ flex: 1 }}>{item.name}</Text>
              <Button title={t('select')} onPress={() => handleSelect(item)} />
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, marginBottom: 16, fontWeight: 'bold' },
  itemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
});
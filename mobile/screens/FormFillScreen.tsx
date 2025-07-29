import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Switch, Button, ActivityIndicator, Alert, StyleSheet, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { supabase } from '../utils/supabaseClient';
import { t } from '../utils/i18n';

type Props = NativeStackScreenProps<RootStackParamList, 'FormFill'>;

interface FormDefinition {
  id: string;
  name: string;
  schema: { fields: { name: string; label: string; type: string; required?: boolean }[] };
}

export default function FormFillScreen({ route, navigation }: Props) {
  const { id: projectId, formId } = route.params;
  const [form, setForm] = useState<FormDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<Record<string, any>>({});

  useEffect(() => {
    const fetchForm = async () => {
      const { data, error } = await supabase.from('forms').select('*').eq('id', formId).single();
      if (error || !data) {
        Alert.alert('Error', error?.message || 'Form not found');
        navigation.goBack();
        return;
      }
      const def: FormDefinition = {
        id: data.id,
        name: data.name,
        schema: typeof data.schema === 'string' ? JSON.parse(data.schema) : data.schema,
      };
      setForm(def);
      // Initialise form data
      const initial: Record<string, any> = {};
      def.schema.fields.forEach((field) => {
        initial[field.name] = field.type === 'boolean' ? false : '';
      });
      setFormData(initial);
      setLoading(false);
    };
    fetchForm();
  }, [formId]);

  const handleChange = (name: string, value: any) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (!form) return;
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) throw new Error('Not authenticated');
      const { error } = await supabase.from('form_responses').insert({
        form_id: form.id,
        project_id: projectId,
        submitted_by: userId,
        data: formData,
      });
      if (error) throw error;
      Alert.alert('Success', 'Form submitted');
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  if (loading || !form) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{form.name}</Text>
      {form.schema.fields.map((field) => (
        <View key={field.name} style={styles.fieldRow}>
          <Text style={styles.label}>{field.label}{field.required ? ' *' : ''}</Text>
          {field.type === 'text' && (
            <TextInput
              style={styles.input}
              value={formData[field.name] || ''}
              onChangeText={(val) => handleChange(field.name, val)}
            />
          )}
          {field.type === 'number' && (
            <TextInput
              style={styles.input}
              value={String(formData[field.name] || '')}
              keyboardType="numeric"
              onChangeText={(val) => handleChange(field.name, val)}
            />
          )}
          {field.type === 'boolean' && (
            <Switch
              value={!!formData[field.name]}
              onValueChange={(val) => handleChange(field.name, val)}
            />
          )}
          {field.type === 'date' && (
            <TextInput
              style={styles.input}
              value={formData[field.name] || ''}
              placeholder="YYYY-MM-DD"
              onChangeText={(val) => handleChange(field.name, val)}
            />
          )}
        </View>
      ))}
      <Button title={t('submit')} onPress={handleSubmit} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, marginBottom: 16, fontWeight: 'bold', textAlign: 'center' },
  fieldRow: { marginBottom: 12 },
  label: { marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 8,
    borderRadius: 4,
  },
});
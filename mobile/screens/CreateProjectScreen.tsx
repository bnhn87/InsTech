import React, { useState } from 'react';
import { View, Text, TextInput, Button, Alert, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { supabase } from '../utils/supabaseClient';
import { t } from '../utils/i18n';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateProject'>;

export default function CreateProjectScreen({ navigation }: Props) {
  // Basic project creation screen for mobile.  While the web UI provides a multi‑step
  // wizard, mobile keeps things simple by collecting the core fields on one screen.
  const [title, setTitle] = useState('');
  const [reference, setReference] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [duration, setDuration] = useState('1');
  const [siteAddress, setSiteAddress] = useState('');
  const [loadingBayAddress, setLoadingBayAddress] = useState('');
  const [upliftViaStairs, setUpliftViaStairs] = useState(false);
  const [labourRequired, setLabourRequired] = useState('1');
  const [autoAssign, setAutoAssign] = useState(true);
  const [endUserName, setEndUserName] = useState('');
  const [endUserPhone, setEndUserPhone] = useState('');
  const handleCreate = async () => {
    if (!title || !reference || !poNumber || !startDate || !startTime || !siteAddress || !loadingBayAddress) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      Alert.alert('Error', 'Not authenticated');
      return;
    }
    const userId = authData.user.id;
    try {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          title,
          reference,
          po_number: poNumber,
          start_date: startDate || null,
          start_time: startTime || null,
          duration: parseInt(duration, 10) || 1,
          site_address: siteAddress,
          loading_bay_details: loadingBayAddress,
          uplift_via_stairs: upliftViaStairs,
          labour_required: parseInt(labourRequired, 10) || 1,
          client_contact_name: endUserName,
          client_contact_phone: endUserPhone,
          auto_assign: autoAssign,
          created_by: userId,
        })
        .select()
        .single();
      if (error || !data) throw error;
      // Add current user as admin on the project
      const { error: pmError } = await supabase.from('project_members').insert({
        project_id: data.id,
        user_id: userId,
        role: 'admin',
      });
      if (pmError) throw pmError;
      Alert.alert('Success', 'Project created');
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('createProject')}</Text>
      <TextInput
        style={styles.input}
        placeholder="Project Title"
        value={title}
        onChangeText={setTitle}
      />
      <TextInput
        style={styles.input}
        placeholder="Project Reference"
        value={reference}
        onChangeText={setReference}
      />
      <TextInput
        style={styles.input}
        placeholder="SO/PO Number"
        value={poNumber}
        onChangeText={setPoNumber}
      />
      <TextInput
        style={styles.input}
        placeholder="Start Date (YYYY-MM-DD)"
        value={startDate}
        onChangeText={setStartDate}
      />
      <TextInput
        style={styles.input}
        placeholder="Start Time (HH:MM)"
        value={startTime}
        onChangeText={setStartTime}
      />
      <TextInput
        style={styles.input}
        placeholder="Duration (hours)"
        value={duration}
        onChangeText={setDuration}
        keyboardType="numeric"
      />
      <TextInput
        style={styles.input}
        placeholder="Site Address"
        value={siteAddress}
        onChangeText={setSiteAddress}
      />
      <TextInput
        style={styles.input}
        placeholder="Loading Bay Address"
        value={loadingBayAddress}
        onChangeText={setLoadingBayAddress}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <Text>Uplift via stairs?</Text>
        <Button title={upliftViaStairs ? 'Yes' : 'No'} onPress={() => setUpliftViaStairs(!upliftViaStairs)} />
      </View>
      <TextInput
        style={styles.input}
        placeholder="Labour Required"
        value={labourRequired}
        onChangeText={setLabourRequired}
        keyboardType="numeric"
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <Text>Auto assign products?</Text>
        <Button title={autoAssign ? 'Yes' : 'No'} onPress={() => setAutoAssign(!autoAssign)} />
      </View>
      <TextInput
        style={styles.input}
        placeholder="End User Name"
        value={endUserName}
        onChangeText={setEndUserName}
      />
      <TextInput
        style={styles.input}
        placeholder="End User Phone"
        value={endUserPhone}
        onChangeText={setEndUserPhone}
      />
      <Button title="Create Project" onPress={handleCreate} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, justifyContent: 'center' },
  title: { fontSize: 24, marginBottom: 16, textAlign: 'center' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 8,
    marginBottom: 12,
    borderRadius: 4,
  },
});
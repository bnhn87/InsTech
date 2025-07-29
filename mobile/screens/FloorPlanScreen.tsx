import React, { useState } from 'react';
import { View, Text, Button, Image, Alert, StyleSheet, FlatList, TextInput } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { RootStackParamList } from '../App';
import { supabase } from '../utils/supabaseClient';
import { t } from '../utils/i18n';

type Props = NativeStackScreenProps<RootStackParamList, 'FloorPlan'>;

interface Pin {
  x: number;
  y: number;
  status: string;
  label: string;
  comment: string;
  photoUri?: string | null;
}

export default function FloorPlanScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [pins, setPins] = useState<Pin[]>([]);
  const [label, setLabel] = useState('');
  const [status, setStatus] = useState('complete');
  const [comment, setComment] = useState('');

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const addPin = () => {
    // In a real app you would capture the coordinates by tapping the image.  Here we use random coordinates for simplicity.
    if (!label) {
      Alert.alert('Validation', 'Label is required');
      return;
    }
    // Require a photo if status is not 'complete'
    const pickPhoto = async () => {
      let photoUri: string | null = null;
      if (status !== 'complete') {
        const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.6 });
        if (!result.canceled) {
          photoUri = result.assets[0].uri;
        } else {
          Alert.alert('Photo required', 'A photo is mandatory for this status');
          return;
        }
      }
      setPins((prev) => [...prev, { x: Math.random(), y: Math.random(), status, label, comment, photoUri }]);
      setLabel('');
      setComment('');
    };
    pickPhoto();
  };

  const savePins = async () => {
    try {
      let floorPlanId: string | null = null;
      if (imageUri) {
        // Upload image to storage
        const response = await fetch(imageUri);
        const blob = await response.blob();
        const fileName = imageUri.substring(imageUri.lastIndexOf('/') + 1);
        const filePath = `${id}/${fileName}`;
        const { error: uploadError } = await supabase.storage.from('floorplans').upload(filePath, blob, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: publicUrlData } = supabase.storage.from('floorplans').getPublicUrl(filePath);
        const url = publicUrlData.publicUrl;
        const { data: fpData, error: fpError } = await supabase.from('floor_plans').insert({ project_id: id, file_url: url }).select().single();
        if (fpError || !fpData) throw fpError;
        floorPlanId = fpData.id;
      }
      if (floorPlanId) {
        const pinRows: any[] = [];
        for (const p of pins) {
          let photoUrl: string | undefined;
          if (p.photoUri) {
            const response = await fetch(p.photoUri);
            const blob = await response.blob();
            const fileName = `${floorPlanId}/${Date.now()}_${p.label}.jpg`;
            const { error: uploadErr } = await supabase.storage.from('pinphotos').upload(fileName, blob, { upsert: true });
            if (uploadErr) throw uploadErr;
            const { data: urlData } = supabase.storage.from('pinphotos').getPublicUrl(fileName);
            photoUrl = urlData.publicUrl;
          }
          pinRows.push({
            floor_plan_id: floorPlanId,
            x_coord: p.x,
            y_coord: p.y,
            status: p.status,
            label: p.label,
            comment: p.comment,
            photo_url: photoUrl ?? null,
          });
        }
        const { error: pinError } = await supabase.from('pins').insert(pinRows);
        if (pinError) throw pinError;
        Alert.alert('Success', 'Pins saved');
        navigation.goBack();
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('floorPlan')}</Text>
      <Button title={imageUri ? 'Change Image' : 'Pick Image'} onPress={pickImage} />
      {imageUri && <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />}
      <View style={styles.pinForm}>
        <TextInput
          placeholder="Label (product code)"
          value={label}
          onChangeText={setLabel}
          style={styles.input}
        />
        <TextInput
          placeholder="Status (complete/damage/snag/missing)"
          value={status}
          onChangeText={setStatus}
          style={styles.input}
        />
        <TextInput
          placeholder="Comment"
          value={comment}
          onChangeText={setComment}
          style={styles.input}
        />
        <Button title={t('addPin')} onPress={addPin} />
      </View>
      <FlatList
        data={pins}
        keyExtractor={(_, index) => index.toString()}
        renderItem={({ item, index }) => (
          <View style={styles.pinItem}>
            <Text>
              #{index + 1}: {item.label} – {item.status}
            </Text>
          </View>
        )}
        style={{ marginVertical: 16 }}
      />
      <Button title={t('save')} onPress={savePins} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, marginBottom: 16, textAlign: 'center' },
  image: { width: '100%', height: 200, marginVertical: 16 },
  pinForm: { marginVertical: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 8,
    marginBottom: 8,
    borderRadius: 4,
  },
  pinItem: { paddingVertical: 4 },
});
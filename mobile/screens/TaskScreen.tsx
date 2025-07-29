import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { supabase } from '../utils/supabaseClient';

type Props = NativeStackScreenProps<RootStackParamList, 'Tasks'>;

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  assignee_id: string | null;
  category: string | null;
  due_date: string | null;
  created_at: string;
}

interface Member {
  user_id: string;
  full_name: string | null;
  role: string;
}

export default function TaskScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('P3');
  const [assignee, setAssignee] = useState('');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      // Fetch tasks
      const { data: taskData, error: taskErr } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', id)
        .order('created_at', { ascending: false });
      if (taskErr) {
        Alert.alert('Error', taskErr.message);
        return;
      }
      setTasks(taskData as Task[]);
      // Fetch members
      const { data: memberData, error: memErr } = await supabase
        .from('project_members')
        .select('user_id, role, users(full_name)')
        .eq('project_id', id);
      if (!memErr && memberData) {
        const mapped = memberData.map((m: any) => ({
          user_id: m.user_id,
          role: m.role,
          full_name: m.users?.full_name ?? null,
        }));
        setMembers(mapped);
      }
      setLoading(false);
    };
    fetchData();
  }, [id]);

  const handleAdd = async () => {
    if (!title) {
      Alert.alert('Missing title', 'Please enter a title for the task');
      return;
    }
    try {
      const { error } = await supabase.from('tasks').insert({
        project_id: id,
        title,
        description: description || null,
        priority,
        assignee_id: assignee || null,
        due_date: dueDate || null,
      });
      if (error) throw error;
      setTitle('');
      setDescription('');
      setPriority('P3');
      setAssignee('');
      setDueDate('');
      // Refresh tasks
      const { data: newTasks, error: refreshErr } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', id)
        .order('created_at', { ascending: false });
      if (!refreshErr && newTasks) setTasks(newTasks as Task[]);
      setAdding(false);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handleAdvance = async (task: Task) => {
    const statuses = ['open', 'in_progress', 'completed', 'verified'];
    const currentIndex = statuses.indexOf(task.status);
    const nextStatus = statuses[(currentIndex + 1) % statuses.length];
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: nextStatus })
        .eq('id', task.id);
      if (error) throw error;
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)));
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Text>Loading tasks…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Tasks</Text>
      <Button title={adding ? 'Cancel' : 'Add Task'} onPress={() => setAdding(!adding)} />
      {adding && (
        <View style={styles.form}>
          <TextInput
            placeholder="Title"
            value={title}
            onChangeText={setTitle}
            style={styles.input}
          />
          <TextInput
            placeholder="Description"
            value={description}
            onChangeText={setDescription}
            style={[styles.input, { height: 80 }]}
            multiline
          />
          <TextInput
            placeholder="Priority (P1/P2/P3)"
            value={priority}
            onChangeText={setPriority}
            style={styles.input}
          />
          <TextInput
            placeholder="Assignee ID (optional)"
            value={assignee}
            onChangeText={setAssignee}
            style={styles.input}
          />
          <TextInput
            placeholder="Due Date (YYYY-MM-DD)"
            value={dueDate}
            onChangeText={setDueDate}
            style={styles.input}
          />
          <Button title="Save" onPress={handleAdd} />
        </View>
      )}
      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.taskItem}>
            <View style={{ flex: 1 }}>
              <Text style={styles.taskTitle}>{item.title}</Text>
              {item.description ? <Text style={styles.taskDesc}>{item.description}</Text> : null}
              <Text style={styles.taskMeta}>
                Priority: {item.priority} | Status: {item.status} | Due: {item.due_date ?? 'N/A'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => handleAdvance(item)} style={styles.advanceButton}>
              <Text style={{ color: '#fff' }}>Next</Text>
            </TouchableOpacity>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 100 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  form: { marginVertical: 12 },
  input: { borderColor: '#ccc', borderWidth: 1, padding: 8, marginBottom: 8, borderRadius: 4 },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    borderRadius: 4,
    marginBottom: 8,
    backgroundColor: '#f9f9f9',
  },
  taskTitle: { fontSize: 16, fontWeight: '600' },
  taskDesc: { fontSize: 14, color: '#555' },
  taskMeta: { fontSize: 12, color: '#777' },
  advanceButton: {
    backgroundColor: '#6f42c1',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
});
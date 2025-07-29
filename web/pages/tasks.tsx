import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

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

// Tasks page: lists and creates tasks for a given project.  Expects `id`
// query param corresponding to the project UUID.
export default function TasksPage() {
  const router = useRouter();
  const { id } = router.query;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'P3',
    status: 'open',
    assignee_id: '',
    category: '',
    due_date: '',
  });
  const [error, setError] = useState<string | null>(null);

  // Fetch existing tasks
  useEffect(() => {
    if (!id || typeof id !== 'string') return;
    const fetchTasks = async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', id)
        .order('created_at', { ascending: false });
      if (error) {
        setError(error.message);
      } else {
        setTasks(data as Task[]);
      }
      setLoading(false);
    };
    fetchTasks();
  }, [id]);

  // Fetch project members for assignment options
  useEffect(() => {
    if (!id || typeof id !== 'string') return;
    const fetchMembers = async () => {
      const { data, error } = await supabase
        .from('project_members')
        .select('user_id, role, users(full_name)')
        .eq('project_id', id);
      if (!error && data) {
        const mapped = data.map((m: any) => ({
          user_id: m.user_id,
          role: m.role,
          full_name: m.users?.full_name ?? null,
        }));
        setMembers(mapped);
      }
    };
    fetchMembers();
  }, [id]);

  const handleCreateTask = async () => {
    if (!id || typeof id !== 'string') return;
    if (!formData.title) {
      alert('Title is required');
      return;
    }
    try {
      const { error } = await supabase.from('tasks').insert({
        project_id: id,
        title: formData.title,
        description: formData.description || null,
        priority: formData.priority,
        status: formData.status,
        assignee_id: formData.assignee_id || null,
        category: formData.category || null,
        due_date: formData.due_date || null,
      });
      if (error) throw error;
      // Refresh tasks
      const { data: newTasks, error: fetchErr } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', id)
        .order('created_at', { ascending: false });
      if (!fetchErr && newTasks) {
        setTasks(newTasks as Task[]);
      }
      setFormVisible(false);
      setFormData({ title: '', description: '', priority: 'P3', status: 'open', assignee_id: '', category: '', due_date: '' });
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleStatusToggle = async (task: Task) => {
    // cycle status: open -> in_progress -> completed -> verified -> open
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
      alert(err.message);
    }
  };

  return (
    <main style={{ maxWidth: '640px', margin: '0 auto', padding: '1rem' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem' }}>Project Tasks</h1>
      {error && <p style={{ color: 'red', marginBottom: '0.5rem' }}>{error}</p>}
      {loading ? (
        <p>Loading tasks…</p>
      ) : (
        <>
          <button
            onClick={() => setFormVisible(!formVisible)}
            style={{
              backgroundColor: '#0066cc',
              color: '#fff',
              padding: '0.5rem 1rem',
              border: 'none',
              borderRadius: '4px',
              marginBottom: '1rem',
              cursor: 'pointer',
            }}
          >
            {formVisible ? 'Cancel' : 'Add Task'}
          </button>
          {formVisible && (
            <div
              style={{
                border: '1px solid #ddd',
                padding: '1rem',
                marginBottom: '1rem',
                borderRadius: '4px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
              }}
            >
              <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.5rem' }}>New Task</h2>
              <div style={{ marginBottom: '0.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500 }}>Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  style={{ border: '1px solid #ccc', padding: '0.5rem', width: '100%' }}
                />
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500 }}>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  style={{ border: '1px solid #ccc', padding: '0.5rem', width: '100%' }}
                />
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500 }}>Priority</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  style={{ border: '1px solid #ccc', padding: '0.5rem', width: '100%' }}
                >
                  <option value="P1">P1</option>
                  <option value="P2">P2</option>
                  <option value="P3">P3</option>
                </select>
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500 }}>Assignee</label>
                <select
                  value={formData.assignee_id}
                  onChange={(e) => setFormData({ ...formData, assignee_id: e.target.value })}
                  style={{ border: '1px solid #ccc', padding: '0.5rem', width: '100%' }}
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {(m.full_name || m.user_id) + ' (' + m.role + ')'}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500 }}>Category</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  style={{ border: '1px solid #ccc', padding: '0.5rem', width: '100%' }}
                />
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500 }}>Due Date</label>
                <input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  style={{ border: '1px solid #ccc', padding: '0.5rem', width: '100%' }}
                />
              </div>
              <button
                onClick={handleCreateTask}
                style={{
                  backgroundColor: '#28a745',
                  color: '#fff',
                  padding: '0.5rem 1rem',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Save Task
              </button>
            </div>
          )}
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {tasks.map((task) => (
              <li
                key={task.id}
                style={{
                  border: '1px solid #ddd',
                  padding: '0.75rem',
                  borderRadius: '4px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.5rem',
                  backgroundColor: '#f9f9f9',
                }}
              >
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0, fontWeight: 600 }}>
                    {task.title}{' '}
                    <span style={{ fontSize: '0.75rem', color: '#777' }}>[{task.priority}]</span>
                  </h3>
                  {task.description && (
                    <p style={{ margin: '0.25rem 0', fontSize: '0.875rem', color: '#555' }}>{task.description}</p>
                  )}
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#777' }}>
                    Status: {task.status} | Due: {task.due_date ?? 'N/A'}
                  </p>
                </div>
                <button
                  onClick={() => handleStatusToggle(task)}
                  style={{
                    backgroundColor: '#6f42c1',
                    color: '#fff',
                    padding: '0.3rem 0.6rem',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                  }}
                >
                  Advance
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
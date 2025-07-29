import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import { useTranslation } from '../lib/i18n';

/**
 * Admin dashboard listing projects.  Only users with admin role on a project
 * may view and edit.  Provides simple in‑row editing of core project fields.
 */
export default function Dashboard() {
  const { t } = useTranslation();
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edited, setEdited] = useState<any>({});

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id;
        if (!userId) throw new Error('Not authenticated');
        // Find projects where current user is admin
        const { data: memberships, error: memErr } = await supabase
          .from('project_members')
          .select('project_id')
          .eq('user_id', userId)
          .eq('role', 'admin');
        if (memErr) throw memErr;
        const projectIds = memberships?.map((m) => m.project_id) || [];
        if (projectIds.length === 0) {
          setProjects([]);
          setLoading(false);
          return;
        }
        const { data: projectData, error: projErr } = await supabase
          .from('projects')
          .select('*')
          .in('id', projectIds);
        if (projErr) throw projErr;
        setProjects(projectData || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const startEdit = (p: any) => {
    setEditingId(p.id);
    setEdited({ ...p });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEdited({});
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      const updates: any = {
        title: edited.title,
        reference: edited.reference,
        po_number: edited.po_number,
        start_date: edited.start_date,
        start_time: edited.start_time,
        site_address: edited.site_address,
        loading_bay_details: edited.loading_bay_details,
        labour_required: edited.labour_required,
        auto_assign: edited.auto_assign,
      };
      const { error: updErr } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', editingId);
      if (updErr) throw updErr;
      // update local state
      setProjects((prev) => prev.map((p) => (p.id === editingId ? { ...p, ...updates } : p)));
      setEditingId(null);
      setEdited({});
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) return <p>Loading...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;

  return (
    <main style={{ maxWidth: 1000, margin: '2rem auto', padding: '1rem' }}>
      <h1>Dashboard</h1>
      {projects.length === 0 ? (
        <p>No projects found. <a href="/project">Create one</a>.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #ccc' }}>Title</th>
              <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #ccc' }}>Reference</th>
              <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #ccc' }}>PO Number</th>
              <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #ccc' }}>Start</th>
              <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #ccc' }}>Site Address</th>
              <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #ccc' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.5rem' }}>
                  {editingId === p.id ? (
                    <input
                      type="text"
                      value={edited.title}
                      onChange={(e) => setEdited((prev: any) => ({ ...prev, title: e.target.value }))}
                    />
                  ) : (
                    p.title
                  )}
                </td>
                <td style={{ padding: '0.5rem' }}>
                  {editingId === p.id ? (
                    <input
                      type="text"
                      value={edited.reference || ''}
                      onChange={(e) => setEdited((prev: any) => ({ ...prev, reference: e.target.value }))}
                    />
                  ) : (
                    p.reference
                  )}
                </td>
                <td style={{ padding: '0.5rem' }}>
                  {editingId === p.id ? (
                    <input
                      type="text"
                      value={edited.po_number || ''}
                      onChange={(e) => setEdited((prev: any) => ({ ...prev, po_number: e.target.value }))}
                    />
                  ) : (
                    p.po_number || ''
                  )}
                </td>
                <td style={{ padding: '0.5rem' }}>
                  {editingId === p.id ? (
                    <div>
                      <input
                        type="date"
                        value={edited.start_date || ''}
                        onChange={(e) => setEdited((prev: any) => ({ ...prev, start_date: e.target.value }))}
                      />
                      <input
                        type="time"
                        value={edited.start_time || ''}
                        onChange={(e) => setEdited((prev: any) => ({ ...prev, start_time: e.target.value }))}
                      />
                    </div>
                  ) : (
                    `${p.start_date || ''} ${p.start_time || ''}`
                  )}
                </td>
                <td style={{ padding: '0.5rem' }}>
                  {editingId === p.id ? (
                    <input
                      type="text"
                      value={edited.site_address || ''}
                      onChange={(e) => setEdited((prev: any) => ({ ...prev, site_address: e.target.value }))}
                    />
                  ) : (
                    p.site_address
                  )}
                </td>
                <td style={{ padding: '0.5rem' }}>
                  {editingId === p.id ? (
                    <div>
                      <button onClick={saveEdit} style={{ marginRight: '0.5rem' }}>Save</button>
                      <button onClick={cancelEdit}>Cancel</button>
                    </div>
                  ) : (
                    <div>
                      <button onClick={() => startEdit(p)} style={{ marginRight: '0.5rem' }}>Edit</button>
                      <a href={`/job?projectId=${p.id}`} style={{ marginRight: '0.5rem' }}>Open</a>
                      <a href={`/quote/${p.id}`}>Quote</a>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
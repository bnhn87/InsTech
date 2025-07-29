import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

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

// Installer job view.  Expects a query param `id` with the project UUID
// (could also be a labour token depending on your implementation).
export default function Job() {
  const router = useRouter();
  const { id } = router.query;
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || typeof id !== 'string') return;
    const fetchProject = async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase.from('projects').select('*').eq('id', id).single();
      if (error) {
        setError(error.message);
      } else {
        setProject(data as Project);
      }
      setLoading(false);
    };
    fetchProject();
  }, [id]);

  if (loading || !project) {
    return <p style={{ padding: '1rem' }}>Loading job…</p>;
  }
  if (error) return <p style={{ color: 'red', padding: '1rem' }}>{error}</p>;

  const handleStartJob = () => {
    router.push(`/floorplan?id=${project.id}`);
  };

  return (
    <main style={{ maxWidth: 600, margin: '2rem auto', padding: '1rem' }}>
      <h1>{project.title}</h1>
      <p>Project Reference: {project.reference || 'N/A'}</p>
      <p>Start Date: {project.start_date || 'N/A'} at {project.start_time || 'N/A'}</p>
      <p>Site Address: {project.site_address || 'N/A'}</p>
      <h2>Contacts</h2>
      <p>Project Manager: {project.project_manager_name} ({project.project_manager_phone})</p>
      <p>Site Manager: {project.site_manager_name} ({project.site_manager_phone})</p>
      <button onClick={handleStartJob} style={{ marginTop: '1rem' }}>Start Job</button>
      <button
        onClick={() => router.push(`/tasks?id=${project.id}`)}
        style={{ marginTop: '0.5rem', marginLeft: '0.5rem' }}
      >
        View Tasks
      </button>
      <button
        onClick={() => router.push(`/forms?id=${project.id}`)}
        style={{ marginTop: '0.5rem', marginLeft: '0.5rem' }}
      >
        Forms
      </button>
    </main>
  );
}
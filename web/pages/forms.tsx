import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import { saveOffline, loadOffline } from '../lib/offline';
import { syncOfflineForms } from '../lib/sync';
import { useTranslation } from '../lib/i18n';

interface FormSchemaField {
  name: string;
  label: string;
  type: string;
  required?: boolean;
}

interface FormDefinition {
  id: string;
  name: string;
  schema: { fields: FormSchemaField[] };
}

/**
 * Forms page
 *
 * This page lists all available forms for a project and allows users to
 * fill out a selected form.  Form definitions are stored in the
 * `forms` table and include a JSON schema with an array of `fields`.
 * Each field has a `name`, `label`, `type` ('text', 'number', 'boolean', 'date'),
 * and whether it is required.  When a form is submitted the data is
 * stored in `form_responses`.  Only project members may view and submit
 * forms.  Admins can create new forms via SQL or a future UI.
 */
export default function FormsPage() {
  const router = useRouter();
  const { id } = router.query; // project id
  const { t } = useTranslation();
  const [forms, setForms] = useState<FormDefinition[]>([]);
  const [selectedForm, setSelectedForm] = useState<FormDefinition | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!id || typeof id !== 'string') return;
    const fetchForms = async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('forms')
        .select('*')
        .or(`project_id.eq.${id},project_id.is.null`);
      if (error) {
        setError(error.message);
      } else {
        // Ensure schema is parsed as JSON
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
    // Attempt to sync offline form responses
    syncOfflineForms();
  }, [id]);

  const handleSelectForm = (form: FormDefinition) => {
    setSelectedForm(form);
    // Initialise form data with empty values
    const initial: Record<string, any> = {};
    form.schema.fields.forEach((field) => {
      initial[field.name] = field.type === 'boolean' ? false : '';
    });
    setFormData(initial);
  };

  const handleChange = (name: string, value: any) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (!id || typeof id !== 'string' || !selectedForm) return;
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) throw new Error('Not authenticated');
      const responsePayload = {
        form_id: selectedForm.id,
        project_id: id,
        submitted_by: userId,
        data: formData,
      };
      // If offline, save to offline storage
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const existing = loadOffline<any[]>('offline_forms') || [];
        existing.push(responsePayload);
        saveOffline('offline_forms', existing);
        alert('You are offline. Form saved locally and will sync automatically.');
      } else {
        const { error: insertError } = await supabase.from('form_responses').insert(responsePayload);
        if (insertError) throw insertError;
        alert('Form submitted successfully');
      }
      setSelectedForm(null);
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) return <p style={{ padding: '1rem' }}>Loading forms…</p>;
  if (error) return <p style={{ color: 'red', padding: '1rem' }}>{error}</p>;

  return (
    <main style={{ maxWidth: 700, margin: '2rem auto', padding: '1rem' }}>
      <h1>{t('forms')}</h1>
      {!selectedForm && (
        <div>
          {forms.length === 0 ? (
            <p>{t('noForms')}</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {forms.map((form) => (
                <li key={form.id} style={{ marginBottom: '0.5rem' }}>
                  <button onClick={() => handleSelectForm(form)}>{form.name}</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {selectedForm && (
        <div>
          <h2>{selectedForm.name}</h2>
          {selectedForm.schema.fields.map((field) => (
            <div key={field.name} style={{ marginBottom: '0.5rem' }}>
              <label>
                {field.label}{field.required ? ' *' : ''}
                {field.type === 'text' && (
                  <input
                    type="text"
                    value={formData[field.name] || ''}
                    onChange={(e) => handleChange(field.name, e.target.value)}
                    required={field.required}
                    style={{ width: '100%', marginTop: '0.25rem' }}
                  />
                )}
                {field.type === 'number' && (
                  <input
                    type="number"
                    value={formData[field.name] || ''}
                    onChange={(e) => handleChange(field.name, e.target.value)}
                    required={field.required}
                    style={{ width: '100%', marginTop: '0.25rem' }}
                  />
                )}
                {field.type === 'boolean' && (
                  <input
                    type="checkbox"
                    checked={!!formData[field.name]}
                    onChange={(e) => handleChange(field.name, e.target.checked)}
                    style={{ marginLeft: '0.5rem' }}
                  />
                )}
                {field.type === 'date' && (
                  <input
                    type="date"
                    value={formData[field.name] || ''}
                    onChange={(e) => handleChange(field.name, e.target.value)}
                    required={field.required}
                    style={{ width: '100%', marginTop: '0.25rem' }}
                  />
                )}
              </label>
            </div>
          ))}
          <button onClick={handleSubmit}>{t('submit')}</button>{' '}
          <button onClick={() => setSelectedForm(null)} style={{ marginLeft: '0.5rem' }}>
            {t('cancel')}
          </button>
        </div>
      )}
    </main>
  );
}
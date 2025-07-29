import { useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import { useTranslation } from '../lib/i18n';

/**
 * Project creation wizard.  This form guides the user through
 * multiple steps to ensure all required fields are captured before
 * creating a project.  Required fields include project title,
 * SO/PO number, internal reference, start date/time, site and loading bay
 * addresses, and a work order document upload.  Optional settings
 * include auto‑assignment of products.  After completion the project
 * and associated files are saved to Supabase.
 */
export default function CreateProject() {
  const router = useRouter();
  const { t } = useTranslation();
  const [step, setStep] = useState<number>(0);
  const [form, setForm] = useState({
    title: '',
    reference: '',
    startDate: '',
    startTime: '',
    duration: 1,
    siteAddress: '',
    loadingBayAddress: '',
    liftDetails: '',
    labourRequired: 1,
    equipmentNeeded: '',
    projectManagerName: '',
    projectManagerPhone: '',
    siteManagerName: '',
    siteManagerPhone: '',
    clientContactName: '',
    clientContactPhone: '',
    autoAssign: true,
    upliftViaStairs: false,
  });
  const [soPoNumber, setSoPoNumber] = useState('');
  const [uploadWO, setUploadWO] = useState<File | null>(null);
  const [uploadRAMS, setUploadRAMS] = useState<File | null>(null);
  const [uploadDrawings, setUploadDrawings] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };
  const handleFileChange = (setter: (f: File | null) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setter(f);
  };

  const validateStep = (): boolean => {
    // Step 0: basic details
    if (step === 0) {
      return (
        form.title.trim() !== '' &&
        soPoNumber.trim() !== '' &&
        form.reference.trim() !== '' &&
        form.startDate !== '' &&
        form.startTime !== ''
      );
    }
    // Step 1: location
    if (step === 1) {
      return form.siteAddress.trim() !== '' && form.loadingBayAddress.trim() !== '';
    }
    // Step 2: documents (require work order)
    if (step === 2) {
      return uploadWO !== null;
    }
    return true;
  };

  const nextStep = () => {
    if (!validateStep()) {
      alert('Please fill in all required fields before continuing');
      return;
    }
    setStep((s) => s + 1);
  };
  const prevStep = () => setStep((s) => Math.max(0, s - 1));

  const handleCreateProject = async () => {
    if (!validateStep()) {
      alert('Please complete all required fields');
      return;
    }
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) throw new Error('Not authenticated');
      // Insert project
      const { data: projectData, error: projectErr } = await supabase
        .from('projects')
        .insert({
          title: form.title,
          reference: form.reference,
          po_number: soPoNumber,
          start_date: form.startDate || null,
          start_time: form.startTime || null,
          duration: form.duration,
          site_address: form.siteAddress,
          loading_bay_details: form.loadingBayAddress,
          lift_details: form.liftDetails,
          uplift_via_stairs: form.upliftViaStairs,
          labour_required: form.labourRequired,
          equipment_needed: form.equipmentNeeded
            ? form.equipmentNeeded.split(',').map((s) => s.trim())
            : null,
          project_manager_name: form.projectManagerName,
          project_manager_phone: form.projectManagerPhone,
          site_manager_name: form.siteManagerName,
          site_manager_phone: form.siteManagerPhone,
          client_contact_name: form.clientContactName,
          client_contact_phone: form.clientContactPhone,
          created_by: userId,
          auto_assign: form.autoAssign,
        })
        .select()
        .single();
      if (projectErr || !projectData) throw projectErr || new Error('Project insert failed');
      const projectId = projectData.id;
      // Insert project membership as admin
      const { error: memberErr } = await supabase
        .from('project_members')
        .insert({ project_id: projectId, user_id: userId, role: 'admin' });
      if (memberErr) throw memberErr;
      // Helper to upload document and insert record
      const uploadDoc = async (file: File | null, fileType: 'wo' | 'rams' | 'drawings') => {
        if (!file) return;
        const path = `${projectId}/${fileType}_${file.name}`;
        const { error: upErr } = await supabase.storage
          .from('documents')
          .upload(path, file, { upsert: true });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage
          .from('documents')
          .getPublicUrl(path);
        const url = urlData.publicUrl;
        // For drawings we skip documents table entry
        if (fileType === 'drawings') return;
        const { error: docErr } = await supabase
          .from('documents')
          .insert({ project_id: projectId, file_type: fileType, file_url: url, uploaded_by: userId });
        if (docErr) throw docErr;
      };
      await uploadDoc(uploadWO, 'wo');
      await uploadDoc(uploadRAMS, 'rams');
      await uploadDoc(uploadDrawings, 'drawings');
      alert('Project created successfully');
      router.push('/');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <main style={{ maxWidth: 800, margin: '2rem auto', padding: '1rem' }}>
      <h1>{t('createProject')}</h1>
      {/* Step bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        {['Details', 'Location', 'Documents', 'Review'].map((label, idx) => (
          <div
            key={idx}
            style={{
              flex: 1,
              textAlign: 'center',
              padding: '0.5rem',
              background: step === idx ? '#0070f3' : '#eaeaea',
              color: step === idx ? '#fff' : '#000',
              borderRadius: '4px',
              marginRight: idx < 3 ? '0.5rem' : 0,
            }}
          >
            {label}
          </div>
        ))}
      </div>
      {/* Step 0 */}
      {step === 0 && (
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            Project Title *
            <input
              type="text"
              name="title"
              value={form.title}
              onChange={handleChange}
              style={{ width: '100%' }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            SO/PO Number *
            <input
              type="text"
              value={soPoNumber}
              onChange={(e) => setSoPoNumber(e.target.value)}
              style={{ width: '100%' }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            Project Reference *
            <input
              type="text"
              name="reference"
              value={form.reference}
              onChange={handleChange}
              style={{ width: '100%' }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            Start Date *
            <input
              type="date"
              name="startDate"
              value={form.startDate}
              onChange={handleChange}
              style={{ width: '100%' }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            Start Time *
            <input
              type="time"
              name="startTime"
              value={form.startTime}
              onChange={handleChange}
              style={{ width: '100%' }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            Duration (hours)
            <input
              type="number"
              name="duration"
              value={form.duration}
              min={1}
              onChange={handleChange}
              style={{ width: '100%' }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            Labour Required
            <input
              type="number"
              name="labourRequired"
              value={form.labourRequired}
              min={1}
              onChange={handleChange}
              style={{ width: '100%' }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            Auto assign products?
            <input
              type="checkbox"
              name="autoAssign"
              checked={form.autoAssign}
              onChange={handleChange}
              style={{ marginLeft: '0.5rem' }}
            />
          </label>
          <button onClick={nextStep}>Next</button>
        </div>
      )}
      {/* Step 1 */}
      {step === 1 && (
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            Site Address *
            <input
              type="text"
              name="siteAddress"
              value={form.siteAddress}
              onChange={handleChange}
              style={{ width: '100%' }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            Loading Bay Address *
            <input
              type="text"
              name="loadingBayAddress"
              value={form.loadingBayAddress}
              onChange={handleChange}
              style={{ width: '100%' }}
            />
          </label>
          <button
            onClick={() => setForm((prev) => ({ ...prev, loadingBayAddress: prev.siteAddress }))}
            style={{ marginBottom: '0.5rem' }}
          >
            Copy Site Address
          </button>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            Lift Details
            <input
              type="text"
              name="liftDetails"
              value={form.liftDetails}
              onChange={handleChange}
              style={{ width: '100%' }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            Equipment Needed (comma separated)
            <input
              type="text"
              name="equipmentNeeded"
              value={form.equipmentNeeded}
              onChange={handleChange}
              style={{ width: '100%' }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            Uplift via stairs?
            <input
              type="checkbox"
              name="upliftViaStairs"
              checked={form.upliftViaStairs}
              onChange={handleChange}
              style={{ marginLeft: '0.5rem' }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            Project Manager Name
            <input
              type="text"
              name="projectManagerName"
              value={form.projectManagerName}
              onChange={handleChange}
              style={{ width: '100%' }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            Project Manager Phone
            <input
              type="text"
              name="projectManagerPhone"
              value={form.projectManagerPhone}
              onChange={handleChange}
              style={{ width: '100%' }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            Site Manager Name
            <input
              type="text"
              name="siteManagerName"
              value={form.siteManagerName}
              onChange={handleChange}
              style={{ width: '100%' }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            Site Manager Phone
            <input
              type="text"
              name="siteManagerPhone"
              value={form.siteManagerPhone}
              onChange={handleChange}
              style={{ width: '100%' }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            End User Name
            <input
              type="text"
              name="clientContactName"
              value={form.clientContactName}
              onChange={handleChange}
              style={{ width: '100%' }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            End User Phone
            <input
              type="text"
              name="clientContactPhone"
              value={form.clientContactPhone}
              onChange={handleChange}
              style={{ width: '100%' }}
            />
          </label>
          <div style={{ marginTop: '1rem' }}>
            <button onClick={prevStep} style={{ marginRight: '0.5rem' }}>Back</button>
            <button onClick={nextStep}>Next</button>
          </div>
        </div>
      )}
      {/* Step 2 */}
      {step === 2 && (
        <div>
          <p>Upload documents</p>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            Works Order / Delivery Note *
            <input type="file" accept="application/pdf,image/*" onChange={handleFileChange(setUploadWO)} />
          </label>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            RAMS
            <input type="file" accept="application/pdf" onChange={handleFileChange(setUploadRAMS)} />
          </label>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            Drawings (optional)
            <input type="file" accept="application/pdf,image/*" onChange={handleFileChange(setUploadDrawings)} />
          </label>
          <div style={{ marginTop: '1rem' }}>
            <button onClick={prevStep} style={{ marginRight: '0.5rem' }}>Back</button>
            <button onClick={nextStep}>Next</button>
          </div>
        </div>
      )}
      {/* Step 3 */}
      {step === 3 && (
        <div>
          <h3>Review & Create Project</h3>
          <p><strong>Title:</strong> {form.title}</p>
          <p><strong>SO/PO Number:</strong> {soPoNumber}</p>
          <p><strong>Project Reference:</strong> {form.reference}</p>
          <p><strong>Start:</strong> {form.startDate} {form.startTime}</p>
          <p><strong>Site Address:</strong> {form.siteAddress}</p>
          <p><strong>Loading Bay:</strong> {form.loadingBayAddress}</p>
          <p><strong>Uplift via Stairs:</strong> {form.upliftViaStairs ? 'Yes' : 'No'}</p>
          <p><strong>End User:</strong> {form.clientContactName} ({form.clientContactPhone})</p>
          <p><strong>Auto Assign:</strong> {form.autoAssign ? 'Yes' : 'No'}</p>
          <div style={{ marginTop: '1rem' }}>
            <button onClick={prevStep} style={{ marginRight: '0.5rem' }}>Back</button>
            <button onClick={handleCreateProject}>Create Project</button>
          </div>
          {error && <p style={{ color: 'red' }}>{error}</p>}
        </div>
      )}
    </main>
  );
}
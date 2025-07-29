import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import { saveOffline, loadOffline } from '../lib/offline';
import { syncOfflinePins } from '../lib/sync';
import { saveOffline, loadOffline } from '../lib/offline';

interface Pin {
  x: number;
  y: number;
  status: string;
  label: string;
  comment: string;
  photoFile?: File | null;
  photoUrl?: string;
}

// Floor plan upload and pin placement.  A very simple implementation
// using an <img> tag and click events to capture x/y coordinates.  In a
// production system you might use a canvas or dedicated image
// annotation library.
export default function FloorPlan() {
  const router = useRouter();
  const { id } = router.query;
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [pins, setPins] = useState<Pin[]>([]);
  const [rectangles, setRectangles] = useState<any[]>([]);
  const [lines, setLines] = useState<any[]>([]);
  const [drawMode, setDrawMode] = useState<'pin' | 'rectangle' | 'line'>('pin');
  const [shapeStart, setShapeStart] = useState<{ x: number; y: number } | null>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<any | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Fetch existing floor plan versions
  useEffect(() => {
    if (!id || typeof id !== 'string') return;
    const fetchVersions = async () => {
      const { data, error } = await supabase
        .from('floor_plan_versions')
        .select('*')
        .eq('project_id', id)
        .order('version_number', { ascending: true });
      if (!error && data) {
        setVersions(data);
        if (data.length > 0) {
          const latest = data[data.length - 1];
          setSelectedVersion(latest);
          setImageUrl(latest.file_url);
        }
      }
    };
    fetchVersions();
    // Attempt to sync any offline pins when component mounts
    syncOfflinePins();
  }, [id]);

  // Upload floor plan to Supabase storage when selected
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    // Create a local URL for preview
    setImageUrl(URL.createObjectURL(selected));
  };

  // Toggle drawing mode (pin vs rectangle)
  const toggleMode = (mode: 'pin' | 'rectangle' | 'line') => {
    setDrawMode(mode);
    setShapeStart(null);
  };

  // Handle click on the image to create a pin or a rectangle
  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    if (drawMode === 'pin') {
      const label = prompt('Enter label for this pin (e.g., product code)') || '';
      const status = prompt('Status (complete / damage / snag / missing)') || 'complete';
      const comment = prompt('Comment/description (optional)') || '';
      setPins((prev) => [...prev, { x, y, status, label, comment, photoFile: null }]);
    } else if (drawMode === 'rectangle') {
      if (!shapeStart) {
        setShapeStart({ x, y });
      } else {
        const startX = shapeStart.x;
        const startY = shapeStart.y;
        const endX = x;
        const endY = y;
        const label = prompt('Enter label for this area') || '';
        const comment = prompt('Comment (optional)') || '';
        const newRect = {
          type: 'rectangle',
          coordinates: [
            { x: startX, y: startY },
            { x: endX, y: endY },
          ],
          color: '#00A3E0',
          label,
          comment,
        };
        setRectangles((prev) => [...prev, newRect]);
        setShapeStart(null);
      }
    } else if (drawMode === 'line') {
      if (!shapeStart) {
        setShapeStart({ x, y });
      } else {
        const startX = shapeStart.x;
        const startY = shapeStart.y;
        const endX = x;
        const endY = y;
        // Simple pixel distance; we do not convert to real units
        const dx = endX - startX;
        const dy = endY - startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const label = prompt('Enter label for this measurement') || '';
        const comment = prompt(`Measured length (optional). Pixel distance: ${distance.toFixed(3)}`) || '';
        const newLine = {
          type: 'line',
          coordinates: [
            { x: startX, y: startY },
            { x: endX, y: endY },
          ],
          color: '#FF00AA',
          label,
          comment,
        };
        setLines((prev) => [...prev, newLine]);
        setShapeStart(null);
      }
    }
  };

  // Save pins and rectangles to Supabase
  const handleSave = async () => {
    if (!id || typeof id !== 'string') return;
    try {
      let floorPlanId: string | null = null;
      let versionNumber: number | null = null;
      // If a new file is selected, upload and create new version
      if (file) {
        // Determine next version number
        const nextVersion = versions.length > 0 ? versions[versions.length - 1].version_number + 1 : 1;
        // Upload to Storage
        const filePath = `${id}/v${nextVersion}_${file.name}`;
        const { error: uploadError } = await supabase.storage.from('floorplans').upload(filePath, file, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: publicUrlData } = supabase.storage.from('floorplans').getPublicUrl(filePath);
        const publicUrl = publicUrlData.publicUrl;
        // Insert floor plan row
        const { data: fpData, error: fpError } = await supabase
          .from('floor_plans')
          .insert({ project_id: id, file_url: publicUrl })
          .select()
          .single();
        if (fpError) throw fpError;
        floorPlanId = fpData.id;
        // Insert version record
        // Insert version record.  We don't have an explicit uploaded_by on the returned
        // floor plan row, so leave null here; Supabase will record created_at.
        const { error: verError } = await supabase
          .from('floor_plan_versions')
          .insert({ project_id: id, version_number: nextVersion, file_url: publicUrl, uploaded_by: null });
        if (verError) throw verError;
        versionNumber = nextVersion;
      } else if (selectedVersion) {
        // Use existing version's floor plan id if available (fetch first floor plan record with same file_url)
        const { data: existing, error: fpErr } = await supabase
          .from('floor_plans')
          .select('id')
          .eq('file_url', selectedVersion.file_url)
          .limit(1)
          .single();
        if (!fpErr && existing) {
          floorPlanId = existing.id;
        }
      }
      if (!floorPlanId) {
        alert('Please upload a floor plan or select a version');
        return;
      }
      // Upload pin photos and prepare rows
      if (pins.length > 0) {
        const pinRows: any[] = [];
        for (const p of pins) {
          let photoUrl: string | undefined;
          if (p.photoFile) {
            const filename = `${floorPlanId}/${Date.now()}_${p.photoFile.name}`;
            const { error: uploadErr } = await supabase.storage.from('pinphotos').upload(filename, p.photoFile, { upsert: true });
            if (uploadErr) throw uploadErr;
            const { data: urlData } = supabase.storage.from('pinphotos').getPublicUrl(filename);
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
        // If offline, store pins locally for later sync
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          const existing = loadOffline<any[]>('offline_pins') || [];
          existing.push({ projectId: id, floorPlanId, pinRows });
          saveOffline('offline_pins', existing);
        } else {
          const { error: pinError } = await supabase.from('pins').insert(pinRows);
          if (pinError) throw pinError;
        }
      }
      // Insert rectangles and lines as markups
      const markupRows: any[] = [];
      rectangles.forEach((r) => {
        markupRows.push({
          floor_plan_id: floorPlanId,
          type: r.type,
          coordinates: r.coordinates,
          color: r.color,
          label: r.label,
          comment: r.comment,
        });
      });
      lines.forEach((l) => {
        markupRows.push({
          floor_plan_id: floorPlanId,
          type: l.type,
          coordinates: l.coordinates,
          color: l.color,
          label: l.label,
          comment: l.comment,
        });
      });
      if (markupRows.length > 0) {
        const { error: markupError } = await supabase.from('markups').insert(markupRows);
        if (markupError) throw markupError;
      }
      alert('Floor plan saved successfully');
      router.push(`/job?id=${id}`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Automatically assign unassigned products to pins
  const handleAutoAssign = async () => {
    if (!id || typeof id !== 'string') return;
    try {
      // Fetch current user for permission check
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) throw new Error('Not authenticated');
      // Find the latest floor plan for this project
      const { data: latestFp, error: fpErr } = await supabase
        .from('floor_plans')
        .select('id')
        .eq('project_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (fpErr || !latestFp) throw fpErr || new Error('No floor plan found');
      const floorPlanId = latestFp.id;
      // Fetch pins for this floor plan
      const { data: pinsData, error: pinsErr } = await supabase
        .from('pins')
        .select('id')
        .eq('floor_plan_id', floorPlanId);
      if (pinsErr || !pinsData) throw pinsErr || new Error('No pins found');
      // Fetch unassigned products for this project
      const { data: products, error: prodErr } = await supabase
        .from('products')
        .select('id')
        .eq('project_id', id)
        .eq('assigned', false);
      if (prodErr) throw prodErr;
      if (!products || products.length === 0) {
        alert('No unassigned products found');
        return;
      }
      const rows = [] as any[];
      let productIndex = 0;
      for (const pin of pinsData) {
        if (productIndex >= products.length) break;
        const product = products[productIndex];
        rows.push({ pin_id: pin.id, product_id: product.id });
        productIndex++;
      }
      if (rows.length === 0) {
        alert('No pins available for assignment');
        return;
      }
      // Insert assignments and update products as assigned
      const { error: insertErr } = await supabase.from('pin_products').insert(rows);
      if (insertErr) throw insertErr;
      const assignedIds = rows.map((r) => r.product_id);
      const { error: updateErr } = await supabase
        .from('products')
        .update({ assigned: true })
        .in('id', assignedIds);
      if (updateErr) throw updateErr;
      alert('Products assigned to pins successfully');
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <main style={{ maxWidth: 900, margin: '2rem auto', padding: '1rem' }}>
      <h1>Floor Plan</h1>
      {/* Mode selection */}
      <div style={{ marginBottom: '1rem' }}>
        <button onClick={() => toggleMode('pin')} disabled={drawMode === 'pin'} style={{ marginRight: '0.5rem' }}>
          Pin Mode
        </button>
        <button onClick={() => toggleMode('rectangle')} disabled={drawMode === 'rectangle'}>
          Rectangle Mode
        </button>
        <button onClick={() => toggleMode('line')} disabled={drawMode === 'line'} style={{ marginLeft: '0.5rem' }}>
          Line Mode
        </button>
      </div>
      {/* Existing version selector */}
      {versions.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <label>
            Select Existing Version:
            <select
              value={selectedVersion?.id || ''}
              onChange={(e) => {
                const ver = versions.find((v) => v.id === e.target.value);
                if (ver) {
                  setSelectedVersion(ver);
                  setImageUrl(ver.file_url);
                  setFile(null);
                }
              }}
              style={{ marginLeft: '0.5rem' }}
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  Version {v.version_number}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {/* Upload new file */}
      <div style={{ marginBottom: '1rem' }}>
        <label>
          Upload New Plan:
          <input type="file" accept="image/*,application/pdf" onChange={handleFileChange} style={{ marginLeft: '0.5rem' }} />
        </label>
      </div>
      {imageUrl && (
        <div style={{ position: 'relative', marginTop: '1rem' }}>
          <img
            src={imageUrl}
            alt="Floor Plan"
            style={{ width: '100%', border: '1px solid #ccc' }}
            onClick={handleImageClick}
            ref={imgRef}
          />
          {pins.map((pin, idx) => (
            <div
              key={idx}
              style={{
                position: 'absolute',
                top: `${pin.y * 100}%`,
                left: `${pin.x * 100}%`,
                transform: 'translate(-50%, -50%)',
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor:
                  pin.status === 'complete'
                    ? 'green'
                    : pin.status === 'damage'
                    ? 'red'
                    : pin.status === 'snag'
                    ? 'orange'
                    : 'blue',
                border: '2px solid #fff',
              }}
              title={`${pin.label}: ${pin.status}`}
            ></div>
          ))}
          {rectangles.map((rect, idx) => {
            const [p1, p2] = rect.coordinates;
            const left = Math.min(p1.x, p2.x) * 100;
            const top = Math.min(p1.y, p2.y) * 100;
            const width = Math.abs(p2.x - p1.x) * 100;
            const height = Math.abs(p2.y - p1.y) * 100;
            return (
              <div
                key={`rect-${idx}`}
                style={{
                  position: 'absolute',
                  left: `${left}%`,
                  top: `${top}%`,
                  width: `${width}%`,
                  height: `${height}%`,
                  border: `2px solid ${rect.color}`,
                  backgroundColor: rect.color + '33', // add transparency
                  pointerEvents: 'none',
                }}
                title={rect.label}
              ></div>
            );
          })}
          {/* Draw measurement lines */}
          {lines.length > 0 && (
            <svg
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
              viewBox="0 0 100 100"
            >
              {lines.map((line, idx) => {
                const [p1, p2] = line.coordinates;
                return (
                  <line
                    key={`line-${idx}`}
                    x1={p1.x * 100}
                    y1={p1.y * 100}
                    x2={p2.x * 100}
                    y2={p2.y * 100}
                    stroke={line.color || '#FF00AA'}
                    strokeWidth={0.5}
                  />
                );
              })}
            </svg>
          )}
        </div>
      )}
      {/* Photo upload for pins */}
      {pins.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <h3>Attach photos (required for non-complete statuses)</h3>
          {pins.map((pin, idx) => (
            <div key={idx} style={{ marginBottom: '0.5rem' }}>
              <span>
                Pin {idx + 1} ({pin.label}, {pin.status}):
              </span>{' '}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setPins((prev) => {
                    const copy = [...prev];
                    copy[idx] = { ...copy[idx], photoFile: file };
                    return copy;
                  });
                }}
              />
            </div>
          ))}
        </div>
      )}
      {/* Save button */}
      <button onClick={handleSave} style={{ marginTop: '1rem', marginRight: '0.5rem' }}>Save Floor Plan & Annotations</button>
      <button onClick={handleAutoAssign} style={{ marginTop: '1rem' }}>Auto Assign Products</button>
    </main>
  );
}
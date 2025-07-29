import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';

/**
 * Quote page: Calculates total installation hours for a given project.
 *
 * This page fetches all products associated with the selected project and
 * computes the total installation time based on a per‑product lookup.  It
 * uses a local mapping of product codes to hours per unit.  Replace or
 * extend the mapping to reflect your real installation data.
 */
export default function Quote() {
  const router = useRouter();
  const { projectId } = router.query as { projectId: string };
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [totalHours, setTotalHours] = useState(0);

  // Local installation time lookup; mirror backend's INSTALL_TIME_PER_PRODUCT.
  const INSTALL_TIME_PER_PRODUCT: Record<string, number> = {
    'RS-CHAIR-01': 0.5,
    'RS-DESK-02': 1.0,
    'RS-CABINET-03': 1.5,
    // Extend with real product codes and times as needed.
  };
  const DEFAULT_HOURS_PER_UNIT = 1.0;

  useEffect(() => {
    const load = async () => {
      if (!projectId) return;
      setLoading(true);
      setError(null);
      try {
        // Fetch products for this project
        const { data: products, error: prodErr } = await supabase
          .from('products')
          .select('code,name,quantity')
          .eq('project_id', projectId);
        if (prodErr) throw prodErr;
        if (!products) {
          setLineItems([]);
          setTotalHours(0);
          return;
        }
        // Compute hours
        let total = 0;
        const items = products.map((p) => {
          const qty = Number(p.quantity) || 0;
          const hoursPerUnit = INSTALL_TIME_PER_PRODUCT[p.code ?? ''] ?? DEFAULT_HOURS_PER_UNIT;
          const itemHours = hoursPerUnit * qty;
          total += itemHours;
          return {
            code: p.code,
            name: p.name,
            quantity: qty,
            hoursPerUnit,
            totalHours: itemHours,
          };
        });
        setLineItems(items);
        setTotalHours(total);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [projectId]);

  if (!projectId) return <p>Missing projectId</p>;
  if (loading) return <p>Calculating quote…</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;

  return (
    <main style={{ maxWidth: 800, margin: '2rem auto', padding: '1rem' }}>
      <h1>Installation Hours Quote</h1>
      <p>Project ID: {projectId}</p>
      {lineItems.length === 0 ? (
        <p>No products found for this project.</p>
      ) : (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #ccc' }}>Code</th>
                <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #ccc' }}>Name</th>
                <th style={{ textAlign: 'right', padding: '0.5rem', borderBottom: '1px solid #ccc' }}>Quantity</th>
                <th style={{ textAlign: 'right', padding: '0.5rem', borderBottom: '1px solid #ccc' }}>Hours/Unit</th>
                <th style={{ textAlign: 'right', padding: '0.5rem', borderBottom: '1px solid #ccc' }}>Total Hours</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item) => (
                <tr key={item.code} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.5rem' }}>{item.code}</td>
                  <td style={{ padding: '0.5rem' }}>{item.name}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>{item.quantity}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>{item.hoursPerUnit}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>{item.totalHours}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ marginTop: '1rem', fontWeight: 'bold' }}>Total installation hours: {totalHours}</p>
        </>
      )}
    </main>
  );
}
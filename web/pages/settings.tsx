import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useTranslation } from '../lib/i18n';

/**
 * Settings page for feature toggles.  This page lists a set of optional
 * features and allows the current user to enable or disable them.  The
 * toggles are stored in the `feature_toggles` table.  If no record
 * exists for a feature, it is considered enabled by default.  Admins
 * can toggle features for any user by passing a `userId` query
 * parameter; otherwise toggles are applied to the current user.  The
 * list of available features is defined locally and can be extended.
 */
export default function Settings() {
  const { t } = useTranslation();
  const [featureStates, setFeatureStates] = useState<Record<string, boolean>>({});
  const [availableFeatures] = useState<string[]>([
    'ai_assignment',
    'measurement_tool',
    'forms',
    'markups',
  ]);
  const [targetUserId, setTargetUserId] = useState<string | null>(null);

  useEffect(() => {
    // Determine which user to edit: either from query param or current user
    const load = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const userIdFromQuery = urlParams.get('userId');
      let userId = userIdFromQuery;
      if (!userId) {
        const { data: authData } = await supabase.auth.getUser();
        userId = authData?.user?.id || null;
      }
      if (!userId) return;
      setTargetUserId(userId);
      // Fetch existing toggles
      const { data, error } = await supabase
        .from('feature_toggles')
        .select('*')
        .eq('user_id', userId);
      if (!error && data) {
        const states: Record<string, boolean> = {};
        availableFeatures.forEach((feat) => {
          const row = data.find((r: any) => r.feature_name === feat);
          states[feat] = row ? row.is_enabled : true; // default true
        });
        setFeatureStates(states);
      }
    };
    load();
  }, [availableFeatures]);

  const handleToggle = async (feature: string, enabled: boolean) => {
    if (!targetUserId) return;
    setFeatureStates((prev) => ({ ...prev, [feature]: enabled }));
    // Upsert record
    const { error } = await supabase.from('feature_toggles').upsert({
      user_id: targetUserId,
      feature_name: feature,
      is_enabled: enabled,
    });
    if (error) alert(error.message);
  };

  return (
    <main style={{ maxWidth: 600, margin: '2rem auto', padding: '1rem' }}>
      <h1>{t('settings')}</h1>
      {availableFeatures.map((feature) => (
        <div key={feature} style={{ marginBottom: '0.5rem' }}>
          <label>
            <input
              type="checkbox"
              checked={featureStates[feature] ?? true}
              onChange={(e) => handleToggle(feature, e.target.checked)}
            />{' '}
            {feature.replace(/_/g, ' ')}
          </label>
        </div>
      ))}
    </main>
  );
}
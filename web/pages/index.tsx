import { useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import { useTranslation } from '../lib/i18n';

export default function Home() {
  const router = useRouter();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [registerMode, setRegisterMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authVisible, setAuthVisible] = useState(false);

  // Handle login or registration
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (registerMode) {
        const { error: signUpError, data } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        const userId = data.user?.id;
        if (!userId) throw new Error('No user created');
        
        const { error: insertError } = await supabase.from('users').insert({
          id: userId,
          role: 'admin',
        });
        if (insertError) throw insertError;
        
        alert('Registration successful, check your email for confirmation');
        setRegisterMode(false);
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <main style={{ fontFamily: 'sans-serif' }}>
      {/* Hero section with city backdrop and logo */}
      <section
        style={{
          background:
            'linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.55)), url(/city.jpg) center/cover no-repeat',
          color: '#fff',
          padding: '6rem 1rem',
          textAlign: 'center',
          position: 'relative',
        }}
      >
        {/* Logo */}
        <img
          src="/logo.png"
          alt="InsTech logo"
          style={{ width: '120px', margin: '0 auto 1rem' }}
        />
        <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>InsTech</h1>
        <p style={{ fontSize: '1.25rem', maxWidth: 600, margin: '0 auto 2rem' }}>
          Simplify your installation workflows with intuitive job management, floor‑plan markups and real‑time collaboration.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
          <button
            onClick={() => {
              setRegisterMode(false);
              setAuthVisible(true);
            }}
            style={{ padding: '0.75rem 1.5rem', fontSize: '1rem', background: '#ff6a00', color: '#fff', border: 'none', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
          >
            {t('login')}
          </button>
          <button
            onClick={() => {
              setRegisterMode(true);
              setAuthVisible(true);
            }}
            style={{ padding: '0.75rem 1.5rem', fontSize: '1rem', background: '#ff934d', color: '#fff', border: 'none', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
          >
            {t('register')}
          </button>
        </div>
      </section>
      {/* Authentication section */}
      {authVisible && (
        <section id="auth-form" style={{ maxWidth: 400, margin: '2rem auto', padding: '1rem' }}>
          <h2>{registerMode ? t('register') : t('login')}</h2>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '0.5rem' }}>
              <label htmlFor="email">{t('email')}</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <label htmlFor="password">{t('password')}</label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            <button type="submit" style={{ width: '100%', marginTop: '1rem', background: registerMode ? '#ff934d' : '#ff6a00', color: '#fff', border: 'none', padding: '0.75rem', borderRadius: '4px' }}>
              {registerMode ? t('register') : t('login')}
            </button>
          </form>
          <p style={{ marginTop: '1rem' }}>
            {registerMode ? 'Already have an account?' : "Don't have an account?"}{' '}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setRegisterMode(!registerMode);
              }}
            >
              {registerMode ? t('login') : t('register')}
            </a>
          </p>
        </section>
      )}
    </main>
  );
}

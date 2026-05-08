import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useT, LANGS } from '../lib/i18n.jsx';

export default function LoginScreen() {
  const { t, lang, setLang } = useT();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const sendMagicLink = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('sending'); setErrorMsg('');
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          ...(name.trim() ? { display_name: name.trim() } : {}),
          language: lang,
        },
      },
    });
    if (error) { setStatus('error'); setErrorMsg(error.message); }
    else { setStatus('sent'); }
  };

  const loginWithProvider = async (provider) => {
    setErrorMsg('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) setErrorMsg(error.message);
  };

  return (
    <div className="login-wrap">
      <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 4 }}>
        {LANGS.map((l) => (
          <button key={l.id} onClick={() => setLang(l.id)}
            style={{
              background: 'none', border: 'none', fontSize: 18, padding: 6,
              opacity: lang === l.id ? 1 : 0.4, cursor: 'pointer',
            }}
            title={l.label}>
            {l.flag}
          </button>
        ))}
      </div>

      <div className="login-logo">🏡</div>
      <h1 className="login-h">FAMMY</h1>
      <p className="login-s" style={{ whiteSpace: 'pre-line' }}>{t('app_tagline')}</p>

      {status === 'sent' ? (
        <div className="login-msg success">
          <strong>{t('check_email')}</strong><br/>
          {t('check_email_desc', { email }).split(email).map((part, i, arr) => (
            <span key={i}>{part}{i < arr.length - 1 && <strong>{email}</strong>}</span>
          ))}
        </div>
      ) : (
        <>
          {/* Email + nome SOPRA, prima di "oppure" */}
          <form className="login-form" onSubmit={sendMagicLink}>
            <div>
              <label htmlFor="name">{t('name_label')}</label>
              <input id="name" className="input" placeholder={t('name_ph')} value={name}
                onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
            </div>
            <div>
              <label htmlFor="email">{t('email_label')}</label>
              <input id="email" type="email" className="input" placeholder={t('email_ph')}
                value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <button type="submit" className="btn full" disabled={status === 'sending' || !email.trim()}>
              {status === 'sending' ? <span className="spin" /> : t('send_link_btn')}
            </button>
            <p style={{ fontSize: 12, color: 'var(--km)', textAlign: 'center', marginTop: 8 }}>
              {t('no_password_hint')}
            </p>
          </form>

          {/* Separatore "oppure" */}
          <div className="login-separator">
            <span>{t('or_continue_with')}</span>
          </div>

          {/* OAuth providers SOTTO */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button type="button" className="oauth-btn" onClick={() => loginWithProvider('google')}>
              <GoogleIcon />
              <span>{t('login_with_google')}</span>
            </button>
            <button type="button" className="oauth-btn" onClick={() => loginWithProvider('facebook')}>
              <FacebookIcon />
              <span>{t('login_with_facebook')}</span>
            </button>
            <button type="button" className="oauth-btn" disabled
              style={{ opacity: 0.45, cursor: 'not-allowed' }}
              title={t('login_apple_soon')}>
              <AppleIcon />
              <span>{t('login_with_apple')} <em style={{ fontSize: 10, fontWeight: 400 }}>· {t('login_apple_soon')}</em></span>
            </button>
          </div>

          {/* Avviso "se hai già account usa stesso metodo" */}
          <div style={{
            marginTop: 16, padding: 10, background: 'var(--amB)', color: 'var(--am)',
            fontSize: 11, lineHeight: 1.4, borderRadius: 10,
          }}>
            {t('login_existing_warn')}
          </div>

          {errorMsg && <div className="login-msg error" style={{ marginTop: 12 }}>{errorMsg}</div>}
        </>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.836.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="#1877F2"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
    </svg>
  );
}

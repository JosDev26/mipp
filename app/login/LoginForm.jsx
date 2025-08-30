"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import s from './page.module.css';

export default function LoginForm() {
  const [cedula, setCedula] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const router = useRouter();
  const formRef = useRef(null);

  const canSubmit = useMemo(() => !loading && cedula.trim() && password, [loading, cedula, password]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (canSubmit) formRef.current?.requestSubmit();
      }
      if (e.key === 'Escape') {
        setCedula(''); setPassword(''); setErr('');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canSubmit]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!cedula.trim() || !password) {
      setErr('Completa tu identificación y contraseña.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cedula: cedula.trim(), password }),
      });
      let data = null;
      try { data = await res.json(); } catch {}
      if (!res.ok) {
        const msg = [data?.error || 'Error al iniciar sesión', data?.detail, data?.hint].filter(Boolean).join(' | ');
        throw new Error(msg);
      }
      if (data.must_change_password) {
        router.push('/change-password?cedula=' + encodeURIComponent(cedula.trim()))
      } else {
        router.push('/home');
      }
    } catch (e) {
      setErr(e.message || 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} className={s.card} aria-describedby={err ? 'login-error' : undefined}>
      {err ? <div id="login-error" role="alert" className={s.err}>{err}</div> : null}

      <div className={s.field}>
        <label className={s.label} htmlFor="cedula">Identificación</label>
        <div className={s.inputWrap}>
          <span className={s.icon} aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="M7 9h6M7 12h4" />
              <circle cx="17" cy="12" r="2" />
            </svg>
          </span>
          <input
            id="cedula"
            className={s.input}
            inputMode="numeric"
            placeholder="Ej: 1-1234-1234"
            value={cedula}
            onChange={(e) => setCedula(e.target.value)}
            autoComplete="username"
          />
        </div>
        <div className={s.hint}>Usa tu número de identificación nacional.</div>
      </div>

      <div className={s.field}>
        <label className={s.label} htmlFor="password">Contraseña</label>
        <div className={s.inputWrap}>
          <span className={s.icon} aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11V8a4 4 0 1 1 8 0v3" />
            </svg>
          </span>
          <input
            id="password"
            className={s.input}
            type={showPw ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="Tu contraseña"
          />
          <button type="button" className={s.pwToggle} onClick={() => setShowPw(v=>!v)} aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
            {showPw ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" opacity=".4"/>
                <circle cx="12" cy="12" r="3" />
                <path d="M3 3l18 18" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
        <div className={s.hint}>Presiona Ctrl+Enter para entrar. Esc borra el formulario.</div>
      </div>

      <div className={s.actions}>
        <button className={`${s.btn} ${s.btnPrimary}`} disabled={!canSubmit} type="submit">
          {loading ? <span className={s.spinnerInline} aria-hidden /> : null}
          {loading ? 'Iniciando…' : 'Iniciar sesión'}
        </button>
        
      </div>
    </form>
  );
}

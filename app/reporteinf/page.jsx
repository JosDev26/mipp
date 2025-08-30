"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import styles from './page.module.css';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import useCurrentUser from '../../lib/useCurrentUser';
import LoadingOverlay from '../../components/LoadingOverlay';

export default function ReporteInfraestructuraPage() {
  const router = useRouter();
  const { user: currentUser, loading: authLoading } = useCurrentUser();
  const [user, setUser] = useState(null); // {cedula,nombre,segundo_nombre,primer_apellido,segundo_apellido,posicion,instancia}
  const [tipoReporte, setTipoReporte] = useState('Normal');
  const [reporte, setReporte] = useState('');
  const [lugar, setLugar] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [status, setStatus] = useState(null); // { type, text }
  const [errorsList, setErrorsList] = useState([]);
  const summaryRef = useRef(null);

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push('/login');
      return;
    }
  }, [authLoading, currentUser, router]);

  useEffect(() => {
    const load = async () => {
      if (!currentUser?.cedula) return;
      const { data, error } = await supabase
        .from('users')
        .select('cedula,nombre,segundo_nombre,primer_apellido,segundo_apellido,posicion,instancia')
        .eq('cedula', currentUser.cedula)
        .maybeSingle();
      if (!error && data) setUser(data);
    };
    load();
  }, [currentUser?.cedula]);

  const nombreCompleto = useMemo(() => {
    if (!user) return '';
    const seg = user.segundo_nombre ? ` ${user.segundo_nombre}` : '';
    return `${user.nombre}${seg} ${user.primer_apellido} ${user.segundo_apellido}`.trim();
  }, [user]);

  const hoy = useMemo(() => new Date(), []);
  const horaActual = useMemo(() => hoy.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), [hoy]);
  const mesActual = useMemo(() => hoy.toLocaleString('es-CR', { month: 'long' }), [hoy]);
  const anioActual = useMemo(() => hoy.getFullYear(), [hoy]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus(null);
    if (!tipoReporte || !reporte || !lugar) {
      setErrorsList(['Completa todos los campos.']);
      setStatus({ type: 'error', text: 'Faltan campos obligatorios.' });
      setTimeout(() => summaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
      return;
    }
    setErrorsList([]);
    setStatus({ type: 'info', text: 'Enviando reporte…' });
    setEnviando(true);
    try {
      const payload = {
        nombre_suscriptor: nombreCompleto,
        user_cedula: user?.cedula,
        posicion: user?.posicion,
        instancia: user?.instancia,
        tipo_reporte: tipoReporte,
        reporte,
        lugar,
      };
      const res = await fetch('/api/reporteinf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
  const out = await res.json();
  if (!res.ok) throw new Error(out.error || 'Error enviando reporte');
  setStatus({ type: 'success', text: 'Reporte enviado. Redirigiendo…' });
  setReporte(''); setLugar(''); setTipoReporte('Normal');
  setTimeout(() => router.push('/home'), 700);
    } catch (err) {
  setStatus({ type: 'error', text: err.message || String(err) });
    } finally {
      setEnviando(false);
    }
  };

  const onCancel = () => {
    if (enviando) return;
    const go = confirm('¿Deseas cancelar y salir? Los datos sin guardar se perderán.');
    if (go) router.push('/home');
  };

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        const btn = document.getElementById('btn-enviar-reporte');
        if (btn && !btn.disabled) btn.click();
      }
      if (e.key === 'Escape') {
        const btn = document.getElementById('btn-cancelar-reporte');
        if (btn) btn.click();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enviando]);

  return (
    <div className={`${styles.page} ${styles.pageEnter || ''}`}>
      <LoadingOverlay show={authLoading || (!!currentUser && !user)} text="Cargando datos del usuario…" />
      <div className={styles.statusBar} role="status" aria-live="polite">
        {status?.text && (
          <div className={`${styles.alert} ${
            status.type === 'error' ? styles.alertError :
            status.type === 'success' ? styles.alertSuccess : styles.alertInfo
          }`}>{status.text}</div>
        )}
      </div>
      <div className={styles.topbar}>
        <Link href="/home" className={styles.back}>⟵ Volver</Link>
      </div>
      <div className={styles.brandrow}>
        <div className={styles.brand}>MIPP+</div>
        <div className={styles.logos} aria-hidden><span /></div>
      </div>
  <div className={styles.titleBanner}>Reporte de Infraestructura</div>
      {/* Bloque de presentación estilo formulariopermiso */}
      <div className={styles.presento}>
        {user ? (
          <div className={styles.chips}>
            <span>Quien se suscribe</span>
            <span className={styles.chip}>{nombreCompleto}</span>
            <span>, con cédula de identidad</span>
            <span className={styles.chip}>{user.cedula}</span>
            <span>, quien labora en la institución educativa</span>
            <span className={styles.chip}>CTP Mercedes Norte</span>
            <span>, en el puesto de</span>
            <span className={styles.chip}>{user.posicion}</span>
            <span>, en condición de</span>
            <span className={styles.chip}>{user.instancia}</span>
            <span>, solicita:</span>
          </div>
        ) : (
          <p>Inicia sesión para prellenar tus datos. <Link href="/login">Ir a login</Link></p>
        )}
      </div>

  <div className={`${styles.formCard} ${styles.animSection || ''}`}>
        {errorsList.length > 0 && (
          <div ref={summaryRef} className={styles.errorSummary} role="alert" aria-live="assertive">
            <strong>Revisa estos puntos:</strong>
            <ul>{errorsList.map((m, i) => <li key={i}>{m}</li>)}</ul>
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.lbl}>Tipo de reporte</label>
            <select className={styles.select} value={tipoReporte} onChange={(e) => setTipoReporte(e.target.value)}>
              <option>No urgente</option>
              <option>Normal</option>
              <option>Muy urgente</option>
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.lbl}>Reporte</label>
            <textarea className={styles.textarea} value={reporte} onChange={(e) => setReporte(e.target.value)} rows={5} placeholder="Describe el reporte..." />
          </div>

          <div className={styles.field}>
            <label className={styles.lbl}>Lugar (sea específico)</label>
            <input className={styles.input} value={lugar} onChange={(e) => setLugar(e.target.value)} placeholder="Ej: Pabellón B, aula 7" />
          </div>

          <div>
            Presento el reporte a las <strong>{horaActual}</strong> del mes <strong>{mesActual}</strong> del año <strong>{anioActual}</strong> en Heredia, Mercedes Norte.
          </div>

          <div className={styles.actions}>
            <button id="btn-cancelar-reporte" type="button" onClick={onCancel} className={`${styles.btn}`}>Cancelar</button>
            <button id="btn-enviar-reporte" type="submit" disabled={enviando} className={`${styles.btn} ${styles.btnPrimary}`}>
              {enviando ? 'Enviando...' : 'Enviar reporte'}
            </button>
          </div>
        </form>
      </div>
      <div style={{ color:'#374151', marginTop: 12, fontSize: 13 }}>
        Sugerencia: Describe claramente el problema y su ubicación exacta. Si es muy urgente, selecciona la prioridad adecuada.
      </div>
    </div>
  );
}

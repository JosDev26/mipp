"use client";

import React, { useEffect, useMemo, useState } from 'react';
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
  const [okMsg, setOkMsg] = useState('');
  const [errMsg, setErrMsg] = useState('');

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
    setErrMsg('');
    setOkMsg('');
    if (!tipoReporte || !reporte || !lugar) {
      setErrMsg('Completa todos los campos.');
      return;
    }
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
  setOkMsg('Reporte enviado.');
  setReporte('');
  setLugar('');
  setTipoReporte('Normal');
  router.push('/home');
    } catch (err) {
      setErrMsg(err.message || String(err));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '2rem auto', padding: 24 }}>
  <LoadingOverlay show={authLoading || (!!currentUser && !user)} text="Cargando datos del usuario…" />
      <nav style={{ marginBottom: 12 }}>
        <Link href="/home">← Volver</Link>
      </nav>
      <h2>Reporte de Infraestructura</h2>
      {user ? (
        <p>
          Quien se suscribe <strong>{nombreCompleto}</strong>, con cédula de identidad <strong>{user.cedula}</strong>, quien labora en la institución educativa CTP Mercedes Norte, en el puesto de
          <strong> {user.posicion}</strong>, en condición <strong>{user.instancia}</strong>. Reporta:
        </p>
      ) : (
        <p>Cargando datos del usuario...</p>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
        <label>
          Tipo de reporte:
          <select value={tipoReporte} onChange={(e) => setTipoReporte(e.target.value)} style={{ marginLeft: 8 }}>
            <option>No urgente</option>
            <option>Normal</option>
            <option>Muy urgente</option>
          </select>
        </label>

        <label>
          Reporte:
          <textarea value={reporte} onChange={(e) => setReporte(e.target.value)} rows={5} style={{ width: '100%' }} placeholder="Describe el reporte..." />
        </label>

        <label>
          Lugar: (sea especifico)
          <input value={lugar} onChange={(e) => setLugar(e.target.value)} style={{ width: '100%' }} placeholder="Ej: Pabellón B, aula 7" />
        </label>

        <p>
          Presento el reporte a las <strong>{horaActual}</strong> del mes <strong>{mesActual}</strong> del año <strong>{anioActual}</strong> en Heredia, Mercedes Norte.
        </p>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button type="submit" disabled={enviando} style={{ padding: '8px 12px', background: '#0ea5e9', color: 'white', borderRadius: 6 }}>
            {enviando ? 'Enviando...' : 'Enviar reporte'}
          </button>
          {okMsg && <span style={{ color: '#16a34a' }}>{okMsg}</span>}
          {errMsg && <span style={{ color: '#ef4444' }}>{errMsg}</span>}
        </div>
      </form>
    </div>
  );
}

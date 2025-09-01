"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import useCurrentUser from '../../lib/useCurrentUser';

export default function SolicitudesResueltasPage(){
  const router = useRouter();
  const { user: currentUser, roles, loading: authLoading } = useCurrentUser();
  const isAdmin = Array.isArray(roles) && roles.includes('admin');
  const isViewer = Array.isArray(roles) && roles.includes('viewer');
  const canView = isAdmin || isViewer;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && (!currentUser || !canView)) {
      router.push('/login');
      return;
    }
  }, [authLoading, currentUser, canView, router]);

  useEffect(() => {
    const load = async () => {
      try{
        setLoading(true);
        // Base queries
        const qPerm = supabase.from('solicitudes_permiso').select('*').order('created_at', { ascending:false });
        const qJust = supabase.from('justificaciones').select('*').order('creado_en', { ascending:false });
        const qOmis = supabase.from('omision_marca').select('*').order('creado_en', { ascending:false });
        const qInfra = supabase.from('reporte_infraestructura').select('*').order('creado_en', { ascending:false });

        const [permRes, justRes, omisRes, infraRes] = await Promise.all([qPerm, qJust, qOmis, qInfra]);
        if (permRes.error) throw permRes.error;
        if (justRes.error) throw justRes.error;
        if (omisRes.error) throw omisRes.error;
        if (infraRes.error) throw infraRes.error;

        const lc = (s) => (s ? String(s).toLowerCase() : '');
        const isResolved = (estado) => estado && !lc(estado).includes('pend');

        const perms = (permRes.data || [])
          .filter(r => isResolved(r.estado))
          .map(r => ({
            kind: 'Permiso',
            id: r.id,
            usuario: r.nombre_solicitante || '—',
            creado: r.created_at || null,
            resuelto: r.respuesta_en || null,
            estado: r.estado || null,
            href: `/solicitudes/${r.id}`,
          }));

        const justs = (justRes.data || [])
          .filter(r => isResolved(r.estado))
          .map(r => ({
            kind: 'Justificación',
            id: r.id,
            usuario: r.nombre_suscriptor || '—',
            creado: r.creado_en || null,
            resuelto: r.respuesta_en || null,
            estado: r.estado || null,
            href: `/justificaciones/${r.id}`,
          }));

        const omis = (omisRes.data || [])
          .filter(r => isResolved(r.estado))
          .map(r => ({
            kind: 'Omisión de marca',
            id: r.id,
            usuario: r.nombre_suscriptor || '—',
            creado: r.creado_en || null,
            resuelto: r.respuesta_en || null,
            estado: r.estado || null,
            href: `/omisionmarca/${r.id}`,
          }));

        const infra = (infraRes.data || [])
          .filter(r => isResolved(r.estado))
          .map(r => ({
            kind: 'Infraestructura',
            id: r.id,
            usuario: r.nombre_suscriptor || '—',
            creado: r.creado_en || null,
            resuelto: r.respuesta_en || null,
            estado: r.estado || null,
            href: `/reporteinf/${r.id}`,
          }));

        const merged = [...perms, ...justs, ...omis, ...infra]
          .sort((a,b) => {
            const ta = a.resuelto ? new Date(a.resuelto).getTime() : 0;
            const tb = b.resuelto ? new Date(b.resuelto).getTime() : 0;
            return tb - ta; // most recently resolved first
          });
        setRows(merged);
      }catch(err){
        console.error('listar resueltas', err);
        setRows([]);
      }finally{
        setLoading(false);
      }
    };
    if (canView) load();
  }, [canView]);

  const fmt = (dt) => dt ? new Date(dt).toLocaleString() : '—';

  const kindBg = (kind) => {
    const k = (kind || '').toLowerCase();
    if (k.includes('permiso')) return '#E0F2FE'; // Permiso
    if (k.includes('just')) return '#EDE9FE'; // Justificacion/Justificación
    if (k.includes('omisi')) return '#DCFCE7'; // Omision de marca
    if (k.includes('infra')) return '#FFEDD5'; // Infraestructura
    return '#eef2f7';
  };

  return (
    <div style={{ maxWidth: 1100, margin: '2rem auto', padding: 24 }}>
      <nav style={{ marginBottom: 12 }}>
        <Link href="/home">← Volver</Link>
      </nav>
      <h2>Solicitudes resueltas</h2>
      {loading ? <p>Cargando…</p> : (
        rows.length === 0 ? <p>No hay solicitudes resueltas.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'#f3f4f6' }}>
                  <th style={{ textAlign:'left', padding:8 }}>Tipo</th>
                  <th style={{ textAlign:'left', padding:8 }}>Usuario</th>
                  <th style={{ textAlign:'left', padding:8 }}>Creado</th>
                  <th style={{ textAlign:'left', padding:8 }}>Resuelto</th>
                  <th style={{ textAlign:'left', padding:8 }}>Estado</th>
                  <th style={{ textAlign:'left', padding:8 }}>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={`${r.kind}-${r.id}`} style={{ borderBottom:'1px solid #eee' }}>
                    <td style={{ padding:8 }}>
                      <span style={{
                        backgroundColor: kindBg(r.kind),
                        padding: '2px 10px',
                        borderRadius: 999,
                        fontWeight: 700,
                        color: '#111827',
                        display: 'inline-block'
                      }}>{r.kind}</span>
                    </td>
                    <td style={{ padding:8 }}>{r.usuario}</td>
                    <td style={{ padding:8 }}>{fmt(r.creado)}</td>
                    <td style={{ padding:8 }}>{fmt(r.resuelto)}</td>
                    <td style={{ padding:8 }}>{r.estado || '—'}</td>
                    <td style={{ padding:8 }}>
                      <Link href={r.href} style={{ color:'#2563eb' }}>Abrir</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}

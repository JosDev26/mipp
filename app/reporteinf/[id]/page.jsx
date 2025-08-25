"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import useCurrentUser from '../../../lib/useCurrentUser';

export default function ReporteInfraDetalle() {
  const { id } = useParams();
  const router = useRouter();
  const { user: currentUser, roles, loading: authLoading } = useCurrentUser();
  const isAdmin = Array.isArray(roles) && (roles.includes('admin') || roles.includes('infra_manager'));
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push('/login');
      return;
    }
  }, [authLoading, currentUser, router]);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('reporte_infraestructura')
          .select('*')
          .eq('id', id)
          .limit(1);
        if (error) throw error;
        setRow((data && data[0]) || null);
      } catch (err) {
        console.error('detalle reporte infraestructura error', err);
        setRow(null);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const isResolved = React.useMemo(() => {
    const s = row?.estado ? String(row.estado).toLowerCase() : '';
    return s && !s.includes('pend');
  }, [row]);

  return (
    <div style={{ maxWidth: 800, margin: '2rem auto', padding: 24 }}>
      <nav style={{ marginBottom: 12 }}>
        <Link href="/home">← Volver al historial</Link>
      </nav>

      {loading ? (
        <p>Cargando reporte...</p>
      ) : !row ? (
        <p>No se encontró el reporte.</p>
      ) : (
        <>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <h2 style={{ margin:0 }}>Detalle de reporte de infraestructura</h2>
          </div>

          {isAdmin && !isResolved && (
            <div style={{ background:'#fff7ed', border:'1px solid #fed7aa', padding:12, borderRadius:6, marginTop:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <strong>Acción de administrador:</strong> Puedes responder esta solicitud.
                </div>
                <Link href={`/reporteinf/${id}/responder`} style={{ padding:'8px 12px', background:'#d97706', color:'#fff', borderRadius:6, textDecoration:'none' }}>Ir a Responder</Link>
              </div>
            </div>
          )}

          <section style={{ background: '#f7f7f7', padding: 12, borderRadius: 6, marginBottom: 16 }}>
            <p><strong>Fecha de creación:</strong> {row.creado_en ? new Date(row.creado_en).toLocaleString('es-CR', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</p>
            <p><strong>Tipo de reporte:</strong> {row.tipo_reporte}</p>
          </section>

          <section style={{ marginBottom: 16 }}>
            <h3>Suscriptor</h3>
            <div style={{ border: '1px solid #eee', padding: 12, borderRadius: 6 }}>
              <p><strong>Nombre:</strong> {row.nombre_suscriptor || '—'}</p>
              <p><strong>Cédula:</strong> {row.user_cedula || '—'}</p>
              <p><strong>Posición:</strong> {row.posicion || '—'}</p>
              <p><strong>Instancia:</strong> {row.instancia || '—'}</p>
            </div>
          </section>

          <section>
            <h3>Detalle</h3>
            <div style={{ border: '1px solid #eee', padding: 12, borderRadius: 6 }}>
              <p><strong>Lugar:</strong> {row.lugar}</p>
              <p><strong>Reporte:</strong></p>
              <p style={{ whiteSpace: 'pre-wrap' }}>{row.reporte}</p>
            </div>
          </section>

          <section style={{ marginTop: 16 }}>
            <h3>Resolución</h3>
            {row.estado || row.respuesta_en || row.respuesta_por || row.respuesta_comentario ? (
              <div style={{ border: '1px solid #eee', padding: 12, borderRadius: 6 }}>
                <p><strong>Estado:</strong> {row.estado || '—'}</p>
                <p><strong>Fecha de decisión:</strong> {row.respuesta_en ? new Date(row.respuesta_en).toLocaleString() : '—'}</p>
                <p><strong>Decidido por:</strong> {row.respuesta_nombre || row.respuesta_por || '—'}</p>
                {row.respuesta_comentario && (
                  <p><strong>Comentario:</strong> {row.respuesta_comentario}</p>
                )}
              </div>
            ) : (
              <p style={{ color:'#777' }}>Sin resolución aún.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

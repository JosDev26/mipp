"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import useCurrentUser from '../../../lib/useCurrentUser';

export default function JustificacionDetalle() {
  const { id } = useParams();
  const router = useRouter();
  const { user: currentUser, roles, loading: authLoading } = useCurrentUser();
  const isAdmin = Array.isArray(roles) && roles.includes('admin');
  const [row, setRow] = useState(null);
  const [adjuntos, setAdjuntos] = useState([]);
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
        // Load justificación
        const { data, error } = await supabase
          .from('justificaciones')
          .select('*')
          .eq('id', id)
          .limit(1);
        if (error) throw error;
        const item = data && data[0];
        if (!item) {
          setRow(null);
        } else {
          setRow(item);
          // Load attachments
          const { data: atts, error: attErr } = await supabase
            .from('justificacion_adjuntos')
            .select('*')
            .eq('justificacion_id', item.id)
            .order('uploaded_at', { ascending: false });
          if (!attErr) setAdjuntos(atts || []);
        }
      } catch (err) {
        console.error('detalle justificación error', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const tipo = useMemo(() => row?.tipo_justificacion || 'Justificación', [row]);
  const isResolved = useMemo(() => {
    const s = row?.estado ? String(row.estado).toLowerCase() : '';
    return s && !s.includes('pend');
  }, [row]);

  return (
    <div style={{ maxWidth: 800, margin: '2rem auto', padding: 24 }}>
      <nav style={{ marginBottom: 12 }}>
        <Link href="/home">← Volver al historial</Link>
      </nav>

      {loading ? (
        <p>Cargando justificación...</p>
      ) : !row ? (
        <p>No se encontró la justificación.</p>
      ) : (
        <>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <h2 style={{ margin:0 }}>Detalle de justificación</h2>
          </div>

          {isAdmin && !isResolved && (
            <div style={{ background:'#fff7ed', border:'1px solid #fed7aa', padding:12, borderRadius:6, marginTop:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <strong>Acción de administrador:</strong> Puedes responder esta solicitud.
                </div>
                <Link href={`/justificaciones/${id}/responder`} style={{ padding:'8px 12px', background:'#d97706', color:'#fff', borderRadius:6, textDecoration:'none' }}>Ir a Responder</Link>
              </div>
            </div>
          )}

          {/* Cabecera */}
          <section style={{ background: '#f7f7f7', padding: 12, borderRadius: 6, marginBottom: 16 }}>
            <p><strong>Tipo:</strong> {row.tipo_general || '—'} • <strong>Justificación:</strong> {tipo}</p>
            <p><strong>Fecha(s):</strong> {row.fecha_inicio}{row.es_rango ? ` → ${row.fecha_fin}` : ''}</p>
            <p><strong>Jornada:</strong> {row.jornada || '—'}{row.hora_inicio || row.hora_fin ? ` (${row.hora_inicio || ''}${row.hora_fin ? ` - ${row.hora_fin}` : ''})` : ''}</p>
          </section>

          {/* Datos del solicitante (suscriptor) */}
          <section style={{ marginBottom: 16 }}>
            <h3>Suscriptor</h3>
            <div style={{ border: '1px solid #eee', padding: 12, borderRadius: 6 }}>
              <p><strong>Nombre:</strong> {row.nombre_suscriptor || '—'}</p>
              <p><strong>Cédula:</strong> {row.user_cedula || '—'}</p>
              <p><strong>Posición:</strong> {row.posicion || '—'}</p>
              <p><strong>Instancia:</strong> {row.instancia || '—'}</p>
            </div>
          </section>

          {/* Campos específicos */}
          <section style={{ marginBottom: 16 }}>
            <h3>Detalle</h3>
            <div style={{ border: '1px solid #eee', padding: 12, borderRadius: 6 }}>
              {row.familiar && <p><strong>Familiar:</strong> {row.familiar}</p>}
              {row.cantidad && <p><strong>Cantidad:</strong> {row.cantidad} {row.unidad || ''}</p>}
              {row.hora_salida && <p><strong>Hora de salida:</strong> {row.hora_salida}</p>}
              {row.justificacion_fecha && <p><strong>Fecha justifica:</strong> {row.justificacion_fecha} {row.justificacion_hora ? `• ${row.justificacion_hora}` : ''}</p>}
              {row.observaciones && <p><strong>Observaciones:</strong> {row.observaciones}</p>}
            </div>
          </section>

          {/* Resolución */}
          <section style={{ marginTop: 16, marginBottom: 16 }}>
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

          {/* Adjuntos */}
          <section>
            <h3>Adjuntos</h3>
            {adjuntos.length === 0 ? (
              <p style={{ color: '#666' }}>No hay archivos adjuntos.</p>
            ) : (
              <ul>
                {adjuntos.map((a) => (
                  <li key={a.id}>
                    <a href={a.public_url || '#'} target="_blank" rel="noreferrer">
                      {a.mime?.includes('image/') ? 'Imagen' : a.mime || 'Archivo'}
                    </a>
                    {a.path ? <span style={{ color: '#777' }}> — {a.path.split('/').slice(-1)[0]}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

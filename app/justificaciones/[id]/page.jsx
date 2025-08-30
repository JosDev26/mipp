"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import useCurrentUser from '../../../lib/useCurrentUser';
import LoadingOverlay from '../../../components/LoadingOverlay';
import styles from './page.module.css';

export default function JustificacionDetalle() {
  const { id } = useParams();
  const router = useRouter();
  const { user: currentUser, roles, loading: authLoading } = useCurrentUser();
  const isAdmin = Array.isArray(roles) && roles.includes('admin');
  const [row, setRow] = useState(null);
  const [adjuntos, setAdjuntos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null); // {type: 'info'|'success'|'error', text}

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
        setStatus({ type: 'info', text: 'Cargando justificación…' });
        const { data, error } = await supabase
          .from('justificaciones')
          .select('*')
          .eq('id', id)
          .limit(1);
        if (error) throw error;
        const item = data && data[0];
        if (!item) {
          setRow(null);
          setAdjuntos([]);
          setStatus({ type: 'error', text: 'No se encontró la justificación.' });
        } else {
          setRow(item);
          const { data: atts, error: attErr } = await supabase
            .from('justificacion_adjuntos')
            .select('*')
            .eq('justificacion_id', item.id)
            .order('uploaded_at', { ascending: false });
          if (!attErr) setAdjuntos(atts || []);
          setStatus(null);
        }
      } catch (err) {
        console.error('detalle justificación error', err);
        setStatus({ type: 'error', text: 'Error cargando la justificación.' });
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

  const estadoClass = useMemo(() => {
    const s = String(row?.estado || '').toLowerCase();
    if (!s) return styles.pillNeutral;
    if (s.includes('acept') || s.includes('acoge')) return styles.pillSuccess;
    if (s.includes('deneg') || s.includes('rech')) return styles.pillDanger;
    return styles.pillPending;
  }, [row]);

  return (
    <div className={`${styles.page} ${styles.pageEnter}`}>
      <LoadingOverlay show={authLoading} text="Verificando sesión…" />

      <div className={styles.statusBar} role="status" aria-live="polite">
        {status?.text && (
          <div className={`${styles.alert} ${status.type === 'error' ? styles.alertError : status.type === 'success' ? styles.alertSuccess : styles.alertInfo}`}>
            {status.text}
          </div>
        )}
      </div>

      <div className={styles.topbar}>
        <Link href="/gestionarjustificaciones" className={styles.back} title="Volver al listado">⟵ Volver</Link>
        <div className={styles.topActions}>
          <Link href="/gestionarjustificaciones" className={styles.linkMuted}>Historial</Link>
        </div>
      </div>

      <header className={styles.header}>
        <h1 className={styles.title}>Justificación #{id}</h1>
        {row?.estado ? (
          <span className={`${styles.pill} ${estadoClass}`} aria-label={`Estado: ${row.estado}`}>{row.estado}</span>
        ) : null}
      </header>

      {loading ? (
        <div className={styles.skeletonStack} aria-hidden>
          <div className={styles.cardSkeleton} />
          <div className={styles.cardSkeleton} />
          <div className={styles.cardSkeleton} />
        </div>
      ) : !row ? (
        <div className={styles.card}>
          <p>No se encontró la justificación.</p>
          <Link className={styles.btn} href="/gestionarjustificaciones">Ir al historial</Link>
        </div>
      ) : (
        <>
          {isAdmin && !isResolved && (
            <div className={`${styles.card} ${styles.adminCallout}`}>
              <div className={styles.rowBetween}>
                <div>
                  <strong>Acción de administrador:</strong> Puedes responder esta solicitud.
                </div>
                <Link href={`/justificaciones/${id}/responder`} className={`${styles.btn} ${styles.btnWarn}`}>Ir a Responder</Link>
              </div>
            </div>
          )}

          <section className={`${styles.card} ${styles.animSection}`} aria-labelledby="sec-cabecera">
            <h2 id="sec-cabecera" className={styles.cardTitle}>Resumen</h2>
            <div className={styles.metaGrid}>
              <div className={styles.metaItem}><span className={styles.metaLabel}>Tipo</span><span className={styles.metaValue}>{row.tipo_general || '—'}</span></div>
              <div className={styles.metaItem}><span className={styles.metaLabel}>Justificación</span><span className={styles.metaValue}>{tipo}</span></div>
              <div className={styles.metaItem}><span className={styles.metaLabel}>Fecha(s)</span><span className={styles.metaValue}>{row.fecha_inicio}{row.es_rango ? ` → ${row.fecha_fin}` : ''}</span></div>
              <div className={styles.metaItem}><span className={styles.metaLabel}>Jornada</span><span className={styles.metaValue}>{row.jornada || '—'}{row.hora_inicio || row.hora_fin ? ` (${row.hora_inicio || ''}${row.hora_fin ? ` - ${row.hora_fin}` : ''})` : ''}</span></div>
            </div>
          </section>

          <section className={`${styles.card} ${styles.animSection}`} aria-labelledby="sec-suscriptor">
            <h2 id="sec-suscriptor" className={styles.cardTitle}>Suscriptor</h2>
            <div className={styles.metaGrid}>
              <div className={styles.metaItem}><span className={styles.metaLabel}>Nombre</span><span className={styles.metaValue}>{row.nombre_suscriptor || '—'}</span></div>
              <div className={styles.metaItem}><span className={styles.metaLabel}>Cédula</span><span className={styles.metaValue}>{row.user_cedula || '—'}</span></div>
              <div className={styles.metaItem}><span className={styles.metaLabel}>Posición</span><span className={styles.metaValue}>{row.posicion || '—'}</span></div>
              <div className={styles.metaItem}><span className={styles.metaLabel}>Instancia</span><span className={styles.metaValue}>{row.instancia || '—'}</span></div>
            </div>
          </section>

          <section className={`${styles.card} ${styles.animSection}`} aria-labelledby="sec-detalle">
            <h2 id="sec-detalle" className={styles.cardTitle}>Detalle</h2>
            <div className={styles.detailList}>
              {row.familiar && (
                <div className={styles.detailRow}><span className={styles.detailKey}>Familiar</span><span className={styles.detailValue}>{row.familiar}</span></div>
              )}
              {row.cantidad && (
                <div className={styles.detailRow}><span className={styles.detailKey}>Cantidad</span><span className={styles.detailValue}>{row.cantidad} {row.unidad || ''}</span></div>
              )}
              {row.hora_salida && (
                <div className={styles.detailRow}><span className={styles.detailKey}>Hora de salida</span><span className={styles.detailValue}>{row.hora_salida}</span></div>
              )}
              {row.justificacion_fecha && (
                <div className={styles.detailRow}><span className={styles.detailKey}>Fecha justificante</span><span className={styles.detailValue}>{row.justificacion_fecha}{row.justificacion_hora ? ` • ${row.justificacion_hora}` : ''}</span></div>
              )}
              {row.observaciones && (
                <div className={styles.detailRow}><span className={styles.detailKey}>Observaciones</span><span className={styles.detailValue}>{row.observaciones}</span></div>
              )}
            </div>
          </section>

          <section className={`${styles.card} ${styles.animSection}`} aria-labelledby="sec-resol">
            <h2 id="sec-resol" className={styles.cardTitle}>Resolución</h2>
            {row.estado || row.respuesta_en || row.respuesta_por || row.respuesta_comentario ? (
              <div className={styles.detailList}>
                <div className={styles.detailRow}><span className={styles.detailKey}>Estado</span><span className={styles.detailValue}>{row.estado || '—'}</span></div>
                <div className={styles.detailRow}><span className={styles.detailKey}>Fecha de decisión</span><span className={styles.detailValue}>{row.respuesta_en ? new Date(row.respuesta_en).toLocaleString() : '—'}</span></div>
                <div className={styles.detailRow}><span className={styles.detailKey}>Decidido por</span><span className={styles.detailValue}>{row.respuesta_nombre || row.respuesta_por || '—'}</span></div>
                {row.respuesta_comentario && (
                  <div className={styles.detailRow}><span className={styles.detailKey}>Comentario</span><span className={styles.detailValue}>{row.respuesta_comentario}</span></div>
                )}
              </div>
            ) : (
              <p className={styles.muted}>Sin resolución aún.</p>
            )}
          </section>

          <section className={`${styles.card} ${styles.animSection}`} aria-labelledby="sec-adj">
            <h2 id="sec-adj" className={styles.cardTitle}>Adjuntos</h2>
            {adjuntos.length === 0 ? (
              <p className={styles.muted}>No hay archivos adjuntos.</p>
            ) : (
              <ul className={styles.attachList}>
                {adjuntos.map((a) => (
                  <li key={a.id} className={styles.attachItem}>
                    <span className={styles.attachIcon} aria-hidden>{a.mime?.includes('image/') ? '🖼️' : '📄'}</span>
                    <a href={a.public_url || '#'} target="_blank" rel="noreferrer" className={styles.attachLink} aria-label={`Abrir adjunto ${a.path?.split('/').slice(-1)[0] || ''}`}>
                      {a.path ? a.path.split('/').slice(-1)[0] : (a.mime || 'Archivo')}
                    </a>
                    {a.mime ? <span className={styles.attachMeta}>{a.mime}</span> : null}
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

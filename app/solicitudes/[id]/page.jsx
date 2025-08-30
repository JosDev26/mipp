"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import useCurrentUser from '../../../lib/useCurrentUser';
import LoadingOverlay from '../../../components/LoadingOverlay';
import styles from './page.module.css';

export default function SolicitudDetalle() {
  const { id } = useParams();
  const router = useRouter();
  const { user: currentUser, roles, loading: authLoading } = useCurrentUser();
  const isAdmin = Array.isArray(roles) && roles.includes('admin');
  const [row, setRow] = useState(null);
  const [adjuntos, setAdjuntos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);

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
        setStatus({ type: 'info', text: 'Cargando solicitud…' });
        const idNum = Number(id);
        if (Number.isNaN(idNum)) {
          setStatus({ type: 'error', text: 'ID de solicitud inválido.' });
          setRow(null);
          setLoading(false);
          return;
        }
        const { data: item, error } = await supabase
          .from('solicitudes_permiso')
          .select('*')
          .eq('id', idNum)
          .maybeSingle();
        if (error) throw error;
        if (!item) {
          setRow(null);
          setAdjuntos([]);
          setStatus({ type: 'error', text: 'No se encontró la solicitud.' });
        } else {
          setRow(item);
          const { data: atts, error: attErr } = await supabase
            .from('solicitud_adjuntos')
            .select('*')
            .eq('solicitud_id', item.id)
            .order('uploaded_at', { ascending: false });
          if (attErr) {
            console.error('detalle solicitud adjuntos error', attErr?.message || attErr);
          }
          setAdjuntos(atts || []);
          setStatus(null);
        }
      } catch (err) {
        console.error('detalle solicitud error', err?.message || err);
        setStatus({ type: 'error', text: `Error cargando la solicitud${err?.message ? `: ${err.message}` : ''}.` });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const nombreTipo = useMemo(() => row?.tipo_solicitud || 'Solicitud', [row]);
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
        <Link href="/gestionarsolicitudes" className={styles.back} title="Volver al listado">⟵ Volver</Link>
        <div className={styles.topActions}>
          <a href={`/api/solicitudes/${id}/pdf`} target="_blank" rel="noreferrer" className={styles.btn} title="Descargar PDF">Descargar PDF</a>
        </div>
      </div>

      <header className={styles.header}>
        <h1 className={styles.title}>Solicitud #{id}</h1>
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
          <p>No se encontró la solicitud.</p>
          <Link className={styles.btn} href="/gestionarsolicitudes">Ir al historial</Link>
        </div>
      ) : (
        <>
          {isAdmin && !isResolved && (
            <div className={`${styles.card} ${styles.adminCallout}`}>
              <div className={styles.rowBetween}>
                <div>
                  <strong>Acción de administrador:</strong> Puedes responder esta solicitud.
                </div>
                <Link href={`/solicitudes/${id}/responder`} className={`${styles.btn} ${styles.btnWarn}`}>Ir a Responder</Link>
              </div>
            </div>
          )}

          <section className={`${styles.card} ${styles.animSection}`} aria-labelledby="sec-resumen">
            <h2 id="sec-resumen" className={styles.cardTitle}>Resumen</h2>
            <div className={styles.metaGrid}>
              <div className={styles.metaItem}><span className={styles.metaLabel}>Tipo</span><span className={styles.metaValue}>{row.tipo_general || '—'}</span></div>
              <div className={styles.metaItem}><span className={styles.metaLabel}>Motivo</span><span className={styles.metaValue}>{nombreTipo}</span></div>
              <div className={styles.metaItem}><span className={styles.metaLabel}>Fecha(s)</span><span className={styles.metaValue}>{row.fecha_inicio}{row.es_rango ? ` → ${row.fecha_fin}` : ''}</span></div>
              <div className={styles.metaItem}><span className={styles.metaLabel}>Jornada</span><span className={styles.metaValue}>{row.jornada || '—'}{row.hora_inicio || row.hora_fin ? ` (${row.hora_inicio || ''}${row.hora_fin ? ` - ${row.hora_fin}` : ''})` : ''}</span></div>
            </div>
          </section>

          <section className={`${styles.card} ${styles.animSection}`} aria-labelledby="sec-solicitante">
            <h2 id="sec-solicitante" className={styles.cardTitle}>Solicitante</h2>
            <div className={styles.metaGrid}>
              <div className={styles.metaItem}><span className={styles.metaLabel}>Nombre</span><span className={styles.metaValue}>{row.nombre_solicitante || '—'}</span></div>
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
              {row.observaciones && (
                <div className={styles.detailRow}><span className={styles.detailKey}>Observaciones</span><span className={styles.detailValue}>{row.observaciones}</span></div>
              )}
            </div>
          </section>

          <section className={`${styles.card} ${styles.animSection}`} aria-labelledby="sec-resol">
            <h2 id="sec-resol" className={styles.cardTitle}>Resolución</h2>
            {row.estado || row.respuesta_en || row.respuesta_nombre || row.respuesta_comentario ? (
              <div className={styles.detailList}>
                <div className={styles.detailRow}><span className={styles.detailKey}>Estado</span><span className={styles.detailValue}>{row.estado || '—'}</span></div>
                {row.respuesta_en && (
                  <div className={styles.detailRow}><span className={styles.detailKey}>Fecha de decisión</span><span className={styles.detailValue}>{new Date(row.respuesta_en).toLocaleString()}</span></div>
                )}
                {row.respuesta_nombre && (
                  <div className={styles.detailRow}><span className={styles.detailKey}>Decidido por</span><span className={styles.detailValue}>{row.respuesta_nombre}</span></div>
                )}
                {row.respuesta_comentario && (
                  <div className={styles.detailRow}><span className={styles.detailKey}>Comentario</span><span className={styles.detailValue} style={{ whiteSpace: 'pre-wrap' }}>{row.respuesta_comentario}</span></div>
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

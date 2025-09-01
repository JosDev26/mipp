"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import useCurrentUser from '../../../lib/useCurrentUser';
import LoadingOverlay from '../../../components/LoadingOverlay';
import styles from './page.module.css';

export default function OmisionMarcaDetalle() {
  const { id } = useParams();
  const router = useRouter();
  const { user: currentUser, roles, loading: authLoading } = useCurrentUser();
  const isAdmin = Array.isArray(roles) && roles.includes('admin');
  const [row, setRow] = useState(null);
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
        setStatus({ type: 'info', text: 'Cargando omisión…' });
        const { data, error } = await supabase
          .from('omision_marca')
          .select('*')
          .eq('id', id)
          .limit(1);
        if (error) throw error;
        const item = (data && data[0]) || null;
        setRow(item);
        setStatus(item ? null : { type: 'error', text: 'No se encontró la omisión.' });
      } catch (err) {
        console.error('detalle omisión de marca error', err);
        setRow(null);
        setStatus({ type: 'error', text: 'Error cargando la omisión.' });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

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
        <Link href="/home" className={styles.back} title="Volver al inicio">⟵ Volver</Link>
        <div className={styles.topActions}>
          <a href={`/api/omisionmarca/${id}/pdf`} target="_blank" rel="noreferrer" className={styles.btn} title="Descargar PDF">Descargar PDF</a>
        </div>
      </div>

      <header className={styles.header}>
        <h1 className={styles.title}>Omisión de marca #{id}</h1>
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
          <p>No se encontró la omisión de marca.</p>
          <Link className={styles.btn} href="/omisionmarca">Volver al listado</Link>
        </div>
      ) : (
        <>
          {isAdmin && !isResolved && (
            <div className={`${styles.card} ${styles.adminCallout}`}>
              <div className={styles.rowBetween}>
                <div>
                  <strong>Acción de administrador:</strong> Puedes responder esta solicitud.
                </div>
                <Link href={`/omisionmarca/${id}/responder`} className={`${styles.btn} ${styles.btnWarn}`}>Ir a Responder</Link>
              </div>
            </div>
          )}

          <section className={`${styles.card} ${styles.animSection}`} aria-labelledby="sec-resumen">
            <h2 id="sec-resumen" className={styles.cardTitle}>Resumen</h2>
            <div className={styles.metaGrid}>
              <div className={styles.metaItem}><span className={styles.metaLabel}>Fecha de omisión</span><span className={styles.metaValue}>{row.fecha_omision || '—'}</span></div>
              <div className={styles.metaItem}><span className={styles.metaLabel}>Tipo</span><span className={styles.metaValue}>{row.tipo_omision || '—'}</span></div>
              <div className={styles.metaItem}><span className={styles.metaLabel}>Creado</span><span className={styles.metaValue}>{row.creado_en ? new Date(row.creado_en).toLocaleString('es-CR', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</span></div>
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
              <div className={styles.detailRow}><span className={styles.detailKey}>Justificación</span><span className={styles.detailValue}>{row.justificacion}</span></div>
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
        </>
      )}
    </div>
  );
}

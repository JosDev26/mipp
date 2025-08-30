"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import styles from './page.module.css';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import useCurrentUser from '../../lib/useCurrentUser';

export default function JustificacionesListPage() {
  const router = useRouter();
  const { user, roles, loading: authLoading } = useCurrentUser();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [order, setOrder] = useState('newest');
  const [tipo, setTipo] = useState('Todos');

  const isAdmin = Array.isArray(roles) && roles.includes('admin');
  const isViewer = Array.isArray(roles) && roles.includes('viewer');
  const isAdminOrViewer = isAdmin || isViewer;

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        let q = supabase.from('justificaciones').select('*').order('creado_en', { ascending: false });
        if (!isAdminOrViewer && user?.cedula) q = q.eq('user_cedula', user.cedula);
        const { data, error } = await q;
        if (error) throw error;
        const rows = (data || []).map(r => ({
          id: r.id,
          solicitante: r.nombre_suscriptor || null,
          fecha: r.fecha_inicio || r.creado_en?.slice(0,10) || '',
          rango: r.es_rango ? ` → ${r.fecha_fin}` : '',
          detalle: r.tipo_justificacion || 'Justificación',
          estado: r.estado || 'Pendiente',
          createdAt: r.creado_en || null,
        }));
        setItems(rows);
      } catch (err) {
        console.error('load justificaciones error', err);
        setItems([]);
      } finally { setLoading(false); }
    };
    load();
  }, [user?.cedula, isAdminOrViewer]);

  const statusColor = (estado) => {
    const s = (estado || '').toString().toLowerCase();
    if (s.includes('aprob') || s.includes('acept')) return '#16a34a';
    if (s.includes('pend')) return '#f59e0b';
    if (s.includes('rech') || s.includes('deneg')) return '#ef4444';
    return '#94a3b8';
  };

  const tipos = useMemo(() => ['Todos', 'Aprobadas', 'Pendientes', 'Rechazadas'], []);

  const filtered = items.filter((it) => {
    if (tipo === 'Aprobadas') return (it.estado || '').toLowerCase().includes('aprob') || (it.estado || '').toLowerCase().includes('acept');
    if (tipo === 'Pendientes') return (it.estado || '').toLowerCase().includes('pend');
    if (tipo === 'Rechazadas') return (it.estado || '').toLowerCase().includes('rech') || (it.estado || '').toLowerCase().includes('deneg');
    return true;
  }).filter((it) => {
    const t = `${it.detalle} ${it.solicitante} ${it.fecha}`.toLowerCase();
    return !search || t.includes(search.toLowerCase());
  }).sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return order === 'newest' ? (tb - ta) : (ta - tb);
  });

  return (
    <div className={`${styles.page} ${styles.enter}`}>
      <div className={styles.header}>
        <div className={styles.title}>Justificaciones</div>
        <Link href="/home" className={styles.open}>← Volver</Link>
      </div>
      <div className={styles.toolbar}>
        <div className={styles.search}><input className={styles.input} placeholder="Buscar por detalle o nombre" aria-label="Buscar" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <label aria-label="Filtro por estado">Estado
          <select className={styles.select} value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {tipos.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label aria-label="Orden de lista">Ordenar
          <select className={styles.select} value={order} onChange={(e) => setOrder(e.target.value)}>
            <option value="newest">Más nuevos</option>
            <option value="oldest">Más antiguos</option>
          </select>
        </label>
        <button className={styles.pillBtn} onClick={() => location.reload()}>Refrescar</button>
      </div>

      {loading ? (
        <div className={styles.skeletonGrid} aria-hidden>
          <div className={styles.skeleton} />
          <div className={styles.skeleton} />
          <div className={styles.skeleton} />
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>No hay registros.</div>
      ) : (
        <div className={`${styles.cards} ${styles.listAnim}`}>
          {filtered.map((s) => (
            <Link key={s.id} href={`/justificaciones/${s.id}`} className={styles.open} style={{ textDecoration: 'none', color: 'inherit' }}>
              <article className={styles.card}>
                <div>
                  <div className={styles.cardTitle}>{s.detalle}</div>
                  <div className={styles.cardMeta}>📅 {s.fecha}{s.rango}</div>
                  <div className={styles.cardMeta}>👤 {s.solicitante || '—'}</div>
                </div>
                <div className={styles.statusWrap}>
                  <div className={styles.statusDot} style={{ background: statusColor(s.estado) }} />
                  <div className={styles.statusText}>{s.estado}</div>
                </div>
              </article>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import styles from './page.module.css';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import useCurrentUser from '../../../lib/useCurrentUser';

export default function InfraHistorialPage() {
  const router = useRouter();
  const { user, roles, loading: authLoading } = useCurrentUser();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [order, setOrder] = useState('newest');
  const [tipo, setTipo] = useState('Todos');

  const isAdmin = Array.isArray(roles) && roles.includes('admin');
  const isInfraManager = Array.isArray(roles) && roles.includes('infra_manager');
  const isViewer = Array.isArray(roles) && roles.includes('viewer');
  const canSeeAll = isAdmin || isInfraManager || isViewer;

  useEffect(() => { if (!authLoading && !user) router.push('/login'); }, [authLoading, user, router]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        let q = supabase.from('reporte_infraestructura').select('*').order('creado_en', { ascending: false });
        if (!canSeeAll && user?.cedula) q = q.eq('user_cedula', user.cedula);
        const { data, error } = await q;
        if (error) throw error;
        const rows = (data || []).map(r => ({
          id: r.id,
          solicitante: r.nombre_suscriptor || null,
          fecha: r.creado_en ? new Date(r.creado_en).toISOString().slice(0,10) : '',
          detalle: r.lugar ? `${r.lugar}: ${r.reporte || ''}` : (r.reporte || 'Reporte'),
          estado: r.estado || 'Pendiente',
          createdAt: r.creado_en || null,
        }));
        setItems(rows);
      } catch (err) { console.error('load infra error', err); setItems([]); }
      finally { setLoading(false); }
    };
    load();
  }, [user?.cedula, canSeeAll]);

  const statusColor = (estado) => {
    const s = (estado || '').toLowerCase();
    if (s.includes('solucion')) return '#16a34a';
    if (s.includes('pend')) return '#f59e0b';
    if (s.includes('no solucion') || s.includes('rech') || s.includes('deneg')) return '#ef4444';
    return '#94a3b8';
  };

  const tipos = useMemo(() => ['Todos', 'Solucionados', 'Pendientes', 'No solucionados'], []);
  const filtered = items.filter((it) => {
    if (tipo === 'Solucionados') return (it.estado || '').toLowerCase().includes('solucion');
    if (tipo === 'Pendientes') return (it.estado || '').toLowerCase().includes('pend');
    if (tipo === 'No solucionados') return (it.estado || '').toLowerCase().includes('no solucion') || (it.estado || '').toLowerCase().includes('rech') || (it.estado || '').toLowerCase().includes('deneg');
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
    <div className={`${styles.page} ${styles.enter || ''}`}>
      <div className={styles.header}>
        <div className={styles.title}>Historial — Reportes de infraestructura</div>
        <Link href="/home" className={styles.open}>← Volver</Link>
      </div>
      <div className={styles.toolbar}>
        <div className={styles.search}><input className={styles.input} placeholder="Buscar por lugar o detalle" aria-label="Buscar" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <label>Estado
          <select className={styles.select} value={tipo} onChange={(e) => setTipo(e.target.value)}>{tipos.map(t => <option key={t} value={t}>{t}</option>)}</select>
        </label>
        <label>Ordenar
          <select className={styles.select} value={order} onChange={(e) => setOrder(e.target.value)}>
            <option value="newest">Más nuevos</option>
            <option value="oldest">Más antiguos</option>
          </select>
        </label>
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
            <Link key={s.id} href={`/reporteinf/${s.id}`} className={styles.open} style={{ textDecoration: 'none', color: 'inherit' }}>
              <article className={styles.card}>
                <div>
                  <div className={styles.cardTitle}>{s.detalle}</div>
                  <div className={styles.cardMeta}>📅 {s.fecha}</div>
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

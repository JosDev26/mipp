"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import useCurrentUser from '../../lib/useCurrentUser';
import styles from './page.module.css';

export default function HomePage() {
  const router = useRouter();
  const { user, roles, loading: authLoading } = useCurrentUser();
  const [cedula, setCedula] = useState(null);
  const [userName, setUserName] = useState('');
  const [items, setItems] = useState([]); // permisos + justificaciones + omisiones + infraestructura
  const [loadingSolicitudes, setLoadingSolicitudes] = useState(false);
  const [filterTipo, setFilterTipo] = useState('Todos');
  const [showAll, setShowAll] = useState(false);
  const [animateTick, setAnimateTick] = useState(0);

  const isAdmin = Array.isArray(roles) && roles.includes('admin');
  const isInfraManager = Array.isArray(roles) && roles.includes('infra_manager');
  const isViewer = Array.isArray(roles) && roles.includes('viewer');
  const isAdminOrViewer = isAdmin || isViewer;
  const [adminOrder, setAdminOrder] = useState('newest');
  const [viewerPersonal, setViewerPersonal] = useState(false);

  // Auth redirect + cédula
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user) setCedula(user.cedula || null);
  }, [authLoading, user, router]);

  // Cargar nombre del usuario
  useEffect(() => {
    if (!cedula) return;
    (async () => {
      const { data, error } = await supabase
        .from('users')
        .select('nombre,segundo_nombre,primer_apellido,segundo_apellido')
        .eq('cedula', cedula)
        .maybeSingle();
      if (!error && data) {
        const seg = data.segundo_nombre ? ` ${data.segundo_nombre}` : '';
        setUserName(`${data.nombre}${seg} ${data.primer_apellido} ${data.segundo_apellido}`.trim());
      }
    })();
  }, [cedula]);

  const fetchSolicitudes = async () => {
    // Evita cargar historial antes de conocer cédula cuando es vista personal
    if (!showAll && !cedula) return;

    setLoadingSolicitudes(true);
    try {
      // Permisos
      let qPerm = supabase
        .from('solicitudes_permiso')
        .select('*')
        .order('created_at', { ascending: false });
      if (!isAdminOrViewer && cedula) qPerm = qPerm.eq('user_cedula', cedula);

      // Justificaciones
      let qJust = supabase
        .from('justificaciones')
        .select('*')
        .order('creado_en', { ascending: false });
      if (!isAdminOrViewer && cedula) qJust = qJust.eq('user_cedula', cedula);

      // Omisión de marca
      let qOmis = supabase
        .from('omision_marca')
        .select('*')
        .order('creado_en', { ascending: false });
      if (!isAdminOrViewer && cedula) qOmis = qOmis.eq('user_cedula', cedula);

      // Infraestructura
      let qInfra = supabase
        .from('reporte_infraestructura')
        .select('*')
        .order('creado_en', { ascending: false });
      if (!isAdminOrViewer && cedula) qInfra = qInfra.eq('user_cedula', cedula);

      const [permRes, justRes, omisRes, infraRes] = await Promise.all([qPerm, qJust, qOmis, qInfra]);
      if (permRes.error) throw permRes.error;
      if (justRes.error) throw justRes.error;
      if (omisRes.error) throw omisRes.error;
      if (infraRes.error) throw infraRes.error;

      const perms = (permRes.data || []).map(r => ({
        kind: 'Permiso',
        id: r.id,
        userCedula: r.user_cedula || null,
        tipo_display: r.tipo_solicitud || 'Solicitud',
        fecha_inicio: r.fecha_inicio,
        fecha_fin: r.fecha_fin,
        es_rango: r.es_rango,
        jornada: r.jornada,
        hora_inicio: r.hora_inicio,
        hora_fin: r.hora_fin,
        observaciones: r.observaciones,
        estado: r.estado,
        createdAt: r.created_at || null,
        solicitante: r.nombre_solicitante || null,
      }));

  const justs = (justRes.data || []).map(r => ({
        kind: 'Justificación',
        id: r.id,
        userCedula: r.user_cedula || null,
        tipo_display: r.tipo_justificacion || 'Justificación',
        fecha_inicio: r.fecha_inicio,
        fecha_fin: r.fecha_fin,
        es_rango: r.es_rango,
        jornada: r.jornada,
        hora_inicio: r.hora_inicio,
        hora_fin: r.hora_fin,
        observaciones: r.observaciones,
  estado: r.estado || 'Pendiente',
        createdAt: r.creado_en || null,
        solicitante: r.nombre_suscriptor || null,
      }));

      const omisiones = (omisRes.data || []).map(r => ({
        kind: 'Omisión de marca',
        id: r.id,
        userCedula: r.user_cedula || null,
        tipo_display: 'Omisión de marca',
        fecha_inicio: r.fecha_omision,
        fecha_fin: null,
        es_rango: false,
        jornada: r.tipo_omision,
        hora_inicio: null,
        hora_fin: null,
        observaciones: r.justificacion,
        estado: r.estado || null,
        createdAt: r.creado_en || null,
        solicitante: r.nombre_suscriptor || null,
      }));

      const infra = (infraRes.data || []).map(r => ({
        kind: 'Infraestructura',
        id: r.id,
        userCedula: r.user_cedula || null,
        tipo_display: 'Reporte de infraestructura',
        fecha_inicio: r.creado_en ? new Date(r.creado_en).toISOString().slice(0,10) : '',
        fecha_fin: null,
        es_rango: false,
        jornada: r.tipo_reporte,
        hora_inicio: null,
        hora_fin: null,
        observaciones: (r.lugar ? `${r.lugar}: ` : '') + (r.reporte || ''),
        estado: r.estado || null,
        createdAt: r.creado_en || null,
        solicitante: r.nombre_suscriptor || null,
      }));

      const merged = [...perms, ...justs, ...omisiones, ...infra].sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });
      setItems(merged);
    } catch (err) {
      console.error('fetch solicitudes error', err);
      setItems([]);
    } finally {
      setLoadingSolicitudes(false);
    }
  };

  useEffect(() => {
    fetchSolicitudes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cedula, showAll, isAdminOrViewer]);

  const statusColor = (estado) => {
    if (!estado) return '#999';
    const s = String(estado).toLowerCase();
    if (s.includes('aprob') || s.includes('acept') || s.includes('solucion')) return '#16a34a';
    if (s.includes('pend')) return '#f59e0b';
    if (s.includes('rech') || s.includes('deneg') || s.includes('no solucion')) return '#ef4444';
    return '#6b7280';
  };

  const tipos = useMemo(() => ['Todos', 'Permiso', 'Justificación', 'Omisión de marca', 'Infraestructura'], []);

  const filtered = items.filter((row) => {
    if (filterTipo === 'Todos') return true;
    if (filterTipo === 'Permiso' || filterTipo === 'Justificación' || filterTipo === 'Omisión de marca' || filterTipo === 'Infraestructura') {
      return row.kind === filterTipo;
    }
    return String(row.tipo_display || '').toLowerCase().includes(filterTipo.toLowerCase());
  });

  const sortedForView = useMemo(() => {
    if (!isAdminOrViewer) return filtered;
    // Mostrar solo pendientes
    const arr = filtered.filter(r => {
      const s = (r.estado ?? '').toString().toLowerCase();
      return !r.estado || s.includes('pend');
    });
    const getT = (r) => r?.createdAt ? new Date(r.createdAt).getTime() : 0;
    arr.sort((a, b) => {
      const ta = getT(a), tb = getT(b);
      return adminOrder === 'newest' ? (tb - ta) : (ta - tb);
    });
    return arr;
  }, [filtered, isAdminOrViewer, adminOrder]);

  const myHistoryForViewer = useMemo(() => {
    if (!isViewer) return [];
    const own = filtered.filter(r => r.userCedula && cedula && String(r.userCedula) === String(cedula));
    // sort by createdAt desc
    own.sort((a,b) => {
      const ta = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
    return own;
  }, [filtered, isViewer, cedula]);

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch (err) {
      console.error('logout error', err);
    }
    router.push('/login');
  };

  const globalLoading = authLoading || loadingSolicitudes || (!showAll && (!cedula || authLoading));
  const hasRole = Array.isArray(roles) && roles.length > 0;
  const themeClass = hasRole ? styles.themeWithRole : styles.themeNoRole;

  if (globalLoading) {
    return (
  <div className={`${styles.page} ${themeClass}`}>
        <div className={styles.shell}>
          <header className={styles.header}>
            <div className={styles.brandWrap}>
              <div className={styles.brand}>MIPP+</div>
              <div className={styles.welcome}>Cargando…</div>
            </div>
            <span className={styles.srOnly}>Loading</span>
          </header>
          <section className={styles.actionsGrid} aria-hidden>
            <div className={styles.actionCard} />
            <div className={styles.actionCard} />
            <div className={styles.actionCard} />
            <div className={styles.actionCard} />
          </section>
          <h3 className={styles.sectionTitle}>Historial</h3>
          <div className={styles.skeletonList}>
            <div className={styles.skeleton} />
            <div className={styles.skeleton} />
            <div className={styles.skeleton} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.page} ${styles.enter} ${themeClass}`}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.brandWrap}>
            <div className={styles.brand}>MIPP+</div>
          </div>
          <div className={styles.headerCenter}>
            <div className={styles.welcome}>Bienvenido/a</div>
            <h1 className={styles.userTitle}>{userName || 'Usuario'}</h1>
          </div>
          <button
            className={styles.logoutIconBtn}
            onClick={handleLogout}
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h3"/>
              <path d="M16 17l5-5-5-5"/>
              <path d="M21 12H9"/>
            </svg>
            <span className={styles.tooltip}>Cerrar sesión</span>
          </button>
        </header>

        <section className={styles.hero}>
          <h1>¿Qué deseas hacer hoy?</h1>
          <p>Acciones rápidas y tu historial en un vistazo.</p>
        </section>

        <section className={styles.actionsGrid}>
          <Link className={styles.actionCard} href={isAdmin ? "/gestionarsolicitudes" : "/formulariopermiso"}>
            <div className={`${styles.actionIcon} ${styles.actBlue}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 20h9"/>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
              </svg>
            </div>
            <div className={styles.actionTitle}>{isAdmin ? 'Gestionar permisos' : 'Solicitar permiso'}</div>
            <div className={styles.actionDesc}>Salida, Ausencia, Tardía o Incapacidad</div>
          </Link>
          <Link className={styles.actionCard} href={isAdmin ? "/gestionarjustificaciones" : "/formjustificacion"}>
            <div className={`${styles.actionIcon} ${styles.actPurple}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
            </div>
            <div className={styles.actionTitle}>{isAdmin ? 'Gestionar justificaciones' : 'Justificar ausencia'}</div>
            <div className={styles.actionDesc}>Inasistencia, tardía o salida</div>
          </Link>
          <Link className={styles.actionCard} href={isAdmin ? "/gestionarmarca" : "/omisionmarca"}>
            <div className={`${styles.actionIcon} ${styles.actGreen}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="13" r="8"/>
                <path d="M12 9v5l3 2"/>
                <path d="M16 3l1 3"/>
                <path d="M8 3l-1 3"/>
              </svg>
            </div>
            <div className={styles.actionTitle}>{isAdmin ? 'Gestionar omisiones' : 'Omisión de marca'}</div>
            <div className={styles.actionDesc}>Registra una omisión de marca</div>
          </Link>
          {(isAdmin || isInfraManager) ? (
            <Link className={styles.actionCard} href="/gestionarinfra">
              <div className={`${styles.actionIcon} ${styles.actOrange}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 21h18"/>
                  <rect x="3" y="10" width="6" height="7" rx="1"/>
                  <rect x="15" y="7" width="6" height="10" rx="1"/>
                  <path d="M9 3h6v4H9z"/>
                </svg>
              </div>
              <div className={styles.actionTitle}>Gestionar infraestructura</div>
              <div className={styles.actionDesc}>Responde y da seguimiento</div>
            </Link>
          ) : (
            <Link className={styles.actionCard} href="/reporteinf">
              <div className={`${styles.actionIcon} ${styles.actOrange}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 21h16"/>
                  <path d="M4 17l8-8 8 8"/>
                  <path d="M12 9v12"/>
                </svg>
              </div>
              <div className={styles.actionTitle}>Reporte de infraestructura</div>
              <div className={styles.actionDesc}>Reporta un problema o daño</div>
            </Link>
          )}
          {!isAdmin && isInfraManager && (
            <Link className={styles.actionCard} href="/reporteinf">
              <div className={`${styles.actionIcon} ${styles.actOrange}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 9h18M3 15h18M7.5 3v18M16.5 3v18"/>
                </svg>
              </div>
              <div className={styles.actionTitle}>Reportar daño</div>
              <div className={styles.actionDesc}>Crear nuevo reporte</div>
            </Link>
          )}
          {isAdminOrViewer && (
            <Link className={styles.actionCard} href="/solicitudesresueltas">
              <div className={`${styles.actionIcon} ${styles.actBlue}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 7h6l2 2h8v10a2 2 0 0 1-2 2H4V7z"/>
                </svg>
              </div>
              <div className={styles.actionTitle}>Solicitudes resueltas</div>
              <div className={styles.actionDesc}>Histórico de solicitudes resueltas</div>
            </Link>
          )}
          {Array.isArray(roles) && (roles.includes('staff_manager') || roles.includes('admin')) && (
            <Link className={styles.actionCard} href="/admin">
              <div className={`${styles.actionIcon} ${styles.actPurple}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M16 11c1.66 0 3-1.79 3-4s-1.34-4-3-4-3 1.79-3 4 1.34 4 3 4z"/>
                  <path d="M8 13c2.21 0 4-2.24 4-5s-1.79-5-4-5S4 5.24 4 8s1.79 5 4 5z"/>
                  <path d="M6 22v-2c0-2.21 1.79-4 4-4h0"/>
                  <path d="M14 22v-2c0-2.21 1.79-4 4-4h0"/>
                </svg>
              </div>
              <div className={styles.actionTitle}>Administrar personal</div>
              <div className={styles.actionDesc}>Roles, sesiones y perfiles</div>
            </Link>
          )}
        </section>

        <section className={styles.toolbar}>
          <label>Filtro por tipo:
            <select
              className={styles.select}
              value={filterTipo}
              onChange={(e) => { setFilterTipo(e.target.value); setAnimateTick(t => t + 1); }}
            >
              {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          {isAdmin && (
            <label>
              Ordenar:
              <select className={styles.select} value={adminOrder} onChange={(e) => setAdminOrder(e.target.value)}>
                <option value="newest">Más nuevos</option>
                <option value="oldest">Más antiguos</option>
              </select>
            </label>
          )}
          <span style={{ marginLeft: 6 }}>Mostrando: <strong>{showAll ? 'Historial de mis solicitudes' : 'Mis solicitudes'}</strong></span>
          <button className={`${styles.pillBtn} ${styles.pillGhost}`} onClick={() => { setShowAll(false); fetchSolicitudes(); }}>Refrescar</button>
          {!isAdminOrViewer && (
            <button className={styles.pillBtn} onClick={() => { setShowAll(true); fetchSolicitudes(); }}>Ver historial</button>
          )}
          {isViewer && (
            !viewerPersonal ? (
              <button className={styles.pillBtn} onClick={() => { setViewerPersonal(true); setShowAll(true); }}>Historial personal</button>
            ) : (
              <button className={styles.pillBtn} onClick={() => setViewerPersonal(false)}>Ver pendientes</button>
            )
          )}
          {/* Administrar personal moved to quick actions */}
        </section>

        <h3 className={styles.sectionTitle}>Historial</h3>
    {isAdminOrViewer ? (
          viewerPersonal && isViewer ? (
      <div className={`${styles.cards} ${styles.listAnimate}`} key={`list-${animateTick}`}>
              {myHistoryForViewer.length === 0 ? <div className={styles.empty}>No hay solicitudes.</div> : myHistoryForViewer.map((s) => {
                const Card = (
                  <article className={styles.card}>
                    <div>
                      <div className={styles.cardTitle}>{s.tipo_display}</div>
                      <div className={styles.cardMeta}>{s.fecha_inicio}{s.es_rango ? ` → ${s.fecha_fin}` : ''} • {s.jornada || ''} {s.kind ? `• ${s.kind}` : ''}</div>
                      <div style={{ color: '#444', marginTop: 6 }}>{s.observaciones || ''}</div>
                    </div>
                    <div className={styles.statusWrap}>
                      <div className={styles.statusDot} style={{ background: statusColor(s.estado) }} />
                      <div className={styles.statusText}>{s.estado || 'Sin estado'}</div>
                    </div>
                  </article>
                );
                let href = `/justificaciones/${s.id}`;
                if (s.kind === 'Permiso') href = `/solicitudes/${s.id}`;
                if (s.kind === 'Omisión de marca') href = `/omisionmarca/${s.id}`;
                if (s.kind === 'Infraestructura') href = `/reporteinf/${s.id}`;
                return (
                  <Link key={`${s.kind}-${s.id}`} href={href} style={{ textDecoration: 'none', color: 'inherit' }}>
                    {Card}
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={`${styles.table} ${styles.listAnimateTable}`} key={`table-${animateTick}`}>
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Ingresado</th>
                    <th>Funcionario</th>
                    <th>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedForView.length === 0 ? (
                    <tr><td colSpan={4} className={styles.empty}>No hay registros.</td></tr>
                  ) : sortedForView.map((s) => {
                    const dt = s.createdAt ? new Date(s.createdAt) : null;
                    const fecha = dt ? dt.toLocaleDateString() : '—';
                    const hora = dt ? dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                    let href = `/justificaciones/${s.id}`;
                    if (s.kind === 'Permiso') href = `/solicitudes/${s.id}`;
                    if (s.kind === 'Omisión de marca') href = `/omisionmarca/${s.id}`;
                    if (s.kind === 'Infraestructura') href = `/reporteinf/${s.id}`;
                    return (
                      <tr key={`${s.kind}-${s.id}`}>
                        <td>{s.kind}</td>
                        <td>{fecha} {hora && `• ${hora}`}</td>
                        <td>{s.solicitante || '—'}</td>
                        <td>
                          <Link href={href} className={styles.openLink}>Abrir</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div className={`${styles.cards} ${styles.listAnimate}`} key={`list-${animateTick}` }>
            {filtered.length === 0 ? <div className={styles.empty}>No hay solicitudes.</div> : filtered.map((s) => {
              const Card = (
                <article className={styles.card}>
                  <div>
                    <div className={styles.cardTitle}>{s.tipo_display}</div>
                    <div className={styles.cardMeta}>{s.fecha_inicio}{s.es_rango ? ` → ${s.fecha_fin}` : ''} • {s.jornada || ''} {s.kind ? `• ${s.kind}` : ''}</div>
                    <div style={{ color: '#444', marginTop: 6 }}>{s.observaciones || ''}</div>
                  </div>
                  <div className={styles.statusWrap}>
                    <div className={styles.statusDot} style={{ background: statusColor(s.estado) }} />
                    <div className={styles.statusText}>{s.estado || 'Sin estado'}</div>
                  </div>
                </article>
              );
              let href = `/justificaciones/${s.id}`;
              if (s.kind === 'Permiso') href = `/solicitudes/${s.id}`;
              if (s.kind === 'Omisión de marca') href = `/omisionmarca/${s.id}`;
              if (s.kind === 'Infraestructura') href = `/reporteinf/${s.id}`;
              return (
                <Link key={`${s.kind}-${s.id}`} href={href} style={{ textDecoration: 'none', color: 'inherit' }}>
                  {Card}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

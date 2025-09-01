"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import useCurrentUser from '../../lib/useCurrentUser';
import LoadingOverlay from '../../components/LoadingOverlay';
import styles from '../shared/adminList.module.css';

export default function GestionarJustificacionesPage(){
  const router = useRouter();
  const { user: currentUser, roles, loading: authLoading } = useCurrentUser();
  const isAdmin = Array.isArray(roles) && roles.includes('admin');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && (!currentUser || !isAdmin)) {
      router.push('/login');
      return;
    }
  }, [authLoading, currentUser, isAdmin, router]);

  useEffect(() => {
    const load = async () => {
      try{
        setLoading(true);
        const { data, error } = await supabase
          .from('justificaciones')
          .select('*')
          .or('estado.is.null,estado.eq.Pendiente,estado.eq.pendiente')
          .order('creado_en', { ascending: false });
        if(error) throw error;
        setRows(data || []);
      }catch(err){
        console.error('listar pendientes justificaciones', err);
        setRows([]);
      }finally{
        setLoading(false);
      }
    };
    if (isAdmin) load();
  }, [isAdmin]);

  return (
    <div className={styles.pageWrap}>
      <LoadingOverlay show={authLoading || loading} text="Cargando datos..." />
      <img src="/images/logoMIPP.png" alt="MIPP+ Logo" className={styles.logoHeader} />
      <h1 className={styles.brandTitle}>Gestionar justificaciones</h1>
      <div className={styles.headerBar}>
        <Link href="/home" className={styles.backLink}>&lt; Volver</Link>
      </div>
      {loading ? <p>Cargando…</p> : (
        rows.length === 0 ? <p>No hay justificaciones pendientes.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.idCell}>#</th>
                  <th>Ingresado</th>
                  <th>Funcionario</th>
                  <th>Tipo</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const dt = r.creado_en ? new Date(r.creado_en) : null;
                  const fecha = dt ? dt.toLocaleDateString() : '—';
                  const hora = dt ? dt.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) : '';
                  return (
                    <tr key={r.id}>
                      <td className={styles.idCell}>#{r.id}</td>
                      <td>{fecha} {hora && `• ${hora}`}</td>
                      <td>{r.nombre_suscriptor || '—'}</td>
                      <td>{r.tipo_justificacion || 'Justificación'}</td>
                      <td>
                        <Link href={`/justificaciones/${r.id}`} className={styles.openLink}>Abrir</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}

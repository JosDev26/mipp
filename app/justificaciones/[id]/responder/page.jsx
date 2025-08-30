"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabaseClient';
import useCurrentUser from '../../../../lib/useCurrentUser';
import styles from './page.module.css';

const fmt2 = (n) => String(n).padStart(2, '0');

export default function ResponderJustificacionPage(){
  const { id } = useParams();
  const router = useRouter();
  const { user: currentUser, roles, loading: authLoading } = useCurrentUser();
  const isAdmin = Array.isArray(roles) && roles.includes('admin');
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [decision, setDecision] = useState('Aceptar con rebajo salarial parcial');
  const [comentario, setComentario] = useState('');
  const [status, setStatus] = useState(null);
  const [errorsUI, setErrorsUI] = useState({});
  const selectRef = useRef(null);

  useEffect(() => {
    if (!authLoading && (!currentUser || !isAdmin)) router.push('/login');
  }, [authLoading, currentUser, isAdmin, router]);

  useEffect(() => {
    const load = async () => {
      try{
        setLoading(true);
        const { data, error } = await supabase
          .from('justificaciones')
          .select('*')
          .eq('id', id)
          .limit(1);
        if(error) throw error;
        setRow((data && data[0]) || null);
      }catch(err){
        console.error('cargar justificación', err);
        setRow(null);
        setStatus({ type:'error', text:'No se pudo cargar la justificación.' });
      }finally{ setLoading(false); }
    };
    if (isAdmin && id) load();
  }, [isAdmin, id]);

  useEffect(() => { if (!loading && row) selectRef.current?.focus(); }, [loading, row]);

  useEffect(() => { try{
    const k = `responderDraft:just:${id}`; const s = localStorage.getItem(k);
    if (s){ const o = JSON.parse(s); if (o.decision) setDecision(o.decision); if (o.comentario) setComentario(o.comentario); }
  }catch{} }, [id]);
  useEffect(() => { try{ localStorage.setItem(`responderDraft:just:${id}`, JSON.stringify({ decision, comentario })); }catch{} }, [id, decision, comentario]);

  const now = useMemo(() => new Date(), []);
  const fechaTxt = useMemo(() => `${fmt2(now.getDate())}/${fmt2(now.getMonth()+1)}/${now.getFullYear()} ${fmt2(now.getHours())}:${fmt2(now.getMinutes())}`, [now]);

  const nombreAdmin = useMemo(() => {
    if (!currentUser) return '';
    const seg = currentUser.segundo_nombre ? ` ${currentUser.segundo_nombre}` : '';
    return `${currentUser.nombre}${seg} ${currentUser.primer_apellido} ${currentUser.segundo_apellido}`.trim();
  }, [currentUser]);

  const validate = () => {
    const ui = {};
    if (!decision) ui.decision = 'Selecciona una resolución';
    if (comentario && comentario.length > 300) ui.comentario = 'Máximo 300 caracteres';
    if (decision && decision.toLowerCase().includes('denegar') && (!comentario || comentario.trim().length < 5)) ui.comentario = 'Explica el motivo (mínimo 5 caracteres)';
    setErrorsUI(ui);
    return Object.keys(ui).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) { setStatus({ type:'error', text:'Revisa los campos marcados.' }); return; }
    try{
      setStatus({ type:'info', text:'Enviando respuesta…' });
      const res = await fetch(`/api/justificaciones/${id}/responder`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ decision, comentario })});
      const j = await res.json(); if (!res.ok) throw new Error(j.error || 'Error en servidor');
      setStatus({ type:'success', text:'Respuesta enviada. Redirigiendo…' });
      setTimeout(()=>router.push(`/justificaciones/${id}`), 600);
    }catch(err){ console.error(err); setStatus({ type:'error', text:'No se pudo enviar la respuesta: ' + (err.message || String(err)) }); }
  };

  const onCancel = () => router.push(`/justificaciones/${id}`);

  return (
    <div className={`${styles.page} ${styles.pageEnter}`}>
      <div className={styles.statusBar} role="status" aria-live="polite">
        {status?.text && (<div className={`${styles.alert} ${status.type==='error'?styles.alertError: status.type==='success'?styles.alertSuccess:styles.alertInfo}`}>{status.text}</div>)}
      </div>
      <div className={styles.topbar}>
        <Link href={`/justificaciones/${id}`} className={styles.back}>⟵ Volver</Link>
        <div className={styles.title}>Responder justificación #{id}</div>
      </div>
      {loading ? (
        <div className={styles.skeletonGrid} aria-hidden>
          <div className={styles.skeletonCard}/><div className={styles.skeletonCard}/><div className={styles.skeletonCard}/>
        </div>
      ) : !row ? (
        <div className={styles.empty}>No se encontró la justificación.</div>
      ) : (
        <div className={`${styles.grid} ${styles.contentEnter}`}>
          <section className={styles.card}>
            <h3 className={styles.cardTitle}>Información</h3>
            <div className={styles.cardBody}>
              <div className={styles.meta}><span>Tipo</span><strong>{row.tipo_justificacion || '—'}</strong></div>
              <div className={styles.meta}><span>Fechas</span><strong>{row.fecha_inicio}{row.es_rango?` → ${row.fecha_fin}`:''}</strong></div>
              <div className={styles.meta}><span>Estado</span><strong>{row.estado || 'Pendiente'}</strong></div>
            </div>
          </section>
          <section className={styles.card}>
            <h3 className={styles.cardTitle}>Datos del funcionario</h3>
            <div className={styles.cardBody}>
              <div className={styles.meta}><span>Nombre</span><strong>{row.nombre_suscriptor || '—'}</strong></div>
              <div className={styles.meta}><span>Cédula</span><strong>{row.user_cedula || '—'}</strong></div>
              <div className={styles.meta}><span>Instancia</span><strong>{row.instancia || '—'}</strong></div>
            </div>
          </section>
          <section className={styles.card}>
            <h3 className={styles.cardTitle}>Resolución</h3>
            <div className={styles.cardBody}>
              <div className={styles.helper}>Fecha y hora: <strong>{fechaTxt}</strong>. Quien suscribe: <strong>{nombreAdmin || '—'}</strong>.</div>
              <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.field}>
                  <label className={styles.lbl} htmlFor="decision">Resolución <span className={styles.helpIcon} title="Selecciona el resultado de la evaluación">🛈</span></label>
                  <select id="decision" ref={selectRef} className={`${styles.select} ${errorsUI.decision?styles.invalid:''}`} value={decision} onChange={(e)=>setDecision(e.target.value)} aria-invalid={!!errorsUI.decision} aria-describedby={errorsUI.decision?'err-decision':undefined}>
                    <option>Aceptar con rebajo salarial parcial</option>
                    <option>Aceptar con rebajo salarial total</option>
                    <option>Aceptar sin rebajo salarial</option>
                    <option>Denegar lo solicitado</option>
                    <option>Acoger convocatioria</option>
                  </select>
                  {errorsUI.decision && <div id="err-decision" className={styles.error}>{errorsUI.decision}</div>}
                </div>
                <div className={styles.field}>
                  <label className={styles.lbl} htmlFor="comentario">Comentario <span className={styles.helpIcon} title="La justificación debe explicar el motivo en menos de 300 caracteres">🛈</span></label>
                  <textarea id="comentario" className={`${styles.textarea} ${errorsUI.comentario?styles.invalid:''}`} rows={4} value={comentario} onChange={(e)=>setComentario(e.target.value)} placeholder="Opcional" aria-invalid={!!errorsUI.comentario} aria-describedby={errorsUI.comentario?'err-comentario':undefined} />
                  <div className={styles.counter}>{(comentario||'').length}/300</div>
                  {errorsUI.comentario && <div id="err-comentario" className={styles.error}>{errorsUI.comentario}</div>}
                </div>
                <div className={styles.actionsBar}>
                  <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={()=>{ try{ localStorage.setItem(`responderDraft:just:${id}`, JSON.stringify({ decision, comentario })); setStatus({type:'success', text:'Borrador guardado.'}); }catch{} }}>Guardar borrador</button>
                  <div className={styles.spacer}/>
                  <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={()=>router.push(`/justificaciones/${id}`)}>Cancelar</button>
                  <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>Enviar respuesta</button>
                </div>
              </form>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

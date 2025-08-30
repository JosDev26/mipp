"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from './page.module.css';
// Helpers de días hábiles (copiados de formjustificacion)
function shiftYMD(ymd, days) {
  const [y, m, d] = ymd.split('-').map(n => parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}
function dayOfWeek(ymd) {
  const [y, m, d] = ymd.split('-').map(n => parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCDay();
}
function previousBusinessDaysCR(todayYMD, count = 2) {
  const res = [];
  let cur = todayYMD;
  while (res.length < count) {
    cur = shiftYMD(cur, -1);
    const dow = dayOfWeek(cur);
    if (dow >= 1 && dow <= 5) res.push(cur);
  }
  return res;
}
function crYMD() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date())
    .reduce((acc, p) => { if (p.type !== 'literal') acc[p.type] = p.value; return acc; }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import useCurrentUser from "../../lib/useCurrentUser";
import LoadingOverlay from '../../components/LoadingOverlay';


const fmt2 = (n) => String(n).padStart(2, "0");


export default function OmisionMarcaPage() {
  // Fechas permitidas: dos días hábiles anteriores (zona horaria CR)
  const [todayCR, setTodayCR] = useState(crYMD());
  useEffect(() => {
    (async () => {
      try {
        if (supabase && supabase.rpc) {
          const { data: todayData, error } = await supabase.rpc('get_today_cr');
          if (!error && todayData) setTodayCR(String(todayData));
        }
      } catch {}
    })();
  }, []);
  const prevBiz = useMemo(() => previousBusinessDaysCR(todayCR, 2), [todayCR]);
  const minAllowed = useMemo(() => (prevBiz.slice().sort()[0] || ''), [prevBiz]);
  const maxAllowed = useMemo(() => (prevBiz.slice().sort()[1] || prevBiz[0] || ''), [prevBiz]);
  const allowedSet = useMemo(() => new Set(prevBiz), [prevBiz]);

  const router = useRouter();
  const { user: currentUser, loading: authLoading } = useCurrentUser();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // { type, text }
  const [errorsList, setErrorsList] = useState([]);
  const summaryRef = useRef(null);
  const [form, setForm] = useState({
    fechaOmision: "",
    tipo: "Entrada", // Entrada | Salida | Todo el dia | Salida anticipada
    justificacion: "",
  });

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push("/login");
      return;
    }
  }, [authLoading, currentUser, router]);

  // Cargar usuario
  useEffect(() => {
    (async () => {
      if (!currentUser) return;
      const { data } = await supabase
        .from("users")
        .select(
          "cedula,nombre,segundo_nombre,primer_apellido,segundo_apellido,posicion,instancia"
        )
        .eq("cedula", currentUser.cedula)
        .maybeSingle();
      if (data) setUser(data);
    })();
  }, [currentUser]);

  const nombreCompleto = useMemo(() => {
    if (!user) return "";
    const seg = user.segundo_nombre ? ` ${user.segundo_nombre}` : "";
    return `${user.nombre}${seg} ${user.primer_apellido} ${user.segundo_apellido}`.trim();
  }, [user]);

  const [hoyTxt, setHoyTxt] = useState({ mes: "", anio: "", hora: "" });
  useEffect(() => {
    const now = new Date();
    const mes = fmt2(now.getMonth() + 1);
    const anio = String(now.getFullYear());
    const hora = `${fmt2(now.getHours())}:${fmt2(now.getMinutes())}`;
    setHoyTxt({ mes, anio, hora });
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = [];
    if (!form.fechaOmision) errs.push('Selecciona la fecha de la omisión');
    if (form.fechaOmision && !allowedSet.has(form.fechaOmision)) errs.push('La fecha debe estar dentro de los dos días hábiles anteriores');
    if (!form.justificacion) errs.push('Escribe la justificación');
    if (errs.length) {
      setErrorsList(errs);
      setStatus({ type: 'error', text: 'Corrige los campos marcados en rojo.' });
      setTimeout(() => summaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
      return;
    }
    setErrorsList([]);
    setStatus({ type: 'info', text: 'Enviando justificación…' });
    setLoading(true);
    try {
      const payload = {
        user_cedula: user?.cedula || null,
        nombre_suscriptor: nombreCompleto || null,
        posicion: user?.posicion || null,
        instancia: user?.instancia || null,
        fecha_omision: form.fechaOmision,
        tipo_omision: form.tipo,
        justificacion: form.justificacion,
      };
      const res = await fetch("/api/omisionmarca", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Error en servidor");
  setStatus({ type: 'success', text: 'Justificación de omisión enviada. Redirigiendo…' });
  setTimeout(() => router.push('/home'), 700);
    } catch (err) {
      console.error(err);
  setStatus({ type: 'error', text: 'Error: ' + (err.message || String(err)) });
    } finally {
      setLoading(false);
    }
  };

  const onCancel = () => {
    if (loading) return;
    const go = confirm('¿Deseas cancelar y salir? Los datos sin guardar se perderán.');
    if (go) router.push('/home');
  };

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        const btn = document.getElementById('btn-enviar-omision');
        if (btn && !btn.disabled) btn.click();
      }
      if (e.key === 'Escape') {
        const btn = document.getElementById('btn-cancelar-omision');
        if (btn) btn.click();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [loading]);

  return (
    <div className={styles.page}>
      <LoadingOverlay show={authLoading || (!!currentUser && !user)} text="Cargando datos del usuario…" />
      <div className={styles.statusBar} role="status" aria-live="polite">
        {status?.text && (
          <div className={`${styles.alert} ${
            status.type === 'error' ? styles.alertError :
            status.type === 'success' ? styles.alertSuccess : styles.alertInfo
          }`}>{status.text}</div>
        )}
      </div>
      <div className={styles.topbar}>
        <Link href="/home" className={styles.back}>⟵ Volver</Link>
      </div>
      <div className={styles.brandrow}>
        <div className={styles.brand}>MIPP+</div>
        <div className={styles.logos} aria-hidden><span /></div>
      </div>
      <div className={styles.titleBanner}>Justificar omisión de marca</div>

      {errorsList.length > 0 && (
        <div ref={summaryRef} className={styles.errorSummary} role="alert" aria-live="assertive">
          <strong>Revisa estos puntos:</strong>
          <ul>{errorsList.map((m, i) => <li key={i}>{m}</li>)}</ul>
        </div>
      )}

          {/* Bloque de presentación estilo formulariopermiso */}
          <div className={styles.presento}>
            {user ? (
              <div className={styles.chips}>
                <span>Quien se suscribe</span>
                <span className={styles.chip}>{nombreCompleto}</span>
                <span>, con cédula de identidad</span>
                <span className={styles.chip}>{user.cedula}</span>
                <span>, quien labora en la institución educativa</span>
                <span className={styles.chip}>CTP Mercedes Norte</span>
                <span>, en el puesto de</span>
                <span className={styles.chip}>{user.posicion}</span>
                <span>, en condición de</span>
                <span className={styles.chip}>{user.instancia}</span>
                <span>, solicita:</span>
              </div>
            ) : (
              <p>Inicia sesión para prellenar tus datos. <Link href="/login">Ir a login</Link></p>
            )}
          </div>

          <div className={styles.formCard}>
            <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.lbl}>Fecha de la omisión</label>
            <input className={styles.input} type="date" name="fechaOmision" value={form.fechaOmision} onChange={handleChange} required min={minAllowed} max={maxAllowed} />
          </div>

          <div className={styles.field}>
            <label className={styles.lbl}>Tipo</label>
            <select className={styles.select} name="tipo" value={form.tipo} onChange={handleChange}>
              <option>Entrada</option>
              <option>Salida</option>
              <option>Todo el dia</option>
              <option>Salida anticipada</option>
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.lbl}>Justificación</label>
            <textarea className={styles.textarea} name="justificacion" value={form.justificacion} onChange={handleChange} rows={5} required />
          </div>

          <div className={styles.footerLine}>
            Presento la justificación a las <strong>{hoyTxt.hora}</strong> del mes <strong>{hoyTxt.mes}</strong> del año <strong>{hoyTxt.anio}</strong> en Heredia, Mercedes Norte.
          </div>

          <div className={styles.actions}>
            <button id="btn-cancelar-omision" type="button" onClick={onCancel} className={`${styles.btn} ${styles.btnSecondary}`}>Cancelar</button>
            <button id="btn-enviar-omision" type="submit" disabled={loading} className={`${styles.btn} ${styles.btnPrimary}`}>
              {loading ? 'Enviando…' : 'Enviar'}
            </button>
          </div>
        </form>
      </div>
      <div className={styles.footerLine} style={{ marginTop: 12 }}>
        Atajo: Ctrl+Enter para enviar, Esc para cancelar.
      </div>
    </div>
  );
}

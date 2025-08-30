"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from './page.module.css';
import { useRouter } from 'next/navigation';
import { supabase } from "../../lib/supabaseClient";
import useCurrentUser from "../../lib/useCurrentUser";
import LoadingOverlay from '../../components/LoadingOverlay';
import dayjs from 'dayjs';
import { LocalizationProvider, TimePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';

const fmt2 = (n) => String(n).padStart(2, "0");

// Utilidades de fecha para Costa Rica
const crYMD = () => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date())
    .reduce((acc, p) => { if (p.type !== 'literal') acc[p.type] = p.value; return acc; }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
};
const shiftYMD = (ymd, days) => {
  const [y, m, d] = ymd.split('-').map(n => parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
};
// día de la semana para un YMD (0=Dom..6=Sáb) usando UTC para consistencia
const dayOfWeek = (ymd) => {
  const [y, m, d] = ymd.split('-').map(n => parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCDay();
};
// Obtiene los N días hábiles anteriores a hoy (CR), excluyendo sábados y domingos
const previousBusinessDaysCR = (todayYMD, count = 2) => {
  const res = [];
  let cur = todayYMD;
  while (res.length < count) {
    cur = shiftYMD(cur, -1);
    const dow = dayOfWeek(cur);
    if (dow >= 1 && dow <= 5) res.push(cur);
  }
  return res; // más reciente primero
};

export default function FormJustificacion() {
  const router = useRouter();
  const { user: currentUser, loading: authLoading } = useCurrentUser();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState(null); // users row
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorsUI, setErrorsUI] = useState({});
  const [misSolicitudes, setMisSolicitudes] = useState([]);

  const [conSolicitud, setConSolicitud] = useState(false);
  const [solicitudSel, setSolicitudSel] = useState("");

  const [form, setForm] = useState({
    tipoGeneral: "Salida", // Ausencia | Tardía | Salida | Incapacidad
    esRango: false,
    fecha: "",
    fechaFin: "",
    jornada: "Media", // Media | Completa
    horaInicio: "",
    horaFin: "",
    cantidad: "",
    unidad: "horas",
    horaSalida: "",
    tipoJustificacion: "Cita medica personal",
    familiar: "",
    observaciones: "",
  adjunto: null,
  });

  // Fechas permitidas (CR): dos días hábiles anteriores (ignora fines de semana)
  // Usa reloj de la BD (get_today_cr) para respetar offset de pruebas; fallback a crYMD local
  const [todayCR, setTodayCR] = useState(crYMD());
  useEffect(() => {
    (async () => {
      try {
        const { data: todayData, error } = await supabase.rpc('get_today_cr');
        if (!error && todayData) setTodayCR(String(todayData));
      } catch {}
    })();
  }, []);
  const prevBiz = useMemo(() => previousBusinessDaysCR(todayCR, 2), [todayCR]);
  const minAllowed = useMemo(() => (prevBiz.slice().sort()[0] || ''), [prevBiz]);
  const maxAllowed = useMemo(() => (prevBiz.slice().sort()[1] || prevBiz[0] || ''), [prevBiz]);
  const allowedSet = useMemo(() => new Set(prevBiz), [prevBiz]);

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push('/login');
      return;
    }
  }, [authLoading, currentUser, router]);

  // trigger mount animations once on client
  useEffect(() => { setMounted(true); }, []);

  // Load user profile
  useEffect(() => {
    (async () => {
      if (!currentUser) return;
      const { data } = await supabase
        .from('users')
        .select('cedula,nombre,segundo_nombre,primer_apellido,segundo_apellido,posicion,instancia')
        .eq('cedula', currentUser.cedula)
        .maybeSingle();
      if (data) setUser(data);
    })();
  }, [currentUser]);

  // Load my solicitudes for autofill when conSolicitud
  useEffect(() => {
    (async () => {
      if (!currentUser || !conSolicitud) return;
      const { data, error } = await supabase
        .from('solicitudes_permiso')
        .select('id, tipo_general, tipo_solicitud, es_rango, fecha_inicio, fecha_fin, jornada, hora_inicio, hora_fin, cantidad, unidad, hora_salida')
        .eq('user_cedula', currentUser.cedula)
        .order('id', { ascending: false })
        .limit(100);
      if (!error) setMisSolicitudes(data || []);
    })();
  }, [currentUser, conSolicitud]);

  const nombreCompleto = useMemo(() => {
    if (!user) return "";
    const seg = user.segundo_nombre ? ` ${user.segundo_nombre}` : "";
    return `${user.nombre}${seg} ${user.primer_apellido} ${user.segundo_apellido}`.trim();
  }, [user]);

  const isProfesor = useMemo(() => {
    const pos = (user?.posicion || '').toLowerCase();
    return pos.includes('profesor') || pos.includes('docente');
  }, [user]);

  useEffect(() => {
    setForm((p) => ({ ...p, unidad: isProfesor ? 'lecciones' : 'horas' }));
  }, [isProfesor]);

  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : files ? files[0] : value,
    }));
    // inline validation
    if (name === 'fecha') setErrorsUI(p => ({ ...p, fecha: value ? undefined : 'Selecciona la fecha inicio' }));
    if (name === 'fechaFin') setErrorsUI(p => ({ ...p, fechaFin: value ? undefined : 'Selecciona la fecha fin' }));
    if (name === 'cantidad') {
      const n = Number(value);
      setErrorsUI(p => ({ ...p, cantidad: value && (!Number.isFinite(n) || n <= 0) ? 'Debe ser un número positivo' : undefined }));
    }
  };

  // HH:MM helpers for picker values
  const toHHMM = (d) => (d && dayjs.isDayjs(d)) ? `${fmt2(d.hour())}:${fmt2(d.minute())}` : '';
  const fromHHMM = (s) => {
    if (!s) return null;
    const [h, m] = String(s).split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return dayjs().hour(h).minute(m).second(0).millisecond(0);
  };
  const minTimeDJ = () => dayjs().hour(7).minute(0).second(0).millisecond(0);
  const maxTimeDJ = () => dayjs().hour(16).minute(30).second(0).millisecond(0);

  const toggleFechaModo = () => setForm((p) => ({ ...p, esRango: !p.esRango }));
  const toggleJornada = () => setForm((p) => ({
    ...p,
    jornada: p.jornada === 'Media' ? 'Completa' : 'Media',
    horaSalida: p.jornada === 'Media' ? '' : p.horaSalida,
  }));

  // When selecting a solicitud to justify, autofill fields
  const handleSelectSolicitud = (e) => {
    const val = e.target.value;
    setSolicitudSel(val);
    // If user resets to default option, clear previously auto-filled fields
    if (!val) {
      setForm((p) => ({
        ...p,
        tipoGeneral: 'Salida',
        esRango: false,
        fecha: '',
        fechaFin: '',
        jornada: 'Media',
        horaInicio: '',
        horaFin: '',
        cantidad: '',
        unidad: (isProfesor ? 'lecciones' : 'horas'),
        horaSalida: '',
        tipoJustificacion: 'Cita medica personal',
      }));
      return;
    }
    const s = misSolicitudes.find(r => String(r.id) === String(val));
    if (!s) return;
    // Última fecha debe corresponder a uno de los dos días hábiles anteriores (CR)
    const lastDateStr = s.es_rango ? (s.fecha_fin || s.fecha_inicio) : s.fecha_inicio;
    const isAllowedCRDay = allowedSet.has(String(lastDateStr));
    if (!isAllowedCRDay){
      alert('Esta solicitud está fuera de plazo (no corresponde a los dos días hábiles anteriores). No puede justificarse.');
      setSolicitudSel('');
      return;
    }
    setForm((p) => ({
      ...p,
      tipoGeneral: s.tipo_general || p.tipoGeneral,
      esRango: !!s.es_rango,
      fecha: s.fecha_inicio || p.fecha,
      fechaFin: s.fecha_fin || p.fechaFin,
      jornada: s.jornada || p.jornada,
      horaInicio: s.hora_inicio || p.horaInicio,
      horaFin: s.hora_fin || p.horaFin,
      cantidad: s.cantidad != null ? String(s.cantidad) : p.cantidad,
      unidad: s.unidad || p.unidad,
      horaSalida: s.hora_salida || p.horaSalida,
      tipoJustificacion: [
        'Cita medica personal',
        'Acompañar a cita familiar',
        'Asistencia a convocatoria',
        'Atención de asuntos personales'
      ].includes(s.tipo_solicitud) ? s.tipo_solicitud : p.tipoJustificacion,
    }));
  };

  const validate = () => {
    const errors = [];
    if (!form.fecha) errors.push('Selecciona la fecha inicio que justificas');
    if (form.esRango && !form.fechaFin) errors.push('Selecciona la fecha fin que justificas');
    // Rango válido: fin >= inicio
    if (form.esRango && form.fecha && form.fechaFin) {
      if (new Date(form.fecha) > new Date(form.fechaFin)) errors.push('La fecha fin no puede ser anterior a la fecha inicio');
    }
  // Solo dos días hábiles anteriores (CR)
  if (form.fecha && !allowedSet.has(form.fecha)) errors.push('La fecha inicio debe ser uno de los dos días hábiles anteriores (zona horaria Costa Rica)');
  if (form.esRango && form.fechaFin && !allowedSet.has(form.fechaFin)) errors.push('La fecha fin debe ser uno de los dos días hábiles anteriores (zona horaria Costa Rica)');
    if (form.jornada === 'Media') {
      if (!form.horaInicio || !form.horaFin) errors.push('Rango de horas requerido para media jornada');
    }
    if (['Cita medica personal','Asistencia a convocatoria','Acompañar a cita familiar'].includes(form.tipoJustificacion)) {
      if (!form.adjunto) errors.push('Debes adjuntar un documento de respaldo');
    }
    if (form.tipoJustificacion === 'Acompañar a cita familiar' && !form.familiar) {
      errors.push('Selecciona el familiar');
    }
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
  const errs = validate();
    if (errs.length) { alert(errs.join('\n')); return; }
    setLoading(true);

    // Upload file if exists
    let adjunto_url = null, adjunto_path = null, adjunto_mime = null;
    try {
      if (form.adjunto) {
        const file = form.adjunto;
        adjunto_mime = file.type || null;
        const fd = new FormData();
        fd.append('file', file);
        fd.append('cedula', user?.cedula || 'anon');
        setUploading(true);
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        if (!res.ok) throw new Error(await res.text());
        const j = await res.json();
        adjunto_url = j.publicUrl || null;
        adjunto_path = j.path || null;
      }
    } catch (err) {
      console.error('upload error', err);
      alert('No se pudo subir el adjunto: ' + (err.message || String(err)));
      setLoading(false);
      return;
    } finally { setUploading(false); }

    const payload = {
      linked_solicitud_id: conSolicitud && solicitudSel ? Number(solicitudSel) : null,
      user_cedula: user?.cedula || null,
      nombre_suscriptor: nombreCompleto || null,
      posicion: user?.posicion || null,
      instancia: user?.instancia || null,
      tipo_general: form.tipoGeneral,
      tipo_justificacion: form.tipoJustificacion,
      es_rango: !!form.esRango,
      fecha_inicio: form.fecha,
      fecha_fin: form.esRango ? form.fechaFin : form.fecha,
      jornada: form.jornada,
      hora_inicio: form.jornada === 'Media' ? form.horaInicio : null,
      hora_fin: form.jornada === 'Media' ? form.horaFin : null,
      cantidad: form.cantidad ? Number(form.cantidad) : null,
      unidad: form.cantidad ? (form.unidad === 'lecciones' ? 'lecciones' : 'horas') : null,
  hora_salida: form.jornada === 'Media' ? (form.horaSalida || null) : null,
      observaciones: form.observaciones || null,
      familiar: form.tipoJustificacion === 'Acompañar a cita familiar' ? form.familiar || null : null,
      adjunto_url, adjunto_path, adjunto_mime,
    };

    try {
      const res = await fetch('/api/justificaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Error en servidor');
      if (form.tipoJustificacion === 'Atención de asuntos personales') {
        alert('Justificación enviada. Recuerda hablar con Doña Laura.');
      } else {
        alert('Justificación enviada.');
      }
      router.push('/home');
    } catch (err) {
      console.error(err);
      alert('Error enviando la justificación: ' + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  const onCancel = () => {
    if (loading || uploading) return;
    const go = confirm('¿Deseas cancelar y salir? Los datos sin guardar se perderán.');
    if (go) router.push('/home');
  };

  const submitDisabled = loading || uploading || !form.fecha || (form.esRango && !form.fechaFin) || (form.jornada === 'Media' && (!form.horaInicio || !form.horaFin));

  // keyboard shortcuts: Ctrl+Enter to enviar, Esc to cancelar
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        const btn = document.getElementById('btn-enviar-justificacion');
        if (btn && !btn.disabled) btn.click();
      }
      if (e.key === 'Escape') {
        const btn = document.getElementById('btn-cancelar-justificacion');
        if (btn) btn.click();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [loading, uploading]);

  return (
    <div className={`${styles.page} ${styles.pageEnter}`}>
      <LoadingOverlay show={authLoading || (!!currentUser && !user)} text="Cargando datos del usuario…" />
      <div className={styles.topbar}>
        <Link href="/home" className={styles.back}>⟵ Volver</Link>
        <a href="#ayuda" className={styles.helpLink} title="Ver ayuda y preguntas frecuentes">Ayuda / FAQ</a>
      </div>
      <div className={styles.brandrow}>
        <div className={styles.brand}>MIPP+</div>
        <div className={styles.logos} aria-hidden><span /></div>
      </div>
      <div className={styles.titleBanner}>Formulario de Justificación de Inasistencia, Tardía o Salida</div>
      <p className={styles.note}>
        Recuerda justificar dentro de las 48 horas hábiles posteriores. Adjunta soporte si corresponde (citas, convocatorias), y completa con precisión las horas.
      </p>
      <hr className={styles.divider} />

      <div className={styles.presento}>
        {user ? (
          <div className={styles.chips}>
            <span>Quien se suscribe</span>
            <span className={styles.chip}>{nombreCompleto}</span>
            <span>, con cédula</span>
            <span className={styles.chip}>{user.cedula}</span>
            <span>, puesto</span>
            <span className={styles.chip}>{user.posicion}</span>
            <span>, condición</span>
            <span className={styles.chip}>{user.instancia}</span>
            <span>.</span>
          </div>
        ) : (
          <p>Inicia sesión para prellenar tus datos.</p>
        )}
      </div>

  <form onSubmit={handleSubmit} className={`${styles.formCard} ${mounted ? styles.animMount : ''}`}>
        {/* Con o sin solicitud */}
        <div className={styles.field}>
          <label className={styles.lbl}>¿Justifica una solicitud existente?</label>
          <div className={styles.row}>
            <label><input type="radio" name="conSolicitud" checked={conSolicitud} onChange={() => setConSolicitud(true)} /> Sí</label>
            <label><input type="radio" name="conSolicitud" checked={!conSolicitud} onChange={() => setConSolicitud(false)} /> No</label>
          </div>
          {conSolicitud && (
            <div className={styles.field}>
              <label className={styles.lbl}>Selecciona la solicitud</label>
              <select value={solicitudSel} onChange={handleSelectSolicitud} className={styles.select}>
                <option value="">-- Selecciona --</option>
                {misSolicitudes.map(s => {
                  const lastDateStr = s.es_rango ? (s.fecha_fin || s.fecha_inicio) : s.fecha_inicio;
                  const outOfWindow = !allowedSet.has(String(lastDateStr));
                  const label = `#${s.id} • ${s.fecha_inicio}${s.es_rango ? ` → ${s.fecha_fin}` : ''} • ${s.jornada}${s.hora_inicio ? ` (${s.hora_inicio}${s.hora_fin ? ` - ${s.hora_fin}` : ''})` : ''}${outOfWindow ? ' • (fuera de plazo)' : ''}`;
                  return (
                    <option key={s.id} value={s.id} disabled={outOfWindow}>{label}</option>
                  );
                })}
              </select>
              <div className={styles.help}>Al seleccionar, se autorellenan los campos.</div>
            </div>
          )}
        </div>

        {/* Tipo general */}
        <div className={styles.field}>
          <label className={styles.lbl}>Tipo</label>
          <select name="tipoGeneral" value={form.tipoGeneral} onChange={handleChange} className={styles.select}>
            <option>Salida</option>
            <option>Ausencia</option>
            <option>Tardía</option>
            <option>Incapacidad</option>
          </select>
        </div>

        {/* Barra de jornada arriba de fecha y horas */}
        <div className={styles.grid}>
          <div className={`${styles.field} ${styles['span-12']}`}>
            <div className={styles.jornadaBar}>
              <span className={styles.lbl} style={{ marginBottom: 0 }}>Tipo de jornada</span>
              <div className={styles.switchWrap} role="group" aria-label="Tipo de jornada">
                <span className={styles.switchLabel}>Media jornada</span>
                <label className={styles.switch} title={form.jornada === 'Media' ? 'Cambiar a jornada completa' : 'Cambiar a media jornada'}>
                  <input type="checkbox" aria-checked={form.jornada === 'Completa'} checked={form.jornada === 'Completa'} onChange={toggleJornada} />
                  <span className={styles.slider} />
                </label>
                <span className={styles.switchLabel}>Jornada completa</span>
              </div>
            </div>
          </div>

          {/* Tipo de fecha (switch estilo permisos) */}
          <div className={`${styles.field} ${styles['span-12']}`}>
            <div className={styles.jornadaBar}>
              <span className={styles.lbl} style={{ marginBottom: 0 }}>Tipo de fecha</span>
              <div className={styles.switchWrap} role="group" aria-label="Tipo de fecha">
                <span className={styles.switchLabel}>Solo una fecha</span>
                <label className={styles.switch} title={form.esRango ? 'Cambiar a una sola fecha' : 'Cambiar a varias fechas'}>
                  <input type="checkbox" aria-checked={form.esRango} checked={form.esRango} onChange={toggleFechaModo} />
                  <span className={styles.slider} />
                </label>
                <span className={styles.switchLabel}>Varias fechas</span>
              </div>
            </div>
          </div>

          {/* Fecha o rango */}
          <div className={`${styles.field} ${styles[form.esRango ? 'span-6' : 'span-4']}`}>
            <label className={styles.lbl}>Fecha inicio</label>
            <input type="date" name="fecha" value={form.fecha} onChange={handleChange} required className={styles.input} min={minAllowed} max={maxAllowed} />
            {errorsUI.fecha && <div className={styles.error}>{errorsUI.fecha}</div>}
          </div>
          {form.esRango && (
            <div className={`${styles.field} ${styles['span-6']}`}>
              <label className={styles.lbl}>Fecha fin</label>
              <input type="date" name="fechaFin" value={form.fechaFin} onChange={handleChange} required className={styles.input} min={form.fecha || minAllowed} max={maxAllowed} />
              {errorsUI.fechaFin && <div className={styles.error}>{errorsUI.fechaFin}</div>}
            </div>
          )}
        </div>

        {/* Jornada y horas */}
        <div className={styles.grid}>
          {form.jornada === 'Media' && (
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <div className={`${styles.field} ${styles['span-6']}`}>
                <label className={styles.lbl}>Hora inicio</label>
                  <TimePicker
                    ampm
                    minutesStep={5}
                    value={fromHHMM(form.horaInicio)}
                    onChange={(v) => setForm((p) => ({ ...p, horaInicio: toHHMM(v) }))}
                    minTime={minTimeDJ()}
                    maxTime={maxTimeDJ()}
                    slotProps={{ textField: { required: true, size:'small' } }}
                  />
              </div>
              <div className={`${styles.field} ${styles['span-6']}`}>
                <label className={styles.lbl}>Hora fin</label>
                  <TimePicker
                    ampm
                    minutesStep={5}
                    value={fromHHMM(form.horaFin)}
                    onChange={(v) => setForm((p) => ({ ...p, horaFin: toHHMM(v) }))}
                    minTime={fromHHMM(form.horaInicio) || minTimeDJ()}
                    maxTime={maxTimeDJ()}
                    slotProps={{ textField: { required: true, size:'small' } }}
                  />
              </div>
              <div className={`${styles.field} ${styles['span-6']}`}>
                <label className={styles.lbl}>Hora de salida</label>
                  <TimePicker
                    ampm
                    minutesStep={5}
                    value={fromHHMM(form.horaSalida)}
                    onChange={(v) => setForm((p) => ({ ...p, horaSalida: toHHMM(v) }))}
                    minTime={minTimeDJ()}
                    maxTime={maxTimeDJ()}
                  />
              </div>
            </LocalizationProvider>
          )}
        </div>

        {/* Cantidad */}
        <div className={styles.grid}>
          <div className={`${styles.field} ${styles['span-6']}`}>
            <label className={styles.lbl}>{isProfesor ? 'Cantidad de lecciones' : 'Cantidad de horas'}</label>
            <input className={styles.input} type="number" name="cantidad" value={form.cantidad} onChange={handleChange} min={0} step={1} />
            {errorsUI.cantidad && <div className={styles.error}>{errorsUI.cantidad}</div>}
          </div>
          <div className={`${styles.field} ${styles['span-6']}`}>
            <label className={styles.lbl}>Unidad</label>
            <input className={styles.input} value={isProfesor ? 'lecciones' : 'horas'} readOnly />
            <div className={styles.help}>Se autodefine según tu puesto.</div>
          </div>
        </div>

        {/* Tipo de justificación */}
        <div className={styles.field}>
          <label className={styles.lbl}>Tipo de justificación</label>
          <select name="tipoJustificacion" value={form.tipoJustificacion} onChange={handleChange} className={styles.select}>
            <option>Cita medica personal</option>
            <option>Acompañar a cita familiar</option>
            <option>Asistencia a convocatoria</option>
            <option>Atención de asuntos personales</option>
          </select>
        </div>

        {/* Dependiente del tipo */}
        {form.tipoJustificacion === 'Acompañar a cita familiar' && (
          <div className={styles.field}>
            <label className={styles.lbl}>Familiar</label>
            <select name="familiar" value={form.familiar} onChange={handleChange} className={styles.select}>
              <option value="">Seleccione</option>
              <option>Padre</option>
              <option>Madre</option>
              <option>Hijos menores de edad</option>
              <option>Esposo/a</option>
              <option>Conyugue</option>
              <option>Hijos discapacitados</option>
            </select>
            {errorsUI.familiar && <div className={styles.error}>{errorsUI.familiar}</div>}
          </div>
        )}

        {['Cita medica personal','Asistencia a convocatoria','Acompañar a cita familiar'].includes(form.tipoJustificacion) && (
          <div className={styles.field}>
            <label className={styles.lbl}>Adjuntar documento</label>
            <input className={styles.input} type="file" name="adjunto" accept=".pdf,.doc,.docx,image/*" onChange={handleChange} />
            <span className={styles.hint}>
              {uploading ? <span className={styles.spinnerInline} aria-hidden /> : null}
              {uploading ? 'Subiendo documento…' : 'Se permiten imágenes (JPG, PNG), PDF y Word'}
            </span>
            {errorsUI.adjunto && <div className={styles.error}>{errorsUI.adjunto}</div>}
          </div>
        )}

        {/* Observaciones */}
        <div className={`${styles.field} ${styles['span-12']}`}>
          <label className={styles.lbl}>Observaciones (opcional)</label>
          <textarea name="observaciones" value={form.observaciones} onChange={handleChange} rows={4} className={styles.textarea} />
        </div>

        {/* Texto de presentación (igual que permisos) */}
        <div className={styles.footerLine}>
          {(() => {
            const now = new Date();
            const hora = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
            const dia = String(now.getDate()).padStart(2,'0');
            const mes = String(now.getMonth()+1).padStart(2,'0');
            const anio = now.getFullYear();
            return (
              <>Presento la justificación a las <strong>{hora}</strong> del día <strong>{dia}</strong> del mes <strong>{mes}</strong> del año <strong>{anio}</strong>.</>
            );
          })()}
        </div>

        {/* Acciones */}
        <div className={styles.actions}>
          <button id="btn-cancelar-justificacion" type="button" onClick={onCancel} className={`${styles.btn} ${styles.btnSecondary}`}>Cancelar</button>
          <button id="btn-enviar-justificacion" type="submit" disabled={submitDisabled} className={`${styles.btn} ${styles.btnPrimary}`}>
            {(loading || uploading) ? 'Procesando…' : 'Enviar justificación'}
          </button>
        </div>
      </form>

      {/* Ayuda / FAQ */}
      <section id="ayuda" className={styles.faqCard} aria-labelledby="faq-title-just">
        <h2 id="faq-title-just" className={styles.faqTitle}>Ayuda rápida y preguntas frecuentes</h2>
        <div className={styles.faqList}>
          <details className={styles.faqItem}>
            <summary>¿Qué se puede justificar?</summary>
            <div className={styles.faqContent}>Ausencias, tardías y salidas, dentro de las 48 horas hábiles.</div>
          </details>
          <details className={styles.faqItem}>
            <summary>¿Cuándo adjuntar documentos?</summary>
            <div className={styles.faqContent}>Para citas médicas, convocatorias o acompañamiento familiar, adjunta el comprobante.</div>
          </details>
          <details className={styles.faqItem}>
            <summary>¿Cómo ingreso las horas?</summary>
            <div className={styles.faqContent}>Usa el selector de hora. Para media jornada, completa inicio y fin; para completa no se requieren horas.</div>
          </details>
        </div>
      </section>
    </div>
  );
}

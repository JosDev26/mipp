"use client"

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
// Head removido; la fuente se aplica globalmente desde layout
import styles from './page.module.css';
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from 'next/navigation';
import useCurrentUser from '../../lib/useCurrentUser';
import LoadingOverlay from '../../components/LoadingOverlay';
import dayjs from 'dayjs';
import { LocalizationProvider, TimePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';

// Helper de fechas
const toDate = (s) => (s ? new Date(`${s}T00:00:00`) : null);
const fmt2 = (n) => String(n).padStart(2, "0");
// Rango horario permitido
const TIME_MIN = '07:00';
const TIME_MAX = '16:30';
const STEP_MINUTES = 5; // salto mínimo entre horas
const toMin = (hhmm) => {
  if (!hhmm) return null;
  const [h, m] = String(hhmm).split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};
const fmtHHMM = (mins) => `${fmt2(Math.floor(mins / 60))}:${fmt2(mins % 60)}`;
// 12h label helper (for potential aria/labels)
const fmt12 = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  const am = h < 12;
  const h12 = ((h % 12) || 12);
  return `${h12}:${fmt2(m)} ${am ? 'AM' : 'PM'}`;
};
const clampTime = (hhmm) => {
  const v = toMin(hhmm);
  if (v == null) return TIME_MIN;
  return fmtHHMM(Math.min(Math.max(v, toMin(TIME_MIN)), toMin(TIME_MAX)));
};
const addMin = (hhmm, delta) => fmtHHMM(Math.min(Math.max(toMin(hhmm) + delta, toMin(TIME_MIN)), toMin(TIME_MAX)));
const normalizeTimes = (start, end) => {
  let s = clampTime(start);
  let e = clampTime(end);
  const sMin = toMin(s);
  let eMin = toMin(e);
  if (eMin <= sMin) {
    // forzar fin a ser posterior al inicio
    e = addMin(s, STEP_MINUTES);
    eMin = toMin(e);
    if (eMin <= sMin) {
      // si no se puede (p.ej. inicio en MAX), retrocede inicio
      s = addMin(e, -STEP_MINUTES);
    }
  }
  return { s, e };
};
const addDaysYMD = (ymd, days) => {
  if (!ymd) return '';
  const [y, m, d] = String(ymd).split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${fmt2(dt.getUTCMonth() + 1)}-${fmt2(dt.getUTCDate())}`;
};

// Dayjs helpers to map HH:MM strings to picker values and back
const toDayjsFromHHMM = (hhmm) => {
  if (!hhmm) return null;
  const [h, m] = String(hhmm).split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return dayjs().hour(h).minute(m).second(0).millisecond(0);
};
const toHHMMFromDayjs = (d) => {
  if (!d || !dayjs.isDayjs(d)) return '';
  return `${fmt2(d.hour())}:${fmt2(d.minute())}`;
};
const minTimeDJ = () => dayjs().hour(7).minute(0).second(0).millisecond(0);
const maxTimeDJ = () => dayjs().hour(16).minute(30).second(0).millisecond(0);

export default function SolicitudPermiso() {
  const router = useRouter();
  const { user: currentUser, roles, loading: authLoading } = useCurrentUser();
  const [user, setUser] = useState(null); // {cedula, nombre, apellidos, posicion, instancia}
  const [loading, setLoading] = useState(false);
  const [errorsUI, setErrorsUI] = useState({});
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState(null); // { type:'info'|'success'|'error', text:string }
  const [errorsList, setErrorsList] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const summaryRef = useRef(null);

  const [form, setForm] = useState({
    tipoGeneral: "Salida", // Salida | Ausencia | Tardía | Incapacidad
    esRango: false,
    fecha: "",
    fechaFin: "",
    horaInicio: "",
    horaFin: "",
    jornada: "Media", // Media | Completa
  tipoSolicitud: "Asuntos medicos personales",
    familiar: "",
    cantidad: "",
    unidad: "horas", // horas | lecciones
    observaciones: "",
    horaSalida: "",
    adjunto: null,
  });

  // Guardado temporal
  useEffect(() => {
    try { localStorage.setItem("permisoFormDraft", JSON.stringify(form)); } catch {}
  }, [form]);

  // Cargar borrador desde localStorage solo en cliente (evitar leer en el initializer)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("permisoFormDraft");
      if (saved) setForm(JSON.parse(saved));
    } catch {}
  }, []);

  // Migrar valor antiguo de motivo si viene del borrador
  useEffect(() => {
    setForm((prev) => {
      if (!prev) return prev;
      if (prev.tipoSolicitud === 'Cita medica personal') {
        return { ...prev, tipoSolicitud: 'Asuntos medicos personales' };
      } else if (prev.tipoSolicitud === 'Acompañar a cita familiar') {
        return { ...prev, tipoSolicitud: 'Asuntos medicos familiares' };
      } else if (prev.tipoSolicitud === 'Atención de asuntos familiares') {
        // Revertimos al nombre original solicitado
        return { ...prev, tipoSolicitud: 'Atención de asuntos personales' };
      }
      return prev;
    });
  }, []);

  // Enforce jornada constraints when tipoGeneral is Tardía or Incapacidad (also covers drafts)
  useEffect(() => {
    setForm((prev) => {
      if (!prev) return prev;
      if (prev.tipoGeneral === 'Incapacidad' && prev.jornada !== 'Completa') {
        return { ...prev, jornada: 'Completa', horaSalida: '' };
      }
      if (prev.tipoGeneral === 'Tardía' && prev.jornada !== 'Media') {
        const next = { ...prev, jornada: 'Media' };
        next.horaInicio = next.horaInicio || TIME_MIN;
        next.horaFin = next.horaFin || addMin(next.horaInicio, STEP_MINUTES);
        const { s, e } = normalizeTimes(next.horaInicio, next.horaFin);
        next.horaInicio = s; next.horaFin = e;
        return next;
      }
      return prev;
    });
  }, [form.tipoGeneral]);

  // Usar /api/me para rellenar usuario una vez autenticado
  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push('/login');
      return;
    }
    if (currentUser) {
      (async () => {
        try {
          const { data, error } = await supabase
            .from("users")
            .select("cedula,nombre,segundo_nombre,primer_apellido,segundo_apellido,posicion,instancia")
            .eq("cedula", currentUser.cedula)
            .maybeSingle();
          if (!error && data) setUser(data);
        } catch (err) {
          console.error('load user error', err);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, authLoading]);

  const nombreCompleto = useMemo(() => {
    if (!user) return "";
    const seg = user.segundo_nombre ? ` ${user.segundo_nombre}` : "";
    return `${user.nombre}${seg} ${user.primer_apellido} ${user.segundo_apellido}`.trim();
  }, [user]);

  const [hoyTxt, setHoyTxt] = useState({ dia: '', mes: '', anio: '', hora: '' });
  useEffect(() => {
    const now = new Date();
    const dia = fmt2(now.getDate());
    const mes = fmt2(now.getMonth() + 1);
    const anio = now.getFullYear();
    const hora = `${fmt2(now.getHours())}:${fmt2(now.getMinutes())}`;
    setHoyTxt({ dia, mes, anio, hora });
  }, []);

  // YYYY-MM-DD de hoy para min en inputs de fecha
  const todayYMD = useMemo(() => {
    const n = new Date();
    return `${n.getFullYear()}-${fmt2(n.getMonth() + 1)}-${fmt2(n.getDate())}`;
  }, []);

  // UI helpers
  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    setForm((prev) => {
      let next = { ...prev, [name]: type === "checkbox" ? checked : files ? files[0] : value };
      // Si selecciona Incapacidad o Tardía, forzar jornada
      if (name === 'tipoGeneral') {
        if (value === 'Incapacidad') {
          // Incapacidad => Jornada completa
          next.jornada = 'Completa';
          // Limpiar hora de salida (no aplica en completa)
          next.horaSalida = '';
        } else if (value === 'Tardía') {
          // Tardía => Solo media jornada
          next.jornada = 'Media';
          // Asegurar horas válidas por si no existían
          next.horaInicio = next.horaInicio || TIME_MIN;
          next.horaFin = next.horaFin || addMin(next.horaInicio, STEP_MINUTES);
          const { s, e } = normalizeTimes(next.horaInicio, next.horaFin);
          next.horaInicio = s; next.horaFin = e;
        }
      }
      // Si cambia a otro tipo, no forzar (mantener lo que tenía)
      return next;
    });
    // simple inline validation triggers for key fields
    if (name === 'fecha') {
      if (!value) setErrorsUI((p) => ({ ...p, fecha: 'Selecciona la fecha de inicio' }));
      else setErrorsUI((p) => ({ ...p, fecha: undefined }));
    }
    if (name === 'cantidad') {
      const n = Number(value);
      setErrorsUI((p) => ({ ...p, cantidad: value && (!Number.isFinite(n) || n <= 0) ? 'Debe ser un número positivo' : undefined }));
    }
  };

  const toggleFechaModo = () => setForm((p) => ({ ...p, esRango: !p.esRango }));
  const toggleJornada = () => setForm((p) => {
    const next = { ...p };
    next.jornada = p.jornada === 'Media' ? 'Completa' : 'Media';
    if (next.jornada === 'Media') {
      // set defaults if missing and ensure start < end
      next.horaInicio = next.horaInicio || TIME_MIN;
      next.horaFin = next.horaFin || addMin(next.horaInicio, STEP_MINUTES);
      const { s, e } = normalizeTimes(next.horaInicio, next.horaFin);
      next.horaInicio = s; next.horaFin = e;
    } else {
  // Limpiar hora de salida cuando es jornada completa
  next.horaSalida = '';
    }
    return next;
  });

  // Reglas anti-errores y helpers
  const validate = () => {
    const errors = [];
    const start = toDate(form.fecha);
    const end = form.esRango ? toDate(form.fechaFin) : start;
    const today = new Date();
    const in3Days = new Date(); in3Days.setDate(in3Days.getDate() + 3);
    const in1Year = new Date(); in1Year.setFullYear(in1Year.getFullYear() + 1);

    if (!start) errors.push("Selecciona la fecha de inicio");
    if (form.esRango && !end) errors.push("Selecciona la fecha fin");
    if (start && start < today.setHours(0,0,0,0)) errors.push("No se permite fecha pasada");
    if (start && start < in3Days.setHours(0,0,0,0)) errors.push("Debe solicitar con al menos 3 días de anticipación");
    if (start && start > in1Year) errors.push("La fecha no puede superar 1 año");
    if (end && end > in1Year) errors.push("La fecha fin no puede superar 1 año");
  if (form.esRango && start && end && end <= start) errors.push("La fecha fin debe ser posterior a la fecha inicio");
  else if (start && end && end < start) errors.push("La fecha fin no puede ser anterior al inicio");

    // horas
    if (form.jornada === "Media") {
      if (!form.horaInicio || !form.horaFin) errors.push("Rango de horas requerido");
      const startMin = toMin(form.horaInicio || TIME_MIN);
      const endMin = toMin(form.horaFin || TIME_MIN);
      // dentro del rango permitido
      if (startMin < toMin(TIME_MIN) || startMin > toMin(TIME_MAX) || endMin < toMin(TIME_MIN) || endMin > toMin(TIME_MAX)) {
        errors.push(`Las horas deben estar entre ${TIME_MIN} y ${TIME_MAX}`);
      }
      // orden y diferencia mínima
      if (endMin <= startMin) errors.push(`La hora fin debe ser posterior a inicio (mínimo ${STEP_MINUTES} min)`);
      if (endMin - startMin > 240) errors.push("Media jornada es hasta 4 horas");
    }

    // adjuntos según tipo
  if (form.tipoSolicitud === "Asuntos medicos personales" || form.tipoSolicitud === "Asistencia a convocatoria") {
      if (!form.adjunto) errors.push("Debes adjuntar un documento de respaldo");
    }

    // familiar requerido cuando acompaña a familiar
  if (form.tipoSolicitud === "Asuntos medicos familiares" && !form.familiar) {
      errors.push("Selecciona el familiar");
    }

    // campos profesor/funcionario
    if (form.cantidad && Number(form.cantidad) <= 0) errors.push("Cantidad debe ser positiva");

    // reflect first errors near fields
    const ui = {};
    for (const msg of errors) {
      if (msg.includes('fecha')) ui.fecha = ui.fecha || msg;
      if (msg.includes('hora')) ui.hora = ui.hora || msg;
      if (msg.includes('adjuntar') || msg.includes('documento')) ui.adjunto = ui.adjunto || msg;
      if (msg.includes('Cantidad')) ui.cantidad = ui.cantidad || msg;
      if (msg.includes('familiar')) ui.familiar = ui.familiar || msg;
    }
    setErrorsUI(ui);
    return errors;
  };

  const horaCompacta = () => {
    if (form.jornada === "Completa") return "JORNADA"; // <= 10 chars
    const raw = form.horaInicio ? (form.horaFin ? `${form.horaInicio}-${form.horaFin}` : form.horaInicio) : null;
    return raw ? raw.replace(/:/g, "") : null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (errs.length) {
      setErrorsList(errs);
      setStatus({ type: 'error', text: 'Corrige los campos marcados en rojo.' });
      setTimeout(() => summaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
      return;
    }
    setErrorsList([]);
    setStatus({ type: 'info', text: 'Enviando solicitud…' });
    setLoading(true);

    // Preparar payload compatible con `solicitudes_permiso`
    const fecha_inicio = form.fecha;
    const fecha_fin = form.esRango ? form.fechaFin : form.fecha;
    const horaValue = horaCompacta();
    if (horaValue && horaValue.length > 10) { setLoading(false); alert("Rango de horas demasiado largo"); return; }

    const cedula = user?.cedula || "";
    if (cedula && cedula.length > 20) { setLoading(false); alert("La cédula supera el límite de 20 caracteres para 'user_cedula'"); return; }

    // Subir adjunto si existe
  let adjunto_url = null;
  let adjunto_path = null;
    let adjunto_mime = null;
  try {
      if (form.adjunto) {
        const file = form.adjunto;
        adjunto_mime = file.type || null;
        const fd = new FormData();
        fd.append('file', file);
        fd.append('cedula', cedula || 'anon');
    setUploading(true);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || 'upload failed');
        }
  const j = await res.json();
  adjunto_url = j.publicUrl || null;
  adjunto_path = j.path || null;
      }
    } catch (uploadErr) {
      console.error('Upload error:', uploadErr);
      setStatus({ type: 'error', text: 'No se pudo subir el adjunto. ' + (uploadErr.message || String(uploadErr)) });
      setLoading(false);
      return;
  } finally { setUploading(false); }

    const payload = {
      user_cedula: cedula,
      nombre_solicitante: nombreCompleto,
      posicion: user?.posicion || '',
      instancia: user?.instancia || 'Propietario',
      tipo_general: form.tipoGeneral,
      tipo_solicitud: form.tipoSolicitud,
  familiar: form.tipoSolicitud === 'Asuntos medicos familiares' ? form.familiar || null : null,
      es_rango: !!form.esRango,
      fecha_inicio,
      fecha_fin,
      jornada: form.jornada,
      hora_inicio: form.jornada === 'Media' ? form.horaInicio : null,
      hora_fin: form.jornada === 'Media' ? form.horaFin : null,
      hora_compact: horaValue,
      cantidad: form.cantidad ? Number(form.cantidad) : null,
      unidad: form.cantidad ? (form.unidad === 'lecciones' ? 'lecciones' : 'horas') : null,
  observaciones: form.observaciones || null,
  hora_salida: form.jornada === 'Media' ? (form.horaSalida || null) : null,
      adjunto_url,
      adjunto_mime,
      adjunto_path,
    };

    try {
      // enviar al endpoint server que usará supabaseAdmin
      const res = await fetch('/api/solicitudes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Error en servidor');
  setStatus({ type: 'success', text: 'Solicitud enviada. Redirigiendo…' });
  setTimeout(() => router.push('/home'), 700);
      try { localStorage.removeItem("permisoFormDraft"); } catch {}
  setForm({ tipoGeneral: "Salida", esRango:false, fecha:"", fechaFin:"", horaInicio:"", horaFin:"", jornada:"Media", tipoSolicitud:"Asuntos medicos personales", familiar:"", cantidad:"", unidad:"horas", observaciones:"", horaSalida:"", adjunto:null });
    } catch (err) {
      console.error(err);
  setStatus({ type: 'error', text: 'Error enviando la solicitud: ' + (err.message || String(err)) });
    } finally {
      setLoading(false);
    }
  };
  // No longer needed: timeOptions for select

  // UI
  const isProfesor = useMemo(() => {
    const pos = (user?.posicion || "").toLowerCase();
    return pos.includes("profesor") || pos.includes("docente");
  }, [user]);

  useEffect(() => {
    setForm((p) => ({ ...p, unidad: isProfesor ? "lecciones" : "horas" }));
  }, [isProfesor]);

  // keyboard shortcuts: Ctrl+Enter to enviar, Esc to cancelar
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        const btn = document.getElementById('btn-enviar-solicitud');
        if (btn && !btn.disabled) btn.click();
      }
      if (e.key === 'Escape') {
        const btn = document.getElementById('btn-cancelar-solicitud');
        if (btn) btn.click();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onCancel = () => {
    if (loading || uploading) return;
    const go = confirm('¿Deseas cancelar y salir? Los datos sin guardar se perderán.');
    if (go) router.push('/home');
  };

  // simple disabled state if there are errors or mandatory fields missing
  const submitDisabled = loading || uploading || !form.fecha || (form.jornada === 'Media' && (!form.horaInicio || !form.horaFin));

  // Layout helpers for grid alignment
  const dateStartSpan = form.esRango
    ? (form.jornada === 'Media' ? 'span-3' : 'span-6')
    : 'span-4';
  const dateEndSpan = form.esRango
    ? (form.jornada === 'Media' ? 'span-3' : 'span-6')
    : 'span-4';
  const qtySpan = (form.jornada === 'Completa' && form.esRango) ? 'span-6' : 'span-4';
  const unidadSpan = (form.jornada === 'Completa' && form.esRango) ? 'span-6' : 'span-4';

  return (
    <div className={`${styles.page} ${styles.pageEnter}`}>
  {/* Fuente global desde layout */}
      <LoadingOverlay show={authLoading || (!!currentUser && !user)} text="Cargando datos del usuario…" />

      {/* Botón volver arriba */}
      <div className={styles.topbar}>
        <Link href="/home" className={styles.back}>⟵ Volver</Link>
      </div>

      {/* Estado y progreso accesible */}
      <div className={styles.statusBar} role="status" aria-live="polite">
        {status?.text && (
          <div className={`${styles.alert} ${
            status.type === 'error' ? styles.alertError :
            status.type === 'success' ? styles.alertSuccess : styles.alertInfo
          }`}>{status.text}</div>
        )}
      </div>

      {/* Encabezado estilo maqueta */}
      <div className={styles.topbar}>
        <a href="#ayuda" className={styles.helpLink} title="Ver ayuda y preguntas frecuentes">Ayuda / FAQ</a>
      </div>
      <div className={styles.brandrow}>
        <div className={styles.brand}>MIPP+</div>
        <div className={styles.logos} aria-hidden>
          {/* Placeholder para logos del MEP y escudos en la derecha */}
          <span />
        </div>
      </div>
      <div className={styles.titleBanner}>
        Formulario de Solicitud de Permiso de Salida, Ausencia, Tardía o Incapacidades
      </div>
      <p className={styles.note}>
        <strong>Importante:</strong> Todo permiso de ausencia laboral está sujeto a cumplimiento de requisitos y copia adjunta de documento pertinente de cita, convocatoria o licencia, de ser posible con tres días de anticipación. Posterior a la ausencia y/o tardía, el funcionario debe de hacer entrega del comprobante pertinente de justificación de asistencia en el plazo no mayor de 48 (cuarenta y ocho) horas. Las licencias dependen de requisitos previos para su goce. De no presentar el comprobante se tramitará lo que corresponda.
      </p>
      <hr className={styles.divider} />

      {/* Texto auto-rellenado del usuario (chips estilo maqueta) */}
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

      {/* Resumen de errores no bloqueante */}
      {errorsList.length > 0 && (
        <div ref={summaryRef} className={styles.errorSummary} role="alert" aria-live="assertive">
          <strong>Revisa estos puntos:</strong>
          <ul>{errorsList.map((m, i) => <li key={i}>{m}</li>)}</ul>
        </div>
      )}

      <form onSubmit={handleSubmit} className={`${styles.formCard} ${styles.animSection}`}>
        {/* Tipo general */}
        <div className={styles.field}>
          <label className={styles.lbl}>Permiso de:
            <select name="tipoGeneral" value={form.tipoGeneral} onChange={handleChange} className={styles.select}>
              <option>Salida</option>
              <option>Ausencia</option>
              <option>Tardía</option>
              <option>Incapacidad</option>
            </select>
          </label>
        </div>

        {/* Barra de jornada arriba de fecha y horas */}
        <div className={styles.grid}>
          {/* Tipo de jornada (arriba) */}
          <div className={`${styles.field} ${styles['span-12']}`}>
            <div className={styles.jornadaBar}>
              <div className={styles.jornadaLeft}>
                <span className={styles.lbl} style={{ marginBottom: 0 }}>Tipo de jornada</span>
              </div>
              <div className={styles.switchWrap} role="group" aria-label="Tipo de jornada">
                <span className={styles.switchLabel}>
                  <span className={styles.long}>Media jornada</span>
                  <span className={styles.short}>Media</span>
                </span>
                <label className={styles.switch} title={form.jornada === 'Media' ? 'Cambiar a jornada completa' : 'Cambiar a media jornada'}>
                  <input
                    type="checkbox"
                    aria-checked={form.jornada === 'Completa'}
                    checked={form.jornada === 'Completa'}
                    onChange={toggleJornada}
                    disabled={form.tipoGeneral === 'Incapacidad' || form.tipoGeneral === 'Tardía'}
                  />
                  <span className={styles.slider} />
                </label>
                <span className={styles.switchLabel}>
                  <span className={styles.long}>Jornada completa</span>
                  <span className={styles.short}>Completa</span>
                </span>
                {form.tipoGeneral === 'Incapacidad' ? (
                  <span className={styles.hint} style={{marginLeft:8}}>Obligatorio para incapacidad</span>
                ) : form.tipoGeneral === 'Tardía' ? (
                  <span className={styles.hint} style={{marginLeft:8}}>Obligatorio en tardía (solo media jornada)</span>
                ) : null}
              </div>
            </div>
          </div>

          {/* Tipo de fecha (nuevo) */}
          <div className={`${styles.field} ${styles['span-12']}`}>
            <div className={styles.jornadaBar}>
              <div className={styles.jornadaLeft}>
                <span className={styles.lbl} style={{ marginBottom: 0 }}>Tipo de fecha</span>
              </div>
              <div className={styles.switchWrap} role="group" aria-label="Tipo de fecha">
                <span className={styles.switchLabel}>
                  <span className={styles.long}>Solo una fecha</span>
                  <span className={styles.short}>Solo una</span>
                </span>
                <label className={styles.switch} title={form.esRango ? 'Cambiar a una sola fecha' : 'Cambiar a varias fechas'}>
                  <input
                    type="checkbox"
                    aria-checked={form.esRango}
                    checked={form.esRango}
                    onChange={toggleFechaModo}
                  />
                  <span className={styles.slider} />
                </label>
                <span className={styles.switchLabel}>
                  <span className={styles.long}>Varias fechas</span>
                  <span className={styles.short}>Varias</span>
                </span>
              </div>
            </div>
          </div>

      {/* Fecha o rango: si es rango y jornada es Media => 3+3+6 (con Hora).
        Si es rango y jornada es Completa => 6+6 (sin Hora).
      */}
      <div className={`${styles.field} ${styles[dateStartSpan]}`}>
            <label className={styles.lbl}>Fecha inicio</label>
            <input title="Selecciona la fecha de inicio del permiso" className={styles.input} type="date" name="fecha" value={form.fecha} onChange={e => {
                const val = e.target.value;
                const d = new Date(val);
                // 5 = sabado, 6 = domingo
                if (d && (d.getDay() === 5 || d.getDay() === 6)) {
                  setErrorsUI(p => ({ ...p, fecha: 'No se permiten fines de semana' }));
                  setForm(f => ({ ...f, fecha: '' }));
                  return;
                }
                handleChange(e);
                setErrorsUI(p => ({ ...p, fecha: undefined }));
              }} required min={todayYMD} aria-describedby={errorsUI.fecha ? 'err-fecha' : undefined} />
            {errorsUI.fecha && <div id="err-fecha" className={styles.error}>{errorsUI.fecha}</div>}
            {errorsUI.fecha && <div className={styles.error}>{errorsUI.fecha}</div>}
          </div>
          {form.esRango && (
            <div className={`${styles.field} ${styles[dateEndSpan]}`}>
              <label className={styles.lbl}>Fecha fin</label>
              <input className={styles.input} type="date" name="fechaFin" value={form.fechaFin} onChange={e => {
      const val = e.target.value;
      const d = new Date(val);
      if (d && (d.getDay() === 0 || d.getDay() === 6)) {
        setErrorsUI(p => ({ ...p, fecha: 'No se permiten fines de semana' }));
        setForm(f => ({ ...f, fechaFin: '' }));
        return;
      }
      handleChange(e);
    }} required min={form.esRango && form.fecha ? addDaysYMD(form.fecha, 1) : (form.fecha || todayYMD)} />
            </div>
          )}

          {/* Hora: Desde/Hasta */}
          {form.jornada === 'Media' && (
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <div className={`${styles.field} ${styles['span-6']}`}>
                <label className={styles.lbl}>Hora</label>
                <div className={styles.row}>
                  <div className={styles.picker}>
                    <span className={styles.hint}>Desde las</span>
                    <TimePicker
                      ampm
                      minutesStep={STEP_MINUTES}
                      value={toDayjsFromHHMM(form.horaInicio) || null}
                      onChange={(newVal) => {
                        setForm((prev) => {
                          let nextStart = toHHMMFromDayjs(newVal);
                          // clamp to min/max
                          nextStart = clampTime(nextStart || TIME_MIN);
                          // if end missing, set to start + step; else normalize to ensure end > start
                          const currentEnd = prev.horaFin || addMin(nextStart, STEP_MINUTES);
                          const { s, e } = normalizeTimes(nextStart, currentEnd);
                          return { ...prev, horaInicio: s, horaFin: e };
                        });
                      }}
                      minTime={minTimeDJ()}
                      maxTime={maxTimeDJ()}
                      slotProps={{
                        textField: {
                          required: true,
                          fullWidth: true,
                          size: 'small',
                          margin: 'dense',
                          variant: 'outlined',
                          inputProps: { 'aria-label': 'Hora de inicio' },
                          sx: {
                            minWidth: 0,
                            '& .MuiInputBase-input': { padding: '10px 12px' },
                            '& .MuiOutlinedInput-root': { borderRadius: '8px' },
                          }
                        }
                      }}
                    />
                  </div>
                  <div className={styles.picker}>
                    <span className={styles.hint}>Hasta las</span>
                    <TimePicker
                      ampm
                      minutesStep={STEP_MINUTES}
                      value={toDayjsFromHHMM(form.horaFin) || null}
                      onChange={(newVal) => {
                        setForm((prev) => {
                          let nextEnd = toHHMMFromDayjs(newVal);
                          nextEnd = clampTime(nextEnd || addMin(prev.horaInicio || TIME_MIN, STEP_MINUTES));
                          const { s, e } = normalizeTimes(prev.horaInicio || TIME_MIN, nextEnd);
                          return { ...prev, horaInicio: s, horaFin: e };
                        });
                      }}
                      minTime={toDayjsFromHHMM(form.horaInicio || TIME_MIN) || minTimeDJ()}
                      maxTime={maxTimeDJ()}
                      slotProps={{
                        textField: {
                          required: true,
                          fullWidth: true,
                          size: 'small',
                          margin: 'dense',
                          variant: 'outlined',
                          inputProps: { 'aria-label': 'Hora fin' },
                          sx: {
                            minWidth: 0,
                            '& .MuiInputBase-input': { padding: '10px 12px' },
                            '& .MuiOutlinedInput-root': { borderRadius: '8px' },
                          }
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            </LocalizationProvider>
          )}

          {/* (Tipo de jornada movido arriba) */}

          {/* Cantidad segun rol */}
          <div className={`${styles.field} ${styles[qtySpan]}`}>
            <label className={styles.lbl}>{isProfesor ? 'Cantidad de lecciones' : 'Cantidad de horas'}</label>
            <input className={styles.input} type="number" name="cantidad" value={form.cantidad} onChange={handleChange} min={0} step={1} />
          </div>
          <div className={`${styles.field} ${styles[unidadSpan]}`}>
            <label className={styles.lbl}>Unidad</label>
            <input className={styles.input} value={isProfesor ? 'lecciones' : 'horas'} readOnly />
            <div className={styles.help}>Se autodefine según tu puesto.</div>
          </div>

          {/* Hora de salida: solo mostrar si NO es Tardía */}
          {form.jornada === 'Media' && form.tipoGeneral !== 'Tardía' && (
            <div className={`${styles.field} ${styles['span-4']}`}>
              <label className={styles.lbl}>Hora de salida del centro educativo</label>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <div className={styles.picker}>
                  <TimePicker
                    ampm
                    minutesStep={STEP_MINUTES}
                    value={toDayjsFromHHMM(form.horaSalida) || null}
                    onChange={(newVal) => {
                      const v = clampTime(toHHMMFromDayjs(newVal));
                      setForm((p) => ({ ...p, horaSalida: v || '' }));
                    }}
                    minTime={minTimeDJ()}
                    maxTime={maxTimeDJ()}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        size: 'small',
                        margin: 'dense',
                        variant: 'outlined',
                        inputProps: { 'aria-label': 'Hora de salida' },
                        sx: {
                          minWidth: 0,
                          '& .MuiInputBase-input': { padding: '10px 12px' },
                          '& .MuiOutlinedInput-root': { borderRadius: '8px' },
                        }
                      }
                    }}
                  />
                </div>
              </LocalizationProvider>
              {errorsUI.hora && <div className={styles.error}>{errorsUI.hora}</div>}
            </div>
          )}
        </div>

        {/* Tipo de solicitud */}
        <div className={styles.field}>
          <label className={styles.lbl}>Motivo</label>
          <select name="tipoSolicitud" value={form.tipoSolicitud} onChange={handleChange} className={styles.select}>
            <option>Asuntos medicos personales</option>
            <option>Asuntos medicos familiares</option>
            <option>Asistencia a convocatoria</option>
            <option>Atención de asuntos personales</option>
          </select>
          {form.tipoSolicitud === 'Asuntos medicos personales' && (
            <div className={styles.help}>
              Solo son permitidos los comprobantes de programación de cita medicas (no confundir con comprobante de asistencia a cita medica), o en caso de incapacidad, comprobante de incapacidad
            </div>
          )}
          {form.tipoSolicitud === 'Asuntos medicos familiares' && (
            <div className={styles.help}>
              Solo son permitidos los comprobantes de programación de cita medica del familiar (no confundir con comprobante de asistencia a cita medica)
            </div>
          )}
        </div>

        

        {/* Dependiente del tipo */}
  {form.tipoSolicitud === "Asuntos medicos familiares" && (
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
          </div>
        )}

  {(form.tipoSolicitud === "Asuntos medicos personales" || form.tipoSolicitud === "Asistencia a convocatoria" || form.tipoSolicitud === "Asuntos medicos familiares" || form.tipoSolicitud === "Atención de asuntos personales") && (
          <div className={styles.field}>
            <label className={styles.lbl}>Adjuntar documento</label>
            <div
              className={`${styles.fileDrop} ${dragOver ? styles.fileDropActive : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault(); setDragOver(false);
                const f = e.dataTransfer?.files?.[0];
                if (f) setForm(p => ({ ...p, adjunto: f }));
              }}
              onClick={() => document.getElementById('adj-file-input')?.click()}
              role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') document.getElementById('adj-file-input')?.click(); }}
              aria-label="Arrastra y suelta el documento o haz clic para seleccionar"
            >
              <input
                id="adj-file-input"
                className={styles.input}
                type="file"
                name="adjunto"
                accept=".pdf,.doc,.docx,image/*"
                onChange={handleChange}
                style={{ display: 'none' }}
              />
              <div className={styles.fileDropInner}>
                <div className={styles.fileIcon} aria-hidden>📎</div>
                <div className={styles.fileText}>
                  {form.adjunto ? `Archivo: ${form.adjunto.name}` : 'Arrastra y suelta el documento o haz clic para seleccionar'}
                </div>
              </div>
            </div>
            <span className={styles.hint} title="Se permiten imágenes (jpg, png), PDF y Word">
              {uploading ? <span className={styles.spinnerInline} aria-hidden /> : null}
              {uploading ? 'Subiendo documento…' : 'Se permiten imágenes (JPG, PNG), PDF y Word'}
            </span>
            {errorsUI.adjunto && <div className={styles.error}>{errorsUI.adjunto}</div>}
          </div>
        )}

        {/* Observaciones */}
        <div className={`${styles.field} ${styles['span-12']}`}>
          <label className={styles.lbl}>Observaciones:</label>
          <textarea className={styles.textarea} name="observaciones" value={form.observaciones} onChange={handleChange} rows={6} placeholder="Opcional" />
        </div>

        {/* Texto de presentación estilo pie */}
        <div className={styles.footerLine}>
          Presento la solicitud a las <strong>{hoyTxt.hora}</strong> del mes <strong>{new Date().toLocaleString('es-CR', { month: 'long' })}</strong> del año <strong>{hoyTxt.anio}</strong> en Heredia, Mercedes Norte.
        </div>

        {/* Acciones */}
        <div className={styles.actions}>
          <button id="btn-cancelar-solicitud" type="button" onClick={onCancel} className={`${styles.btn} ${styles.btnSecondary}`} title="Cancelar y volver">
            Cancelar
          </button>
          <button id="btn-enviar-solicitud" type="submit" disabled={submitDisabled} className={`${styles.btn} ${styles.btnPrimary}`} title="Envia tu solicitud (Ctrl+Enter)">
            {(loading || uploading) ? "Procesando…" : "Enviar solicitud"}
          </button>
        </div>
      </form>

      {/* Ayuda / FAQ */}
      <section id="ayuda" className={styles.faqCard} aria-labelledby="faq-title">
        <h2 id="faq-title" className={styles.faqTitle}>Ayuda rápida y preguntas frecuentes</h2>
        <div className={styles.faqList}>
          <details className={styles.faqItem}>
            <summary>¿Qué debo adjuntar para “Cita médica” o “Convocatoria”?</summary>
            <div className={styles.faqContent}>
              Adjunta una foto o PDF del comprobante (cita, orden, o convocatoria). Tamaños soportados: JPG, PNG, PDF y Word.
            </div>
          </details>
          <details className={styles.faqItem}>
            <summary>¿Cómo se calcula “Media jornada”?</summary>
            <div className={styles.faqContent}>
              Media jornada es un rango máximo de 4 horas dentro del horario permitido ({TIME_MIN}–{TIME_MAX}). Selecciona “Jornada completa” si corresponde a todo el día.
            </div>
          </details>
          <details className={styles.faqItem}>
            <summary>No puedo elegir fines de semana</summary>
            <div className={styles.faqContent}>
              Las solicitudes se realizan para días hábiles. Si necesitas un caso especial, comunícate con administración.
            </div>
          </details>
          <details className={styles.faqItem}>
            <summary>¿Puedo editar o cancelar después de enviar?</summary>
            <div className={styles.faqContent}>
              Puedes volver a la página principal y contactar a administración para solicitar cambios si ya fue enviada.
            </div>
          </details>
        </div>
      </section>
    </div>
  );
}

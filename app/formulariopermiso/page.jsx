"use client"

import React, { useEffect, useMemo, useState } from "react";
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

  const [form, setForm] = useState({
    tipoGeneral: "Salida", // Salida | Ausencia | Tardía | Incapacidad
    esRango: false,
    fecha: "",
    fechaFin: "",
    horaInicio: "",
    horaFin: "",
    jornada: "Media", // Media | Completa
    tipoSolicitud: "Cita medica personal",
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
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : files ? files[0] : value,
    }));
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
    if (form.tipoSolicitud === "Cita medica personal" || form.tipoSolicitud === "Asistencia a convocatoria") {
      if (!form.adjunto) errors.push("Debes adjuntar un documento de respaldo");
    }

    // familiar requerido cuando acompaña a familiar
    if (form.tipoSolicitud === "Acompañar a cita familiar" && !form.familiar) {
      errors.push("Selecciona el familiar");
    }

    // campos profesor/funcionario
    if (form.cantidad && Number(form.cantidad) <= 0) errors.push("Cantidad debe ser positiva");

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
    if (errs.length) { alert(errs.join("\n")); return; }
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
      alert('No se pudo subir el adjunto. Error: ' + (uploadErr.message || String(uploadErr)));
      setLoading(false);
      return;
    }

    const payload = {
      user_cedula: cedula,
      nombre_solicitante: nombreCompleto,
      posicion: user?.posicion || '',
      instancia: user?.instancia || 'Propietario',
      tipo_general: form.tipoGeneral,
      tipo_solicitud: form.tipoSolicitud,
      familiar: form.tipoSolicitud === 'Acompañar a cita familiar' ? form.familiar || null : null,
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
      if (form.tipoSolicitud === "Atención de asuntos personales") {
        alert("Solicitud enviada. Recuerda hablar con Doña Laura.");
      } else {
        alert("Solicitud enviada");
      }
      router.push('/home');
      try { localStorage.removeItem("permisoFormDraft"); } catch {}
      setForm({ tipoGeneral: "Salida", esRango:false, fecha:"", fechaFin:"", horaInicio:"", horaFin:"", jornada:"Media", tipoSolicitud:"Cita medica personal", familiar:"", cantidad:"", unidad:"horas", observaciones:"", horaSalida:"", adjunto:null });
    } catch (err) {
      console.error(err);
      alert("Error enviando la solicitud: " + (err.message || String(err)));
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

  return (
    <div className={styles.page}>
  {/* Fuente global desde layout */}
      <LoadingOverlay show={authLoading || (!!currentUser && !user)} text="Cargando datos del usuario…" />

      {/* Encabezado estilo maqueta */}
      <div className={styles.topbar}>
        <Link href="/home" className={styles.back}>⟵ Volver</Link>
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

      <form onSubmit={handleSubmit} className={styles.formCard}>
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

        {/* Fecha o rango */}
        <div className={styles.grid}>
          <div className={`${styles.field} ${styles['span-4']}`}>
            <label className={styles.lbl}>Fecha</label>
            <input title="Selecciona la fecha de inicio del permiso" className={styles.input} type="date" name="fecha" value={form.fecha} onChange={e => {
                const val = e.target.value;
                const d = new Date(val);
                // 0 = domingo, 6 = sábado
                if (d && (d.getDay() === 0 || d.getDay() === 6)) {
                  alert('No se permiten fines de semana.');
                  setForm(f => ({ ...f, fecha: '' }));
                  return;
                }
                handleChange(e);
              }} required min={todayYMD} />
          </div>
          {form.esRango && (
            <div className={`${styles.field} ${styles['span-4']}`}>
              <label className={styles.lbl}>Fecha fin</label>
              <input className={styles.input} type="date" name="fechaFin" value={form.fechaFin} onChange={e => {
      const val = e.target.value;
      const d = new Date(val);
      if (d && (d.getDay() === 0 || d.getDay() === 6)) {
        alert('No se permiten fines de semana.');
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

          {/* Tipo de jornada */}
          <div className={`${styles.field} ${styles['span-2']}`}>
            <label className={styles.lbl}>Tipo de jornada</label>
            <div className={styles.btnGroup}>
              <button type="button" onClick={toggleJornada} className={`${styles.btn} ${styles.btnPrimary}`}>
                {form.jornada === "Media" ? "Cambiar a Completa" : "Cambiar a Media"}
              </button>
              <span className={styles.badge}>{form.jornada === 'Media' ? 'Media' : 'Jornada Laboral Completa'}</span>
            </div>
          </div>

          {/* Cantidad segun rol */}
          <div className={`${styles.field} ${styles['span-4']}`}>
            <label className={styles.lbl}>{isProfesor ? 'Cantidad de lecciones' : 'Cantidad de horas'}</label>
            <input className={styles.input} type="number" name="cantidad" value={form.cantidad} onChange={handleChange} min={0} step={1} />
          </div>
          <div className={`${styles.field} ${styles['span-4']}`}>
            <label className={styles.lbl}>Unidad</label>
            <input className={styles.input} value={isProfesor ? 'lecciones' : 'horas'} readOnly />
          </div>

          {/* Hora de salida */}
          <div className={`${styles.field} ${styles['span-4']}`}>
            <label className={styles.lbl}>Hora de salida del centro educativo</label>
            {form.jornada === 'Media' ? (
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
                        '& .MuiInputBase-input': { padding: '5px 5px' },
                        '& .MuiOutlinedInput-root': { borderRadius: '0px' },
                      }
                    }
                  }}
                />
                </div>
              </LocalizationProvider>
            ) : (
              <input className={styles.input} value="" placeholder="No aplica para jornada completa" readOnly />
            )}
          </div>
        </div>

        {/* Tipo de solicitud */}
        <div className={styles.field}>
          <label className={styles.lbl}>Motivo</label>
          <select name="tipoSolicitud" value={form.tipoSolicitud} onChange={handleChange} className={styles.select}>
            <option>Cita medica personal</option>
            <option>Acompañar a cita familiar</option>
            <option>Asistencia a convocatoria</option>
            <option>Atención de asuntos personales</option>
          </select>
        </div>

        

        {/* Dependiente del tipo */}
        {form.tipoSolicitud === "Acompañar a cita familiar" && (
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

        {(form.tipoSolicitud === "Cita medica personal" || form.tipoSolicitud === "Asistencia a convocatoria") && (
          <div className={styles.field}>
            <label className={styles.lbl}>Adjuntar documento</label>
            <input className={styles.input} type="file" name="adjunto" accept=".pdf,.doc,.docx,image/*" onChange={handleChange} />
            <span className={styles.hint} title="Se permiten imágenes (jpg, png), PDF y Word">Se permiten imágenes (JPG, PNG), PDF y Word</span>
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
          <button type="submit" disabled={loading} className={`${styles.btn} ${styles.btnPrimary}`} title="Envia tu solicitud">
            {loading ? "Enviando solicitud…" : "Enviar solicitud"}
          </button>
        </div>
      </form>
    </div>
  );
}

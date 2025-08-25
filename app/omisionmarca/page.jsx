"use client";

import React, { useEffect, useMemo, useState } from "react";
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
    if (!form.fechaOmision) {
      alert("Selecciona la fecha de la omisión");
      return;
    }
    if (!form.justificacion) {
      alert("Escribe la justificación");
      return;
    }
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
      alert("Justificación de omisión enviada");
      router.push("/home");
    } catch (err) {
      console.error(err);
      alert("Error: " + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: "2rem auto", padding: 24 }}>
  <LoadingOverlay show={authLoading || (!!currentUser && !user)} text="Cargando datos del usuario…" />
      <nav style={{ marginBottom: 12 }}>
        <Link href="/home">← Volver</Link>
      </nav>
      <h2>Justificar omisión de marca</h2>

      <div
        style={{
          background: "#f7f7f7",
          padding: 12,
          borderRadius: 6,
          marginBottom: 16,
        }}
      >
        {user ? (
          <p>
            Quien se suscribe <strong>{nombreCompleto}</strong>, con cédula de
            identidad <strong>{user.cedula}</strong>, quien labora en la
            institución educativa CTP Mercedes Norte, en el puesto de
            <strong> {user.posicion}</strong>, en condición
            <strong> {user.instancia}</strong>.
          </p>
        ) : (
          <p>Inicia sesión para prellenar tus datos.</p>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        style={{ border: "1px solid #ddd", padding: 16, borderRadius: 8 }}
      >
        <div style={{ marginBottom: 12 }}>
          <label>
            Fecha de la omisión <span style={{ color: "red" }}>*</span>
            <input
              type="date"
              name="fechaOmision"
              value={form.fechaOmision}
              onChange={handleChange}
              required
              style={{ display: "block" }}
              min={minAllowed}
              max={maxAllowed}
            />
          </label>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>
            Tipo
            <select
              name="tipo"
              value={form.tipo}
              onChange={handleChange}
              style={{ display: "block" }}
            >
              <option>Entrada</option>
              <option>Salida</option>
              <option>Todo el dia</option>
              <option>Salida anticipada</option>
            </select>
          </label>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block" }}>
            Justificación <span style={{ color: "red" }}>*</span>
            <textarea
              name="justificacion"
              value={form.justificacion}
              onChange={handleChange}
              rows={4}
              required
              style={{ width: "100%" }}
            />
          </label>
        </div>

        <div style={{ background: "#f7f7f7", padding: 10, borderRadius: 6, marginBottom: 12 }}>
          <p>
            Presento la justificación a las <strong>{hoyTxt.hora}</strong> del
            mes <strong>{hoyTxt.mes}</strong> del año <strong>{hoyTxt.anio}</strong> en Heredia, Mercedes Norte.
          </p>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: 10,
              background: "#0f766e",
              color: "white",
              border: "none",
              borderRadius: 6,
            }}
          >
            {loading ? "Enviando…" : "Enviar"}
          </button>
          <Link href="/home">Volver al menú</Link>
        </div>
      </form>
    </div>
  );
}

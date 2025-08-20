import { requireRole } from '../../../lib/authHelpers';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

// Helpers de fecha (Costa Rica)
const crYMD = (d = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(d)
    .reduce((acc, p) => { if (p.type !== 'literal') acc[p.type] = p.value; return acc; }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
};

export async function POST(req) {
  // any authenticated user can create a solicitud
  const user = await requireRole(req, 'normal_user');
  if (user instanceof Response) {
    // allow any authenticated user: dev or admin
    const dev = await requireRole(req, 'dev');
    if (dev instanceof Response) {
      const admin = await requireRole(req, 'admin');
      if (admin instanceof Response) {
        // Return a consistent 401 with a hint header so client can redirect to /login
        return new Response(
          JSON.stringify({ error: 'No autenticado', hint: 'Inicia sesión para continuar' }),
          { status: 401, headers: { 'WWW-Authenticate': 'Bearer realm="session_token"' } }
        );
      }
    }
  }

  try {
    const body = await req.json();
    // validate minimal fields
    const required = ['fecha_inicio', 'fecha_fin', 'tipo_solicitud'];
    for (const f of required) if (!body[f]) return new Response(JSON.stringify({ error: `Campo requerido: ${f}` }), { status: 400 });

    // Reglas de fecha: no permitir fechas menores a hoy (CR) y fin >= inicio
    // Usa reloj de prueba de la BD (get_today_cr) si existe; fallback a crYMD local
    let todayCR = null;
    try {
      const { data: todayData } = await supabaseAdmin.rpc('get_today_cr');
      if (todayData) todayCR = String(todayData);
    } catch {}
    if (!todayCR) todayCR = crYMD();
    const fi = String(body.fecha_inicio);
    const ff = String(body.fecha_fin);
    if (fi < todayCR) {
      return new Response(JSON.stringify({ error: 'fecha_inicio no puede ser menor a hoy' }), { status: 400 });
    }
    if (ff < todayCR) {
      return new Response(JSON.stringify({ error: 'fecha_fin no puede ser menor a hoy' }), { status: 400 });
    }
    if (body.es_rango) {
      if (ff <= fi) {
        return new Response(JSON.stringify({ error: 'En rango, fecha_fin debe ser posterior a fecha_inicio' }), { status: 400 });
      }
    } else {
      if (ff < fi) {
        return new Response(JSON.stringify({ error: 'fecha_fin no puede ser anterior a fecha_inicio' }), { status: 400 });
      }
    }

    // attach user from session
  const cookie = req.cookies.get('session_token');
  const token = cookie?.value || cookie;
    // payload validation already done in requireRole but we'll fetch user id from authHelpers again
  const { getUserAndRolesFromRequest } = await import('../../../lib/authHelpers');
    const info = await getUserAndRolesFromRequest(req);
    if (!info) {
      return new Response(
        JSON.stringify({ error: 'No autenticado', hint: 'Vuelve a iniciar sesión' }),
        { status: 401, headers: { 'WWW-Authenticate': 'Bearer realm="session_token"' } }
      );
    }

    const payload = {
      user_cedula: info.user.cedula,
      nombre_solicitante: body.nombre_solicitante || null,
      posicion: body.posicion || null,
      instancia: body.instancia || null,
      estado: 'Pendiente',
      tipo_general: body.tipo_general || null,
      tipo_solicitud: body.tipo_solicitud,
      familiar: body.familiar || null,
      es_rango: !!body.es_rango,
      fecha_inicio: body.fecha_inicio,
      fecha_fin: body.fecha_fin,
      jornada: body.jornada || null,
      hora_inicio: body.hora_inicio || null,
      hora_fin: body.hora_fin || null,
      hora_compact: body.hora_compact || null,
      cantidad: body.cantidad || null,
      unidad: body.unidad || null,
      observaciones: body.observaciones || null,
      hora_salida: body.hora_salida || null,
      adjunto_url: body.adjunto_url || null,
      adjunto_mime: body.adjunto_mime || null,
    };

    const { data, error } = await supabaseAdmin.from('solicitudes_permiso').insert([payload]).select('id');
    if (error) throw error;
    const solicitudId = data?.[0]?.id || null;

    // If the client included an uploaded file, persist an attachment link
    if (solicitudId && (body.adjunto_url || body.adjunto_path)) {
      const attachRow = {
        solicitud_id: solicitudId,
        path: body.adjunto_path || null,
        public_url: body.adjunto_url || null,
        mime: body.adjunto_mime || null,
        uploaded_by_cedula: info.user.cedula,
      };
      const { error: attErr } = await supabaseAdmin.from('solicitud_adjuntos').insert([attachRow]);
      if (attErr) {
        console.error('attachment insert error', attErr);
        // don't fail the main request; continue
      }
    }

    return new Response(JSON.stringify({ ok: true, id: solicitudId }), { status: 201 });
  } catch (err) {
    console.error('/api/solicitudes error', err);
    return new Response(JSON.stringify({ error: err.message || String(err) }), { status: 500 });
  }
}

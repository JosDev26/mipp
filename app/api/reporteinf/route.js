import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { getUserAndRolesFromRequest } from '../../../lib/authHelpers';

export async function POST(req) {
  try {
    const info = await getUserAndRolesFromRequest(req);
    if (!info) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });

    const body = await req.json();
    const required = ['tipo_reporte', 'reporte', 'lugar'];
    for (const k of required) {
      if (!body[k]) return new Response(JSON.stringify({ error: `${k} requerido` }), { status: 400 });
    }

    const payload = {
      user_cedula: info.user.cedula,
      nombre_suscriptor: body.nombre_suscriptor || null,
      posicion: body.posicion || null,
      instancia: body.instancia || null,
      tipo_reporte: body.tipo_reporte,
      reporte: body.reporte,
  lugar: body.lugar,
  estado: 'Pendiente',
    };

    const { data, error } = await supabaseAdmin.from('reporte_infraestructura').insert([payload]).select('id');
    if (error) throw error;
    const id = data?.[0]?.id;
    return new Response(JSON.stringify({ ok: true, id }), { status: 201 });
  } catch (err) {
    console.error('/api/reporteinf error', err);
    return new Response(JSON.stringify({ error: err.message || String(err) }), { status: 500 });
  }
}

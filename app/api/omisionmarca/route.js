import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { getUserAndRolesFromRequest } from '../../../lib/authHelpers';

export async function POST(req) {
  try {
    const info = await getUserAndRolesFromRequest(req);
    if (!info) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });

    const body = await req.json();
    if (!body.fecha_omision) return new Response(JSON.stringify({ error: 'fecha_omision requerida' }), { status: 400 });
    if (!body.tipo_omision) return new Response(JSON.stringify({ error: 'tipo_omision requerido' }), { status: 400 });
    if (!body.justificacion) return new Response(JSON.stringify({ error: 'justificacion requerida' }), { status: 400 });

    const payload = {
      user_cedula: info.user.cedula,
      nombre_suscriptor: body.nombre_suscriptor || null,
      posicion: body.posicion || null,
      instancia: body.instancia || null,
      fecha_omision: body.fecha_omision,
      tipo_omision: body.tipo_omision,
  justificacion: body.justificacion,
  estado: 'Pendiente',
    };

    const { data, error } = await supabaseAdmin.from('omision_marca').insert([payload]).select('id');
    if (error) throw error;
    const id = data?.[0]?.id;
    return new Response(JSON.stringify({ ok: true, id }), { status: 201 });
  } catch (err) {
    console.error('/api/omisionmarca error', err);
    return new Response(JSON.stringify({ error: err.message || String(err) }), { status: 500 });
  }
}

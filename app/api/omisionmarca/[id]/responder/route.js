import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';
import { requireAnyRole, getUserAndRolesFromRequest } from '../../../../../lib/authHelpers';

export async function POST(req, ctx){
  const { params } = ctx || {}
  const { id } = (params && (await params)) || {}
  // only admin may respond
  const maybe = await requireAnyRole(req, ['admin']);
  if (maybe instanceof Response) return maybe;

  try{
    const info = await getUserAndRolesFromRequest(req);
    const { id } = params;
    const body = await req.json();
    const { decision, comentario } = body || {};

    // Prevent responding if already resolved
    const { data: existingRows, error: fetchErr } = await supabaseAdmin
      .from('omision_marca')
      .select('estado')
      .eq('id', id)
      .limit(1);
    if (fetchErr) throw fetchErr;
    const currentEstado = existingRows?.[0]?.estado || '';
    if (currentEstado && !String(currentEstado).toLowerCase().includes('pend')) {
      return new Response(JSON.stringify({ error: 'La omisión ya está resuelta y no puede modificarse.' }), { status: 409 });
    }

    const map = {
      'Aceptar': 'Aceptado',
      'Denegar': 'Denegado',
    };
    const estado = map[decision];
    if (!estado) return new Response(JSON.stringify({ error: 'Decisión inválida' }), { status: 400 });

    const payload = {
      estado,
      respuesta_comentario: comentario || null,
      respuesta_por: info?.user?.cedula || null,
      respuesta_nombre: info?.user ? `${info.user.nombre}${info.user.segundo_nombre ? ' '+info.user.segundo_nombre : ''} ${info.user.primer_apellido} ${info.user.segundo_apellido}` : null,
      respuesta_en: new Date().toISOString(),
    };

    const { error } = await supabaseAdmin
      .from('omision_marca')
      .update(payload)
      .eq('id', id);
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }catch(err){
    console.error('responder omision_marca error', err);
    return new Response(JSON.stringify({ error: err.message || String(err) }), { status: 500 });
  }
}

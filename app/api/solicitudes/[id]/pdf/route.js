export const runtime = 'nodejs';

import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';

export async function GET(req, ctx) {
  const { params } = ctx || {};
  const { id } = (params && (await params)) || {};
  if (!id) return new Response('Missing id', { status: 400 });

  const { getUserAndRolesFromRequest } = await import('../../../../../lib/authHelpers');
  const info = await getUserAndRolesFromRequest(req);
  if (!info) return new Response('No autenticado', { status: 401 });

  const { data: row, error } = await supabaseAdmin
    .from('solicitudes_permiso')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error || !row) return new Response('No encontrado', { status: 404 });

  const isPrivileged = (info.roles || []).some(r => ['admin', 'dev', 'staff_manager'].includes(r));
  if (!isPrivileged && row.user_cedula !== info.user.cedula) {
    return new Response('Prohibido', { status: 403 });
  }

  const { data: atts } = await supabaseAdmin
    .from('solicitud_adjuntos')
    .select('path, public_url, mime, uploaded_at')
    .eq('solicitud_id', row.id)
    .order('uploaded_at', { ascending: false });

  // New modern layout using pdf-lib
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');

  const hexToRgb01 = (hex) => {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return { r: 0, g: 0, b: 0 };
    return { r: parseInt(m[1], 16) / 255, g: parseInt(m[2], 16) / 255, b: parseInt(m[3], 16) / 255 };
  };
  const PR = hexToRgb01('#970909');
  const COLOR = { primary: rgb(PR.r, PR.g, PR.b), text: rgb(0.12,0.12,0.12), sub: rgb(0.35,0.35,0.35), light: rgb(0.97,0.97,0.97), border: rgb(0.87,0.89,0.91), muted: rgb(0.55,0.55,0.55), white: rgb(1,1,1) };

  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595, 842]);
  const size = page.getSize();
  const MX = 54, MT = 72, MB = 54; const CW = size.width - MX*2; let y = size.height - MT;

  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const ensure = (need) => { if (y - need < MB) { page = pdfDoc.addPage([595, 842]); y = page.getSize().height - MT; } };
  const t = (s, x, yy, fs=12, b=false, c=COLOR.text)=>page.drawText(String(s), { x, y: yy, size: fs, font: b?bold:regular, color: c });
  const rule = (x, yy, w, c=COLOR.border, th=1)=>page.drawLine({ start:{x, y:yy}, end:{x:x+w, y:yy}, thickness: th, color: c });
  const rect = (x, yy, w, h, c)=>page.drawRectangle({ x, y:yy, width:w, height:h, color:c, borderColor:c });
  const wrap = (str, maxW, fs, isBold=false)=>{ const f=isBold?bold:regular; const words=String(str||'').split(/\s+/g); const out=[]; let line=''; for (const w of words){ const test=line?line+' '+w:w; if(f.widthOfTextAtSize(test, fs)<=maxW){ line=test; } else { if(line) out.push(line); line=w; }} if(line) out.push(line); if(!out.length) out.push('-'); return out; };
  const section = (title)=>{ ensure(42); t(title, MX, y, 13, true, COLOR.primary); y-=10; rule(MX, y, CW, COLOR.border, 1); y-=16; };
  const two = (lKey,lVal,rKey,rVal)=>{ const col=CW/2; const keyW=110; const gap=16; const L=wrap(lVal??'-', col-keyW-12, 11); const R=wrap(rVal??'-', col-keyW-12, 11); const need=Math.max(L.length,R.length)*gap; ensure(need); const sy=y; t(lKey, MX, sy, 11, true, COLOR.sub); let yl=sy; L.forEach(S=>{ t(S, MX+keyW, yl, 11); yl-=gap;}); t(rKey, MX+col, sy, 11, true, COLOR.sub); let yr=sy; R.forEach(S=>{ t(S, MX+col+keyW, yr, 11); yr-=gap;}); y = sy - need; };
  const kv = (k,v)=>{ const lines = wrap(v??'-', CW-110, 11); const need=lines.length*16; ensure(need); t(k, MX, y, 11, true, COLOR.sub); let yy=y; lines.forEach(L=>{ t(L, MX+110, yy, 11); yy-=16; }); y = yy; };

  // Top bar
  const BAR=30; rect(0, size.height-BAR, size.width, BAR, COLOR.primary); t('CTP Mercedes Norte', MX, size.height-20, 12, true, COLOR.white); t(`Folio #${row.id}`, size.width-MX-80, size.height-20, 11, true, COLOR.white);

  // Title
  ensure(40); t('Solicitud de Permiso', MX, y, 18, true); y-=12; rule(MX, y, CW, COLOR.primary, 1.75); y-=20;

  // Meta card
  const creado = row.creado_en ? new Date(row.creado_en).toLocaleString('es-CR', {dateStyle:'medium', timeStyle:'short'}) : '-';
  const mh=86; ensure(mh+10); const cy=y-mh+18; rect(MX, cy, CW, mh, COLOR.light); y-=12; two('Estado', row.estado||'Pendiente', 'Creado', creado); two('Tipo general', row.tipo_general||'-', 'Motivo', row.tipo_solicitud||'-'); y-=8;

  // Periodo y jornada
  section('Periodo y jornada'); kv('Fecha(s)', `${row.fecha_inicio}${row.es_rango ? ` -> ${row.fecha_fin}` : ''}`); const horas = (row.hora_inicio || row.hora_fin) ? `(${row.hora_inicio || ''}${row.hora_fin ? ' - ' + row.hora_fin : ''})` : ''; kv('Jornada', `${row.jornada || '-'} ${horas}`.trim());

  // Solicitante
  section('Solicitante'); two('Nombre', row.nombre_solicitante||'-', 'Cédula', row.user_cedula||'-'); two('Posición', row.posicion||'-', 'Instancia', row.instancia||'-');

  // Detalle
  section('Detalle'); let hasDetail=false; if (row.familiar) { kv('Familiar', row.familiar); hasDetail=true; } if (row.cantidad) { kv('Cantidad', `${row.cantidad} ${row.unidad || ''}`); hasDetail=true; } if (row.hora_salida) { kv('Hora de salida', row.hora_salida); hasDetail=true; } if (row.observaciones) { kv('Observaciones', row.observaciones); hasDetail=true; } if (!hasDetail) { kv('-', ''); }

  // Adjuntos
  section('Adjuntos'); if (!atts || atts.length === 0) { t('No hay archivos adjuntos.', MX, y, 11, false, COLOR.muted); y-=16; } else { atts.forEach((a, idx)=>{ ensure(16); const name = a.path ? a.path.split('/').slice(-1)[0] : (a.public_url || `Adjunto ${idx+1}`); const kind = a.mime?.includes('image/') ? 'Imagen' : (a.mime || 'Archivo'); t(`- ${kind}: ${name}`, MX, y, 11); y-=16; }); }

  // Resolución
  section('Resolución'); kv('Estado', row.estado || '-'); if (row.respuesta_en) kv('Fecha de decisión', new Date(row.respuesta_en).toLocaleString('es-CR', {dateStyle:'medium', timeStyle:'short'})); if (row.respuesta_nombre) kv('Decidido por', row.respuesta_nombre); if (row.respuesta_comentario) kv('Comentario', String(row.respuesta_comentario));

  // Footer
  t('Generado por el sistema de permisos', MX, 36, 9, false, COLOR.muted);

  const pdfBytes = await pdfDoc.save();

  return new Response(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="solicitud_${row.id}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}

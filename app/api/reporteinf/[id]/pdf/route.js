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
    .from('reporte_infraestructura')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error || !row) return new Response('No encontrado', { status: 404 });

  const roles = info.roles || [];
  const isPrivileged = roles.some(r => ['admin', 'dev', 'infra_manager'].includes(r));
  if (!isPrivileged && row.user_cedula !== info.user?.cedula) {
    return new Response('Prohibido', { status: 403 });
  }

  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');

  // Palette (primary replaces the previous teal with #970909)
  const hexToRgb01 = (hex) => {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return { r: 0, g: 0, b: 0 };
    return { r: parseInt(m[1], 16) / 255, g: parseInt(m[2], 16) / 255, b: parseInt(m[3], 16) / 255 };
  };
  const PRIMARY = hexToRgb01('#970909');
  const COLOR = {
    primary: rgb(PRIMARY.r, PRIMARY.g, PRIMARY.b),
    text: rgb(0.12, 0.12, 0.12),
    subtext: rgb(0.35, 0.35, 0.35),
    light: rgb(0.97, 0.97, 0.97),
    border: rgb(0.87, 0.89, 0.91),
    muted: rgb(0.55, 0.55, 0.55),
    white: rgb(1, 1, 1),
  };

  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595, 842]); // A4 portrait
  const pageSize = page.getSize();
  const MARGIN_X = 54;
  const MARGIN_TOP = 72;
  const MARGIN_BOTTOM = 54;
  const CONTENT_W = pageSize.width - MARGIN_X * 2;
  let cursorY = pageSize.height - MARGIN_TOP;

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Helpers
  const ensureSpace = (needed) => {
    if (cursorY - needed < MARGIN_BOTTOM) {
      page = pdfDoc.addPage([595, 842]);
      cursorY = page.getSize().height - MARGIN_TOP;
    }
  };
  const drawText = (txt, x, y, size = 12, bold = false, color = COLOR.text) => {
    page.drawText(String(txt), { x, y, size, font: bold ? fontBold : fontRegular, color });
  };
  const drawRule = (x, y, w, color = COLOR.border, thickness = 1) => {
    page.drawLine({ start: { x, y }, end: { x: x + w, y }, thickness, color });
  };
  const fillRect = (x, y, w, h, color) => {
    page.drawRectangle({ x, y, width: w, height: h, color, borderColor: color });
  };
  const wrapText = (str, maxWidth, size, bold = false) => {
    const f = bold ? fontBold : fontRegular;
    const words = String(str || '').split(/\s+/g);
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      const w = f.widthOfTextAtSize(test, size);
      if (w <= maxWidth) {
        line = test;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  if (!lines.length) lines.push('-');
    return lines;
  };

  const sectionHeader = (title) => {
    ensureSpace(42);
    drawText(title, MARGIN_X, cursorY, 13, true, COLOR.primary);
    cursorY -= 10;
    drawRule(MARGIN_X, cursorY, CONTENT_W, COLOR.border, 1);
    cursorY -= 16;
  };

  const keyValRow = (label, value, colX, colW, keyW = 90) => {
    const labelSize = 11;
    const valueSize = 11;
    const lineGap = 14;
    const xKey = colX;
    const xVal = colX + keyW;
    const wrapW = Math.max(10, colW - keyW);
  const lines = wrapText(value ?? '-', wrapW, valueSize);
    const needed = lines.length * lineGap;
    ensureSpace(needed);
    drawText(label, xKey, cursorY, labelSize, true, COLOR.subtext);
    for (const l of lines) {
      drawText(l, xVal, cursorY, valueSize, false, COLOR.text);
      cursorY -= lineGap;
    }
  };

  const twoColRow = (left, right) => {
    const [labelL, valueL] = left;
    const [labelR, valueR] = right;
    const colW = CONTENT_W / 2;
    const keyW = 98;
    const labelSize = 11;
    const valueSize = 11;
    const lineGap = 14;
    const wrapWL = Math.max(10, colW - keyW - 12);
    const wrapWR = Math.max(10, colW - keyW - 12);
  const linesL = wrapText(valueL ?? '-', wrapWL, valueSize);
  const linesR = wrapText(valueR ?? '-', wrapWR, valueSize);
    const needed = Math.max(linesL.length, linesR.length) * lineGap;
    ensureSpace(needed);
    const startY = cursorY;
    // Left
    drawText(labelL, MARGIN_X, startY, labelSize, true, COLOR.subtext);
    let yL = startY;
    for (const l of linesL) {
      drawText(l, MARGIN_X + keyW, yL, valueSize, false, COLOR.text);
      yL -= lineGap;
    }
    // Right
    drawText(labelR, MARGIN_X + colW, startY, labelSize, true, COLOR.subtext);
    let yR = startY;
    for (const r of linesR) {
      drawText(r, MARGIN_X + colW + keyW, yR, valueSize, false, COLOR.text);
      yR -= lineGap;
    }
    cursorY = startY - needed;
  };

  // Top bar (brand + folio)
  const BAR_H = 30;
  fillRect(0, pageSize.height - BAR_H, pageSize.width, BAR_H, COLOR.primary);
  drawText('CTP Mercedes Norte', MARGIN_X, pageSize.height - 20, 12, true, COLOR.white);
  drawText(`Folio #${row.id}`, pageSize.width - MARGIN_X - 80, pageSize.height - 20, 11, true, COLOR.white);

  // Title
  ensureSpace(40);
  drawText('Reporte de Infraestructura', MARGIN_X, cursorY, 18, true, COLOR.text);
  cursorY -= 12;
  drawRule(MARGIN_X, cursorY, CONTENT_W, COLOR.primary, 1.75);
  cursorY -= 20;

  // Meta card (two columns)
  const creado = row.creado_en ? new Date(row.creado_en).toLocaleString('es-CR', { dateStyle: 'medium', timeStyle: 'short' }) : '-';
  const metaH = 82;
  ensureSpace(metaH + 10);
  const cardY = cursorY - metaH + 18;
  fillRect(MARGIN_X, cardY, CONTENT_W, metaH, COLOR.light);
  cursorY -= 12;
  twoColRow(['Estado', row.estado || 'Pendiente'], ['Creado', creado]);
  twoColRow(['Tipo de reporte', row.tipo_reporte || '-'], ['Lugar', row.lugar || '-']);
  cursorY -= 8;

  // Resumen / Detalle
  sectionHeader('Resumen');
  const wrapW = CONTENT_W;
  const linesDetalle = wrapText(String(row.reporte || '-'), wrapW, 11);
  for (const ln of linesDetalle) { ensureSpace(16); drawText(ln, MARGIN_X, cursorY, 11, false, COLOR.text); cursorY -= 16; }

  // Suscriptor
  sectionHeader('Suscriptor');
  twoColRow(['Nombre', row.nombre_suscriptor || '-'], ['Cédula', row.user_cedula || '-']);
  twoColRow(['Posición', row.posicion || '-'], ['Instancia', row.instancia || '-']);

  // Resolución
  sectionHeader('Resolución');
  keyValRow('Estado', row.estado || '-', MARGIN_X, CONTENT_W);
  if (row.respuesta_en) keyValRow('Fecha de decisión', new Date(row.respuesta_en).toLocaleString('es-CR', { dateStyle: 'medium', timeStyle: 'short' }), MARGIN_X, CONTENT_W);
  if (row.respuesta_nombre || row.respuesta_por) keyValRow('Decidido por', row.respuesta_nombre || row.respuesta_por, MARGIN_X, CONTENT_W);
  if (row.respuesta_comentario) {
    keyValRow('Comentario', String(row.respuesta_comentario), MARGIN_X, CONTENT_W);
  }

  // Footer
  drawText('Generado por el sistema de infraestructura', MARGIN_X, 36, 9, false, COLOR.muted);

  const pdfBytes = await pdfDoc.save();
  return new Response(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="reporte_infra_${row.id}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}

/**
 * generatePresentationPptx.ts
 * Genera un archivo PowerPoint de presentación mensual de proyectos ACT,
 * idéntico al formato de C:\...\Documentos\AC200024 Presentacion 1-8-26.pptx
 */

import PptxGenJS from "pptxgenjs";
import { formatCurrency, formatDate } from "@/lib/utils";

export interface PresentationData {
  projectId: string;
  presentationDate: string;
  activities: string;
  criticalPoints: string;
  photo1Url: string | null;
  photo2Url: string | null;
  project: {
    name?: string;
    num_act?: string;
    num_federal?: string;
    description?: string;
    admin_name?: string;
    project_manager_name?: string;
    contractor_name?: string;
    cost_original?: number;
    cost_revised?: number;
    projected_increase?: number;
    start_date?: string;
    original_end_date?: string;
    revised_end_date?: string;
    estimated_end_date?: string;
    fund_source?: string;
  };
  lastCert?: {
    cert_num?: number;
    date?: string;
    amount?: number;
  } | null;
  certsTotal?: number;
  actLogoUrl?: string | null;
}

/** Convierte URL de imagen a base64 */
async function urlToBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  } catch {
    return null;
  }
}

/** Detecta extensión de imagen a partir de URL */
function getImgExt(url: string): "png" | "jpg" {
  const clean = url.split("?")[0].toLowerCase();
  return clean.endsWith(".png") ? "png" : "jpg";
}

export async function generatePresentationPptx(data: PresentationData): Promise<Blob> {
  const pptx = new PptxGenJS();

  // Dimensiones estándar 16:9 (inches)
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 inches

  // ─────────────────────────────────────────────────────────────
  // SLIDE 1: PORTADA
  // ─────────────────────────────────────────────────────────────
  const slide1 = pptx.addSlide();

  // Fondo degradado: blanco → salmón/naranja (igual que el gradiente del PPTX)
  // pptxgenjs no admite gradientes directos en fondo, usamos rectángulo de fondo
  slide1.background = { fill: "FFFFFF" };

  // Rect. de fondo degradado simulado con rectángulos superpuestos
  slide1.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: "100%", h: "100%",
    // @ts-ignore
    fill: { type: "gradient", dir: "v", stops: [
      { position: 0,   color: "FFFFFF" },
      { position: 30,  color: "FFFFFF" },
      { position: 68,  color: "F5BB93" },
      { position: 100, color: "ED7D31" }
    ]}
  });

  // Logo ACT (esquina superior izquierda)
  if (data.actLogoUrl) {
    const logoB64 = await urlToBase64(data.actLogoUrl);
    if (logoB64) {
      slide1.addImage({
        data: `image/png;base64,${logoB64}`,
        x: 0.2, y: 0.1, w: 2.0, h: 1.2,
      });
    }
  }

  // Texto central: PROYECTOS ACTIVOS / DISTRITO METRO / FECHA DEL INFORME / [fecha]
  const presDateFormatted = new Date(data.presentationDate + "T12:00:00").toLocaleDateString("es-PR", {
    day: "numeric",
    month: "numeric",
    year: "numeric"
  });

  slide1.addText(
    [
      { text: "PROYECTOS ACTIVOS\n", options: { bold: true, fontSize: 36, color: "1F3864" } },
      { text: "DISTRITO METRO\n",    options: { bold: true, fontSize: 36, color: "1F3864" } },
      { text: "FECHA DEL INFORME\n", options: { bold: true, fontSize: 36, color: "1F3864" } },
      { text: presDateFormatted,     options: { bold: true, fontSize: 36, color: "1F3864" } },
    ],
    {
      x: 3.0, y: 2.0, w: 9.5, h: 4.5,
      align: "center",
      valign: "middle",
      fontFace: "Montserrat",
    }
  );

  // ─────────────────────────────────────────────────────────────
  // SLIDE 2: CONTENIDO
  // ─────────────────────────────────────────────────────────────
  const slide2 = pptx.addSlide();
  slide2.background = { fill: "FFFFFF" };

  const proj = data.project;
  const numAct   = proj.num_act    || "AC-XXXXX";
  const numFed   = proj.num_federal || "ER-XXXXX";
  const certsSum = data.certsTotal || 0;
  const origCost = proj.cost_original || 0;
  const revCost  = proj.cost_revised  || origCost;
  const pctCert  = revCost > 0 ? ((certsSum / revCost) * 100).toFixed(2) + "%" : "0.00%";

  // Logo ACT (esquina superior izquierda)
  if (data.actLogoUrl) {
    const logoB64 = await urlToBase64(data.actLogoUrl);
    if (logoB64) {
      slide2.addImage({
        data: `image/png;base64,${logoB64}`,
        x: 0.05, y: 0.05, w: 1.8, h: 1.0,
      });
    }
  }

  // Caja número de proyecto (superior, después del logo)
  slide2.addText(`${numAct} / ${numFed}`, {
    x: 2.0, y: 0.1, w: 7.0, h: 0.55,
    bold: true, fontSize: 22, color: "000000",
    fill: { color: "FFE5CC" },
    line: { pt: 1, color: "000000" },
    valign: "middle",
    margin: 0.05,
  });

  // Nombre del proyecto
  slide2.addText(proj.name?.substring(0, 80) || "Nombre del Proyecto", {
    x: 2.0, y: 0.7, w: 7.0, h: 0.4,
    bold: true, fontSize: 14, color: "000000",
    margin: 0.03,
  });

  // ── COLUMNA IZQUIERDA: Tabla de datos ──
  const COL1_X = 0.12;
  const COL1_W = 1.3;
  const COL2_W = 1.6;
  const TABLE_W = COL1_W + COL2_W;
  const TABLE_FONT = 9;
  const ROW_H = 0.22;

  // Cuadro descripción
  const desc = proj.description || "Proyecto de mejoras y rehabilitación.";
  slide2.addText([
    { text: "Descripción del Proyecto:\n", options: { bold: true, italic: true, fontSize: 10, color: "000000" } },
    { text: desc, options: { bold: false, italic: false, fontSize: 9, color: "000000" } }
  ], {
    x: COL1_X, y: 1.15, w: TABLE_W, h: 1.3,
    line: { pt: 1, color: "000000" },
    valign: "top",
    margin: 0.05,
    fontFace: "Calibri",
    wrap: true,
  });

  // Helper para filas de tabla izquierda
  let rowY = 2.52;
  const addTableRow = (label: string, value: string) => {
    // Celda label
    slide2.addText(label, {
      x: COL1_X, y: rowY, w: COL1_W, h: ROW_H,
      line: { pt: 1, color: "000000" },
      fontSize: TABLE_FONT, fontFace: "Calibri",
      margin: 0.03, valign: "middle",
    });
    // Celda valor
    slide2.addText(value, {
      x: COL1_X + COL1_W, y: rowY, w: COL2_W, h: ROW_H,
      line: { pt: 1, color: "000000" },
      fontSize: TABLE_FONT, fontFace: "Calibri", bold: true,
      margin: 0.03, valign: "middle",
    });
    rowY += ROW_H;
  };

  addTableRow("Administrador",              proj.admin_name             || "N/A");
  addTableRow("Supervisor",                 proj.project_manager_name   || "N/A");
  addTableRow("Contratista",                proj.contractor_name?.substring(0, 35) || "N/A");
  addTableRow("Fecha del Informe",          new Date(data.presentationDate + "T12:00:00").toLocaleDateString("es-ES", { month: "long", day: "numeric", year: "numeric" }));
  addTableRow("Costo Original",             formatCurrency(origCost));
  addTableRow("Costo Revisado",             formatCurrency(revCost));
  addTableRow("Incremento ($) Proyectado",  formatCurrency(proj.projected_increase || 0));

  // Celda "Última certificación" combinada
  const certDateStr  = data.lastCert?.date   ? formatDate(data.lastCert.date)             : "N/A";
  const certAmtStr   = data.lastCert?.amount !== undefined ? formatCurrency(data.lastCert.amount) : "$0.00";

  slide2.addText("Última\ncertificación", {
    x: COL1_X, y: rowY, w: COL1_W, h: ROW_H * 2,
    line: { pt: 1, color: "000000" },
    fontSize: TABLE_FONT, fontFace: "Calibri", bold: true,
    margin: 0.03, valign: "middle",
  });
  slide2.addText("Fecha:",  { x: COL1_X + COL1_W, y: rowY,          w: COL2_W / 2, h: ROW_H,  line: { pt: 1, color: "000000" }, fontSize: TABLE_FONT, fontFace: "Calibri", margin: 0.03, valign: "middle" });
  slide2.addText(certDateStr, { x: COL1_X + COL1_W + COL2_W / 2, y: rowY,   w: COL2_W / 2, h: ROW_H,  line: { pt: 1, color: "000000" }, fontSize: TABLE_FONT, fontFace: "Calibri", bold: true, margin: 0.03, valign: "middle" });
  slide2.addText("Monto:",  { x: COL1_X + COL1_W, y: rowY + ROW_H, w: COL2_W / 2, h: ROW_H,  line: { pt: 1, color: "000000" }, fontSize: TABLE_FONT, fontFace: "Calibri", margin: 0.03, valign: "middle" });
  slide2.addText(certAmtStr,  { x: COL1_X + COL1_W + COL2_W / 2, y: rowY + ROW_H, w: COL2_W / 2, h: ROW_H, line: { pt: 1, color: "000000" }, fontSize: TABLE_FONT, fontFace: "Calibri", bold: true, margin: 0.03, valign: "middle" });
  rowY += ROW_H * 2;

  addTableRow("Monto Certificado Acumulado",  formatCurrency(certsSum));
  addTableRow("Monto Ejecutado Acumulado",    formatCurrency(certsSum));
  addTableRow("Fecha de Comienzo",            formatDate(proj.start_date));
  addTableRow("Terminación Original (fecha)", formatDate(proj.original_end_date));
  addTableRow("Terminación Revisada (fecha)", formatDate(proj.revised_end_date));
  addTableRow("Terminación Proyectada",       formatDate(proj.estimated_end_date));
  addTableRow("% Obra Certificado",           pctCert);
  addTableRow("% Obra Ejecutado",             pctCert);
  addTableRow("% Tiempo",                     "0.00%");

  // Fila de Tipo de Fondo / Term. Sustanc.
  const QUARTER = TABLE_W / 4;
  slide2.addText("Tipo de Fondo",           { x: COL1_X,              y: rowY, w: QUARTER, h: ROW_H, line: { pt: 1, color: "000000" }, fontSize: 8, fontFace: "Calibri", margin: 0.02, valign: "middle" });
  slide2.addText(proj.fund_source || "Federal", { x: COL1_X + QUARTER,    y: rowY, w: QUARTER, h: ROW_H, line: { pt: 1, color: "000000" }, fontSize: 8, fontFace: "Calibri", bold: true, margin: 0.02, valign: "middle" });
  slide2.addText("Term. Sustanc.",          { x: COL1_X + QUARTER * 2, y: rowY, w: QUARTER, h: ROW_H, line: { pt: 1, color: "000000" }, fontSize: 8, fontFace: "Calibri", margin: 0.02, valign: "middle" });
  slide2.addText("No",                      { x: COL1_X + QUARTER * 3, y: rowY, w: QUARTER, h: ROW_H, line: { pt: 1, color: "000000" }, fontSize: 8, fontFace: "Calibri", bold: true, margin: 0.02, valign: "middle" });

  // ── COLUMNA CENTRAL: Actividades y Puntos Críticos ──
  const MID_X = 3.12;
  const MID_W = 4.5;

  // Actividades
  slide2.addText([
    { text: "Actividades Realizándose:\n", options: { bold: true, italic: true, fontSize: 13, color: "000000" } },
    { text: data.activities || "Ninguna.", options: { bold: false, italic: false, fontSize: 11, color: "000000" } }
  ], {
    x: MID_X, y: 1.15, w: MID_W, h: 4.0,
    line: { pt: 1, color: "000000" },
    valign: "top",
    margin: 0.1,
    fontFace: "Calibri",
    wrap: true,
  });

  // Puntos críticos
  slide2.addText([
    { text: "Puntos críticos a atender:\n", options: { bold: true, italic: true, fontSize: 13, color: "000000" } },
    { text: data.criticalPoints || "Ninguno al momento.", options: { bold: false, italic: false, fontSize: 11, color: "000000" } }
  ], {
    x: MID_X, y: 5.2, w: MID_W, h: 2.0,
    line: { pt: 1, color: "000000" },
    valign: "top",
    margin: 0.1,
    fontFace: "Calibri",
    wrap: true,
  });

  // ── COLUMNA DERECHA: Fotos ──
  const RIGHT_X  = 7.72;
  const PHOTO_W  = 5.4;
  const PHOTO_H  = 3.05;
  const PHOTO1_Y = 1.15;
  const PHOTO2_Y = PHOTO1_Y + PHOTO_H + 0.15;

  // Foto 1
  if (data.photo1Url) {
    const p1b64 = await urlToBase64(data.photo1Url);
    if (p1b64) {
      slide2.addImage({
        data: `image/${getImgExt(data.photo1Url)};base64,${p1b64}`,
        x: RIGHT_X, y: PHOTO1_Y, w: PHOTO_W, h: PHOTO_H,
        sizing: { type: "contain", w: PHOTO_W, h: PHOTO_H },
      });
    } else {
      slide2.addShape(pptx.ShapeType.rect, { x: RIGHT_X, y: PHOTO1_Y, w: PHOTO_W, h: PHOTO_H, fill: { color: "CCCCCC" }, line: { color: "000000", pt: 2 } });
      slide2.addText("PROYECTO AC", { x: RIGHT_X, y: PHOTO1_Y, w: PHOTO_W, h: PHOTO_H, align: "center", valign: "middle", fontSize: 14 });
    }
  } else {
    slide2.addShape(pptx.ShapeType.rect, { x: RIGHT_X, y: PHOTO1_Y, w: PHOTO_W, h: PHOTO_H, fill: { color: "EEEEEE" }, line: { color: "AAAAAA", pt: 2 } });
    slide2.addText("PROYECTO AC\n(Sin imagen)", { x: RIGHT_X, y: PHOTO1_Y, w: PHOTO_W, h: PHOTO_H, align: "center", valign: "middle", fontSize: 12, color: "999999" });
  }

  // Foto 2
  if (data.photo2Url) {
    const p2b64 = await urlToBase64(data.photo2Url);
    if (p2b64) {
      slide2.addImage({
        data: `image/${getImgExt(data.photo2Url)};base64,${p2b64}`,
        x: RIGHT_X, y: PHOTO2_Y, w: PHOTO_W, h: PHOTO_H,
        sizing: { type: "contain", w: PHOTO_W, h: PHOTO_H },
      });
    } else {
      slide2.addShape(pptx.ShapeType.rect, { x: RIGHT_X, y: PHOTO2_Y, w: PHOTO_W, h: PHOTO_H, fill: { color: "CCCCCC" }, line: { color: "000000", pt: 2 } });
      slide2.addText("PROYECTO AC", { x: RIGHT_X, y: PHOTO2_Y, w: PHOTO_W, h: PHOTO_H, align: "center", valign: "middle", fontSize: 14 });
    }
  } else {
    slide2.addShape(pptx.ShapeType.rect, { x: RIGHT_X, y: PHOTO2_Y, w: PHOTO_W, h: PHOTO_H, fill: { color: "EEEEEE" }, line: { color: "AAAAAA", pt: 2 } });
    slide2.addText("PROYECTO AC\n(Sin imagen)", { x: RIGHT_X, y: PHOTO2_Y, w: PHOTO_W, h: PHOTO_H, align: "center", valign: "middle", fontSize: 12, color: "999999" });
  }

  // ── Exportar a Blob ──
  const pptxBuf = await pptx.write({ outputType: "arraybuffer" }) as ArrayBuffer;
  return new Blob([pptxBuf], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
}

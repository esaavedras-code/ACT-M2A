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

  // Fondo degradado exacto de la plantilla
  slide1.background = { fill: "FFFFFF" };
  slide1.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: "100%", h: "100%",
    // @ts-ignore
    fill: { type: "gradient", dir: "v", stops: [
      { position: 0,   color: "FFFFFF" },
      { position: 3,   color: "FFFFFF" },
      { position: 18,  color: "FFFFFF" },
      { position: 68,  color: "F5BB93" },
      { position: 100, color: "ED7D31" }
    ]}
  });

  // Logo ACT (esquina superior izquierda, posición exacta)
  if (data.actLogoUrl) {
    const logoB64 = await urlToBase64(data.actLogoUrl);
    if (logoB64) {
      slide1.addImage({
        data: `image/png;base64,${logoB64}`,
        x: 0.1, y: 0.05, w: 2.5, h: 1.5,
      });
    }
  }

  // Texto central (Montserrat, Azul oscuro)
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
      x: 3.2, y: 2.2, w: 7.0, h: 3.5,
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

  // Logo ACT pequeño
  if (data.actLogoUrl) {
    const logoB64 = await urlToBase64(data.actLogoUrl);
    if (logoB64) {
      slide2.addImage({
        data: `image/png;base64,${logoB64}`,
        x: 0.05, y: 0.02, w: 1.8, h: 1.1,
      });
    }
  }

  // Caja número de proyecto (Superior)
  slide2.addText(`${numAct} / ${numFed}`, {
    x: 2.35, y: 0.14, w: 8.6, h: 0.5,
    bold: true, fontSize: 24, fontFace: "Montserrat", color: "1F3864",
    fill: { color: "F8F9FA" },
    line: { pt: 0.5, color: "D1D5DB" },
    valign: "middle",
    align: "left",
    margin: 0.1,
  });

  // Nombre del proyecto (Montserrat)
  slide2.addText(proj.name?.substring(0, 100) || "Nombre del Proyecto", {
    x: 2.2, y: 0.65, w: 10.5, h: 0.45,
    bold: true, fontSize: 18, fontFace: "Montserrat", color: "000000",
    valign: "middle",
  });

  // ── COLUMNA IZQUIERDA: Descripción y Tabla ──
  const COL_X = 0.18;
  const TABLE_W = 4.2;

  // Cuadro descripción
  const desc = proj.description || "N/A";
  slide2.addText([
    { text: "Descripción del Proyecto:\n", options: { bold: true, italic: true, fontSize: 11, color: "000000" } },
    { text: desc, options: { bold: false, italic: false, fontSize: 10, color: "000000" } }
  ], {
    x: COL_X, y: 1.2, w: TABLE_W, h: 1.6,
    line: { pt: 1, color: "000000" },
    valign: "top",
    margin: 0.1,
    fontFace: "Calibri",
  });

  // Tabla de datos (5 columnas, diseño denso)
  const rows = [
    ["Administrador", "", proj.admin_name || "N/A", "", ""],
    ["Supervisor", "", proj.project_manager_name || "N/A", "", ""],
    ["Contratista", "", proj.contractor_name || "N/A", "", ""],
    ["Fecha Informe", "", formatDate(data.presentationDate), "", ""],
    ["Costo Original", "", formatCurrency(origCost), "", ""],
    ["Costo Revisado", "", formatCurrency(revCost), "", ""],
    ["Inc. Proyectado", "", formatCurrency(proj.projected_increase || 0), "", ""],
    ["Cert. Fecha", "Fecha:", formatDate(data.lastCert?.date), "Monto:", formatCurrency(data.lastCert?.amount || 0)],
    ["Monto Cert. Acum.", "", formatCurrency(certsSum), "", ""],
    ["Monto Ejec. Acum.", "", formatCurrency(certsSum), "", ""],
    ["Fecha Comienzo", "", formatDate(proj.start_date), "", ""],
    ["Term. Original", "", formatDate(proj.original_end_date), "", ""],
    ["Term. Revisada", "", formatDate(proj.revised_end_date), "", ""],
    ["Term. Proyectada", "", formatDate(proj.estimated_end_date), "", ""],
    ["% Obra Cert.", "", pctCert, "", ""],
    ["% Obra Ejec.", "", pctCert, "", ""],
    ["% Tiempo", "", "0.00%", "", ""],
    ["Fondo / Term. Sust.", proj.fund_source || "Federal", "", "Term. Sust.", "No"]
  ];

  slide2.addTable(rows.map(r => r.map(c => ({ text: c, options: { fontSize: 8, fontFace: "Calibri", bold: true, border: { pt: 0.5, color: "333333" }, valign: "middle" } }))), {
    x: COL_X, y: 2.9, w: TABLE_W,
    colW: [1.3, 0.4, 1.2, 0.8, 0.5],
  });

  // ── COLUMNA CENTRAL: Actividades y Puntos ──
  const MID_X = 4.5;
  const MID_W = 4.4;

  slide2.addText([
    { text: "Actividades Realizándose:\n", options: { bold: true, italic: true, fontSize: 13, color: "000000" } },
    { text: data.activities || "Sin actividades registradas.", options: { bold: false, italic: false, fontSize: 11, color: "000000" } }
  ], {
    x: MID_X, y: 1.2, w: MID_W, h: 3.3,
    line: { pt: 1, color: "000000" },
    valign: "top", margin: 0.1, fontFace: "Calibri",
  });

  slide2.addText([
    { text: "Puntos críticos a atender:\n", options: { bold: true, italic: true, fontSize: 13, color: "000000" } },
    { text: data.criticalPoints || "Ninguno al momento.", options: { bold: false, italic: false, fontSize: 11, color: "000000" } }
  ], {
    x: MID_X, y: 4.55, w: MID_W, h: 2.8,
    line: { pt: 1, color: "000000" },
    valign: "top", margin: 0.1, fontFace: "Calibri",
  });

  // ── COLUMNA DERECHA: Fotos ──
  const RIGHT_X = 9.2;
  const PHOTO_W = 3.8;
  const PHOTO_H = 2.7;

  const addPhoto = async (url: string | null, y: number) => {
    if (url) {
      const b64 = await urlToBase64(url);
      if (b64) {
        slide2.addImage({
          data: `image/${getImgExt(url)};base64,${b64}`,
          x: RIGHT_X, y: y, w: PHOTO_W, h: PHOTO_H,
          sizing: { type: "cover", w: PHOTO_W, h: PHOTO_H },
        });
        // Borde grueso alrededor de la foto
        slide2.addShape(pptx.ShapeType.rect, {
          x: RIGHT_X, y: y, w: PHOTO_W, h: PHOTO_H,
          line: { pt: 5, color: "000000" }, 
          fill: { color: "none" }
        });
      }
    } else {
       slide2.addShape(pptx.ShapeType.rect, { x: RIGHT_X, y: y, w: PHOTO_W, h: PHOTO_H, fill: { color: "F3F4F6" }, line: { color: "9CA3AF", pt: 1 } });
       slide2.addText("PROYECTO AC\n(Sin imagen)", { x: RIGHT_X, y: y, w: PHOTO_W, h: PHOTO_H, align: "center", valign: "middle", fontSize: 12, color: "6B7280" });
    }
  };

  await addPhoto(data.photo1Url, 1.2);
  await addPhoto(data.photo2Url, 4.4);

  // ── Exportar a Blob ──
  const pptxBuf = await pptx.write({ outputType: "arraybuffer" }) as ArrayBuffer;
  return new Blob([pptxBuf], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
}

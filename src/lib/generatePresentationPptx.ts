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

  // Colores del Manual de Identidad ACT (según fotos)
  const ACT_BLUE = "2E5077";
  const ACT_ORANGE_LITE = "FB923C"; // Naranja suave
  const ACT_BEIGE = "FDF2E9";       // Fondo claro cajas

  // ─────────────────────────────────────────────────────────────
  // SLIDE 1: PORTADA
  // ─────────────────────────────────────────────────────────────
  const slide1 = pptx.addSlide();

  // Fondo con degradado naranja suave a blanco (según foto 1)
  slide1.background = { 
    fill: { 
      type: "gradient", 
      color: "FFFFFF", 
      alpha: 100,
      stops: [
        { offset: 0, color: "FFFFFF" },
        { offset: 100, color: "FDBA74" }
      ] 
    } 
  };

  // Logo ACT (esquina superior izquierda)
  if (data.actLogoUrl) {
    const logoB64 = await urlToBase64(data.actLogoUrl);
    if (logoB64) {
      slide1.addImage({
        data: `image/png;base64,${logoB64}`,
        x: 0.1, y: 0.05, w: 2.2, h: 1.3,
      });
    }
  }

  // Texto central en AZUL OSCURO (según foto 1)
  const presDateFormatted = new Date(data.presentationDate + "T12:00:00").toLocaleDateString("es-PR", {
    day: "numeric",
    month: "numeric",
    year: "numeric"
  });

  slide1.addText(
    [
      { text: "PROYECTOS ACTIVOS\n", options: { bold: true, fontSize: 44, color: ACT_BLUE } },
      { text: "DISTRITO METRO\n",    options: { bold: true, fontSize: 36, color: ACT_BLUE } },
      { text: "FECHA DEL INFORME\n", options: { bold: true, fontSize: 32, color: ACT_BLUE } },
      { text: presDateFormatted,     options: { bold: true, fontSize: 36, color: ACT_BLUE } },
    ],
    {
      x: 0, y: 0, w: "100%", h: "100%",
      align: "center",
      valign: "middle",
      fontFace: "Calibri (Body)",
    }
  );

  // ─────────────────────────────────────────────────────────────
  // SLIDE 2: CONTENIDO POR PROYECTO
  // ─────────────────────────────────────────────────────────────
  const slide2 = pptx.addSlide();
  slide2.background = { fill: "FFFFFF" };

  // Franja naranja lateral derecha (Diseño según foto 2)
  slide2.addShape(pptx.ShapeType.rect, {
    x: 12.8, y: 0, w: 0.53, h: 7.5,
    fill: { color: ACT_ORANGE_LITE }
  });

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
        x: 0.1, y: 0.1, w: 1.8, h: 1.1,
      });
    }
  }

  // Caja ID del proyecto en Naranja Claro / Beige (Superior)
  slide2.addText(`${numAct} / ${numFed}`, {
    x: 2.3, y: 0.2, w: 8.5, h: 0.6,
    bold: true, fontSize: 26, fontFace: "Calibri", color: "000000",
    fill: { color: ACT_BEIGE },
    line: { pt: 0.5, color: "AFAFAF" },
    valign: "middle",
    align: "left",
    margin: 10,
  });

  // Título del proyecto en NEGRO / AZUL (Debajo)
  slide2.addText(proj.name?.toUpperCase() || "NOMBRE DEL PROYECTO", {
    x: 2.15, y: 0.9, w: 10.5, h: 0.5,
    bold: true, fontSize: 20, fontFace: "Calibri", color: "000000",
    valign: "middle",
  });

  // ── COLUMNA IZQUIERDA: Descripción y Tabla ──
  const COL_X = 0.15;
  const TABLE_W = 4.3;

  // Título Descripción
  slide2.addText("Descripción del Proyecto:", { x: COL_X, y: 1.5, w: TABLE_W, h: 0.3, bold: true, italic: true, fontSize: 11, color: "000000" });
  
  // Marco de la descripción
  const desc = proj.description || "Sin descripción disponible.";
  slide2.addText(desc, {
    x: COL_X, y: 1.8, w: TABLE_W, h: 1.5,
    line: { pt: 1, color: "000000" },
    valign: "top",
    margin: 5,
    fontSize: 10,
    fontFace: "Calibri",
  });

  // Tabla técnica (Bordes negros según foto 2)
  const rows = [
    ["Administrador", proj.admin_name || "N/A", ""],
    ["Supervisor", proj.project_manager_name || "N/A", ""],
    ["Contratista", proj.contractor_name || "N/A", ""],
    ["Fecha del Informe", formatDate(data.presentationDate), ""],
    ["Costo Original", formatCurrency(origCost), ""],
    ["Costo Revisado", formatCurrency(revCost), ""],
    ["Incremento ($) Proyectado", formatCurrency(proj.projected_increase || 0), ""],
    ["Última certificación", `Fecha: ${formatDate(data.lastCert?.date)}`, `Monto: ${formatCurrency(data.lastCert?.amount || 0)}`],
    ["Monto Certificado Acumulado", formatCurrency(certsSum), ""],
    ["Monto Ejecutado Acumulado", formatCurrency(certsSum), ""],
    ["Fecha de Comienzo", formatDate(proj.start_date), ""],
    ["Terminación Original (fecha)", formatDate(proj.original_end_date), ""],
    ["Terminación Revisada (fecha)", formatDate(proj.revised_end_date), ""],
    ["Terminación Proyectada (fecha)", formatDate(proj.estimated_end_date), ""],
    ["% Obra Certificado", pctCert, ""],
    ["% Obra Ejecutado", pctCert, ""],
    ["% Tiempo", "0.00%", ""],
    ["Tipo de Fondo / Term. Sust.", proj.fund_source || "Federal", "Terminación Sustancial: No"]
  ];

  slide2.addTable(rows.map(r => r.map(c => ({ 
    text: c, 
    options: { 
      fontSize: 8, 
      fontFace: "Calibri", 
      bold: true, 
      border: { pt: 0.5, color: "000000" }, 
      valign: "middle" 
    } 
  }))), {
    x: COL_X, y: 3.4, w: TABLE_W,
    colW: [1.6, 1.4, 1.3],
  });

  // ── COLUMNA CENTRAL: Actividades y Puntos ──
  const MID_X = 4.6;
  const MID_W = 4.4;

  slide2.addText("Actividades Realizándose:", { x: MID_X, y: 1.5, w: MID_W, h: 0.3, bold: true, italic: true, fontSize: 13, color: "000000" });
  slide2.addText(data.activities || "1. Actividades por registrar.", {
    x: MID_X, y: 1.8, w: MID_W, h: 3.1,
    line: { pt: 1, color: "000000" },
    valign: "top", margin: 5, fontFace: "Calibri", fontSize: 11
  });

  slide2.addText("Puntos críticos a atender:", { x: MID_X, y: 5.0, w: MID_W, h: 0.3, bold: true, italic: true, fontSize: 13, color: "000000" });
  slide2.addText(data.criticalPoints || "1. Ninguno al momento.", {
    x: MID_X, y: 5.3, w: MID_W, h: 2.05,
    line: { pt: 1, color: "000000" },
    valign: "top", margin: 5, fontFace: "Calibri", fontSize: 11
  });

  // ── COLUMNA DERECHA: Fotos con Borde Doble (Negro) ──
  const RIGHT_X = 9.15;
  const PHOTO_W = 3.5;
  const PHOTO_H = 2.9;

  const addPhoto = async (url: string | null, y: number) => {
    if (url) {
      const b64 = await urlToBase64(url);
      if (b64) {
        // Marco externo negro grueso
        slide2.addShape(pptx.ShapeType.rect, {
          x: RIGHT_X - 0.05, y: y - 0.05, w: PHOTO_W + 0.1, h: PHOTO_H + 0.1,
          line: { pt: 4, color: "000000" }, fill: { color: "none" }
        });
        
        // Imagen
        slide2.addImage({
          data: `image/${getImgExt(url)};base64,${b64}`,
          x: RIGHT_X, y: y, w: PHOTO_W, h: PHOTO_H,
          sizing: { type: "cover", w: PHOTO_W, h: PHOTO_H },
        });
      }
    } else {
       slide2.addShape(pptx.ShapeType.rect, { x: RIGHT_X, y: y, w: PHOTO_W, h: PHOTO_H, fill: { color: "F3F4F6" }, line: { color: "000000", pt: 1.5 } });
       slide2.addText("(Sin imagen)", { x: RIGHT_X, y: y, w: PHOTO_W, h: PHOTO_H, align: "center", valign: "middle", fontSize: 12, color: "6B7280" });
    }
  };

  await addPhoto(data.photo1Url, 1.5);
  await addPhoto(data.photo2Url, 4.5);

  // ── Exportar a Blob ──
  const pptxBuf = await pptx.write({ outputType: "arraybuffer" }) as ArrayBuffer;
  return new Blob([pptxBuf], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
}

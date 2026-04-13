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

  // Dimensiones estándar 13.33 x 7.5 inches
  pptx.layout = "LAYOUT_WIDE"; 

  // Colores (HEX strings sin #)
  const ACT_BLUE = "2E5077";
  const ACT_ORANGE_LITE = "FB923C"; 
  const ACT_BEIGE = "FDF2E9";       

  // ─────────────────────────────────────────────────────────────
  // SLIDE 1: PORTADA
  // ─────────────────────────────────────────────────────────────
  const slide1 = pptx.addSlide();

  // Gradiente de fondo (Simplificado para evitar errores de tipo)
  slide1.background = { 
    fill: { 
      type: "gradient", 
      angle: 90,
      stops: [
        { offset: 0, color: "FFFFFF" },
        { offset: 100, color: "FDBA74" }
      ] 
    } 
  };

  // Logo ACT
  if (data.actLogoUrl) {
    const logoB64 = await urlToBase64(data.actLogoUrl);
    if (logoB64) {
      slide1.addImage({
        data: `image/png;base64,${logoB64}`,
        x: 0.1, y: 0.05, w: 2.2, h: 1.3,
      });
    }
  }

  // Texto central
  const presDateFormatted = String(new Date(data.presentationDate + "T12:00:00").toLocaleDateString("es-PR", {
    day: "numeric", month: "numeric", year: "numeric"
  }));

  slide1.addText(
    [
      { text: "PROYECTOS ACTIVOS\n", options: { bold: true, fontSize: 44, color: ACT_BLUE } },
      { text: "DISTRITO METRO\n",    options: { bold: true, fontSize: 36, color: ACT_BLUE } },
      { text: "FECHA DEL INFORME\n", options: { bold: true, fontSize: 32, color: ACT_BLUE } },
      { text: presDateFormatted,     options: { bold: true, fontSize: 36, color: ACT_BLUE } },
    ],
    {
      x: 0, y: 1.5, w: 13.33, h: 4.5,
      align: "center", valign: "middle", 
      fontFace: "Calibri",
    }
  );

  // ─────────────────────────────────────────────────────────────
  // SLIDE 2: CONTENIDO POR PROYECTO
  // ─────────────────────────────────────────────────────────────
  const slide2 = pptx.addSlide();
  slide2.background = { fill: "FFFFFF" };

  // Franja lateral
  slide2.addShape(pptx.ShapeType.rect, {
    x: 12.8, y: 0, w: 0.53, h: 7.5,
    fill: { color: ACT_ORANGE_LITE }
  });

  const proj = data.project;
  const numAct   = String(proj.num_act    || "AC-XXXXX");
  const numFed   = String(proj.num_federal || "ER-XXXXX");
  const certsSum = data.certsTotal || 0;
  const origCost = proj.cost_original || 0;
  const revCost  = proj.cost_revised  || origCost;
  const pctCert  = revCost > 0 ? ((certsSum / revCost) * 100).toFixed(2) + "%" : "0.00%";

  // Logo pequeño
  if (data.actLogoUrl) {
    const logoB64 = await urlToBase64(data.actLogoUrl);
    if (logoB64) {
      slide2.addImage({
        data: `image/png;base64,${logoB64}`,
        x: 0.1, y: 0.1, w: 1.8, h: 1.1,
      });
    }
  }

  // Caja ID
  slide2.addText(`${numAct} / ${numFed}`, {
    x: 2.3, y: 0.2, w: 8.5, h: 0.6,
    bold: true, fontSize: 26, fontFace: "Calibri", color: "000000",
    fill: { color: ACT_BEIGE },
    line: { pt: 0.5, color: "AFAFAF" },
    valign: "middle", align: "left", margin: 10,
  });

  // Título
  slide2.addText(String(proj.name || "NOMBRE DEL PROYECTO").toUpperCase(), {
    x: 2.15, y: 0.9, w: 10.5, h: 0.5,
    bold: true, fontSize: 20, fontFace: "Calibri", color: "000000",
    valign: "middle",
  });

  const COL_X = 0.15;
  const TABLE_W = 4.3;

  slide2.addText("Descripción del Proyecto:", { x: COL_X, y: 1.5, w: TABLE_W, h: 0.3, bold: true, italic: true, fontSize: 11, color: "000000" });
  slide2.addText(String(proj.description || "Sin descripción."), {
    x: COL_X, y: 1.8, w: TABLE_W, h: 1.5, line: { pt: 1, color: "000000" },
    valign: "top", margin: 5, fontSize: 10, fontFace: "Calibri",
  });

  // Filas de tabla (Asegurando strings en cada celda)
  const rows = [
    ["Administrador", String(proj.admin_name || "N/A"), ""],
    ["Supervisor", String(proj.project_manager_name || "N/A"), ""],
    ["Contratista", String(proj.contractor_name || "N/A"), ""],
    ["Fecha del Informe", String(formatDate(data.presentationDate)), ""],
    ["Costo Original", String(formatCurrency(origCost)), ""],
    ["Costo Revisado", String(formatCurrency(revCost)), ""],
    ["Incremento ($) Proyectado", String(formatCurrency(proj.projected_increase || 0)), ""],
    ["Última certificación", `Fecha: ${formatDate(data.lastCert?.date)}`, `Monto: ${formatCurrency(data.lastCert?.amount || 0)}`],
    ["Monto Certificado Acumulado", String(formatCurrency(certsSum)), ""],
    ["Monto Ejecutado Acumulado", String(formatCurrency(certsSum)), ""],
    ["Fecha de Comienzo", String(formatDate(proj.start_date)), ""],
    ["Terminación Original (fecha)", String(formatDate(proj.original_end_date)), ""],
    ["Terminación Revisada (fecha)", String(formatDate(proj.revised_end_date)), ""],
    ["Terminación Proyectada (fecha)", String(formatDate(proj.estimated_end_date)), ""],
    ["% Obra Certificado", String(pctCert), ""],
    ["% Obra Ejecutado", String(pctCert), ""],
    ["% Tiempo", "0.00%", ""],
    ["Tipo de Fondo / Term. Sust.", String(proj.fund_source || "Federal"), "Terminación Sustancial: No"]
  ];

  slide2.addTable(rows.map(r => r.map(c => ({ 
    text: String(c), 
    options: { fontSize: 8, fontFace: "Calibri", bold: true, border: { pt: 0.5, color: "000000" }, valign: "middle" } 
  }))), {
    x: COL_X, y: 3.4, w: TABLE_W, colW: [1.6, 1.4, 1.3],
  });

  const MID_X = 4.6;
  const MID_W = 4.4;

  slide2.addText("Actividades Realizándose:", { x: MID_X, y: 1.5, w: MID_W, h: 0.3, bold: true, italic: true, fontSize: 13, color: "000000" });
  slide2.addText(String(data.activities || "1. Pendiente."), {
    x: MID_X, y: 1.8, w: MID_W, h: 3.1, line: { pt: 1, color: "000000" },
    valign: "top", margin: 5, fontFace: "Calibri", fontSize: 11
  });

  slide2.addText("Puntos críticos a atender:", { x: MID_X, y: 5.0, w: MID_W, h: 0.3, bold: true, italic: true, fontSize: 13, color: "000000" });
  slide2.addText(String(data.criticalPoints || "1. Ninguno."), {
    x: MID_X, y: 5.3, w: MID_W, h: 2.05, line: { pt: 1, color: "000000" },
    valign: "top", margin: 5, fontFace: "Calibri", fontSize: 11
  });

  const RIGHT_X = 9.15;
  const PHOTO_W = 3.5;
  const PHOTO_H = 2.9;

  const addPhoto = async (url: string | null, y: number) => {
    if (url) {
      const b64 = await urlToBase64(url);
      if (b64) {
        slide2.addShape(pptx.ShapeType.rect, { x: RIGHT_X - 0.05, y: y - 0.05, w: PHOTO_W + 0.1, h: PHOTO_H + 0.1, line: { pt: 4, color: "000000" }, fill: { color: "none" } });
        slide2.addImage({ data: `image/${getImgExt(url)};base64,${b64}`, x: RIGHT_X, y: y, w: PHOTO_W, h: PHOTO_H, sizing: { type: "cover", w: PHOTO_W, h: PHOTO_H } });
      }
    } else {
       slide2.addShape(pptx.ShapeType.rect, { x: RIGHT_X, y: y, w: PHOTO_W, h: PHOTO_H, fill: { color: "F3F4F6" }, line: { color: "000000", pt: 1.5 } });
       slide2.addText("(Sin imagen)", { x: RIGHT_X, y: y, w: PHOTO_W, h: PHOTO_H, align: "center", valign: "middle", fontSize: 12, color: "6B7280" });
    }
  };

  await addPhoto(data.photo1Url, 1.5);
  await addPhoto(data.photo2Url, 4.5);

  const pptxBuf = await pptx.write({ outputType: "arraybuffer" }) as ArrayBuffer;
  return new Blob([pptxBuf], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
}

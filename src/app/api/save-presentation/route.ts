import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(req: Request) {
  try {
    const { base64, filename } = await req.json();

    if (!base64 || !filename) {
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    }

    // Ruta base del programa (ajustar según el entorno si es necesario)
    // Para Enrique, usaremos la ruta absoluta solicitada
    const baseDir = "C:\\Users\\Enrique Saavedra\\Documents\\PROGRAMAS AI\\Programa ACT Administrador\\presentaciones";
    
    // Asegurar que el directorio existe
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }

    const filePath = path.join(baseDir, filename);
    const buffer = Buffer.from(base64, 'base64');

    fs.writeFileSync(filePath, buffer);

    console.log(`[SavePresentation] Archivo guardado en: ${filePath}`);

    return NextResponse.json({ success: true, path: filePath });
  } catch (error: any) {
    console.error("[SavePresentation] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

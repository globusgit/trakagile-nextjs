import fs from "fs";
import path from "path";
import { UPLOAD_DIR } from "@/lib/uploadConfig";

export async function GET(req, context) {
  try {
    const { path: fileParts } = await context.params;

    if (!fileParts || fileParts.length === 0) {
      return new Response("Invalid path", { status: 400 });
    }

    const decodedPath = fileParts.map((p) => decodeURIComponent(p));
    const filePath = path.join(UPLOAD_DIR, ...decodedPath);

    if (!fs.existsSync(filePath)) {
      return new Response("File not found", { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);
    const fileName = decodedPath[decodedPath.length - 1];
    const ext = fileName.split(".").pop().toLowerCase();

    const mimeTypes = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      pdf: "application/pdf",
    };

    return new Response(fileBuffer, {
      headers: {
        "Content-Type": mimeTypes[ext] || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch (err) {
    console.error("ERROR:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}
// GET /api/media-file?path=leave-before-you-arrive/parkour.mp4
// Serves files from the project-root assets/ directory.
// The Remotion Player's mediaBase is set to "/api/media-file?path="
// so all clip src values become e.g. /api/media-file?path=leave-before-you-arrive/parkour.mp4

import fs from "fs";
import path from "path";

const ASSETS_ROOT = path.resolve(process.cwd(), "..", "assets");

const MIME = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".aac": "audio/aac",
  ".m4a": "audio/mp4",
};

export default function handler(req, res) {
  const relPath = req.query.path;
  if (!relPath) return res.status(400).end("path required");

  // Prevent path traversal
  const resolved = path.resolve(ASSETS_ROOT, relPath);
  if (!resolved.startsWith(ASSETS_ROOT)) {
    return res.status(403).end("forbidden");
  }

  if (!fs.existsSync(resolved)) {
    return res.status(404).end("not found");
  }

  const ext = path.extname(resolved).toLowerCase();
  const mime = MIME[ext] ?? "application/octet-stream";
  const stat = fs.statSync(resolved);
  const size = stat.size;

  // Range support so the browser <video> element can seek
  const range = req.headers.range;
  if (range) {
    const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
    const start = parseInt(startStr, 10);
    const end = endStr ? parseInt(endStr, 10) : size - 1;
    const chunkSize = end - start + 1;

    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize,
      "Content-Type": mime,
    });
    fs.createReadStream(resolved, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      "Content-Length": size,
      "Content-Type": mime,
      "Accept-Ranges": "bytes",
    });
    fs.createReadStream(resolved).pipe(res);
  }
}

export const config = {
  api: { responseLimit: false },
};

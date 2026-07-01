// GET /api/download?path=renders/leave_before_you_arrive-1234567890.mp4
// Streams a rendered file back as a download from the project root.

import fs from "fs";
import path from "path";

const PROJECT_ROOT = path.resolve(process.cwd(), "..");

export default function handler(req, res) {
  const relPath = req.query.path;
  if (!relPath) return res.status(400).end("path required");

  const resolved = path.resolve(PROJECT_ROOT, relPath);
  if (!resolved.startsWith(PROJECT_ROOT))
    return res.status(403).end("forbidden");
  if (!fs.existsSync(resolved)) return res.status(404).end("not found");

  const filename = path.basename(resolved);
  const size = fs.statSync(resolved).size;

  res.writeHead(200, {
    "Content-Type": "video/mp4",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Content-Length": size,
  });
  fs.createReadStream(resolved).pipe(res);
}

export const config = { api: { responseLimit: false } };

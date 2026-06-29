import fs from "fs";
import path from "path";

const VIDEO_EXT = new Set([".mp4", ".webm", ".mov", ".mkv"]);
const AUDIO_EXT = new Set([".mp3", ".wav", ".ogg", ".aac", ".flac", ".m4a"]);

// Skip files larger than 50 MB — they're source masters, not preview-able in browser
const MAX_BYTES = 50 * 1024 * 1024;

function scan(dir, publicRoot) {
  const entries = [];
  if (!fs.existsSync(dir)) return entries;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      entries.push(...scan(full, publicRoot));
    } else if (stat.size <= MAX_BYTES) {
      const ext = path.extname(name).toLowerCase();
      const type = VIDEO_EXT.has(ext)
        ? "video"
        : AUDIO_EXT.has(ext)
        ? "audio"
        : null;
      if (type) {
        entries.push({
          name,
          type,
          url: full.replace(publicRoot, "").replace(/\\/g, "/"),
          sizeKb: Math.round(stat.size / 1024),
        });
      }
    }
  }
  return entries;
}

export default function handler(req, res) {
  const publicDir = path.join(process.cwd(), "public");
  const assetsDir = path.resolve(process.cwd(), "..", "assets");

  // Files from public/ keep their existing URL shape (/filename)
  const fromPublic = scan(publicDir, publicDir);

  // Files from assets/ are served via /api/media-file?path=...
  // so the url field uses that shape so the media bin can link to them.
  const fromAssets = scan(assetsDir, assetsDir).map((f) => ({
    ...f,
    url: `/api/media-file?path=${encodeURIComponent(f.url.replace(/^\//, ""))}`,
  }));

  res.status(200).json([...fromPublic, ...fromAssets]);
}

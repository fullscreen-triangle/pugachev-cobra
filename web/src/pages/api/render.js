// POST /api/render
// Body: { sceneName: string, ir: IRNode }
// Spawns `remotion render` at the project root and streams the output path back.
// Requires @remotion/cli to be installed at the root (it is, in devDependencies).

import { execFile } from "child_process";
import path from "path";
import fs from "fs";

const PROJECT_ROOT = path.resolve(process.cwd(), "..");
const ENTRY_POINT = path.join(PROJECT_ROOT, "remotion", "index.ts");
const OUTPUT_DIR = path.join(PROJECT_ROOT, "renders");

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { compositionId } = req.body ?? {};
  if (!compositionId) {
    return res.status(400).json({ error: "compositionId required" });
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const outFile = path.join(OUTPUT_DIR, `${compositionId}-${Date.now()}.mp4`);

  const npx = process.platform === "win32" ? "npx.cmd" : "npx";

  return new Promise((resolve) => {
    execFile(
      npx,
      [
        "remotion",
        "render",
        ENTRY_POINT,
        compositionId,
        outFile,
        "--codec=h264",
      ],
      { cwd: PROJECT_ROOT, timeout: 10 * 60 * 1000 },
      (err, stdout, stderr) => {
        if (err) {
          resolve(
            res.status(500).json({
              error: "Render failed",
              detail: stderr || err.message,
            })
          );
        } else {
          resolve(
            res.status(200).json({
              ok: true,
              path: path.relative(PROJECT_ROOT, outFile),
              stdout,
            })
          );
        }
      }
    );
  });
}

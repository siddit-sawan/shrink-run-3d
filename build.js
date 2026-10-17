// Builds dist/poki.zip and dist/crazygames.zip, plus unzipped dist/poki/ and dist/crazygames/ (index.html at the top level of each zip).
// Usage: node build.js
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');

const portals = ['poki', 'crazygames'];
const entries = ['index.html', 'style.css', 'js', 'fonts', 'audio'];
// on Windows use the built-in bsdtar, not the GNU tar that Git Bash puts first on PATH
const tarBin = process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:/Windows', 'System32', 'tar.exe') : 'tar';
const dist = path.join(__dirname, 'dist');

fs.mkdirSync(dist, { recursive: true });

for (const portal of portals) {
  const src = path.join(__dirname, portal);
  for (const e of entries) {
    if (!fs.existsSync(path.join(src, e))) throw new Error(`${portal}/${e} is missing`);
  }
  // unzipped copy for local testing, always replaced so it never goes stale
  const out = path.join(dist, portal);
  fs.rmSync(out, { recursive: true, force: true });
  for (const e of entries) fs.cpSync(path.join(src, e), path.join(out, e), { recursive: true });
  const zip = path.join(dist, `${portal}.zip`);
  fs.rmSync(zip, { force: true });
  // bsdtar (Windows, macOS) writes zips with -a; other systems use the zip command
  if (process.platform === 'win32' || process.platform === 'darwin') {
    execFileSync(tarBin, ['-a', '-cf', zip, ...entries], { cwd: src });
  } else {
    execFileSync('zip', ['-qr', zip, ...entries], { cwd: src });
  }
  console.log(`${portal}.zip  ${(fs.statSync(zip).size / 1024 / 1024).toFixed(2)} MB`);
}

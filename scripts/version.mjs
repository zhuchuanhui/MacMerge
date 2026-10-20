import fs from 'node:fs';
const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) throw new Error('Usage: npm run version:set -- 0.1.1');
for (const file of ['package.json', 'package-lock.json', 'src-tauri/tauri.conf.json']) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  data.version = version;
  if (data.packages?.['']) data.packages[''].version = version;
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}
for (const file of ['src-tauri/Cargo.toml', 'src-tauri/Cargo.lock']) {
  const source = fs.readFileSync(file, 'utf8');
  const pattern = /(name = "macmerge"\nversion = ")[^"]+("[\r\n])/;
  if (!pattern.test(source)) throw new Error(`Package version missing: ${file}`);
  fs.writeFileSync(file, source.replace(pattern, `$1${version}$2`));
}

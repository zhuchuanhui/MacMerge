import fs from 'node:fs';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const version = read('package.json').version;
for (const file of ['package-lock.json', 'src-tauri/tauri.conf.json']) {
  const data = read(file);
  if (data.version !== version || (data.packages?.[''] && data.packages[''].version !== version)) throw new Error(`Version mismatch: ${file}`);
}
for (const file of ['src-tauri/Cargo.toml', 'src-tauri/Cargo.lock']) {
  if (fs.readFileSync(file, 'utf8').match(/name = "macmerge"\nversion = "([^"]+)"/)?.[1] !== version) throw new Error(`Version mismatch: ${file}`);
}
if (process.argv[2] && process.argv[2] !== `v${version}`) throw new Error('Release tag must match package version');
const config = read('deployment.config.json');
if (!['undecided', 'local-only', 'manual', 'automatic'].includes(config.deploymentMode)) throw new Error('Invalid deploymentMode');
if (typeof config.requiresApproval !== 'boolean') throw new Error('requiresApproval must be boolean');
if (['undecided', 'local-only'].includes(config.deploymentMode) && (config.provider !== null || config.environment !== null || config.deploymentTrigger !== 'none' || config.requiresApproval !== true)) throw new Error('Inactive deployment must have no provider, environment or trigger and must require approval');
console.log(`Release configuration valid: v${version}`);

/**
 * License inventory — lists root + server dependencies.
 * Run: npx tsx scripts/audit-licenses.ts
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface PkgDep {
  name: string;
  version: string;
  license?: string;
}

function readDeps(pkgPath: string): PkgDep[] {
  if (!existsSync(pkgPath)) return [];
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  return Object.entries(deps).map(([name, version]) => ({
    name,
    version: String(version),
    license: 'SEE node_modules',
  }));
}

function main() {
  const root = readDeps(join(process.cwd(), 'package.json'));
  const server = readDeps(join(process.cwd(), 'server', 'package.json'));
  const admin = readDeps(join(process.cwd(), 'admin', 'package.json'));

  console.log('=== NKT License Inventory ===');
  console.log(`Mobile deps: ${root.length}`);
  console.log(`Server deps: ${server.length}`);
  console.log(`Admin deps: ${admin.length}`);

  const all = [...root, ...server, ...admin];
  const unique = new Map<string, PkgDep>();
  for (const d of all) unique.set(d.name, d);

  console.log(`\nUnique packages: ${unique.size}`);
  for (const d of [...unique.values()].sort((a, b) => a.name.localeCompare(b.name))) {
    console.log(`  ${d.name}@${d.version}`);
  }
}

main();

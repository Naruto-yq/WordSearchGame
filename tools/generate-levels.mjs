import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const levelsDir = join(root, 'tools/generated-levels');
const outDir = join(root, '.tmp/generated-levels-dist');
const maxLevel = 300;
const require = createRequire(import.meta.url);

await rm(outDir, { recursive: true, force: true });
execFileSync(join(root, 'node_modules/.bin/tsc'), [
  '--outDir', outDir,
  '--module', 'CommonJS',
  '--moduleResolution', 'Node',
  '--target', 'ES2020',
  '--experimentalDecorators',
  '--skipLibCheck',
], { stdio: 'inherit' });

const { createLevelConfig, getLevelRepeatStats } = require(join(outDir, 'core/LevelGenerator.js'));

await mkdir(levelsDir, { recursive: true });

const index = { levels: [] };
for (let id = 1; id <= maxLevel; id += 1) {
  const name = `level_${String(id).padStart(3, '0')}`;
  index.levels.push(name);
  await writeFile(join(levelsDir, `${name}.json`), `${JSON.stringify(createLevelConfig(id), null, 2)}\n`);
}

await writeFile(join(levelsDir, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);

const stats = getLevelRepeatStats();
console.log(`Generated ${maxLevel} levels: ${stats.uniqueWords}/${stats.totalWords} unique words, ${(stats.repeatRate * 100).toFixed(2)}% repeat rate`);

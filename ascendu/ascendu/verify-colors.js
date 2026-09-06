import fs from 'fs';

const files = fs.readdirSync('ascendu/ascendu/src')
  .filter(f => f.endsWith('.jsx') || f.endsWith('.js'))
  .filter(f => !f.endsWith('.bak'))
  .map(f => `ascendu/ascendu/src/${f}`);

const hexRegex = /#[0-9A-Fa-f]{6}\b/g;
const rgbRegex = /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+/g;
const found = new Map();
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  for (const m of content.match(hexRegex) || []) {
    const h = m.toUpperCase();
    const r = parseInt(h.slice(1,3), 16);
    const g = parseInt(h.slice(3,5), 16);
    const b = parseInt(h.slice(5,7), 16);
    if (g > r + 20 && g > b + 20) {
      found.set(h, (found.get(h) || 0) + 1);
    }
  }
  for (const m of content.match(rgbRegex) || []) {
    const nums = m.match(/\d+/g).map(Number);
    const [r, g, b] = nums;
    if (g > r + 20 && g > b + 20) {
      const key = `rgb(${r},${g},${b})`;
      found.set(key, (found.get(key) || 0) + 1);
    }
  }
}

console.log('Greenish colours remaining:');
for (const [h, c] of [...found.entries()].sort()) {
  console.log(`${h} (${c})`);
}
if (found.size === 0) console.log('None — all clear!');

import fs from 'node:fs';
const s = fs.readFileSync('ascendu/ascendu/src/App.jsx', 'utf8');
const kws = ['magic.stars', 'magic.sparkle', 'Math.random', 'moonPhase', 'orbiting', 'orbitR', 'fireflies', 'moonbeams', 'crescent'];
for (const kw of kws) {
  const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(esc, 'g');
  let n = 0;
  while (re.exec(s)) n++;
  console.log(kw + ': ' + n);
}
console.log('--- context ---');
for (const kw of ['crescent', 'fireflies', 'moonbeams', 'orbiting']) {
  let i = s.indexOf(kw);
  if (i >= 0) {
    console.log('=== ' + kw + ' ===');
    console.log(JSON.stringify(s.slice(i - 80, i + 260)));
    console.log();
  }
}

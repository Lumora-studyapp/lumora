import fs from 'node:fs';

const p = 'ascendu/ascendu/src/App.jsx';
let src = fs.readFileSync(p, 'utf8');
const hasBom = src.charCodeAt(0) === 0xFEFF ? (src = src.slice(1), true) : false;

const SPARKLE = '\u2728';
const GLOW = '\uD83C\uDF1F'; // U+1F31F
const PAUSE = '\u23F8';

// ---- sparkle stars (✨ 🌟) ----
const a1 = '      <text x={cx-30} y={cy-trunkH-canopyR*1.8} fontSize={large?18:13}>' + SPARKLE + '</text>\n      <text x={cx+18} y={cy-trunkH-canopyR*2.1} fontSize={large?15:11}>' + GLOW + '</text>';
const b1 = '      <path d={sgStarPath(cx-30,cy-trunkH-canopyR*1.8,large?9:6.5)} fill="#FFD34D"/>\n      <path d={sgStarPath(cx+18,cy-trunkH-canopyR*2.1,large?7.5:5.5)} fill="#FFEFB0"/>\n      <circle cx={cx-24} cy={cy-trunkH-canopyR*1.95} r={large?2:1.5} fill="#FFF6D8"/>\n      <circle cx={cx+11} cy={cy-trunkH-canopyR*2.25} r={large?1.6:1.2} fill="#FFF6D8"/>';

let c1 = 0;
while (src.includes(a1)) { src = src.replace(a1, b1); c1++; }
console.log('sparkle stars:', c1);

// ---- pause icon (⏸) ----
const a2 = '  const pauseIcon = paused&&!thumbnail&&<text x={cx} y={cy-trunkH-canopyR*1.5} fontSize={large?28:18} textAnchor="middle" opacity={0.7}>' + PAUSE + '</text>;';
const b2 = '  const pauseIcon = paused&&!thumbnail&&<g opacity={0.7} transform={`translate(${cx},${cy-trunkH-canopyR*1.5})`}><rect x={large?-8:-5} y={large?-19:-12} width={large?7:4.5} height={large?19:12} rx={large?2:1.2} fill="#666"/><rect x={large?1:0.5} y={large?-19:-12} width={large?7:4.5} height={large?19:12} rx={large?2:1.2} fill="#666"/></g>;';

let c2 = 0;
while (src.includes(a2)) { src = src.replace(a2, b2); c2++; }
console.log('pause icon:', c2);

fs.writeFileSync(p, (hasBom ? '\uFEFF' : '') + src, 'utf8');
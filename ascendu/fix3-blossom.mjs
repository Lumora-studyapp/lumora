import fs from 'node:fs';
const p = 'ascendu/ascendu/src/App.jsx';
let s = fs.readFileSync(p, 'utf8');
const BOM = s.charCodeAt(0) === 0xFEFF;
if (BOM) s = s.slice(1);
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const B = '\uD83C\uDF38';
const a = '            <text x={cx-canopyR*1.3} y={cy-trunkH-canopyR*0.2} fontSize={large?16:11}>' + B + '</text>' + EOL + '            <text x={cx+canopyR*0.9} y={cy-trunkH+canopyR*0.4} fontSize={large?13:9}>' + B + '</text>';
const fl = (x, r) => '<g transform={`translate(' + x + ')`}>' + [0, 72, 144, 216, 288].map(q => '<g transform="rotate(' + q + ')"><ellipse cx="0" cy="-5" rx="' + (r * 1.1) + '" ry="' + (r * 0.62) + '" fill="#F89CC8"/></g>').join('') + '<circle r="' + (r * 0.6) + '" fill="#FFD34D"/></g>';
const b = '            ' + fl('${cx-canopyR*1.3},${cy-trunkH-canopyR*0.2}', 4.2) + EOL + '            ' + fl('${cx+canopyR*0.9},${cy-trunkH+canopyR*0.4}', 3.2);
let c = 0;
while (s.includes(a)) { s = s.replace(a, b); c++; }
console.log('blossom:', c);
fs.writeFileSync(p, (BOM ? '\uFEFF' : '') + s, 'utf8');
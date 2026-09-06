import fs from 'node:fs';

const p = 'ascendu/ascendu/src/App.jsx';
let src = fs.readFileSync(p, 'utf8');
const hasBom = src.charCodeAt(0) === 0xFEFF ? (src = src.slice(1), true) : false;

const old1 = 'fontFamily:visual.kind==="emoji"?\'"Apple Color Emoji","Segoe UI Emoji",sans-serif\':"Inter,system-ui,sans-serif",';
const new1 = 'fontFamily:visual.kind==="emoji"?\'"Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif\':"Inter,system-ui,sans-serif",';
const old2 = 'fontFamily:"\'Inter\',\'Segoe UI\',sans-serif"';
const new2 = 'fontFamily:"\'Noto Color Emoji\',\'Inter\',\'Segoe UI\',sans-serif"';

let c1 = 0, c2 = 0;
while (src.includes(old1)) { src = src.replace(old1, new1); c1++; }
while (src.includes(old2)) { src = src.replace(old2, new2); c2++; }
console.log('session-symbol fontFamily:', c1);
console.log('app-root fontFamily:', c2);

fs.writeFileSync(p, (hasBom ? '\uFEFF' : '') + src, 'utf8');
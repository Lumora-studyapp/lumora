import fs from 'node:fs';
const p='ascendu/ascendu/src/App.jsx';
let s=fs.readFileSync(p,'utf8');
const BOM=s.charCodeAt(0)===0xFEFF;if(BOM)s=s.slice(1);
const M='\uD83C\uDF41';
const a='        {progress>=1 && !paused && <text x={cx+canopyR*0.7} y={cy-trunkH-canopyR*0.3} fontSize={large?16:11}>'+M+'</text>}';
const b='        {progress>=1 && !paused && <g transform={`translate(${cx+canopyR*0.7},${cy-trunkH-canopyR*0.3})`}><path d={sgStarPath(0,0,large?9:6)} fill="#E0533A" opacity={0.95}/><path d={`M-1.6 0 Q0 3.6 0 8 Q0 3.6 1.6 0 Z`} fill="#C23B22"/></g>}';
let c=0;while(s.includes(a)){s=s.replace(a,b);c++;}
console.log('maple:',c);
fs.writeFileSync(p,(BOM?'\uFEFF':'')+s,'utf8');
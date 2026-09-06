const fs = require('fs');
const zlib = require('zlib');

const file = 'c:/Users/VSAN7/Desktop/Lumora bubbles.pdf';
const buf = fs.readFileSync(file);
const pdfText = buf.toString('latin1');

// Find all objects and print their dictionaries
const objRe = /(\d+) 0 obj\n([\s\S]*?)(?:stream\r?\n|endobj)/g;
let m;
console.log('=== PDF Object Dictionaries ===');
while ((m = objRe.exec(pdfText)) !== null) {
  const objNum = m[1];
  const dict = m[2].trim();
  console.log(`--- obj ${objNum} ---`);
  console.log(dict.split('\n').slice(0, 15).join('\n'));
}

// Extract and save all streams
const streamRe = /stream\r?\n([\s\S]*?)endstream/g;
let idx = 0;
console.log('\n=== Streams ===');
while ((m = streamRe.exec(pdfText)) !== null) {
  const rawStr = m[1];
  const raw = Buffer.from(rawStr, 'latin1');
  const trailing = rawStr.endsWith('\r\n') ? 2 : rawStr.endsWith('\n') ? 1 : 0;
  let data = raw.slice(0, raw.length - trailing);
  let inflated = null;
  try {
    inflated = zlib.inflateSync(data);
  } catch (e) { /* not flate */ }

  const outData = inflated || data;
  const outPath = `c:/Users/VSAN7/Desktop/lumora-stream-${idx}.bin`;
  fs.writeFileSync(outPath, outData);
  const magic = [...outData.slice(0, 8)].map(b => b.toString(16).padStart(2, '0')).join(' ');
  console.log(`stream ${idx}: len=${outData.length} inflated=${!!inflated} magic=${magic} -> ${outPath}`);
  idx++;
}

// Dump the page content stream (usually stream 0) to see drawing ops
const contents = fs.readFileSync('c:/Users/VSAN7/Desktop/lumora-stream-0.bin');
const contentStr = contents.toString('latin1');
console.log('\n=== Content stream preview (first 3000 chars) ===');
console.log(contentStr.slice(0, 3000));
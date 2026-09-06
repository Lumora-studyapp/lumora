const fs = require('fs');
const zlib = require('zlib');

const file = 'c:/Users/VSAN7/Desktop/Lumora bubbles.pdf';
const buf = fs.readFileSync(file);

// Find all streams and decompress flate ones
const streamRe = /stream\r?\n([\s\S]*?)endstream/g;
let m, idx = 0;
const decompressed = [];
while ((m = streamRe.exec(buf.toString('latin1'))) !== null) {
  const raw = Buffer.from(m[1], 'latin1');
  // strip trailing \r\n before endstream
  const rawStr = raw.toString('latin1');
  let data = raw.slice(0, raw.length - (rawStr.endsWith('\r\n') ? 2 : rawStr.endsWith('\n') ? 1 : 0));
  try {
    const inf = zlib.inflateSync(data);
    decompressed.push({ index: idx, compressed: data.length, size: inf.length, data: inf });
  } catch (e) {
    // Not flate - might be DCTDecode (JPEG) or raw
    decompressed.push({ index: idx, compressed: data.length, size: data.length, data, raw: true });
  }
  idx++;
}

console.log('streams found:', decompressed.length);
decompressed.forEach((s, i) => {
  console.log(`stream ${i}: size=${s.size} raw=${s.raw||false}`);
});

// Look for JPEG signatures
decompressed.forEach((s, i) => {
  if (s.data.length > 4 && s.data[0] === 0xFF && s.data[1] === 0xD8) {
    const out = `c:/Users/VSAN7/Desktop/lumora-ref-${i}.jpg`;
    fs.writeFileSync(out, s.data);
    console.log('JPEG extracted ->', out);
  }
});

// Also try scanning raw buffer for PNG signature
let pngIdx = 0;
for (let i = 0; i < buf.length - 8; i++) {
  if (buf[i] === 0x89 && buf[i+1] === 0x50 && buf[i+2] === 0x4E && buf[i+3] === 0x47) {
    // find IEND
    const end = buf.indexOf(Buffer.from([0x49,0x45,0x4E,0x44]), i);
    if (end > 0) {
      const out = `c:/Users/VSAN7/Desktop/lumora-ref-png-${pngIdx++}.png`;
      fs.writeFileSync(out, buf.slice(i, end + 8));
      console.log('PNG extracted ->', out);
      i = end + 8;
    }
  }
}
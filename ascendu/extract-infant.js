const fs = require('fs');
const zlib = require('zlib');

const file = 'c:/Users/VSAN7/Downloads/Infant image.pdf';
const buf = fs.readFileSync(file);
const s = buf.toString('latin1');

// Print all object dictionaries to understand structure
// Note: PDF uses CRLF (\r\n) line endings, so match obj\r?\n
const objRe = /(\d+) 0 obj\r?\n([\s\S]*?)(?:stream\r?\n|endobj)/g;
let m;
console.log('=== Object Dictionaries ===');
while ((m = objRe.exec(s)) !== null) {
  console.log(`--- obj ${m[1]} ---`);
  console.log(m[2].trim().slice(0, 400));
}

// Extract the JPEG stream properly:
// Find the object that is an Image XObject with DCTDecode.
// Anchor on the XObject's own dictionary (starts with <</Type/XObject/Subtype/Image)
// so the correct object number is reported; require /Filter/DCTDecode.
// (PDF uses CRLF line endings, so match obj\r?\n)
const imgObjRe = /(\d+) 0 obj\r?\n<<\/Type\s*\/XObject\s*\/Subtype\s*\/Image([\s\S]*?)\/Filter\s*\/DCTDecode([\s\S]*?)stream\r?\n/;
const imgMatch = imgObjRe.exec(s);
if (imgMatch) {
  console.log('\n=== Image XObject found in object', imgMatch[1], '===');
  console.log('<< /Type/XObject/Subtype/Image' + imgMatch[2].trim());
  const dataStart = imgMatch.index + imgMatch[0].length;
  const endIdx = s.indexOf('endstream', dataStart);
  let raw = buf.slice(dataStart, endIdx);
  // strip trailing EOL
  let rawStr = raw.toString('latin1');
  let len = raw.length;
  if (rawStr.endsWith('\r\n')) len -= 2;
  else if (rawStr.endsWith('\n') || rawStr.endsWith('\r')) len -= 1;
  raw = raw.slice(0, len);
  console.log('JPEG bytes:', raw.length, 'magic:', [...raw.slice(0, 4)].map(x => x.toString(16).padStart(2, '0')).join(' '));
  fs.writeFileSync('c:/Users/VSAN7/Desktop/infant-extracted.jpg', raw);
  console.log('Saved -> c:/Users/VSAN7/Desktop/infant-extracted.jpg');
} else {
  console.log('\nNo image XObject found with regex.');
}

// Also scan the whole raw buffer for JPEG SOI marker (FF D8)
console.log('\n=== Scanning for JPEG SOI (FF D8) ===');
let found = 0;
for (let i = 0; i < buf.length - 1; i++) {
  if (buf[i] === 0xFF && buf[i+1] === 0xD8) {
    console.log(`Found JPEG SOI at byte offset ${i}, context: ${s.slice(Math.max(0, i-80), i+20).replace(/\n/g, '\\n')}`);
    // Find EOI (FF D9) after this
    for (let j = i + 2; j < buf.length - 1; j++) {
      if (buf[j] === 0xFF && buf[j+1] === 0xD9) {
        const jpg = buf.slice(i, j + 2);
        console.log(`  Complete JPEG: ${jpg.length} bytes, EOI at ${j+2}`);
        fs.writeFileSync('c:/Users/VSAN7/Desktop/infant-scan.jpg', jpg);
        console.log('  Saved -> c:/Users/VSAN7/Desktop/infant-scan.jpg');
        found++;
        i = j + 1; // outer loop i++ moves to j+2, i.e. right after EOI marker
        break;
      }
    }
    if (found >= 3) break;
  }
}
console.log('Total JPEGs found by scan:', found);

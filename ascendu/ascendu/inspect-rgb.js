import fs from 'fs';

const files = ['ascendu/ascendu/src/App.jsx', 'ascendu/ascendu/src/backgrounds.jsx'];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  // Find all rgb/rgba occurrences with any format
  const matches = content.match(/rgba?\([^)]*\)/gi) || [];
  const greenish = matches.filter(m => {
    const nums = (m.match(/\d+(?:\.\d+)?/g) || []).map(Number);
    if (nums.length < 3) return false;
    const [r, g, b] = nums;
    return g > r + 20 && g > b + 20;
  });
  // unique greenish with counts
  const counts = {};
  for (const m of greenish) {
    counts[m] = (counts[m] || 0) + 1;
  }
  console.log(`\n=== ${file} ===`);
  console.log(`greenish rgb count: ${greenish.length}`);
  for (const [m, c] of Object.entries(counts).sort()) {
    console.log(`  ${m} (${c})`);
  }
  if (greenish.length === 0) {
    console.log('  (none)');
  }
}
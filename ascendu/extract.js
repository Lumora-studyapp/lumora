const fs = require("fs");
const lines = fs.readFileSync("ascendu/ascendu/src/App.jsx", "utf8").split("\n");
for (let i = 0; i < lines.length; i++) {
  if (/timerView|timerScreen|sg-timer-/.test(lines[i])) {
    console.log(`${i+1}: ${lines[i]}`);
  }
}
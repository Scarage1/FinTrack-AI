const fs = require('fs');
let file = fs.readFileSync('src/App.jsx', 'utf8');
file = file.replace(/const COLORS = \[.*?\];/s, 'const COLORS = ["#0070f3", "#7928ca", "#10b981", "#f5a623", "#e00000", "#333333"];');
fs.writeFileSync('src/App.jsx', file);

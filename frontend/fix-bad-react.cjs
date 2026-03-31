const fs = require('fs');
let file = fs.readFileSync('src/App.jsx', 'utf8');

file = file.replace(
  'className="detail-value badge-pill {prediction.confidence > 80 ? \'high\' : \'medium\'}"',
  'className={`detail-value badge-pill ${prediction.confidence > 80 ? "high" : "medium"}`}'
);

fs.writeFileSync('src/App.jsx', file);

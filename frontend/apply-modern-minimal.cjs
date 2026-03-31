const fs = require('fs');

const css = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

:root {
  color-scheme: light;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --bg-color: #fafafa;
  --text-main: #171717;
  --text-muted: #666666;
  --border-light: #eaeaea;
  --card-bg: #ffffff;
  --primary: #171717;
  --primary-hover: #333333;
  
  --sidebar-bg: #ffffff;
  --sidebar-text: #171717;
  --sidebar-active-bg: #f5f5f5;
  --sidebar-hover-bg: #fafafa;
  --sidebar-border: #eaeaea;

  --accent-blue: #0070f3;
  --accent-purple: #7928ca;
  --accent-green: #10b981;
  --accent-red: #e00;
  --accent-orange: #f5a623;
}

* { box-sizing: border-box; }
body { margin: 0; background: var(--bg-color); color: var(--text-main); -webkit-font-smoothing: antialiased; }
h1, h2, h3, h4 { margin: 0; color: var(--text-main); font-weight: 600; letter-spacing: -0.02em; }
p { margin: 0; }
.muted { margin-top: 4px; color: var(--text-muted); font-size: 0.875rem; }

.shell { min-height: 100vh; display: grid; grid-template-columns: 240px 1fr; }
.main { padding: 40px 56px; max-width: 1400px; margin: 0 auto; width: 100%; }

.sidebar { 
  background: var(--sidebar-bg); 
  color: var(--sidebar-text); 
  padding: 32px 24px; 
  border-right: 1px solid var(--sidebar-border); 
}
.brand { 
  font-size: 1.25rem; 
  font-weight: 700; 
  margin-bottom: 40px; 
  letter-spacing: -0.02em; 
  display: flex; 
  align-items: center; 
  gap: 10px; 
}
.brand::before { content: '❖'; font-size: 1.1rem; }

.menu-item { 
  padding: 8px 12px; 
  border-radius: 6px; 
  margin-bottom: 4px; 
  width: 100%; 
  text-align: left; 
  background: transparent; 
  border: none; 
  color: var(--text-muted); 
  cursor: pointer; 
  font-size: 0.875rem; 
  font-weight: 500; 
  transition: all 0.15s ease; 
}
.menu-item.active { background: var(--sidebar-active-bg); color: var(--sidebar-text); font-weight: 600; }
.menu-item:hover:not(.active) { background: var(--sidebar-hover-bg); color: var(--sidebar-text); }
.menu-item:focus-visible { outline: 2px solid var(--primary); outline-offset: -2px; }

header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 40px; }
.header-actions { display: flex; gap: 12px; align-items: center; }
header h1 { font-size: 1.5rem; letter-spacing: -0.03em; }

.grid { display: grid; gap: 16px; margin-bottom: 16px; }
.grid.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.grid.three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.grid.four { grid-template-columns: repeat(4, minmax(0, 1fr)); }

.card { 
  background: var(--card-bg); 
  border-radius: 12px; 
  padding: 24px; 
  box-shadow: 0 1px 2px rgba(0,0,0,0.02); 
  border: 1px solid var(--border-light); 
}
.card-title, .card h2 { 
  font-size: 0.95rem; 
  font-weight: 600; 
  margin-bottom: 16px; 
  color: var(--text-main); 
}

/* Minimal KPI Stats */
.stat { 
  background: var(--card-bg); 
  border-radius: 12px; 
  padding: 20px 24px; 
  display: flex; 
  flex-direction: column; 
  justify-content: center; 
  border: 1px solid var(--border-light); 
  box-shadow: 0 1px 2px rgba(0,0,0,0.02);
  transition: border-color 0.2s ease;
}
.stat:hover { border-color: #d1d5db; }
.stat h2 { 
  font-size: 0.75rem; 
  color: var(--text-muted); 
  font-weight: 500; 
  text-transform: uppercase; 
  letter-spacing: 0.05em; 
  margin-bottom: 8px; 
}
.stat p { 
  font-size: 1.5rem; 
  font-weight: 600; 
  color: var(--text-main); 
  margin: 0; 
  letter-spacing: -0.02em;
}

.stack { display: flex; flex-direction: column; gap: 12px; }

/* Forms & Inputs */
input, select { 
  font-family: inherit; 
  border: 1px solid var(--border-light); 
  border-radius: 6px; 
  padding: 8px 12px; 
  font-size: 0.875rem; 
  background: #ffffff; 
  color: var(--text-main); 
  transition: border-color 0.15s, box-shadow 0.15s; 
}
input:hover, select:hover { border-color: #bcbcbc; }
input:focus, select:focus { 
  outline: none; 
  border-color: #888; 
  box-shadow: 0 0 0 1px #888; 
}

/* Buttons */
button { 
  font-family: inherit; 
  border: 1px solid transparent; 
  border-radius: 6px; 
  padding: 8px 16px; 
  font-size: 0.875rem; 
  font-weight: 500; 
  background: var(--primary); 
  color: #fff; 
  cursor: pointer; 
  transition: all 0.15s ease; 
}
button:hover { background: var(--primary-hover); }
button.ghost { 
  background: transparent; 
  color: var(--text-main); 
  border-color: var(--border-light); 
}
button.ghost:hover { background: var(--sidebar-hover-bg); border-color: #bcbcbc; }
button.danger { background: transparent; color: var(--accent-red); border-color: #ffcccc; }
button.danger:hover { background: #fff0f0; border-color: var(--accent-red); }
button:disabled { opacity: 0.5; cursor: not-allowed; }

/* Tables */
table { width: 100%; border-collapse: collapse; margin-top: 8px; }
.table-toolbar { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 12px; margin-bottom: 16px; }
th { 
  text-align: left; 
  padding: 12px 16px; 
  font-size: 0.75rem; 
  text-transform: uppercase; 
  letter-spacing: 0.05em; 
  color: var(--text-muted); 
  border-bottom: 1px solid var(--border-light); 
  font-weight: 500; 
}
td { 
  padding: 12px 16px; 
  font-size: 0.875rem; 
  color: var(--text-main); 
  border-bottom: 1px solid var(--border-light); 
}
tbody tr:hover td { background: var(--sidebar-hover-bg); }
tbody tr:last-child td { border-bottom: none; }

.pager { 
  display: flex; 
  align-items: center; 
  justify-content: space-between; 
  margin-top: 24px; 
  font-size: 0.875rem; 
  color: var(--text-muted); 
}

/* Badges & Pills */
.badge-pill {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 500;
  background: var(--sidebar-active-bg);
  color: var(--text-main);
  border: 1px solid var(--border-light);
}

.anomaly-item {
  border: 1px solid var(--border-light);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  background: var(--card-bg);
}
.anomaly-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.anomaly-amount { font-weight: 600; color: var(--accent-red); }
.anomaly-body { display: flex; justify-content: space-between; font-size: 0.875rem; margin-bottom: 12px; color: var(--text-muted); }
.anomaly-reason { font-size: 0.875rem; background: #fff0f0; padding: 8px 12px; border-radius: 6px; color: #a30000; }
.reason-label { font-weight: 600; margin-right: 4px; }

.split-card { display: grid; gap: 24px; }
.mt-large { margin-top: 24px; }

.list-item { 
  display: flex; align-items: flex-start; gap: 12px; padding: 12px; 
  border-radius: 6px; border: 1px solid var(--border-light); margin-bottom: 8px;
}
.alert-icon { color: var(--accent-orange); }
.item-text { font-size: 0.875rem; color: var(--text-main); line-height: 1.4; }

.prediction-grid { display: grid; gap: 24px; }
.main-prediction { 
  text-align: center; padding: 32px; background: var(--sidebar-active-bg); 
  border-radius: 8px; border: 1px solid var(--border-light);
}
.prediction-value { font-size: 2.5rem; font-weight: 700; margin: 12px 0; letter-spacing: -0.03em; }
.prediction-message { color: var(--text-muted); font-size: 0.875rem; }
.prediction-details { display: grid; gap: 12px; }
.detail-item { 
  display: flex; justify-content: space-between; padding: 12px; 
  border-bottom: 1px solid var(--border-light); font-size: 0.875rem;
}
.detail-item:last-child { border-bottom: none; }
.detail-label { color: var(--text-muted); }

.progress-wrap { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; font-size: 0.875rem; }
.progress { height: 6px; background: var(--border-light); border-radius: 999px; overflow: hidden; }
.progress div { height: 100%; background: var(--accent-blue); transition: width 0.3s ease; }

.error { background: #fff0f0; color: #a30000; padding: 12px 16px; border-radius: 6px; font-size: 0.875rem; border: 1px solid #ffcccc; margin-bottom: 16px; }
.empty-state { padding: 32px; text-align: center; color: var(--text-muted); font-size: 0.875rem; border: 1px dashed var(--border-light); border-radius: 8px; }

/* Custom Scrollbar for minimal look */
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #ccc; border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: #aaa; }

/* auth view tweaks */
.auth-wrap { align-items: center; justify-content: center; }
.auth-card {
  max-width: 400px;
  margin: auto;
}
.auth-card h1 {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--text-main);
  text-align: center;
}
.auth-card p {
  text-align: center;
  color: var(--text-muted);
  margin-bottom: 24px;
}
`;

const landingCSSPath = 'src/styles.css';
let existingCSS = '';
if (fs.existsSync(landingCSSPath)) {
    existingCSS = fs.readFileSync(landingCSSPath, 'utf8');
}

// Extract the landing page part starting from /* --- MODERN LANDING PAGE --- */
const landingMarker = '/* --- MODERN LANDING PAGE --- */';
const landingIndex = existingCSS.indexOf(landingMarker);
let finalCSS = css;
if (landingIndex !== -1) {
    const landingPart = existingCSS.substring(landingIndex);
    finalCSS += '\n\n' + landingPart;
}

fs.writeFileSync(landingCSSPath, finalCSS);
console.log('Applied modern minimal styles');
const fs = require('fs');
const css = `
:root {
  color-scheme: light;
  font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --bg-color: #f8fafc;
  --text-main: #0f172a;
  --text-muted: #64748b;
  --border-light: #e2e8f0;
  --card-bg: #ffffff;
  --primary: #4f46e5;
  --primary-hover: #4338ca;
  --sidebar-bg: #0f172a;
  --sidebar-text: #f8fafc;
  --sidebar-active: #1e293b;
  --sidebar-hover: #1e293b;
  --stat-a-text: #4f46e5;
  --stat-b-text: #0284c7;
  --stat-c-text: #16a34a;
  --stat-d-text: #d97706;
}

* { box-sizing: border-box; }
body { margin: 0; background: var(--bg-color); color: var(--text-main); -webkit-font-smoothing: antialiased; }
h1, h2, h3, h4 { margin: 0; color: #1e293b; letter-spacing: -0.015em; }
p { margin: 0; }
.muted { margin: 4px 0 0; color: var(--text-muted); font-size: 0.9rem; }

.shell { min-height: 100vh; display: grid; grid-template-columns: 260px 1fr; }
.main { padding: 32px 48px; max-width: 1400px; margin: 0 auto; width: 100%; }

.sidebar { background: var(--sidebar-bg); color: var(--sidebar-text); padding: 32px 24px; border-right: 1px solid #1e293b; box-shadow: 2px 0 10px rgba(0,0,0,0.05); }
.brand { font-size: 1.5rem; font-weight: 800; margin-bottom: 40px; letter-spacing: -0.025em; display: flex; align-items: center; gap: 10px; }
.brand::before { content: '✨'; font-size: 1.2rem; }

.menu-item { padding: 12px 16px; border-radius: 8px; margin-bottom: 6px; width: 100%; text-align: left; background: transparent; border: none; color: #94a3b8; cursor: pointer; font-size: 0.95rem; font-weight: 500; transition: all 0.2s ease; }
.menu-item.active { background: var(--sidebar-active); color: #fff; }
.menu-item:hover:not(.active) { background: var(--sidebar-hover); color: #e2e8f0; }
.menu-item:focus-visible { outline: 2px solid var(--primary); outline-offset: -2px; }

header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; }
.header-actions { display: flex; gap: 16px; align-items: center; }
header h1 { font-size: 1.75rem; font-weight: 700; }

.grid { display: grid; gap: 24px; margin-bottom: 24px; }
.grid.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.grid.three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.grid.four { grid-template-columns: repeat(4, minmax(0, 1fr)); }

.card { background: var(--card-bg); border-radius: 16px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05), 0 4px 6px -2px rgba(0,0,0,0.03); border: 1px solid var(--border-light); }
.card-title, .card h2 { font-size: 1.1rem; font-weight: 600; margin-bottom: 20px; color: #0f172a; }

.stat { background: #fff; border-radius: 16px; padding: 24px; display: flex; flex-direction: column; justify-content: center; box-shadow: 0 1px 3px rgba(0,0,0,0.05), 0 4px 6px -2px rgba(0,0,0,0.03); border: 1px solid var(--border-light); position: relative; overflow: hidden; transition: transform 0.2s ease; }
.stat:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
.stat h2 { font-size: 0.85rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
.stat p { font-size: 1.75rem; font-weight: 700; color: var(--text-main); margin: 0; }
.stat-a::before { content: ''; position: absolute; top:0; left:0; width:4px; height:100%; background: var(--stat-a-text); }
.stat-b::before { content: ''; position: absolute; top:0; left:0; width:4px; height:100%; background: var(--stat-b-text); }
.stat-c::before { content: ''; position: absolute; top:0; left:0; width:4px; height:100%; background: var(--stat-c-text); }
.stat-d::before { content: ''; position: absolute; top:0; left:0; width:4px; height:100%; background: var(--stat-d-text); }

.stack { display: flex; flex-direction: column; gap: 16px; }
input, select { font-family: inherit; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 14px; font-size: 0.95rem; background: #f8fafc; color: #0f172a; transition: border-color 0.2s, box-shadow 0.2s; }
input:hover, select:hover { background: #ffffff; border-color: #94a3b8; }
input:focus, select:focus { outline: none; background: #ffffff; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15); }

button { font-family: inherit; border: 1px solid transparent; border-radius: 8px; padding: 10px 16px; font-size: 0.95rem; font-weight: 500; background: var(--primary); color: #fff; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
button:hover { background: var(--primary-hover); box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2); }
button.ghost { background: #ffffff; color: #334155; border-color: #cbd5e1; box-shadow: none; }
button.ghost:hover { background: #f1f5f9; color: #0f172a; }
button.danger { background: #fef2f2; color: #ef4444; border-color: #fecaca; box-shadow: none; }
button.danger:hover { background: #fee2e2; border-color: #fca5a5; color: #b91c1c; }
button:disabled { opacity: 0.6; cursor: not-allowed; }

table { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 8px; }
.table-toolbar { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 16px; margin-bottom: 20px; }
th { text-align: left; padding: 12px 16px; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); border-bottom: 1px solid var(--border-light); font-weight: 600; }
td { padding: 14px 16px; font-size: 0.95rem; color: #334155; border-bottom: 1px solid var(--border-light); vertical-align: middle; }
tbody tr:hover { background: #f8fafc; }
tbody tr:last-child td { border-bottom: none; }

.pager { margin-top: 24px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-light); padding-top: 20px; }
.pager span { color: var(--text-muted); font-size: 0.9rem; font-weight: 500; }

.mt-large { margin-top: 32px; }
.split-card { display: flex; flex-direction: column; }
.list-item { display: flex; align-items: flex-start; gap: 12px; padding: 12px 16px; background: #f8fafc; border-radius: 8px; margin-bottom: 10px; border: 1px solid var(--border-light); }
.icon { font-size: 1.1rem; margin-top: 2px; }
.item-text { font-size: 0.95rem; line-height: 1.5; color: #334155; }
.empty-state { color: var(--text-muted); font-style: italic; padding: 24px 0; text-align: center; background: #f8fafc; border-radius: 8px; border: 1px dashed #cbd5e1; font-size: 0.9rem; }

.prediction-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 16px; }
.main-prediction { background: linear-gradient(135deg, #4f46e5, #3b82f6); color: white; padding: 32px; border-radius: 12px; display: flex; flex-direction: column; justify-content: center; }
.main-prediction h3 { color: rgba(255,255,255,0.9); font-size: 1rem; font-weight: 500; margin-bottom: 8px; }
.prediction-value { font-size: 2.5rem; font-weight: 700; margin-bottom: 16px; }
.prediction-message { font-size: 0.95rem; background: rgba(0,0,0,0.15); padding: 10px 16px; border-radius: 6px; line-height: 1.4; }
.prediction-details { display: flex; flex-direction: column; justify-content: center; gap: 16px; }
.detail-item { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; background: #f8fafc; border: 1px solid var(--border-light); border-radius: 8px; }
.detail-label { font-weight: 500; color: #475569; font-size: 0.95rem; }
.detail-value { font-weight: 600; color: #0f172a; }

.badge-pill { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; background: #e2e8f0; color: #334155; }
.badge-pill.high { background: #dcfce7; color: #16a34a; }
.badge-pill.medium { background: #fef9c3; color: #d97706; }

.anomaly-list { display: flex; flex-direction: column; gap: 16px; margin-top: 16px; }
.anomaly-item { border: 1px solid var(--border-light); border-radius: 12px; padding: 16px 20px; border-left: 4px solid #ef4444; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,0.02); }
.anomaly-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.anomaly-amount { font-size: 1.2rem; font-weight: 700; color: #0f172a; }
.anomaly-body { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 0.95rem; color: #475569; }
.anomaly-desc { font-weight: 500; }
.anomaly-date { color: var(--text-muted); font-size: 0.85rem; }
.anomaly-reason { background: #fef2f2; color: #b91c1c; padding: 10px 14px; border-radius: 6px; font-size: 0.9rem; font-weight: 500; }
.reason-label { font-weight: 700; margin-right: 6px; }

.progress-wrap { margin-top: 10px; }
.progress-wrap span, .progress-wrap small { font-size: 0.85rem; color: var(--text-muted); font-weight: 500; }
.progress { margin: 10px 0; background: var(--border-light); height: 8px; border-radius: 999px; overflow: hidden; }
.progress > div { background: var(--primary); height: 100%; border-radius: 999px; transition: width 0.4s ease; }

.auth-wrap { min-height: 100vh; display: grid; place-items: center; grid-template-columns: 1fr; background: #0f172a; }
.auth-card { width: 100%; max-width: 440px; padding: 40px 32px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.4); border-radius: 20px; }
.landing.card { background: transparent; box-shadow: none; border: none; color: white; }
.landing h1 { font-size: 3rem; font-weight: 800; color: white; margin-bottom: 16px; }
.landing .muted { color: #94a3b8; font-size: 1.1rem; margin-bottom: 32px; }
.landing-actions { display: flex; gap: 16px; justify-content: center; margin-top: 24px; }
.landing-actions button { padding: 12px 24px; font-size: 1.05rem; border-radius: 10px; }
.landing-actions button.ghost { background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2); }
.landing-actions button.ghost:hover { background: rgba(255,255,255,0.2); }
.landing-grid { margin-top: 48px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
.mini { background: rgba(255,255,255,0.05); color: #e2e8f0; padding: 20px; border-radius: 12px; font-weight: 500; border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(10px); text-align: center; }

.error { color: #b91c1c; background: #fef2f2; padding: 12px 16px; border-radius: 8px; border: 1px solid #fecaca; font-size: 0.95rem; margin-top: 16px; }

@media (max-width: 1024px) {
  .shell { grid-template-columns: 220px 1fr; }
  .grid.four { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .landing-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 768px) {
  .shell { grid-template-columns: 1fr; }
  .sidebar { display: none; }
  .main { padding: 24px 16px; }
  .grid.two, .grid.three { grid-template-columns: 1fr; }
  .table-toolbar { grid-template-columns: 1fr; }
  .prediction-grid { grid-template-columns: 1fr; }
  .landing-actions { flex-direction: column; }
  .landing-grid { grid-template-columns: 1fr; }
  .pager { flex-direction: column; align-items: stretch; gap: 16px; }
  .pager button { width: 100%; }
  .pager span { text-align: center; }
}
`;

fs.writeFileSync('/Users/shivamkumar/Documents/expense tracker/frontend/src/styles.css', css);

const fs = require('fs');
const cssPath = 'src/styles.css';

const landingCSS = `
/* --- MODERN LANDING PAGE --- */
.landing-page {
  min-height: 100vh;
  background: #0f172a; /* Dark background */
  background-image: 
    radial-gradient(circle at 15% 50%, rgba(79, 70, 229, 0.15), transparent 25%),
    radial-gradient(circle at 85% 30%, rgba(2, 132, 199, 0.15), transparent 25%);
  color: #f8fafc;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
}

.landing-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 48px;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}

.landing-brand {
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: -0.025em;
  color: #fff;
}

.landing-nav {
  display: flex;
  gap: 16px;
}

.landing-nav button {
  padding: 10px 20px;
  font-size: 0.95rem;
}

.landing-nav button.ghost {
  background: transparent;
  color: #e2e8f0;
  border: 1px solid transparent;
}

.landing-nav button.ghost:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
}

.landing-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 60px;
  max-width: 1400px;
  margin: 0 auto;
  padding: 80px 48px 60px;
  flex: 1;
}

.hero-content {
  flex: 1;
  max-width: 600px;
}

.hero-content .badge {
  display: inline-block;
  padding: 6px 14px;
  background: rgba(79, 70, 229, 0.2);
  color: #a5b4fc;
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 24px;
  border: 1px solid rgba(79, 70, 229, 0.3);
}

.hero-content h1 {
  font-size: 4rem;
  line-height: 1.1;
  font-weight: 800;
  color: #fff;
  margin-bottom: 24px;
  letter-spacing: -0.03em;
}

.hero-subtitle {
  font-size: 1.25rem;
  line-height: 1.6;
  color: #94a3b8;
  margin-bottom: 40px;
}

.hero-actions {
  display: flex;
  gap: 16px;
  margin-bottom: 32px;
}

.hero-btn-primary {
  padding: 16px 32px;
  font-size: 1.1rem;
  background: #4f46e5;
  border-radius: 12px;
  box-shadow: 0 10px 25px -5px rgba(79, 70, 229, 0.4);
  color: white;
  font-weight: 600;
  border: none;
  cursor: pointer;
}

.hero-btn-primary:hover {
  background: #4338ca;
  transform: translateY(-2px);
  box-shadow: 0 20px 25px -5px rgba(79, 70, 229, 0.5);
}

.hero-btn-secondary {
  padding: 16px 32px;
  font-size: 1.1rem;
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
}

.hero-btn-secondary:hover {
  background: rgba(255, 255, 255, 0.1);
}

.hero-features {
  display: flex;
  gap: 24px;
  font-size: 0.9rem;
  color: #64748b;
  font-weight: 500;
}

/* UI Mockup Graphic */
.hero-visual {
  flex: 1;
  position: relative;
  perspective: 1000px;
}

.mockup-window {
  background: #1e293b;
  border-radius: 16px;
  border: 1px solid #334155;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  transform: rotateY(-5deg) rotateX(2deg);
  transition: transform 0.5s ease;
}

.mockup-window:hover {
  transform: rotateY(0deg) rotateX(0deg);
}

.mockup-header {
  background: #0f172a;
  padding: 12px 16px;
  display: flex;
  gap: 8px;
  border-bottom: 1px solid #334155;
}

.mockup-header .dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}
.dot.red { background: #ef4444; }
.dot.yellow { background: #eab308; }
.dot.green { background: #22c55e; }

.mockup-body {
  display: flex;
  height: 400px;
  background: #f8fafc;
}

.mockup-sidebar {
  width: 25%;
  background: #0f172a;
  padding: 16px;
  border-right: 1px solid #e2e8f0;
}

.mockup-content {
  width: 75%;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.mockup-kpi-row {
  display: flex;
  gap: 16px;
}

.mockup-kpi {
  flex: 1;
  height: 70px;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.mockup-chart {
  flex: 1;
  height: 200px;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

/* Features Grid */
.landing-features-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 32px;
  max-width: 1400px;
  margin: 0 auto;
  padding: 40px 48px 100px;
}

.feature-card {
  padding: 32px;
  background: rgba(40, 42, 54, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  backdrop-filter: blur(10px);
}

.feature-icon {
  font-size: 2.5rem;
  margin-bottom: 20px;
}

.feature-card h3 {
  color: #fff;
  font-size: 1.25rem;
  margin-bottom: 12px;
}

.feature-card p {
  color: #94a3b8;
  line-height: 1.6;
}

@media (max-width: 1024px) {
  .landing-hero {
    flex-direction: column;
    text-align: center;
    padding-top: 40px;
  }
  .hero-content {
    max-width: 100%;
  }
  .hero-actions {
    justify-content: center;
  }
  .hero-features {
    justify-content: center;
  }
  .hero-visual {
    width: 100%;
    margin-top: 40px;
  }
  .landing-features-grid {
    grid-template-columns: 1fr;
  }
}
`;

fs.appendFileSync(cssPath, landingCSS);
console.log('Appended landing CSS successfully.');

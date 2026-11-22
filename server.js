const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

app.use(express.json());

// Redirect /news and any /news/* path directly to Hack.al
app.get('/news', (req, res) => {
  res.redirect(302, 'https://hack.al/');
});

app.get('/news/*', (req, res) => {
  res.redirect(302, 'https://hack.al/');
});

// Sample incidents API so the Incidents archive loads without errors
const incidents = [
  {
    id: 1,
    title: 'Global Supply Chain Intrusion',
    organization: 'Enterprise Logistics Group',
    year: 2025,
    sector: 'Supply Chain',
    severity: 'CRITICAL',
    source: 'https://hack.al/'
  },
  {
    id: 2,
    title: 'Regional Grid Telemetry Probe',
    organization: 'North Grid Utilities',
    year: 2026,
    sector: 'Energy',
    severity: 'HIGH',
    source: 'https://hack.al/'
  }
];

app.get('/api/incidents', (req, res) => {
  const search = String(req.query.search || '').trim().toLowerCase();
  const sector = String(req.query.sector || '').trim();

  const filtered = incidents.filter((item) => {
    const matchesSearch =
      !search ||
      item.title.toLowerCase().includes(search) ||
      item.organization.toLowerCase().includes(search);
    const matchesSector = !sector || item.sector === sector;
    return matchesSearch && matchesSector;
  });

  res.json(filtered);
});

// Serve static frontend files from public/
app.use(express.static(PUBLIC_DIR));

// Fallback to index.html for main page routes
app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`CYBERTRACE running at http://localhost:${PORT}`);
});
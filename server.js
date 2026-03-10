const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static('public'));

// ─── Strait of Hormuz Bounding Box ─────────────────────────────────
const HORMUZ_BBOX = {
  latMin: 26.0, latMax: 27.0,
  lonMin: 55.8, lonMax: 56.8
};

// Transit detection boundaries
const TRANSIT_ZONES = {
  gulfOfOman: { latThreshold: 26.8, lonThreshold: 56.3, side: 'east' },
  persianGulf: { latThreshold: 26.2, lonThreshold: 56.0, side: 'west' }
};

// ─── Ship Type Definitions ─────────────────────────────────────────
const SHIP_TYPES = {
  VLCC: { category: 'tanker', color: '#ff8c00', minDWT: 200000, maxDWT: 320000, minSpeed: 12, maxSpeed: 16, cargoFactor: 7.3 },
  SUEZMAX: { category: 'tanker', color: '#ff6600', minDWT: 120000, maxDWT: 200000, minSpeed: 13, maxSpeed: 16, cargoFactor: 7.3 },
  AFRAMAX: { category: 'tanker', color: '#ff9933', minDWT: 80000, maxDWT: 120000, minSpeed: 13, maxSpeed: 15, cargoFactor: 7.3 },
  PRODUCT_TANKER: { category: 'tanker', color: '#ffaa44', minDWT: 30000, maxDWT: 80000, minSpeed: 13, maxSpeed: 16, cargoFactor: 7.0 },
  LNG_CARRIER: { category: 'lng', color: '#00ccff', minDWT: 60000, maxDWT: 95000, minSpeed: 17, maxSpeed: 21, cargoFactor: null },
  CONTAINER: { category: 'container', color: '#3498db', minDWT: 40000, maxDWT: 200000, minSpeed: 18, maxSpeed: 24, cargoFactor: null },
  BULK_CARRIER: { category: 'bulk', color: '#8e44ad', minDWT: 50000, maxDWT: 180000, minSpeed: 12, maxSpeed: 15, cargoFactor: null },
  NAVAL_FRIGATE: { category: 'military', color: '#ff0000', minDWT: 3000, maxDWT: 6000, minSpeed: 18, maxSpeed: 30, cargoFactor: null },
  NAVAL_DESTROYER: { category: 'military', color: '#cc0000', minDWT: 6000, maxDWT: 10000, minSpeed: 20, maxSpeed: 33, cargoFactor: null },
  NAVAL_CARRIER: { category: 'military', color: '#990000', minDWT: 40000, maxDWT: 100000, minSpeed: 25, maxSpeed: 33, cargoFactor: null }
};

const FLAGS = ['Panama', 'Liberia', 'Marshall Islands', 'Hong Kong', 'Singapore', 'Bahamas', 'Malta', 'Greece', 'Japan', 'China', 'South Korea', 'India', 'UAE', 'Saudi Arabia', 'Kuwait', 'Qatar', 'Iraq', 'Iran', 'Norway', 'UK', 'USA', 'Turkey'];

const NAVAL_FLAGS = ['USN', 'Royal Navy', 'IRGC Navy', 'PLA Navy', 'Indian Navy', 'French Navy', 'Japan MSDF'];

const IRAN_ENTITIES = ['NITC', 'IRISL', 'Hafiz Darya', 'Sahel Shipping', 'Darya Capital'];

const SHIP_NAMES = {
  tanker: ['PACIFIC VOYAGER', 'ARABIAN PEARL', 'GULF SPIRIT', 'OCEAN TITAN', 'SEA DRAGON', 'DESERT ROSE', 'GOLDEN HAWK', 'PERSIAN STAR', 'CAPE FORTUNE', 'EAGLE RAY', 'BLUE MARLIN', 'JADE EMPEROR', 'CRIMSON TIDE', 'SILVER WAVE', 'AMBER SUN', 'NOBLE HAWK', 'IRON DUKE', 'CORAL REEF', 'RUBY CROWN', 'EMERALD SEA', 'SAPPHIRE BAY', 'DIAMOND CREST', 'PEARL HARBOR', 'ONYX RUNNER', 'TOPAZ WIND', 'CRYSTAL DAWN', 'OPAL MIST', 'GARNET PEAK', 'AMETHYST FLOW', 'TANZANITE WAVE'],
  lng: ['LNG PIONEER', 'ENERGY BRIDGE', 'DOHA SPIRIT', 'RAS LAFFAN', 'AL HAMLA', 'METHANE PRINCESS', 'GAS GENESIS', 'ARCTIC SPIRIT', 'CLEAN OCEAN', 'FLEX RAINBOW'],
  container: ['MAERSK SEALAND', 'MSC OSCAR', 'CMA CGM MARCO', 'EVER GIVEN II', 'COSCO UNIVERSE', 'YANG MING UNITY', 'HAPAG LLOYD STAR', 'ONE COMMITMENT', 'ZIM ANTWERP', 'PIL GATEWAY'],
  bulk: ['IRON PIONEER', 'CAPE BRAZIL', 'GRAIN MASTER', 'ORE GLORY', 'COAL TRADER', 'BULK JUPITER', 'STAR HORIZON', 'OCEAN PRIDE', 'PANAMAX DAWN', 'SUPRAMAX SPIRIT'],
  military: ['USS EISENHOWER', 'USS BATAAN', 'USS MASON', 'HMS DIAMOND', 'IRIS ALBORZ', 'IRIS SAHAND', 'CHANGSHA 173', 'INS VISAKHAPATNAM', 'FS LANGUEDOC', 'JS IZUMO']
};

// ─── Mock Data Generator ───────────────────────────────────────────
let nextMMSI = 200000000;
let nextIMO = 9000000;
let shipIdCounter = 1;

function generateMMSI() { return nextMMSI + Math.floor(Math.random() * 500000000); }
function generateIMO() { return nextIMO + Math.floor(Math.random() * 900000); }

function randomInRange(min, max) { return Math.random() * (max - min) + min; }

function generateShip(direction) {
  const typeKeys = Object.keys(SHIP_TYPES);
  // Weight towards tankers (60% tanker, 10% LNG, 15% container, 10% bulk, 5% military)
  const weights = [0.20, 0.15, 0.10, 0.15, 0.10, 0.10, 0.05, 0.05, 0.03, 0.02, 0.05];
  let r = Math.random();
  let typeIdx = 0;
  for (let i = 0; i < weights.length && i < typeKeys.length; i++) {
    r -= weights[i];
    if (r <= 0) { typeIdx = i; break; }
  }
  const shipTypeKey = typeKeys[Math.min(typeIdx, typeKeys.length - 1)];
  const shipType = SHIP_TYPES[shipTypeKey];

  const isMilitary = shipType.category === 'military';
  const isIranLinked = !isMilitary && Math.random() < 0.12;

  const flag = isMilitary
    ? NAVAL_FLAGS[Math.floor(Math.random() * NAVAL_FLAGS.length)]
    : (isIranLinked ? 'Iran' : FLAGS[Math.floor(Math.random() * FLAGS.length)]);

  const namePool = SHIP_NAMES[shipType.category] || SHIP_NAMES.tanker;
  const name = namePool[Math.floor(Math.random() * namePool.length)] + (Math.random() > 0.5 ? ' ' + Math.floor(Math.random() * 9 + 1) : '');

  const dwt = Math.floor(randomInRange(shipType.minDWT, shipType.maxDWT));
  const speed = +(randomInRange(shipType.minSpeed, shipType.maxSpeed)).toFixed(1);

  // Position based on direction
  let lat, lon, cog;
  if (direction === 'inbound') {
    lat = randomInRange(26.4, 26.9);
    lon = randomInRange(56.2, 56.7);
    cog = randomInRange(240, 290);
  } else {
    lat = randomInRange(26.1, 26.6);
    lon = randomInRange(55.9, 56.4);
    cog = randomInRange(60, 110);
  }

  let cargoEstimate = null;
  let cargoType = null;
  if (shipType.category === 'tanker') {
    cargoEstimate = Math.floor(dwt * shipType.cargoFactor);
    cargoType = shipTypeKey === 'PRODUCT_TANKER' ? 'Refined Products' : 'Crude Oil';
  } else if (shipType.category === 'lng') {
    cargoEstimate = Math.floor(dwt * 1.5); // m³ estimate
    cargoType = 'LNG';
  }

  const nextPorts = {
    inbound: ['Ras Tanura', 'Jubail', 'Basra', 'Kuwait City', 'Bandar Abbas', 'Doha', 'Abu Dhabi', 'Dubai'],
    outbound: ['Fujairah', 'Mumbai', 'Singapore', 'Yokohama', 'Rotterdam', 'Houston', 'Ningbo', 'Ulsan']
  };
  const portList = nextPorts[direction];
  const etaPort = portList[Math.floor(Math.random() * portList.length)];
  const etaHours = Math.floor(randomInRange(4, 72));

  return {
    id: shipIdCounter++,
    mmsi: generateMMSI(),
    imo: generateIMO(),
    name,
    type: shipTypeKey,
    category: shipType.category,
    flag,
    dwt,
    speed,
    lat: +lat.toFixed(5),
    lon: +lon.toFixed(5),
    cog: +cog.toFixed(1),
    direction,
    color: shipType.color,
    cargoEstimate,
    cargoType,
    etaPort,
    etaHours,
    iranLinked: isIranLinked,
    iranEntity: isIranLinked ? IRAN_ENTITIES[Math.floor(Math.random() * IRAN_ENTITIES.length)] : null,
    isMilitary,
    timestamp: Date.now(),
    aisStatus: Math.random() > 0.08 ? 'active' : 'dark'
  };
}

// ─── State ─────────────────────────────────────────────────────────
let ships = [];
let transitHistory = [];
let hourlyTransits = [];
let dailyHistory = [];
let alerts = [];
let conflictEvents = [];

// Escalation level
let escalationLevel = 'ELEVATED'; // NORMAL, ELEVATED, CRITICAL, WAR

// Conflict scenario parameters (simulating March 2026 tensions)
const SCENARIO = {
  baseTransitsPerHour: { min: 0, max: 2 },
  militaryPresence: 0.15,
  darkShipRate: 0.08,
  jammingZones: [
    { lat: 26.55, lon: 56.25, radius: 0.15, active: true, name: 'Northern Corridor' },
    { lat: 26.3, lon: 56.45, radius: 0.1, active: Math.random() > 0.4, name: 'Eastern Approach' }
  ],
  insurancePremium: '+185%',
  blockadeStatus: 'Partial - Escort Required'
};

// ─── Generate Initial Data ─────────────────────────────────────────
function initializeData() {
  // Generate ships currently in transit zone (wartime: sparse traffic + military)
  const shipCount = Math.floor(randomInRange(4, 10));
  ships = [];
  for (let i = 0; i < shipCount; i++) {
    const dir = Math.random() > 0.45 ? 'outbound' : 'inbound';
    ships.push(generateShip(dir));
  }

  // Generate 24h of hourly transit history (wartime: ~0-2 ships/hr, ~8-20/day)
  hourlyTransits = [];
  const now = Date.now();
  for (let h = 23; h >= 0; h--) {
    const hour = new Date(now - h * 3600000);
    const inbound = Math.floor(randomInRange(0, 2));
    const outbound = Math.floor(randomInRange(0, 2));
    const militaryCount = Math.random() > 0.4 ? Math.floor(randomInRange(1, 3)) : 0;
    const darkShips = Math.random() > 0.5 ? Math.floor(randomInRange(1, 3)) : 0;

    // Estimate cargo volumes
    const oilBarrels = (inbound + outbound) * Math.floor(randomInRange(800000, 1500000));
    const lngCargo = Math.random() > 0.7 ? Math.floor(randomInRange(30000, 80000)) : 0;

    hourlyTransits.push({
      hour: hour.toISOString(),
      hourLabel: hour.getUTCHours() + ':00',
      inbound,
      outbound,
      total: inbound + outbound,
      military: militaryCount,
      darkShips,
      oilBarrels,
      lngCargo,
      iranLinked: Math.random() > 0.7 ? Math.floor(randomInRange(1, 3)) : 0
    });
  }

  // Generate 30-day daily history with pre-war baseline
  // War started Feb 28, 2026 — pre-war baseline ~60-80 ships/day
  dailyHistory = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const warStartDate = new Date('2026-02-28T00:00:00Z');
  for (let d = 29; d >= 0; d--) {
    const date = new Date(today.getTime() - d * 86400000);
    const dateStr = date.toISOString().split('T')[0];
    const isPreWar = date < warStartDate;
    const daysSinceWar = isPreWar ? 0 : Math.ceil((date - warStartDate) / 86400000);

    let totalShips, inbound, outbound, militaryCount, darkShips;
    if (isPreWar) {
      // Normal peacetime traffic: 60-80 ships/day
      totalShips = Math.floor(randomInRange(60, 80));
      inbound = Math.floor(totalShips * randomInRange(0.45, 0.55));
      outbound = totalShips - inbound;
      militaryCount = Math.floor(randomInRange(1, 4));
      darkShips = Math.floor(randomInRange(0, 3));
    } else {
      // War period: traffic drops sharply, then partially recovers with escorts
      const dropFactor = Math.max(0.15, 1 - (daysSinceWar * 0.12) + (daysSinceWar > 5 ? (daysSinceWar - 5) * 0.04 : 0));
      const baseWarTraffic = Math.floor(randomInRange(55, 75) * dropFactor);
      totalShips = Math.max(8, baseWarTraffic + Math.floor(randomInRange(-5, 5)));
      inbound = Math.floor(totalShips * randomInRange(0.40, 0.55));
      outbound = totalShips - inbound;
      militaryCount = Math.floor(randomInRange(4, 12));
      darkShips = Math.floor(randomInRange(2, 8));
    }

    const oilBarrels = totalShips * Math.floor(randomInRange(700000, 1200000));
    const preWarBaseline = Math.floor(randomInRange(65, 75));

    dailyHistory.push({
      date: dateStr,
      totalShips,
      inbound,
      outbound,
      military: militaryCount,
      darkShips,
      oilBarrels,
      preWarBaseline,
      isPreWar
    });
  }

  // Generate recent transit events (wartime: fewer transits in 24h)
  transitHistory = [];
  for (let i = 0; i < 12; i++) {
    const dir = Math.random() > 0.45 ? 'outbound' : 'inbound';
    const ship = generateShip(dir);
    ship.transitTime = new Date(now - Math.floor(randomInRange(0, 24 * 3600000))).toISOString();
    transitHistory.push(ship);
  }
  transitHistory.sort((a, b) => new Date(b.transitTime) - new Date(a.transitTime));

  // Generate alerts
  alerts = [
    { id: 1, type: 'NAVAL', severity: 'high', message: 'USN Carrier Strike Group detected entering Gulf of Oman', timestamp: new Date(now - 1800000).toISOString(), source: 'AIS/Satellite' },
    { id: 2, type: 'JAMMING', severity: 'critical', message: 'GPS spoofing detected in Northern Corridor - 3 ships affected', timestamp: new Date(now - 3600000).toISOString(), source: 'AIS Anomaly Detection' },
    { id: 3, type: 'DARK_SHIP', severity: 'medium', message: 'VLCC "PERSIAN STAR" went dark near Qeshm Island - possible AIS shutdown', timestamp: new Date(now - 7200000).toISOString(), source: 'AIS Monitor' },
    { id: 4, type: 'MILITARY', severity: 'high', message: 'IRGC fast boats conducting drills near Larak Island', timestamp: new Date(now - 10800000).toISOString(), source: 'CENTCOM Intel' },
    { id: 5, type: 'SANCTIONS', severity: 'medium', message: 'Sanctioned vessel IRISL IRAN flagged transiting outbound', timestamp: new Date(now - 14400000).toISOString(), source: 'OFAC Watchlist' },
    { id: 6, type: 'ESCORT', severity: 'info', message: 'Coalition escort convoy forming at Fujairah anchorage - 4 tankers', timestamp: new Date(now - 18000000).toISOString(), source: 'Maritime Ops' },
    { id: 7, type: 'INSURANCE', severity: 'medium', message: 'Lloyd\'s War Risk Premium increased to 2.5% for Gulf transits', timestamp: new Date(now - 21600000).toISOString(), source: 'Lloyd\'s Market' },
    { id: 8, type: 'INCIDENT', severity: 'critical', message: 'Unconfirmed report: drone activity detected near shipping lane', timestamp: new Date(now - 25200000).toISOString(), source: 'Reuters / CENTCOM' }
  ];

  // Generate conflict timeline events
  conflictEvents = [
    { date: '2026-03-10', event: 'IRGC conducts live-fire exercise near Strait', impact: 'Temporary suspension of transits', severity: 'critical' },
    { date: '2026-03-09', event: 'US deploys additional carrier group to region', impact: 'Deterrence posture strengthened', severity: 'high' },
    { date: '2026-03-08', event: 'Commercial insurers raise war risk premiums 40%', impact: 'Shipping costs surge', severity: 'medium' },
    { date: '2026-03-07', event: 'Iran seizes Panama-flagged tanker near Hormuz', impact: '2-hour strait closure', severity: 'critical' },
    { date: '2026-03-06', event: 'Houthi drone targets vessel in Gulf of Oman', impact: 'Minor damage, no casualties', severity: 'high' },
    { date: '2026-03-05', event: 'Coalition naval escort program expanded', impact: '12 nations participating', severity: 'info' },
    { date: '2026-03-04', event: 'GPS jamming reported in 3 zones', impact: 'Ships rerouting to avoid areas', severity: 'medium' }
  ];

  updateEscalationLevel();
}

function updateEscalationLevel() {
  const latestHour = hourlyTransits[hourlyTransits.length - 1];
  if (!latestHour) { escalationLevel = 'NORMAL'; return; }

  const total = latestHour.total;
  const hasMilitary = latestHour.military > 0;
  const hasDarkShips = latestHour.darkShips > 0;
  const hasJamming = SCENARIO.jammingZones.some(z => z.active);

  if (total === 0) {
    escalationLevel = 'WAR';
  } else if (total <= 2 && hasMilitary) {
    escalationLevel = 'CRITICAL';
  } else if (total <= 4 || (hasJamming && hasDarkShips)) {
    escalationLevel = 'ELEVATED';
  } else {
    escalationLevel = 'NORMAL';
  }
}

// ─── Periodic Updates (Simulate Real-Time) ─────────────────────────
function updateSimulation() {
  const now = Date.now();

  // Move existing ships slightly
  ships.forEach(ship => {
    const speedKnots = ship.speed;
    const dlat = (Math.cos(ship.cog * Math.PI / 180) * speedKnots * 0.00001) * (0.5 + Math.random());
    const dlon = (Math.sin(ship.cog * Math.PI / 180) * speedKnots * 0.00001) * (0.5 + Math.random());
    ship.lat = +(ship.lat + dlat).toFixed(5);
    ship.lon = +(ship.lon + dlon).toFixed(5);
    ship.timestamp = now;

    // Random AIS status flicker (simulate dark ships)
    if (Math.random() < 0.02) {
      ship.aisStatus = ship.aisStatus === 'active' ? 'dark' : 'active';
    }
  });

  // Remove ships that left the bbox
  ships = ships.filter(s =>
    s.lat >= HORMUZ_BBOX.latMin - 0.5 && s.lat <= HORMUZ_BBOX.latMax + 0.5 &&
    s.lon >= HORMUZ_BBOX.lonMin - 0.5 && s.lon <= HORMUZ_BBOX.lonMax + 0.5
  );

  // Add new ships randomly (low rate during wartime blockade)
  if (Math.random() < 0.08) {
    const dir = Math.random() > 0.45 ? 'outbound' : 'inbound';
    ships.push(generateShip(dir));
  }

  // Every ~60s, update hourly bucket
  const latestHour = hourlyTransits[hourlyTransits.length - 1];
  const hourAge = now - new Date(latestHour.hour).getTime();
  if (hourAge > 300000) { // every 5 min for demo speed
    const inbound = Math.floor(randomInRange(0, 2));
    const outbound = Math.floor(randomInRange(0, 2));
    hourlyTransits.push({
      hour: new Date(now).toISOString(),
      hourLabel: new Date(now).getUTCHours() + ':00',
      inbound,
      outbound,
      total: inbound + outbound,
      military: Math.random() > 0.4 ? Math.floor(randomInRange(1, 3)) : 0,
      darkShips: Math.random() > 0.5 ? Math.floor(randomInRange(1, 3)) : 0,
      oilBarrels: (inbound + outbound) * Math.floor(randomInRange(800000, 1500000)),
      lngCargo: Math.random() > 0.7 ? Math.floor(randomInRange(30000, 80000)) : 0,
      iranLinked: Math.random() > 0.7 ? Math.floor(randomInRange(1, 3)) : 0
    });
    if (hourlyTransits.length > 168) hourlyTransits.shift(); // Keep 7 days
    updateEscalationLevel();
  }

  // Random new alert
  if (Math.random() < 0.05) {
    const alertTypes = [
      { type: 'DARK_SHIP', severity: 'medium', message: `AIS signal lost for ship near ${(26 + Math.random()).toFixed(2)}N, ${(56 + Math.random() * 0.8).toFixed(2)}E` },
      { type: 'NAVAL', severity: 'high', message: 'Naval vessel maneuvering in transit lane' },
      { type: 'JAMMING', severity: 'critical', message: 'GPS anomaly detected - possible spoofing' },
      { type: 'ESCORT', severity: 'info', message: 'Convoy escort departing Fujairah' }
    ];
    const at = alertTypes[Math.floor(Math.random() * alertTypes.length)];
    alerts.unshift({
      id: Date.now(),
      type: at.type,
      severity: at.severity,
      message: at.message,
      timestamp: new Date(now).toISOString(),
      source: 'System'
    });
    if (alerts.length > 50) alerts.pop();
  }
}

// ─── Computed Metrics ──────────────────────────────────────────────
function getMetrics() {
  const currentHour = hourlyTransits[hourlyTransits.length - 1] || { total: 0, inbound: 0, outbound: 0 };
  const last24h = hourlyTransits.slice(-24);
  const totalTransits24h = last24h.reduce((s, h) => s + h.total, 0);
  const avgPerHour = last24h.length > 0 ? (totalTransits24h / last24h.length).toFixed(1) : 0;

  const tankers = ships.filter(s => s.category === 'tanker');
  const lngCarriers = ships.filter(s => s.category === 'lng');
  const military = ships.filter(s => s.isMilitary);
  const darkShips = ships.filter(s => s.aisStatus === 'dark');
  const iranLinkedShips = ships.filter(s => s.iranLinked);

  const totalOilBarrels24h = last24h.reduce((s, h) => s + (h.oilBarrels || 0), 0);
  const totalLNG24h = last24h.reduce((s, h) => s + (h.lngCargo || 0), 0);

  // Strait status
  let straitStatus = 'OPEN';
  if (currentHour.total === 0) straitStatus = 'CLOSED';
  else if (currentHour.total < 5) straitStatus = 'PARTIAL';

  // Oil price simulation — Brent settled ~$99, intraday spikes to $119
  // WTI ~$94, both with high volatility due to Hormuz crisis (Mar 2026)
  const brentBase = 98.96;
  const brentDelta = (Math.random() - 0.3) * 8; // skewed upward, ±$5.60
  const wtiBase = 94.20;
  const wtiDelta = (Math.random() - 0.3) * 8;

  return {
    straitStatus,
    escalationLevel,
    currentHour: {
      total: currentHour.total,
      inbound: currentHour.inbound,
      outbound: currentHour.outbound
    },
    totalTransits24h,
    avgPerHour: +avgPerHour,
    shipCounts: {
      total: ships.length,
      tankers: tankers.length,
      lng: lngCarriers.length,
      containers: ships.filter(s => s.category === 'container').length,
      bulk: ships.filter(s => s.category === 'bulk').length,
      military: military.length,
      dark: darkShips.length,
      iranLinked: iranLinkedShips.length
    },
    cargo: {
      oilBarrels24h: totalOilBarrels24h,
      lngM3_24h: totalLNG24h,
      estimatedOilBbls: tankers.reduce((s, t) => s + (t.cargoEstimate || 0), 0)
    },
    oilPrices: {
      brent: +(brentBase + brentDelta).toFixed(2),
      wti: +(wtiBase + wtiDelta).toFixed(2)
    },
    insurance: SCENARIO.insurancePremium,
    blockadeStatus: SCENARIO.blockadeStatus,
    jammingZones: SCENARIO.jammingZones
  };
}

// ─── REST API ──────────────────────────────────────────────────────
app.get('/api/ships', (req, res) => {
  res.json(ships);
});

app.get('/api/metrics', (req, res) => {
  res.json(getMetrics());
});

app.get('/api/hourly', (req, res) => {
  const count = parseInt(req.query.hours) || 24;
  res.json(hourlyTransits.slice(-count));
});

app.get('/api/transits', (req, res) => {
  res.json(transitHistory.slice(0, 50));
});

app.get('/api/alerts', (req, res) => {
  res.json(alerts);
});

app.get('/api/conflicts', (req, res) => {
  res.json(conflictEvents);
});

app.get('/api/daily', (req, res) => {
  res.json(dailyHistory);
});

app.get('/api/export/csv', (req, res) => {
  let csv = 'Hour,Inbound,Outbound,Total,Military,Dark Ships,Oil Barrels,LNG m3,Iran Linked\n';
  hourlyTransits.forEach(h => {
    csv += `${h.hour},${h.inbound},${h.outbound},${h.total},${h.military},${h.darkShips},${h.oilBarrels},${h.lngCargo},${h.iranLinked}\n`;
  });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=hormuz_transit_data.csv');
  res.send(csv);
});

// ─── Socket.IO Real-Time ───────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Send initial state
  socket.emit('init', {
    ships,
    metrics: getMetrics(),
    hourlyTransits: hourlyTransits.slice(-24),
    dailyHistory,
    alerts: alerts.slice(0, 20),
    conflicts: conflictEvents,
    transitHistory: transitHistory.slice(0, 30),
    bbox: HORMUZ_BBOX,
    jammingZones: SCENARIO.jammingZones
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Push updates every 5 seconds
setInterval(() => {
  updateSimulation();
  const payload = {
    ships,
    metrics: getMetrics(),
    hourlyTransits: hourlyTransits.slice(-24),
    alerts: alerts.slice(0, 10),
    transitHistory: transitHistory.slice(0, 20)
  };
  io.emit('update', payload);
}, 5000);

// ─── Initialize and Start ──────────────────────────────────────────
initializeData();

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  HORMUZ TRACKER PRO running on http://0.0.0.0:${PORT}`);
  console.log(`  Monitoring Strait of Hormuz: ${HORMUZ_BBOX.latMin}-${HORMUZ_BBOX.latMax}N, ${HORMUZ_BBOX.lonMin}-${HORMUZ_BBOX.lonMax}E`);
  console.log(`  Escalation Level: ${escalationLevel}\n`);
});

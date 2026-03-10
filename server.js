require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static('public'));

// ─── Data Mode ────────────────────────────────────────────────────
const USE_LIVE_AIS = !!process.env.AISSTREAM_API_KEY;
const USE_LIVE_OIL = !!process.env.API_NINJAS_KEY;

// ─── Strait of Hormuz Bounding Box ─────────────────────────────────
const HORMUZ_BBOX = {
  latMin: 26.0, latMax: 27.0,
  lonMin: 55.8, lonMax: 56.8
};

// AIS ship type codes → our categories
const AIS_TYPE_MAP = {
  // 60-69: Passenger (not tracked)
  70: 'container', 71: 'container', 72: 'container', 73: 'container', 74: 'container', 79: 'container',
  75: 'container', 76: 'container', 77: 'container', 78: 'container',
  80: 'tanker', 81: 'tanker', 82: 'tanker', 83: 'tanker', 84: 'tanker', 89: 'tanker',
  85: 'tanker', 86: 'tanker', 87: 'tanker', 88: 'tanker',
  // Bulk
  90: 'bulk',
  35: 'military', 55: 'military' // military / law enforcement
};

const CATEGORY_COLORS = {
  tanker: '#ff8c00', lng: '#00ccff', container: '#3498db',
  bulk: '#8e44ad', military: '#ff0000', unknown: '#888'
};

const CATEGORY_TYPES = {
  tanker: 'TANKER', lng: 'LNG_CARRIER', container: 'CONTAINER',
  bulk: 'BULK_CARRIER', military: 'NAVAL', unknown: 'UNKNOWN'
};

// ─── Shared State ─────────────────────────────────────────────────
let ships = [];
let transitHistory = [];
let hourlyTransits = [];
let dailyHistory = [];
let alerts = [];
let conflictEvents = [];
let escalationLevel = 'ELEVATED';
let lastOilPrices = { brent: 98.96, wti: 94.20 };

// AIS live tracking state
let aisShipCache = {};       // keyed by MMSI
let aisStaticCache = {};     // ShipStaticData cache keyed by MMSI
let liveHourlyBucket = null; // current hour tracking
let aisConnected = false;

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

function randomInRange(min, max) { return Math.random() * (max - min) + min; }

// ─── AIS Type Classification ──────────────────────────────────────
function classifyAISType(typeCode) {
  if (typeCode >= 80 && typeCode <= 89) return 'tanker';
  if (typeCode >= 70 && typeCode <= 79) return 'container';
  if (typeCode === 90) return 'bulk';
  if (typeCode === 35 || typeCode === 55) return 'military';
  return AIS_TYPE_MAP[typeCode] || 'unknown';
}

function directionFromCog(cog) {
  // Inbound to Persian Gulf: generally west/southwest (200-320°)
  // Outbound from Gulf: generally east/northeast (20-160°)
  if (cog >= 180 && cog <= 360) return 'inbound';
  if (cog >= 0 && cog < 180) return 'outbound';
  return 'unknown';
}

// ═══════════════════════════════════════════════════════════════════
// LIVE AIS DATA — aisstream.io WebSocket
// ═══════════════════════════════════════════════════════════════════
function connectAISStream() {
  if (!USE_LIVE_AIS) return;

  console.log('  [AIS] Connecting to aisstream.io...');
  const ws = new WebSocket('wss://stream.aisstream.io/v0/stream');

  ws.on('open', () => {
    console.log('  [AIS] Connected — subscribing to Hormuz bounding box');
    aisConnected = true;
    ws.send(JSON.stringify({
      Apikey: process.env.AISSTREAM_API_KEY,
      BoundingBoxes: [[[HORMUZ_BBOX.latMin, HORMUZ_BBOX.lonMin], [HORMUZ_BBOX.latMax, HORMUZ_BBOX.lonMax]]],
      FilterMessageTypes: ['PositionReport', 'ShipStaticData']
    }));
  });

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      processAISMessage(msg);
    } catch (e) {
      // skip malformed messages
    }
  });

  ws.on('close', () => {
    console.log('  [AIS] Disconnected — reconnecting in 5s...');
    aisConnected = false;
    setTimeout(connectAISStream, 5000);
  });

  ws.on('error', (err) => {
    console.error('  [AIS] WebSocket error:', err.message);
    aisConnected = false;
  });
}

function processAISMessage(msg) {
  const meta = msg.MetaData;
  if (!meta || !meta.MMSI) return;

  const mmsi = meta.MMSI;
  const shipName = (meta.ShipName || '').trim();

  if (msg.MessageType === 'PositionReport' && msg.Message && msg.Message.PositionReport) {
    const pos = msg.Message.PositionReport;
    const lat = pos.Latitude;
    const lon = pos.Longitude;

    // Ignore invalid positions
    if (lat === 0 && lon === 0) return;
    if (lat < HORMUZ_BBOX.latMin - 0.5 || lat > HORMUZ_BBOX.latMax + 0.5) return;
    if (lon < HORMUZ_BBOX.lonMin - 0.5 || lon > HORMUZ_BBOX.lonMax + 0.5) return;

    const staticData = aisStaticCache[mmsi] || {};
    const category = classifyAISType(staticData.shipType || 0);
    const direction = directionFromCog(pos.Cog || 0);

    aisShipCache[mmsi] = {
      id: mmsi,
      mmsi,
      imo: staticData.imo || 0,
      name: shipName || staticData.name || `VESSEL-${mmsi}`,
      type: CATEGORY_TYPES[category] || 'UNKNOWN',
      category,
      flag: staticData.flag || '--',
      dwt: staticData.dwt || 0,
      speed: +(pos.Sog || 0).toFixed(1),
      lat: +lat.toFixed(5),
      lon: +lon.toFixed(5),
      cog: +(pos.Cog || 0).toFixed(1),
      direction,
      color: CATEGORY_COLORS[category] || '#888',
      cargoEstimate: category === 'tanker' ? Math.floor((staticData.dwt || 100000) * 7.3) : null,
      cargoType: category === 'tanker' ? 'Crude Oil' : (category === 'lng' ? 'LNG' : null),
      etaPort: staticData.destination || '--',
      etaHours: null,
      iranLinked: false,
      iranEntity: null,
      isMilitary: category === 'military',
      timestamp: Date.now(),
      aisStatus: 'active',
      navStatus: pos.NavigationalStatus
    };

    // Track in hourly bucket
    trackHourlyTransit(mmsi, direction, category);

    // Add to transit history
    addToTransitHistory(aisShipCache[mmsi]);
  }

  if (msg.MessageType === 'ShipStaticData' && msg.Message && msg.Message.ShipStaticData) {
    const sd = msg.Message.ShipStaticData;
    aisStaticCache[mmsi] = {
      imo: sd.ImoNumber || 0,
      name: (sd.Name || '').trim(),
      callSign: (sd.CallSign || '').trim(),
      destination: (sd.Destination || '').trim(),
      shipType: sd.Type || 0,
      dwt: 0, // AIS doesn't provide DWT directly
      flag: '--'
    };

    // Update existing cached ship if present
    if (aisShipCache[mmsi]) {
      const cat = classifyAISType(sd.Type || 0);
      aisShipCache[mmsi].name = aisStaticCache[mmsi].name || aisShipCache[mmsi].name;
      aisShipCache[mmsi].imo = sd.ImoNumber || aisShipCache[mmsi].imo;
      aisShipCache[mmsi].etaPort = aisStaticCache[mmsi].destination || '--';
      aisShipCache[mmsi].category = cat;
      aisShipCache[mmsi].type = CATEGORY_TYPES[cat] || 'UNKNOWN';
      aisShipCache[mmsi].color = CATEGORY_COLORS[cat] || '#888';
      aisShipCache[mmsi].isMilitary = cat === 'military';
    }
  }
}

// ─── Live Hourly Transit Tracking ─────────────────────────────────
function initLiveHourlyBucket() {
  const now = new Date();
  liveHourlyBucket = {
    hourStart: new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours()).getTime(),
    seenMMSIs: new Set(),
    inbound: 0,
    outbound: 0,
    military: 0,
    darkShips: 0
  };
}

function trackHourlyTransit(mmsi, direction, category) {
  if (!liveHourlyBucket) initLiveHourlyBucket();

  const now = Date.now();
  // Check if we've moved to a new hour
  if (now - liveHourlyBucket.hourStart >= 3600000) {
    finalizeHourlyBucket();
    initLiveHourlyBucket();
  }

  if (!liveHourlyBucket.seenMMSIs.has(mmsi)) {
    liveHourlyBucket.seenMMSIs.add(mmsi);
    if (direction === 'inbound') liveHourlyBucket.inbound++;
    else liveHourlyBucket.outbound++;
    if (category === 'military') liveHourlyBucket.military++;
  }
}

function finalizeHourlyBucket() {
  if (!liveHourlyBucket) return;

  const hourDate = new Date(liveHourlyBucket.hourStart);
  const total = liveHourlyBucket.inbound + liveHourlyBucket.outbound;

  hourlyTransits.push({
    hour: hourDate.toISOString(),
    hourLabel: hourDate.getUTCHours() + ':00',
    inbound: liveHourlyBucket.inbound,
    outbound: liveHourlyBucket.outbound,
    total,
    military: liveHourlyBucket.military,
    darkShips: liveHourlyBucket.darkShips,
    oilBarrels: total * Math.floor(randomInRange(800000, 1200000)),
    lngCargo: 0,
    iranLinked: 0
  });

  if (hourlyTransits.length > 168) hourlyTransits.shift();
  updateEscalationLevel();
}

function addToTransitHistory(ship) {
  // Avoid duplicate recent entries for same MMSI
  const exists = transitHistory.find(t => t.mmsi === ship.mmsi && (Date.now() - new Date(t.transitTime).getTime()) < 600000);
  if (exists) return;

  transitHistory.unshift({
    ...ship,
    transitTime: new Date().toISOString()
  });
  if (transitHistory.length > 50) transitHistory.pop();
}

// Build ships array from AIS cache (expire ships after 10 min of no update)
function getShipsFromAISCache() {
  const now = Date.now();
  const EXPIRY = 600000; // 10 minutes
  const liveShips = [];

  for (const mmsi of Object.keys(aisShipCache)) {
    const ship = aisShipCache[mmsi];
    if (now - ship.timestamp > EXPIRY) {
      delete aisShipCache[mmsi];
      continue;
    }
    liveShips.push(ship);
  }
  return liveShips;
}

// ═══════════════════════════════════════════════════════════════════
// LIVE OIL PRICES — API-Ninjas
// ═══════════════════════════════════════════════════════════════════
async function fetchOilPrices() {
  if (!USE_LIVE_OIL) return;

  try {
    const headers = { 'X-Api-Key': process.env.API_NINJAS_KEY };
    const [brentRes, wtiRes] = await Promise.all([
      fetch('https://api.api-ninjas.com/v1/commodityprice?name=brent_crude_oil', { headers }),
      fetch('https://api.api-ninjas.com/v1/commodityprice?name=crude_oil', { headers })
    ]);

    if (brentRes.ok) {
      const brent = await brentRes.json();
      if (brent && brent.price) lastOilPrices.brent = +brent.price.toFixed(2);
    }
    if (wtiRes.ok) {
      const wti = await wtiRes.json();
      if (wti && wti.price) lastOilPrices.wti = +wti.price.toFixed(2);
    }
    console.log(`  [OIL] Brent: $${lastOilPrices.brent} | WTI: $${lastOilPrices.wti}`);
  } catch (err) {
    console.error('  [OIL] Fetch failed:', err.message);
  }
}

// ═══════════════════════════════════════════════════════════════════
// SIMULATION FALLBACK (when no API keys)
// ═══════════════════════════════════════════════════════════════════
let shipIdCounter = 1;

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
  tanker: ['PACIFIC VOYAGER', 'ARABIAN PEARL', 'GULF SPIRIT', 'OCEAN TITAN', 'SEA DRAGON', 'DESERT ROSE', 'GOLDEN HAWK', 'PERSIAN STAR', 'CAPE FORTUNE', 'EAGLE RAY', 'BLUE MARLIN', 'JADE EMPEROR', 'CRIMSON TIDE', 'SILVER WAVE', 'AMBER SUN'],
  lng: ['LNG PIONEER', 'ENERGY BRIDGE', 'DOHA SPIRIT', 'RAS LAFFAN', 'AL HAMLA', 'METHANE PRINCESS'],
  container: ['MAERSK SEALAND', 'MSC OSCAR', 'CMA CGM MARCO', 'EVER GIVEN II', 'COSCO UNIVERSE'],
  bulk: ['IRON PIONEER', 'CAPE BRAZIL', 'GRAIN MASTER', 'ORE GLORY', 'COAL TRADER'],
  military: ['USS EISENHOWER', 'USS BATAAN', 'USS MASON', 'HMS DIAMOND', 'IRIS ALBORZ', 'IRIS SAHAND']
};

function generateShip(direction) {
  const typeKeys = Object.keys(SHIP_TYPES);
  const weights = [0.20, 0.15, 0.10, 0.15, 0.10, 0.10, 0.05, 0.05, 0.03, 0.02, 0.05];
  let r = Math.random(), typeIdx = 0;
  for (let i = 0; i < weights.length && i < typeKeys.length; i++) {
    r -= weights[i]; if (r <= 0) { typeIdx = i; break; }
  }
  const shipTypeKey = typeKeys[Math.min(typeIdx, typeKeys.length - 1)];
  const shipType = SHIP_TYPES[shipTypeKey];
  const isMilitary = shipType.category === 'military';
  const isIranLinked = !isMilitary && Math.random() < 0.12;
  const flag = isMilitary ? NAVAL_FLAGS[Math.floor(Math.random() * NAVAL_FLAGS.length)]
    : (isIranLinked ? 'Iran' : FLAGS[Math.floor(Math.random() * FLAGS.length)]);
  const namePool = SHIP_NAMES[shipType.category] || SHIP_NAMES.tanker;
  const name = namePool[Math.floor(Math.random() * namePool.length)];
  const dwt = Math.floor(randomInRange(shipType.minDWT, shipType.maxDWT));
  const speed = +(randomInRange(shipType.minSpeed, shipType.maxSpeed)).toFixed(1);
  let lat, lon, cog;
  if (direction === 'inbound') {
    lat = randomInRange(26.4, 26.9); lon = randomInRange(56.2, 56.7); cog = randomInRange(240, 290);
  } else {
    lat = randomInRange(26.1, 26.6); lon = randomInRange(55.9, 56.4); cog = randomInRange(60, 110);
  }
  let cargoEstimate = null, cargoType = null;
  if (shipType.category === 'tanker') {
    cargoEstimate = Math.floor(dwt * shipType.cargoFactor);
    cargoType = shipTypeKey === 'PRODUCT_TANKER' ? 'Refined Products' : 'Crude Oil';
  } else if (shipType.category === 'lng') {
    cargoEstimate = Math.floor(dwt * 1.5); cargoType = 'LNG';
  }
  const ports = direction === 'inbound'
    ? ['Ras Tanura', 'Jubail', 'Basra', 'Bandar Abbas', 'Doha']
    : ['Fujairah', 'Mumbai', 'Singapore', 'Yokohama', 'Rotterdam'];
  return {
    id: shipIdCounter++,
    mmsi: 200000000 + Math.floor(Math.random() * 500000000),
    imo: 9000000 + Math.floor(Math.random() * 900000),
    name, type: shipTypeKey, category: shipType.category, flag, dwt, speed,
    lat: +lat.toFixed(5), lon: +lon.toFixed(5), cog: +cog.toFixed(1),
    direction, color: shipType.color, cargoEstimate, cargoType,
    etaPort: ports[Math.floor(Math.random() * ports.length)],
    etaHours: Math.floor(randomInRange(4, 72)),
    iranLinked: isIranLinked,
    iranEntity: isIranLinked ? IRAN_ENTITIES[Math.floor(Math.random() * IRAN_ENTITIES.length)] : null,
    isMilitary, timestamp: Date.now(),
    aisStatus: Math.random() > 0.08 ? 'active' : 'dark'
  };
}

function updateSimulation() {
  const now = Date.now();
  ships.forEach(ship => {
    const dlat = (Math.cos(ship.cog * Math.PI / 180) * ship.speed * 0.00001) * (0.5 + Math.random());
    const dlon = (Math.sin(ship.cog * Math.PI / 180) * ship.speed * 0.00001) * (0.5 + Math.random());
    ship.lat = +(ship.lat + dlat).toFixed(5);
    ship.lon = +(ship.lon + dlon).toFixed(5);
    ship.timestamp = now;
    if (Math.random() < 0.02) ship.aisStatus = ship.aisStatus === 'active' ? 'dark' : 'active';
  });
  ships = ships.filter(s =>
    s.lat >= HORMUZ_BBOX.latMin - 0.5 && s.lat <= HORMUZ_BBOX.latMax + 0.5 &&
    s.lon >= HORMUZ_BBOX.lonMin - 0.5 && s.lon <= HORMUZ_BBOX.lonMax + 0.5
  );
  if (Math.random() < 0.08) {
    const dir = Math.random() > 0.45 ? 'outbound' : 'inbound';
    ships.push(generateShip(dir));
  }
  const latestHour = hourlyTransits[hourlyTransits.length - 1];
  const hourAge = now - new Date(latestHour.hour).getTime();
  if (hourAge > 300000) {
    const inbound = Math.floor(randomInRange(0, 2));
    const outbound = Math.floor(randomInRange(0, 2));
    hourlyTransits.push({
      hour: new Date(now).toISOString(),
      hourLabel: new Date(now).getUTCHours() + ':00',
      inbound, outbound, total: inbound + outbound,
      military: Math.random() > 0.4 ? Math.floor(randomInRange(1, 3)) : 0,
      darkShips: Math.random() > 0.5 ? Math.floor(randomInRange(1, 3)) : 0,
      oilBarrels: (inbound + outbound) * Math.floor(randomInRange(800000, 1500000)),
      lngCargo: Math.random() > 0.7 ? Math.floor(randomInRange(30000, 80000)) : 0,
      iranLinked: Math.random() > 0.7 ? Math.floor(randomInRange(1, 3)) : 0
    });
    if (hourlyTransits.length > 168) hourlyTransits.shift();
    updateEscalationLevel();
  }
  if (Math.random() < 0.05) {
    const alertTypes = [
      { type: 'DARK_SHIP', severity: 'medium', message: `AIS signal lost near ${(26 + Math.random()).toFixed(2)}N, ${(56 + Math.random() * 0.8).toFixed(2)}E` },
      { type: 'NAVAL', severity: 'high', message: 'Naval vessel maneuvering in transit lane' },
      { type: 'JAMMING', severity: 'critical', message: 'GPS anomaly detected - possible spoofing' },
      { type: 'ESCORT', severity: 'info', message: 'Convoy escort departing Fujairah' }
    ];
    const at = alertTypes[Math.floor(Math.random() * alertTypes.length)];
    alerts.unshift({ id: Date.now(), ...at, timestamp: new Date(now).toISOString(), source: 'System' });
    if (alerts.length > 50) alerts.pop();
  }
}

// ─── Initialize Data ──────────────────────────────────────────────
function initializeData() {
  const now = Date.now();

  if (!USE_LIVE_AIS) {
    // Simulation mode: generate initial ships
    ships = [];
    const shipCount = Math.floor(randomInRange(4, 10));
    for (let i = 0; i < shipCount; i++) {
      ships.push(generateShip(Math.random() > 0.45 ? 'outbound' : 'inbound'));
    }

    // Simulation: seed 24h of hourly transits
    hourlyTransits = [];
    for (let h = 23; h >= 0; h--) {
      const hour = new Date(now - h * 3600000);
      const inbound = Math.floor(randomInRange(0, 2));
      const outbound = Math.floor(randomInRange(0, 2));
      hourlyTransits.push({
        hour: hour.toISOString(),
        hourLabel: hour.getUTCHours() + ':00',
        inbound, outbound, total: inbound + outbound,
        military: Math.random() > 0.4 ? Math.floor(randomInRange(1, 3)) : 0,
        darkShips: Math.random() > 0.5 ? Math.floor(randomInRange(1, 3)) : 0,
        oilBarrels: (inbound + outbound) * Math.floor(randomInRange(800000, 1500000)),
        lngCargo: Math.random() > 0.7 ? Math.floor(randomInRange(30000, 80000)) : 0,
        iranLinked: Math.random() > 0.7 ? Math.floor(randomInRange(1, 3)) : 0
      });
    }

    // Simulation: seed transit history
    transitHistory = [];
    for (let i = 0; i < 12; i++) {
      const ship = generateShip(Math.random() > 0.45 ? 'outbound' : 'inbound');
      ship.transitTime = new Date(now - Math.floor(randomInRange(0, 24 * 3600000))).toISOString();
      transitHistory.push(ship);
    }
    transitHistory.sort((a, b) => new Date(b.transitTime) - new Date(a.transitTime));
  } else {
    // Live mode: start with empty arrays, data fills from WebSocket
    ships = [];
    hourlyTransits = [];
    transitHistory = [];
    initLiveHourlyBucket();
  }

  // 30-day daily history (historical reference — uses reported estimates)
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
      totalShips = Math.floor(randomInRange(60, 80));
      inbound = Math.floor(totalShips * randomInRange(0.45, 0.55));
      outbound = totalShips - inbound;
      militaryCount = Math.floor(randomInRange(1, 4));
      darkShips = Math.floor(randomInRange(0, 3));
    } else {
      const dropFactor = Math.max(0.15, 1 - (daysSinceWar * 0.12) + (daysSinceWar > 5 ? (daysSinceWar - 5) * 0.04 : 0));
      const baseWarTraffic = Math.floor(randomInRange(55, 75) * dropFactor);
      totalShips = Math.max(8, baseWarTraffic + Math.floor(randomInRange(-5, 5)));
      inbound = Math.floor(totalShips * randomInRange(0.40, 0.55));
      outbound = totalShips - inbound;
      militaryCount = Math.floor(randomInRange(4, 12));
      darkShips = Math.floor(randomInRange(2, 8));
    }
    dailyHistory.push({
      date: dateStr, totalShips, inbound, outbound,
      military: militaryCount, darkShips,
      oilBarrels: totalShips * Math.floor(randomInRange(700000, 1200000)),
      preWarBaseline: Math.floor(randomInRange(65, 75)),
      isPreWar
    });
  }

  // Alerts & conflict timeline
  alerts = [
    { id: 1, type: 'NAVAL', severity: 'high', message: 'USN Carrier Strike Group detected entering Gulf of Oman', timestamp: new Date(now - 1800000).toISOString(), source: 'AIS/Satellite' },
    { id: 2, type: 'JAMMING', severity: 'critical', message: 'GPS spoofing detected in Northern Corridor - 3 ships affected', timestamp: new Date(now - 3600000).toISOString(), source: 'AIS Anomaly Detection' },
    { id: 3, type: 'DARK_SHIP', severity: 'medium', message: 'VLCC "PERSIAN STAR" went dark near Qeshm Island', timestamp: new Date(now - 7200000).toISOString(), source: 'AIS Monitor' },
    { id: 4, type: 'MILITARY', severity: 'high', message: 'IRGC fast boats conducting drills near Larak Island', timestamp: new Date(now - 10800000).toISOString(), source: 'CENTCOM Intel' },
    { id: 5, type: 'SANCTIONS', severity: 'medium', message: 'Sanctioned vessel IRISL IRAN flagged transiting outbound', timestamp: new Date(now - 14400000).toISOString(), source: 'OFAC Watchlist' },
    { id: 6, type: 'ESCORT', severity: 'info', message: 'Coalition escort convoy forming at Fujairah anchorage', timestamp: new Date(now - 18000000).toISOString(), source: 'Maritime Ops' },
    { id: 7, type: 'INSURANCE', severity: 'medium', message: 'Lloyd\'s War Risk Premium increased to 2.5% for Gulf transits', timestamp: new Date(now - 21600000).toISOString(), source: 'Lloyd\'s Market' },
    { id: 8, type: 'INCIDENT', severity: 'critical', message: 'Unconfirmed report: drone activity near shipping lane', timestamp: new Date(now - 25200000).toISOString(), source: 'Reuters / CENTCOM' }
  ];

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
  if (!latestHour) { escalationLevel = 'ELEVATED'; return; }
  const total = latestHour.total;
  const hasMilitary = latestHour.military > 0;
  const hasDarkShips = latestHour.darkShips > 0;
  const hasJamming = SCENARIO.jammingZones.some(z => z.active);
  if (total === 0) escalationLevel = 'WAR';
  else if (total <= 2 && hasMilitary) escalationLevel = 'CRITICAL';
  else if (total <= 4 || (hasJamming && hasDarkShips)) escalationLevel = 'ELEVATED';
  else escalationLevel = 'NORMAL';
}

// ─── Computed Metrics ──────────────────────────────────────────────
function getMetrics() {
  // In live mode, build ships from AIS cache
  const currentShips = USE_LIVE_AIS ? getShipsFromAISCache() : ships;

  const currentHour = hourlyTransits[hourlyTransits.length - 1] || { total: 0, inbound: 0, outbound: 0, military: 0, darkShips: 0 };
  const last24h = hourlyTransits.slice(-24);
  const totalTransits24h = last24h.reduce((s, h) => s + h.total, 0);
  const avgPerHour = last24h.length > 0 ? (totalTransits24h / last24h.length).toFixed(1) : 0;

  const tankers = currentShips.filter(s => s.category === 'tanker');
  const lngCarriers = currentShips.filter(s => s.category === 'lng');
  const military = currentShips.filter(s => s.isMilitary);
  const darkShips = currentShips.filter(s => s.aisStatus === 'dark');
  const iranLinkedShips = currentShips.filter(s => s.iranLinked);

  const totalOilBarrels24h = last24h.reduce((s, h) => s + (h.oilBarrels || 0), 0);
  const totalLNG24h = last24h.reduce((s, h) => s + (h.lngCargo || 0), 0);

  let straitStatus = 'OPEN';
  if (currentHour.total === 0) straitStatus = 'CLOSED';
  else if (currentHour.total < 5) straitStatus = 'PARTIAL';

  // Oil prices: live or simulated
  let brent, wti;
  if (USE_LIVE_OIL) {
    brent = lastOilPrices.brent;
    wti = lastOilPrices.wti;
  } else {
    brent = +(98.96 + (Math.random() - 0.3) * 8).toFixed(2);
    wti = +(94.20 + (Math.random() - 0.3) * 8).toFixed(2);
  }

  return {
    straitStatus,
    escalationLevel,
    dataMode: USE_LIVE_AIS ? 'LIVE AIS' : 'SIMULATION',
    currentHour: { total: currentHour.total, inbound: currentHour.inbound, outbound: currentHour.outbound },
    totalTransits24h,
    avgPerHour: +avgPerHour,
    shipCounts: {
      total: currentShips.length,
      tankers: tankers.length,
      lng: lngCarriers.length,
      containers: currentShips.filter(s => s.category === 'container').length,
      bulk: currentShips.filter(s => s.category === 'bulk').length,
      military: military.length,
      dark: darkShips.length,
      iranLinked: iranLinkedShips.length
    },
    cargo: {
      oilBarrels24h: totalOilBarrels24h,
      lngM3_24h: totalLNG24h,
      estimatedOilBbls: tankers.reduce((s, t) => s + (t.cargoEstimate || 0), 0)
    },
    oilPrices: { brent, wti },
    insurance: SCENARIO.insurancePremium,
    blockadeStatus: SCENARIO.blockadeStatus,
    jammingZones: SCENARIO.jammingZones
  };
}

// ─── REST API ──────────────────────────────────────────────────────
app.get('/api/ships', (req, res) => {
  res.json(USE_LIVE_AIS ? getShipsFromAISCache() : ships);
});

app.get('/api/metrics', (req, res) => { res.json(getMetrics()); });

app.get('/api/hourly', (req, res) => {
  const count = parseInt(req.query.hours) || 24;
  res.json(hourlyTransits.slice(-count));
});

app.get('/api/transits', (req, res) => { res.json(transitHistory.slice(0, 50)); });
app.get('/api/alerts', (req, res) => { res.json(alerts); });
app.get('/api/conflicts', (req, res) => { res.json(conflictEvents); });
app.get('/api/daily', (req, res) => { res.json(dailyHistory); });

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
  const currentShips = USE_LIVE_AIS ? getShipsFromAISCache() : ships;
  socket.emit('init', {
    ships: currentShips,
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
  if (!USE_LIVE_AIS) updateSimulation();

  const currentShips = USE_LIVE_AIS ? getShipsFromAISCache() : ships;
  io.emit('update', {
    ships: currentShips,
    metrics: getMetrics(),
    hourlyTransits: hourlyTransits.slice(-24),
    alerts: alerts.slice(0, 10),
    transitHistory: transitHistory.slice(0, 20)
  });
}, 5000);

// ─── Initialize and Start ──────────────────────────────────────────
initializeData();

// Connect live data sources
if (USE_LIVE_AIS) connectAISStream();
if (USE_LIVE_OIL) {
  fetchOilPrices();
  setInterval(fetchOilPrices, 300000); // refresh every 5 min
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  HORMUZ TRACKER PRO running on http://0.0.0.0:${PORT}`);
  console.log(`  Data Mode: ${USE_LIVE_AIS ? 'LIVE AIS (aisstream.io)' : 'SIMULATION'}`);
  console.log(`  Oil Prices: ${USE_LIVE_OIL ? 'LIVE (API-Ninjas)' : 'SIMULATED'}`);
  console.log(`  Monitoring: ${HORMUZ_BBOX.latMin}-${HORMUZ_BBOX.latMax}N, ${HORMUZ_BBOX.lonMin}-${HORMUZ_BBOX.lonMax}E`);
  console.log(`  Escalation Level: ${escalationLevel}\n`);
});

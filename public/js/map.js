// ─── Hormuz Tracker Pro - Leaflet Map Module ──────────────────────
const HormuzMap = (function () {
  let map;
  let shipMarkers = new Map();
  let zoneLayer, heatmapLayer, jammingLayer;
  let shipLayerGroup;
  let layers = { ships: true, heatmap: true, zones: true, jamming: false };

  const HORMUZ_CENTER = [26.5, 56.3];
  const HORMUZ_ZOOM = 9;

  // Strait boundaries polygon
  const STRAIT_POLYGON = [
    [27.0, 55.8], [27.0, 56.8], [26.0, 56.8], [26.0, 55.8]
  ];

  // Shipping lanes (approximate)
  const INBOUND_LANE = [
    [26.85, 56.65], [26.55, 56.35], [26.25, 56.05], [26.05, 55.85]
  ];
  const OUTBOUND_LANE = [
    [26.10, 55.90], [26.35, 56.15], [26.65, 56.45], [26.95, 56.70]
  ];

  // Key locations
  const LANDMARKS = [
    { name: 'Musandam Peninsula', lat: 26.40, lon: 56.25, type: 'land' },
    { name: 'Qeshm Island', lat: 26.85, lon: 55.95, type: 'land' },
    { name: 'Larak Island', lat: 26.86, lon: 56.35, type: 'land' },
    { name: 'Hormuz Island', lat: 27.06, lon: 56.46, type: 'land' },
    { name: 'Bandar Abbas', lat: 27.18, lon: 56.27, type: 'port' },
    { name: 'Fujairah', lat: 25.12, lon: 56.33, type: 'port' },
    { name: 'Ras Tanura', lat: 26.64, lon: 50.16, type: 'port' }
  ];

  function init() {
    map = L.map('map-container', {
      center: HORMUZ_CENTER,
      zoom: HORMUZ_ZOOM,
      zoomControl: true,
      attributionControl: false
    });

    // Dark tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 16,
      opacity: 0.9
    }).addTo(map);

    // Initialize layer groups
    shipLayerGroup = L.layerGroup().addTo(map);

    // Draw zones
    drawZones();
    drawShippingLanes();
    drawLandmarks();

    // Map control buttons
    document.querySelectorAll('.map-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const layer = btn.dataset.layer;
        btn.classList.toggle('active');
        layers[layer] = btn.classList.contains('active');
        toggleLayer(layer, layers[layer]);
      });
    });

    return map;
  }

  function drawZones() {
    zoneLayer = L.layerGroup();

    // Strait bounding box
    L.rectangle(STRAIT_POLYGON, {
      color: '#3b82f6',
      weight: 2,
      fillColor: '#3b82f6',
      fillOpacity: 0.05,
      dashArray: '8 4'
    }).bindTooltip('HORMUZ TRANSIT ZONE', {
      permanent: false,
      className: 'zone-tooltip'
    }).addTo(zoneLayer);

    // Persian Gulf side label
    L.marker([26.5, 55.85], {
      icon: L.divIcon({
        className: 'zone-label',
        html: '<div style="color:#3b82f6;font-family:monospace;font-size:10px;font-weight:700;letter-spacing:1px;white-space:nowrap;text-shadow:0 0 4px rgba(0,0,0,0.8)">PERSIAN GULF</div>',
        iconSize: [100, 20]
      })
    }).addTo(zoneLayer);

    // Gulf of Oman side label
    L.marker([26.3, 56.7], {
      icon: L.divIcon({
        className: 'zone-label',
        html: '<div style="color:#06b6d4;font-family:monospace;font-size:10px;font-weight:700;letter-spacing:1px;white-space:nowrap;text-shadow:0 0 4px rgba(0,0,0,0.8)">GULF OF OMAN</div>',
        iconSize: [100, 20]
      })
    }).addTo(zoneLayer);

    zoneLayer.addTo(map);
  }

  function drawShippingLanes() {
    // Inbound lane (green arrows)
    L.polyline(INBOUND_LANE, {
      color: '#10b981',
      weight: 2,
      opacity: 0.5,
      dashArray: '10 6'
    }).bindTooltip('INBOUND LANE', { permanent: false }).addTo(zoneLayer);

    // Outbound lane (orange arrows)
    L.polyline(OUTBOUND_LANE, {
      color: '#f59e0b',
      weight: 2,
      opacity: 0.5,
      dashArray: '10 6'
    }).bindTooltip('OUTBOUND LANE', { permanent: false }).addTo(zoneLayer);
  }

  function drawLandmarks() {
    LANDMARKS.forEach(lm => {
      if (lm.type === 'port') {
        L.circleMarker([lm.lat, lm.lon], {
          radius: 5,
          color: '#f59e0b',
          fillColor: '#f59e0b',
          fillOpacity: 0.8,
          weight: 1
        }).bindTooltip(lm.name, { permanent: false }).addTo(zoneLayer);
      }
    });
  }

  function getShipIcon(ship) {
    const size = ship.isMilitary ? 10 : (ship.category === 'tanker' ? 9 : 7);
    const color = ship.aisStatus === 'dark' ? '#666666' : ship.color;
    const border = ship.iranLinked ? '#ef4444' : (ship.isMilitary ? '#ff0000' : 'rgba(255,255,255,0.3)');
    const borderWidth = ship.iranLinked || ship.isMilitary ? 2 : 1;

    // Direction arrow
    const rotation = ship.cog || 0;

    return L.divIcon({
      className: 'ship-marker',
      html: `<div style="
        width:${size * 2}px;
        height:${size * 2}px;
        position:relative;
      ">
        <div style="
          width:${size * 2}px;
          height:${size * 2}px;
          background:${color};
          border:${borderWidth}px solid ${border};
          border-radius:${ship.isMilitary ? '2px' : '50%'};
          box-shadow:0 0 ${ship.isMilitary ? '8' : '4'}px ${color}80;
          ${ship.aisStatus === 'dark' ? 'opacity:0.5;border-style:dashed;' : ''}
          ${ship.iranLinked ? 'animation:pulse-red 1s infinite;' : ''}
        "></div>
        <div style="
          position:absolute;
          top:-4px;
          left:50%;
          transform:translateX(-50%) rotate(${rotation}deg);
          width:0;
          height:0;
          border-left:3px solid transparent;
          border-right:3px solid transparent;
          border-bottom:6px solid ${color};
          opacity:0.7;
        "></div>
      </div>`,
      iconSize: [size * 2, size * 2 + 6],
      iconAnchor: [size, size + 3]
    });
  }

  function getShipPopup(ship) {
    let cargoInfo = '';
    if (ship.cargoType) {
      const formatted = ship.cargoType === 'LNG'
        ? `${(ship.cargoEstimate / 1000).toFixed(0)}k m3`
        : `${(ship.cargoEstimate / 1000000).toFixed(2)}M bbl`;
      cargoInfo = `
        <div class="popup-row">
          <span class="popup-label">Cargo</span>
          <span class="popup-value">${ship.cargoType}</span>
        </div>
        <div class="popup-row">
          <span class="popup-label">Est. Volume</span>
          <span class="popup-value">${formatted}</span>
        </div>`;
    }

    let flagInfo = '';
    if (ship.iranLinked) {
      flagInfo = `<div class="popup-iran">IRAN-LINKED: ${ship.iranEntity}</div>`;
    }
    if (ship.isMilitary) {
      flagInfo = `<div class="popup-military">NAVAL PRESENCE DETECTED</div>`;
    }

    return `<div class="ship-popup">
      <div class="popup-header" style="color:${ship.color}">${ship.name}</div>
      <div class="popup-row">
        <span class="popup-label">MMSI</span>
        <span class="popup-value">${ship.mmsi}</span>
      </div>
      <div class="popup-row">
        <span class="popup-label">IMO</span>
        <span class="popup-value">${ship.imo}</span>
      </div>
      <div class="popup-row">
        <span class="popup-label">Type</span>
        <span class="popup-value">${ship.type.replace(/_/g, ' ')}</span>
      </div>
      <div class="popup-row">
        <span class="popup-label">Flag</span>
        <span class="popup-value" style="${ship.flag === 'Iran' ? 'color:#ef4444;font-weight:700' : ''}">${ship.flag}</span>
      </div>
      <div class="popup-row">
        <span class="popup-label">DWT</span>
        <span class="popup-value">${ship.dwt.toLocaleString()}</span>
      </div>
      <div class="popup-row">
        <span class="popup-label">Speed</span>
        <span class="popup-value">${ship.speed} kn</span>
      </div>
      <div class="popup-row">
        <span class="popup-label">Course</span>
        <span class="popup-value">${ship.cog}&deg;</span>
      </div>
      ${cargoInfo}
      <div class="popup-row">
        <span class="popup-label">Direction</span>
        <span class="popup-value" style="color:${ship.direction === 'inbound' ? '#10b981' : '#f59e0b'}">${ship.direction.toUpperCase()}</span>
      </div>
      <div class="popup-row">
        <span class="popup-label">Destination</span>
        <span class="popup-value">${ship.etaPort}</span>
      </div>
      <div class="popup-row">
        <span class="popup-label">AIS</span>
        <span class="popup-value" style="color:${ship.aisStatus === 'active' ? '#10b981' : '#f97316'}">${ship.aisStatus.toUpperCase()}</span>
      </div>
      ${flagInfo}
    </div>`;
  }

  function updateShips(ships) {
    if (!layers.ships) return;

    // Track which ships are still present
    const currentIds = new Set(ships.map(s => s.id));

    // Remove ships that are no longer present
    for (const [id, marker] of shipMarkers) {
      if (!currentIds.has(id)) {
        shipLayerGroup.removeLayer(marker);
        shipMarkers.delete(id);
      }
    }

    // Add/update ships
    ships.forEach(ship => {
      const existing = shipMarkers.get(ship.id);
      if (existing) {
        existing.setLatLng([ship.lat, ship.lon]);
        existing.setIcon(getShipIcon(ship));
        existing.setPopupContent(getShipPopup(ship));
      } else {
        const marker = L.marker([ship.lat, ship.lon], {
          icon: getShipIcon(ship)
        }).bindPopup(getShipPopup(ship), {
          maxWidth: 280,
          className: 'dark-popup'
        });
        shipLayerGroup.addLayer(marker);
        shipMarkers.set(ship.id, marker);
      }
    });
  }

  function updateJammingZones(zones) {
    if (jammingLayer) {
      map.removeLayer(jammingLayer);
    }
    jammingLayer = L.layerGroup();

    zones.forEach(zone => {
      if (zone.active) {
        L.circle([zone.lat, zone.lon], {
          radius: zone.radius * 111000, // degrees to meters approx
          color: '#ef4444',
          fillColor: '#ef4444',
          fillOpacity: 0.08,
          weight: 2,
          dashArray: '6 4'
        }).bindTooltip(`GPS JAMMING: ${zone.name}`, {
          permanent: false,
          className: 'jamming-tooltip'
        }).addTo(jammingLayer);

        // Jamming icon
        L.marker([zone.lat, zone.lon], {
          icon: L.divIcon({
            className: 'jamming-icon',
            html: '<div style="color:#ef4444;font-family:monospace;font-size:16px;text-shadow:0 0 8px rgba(239,68,68,0.8);text-align:center;animation:pulse 1s infinite">&#9888;</div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          })
        }).addTo(jammingLayer);
      }
    });

    if (layers.jamming) {
      jammingLayer.addTo(map);
    }
  }

  function toggleLayer(name, visible) {
    switch (name) {
      case 'ships':
        if (visible) shipLayerGroup.addTo(map);
        else map.removeLayer(shipLayerGroup);
        break;
      case 'zones':
        if (visible) zoneLayer.addTo(map);
        else map.removeLayer(zoneLayer);
        break;
      case 'jamming':
        if (jammingLayer) {
          if (visible) jammingLayer.addTo(map);
          else map.removeLayer(jammingLayer);
        }
        break;
    }
  }

  return { init, updateShips, updateJammingZones };
})();

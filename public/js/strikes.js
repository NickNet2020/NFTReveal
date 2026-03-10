// ─── Hormuz Tracker Pro - Strike Tracking Module ────────────────────
const StrikeTracker = (function () {
  let strikeMap = null;
  let strikeZoneLayer, pathLayer, ewLayer;
  let strikeLayers = { zones: true, paths: true, jamming: true };
  let hourlyChart = null;
  let typeChart = null;
  let dailyChart = null;
  let initialized = false;

  const CHART_DEFAULTS = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          color: '#94a3b8',
          font: { family: "'JetBrains Mono', monospace", size: 9 },
          boxWidth: 8, padding: 8
        }
      },
      tooltip: {
        backgroundColor: '#1a2332',
        titleColor: '#e2e8f0',
        bodyColor: '#94a3b8',
        borderColor: '#1e3a5f',
        borderWidth: 1,
        titleFont: { family: "'JetBrains Mono', monospace", size: 11 },
        bodyFont: { family: "'JetBrains Mono', monospace", size: 10 },
        padding: 10, cornerRadius: 6
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(30, 58, 95, 0.3)', drawBorder: false },
        ticks: { color: '#64748b', font: { family: "'JetBrains Mono', monospace", size: 9 }, maxRotation: 0 }
      },
      y: {
        grid: { color: 'rgba(30, 58, 95, 0.3)', drawBorder: false },
        ticks: { color: '#64748b', font: { family: "'JetBrains Mono', monospace", size: 9 } },
        beginAtZero: true
      }
    }
  };

  function init() {
    if (initialized) return;
    initialized = true;
    initStrikeMap();
    initHourlyChart();
    initTypeChart();
    initDailyChart();
    setupStrikeMapControls();
  }

  // ─── Strike Map ──────────────────────────────────────────────────
  function initStrikeMap() {
    const container = document.getElementById('strike-map-container');
    if (!container || strikeMap) return;

    strikeMap = L.map('strike-map-container', {
      center: [25.5, 54.5],
      zoom: 6,
      zoomControl: true,
      attributionControl: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 16, opacity: 0.9
    }).addTo(strikeMap);

    strikeZoneLayer = L.layerGroup().addTo(strikeMap);
    pathLayer = L.layerGroup().addTo(strikeMap);
    ewLayer = L.layerGroup().addTo(strikeMap);

    // Draw GPS jamming hexagonal grid overlay
    drawEWGrid();
  }

  function drawEWGrid() {
    // Electronic Warfare zones — hexagonal grid approximation
    const ewZones = [
      { lat: 26.55, lon: 56.25, name: 'Northern Corridor', intensity: 0.8 },
      { lat: 26.30, lon: 56.45, name: 'Eastern Approach', intensity: 0.6 },
      { lat: 26.80, lon: 55.90, name: 'Qeshm Zone', intensity: 0.5 },
      { lat: 25.50, lon: 57.00, name: 'Gulf of Oman', intensity: 0.3 }
    ];

    ewZones.forEach(zone => {
      // Create hexagonal approximation using a 6-sided polygon
      const hexPoints = [];
      const radius = 0.12 + zone.intensity * 0.08;
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i + Math.PI / 6;
        hexPoints.push([
          zone.lat + radius * Math.cos(angle),
          zone.lon + radius * Math.sin(angle) * 1.2
        ]);
      }

      L.polygon(hexPoints, {
        color: `rgba(168, 85, 247, ${0.3 + zone.intensity * 0.4})`,
        fillColor: '#a855f7',
        fillOpacity: 0.06 + zone.intensity * 0.08,
        weight: 2,
        dashArray: '4 4'
      }).bindTooltip(`EW ZONE: ${zone.name}<br>Signal Degradation: ${Math.round(zone.intensity * 100)}%`, {
        permanent: false
      }).addTo(ewLayer);

      // Add EW icon
      L.marker([zone.lat, zone.lon], {
        icon: L.divIcon({
          className: 'ew-icon',
          html: `<div style="color:#a855f7;font-size:11px;font-family:monospace;font-weight:700;text-align:center;text-shadow:0 0 6px rgba(168,85,247,0.8);animation:pulse 1.5s infinite">[EW]</div>`,
          iconSize: [30, 16], iconAnchor: [15, 8]
        })
      }).addTo(ewLayer);
    });
  }

  function updateStrikeMap(recentStrikes) {
    if (!strikeMap) return;

    strikeZoneLayer.clearLayers();
    pathLayer.clearLayers();

    if (!recentStrikes || recentStrikes.length === 0) return;

    // Only show last 30 strikes on map
    const visible = recentStrikes.slice(-30);

    visible.forEach(strike => {
      // ── Strike Zone: pulsating circle at target ──
      if (strikeLayers.zones) {
        const targetColor = strike.intercepted ? '#22c55e' : '#ef4444';
        const targetRadius = strike.intercepted ? 8000 : 14000;
        const fillOpacity = strike.intercepted ? 0.10 : 0.20;

        L.circle([strike.target.lat, strike.target.lon], {
          radius: targetRadius,
          color: targetColor,
          fillColor: targetColor,
          fillOpacity,
          weight: 2,
          className: strike.intercepted ? '' : 'strike-pulse'
        }).bindTooltip(
          `${strike.intercepted ? 'INTERCEPTED' : 'IMPACT'}: ${strike.type}<br>Target: ${strike.target.name}<br>Source: ${strike.source}`,
          { permanent: false }
        ).addTo(strikeZoneLayer);

        // Impact marker
        L.marker([strike.target.lat, strike.target.lon], {
          icon: L.divIcon({
            className: 'strike-icon',
            html: `<div style="color:${strike.color};font-size:12px;text-align:center;text-shadow:0 0 4px ${strike.color};${strike.intercepted ? '' : 'animation:pulse 0.8s infinite'}">${strike.intercepted ? '\u2713' : '\u2716'}</div>`,
            iconSize: [16, 16], iconAnchor: [8, 8]
          })
        }).addTo(strikeZoneLayer);
      }

      // ── Flight Path: dashed parabolic arc ──
      if (strikeLayers.paths) {
        const arcPoints = generateParabolicArc(
          strike.origin.lat, strike.origin.lon,
          strike.target.lat, strike.target.lon,
          strike.projectileClass === 'Ballistic' ? 0.15 : 0.05
        );

        L.polyline(arcPoints, {
          color: strike.color,
          weight: 1.5,
          opacity: 0.5,
          dashArray: strike.projectileClass === 'Ballistic' ? '2 6' : '4 4'
        }).bindTooltip(`${strike.type} — ${strike.origin.name} \u2192 ${strike.target.name}`, {
          permanent: false
        }).addTo(pathLayer);

        // Origin marker (small)
        L.circleMarker([strike.origin.lat, strike.origin.lon], {
          radius: 4,
          color: strike.color,
          fillColor: strike.color,
          fillOpacity: 0.6,
          weight: 1
        }).bindTooltip(`Launch: ${strike.origin.name}`, { permanent: false }).addTo(pathLayer);
      }
    });
  }

  function generateParabolicArc(lat1, lon1, lat2, lon2, arcHeight) {
    const points = [];
    const segments = 20;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const lat = lat1 + (lat2 - lat1) * t;
      const lon = lon1 + (lon2 - lon1) * t;
      // Parabolic height: peaks at t=0.5
      const heightOffset = arcHeight * 4 * t * (1 - t);
      points.push([lat + heightOffset, lon]);
    }
    return points;
  }

  function setupStrikeMapControls() {
    document.querySelectorAll('[data-strike-layer]').forEach(btn => {
      btn.addEventListener('click', () => {
        const layer = btn.dataset.strikeLayer;
        btn.classList.toggle('active');
        strikeLayers[layer] = btn.classList.contains('active');
        if (layer === 'jamming') {
          if (strikeLayers.jamming) ewLayer.addTo(strikeMap);
          else strikeMap.removeLayer(ewLayer);
        }
      });
    });
  }

  // ─── Charts ──────────────────────────────────────────────────────
  function initHourlyChart() {
    const ctx = document.getElementById('strike-hourly-chart');
    if (!ctx) return;

    hourlyChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Ship Transits',
            data: [],
            backgroundColor: 'rgba(59, 130, 246, 0.5)',
            borderColor: '#3b82f6',
            borderWidth: 1,
            borderRadius: 2,
            yAxisID: 'y',
            order: 2
          },
          {
            label: 'Projectiles',
            data: [],
            type: 'line',
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            fill: true,
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 3,
            pointBackgroundColor: '#ef4444',
            yAxisID: 'y1',
            order: 1
          }
        ]
      },
      options: {
        ...CHART_DEFAULTS,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: CHART_DEFAULTS.scales.x,
          y: {
            ...CHART_DEFAULTS.scales.y,
            position: 'left',
            title: { display: true, text: 'Ships', color: '#3b82f6', font: { family: "'JetBrains Mono', monospace", size: 9 } }
          },
          y1: {
            ...CHART_DEFAULTS.scales.y,
            position: 'right',
            grid: { drawOnChartArea: false },
            title: { display: true, text: 'Projectiles', color: '#ef4444', font: { family: "'JetBrains Mono', monospace", size: 9 } }
          }
        }
      }
    });
  }

  function initTypeChart() {
    const ctx = document.getElementById('strike-type-chart');
    if (!ctx) return;

    typeChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [
          {
            label: 'UAV/Drones',
            data: [],
            backgroundColor: 'rgba(234, 179, 8, 0.6)',
            borderColor: '#eab308',
            borderWidth: 1,
            borderRadius: 2,
            stack: 'strikes'
          },
          {
            label: 'Cruise',
            data: [],
            backgroundColor: 'rgba(249, 115, 22, 0.6)',
            borderColor: '#f97316',
            borderWidth: 1,
            borderRadius: 2,
            stack: 'strikes'
          },
          {
            label: 'Ballistic',
            data: [],
            backgroundColor: 'rgba(220, 38, 38, 0.6)',
            borderColor: '#dc2626',
            borderWidth: 1,
            borderRadius: 2,
            stack: 'strikes'
          },
          {
            label: 'Intercepted',
            data: [],
            type: 'line',
            borderColor: '#22c55e',
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [4, 4],
            pointRadius: 2,
            pointBackgroundColor: '#22c55e'
          }
        ]
      },
      options: {
        ...CHART_DEFAULTS,
        interaction: { mode: 'index', intersect: false },
        scales: {
          ...CHART_DEFAULTS.scales,
          x: { ...CHART_DEFAULTS.scales.x, stacked: true },
          y: {
            ...CHART_DEFAULTS.scales.y,
            stacked: true,
            title: { display: true, text: 'Count', color: '#64748b', font: { family: "'JetBrains Mono', monospace", size: 9 } }
          }
        }
      }
    });
  }

  function initDailyChart() {
    const ctx = document.getElementById('strike-daily-chart');
    if (!ctx) return;

    dailyChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Ships/Day',
            data: [],
            backgroundColor: 'rgba(59, 130, 246, 0.5)',
            borderColor: '#3b82f6',
            borderWidth: 1,
            borderRadius: 2,
            yAxisID: 'y',
            order: 2
          },
          {
            label: 'Projectiles/Day',
            data: [],
            type: 'line',
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            fill: true,
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 2,
            pointBackgroundColor: '#ef4444',
            yAxisID: 'y1',
            order: 1
          },
          {
            label: 'Intercepted',
            data: [],
            type: 'line',
            borderColor: '#22c55e',
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderDash: [4, 4],
            pointRadius: 2,
            pointBackgroundColor: '#22c55e',
            yAxisID: 'y1',
            order: 0
          }
        ]
      },
      options: {
        ...CHART_DEFAULTS,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          ...CHART_DEFAULTS.plugins,
          tooltip: {
            ...CHART_DEFAULTS.plugins.tooltip,
            callbacks: {
              afterBody: function (context) {
                const idx = context[0].dataIndex;
                const chart = context[0].chart;
                const projectiles = chart.data.datasets[1].data[idx];
                const intercepted = chart.data.datasets[2].data[idx];
                if (projectiles > 0) {
                  return `Interception: ${((intercepted / projectiles) * 100).toFixed(0)}%`;
                }
                return '';
              }
            }
          }
        },
        scales: {
          x: CHART_DEFAULTS.scales.x,
          y: {
            ...CHART_DEFAULTS.scales.y,
            position: 'left',
            title: { display: true, text: 'Ships/Day', color: '#3b82f6', font: { family: "'JetBrains Mono', monospace", size: 9 } }
          },
          y1: {
            ...CHART_DEFAULTS.scales.y,
            position: 'right',
            grid: { drawOnChartArea: false },
            title: { display: true, text: 'Projectiles', color: '#ef4444', font: { family: "'JetBrains Mono', monospace", size: 9 } }
          }
        }
      }
    });
  }

  // ─── Data Update Functions ───────────────────────────────────────
  function updateHourlyCharts(hourlyStrikes, hourlyTransits) {
    if (!hourlyChart || !typeChart) return;
    if (!hourlyStrikes || hourlyStrikes.length === 0) return;

    const labels = hourlyStrikes.map(h => h.hourLabel);

    // Dual-axis: ships vs projectiles
    const shipData = (hourlyTransits || []).map(h => h.total);
    const projectileData = hourlyStrikes.map(h => h.total);

    hourlyChart.data.labels = labels;
    hourlyChart.data.datasets[0].data = shipData;
    hourlyChart.data.datasets[1].data = projectileData;
    hourlyChart.update('none');

    // Stacked type breakdown
    typeChart.data.labels = labels;
    typeChart.data.datasets[0].data = hourlyStrikes.map(h => h.drones);
    typeChart.data.datasets[1].data = hourlyStrikes.map(h => h.cruiseMissiles);
    typeChart.data.datasets[2].data = hourlyStrikes.map(h => h.ballisticMissiles);
    typeChart.data.datasets[3].data = hourlyStrikes.map(h => h.intercepted);
    typeChart.update('none');
  }

  function updateDailyChart(dailyStrikes, dailyHistory) {
    if (!dailyChart || !dailyStrikes || dailyStrikes.length === 0) return;

    const labels = dailyStrikes.map(d => {
      const parts = d.date.split('-');
      return parts[1] + '/' + parts[2];
    });

    const shipData = (dailyHistory || []).map(d => d.totalShips);
    const projectileData = dailyStrikes.map(d => d.total);
    const interceptedData = dailyStrikes.map(d => d.intercepted);

    dailyChart.data.labels = labels;
    dailyChart.data.datasets[0].data = shipData;
    dailyChart.data.datasets[1].data = projectileData;
    dailyChart.data.datasets[2].data = interceptedData;
    dailyChart.update('none');
  }

  function invalidateMap() {
    if (strikeMap) {
      setTimeout(() => strikeMap.invalidateSize(), 100);
    }
  }

  return {
    init,
    updateStrikeMap,
    updateHourlyCharts,
    updateDailyChart,
    invalidateMap
  };
})();

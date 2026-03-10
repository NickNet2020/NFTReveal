// ─── Hormuz Tracker Pro - Main Application ────────────────────────
(function () {
  'use strict';

  const socket = io();
  let state = {
    ships: [],
    metrics: null,
    hourlyTransits: [],
    dailyHistory: [],
    alerts: [],
    conflicts: [],
    transitHistory: [],
    strikeMetrics: null,
    hourlyStrikes: [],
    dailyStrikes: [],
    recentStrikes: []
  };

  let activeTab = 'dashboard';
  let strikeTabInitialized = false;

  // ─── DOM References ────────────────────────────────────────────
  const els = {
    utcTime: document.getElementById('utc-time'),
    straitStatus: document.getElementById('strait-status-badge'),
    straitStatusText: document.querySelector('#strait-status-badge .status-text'),
    escalationBadge: document.getElementById('escalation-badge'),
    escalationText: document.querySelector('#escalation-badge .escalation-text'),
    kpiCurrentHour: document.getElementById('kpi-current-hour'),
    kpiInbound: document.getElementById('kpi-inbound'),
    kpiOutbound: document.getElementById('kpi-outbound'),
    kpi24hTotal: document.getElementById('kpi-24h-total'),
    kpiAvgHour: document.getElementById('kpi-avg-hour'),
    kpiShipsZone: document.getElementById('kpi-ships-zone'),
    kpiShipBreakdown: document.getElementById('kpi-ship-breakdown'),
    kpiOilFlow: document.getElementById('kpi-oil-flow'),
    kpiMilitary: document.getElementById('kpi-military'),
    kpiDarkShips: document.getElementById('kpi-dark-ships'),
    kpiBrent: document.getElementById('kpi-brent'),
    kpiWti: document.getElementById('kpi-wti'),
    transitTbody: document.getElementById('transit-tbody'),
    transitCount: document.getElementById('transit-count'),
    alertsFeed: document.getElementById('alerts-feed'),
    alertCount: document.getElementById('alert-count'),
    conflictTimeline: document.getElementById('conflict-timeline'),
    insurancePremium: document.getElementById('insurance-premium'),
    blockadeStatus: document.getElementById('blockade-status'),
    exportCsvBtn: document.getElementById('export-csv-btn'),
    dataModeBadge: document.getElementById('data-mode-badge')
  };

  // ─── Initialize ────────────────────────────────────────────────
  function init() {
    HormuzMap.init();
    HormuzCharts.init();
    startClock();
    setupExportBtn();
    setupTabs();
    setupSocketHandlers();
  }

  // ─── Tab Navigation ─────────────────────────────────────────────
  function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        if (tab === activeTab) return;
        activeTab = tab;

        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
        const target = tab === 'dashboard' ? document.getElementById('dashboard') : document.getElementById('strikes-tab');
        if (target) target.classList.add('active');

        // Lazy-init strikes tab on first switch
        if (tab === 'strikes' && !strikeTabInitialized) {
          strikeTabInitialized = true;
          StrikeTracker.init();
          renderStrikeData();
        }
        if (tab === 'strikes') {
          StrikeTracker.invalidateMap();
        }
      });
    });
  }

  // ─── Clock ─────────────────────────────────────────────────────
  function startClock() {
    function updateClock() {
      const now = new Date();
      els.utcTime.textContent = now.toUTCString().split(' ')[4] + ' UTC';
    }
    updateClock();
    setInterval(updateClock, 1000);
  }

  // ─── CSV Export ────────────────────────────────────────────────
  function setupExportBtn() {
    els.exportCsvBtn.addEventListener('click', () => {
      window.open('/api/export/csv', '_blank');
    });
  }

  // ─── Socket Handlers ──────────────────────────────────────────
  function setupSocketHandlers() {
    socket.on('init', (data) => {
      state.ships = data.ships;
      state.metrics = data.metrics;
      state.hourlyTransits = data.hourlyTransits;
      state.dailyHistory = data.dailyHistory || [];
      state.alerts = data.alerts;
      state.conflicts = data.conflicts;
      state.transitHistory = data.transitHistory;
      state.strikeMetrics = data.strikeMetrics || null;
      state.hourlyStrikes = data.hourlyStrikes || [];
      state.dailyStrikes = data.dailyStrikes || [];
      state.recentStrikes = data.recentStrikes || [];

      renderAll();
      HormuzMap.updateShips(state.ships);
      HormuzMap.updateJammingZones(data.jammingZones || []);
      HormuzCharts.update(state.hourlyTransits);
      HormuzCharts.updateDaily(state.dailyHistory);
      if (strikeTabInitialized) renderStrikeData();
    });

    socket.on('update', (data) => {
      state.ships = data.ships;
      state.metrics = data.metrics;
      state.hourlyTransits = data.hourlyTransits;
      if (data.alerts) state.alerts = data.alerts;
      if (data.transitHistory) state.transitHistory = data.transitHistory;
      if (data.strikeMetrics) state.strikeMetrics = data.strikeMetrics;
      if (data.hourlyStrikes) state.hourlyStrikes = data.hourlyStrikes;
      if (data.recentStrikes) state.recentStrikes = data.recentStrikes;

      renderAll();
      HormuzMap.updateShips(state.ships);
      HormuzCharts.update(state.hourlyTransits);
      if (strikeTabInitialized) renderStrikeData();
    });

    socket.on('disconnect', () => {
      console.warn('Disconnected from server');
    });
  }

  // ─── Render All ────────────────────────────────────────────────
  function renderAll() {
    if (state.metrics) {
      renderMetrics(state.metrics);
      renderEscalation(state.metrics);
    }
    if (state.transitHistory) renderTransitTable(state.transitHistory);
    if (state.alerts) renderAlerts(state.alerts);
    if (state.conflicts) renderConflictTimeline(state.conflicts);
  }

  // ─── Render Metrics ───────────────────────────────────────────
  function renderMetrics(m) {
    // Strait status badge
    const statusMap = {
      OPEN: 'status-open',
      PARTIAL: 'status-partial',
      CLOSED: 'status-closed'
    };
    els.straitStatus.className = `status-badge ${statusMap[m.straitStatus] || 'status-partial'}`;
    els.straitStatusText.textContent = m.straitStatus;

    // Escalation badge
    const escMap = {
      NORMAL: 'escalation-normal',
      ELEVATED: 'escalation-elevated',
      CRITICAL: 'escalation-critical',
      WAR: 'escalation-war'
    };
    els.escalationBadge.className = `escalation-badge ${escMap[m.escalationLevel] || 'escalation-elevated'}`;
    els.escalationText.textContent = m.escalationLevel;

    // KPI cards
    els.kpiCurrentHour.textContent = m.currentHour.total;
    els.kpiInbound.textContent = m.currentHour.inbound;
    els.kpiOutbound.textContent = m.currentHour.outbound;
    els.kpi24hTotal.textContent = m.totalTransits24h;
    els.kpiAvgHour.textContent = m.avgPerHour;
    els.kpiShipsZone.textContent = m.shipCounts.total;
    els.kpiShipBreakdown.textContent = `${m.shipCounts.tankers}T ${m.shipCounts.lng}L ${m.shipCounts.containers}C`;
    els.kpiOilFlow.textContent = (m.cargo.oilBarrels24h / 1000000).toFixed(1);
    els.kpiMilitary.textContent = m.shipCounts.military;
    els.kpiDarkShips.textContent = `${m.shipCounts.dark} dark ships`;
    els.kpiBrent.textContent = `$${m.oilPrices.brent}`;
    els.kpiWti.textContent = m.oilPrices.wti;

    // Data mode indicator
    if (m.dataMode && els.dataModeBadge) {
      els.dataModeBadge.textContent = m.dataMode;
      els.dataModeBadge.className = 'data-mode-badge' + (m.dataMode === 'LIVE AIS' ? ' live-ais' : '');
    }

    // Insurance & blockade
    els.insurancePremium.textContent = m.insurance;
    els.blockadeStatus.textContent = m.blockadeStatus;

    // Update escalation panel indicators
    document.querySelectorAll('.esc-level').forEach(el => {
      el.classList.toggle('active', el.dataset.level === m.escalationLevel);
    });
  }

  // ─── Render Escalation ────────────────────────────────────────
  function renderEscalation(m) {
    document.querySelectorAll('.esc-level').forEach(el => {
      el.classList.toggle('active', el.dataset.level === m.escalationLevel);
    });
  }

  // ─── Render Transit Table ─────────────────────────────────────
  function renderTransitTable(transits) {
    els.transitCount.textContent = `${transits.length} records`;

    const html = transits.map(ship => {
      const time = ship.transitTime
        ? new Date(ship.transitTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        : '--:--';

      const typeColor = {
        tanker: '#ff8c00', lng: '#00ccff', container: '#3498db',
        bulk: '#8e44ad', military: '#ff0000'
      }[ship.category] || '#888';

      const cargoDisplay = ship.cargoType
        ? (ship.cargoType === 'LNG'
          ? `${(ship.cargoEstimate / 1000).toFixed(0)}k m3`
          : `${(ship.cargoEstimate / 1000000).toFixed(1)}M bbl`)
        : '--';

      const rowClass = ship.isMilitary ? 'military-row' : (ship.iranLinked ? 'iran-row' : '');
      const flagClass = ship.flag === 'Iran' || ship.iranLinked ? 'flag-iran' : '';
      const statusClass = ship.aisStatus === 'dark' ? 'status-dark' : 'status-active';
      const dirClass = ship.direction === 'inbound' ? 'dir-inbound' : 'dir-outbound';

      return `<tr class="${rowClass}">
        <td>${time}</td>
        <td>${ship.mmsi}</td>
        <td class="ship-name">${ship.name}</td>
        <td><span class="type-badge" style="background:${typeColor}20;color:${typeColor}">${ship.type.replace(/_/g, ' ')}</span></td>
        <td class="${flagClass}">${ship.flag}${ship.iranEntity ? ` (${ship.iranEntity})` : ''}</td>
        <td>${cargoDisplay}</td>
        <td>${ship.dwt.toLocaleString()}</td>
        <td>${ship.speed} kn</td>
        <td>${ship.etaPort}</td>
        <td class="${dirClass}">${ship.direction === 'inbound' ? 'IN' : 'OUT'}</td>
        <td class="${statusClass}">${ship.aisStatus === 'dark' ? 'DARK' : 'AIS'}</td>
      </tr>`;
    }).join('');

    els.transitTbody.innerHTML = html;
  }

  // ─── Render Alerts ────────────────────────────────────────────
  function renderAlerts(alerts) {
    els.alertCount.textContent = alerts.length;

    const html = alerts.map(alert => {
      const time = new Date(alert.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit'
      });

      const sevClass = {
        critical: 'alert-critical',
        high: 'alert-high',
        medium: 'alert-medium',
        info: 'alert-info'
      }[alert.severity] || 'alert-info';

      return `<div class="alert-item ${sevClass}">
        <div class="alert-header">
          <span class="alert-type">${alert.type}</span>
          <span class="alert-time">${time}</span>
        </div>
        <div class="alert-message">${alert.message}</div>
        <div class="alert-source">Source: ${alert.source}</div>
      </div>`;
    }).join('');

    els.alertsFeed.innerHTML = html;
  }

  // ─── Render Conflict Timeline ─────────────────────────────────
  function renderConflictTimeline(events) {
    const html = events.map(ev => {
      const sevClass = `sev-${ev.severity}`;
      const dateStr = ev.date.split('-').slice(1).join('/');

      return `<div class="timeline-item ${sevClass}">
        <span class="timeline-date">${dateStr}</span>
        <span class="timeline-dot"></span>
        <div class="timeline-content">
          <div class="timeline-event">${ev.event}</div>
          <div class="timeline-impact">${ev.impact}</div>
        </div>
      </div>`;
    }).join('');

    els.conflictTimeline.innerHTML = html;
  }

  // ─── Strike Data Rendering ──────────────────────────────────────
  function renderStrikeData() {
    if (!state.strikeMetrics) return;
    const sm = state.strikeMetrics;

    // KPIs
    setTextById('strike-kpi-drones', sm.h24.drones);
    setTextById('strike-kpi-cruise', sm.h24.cruise);
    setTextById('strike-kpi-ballistic', sm.h24.ballistic);
    setTextById('strike-kpi-total', sm.h24.total);
    setTextById('strike-kpi-intercept-rate', sm.h24.interceptionRate + '%');
    setTextById('strike-kpi-intercepted', sm.h24.intercepted);
    setTextById('strike-kpi-total-launched', sm.h24.total);
    setTextById('strike-kpi-cer', sm.h24.costExchangeRatio + 'x');

    // Cost exchange widget
    setTextById('attack-cost-24h', '$' + formatCurrency(sm.h24.attackCost));
    setTextById('intercept-rate-display', sm.h24.interceptionRate + '%');
    setTextById('defense-cost-24h', '$' + formatCurrency(sm.h24.defenseCost));
    setTextById('attack-cost-24h-2', '$' + formatCurrency(sm.h24.attackCost));
    setTextById('cer-display', sm.h24.costExchangeRatio + 'x');

    // 30-day cumulative
    setTextById('cost-30d-total', sm.d30.total.toLocaleString());
    setTextById('cost-30d-intercepted', sm.d30.intercepted.toLocaleString());
    setTextById('cost-30d-attack', '$' + formatCurrency(sm.d30.attackCost));
    setTextById('cost-30d-defense', '$' + formatCurrency(sm.d30.defenseCost));

    // Charts
    StrikeTracker.updateHourlyCharts(state.hourlyStrikes, state.hourlyTransits);
    StrikeTracker.updateDailyChart(state.dailyStrikes, state.dailyHistory);

    // Map overlays
    StrikeTracker.updateStrikeMap(state.recentStrikes);

    // Strike table
    renderStrikeTable(state.recentStrikes);
  }

  function setTextById(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function formatCurrency(value) {
    if (value >= 1e9) return (value / 1e9).toFixed(2) + 'B';
    if (value >= 1e6) return (value / 1e6).toFixed(1) + 'M';
    if (value >= 1e3) return (value / 1e3).toFixed(0) + 'K';
    return value.toString();
  }

  function renderStrikeTable(strikes) {
    const tbody = document.getElementById('strike-tbody');
    const countEl = document.getElementById('strike-count');
    if (!tbody || !strikes) return;

    countEl.textContent = `${strikes.length} events`;

    const recent = strikes.slice().reverse().slice(0, 30);
    const html = recent.map(s => {
      const time = new Date(s.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      const classColors = { 'UAV': '#eab308', 'Cruise': '#f97316', 'Ballistic': '#dc2626' };
      const color = classColors[s.projectileClass] || '#888';
      const statusClass = s.intercepted ? 'strike-intercepted' : 'strike-impact';
      const statusText = s.intercepted ? 'INTERCEPTED' : 'IMPACT';

      return `<tr>
        <td>${time}</td>
        <td><span class="type-badge" style="background:${color}20;color:${color}">${s.type}</span></td>
        <td style="color:${color}">${s.projectileClass}</td>
        <td>${s.origin.name}</td>
        <td>${s.target.name}</td>
        <td class="${statusClass}">${statusText}</td>
        <td>$${formatCurrency(s.cost)}</td>
        <td>${s.intercepted ? '$' + formatCurrency(s.interceptorCost) : '--'}</td>
        <td style="color:var(--text-muted)">${s.source}</td>
      </tr>`;
    }).join('');

    tbody.innerHTML = html;
  }

  // ─── Start ─────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', init);
})();

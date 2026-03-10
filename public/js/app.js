// ─── Hormuz Tracker Pro - Main Application ────────────────────────
(function () {
  'use strict';

  const socket = io();
  let state = {
    ships: [],
    metrics: null,
    hourlyTransits: [],
    alerts: [],
    conflicts: [],
    transitHistory: []
  };

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
    exportCsvBtn: document.getElementById('export-csv-btn')
  };

  // ─── Initialize ────────────────────────────────────────────────
  function init() {
    HormuzMap.init();
    HormuzCharts.init();
    startClock();
    setupExportBtn();
    setupSocketHandlers();
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
      state.alerts = data.alerts;
      state.conflicts = data.conflicts;
      state.transitHistory = data.transitHistory;

      renderAll();
      HormuzMap.updateShips(state.ships);
      HormuzMap.updateJammingZones(data.jammingZones || []);
      HormuzCharts.update(state.hourlyTransits);
    });

    socket.on('update', (data) => {
      state.ships = data.ships;
      state.metrics = data.metrics;
      state.hourlyTransits = data.hourlyTransits;
      if (data.alerts) state.alerts = data.alerts;
      if (data.transitHistory) state.transitHistory = data.transitHistory;

      renderAll();
      HormuzMap.updateShips(state.ships);
      HormuzCharts.update(state.hourlyTransits);
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

  // ─── Start ─────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', init);
})();

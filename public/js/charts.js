// ─── Hormuz Tracker Pro - Chart.js Visualizations ──────────────────
const HormuzCharts = (function () {
  let transitChart = null;
  let cargoChart = null;
  let dailyChart = null;

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
          boxWidth: 8,
          padding: 8
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
        padding: 10,
        cornerRadius: 6
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(30, 58, 95, 0.3)', drawBorder: false },
        ticks: {
          color: '#64748b',
          font: { family: "'JetBrains Mono', monospace", size: 9 },
          maxRotation: 0
        }
      },
      y: {
        grid: { color: 'rgba(30, 58, 95, 0.3)', drawBorder: false },
        ticks: {
          color: '#64748b',
          font: { family: "'JetBrains Mono', monospace", size: 9 }
        },
        beginAtZero: true
      }
    }
  };

  function init() {
    initTransitChart();
    initCargoChart();
    initDailyChart();
  }

  function initTransitChart() {
    const ctx = document.getElementById('transit-chart');
    if (!ctx) return;

    transitChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Inbound',
            data: [],
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            fill: true,
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 2,
            pointBackgroundColor: '#10b981'
          },
          {
            label: 'Outbound',
            data: [],
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            fill: true,
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 2,
            pointBackgroundColor: '#f59e0b'
          },
          {
            label: 'Military',
            data: [],
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.05)',
            fill: false,
            tension: 0.1,
            borderWidth: 1.5,
            pointRadius: 3,
            pointBackgroundColor: '#ef4444',
            borderDash: [4, 4]
          }
        ]
      },
      options: {
        ...CHART_DEFAULTS,
        interaction: { mode: 'index', intersect: false },
        scales: {
          ...CHART_DEFAULTS.scales,
          y: {
            ...CHART_DEFAULTS.scales.y,
            title: {
              display: true,
              text: 'Ships',
              color: '#64748b',
              font: { family: "'JetBrains Mono', monospace", size: 9 }
            }
          }
        }
      }
    });
  }

  function initCargoChart() {
    const ctx = document.getElementById('cargo-chart');
    if (!ctx) return;

    cargoChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Oil (M bbl)',
            data: [],
            backgroundColor: 'rgba(255, 140, 0, 0.6)',
            borderColor: '#ff8c00',
            borderWidth: 1,
            borderRadius: 2
          },
          {
            label: 'LNG (k m3)',
            data: [],
            backgroundColor: 'rgba(0, 204, 255, 0.5)',
            borderColor: '#00ccff',
            borderWidth: 1,
            borderRadius: 2
          }
        ]
      },
      options: {
        ...CHART_DEFAULTS,
        scales: {
          ...CHART_DEFAULTS.scales,
          x: {
            ...CHART_DEFAULTS.scales.x,
            stacked: false
          },
          y: {
            ...CHART_DEFAULTS.scales.y,
            title: {
              display: true,
              text: 'Volume',
              color: '#64748b',
              font: { family: "'JetBrains Mono', monospace", size: 9 }
            }
          }
        }
      }
    });
  }

  function updateTransitChart(hourlyData) {
    if (!transitChart || !hourlyData || hourlyData.length === 0) return;

    const labels = hourlyData.map(h => h.hourLabel);
    const inbound = hourlyData.map(h => h.inbound);
    const outbound = hourlyData.map(h => h.outbound);
    const military = hourlyData.map(h => h.military);

    transitChart.data.labels = labels;
    transitChart.data.datasets[0].data = inbound;
    transitChart.data.datasets[1].data = outbound;
    transitChart.data.datasets[2].data = military;
    transitChart.update('none');
  }

  function updateCargoChart(hourlyData) {
    if (!cargoChart || !hourlyData || hourlyData.length === 0) return;

    const labels = hourlyData.map(h => h.hourLabel);
    const oil = hourlyData.map(h => +(h.oilBarrels / 1000000).toFixed(2));
    const lng = hourlyData.map(h => +(h.lngCargo / 1000).toFixed(1));

    cargoChart.data.labels = labels;
    cargoChart.data.datasets[0].data = oil;
    cargoChart.data.datasets[1].data = lng;
    cargoChart.update('none');
  }

  function initDailyChart() {
    const ctx = document.getElementById('daily-chart');
    if (!ctx) return;

    dailyChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Ships/Day',
            data: [],
            backgroundColor: [],
            borderColor: [],
            borderWidth: 1,
            borderRadius: 2,
            order: 2
          },
          {
            label: 'Pre-War Baseline',
            data: [],
            type: 'line',
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.08)',
            fill: true,
            tension: 0.3,
            borderWidth: 2,
            borderDash: [6, 3],
            pointRadius: 0,
            order: 1
          },
          {
            label: 'Military',
            data: [],
            type: 'line',
            borderColor: '#ef4444',
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderDash: [3, 3],
            pointRadius: 2,
            pointBackgroundColor: '#ef4444',
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
              afterBody: function(context) {
                const idx = context[0].dataIndex;
                const ships = context[0].chart.data.datasets[0].data[idx];
                const baseline = context[0].chart.data.datasets[1].data[idx];
                if (ships && baseline) {
                  const diff = ships - baseline;
                  const pct = ((diff / baseline) * 100).toFixed(0);
                  return `Change: ${diff > 0 ? '+' : ''}${diff} (${diff > 0 ? '+' : ''}${pct}%)`;
                }
                return '';
              }
            }
          },
          annotation: undefined
        },
        scales: {
          ...CHART_DEFAULTS.scales,
          y: {
            ...CHART_DEFAULTS.scales.y,
            title: {
              display: true,
              text: 'Ships / Day',
              color: '#64748b',
              font: { family: "'JetBrains Mono', monospace", size: 9 }
            }
          }
        }
      }
    });
  }

  function updateDailyChart(dailyData) {
    if (!dailyChart || !dailyData || dailyData.length === 0) return;

    const labels = dailyData.map(d => {
      const parts = d.date.split('-');
      return parts[1] + '/' + parts[2];
    });
    const ships = dailyData.map(d => d.totalShips);
    const baseline = dailyData.map(d => d.preWarBaseline);
    const military = dailyData.map(d => d.military);

    // Color bars: green for pre-war, orange/red for post-war based on drop severity
    const barColors = dailyData.map(d => {
      if (d.isPreWar) return 'rgba(16, 185, 129, 0.6)';
      const ratio = d.totalShips / d.preWarBaseline;
      if (ratio > 0.7) return 'rgba(245, 158, 11, 0.6)';
      if (ratio > 0.4) return 'rgba(249, 115, 22, 0.6)';
      return 'rgba(239, 68, 68, 0.6)';
    });
    const borderColors = dailyData.map(d => {
      if (d.isPreWar) return '#10b981';
      const ratio = d.totalShips / d.preWarBaseline;
      if (ratio > 0.7) return '#f59e0b';
      if (ratio > 0.4) return '#f97316';
      return '#ef4444';
    });

    dailyChart.data.labels = labels;
    dailyChart.data.datasets[0].data = ships;
    dailyChart.data.datasets[0].backgroundColor = barColors;
    dailyChart.data.datasets[0].borderColor = borderColors;
    dailyChart.data.datasets[1].data = baseline;
    dailyChart.data.datasets[2].data = military;
    dailyChart.update('none');
  }

  function update(hourlyData) {
    updateTransitChart(hourlyData);
    updateCargoChart(hourlyData);
  }

  return { init, update, updateDaily: updateDailyChart };
})();

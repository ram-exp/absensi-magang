/**
 * charts.js — thin wrappers around Chart.js so pages just pass data.
 * Keeps a registry of instances so charts can be destroyed/rebuilt on theme change.
 */

const Charts = (() => {
  const instances = {};

  function themeColors() {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      grid: dark ? 'rgba(255,255,255,.06)' : 'rgba(15,20,30,.06)',
      text: dark ? '#A6ABC4' : '#565B6E',
    };
  }

  function destroy(id) { if (instances[id]) { instances[id].destroy(); delete instances[id]; } }

  function statusColors() {
    return { hadir: '#10B981', terlambat: '#F59E0B', izin: '#0EA5E9', sakit: '#94A3B8', alpha: '#F43F5E' };
  }

  function chartLibReady(canvasId) {
    if (typeof Chart !== 'undefined') return true;
    const ctx = document.getElementById(canvasId);
    if (ctx && ctx.parentElement) ctx.parentElement.innerHTML = '<div class="text-muted" style="font-size:.75rem;padding:20px;text-align:center">Grafik tidak dapat dimuat (Chart.js gagal diakses).</div>';
    return false;
  }

  /** Doughnut: attendance status breakdown */
  function statusDoughnut(canvasId, summary) {
    if (!chartLibReady(canvasId)) return;
    destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const colors = statusColors();
    const labels = ['Hadir', 'Terlambat', 'Izin', 'Sakit', 'Alpha'];
    const keys = ['hadir', 'terlambat', 'izin', 'sakit', 'alpha'];
    instances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: { labels, datasets: [{ data: keys.map(k => summary[k] || 0), backgroundColor: keys.map(k => colors[k]), borderWidth: 0, hoverOffset: 6 }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '68%',
        plugins: { legend: { position: 'bottom', labels: { color: themeColors().text, boxWidth: 10, padding: 14, font: { family: 'Inter', size: 11 } } } },
      },
    });
  }

  /** Line chart: attendance trend over a list of {label, hadir, terlambat} */
  function trendLine(canvasId, points) {
    if (!chartLibReady(canvasId)) return;
    destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const tc = themeColors();
    instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: points.map(p => p.label),
        datasets: [
          { label: 'Hadir', data: points.map(p => p.hadir), borderColor: '#6366F1', backgroundColor: 'rgba(99,102,241,.12)', tension: .4, fill: true, pointRadius: 3 },
          { label: 'Terlambat', data: points.map(p => p.terlambat), borderColor: '#F59E0B', backgroundColor: 'rgba(245,158,11,.08)', tension: .4, fill: true, pointRadius: 3 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { color: tc.text, boxWidth: 10, font: { family: 'Inter', size: 11 } } } },
        scales: {
          x: { grid: { color: tc.grid }, ticks: { color: tc.text, font: { size: 10 } } },
          y: { grid: { color: tc.grid }, ticks: { color: tc.text, font: { size: 10 } }, beginAtZero: true },
        },
      },
    });
  }

  /** Bar chart: comparison across participants (e.g. attendance rate) */
  function participantBar(canvasId, labels, data, color = '#8B5CF6') {
    if (!chartLibReady(canvasId)) return;
    destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const tc = themeColors();
    instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Tingkat Kehadiran (%)', data, backgroundColor: color, borderRadius: 6, maxBarThickness: 34 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: tc.text, font: { size: 10 } } },
          y: { grid: { color: tc.grid }, ticks: { color: tc.text, font: { size: 10 } }, beginAtZero: true, max: 100 },
        },
      },
    });
  }

  /** Horizontal bar for division / institution distribution */
  function distributionBar(canvasId, labels, data) {
    if (!chartLibReady(canvasId)) return;
    destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const tc = themeColors();
    instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ data, backgroundColor: '#0EA5E9', borderRadius: 6 }] },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: tc.grid }, ticks: { color: tc.text, font: { size: 10 } }, beginAtZero: true },
          y: { grid: { display: false }, ticks: { color: tc.text, font: { size: 11 } } },
        },
      },
    });
  }

  return { statusDoughnut, trendLine, participantBar, distributionBar, destroy, statusColors };
})();

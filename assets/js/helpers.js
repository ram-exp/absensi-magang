/**
 * helpers.js — pure utility functions shared across the app.
 * No DOM/localStorage side effects except where explicitly a "format" helper.
 */

const Helpers = (() => {

  /** Sanitize any user-provided string before it is stored or rendered as HTML. */
  function sanitize(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /** Strip tags / trim for plain text inputs (used before saving to storage). */
  function cleanInput(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/<[^>]*>?/gm, '').trim();
  }

  /** Cryptographically-random password (falls back to Math.random if crypto is unavailable). */
  function generatePassword(length = 10) {
    const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/l/i to avoid confusion
    let out = '';
    if (window.crypto && crypto.getRandomValues) {
      const bytes = new Uint32Array(length);
      crypto.getRandomValues(bytes);
      for (let i = 0; i < length; i++) out += chars[bytes[i] % chars.length];
    } else {
      for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
  }

  function uid(prefix = 'id') {
    return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  }

  /** Generate sequential-looking participant ID e.g. MG-2026-014 */
  function generateParticipantId(existingCount) {
    const year = new Date().getFullYear();
    const seq = String(existingCount + 1).padStart(3, '0');
    return `MG-${year}-${seq}`;
  }

  function pad2(n) { return String(n).padStart(2, '0'); }

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function nowTime() {
    const d = new Date();
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  }

  function formatDate(iso, opts = {}) {
    if (!iso) return '-';
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return iso;
    const fmt = { day: '2-digit', month: 'short', year: 'numeric', ...opts };
    return d.toLocaleDateString('id-ID', fmt);
  }

  function formatDateLong(iso) {
    if (!iso) return '-';
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  }

  function formatDateTime(ts) {
    const d = new Date(ts);
    return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function formatTimeAgo(ts) {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return 'Baru saja';
    if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)} hari lalu`;
    return formatDateTime(ts);
  }

  function daysBetween(a, b) {
    const d1 = new Date(a + 'T00:00:00');
    const d2 = new Date(b + 'T00:00:00');
    return Math.round((d2 - d1) / 86400000);
  }

  function addDays(iso, days) {
    const d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function clamp(n, min, max) { return Math.min(Math.max(n, min), max); }

  function debounce(fn, wait = 300) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function downloadFile(filename, content, mime = 'application/json') {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  function toCSV(rows) {
    if (!rows.length) return '';
    const headers = Object.keys(rows[0]);
    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [headers.join(',')];
    rows.forEach(r => lines.push(headers.map(h => escape(r[h])).join(',')));
    return lines.join('\n');
  }

  /**
   * Opens a clean, standalone print window for a report — independent from the
   * app's sidebar/topbar layout, so "Cetak" always produces a tidy printout.
   * opts: { title, subtitle, meta: [{label,value}], columns: [str], rows: [[...]] }
   */
  function printReport({ title, subtitle = '', meta = [], columns = [], rows = [] }) {
    const win = window.open('', '_blank', 'width=1000,height=800');
    if (!win) { alert('Popup diblokir browser. Izinkan popup untuk mencetak laporan.'); return; }
    const metaHtml = meta.length
      ? `<table class="meta-table">${meta.map(m => `<tr><td class="meta-label">${sanitize(m.label)}</td><td>: ${sanitize(String(m.value))}</td></tr>`).join('')}</table>`
      : '';
    const theadHtml = `<tr>${columns.map(c => `<th>${sanitize(c)}</th>`).join('')}</tr>`;
    const tbodyHtml = rows.length
      ? rows.map(r => `<tr>${r.map(c => `<td>${sanitize(String(c ?? '-'))}</td>`).join('')}</tr>`).join('')
      : `<tr><td colspan="${columns.length || 1}" style="text-align:center;color:#888;padding:24px">Tidak ada data untuk dicetak.</td></tr>`;

    win.document.write(`<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">
      <title>${sanitize(title)}</title>
      <style>
        * { box-sizing:border-box; }
        body { font-family: Arial, Helvetica, sans-serif; color:#12141C; padding:36px; }
        .print-header { display:flex; align-items:center; gap:12px; border-bottom:2px solid #12141C; padding-bottom:14px; margin-bottom:18px; }
        .print-header .logo { width:38px; height:38px; border-radius:9px; background:linear-gradient(135deg,#6366F1,#8B5CF6); flex-shrink:0; }
        .print-header h1 { font-size:18px; margin:0; }
        .print-header p { font-size:11px; color:#666; margin:2px 0 0; }
        h2.doc-title { font-size:16px; margin:18px 0 4px; }
        .doc-subtitle { font-size:12px; color:#666; margin:0 0 14px; }
        .meta-table { font-size:12px; margin-bottom:16px; border-collapse:collapse; }
        .meta-table td { padding:2px 6px 2px 0; vertical-align:top; }
        .meta-label { font-weight:700; white-space:nowrap; }
        table.data-table { width:100%; border-collapse:collapse; font-size:12px; }
        table.data-table th, table.data-table td { border:1px solid #ccc; padding:7px 9px; text-align:left; }
        table.data-table th { background:#F2F3F8; font-weight:700; text-transform:uppercase; font-size:10px; letter-spacing:.03em; }
        table.data-table tr:nth-child(even) td { background:#FAFBFD; }
        .print-footer { margin-top:22px; font-size:10px; color:#999; text-align:right; }
        @media print { body{ padding:14px; } }
      </style></head>
      <body>
        <div class="print-header">
          <div class="logo"></div>
          <div><h1>Sistem Absensi Anak Magang</h1><p>Dokumen dicetak otomatis dari aplikasi</p></div>
        </div>
        <h2 class="doc-title">${sanitize(title)}</h2>
        ${subtitle ? `<p class="doc-subtitle">${sanitize(subtitle)}</p>` : ''}
        ${metaHtml}
        <table class="data-table"><thead>${theadHtml}</thead><tbody>${tbodyHtml}</tbody></table>
        <div class="print-footer">Dicetak pada ${new Date().toLocaleString('id-ID')}</div>
      </body></html>`);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
  }

  function initials(name = '') {
    return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
  }

  /** Deterministic pastel-ish color from a string, used for avatar fallback */
  function colorFromString(str = '') {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 65%, 55%)`;
  }

  function avatarDataUri(name) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80">
      <rect width="80" height="80" rx="40" fill="${colorFromString(name)}"/>
      <text x="50%" y="54%" font-family="Inter,sans-serif" font-size="30" fill="#fff" text-anchor="middle" font-weight="700">${initials(name)}</text>
    </svg>`;
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
  }

  function statusLabel(status) {
    const map = { hadir: 'Hadir', terlambat: 'Terlambat', izin: 'Izin', sakit: 'Sakit', alpha: 'Alpha' };
    return map[status] || status;
  }

  function queryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  return {
    sanitize, cleanInput, uid, generatePassword, generateParticipantId, pad2, todayISO, nowTime,
    formatDate, formatDateLong, formatDateTime, formatTimeAgo, daysBetween, addDays,
    clamp, debounce, fileToBase64, downloadFile, toCSV, printReport, initials, colorFromString,
    avatarDataUri, statusLabel, queryParam
  };
})();

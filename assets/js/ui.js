/**
 * ui.js — application shell (sidebar/topbar), and reusable UI primitives:
 * toast, modal, confirm dialog, dropdown menu, command palette, ripple,
 * confetti, sound notification, skeleton helpers, empty/error state markup.
 */

const UI = (() => {

  const NAV = [
    { group: 'Menu Utama', items: [
      { id: 'dashboard', label: 'Dashboard', href: 'dashboard.html', icon: 'layout-dashboard', roles: ['admin', 'pembimbing', 'peserta'] },
      { id: 'absensi', label: 'Absensi', href: 'absensi.html', icon: 'clock', roles: ['admin', 'pembimbing', 'peserta'] },
      { id: 'peserta', label: 'Peserta Magang', href: 'peserta.html', icon: 'users', roles: ['admin', 'pembimbing'] },
      { id: 'laporan', label: 'Laporan', href: 'laporan.html', icon: 'bar-chart-3', roles: ['admin', 'pembimbing'] },
    ]},
    { group: 'Akun', items: [
      { id: 'profile', label: 'Profil', href: 'profile.html', icon: 'user-circle', roles: ['admin', 'pembimbing', 'peserta'] },
      { id: 'settings', label: 'Pengaturan', href: 'settings.html', icon: 'settings', roles: ['admin', 'pembimbing', 'peserta'] },
    ]},
  ];

  // ---------------- Theme ----------------
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }
  function initTheme() {
    const settings = Storage.getSettings();
    applyTheme(settings.theme || 'light');
    applyAccent(settings.accentTheme || 'indigo');
  }

  const ACCENTS = {
    indigo: ['#6366F1', '#8B5CF6'],
    emerald: ['#10B981', '#22D3EE'],
    rose: ['#F43F5E', '#FB7185'],
    amber: ['#F59E0B', '#FBBF24'],
    sky: ['#0EA5E9', '#6366F1'],
    violet: ['#8B5CF6', '#D946EF'],
  };
  function applyAccent(name) {
    const pair = ACCENTS[name] || ACCENTS.indigo;
    document.documentElement.style.setProperty('--brand-indigo', pair[0]);
    document.documentElement.style.setProperty('--brand-violet', pair[1]);
    document.documentElement.style.setProperty('--brand-gradient', `linear-gradient(135deg, ${pair[0]} 0%, ${pair[1]} 100%)`);
  }
  function toggleTheme() {
    const settings = Storage.getSettings();
    const next = settings.theme === 'dark' ? 'light' : 'dark';
    Storage.saveSettings({ theme: next });
    applyTheme(next);
    return next;
  }

  // ---------------- Shell (sidebar + topbar) ----------------
  function renderShell(activeId, user) {
    const sidebarEl = document.getElementById('app-sidebar');
    const topbarEl = document.getElementById('app-topbar');
    if (!sidebarEl || !topbarEl) return;

    const collapsed = localStorage.getItem('sidebar_collapsed') === '1';

    sidebarEl.className = `sidebar${collapsed ? ' collapsed' : ''}`;
    sidebarEl.innerHTML = `
      <div class="sidebar-head">
        <div class="logo-dot">${icon('graduation-cap', 18)}</div>
        <div class="brand-text">Absensi Magang<small>Internship Attendance</small></div>
      </div>
      <nav class="sidebar-nav">
        ${NAV.map(group => {
          const items = group.items.filter(i => i.roles.includes(user.role));
          if (!items.length) return '';
          return `<div class="nav-group-label">${group.group}</div>
            ${items.map(i => `
              <a class="nav-item${i.id === activeId ? ' active' : ''}" href="${i.href}" data-nav="${i.id}">
                ${icon(i.icon, 18)}<span>${i.label}</span>
              </a>`).join('')}`;
        }).join('')}
      </nav>
      <div class="sidebar-foot">
        <div class="user-chip" id="user-chip-trigger">
          <img class="avatar" src="${user.avatar || Helpers.avatarDataUri(user.name)}" alt="">
          <div class="u-meta">
            <div class="u-name">${Helpers.sanitize(user.name)}</div>
            <div class="u-role">${Helpers.sanitize(user.role)}</div>
          </div>
          ${icon('chevron-up', 14)}
        </div>
      </div>
    `;

    topbarEl.innerHTML = `
      <button class="icon-btn" id="btn-sidebar-toggle" aria-label="Toggle sidebar">${icon('panel-left', 18)}</button>
      <button class="icon-btn" id="btn-mobile-nav" aria-label="Menu" style="display:none">${icon('menu', 18)}</button>
      <button class="search-trigger" id="btn-cmdk-open">
        ${icon('search', 16)}<span>Cari atau jalankan perintah…</span><kbd>Ctrl K</kbd>
      </button>
      <div style="flex:1"></div>
      <div class="weather-chip hidden" id="weather-chip">${icon('cloud-sun', 14)}<span>—</span></div>
      <button class="icon-btn" id="btn-theme-toggle" aria-label="Ganti tema">${icon(Storage.getSettings().theme === 'dark' ? 'sun' : 'moon', 18)}</button>
      <button class="icon-btn" id="btn-notif" aria-label="Notifikasi">${icon('bell', 18)}<span class="dot-alert" id="notif-dot"></span></button>
      <img class="avatar" style="width:34px;height:34px;border-radius:50%;object-fit:cover;cursor:pointer" id="topbar-avatar" src="${user.avatar || Helpers.avatarDataUri(user.name)}">
    `;

    // Backdrop for mobile
    if (!document.querySelector('.sidebar-backdrop')) {
      const bd = document.createElement('div');
      bd.className = 'sidebar-backdrop';
      bd.id = 'sidebar-backdrop';
      document.body.appendChild(bd);
    }

    wireShellEvents(user);
    initWeatherWidget();
    checkReminder(user);
    updateNotifDot(user);
  }

  function updateNotifDot(user) {
    const anns = Storage.list(Storage.KEYS.announcements).length;
    const resets = (user.role === 'admin' && Auth.pendingPasswordRequests) ? Auth.pendingPasswordRequests().length : 0;
    const dot = document.getElementById('notif-dot');
    if (dot) dot.style.display = (anns + resets) ? 'block' : 'none';
  }

  function wireShellEvents(user) {
    const sidebar = document.getElementById('app-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');

    document.getElementById('btn-sidebar-toggle')?.addEventListener('click', () => {
      const isCollapsed = sidebar.classList.toggle('collapsed');
      localStorage.setItem('sidebar_collapsed', isCollapsed ? '1' : '0');
    });

    const mobileToggle = document.getElementById('btn-mobile-nav');
    function syncMobileToggle() {
      const isMobile = window.innerWidth <= 900;
      mobileToggle.style.display = isMobile ? 'flex' : 'none';
      document.getElementById('btn-sidebar-toggle').style.display = isMobile ? 'none' : 'flex';
    }
    syncMobileToggle();
    window.addEventListener('resize', Helpers.debounce(syncMobileToggle, 150));
    mobileToggle.addEventListener('click', () => {
      sidebar.classList.toggle('mobile-open');
      backdrop.classList.toggle('show');
    });
    backdrop.addEventListener('click', () => {
      sidebar.classList.remove('mobile-open');
      backdrop.classList.remove('show');
    });

    document.getElementById('btn-theme-toggle').addEventListener('click', (e) => {
      const next = toggleTheme();
      e.currentTarget.innerHTML = icon(next === 'dark' ? 'sun' : 'moon', 18);
    });

    document.getElementById('btn-cmdk-open').addEventListener('click', () => openCommandPalette(user));

    const userChip = document.getElementById('user-chip-trigger');
    const topAvatar = document.getElementById('topbar-avatar');
    [userChip, topAvatar].forEach(el => el?.addEventListener('click', (e) => {
      e.stopPropagation();
      openMenu(el, [
        { label: 'Profil Saya', icon: 'user-circle', action: () => location.href = 'profile.html' },
        { label: 'Pengaturan', icon: 'settings', action: () => location.href = 'settings.html' },
        { divider: true },
        { label: 'Keluar', icon: 'log-out', danger: true, action: () => confirmDialog({
          title: 'Keluar dari aplikasi?', message: 'Anda perlu login kembali untuk mengakses sistem.',
          confirmText: 'Keluar', danger: true, onConfirm: () => Auth.logout(),
        }) },
      ]);
    }));

    document.getElementById('btn-notif').addEventListener('click', (e) => {
      e.stopPropagation();
      renderNotifMenu(e.currentTarget, user);
    });

    initRipple();
    initLucide();
  }

  function renderNotifMenu(anchor, user) {
    const anns = Storage.list(Storage.KEYS.announcements).slice(0, 5);
    const resetItems = (user && user.role === 'admin') ? (Auth.pendingPasswordRequests ? Auth.pendingPasswordRequests() : []) : [];
    const items = [
      ...resetItems.map(r => ({ label: `Permintaan reset password: ${r.name}`, icon: 'key-round', sub: Helpers.formatTimeAgo(r.timestamp), action: () => location.href = 'settings.html' })),
      ...anns.map(a => ({ label: a.title, icon: 'megaphone', sub: Helpers.formatDate(a.date), action: () => location.href = 'dashboard.html#pengumuman' })),
    ];
    document.getElementById('notif-dot').style.display = items.length ? 'block' : 'none';
    openMenu(anchor, items.length ? items : [{ label: 'Tidak ada notifikasi baru', icon: 'bell-off', action: () => {} }]);
  }

  // ---------------- Icons (Lucide) ----------------
  function icon(name, size = 16) {
    return `<i data-lucide="${name}" style="width:${size}px;height:${size}px"></i>`;
  }
  function initLucide() {
    if (window.lucide) window.lucide.createIcons();
  }

  // ---------------- Ripple effect ----------------
  function initRipple() {
    document.querySelectorAll('.btn').forEach(btn => {
      if (btn.dataset.rippleBound) return;
      btn.dataset.rippleBound = '1';
      btn.addEventListener('click', function (e) {
        const rect = this.getBoundingClientRect();
        const r = document.createElement('span');
        const size = Math.max(rect.width, rect.height);
        r.className = 'ripple';
        r.style.width = r.style.height = `${size}px`;
        r.style.left = `${e.clientX - rect.left - size / 2}px`;
        r.style.top = `${e.clientY - rect.top - size / 2}px`;
        this.appendChild(r);
        setTimeout(() => r.remove(), 620);
      });
    });
  }

  // ---------------- Toast notifications ----------------
  function ensureToastStack() {
    let stack = document.querySelector('.toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'toast-stack';
      document.body.appendChild(stack);
    }
    return stack;
  }
  const TOAST_ICONS = { success: 'check-circle-2', error: 'x-circle', warning: 'alert-triangle', info: 'info' };
  function toast(type, title, message = '', duration = 4200) {
    const stack = ensureToastStack();
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `
      <div class="t-icon">${icon(TOAST_ICONS[type] || 'info', 16)}</div>
      <div style="flex:1">
        <div class="t-title">${Helpers.sanitize(title)}</div>
        ${message ? `<div class="t-msg">${Helpers.sanitize(message)}</div>` : ''}
      </div>
      <button class="t-close">${icon('x', 14)}</button>
    `;
    stack.appendChild(el);
    initLucide();
    const kill = () => { el.classList.add('hide'); setTimeout(() => el.remove(), 220); };
    el.querySelector('.t-close').addEventListener('click', kill);
    if (duration) setTimeout(kill, duration);
    playSound(type);
  }

  // ---------------- Sound notification (WebAudio, no external files) ----------------
  let audioCtx;
  function playSound(type) {
    const settings = Storage.getSettings();
    if (!settings.soundEnabled) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const freq = { success: 880, error: 220, warning: 440, info: 660 }[type] || 660;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine'; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.28);
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.start(); osc.stop(audioCtx.currentTime + 0.28);
    } catch (e) { /* audio not available */ }
  }

  // ---------------- Modal ----------------
  function ensureModalHost() {
    let backdrop = document.querySelector('.modal-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop';
      document.body.appendChild(backdrop);
    }
    return backdrop;
  }
  function openModal({ title, bodyHtml, footHtml = '', size = '' }) {
    const backdrop = ensureModalHost();
    document.querySelectorAll('.modal').forEach(m => m.remove());
    const modal = document.createElement('div');
    modal.className = `modal ${size}`;
    modal.innerHTML = `
      <div class="modal-head"><h3>${Helpers.sanitize(title)}</h3><button class="icon-btn" id="modal-close-x">${icon('x', 16)}</button></div>
      <div class="modal-body">${bodyHtml}</div>
      ${footHtml ? `<div class="modal-foot">${footHtml}</div>` : ''}
    `;
    document.body.appendChild(modal);
    backdrop.classList.add('show');
    requestAnimationFrame(() => modal.classList.add('show'));
    const close = () => closeModal();
    modal.querySelector('#modal-close-x').addEventListener('click', close);
    backdrop.onclick = close;
    initLucide();
    initRipple();
    return modal;
  }
  function closeModal() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('show'));
    document.querySelector('.modal-backdrop')?.classList.remove('show');
    setTimeout(() => document.querySelectorAll('.modal').forEach(m => m.remove()), 220);
  }

  function confirmDialog({ title, message, confirmText = 'Konfirmasi', cancelText = 'Batal', danger = false, onConfirm }) {
    const modal = openModal({
      title, size: 'modal-sm',
      bodyHtml: `<p class="text-secondary">${Helpers.sanitize(message)}</p>`,
      footHtml: `<button class="btn btn-secondary" id="confirm-cancel">${cancelText}</button>
                 <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="confirm-ok">${confirmText}</button>`,
    });
    modal.querySelector('#confirm-cancel').addEventListener('click', closeModal);
    modal.querySelector('#confirm-ok').addEventListener('click', () => { closeModal(); onConfirm && onConfirm(); });
  }

  // ---------------- Dropdown menu ----------------
  function openMenu(anchorEl, items) {
    document.querySelectorAll('.menu').forEach(m => m.remove());
    const menu = document.createElement('div');
    menu.className = 'menu';
    menu.innerHTML = items.map(it => it.divider
      ? `<div class="menu-divider"></div>`
      : `<button class="menu-item${it.danger ? ' danger' : ''}">${icon(it.icon || 'circle', 16)}<span>${Helpers.sanitize(it.label)}${it.sub ? `<br><small class="text-muted">${Helpers.sanitize(it.sub)}</small>` : ''}</span></button>`
    ).join('');
    document.body.appendChild(menu);
    const rect = anchorEl.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 8 + window.scrollY}px`;
    let left = rect.right - menu.offsetWidth;
    if (left < 10) left = rect.left;
    menu.style.left = `${Math.max(10, left)}px`;
    requestAnimationFrame(() => menu.classList.add('show'));
    initLucide();

    const btns = menu.querySelectorAll('.menu-item');
    let bi = 0;
    items.filter(i => !i.divider).forEach((it, idx) => {
      btns[idx].addEventListener('click', () => { menu.remove(); it.action && it.action(); });
    });
    const closeOnOutside = (e) => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', closeOnOutside); } };
    setTimeout(() => document.addEventListener('click', closeOnOutside), 0);
  }

  // ---------------- Command palette (Ctrl+K) ----------------
  function buildCommands(user) {
    const cmds = [
      { group: 'Navigasi', label: 'Buka Dashboard', icon: 'layout-dashboard', action: () => location.href = 'dashboard.html' },
      { group: 'Navigasi', label: 'Buka Absensi', icon: 'clock', action: () => location.href = 'absensi.html' },
      { group: 'Navigasi', label: 'Buka Profil', icon: 'user-circle', action: () => location.href = 'profile.html' },
      { group: 'Navigasi', label: 'Buka Pengaturan', icon: 'settings', action: () => location.href = 'settings.html' },
    ];
    if (['admin', 'pembimbing'].includes(user.role)) {
      cmds.push(
        { group: 'Navigasi', label: 'Buka Data Peserta', icon: 'users', action: () => location.href = 'peserta.html' },
        { group: 'Navigasi', label: 'Buka Laporan', icon: 'bar-chart-3', action: () => location.href = 'laporan.html' },
      );
    }
    cmds.push(
      { group: 'Aksi Cepat', label: 'Ganti Tema Gelap/Terang', icon: 'moon', action: toggleTheme },
      { group: 'Aksi Cepat', label: 'Keluar Aplikasi', icon: 'log-out', action: () => confirmDialog({ title: 'Keluar?', message: 'Anda akan keluar dari sistem.', confirmText: 'Keluar', danger: true, onConfirm: () => Auth.logout() }) },
    );
    Storage.list(Storage.KEYS.participants).forEach(p => {
      cmds.push({ group: 'Peserta', label: p.name, sub: p.division, icon: 'user', action: () => location.href = `peserta.html?id=${p.id}` });
    });
    return cmds;
  }

  function openCommandPalette(user) {
    let backdrop = document.querySelector('.cmdk-backdrop');
    if (!backdrop) { backdrop = document.createElement('div'); backdrop.className = 'cmdk-backdrop'; document.body.appendChild(backdrop); }
    document.querySelectorAll('.cmdk').forEach(m => m.remove());
    const box = document.createElement('div');
    box.className = 'cmdk';
    box.innerHTML = `
      <div class="cmdk-input-wrap">${icon('search', 18)}<input type="text" placeholder="Ketik untuk mencari perintah, menu, atau peserta…" id="cmdk-input" autocomplete="off"></div>
      <div class="cmdk-list" id="cmdk-list"></div>
    `;
    document.body.appendChild(box);
    backdrop.classList.add('show');
    requestAnimationFrame(() => box.classList.add('show'));
    const input = box.querySelector('#cmdk-input');
    const listEl = box.querySelector('#cmdk-list');
    const all = buildCommands(user);
    let activeIndex = 0;

    function render(query = '') {
      const q = query.toLowerCase();
      const filtered = all.filter(c => c.label.toLowerCase().includes(q));
      if (!filtered.length) { listEl.innerHTML = `<div class="cmdk-empty">Tidak ditemukan hasil untuk "${Helpers.sanitize(query)}"</div>`; return; }
      let html = ''; let lastGroup = '';
      filtered.forEach((c, idx) => {
        if (c.group !== lastGroup) { html += `<div class="cmdk-group-label">${c.group}</div>`; lastGroup = c.group; }
        html += `<button class="cmdk-item${idx === activeIndex ? ' active' : ''}" data-idx="${idx}">${icon(c.icon || 'circle', 16)}<span>${Helpers.sanitize(c.label)}</span>${c.sub ? `<span class="text-muted" style="margin-left:auto;font-size:11px">${Helpers.sanitize(c.sub)}</span>` : ''}</button>`;
      });
      listEl.innerHTML = html;
      initLucide();
      listEl.querySelectorAll('.cmdk-item').forEach(el => el.addEventListener('click', () => { close(); filtered[+el.dataset.idx].action(); }));
    }
    render();
    input.addEventListener('input', () => { activeIndex = 0; render(input.value); });
    input.focus();

    function close() {
      box.classList.remove('show'); backdrop.classList.remove('show');
      setTimeout(() => box.remove(), 180);
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('keydown', onKey);
    backdrop.onclick = close;
  }

  function bindGlobalCommandPaletteShortcut(user) {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openCommandPalette(user);
      }
    });
  }

  // ---------------- Session warning ----------------
  function showSessionWarning(minsLeft) {
    if (document.getElementById('session-warning')) return;
    const el = document.createElement('div');
    el.id = 'session-warning';
    el.className = 'session-warning';
    el.innerHTML = `${icon('alarm-clock', 18)} <span>Sesi Anda akan berakhir dalam ${minsLeft} menit.</span>
      <button class="btn btn-sm btn-primary" id="extend-session">Perpanjang</button>`;
    document.body.appendChild(el);
    initLucide();
    document.getElementById('extend-session').addEventListener('click', () => { Auth.touchSession(); el.remove(); });
    setTimeout(() => el.remove(), 15000);
  }

  // ---------------- Reminder belum absen ----------------
  function checkReminder(user) {
    const settings = Storage.getSettings();
    if (!settings.reminderEnabled || user.role !== 'peserta' || !user.participantId) return;
    const today = Helpers.todayISO();
    const now = new Date();
    if (now.getHours() < 8) return;
    const hasCheckedIn = Storage.list(Storage.KEYS.attendance).some(a => a.participantId === user.participantId && a.date === today && a.checkIn);
    if (!hasCheckedIn && now.getDay() !== 0 && now.getDay() !== 6) {
      setTimeout(() => toast('warning', 'Belum Absen Hari Ini', 'Jangan lupa melakukan check-in di menu Absensi.'), 800);
    }
  }

  // ---------------- Weather widget (optional, offline-safe mock) ----------------
  function initWeatherWidget() {
    const settings = Storage.getSettings();
    const chip = document.getElementById('weather-chip');
    if (!chip) return;
    if (!settings.weatherWidget) { chip.classList.add('hidden'); return; }
    chip.classList.remove('hidden');
    const conditions = [['sun', '30°C Cerah'], ['cloud', '27°C Berawan'], ['cloud-rain', '25°C Hujan Ringan']];
    const pick = conditions[new Date().getDate() % conditions.length];
    chip.innerHTML = `${icon(pick[0], 14)}<span>${pick[1]}</span>`;
  }

  // ---------------- Confetti (perfect attendance celebration) ----------------
  function fireConfetti() {
    let canvas = document.getElementById('confetti-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'confetti-canvas';
      document.body.appendChild(canvas);
    }
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');
    const colors = ['#6366F1', '#8B5CF6', '#10B981', '#F59E0B', '#0EA5E9', '#F43F5E'];
    const pieces = Array.from({ length: 140 }, () => ({
      x: Math.random() * canvas.width, y: -20 - Math.random() * canvas.height * 0.4,
      w: 6 + Math.random() * 6, h: 8 + Math.random() * 8,
      color: colors[Math.floor(Math.random() * colors.length)],
      speedY: 2 + Math.random() * 3, speedX: -2 + Math.random() * 4,
      rotation: Math.random() * 360, rotationSpeed: -6 + Math.random() * 12,
    }));
    let frame = 0;
    function draw() {
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach(p => {
        p.y += p.speedY; p.x += p.speedX; p.rotation += p.rotationSpeed;
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.rotation * Math.PI / 180);
        ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (frame < 160) requestAnimationFrame(draw); else ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    draw();
  }

  // ---------------- Skeleton / Empty / Error state markup ----------------
  function skeletonCards(n = 4) {
    return Array.from({ length: n }).map(() => `<div class="skeleton sk-card"></div>`).join('');
  }
  function skeletonLines(n = 3) {
    return Array.from({ length: n }).map((_, i) => `<div class="skeleton sk-line" style="width:${90 - i * 12}%"></div>`).join('');
  }
  function emptyState({ icon: ic = 'inbox', title, message, actionLabel, onAction }) {
    const id = Helpers.uid('empty');
    setTimeout(() => { if (onAction) document.getElementById(id)?.addEventListener('click', onAction); }, 0);
    return `<div class="state-block">
      <div class="state-icon">${icon(ic, 26)}</div>
      <h4>${Helpers.sanitize(title)}</h4>
      <p>${Helpers.sanitize(message)}</p>
      ${actionLabel ? `<button class="btn btn-primary" id="${id}">${actionLabel}</button>` : ''}
    </div>`;
  }
  function errorState({ title = 'Terjadi Kesalahan', message = 'Data gagal dimuat. Silakan coba lagi.', onRetry }) {
    const id = Helpers.uid('err');
    setTimeout(() => { if (onRetry) document.getElementById(id)?.addEventListener('click', onRetry); }, 0);
    return `<div class="state-block error">
      <div class="state-icon">${icon('alert-triangle', 26)}</div>
      <h4>${Helpers.sanitize(title)}</h4>
      <p>${Helpers.sanitize(message)}</p>
      ${onRetry ? `<button class="btn btn-secondary" id="${id}">Coba Lagi</button>` : ''}
    </div>`;
  }

  return {
    NAV, ACCENTS, applyTheme, initTheme, toggleTheme, applyAccent, renderShell, icon, initLucide, initRipple,
    toast, openModal, closeModal, confirmDialog, openMenu, openCommandPalette,
    bindGlobalCommandPaletteShortcut, showSessionWarning, fireConfetti,
    skeletonCards, skeletonLines, emptyState, errorState, playSound,
  };
})();

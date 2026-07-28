/**
 * storage.js — Cloud-backed "database" using Cloud Firestore.
 *
 * Design: every collection is mirrored into an in-memory cache that is kept
 * live via Firestore's onSnapshot() real-time listeners. All the rest of the
 * app (participants.js, auth.js, attendance.js, every page's inline script…)
 * keeps calling Storage.list()/upsert()/saveList()/remove()/find() exactly
 * like before — those calls read/write the in-memory cache instantly AND
 * push the change to Firestore in the background, so absen dari banyak HP
 * berbeda sekarang benar-benar tersinkron ke semua perangkat lain.
 *
 * `session` (siapa yang sedang login di perangkat ini) tetap disimpan di
 * localStorage — itu memang harus khusus per-perangkat, bukan data bersama.
 *
 * IMPORTANT: call `await Storage.init()` once at the top of every page
 * BEFORE reading/rendering anything. Storage.init() resolves only after the
 * first snapshot of every collection has arrived, so list()/find() are safe
 * to call synchronously anywhere after that.
 */

const Storage = (() => {
  const NS = 'absensi_magang_v1';
  const KEYS = {
    users: `${NS}.users`,
    participants: `${NS}.participants`,
    attendance: `${NS}.attendance`,
    announcements: `${NS}.announcements`,
    agenda: `${NS}.agenda`,
    notes: `${NS}.notes`,
    assessments: `${NS}.assessments`,
    documents: `${NS}.documents`,
    loginHistory: `${NS}.loginHistory`,
    settings: `${NS}.settings`,
    session: `${NS}.session`,
    seeded: `${NS}.seeded`,
    widgetOrder: `${NS}.widgetOrder`,
    divisions: `${NS}.divisions`,
    passwordResetRequests: `${NS}.passwordResetRequests`,
  };

  // These stay purely local to this browser/device — never synced to Firestore.
  const LOCAL_ONLY = new Set([KEYS.session, KEYS.widgetOrder]);
  const CLOUD_KEYS = Object.values(KEYS).filter(k => !LOCAL_ONLY.has(k) && k !== KEYS.seeded);

  // ---------------- raw localStorage (for local-only keys) ----------------
  function localGet(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.error('Storage read error', key, e);
      return fallback;
    }
  }
  function localSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('Storage write error (quota?)', key, e);
      return false;
    }
  }

  // ---------------- cloud (Firestore) cache ----------------
  let db = null;
  let ready = false;
  let initPromise = null;
  const cache = {};                 // key -> array of docs
  const changeListeners = new Set();

  function notify(key) {
    changeListeners.forEach(cb => { try { cb(key); } catch (e) { console.error(e); } });
  }

  /** Subscribe to live changes coming from OTHER devices/tabs. Returns an unsubscribe fn. */
  function onChange(cb) { changeListeners.add(cb); return () => changeListeners.delete(cb); }

  function docRef(key, id) { return db.collection(key).doc(String(id)); }

  function get(key, fallback) {
    if (LOCAL_ONLY.has(key)) return localGet(key, fallback);
    if (key === KEYS.settings) return cache[key] && cache[key][0] ? cache[key][0] : fallback;
    return cache[key] !== undefined ? cache[key] : fallback;
  }

  function set(key, value) {
    if (LOCAL_ONLY.has(key)) return localSet(key, value);
    if (key === KEYS.settings) {
      const doc = { id: 'app', ...value };
      cache[key] = [doc];
      // Kembalikan Promise-nya (bukan `true` langsung) supaya caller yang butuh
      // kepastian tulisan selesai (mis. seedIfEmpty) bisa `await` ini.
      return docRef(key, 'app').set(doc).then(() => true).catch(e => { console.error('Firestore write error', key, e); return false; });
    }
    return saveList(key, Array.isArray(value) ? value : []);
  }

  // ---- Generic collection helpers (used everywhere else in the app) ----
  const list = (key) => {
    if (LOCAL_ONLY.has(key)) return localGet(key, []);
    return cache[key] ? cache[key].map(x => ({ ...x })) : [];
  };

  const upsert = (key, item) => {
    if (LOCAL_ONLY.has(key)) {
      const arr = localGet(key, []);
      const idx = arr.findIndex(x => x.id === item.id);
      if (idx >= 0) arr[idx] = item; else arr.push(item);
      localSet(key, arr);
      return item;
    }
    const arr = cache[key] ? [...cache[key]] : [];
    const idx = arr.findIndex(x => x.id === item.id);
    if (idx >= 0) arr[idx] = item; else arr.push(item);
    cache[key] = arr; // optimistic — instant local feedback, Firestore confirms async
    if (db) docRef(key, item.id).set(item).catch(e => console.error('Firestore write error', key, e));
    return item;
  };

  const saveList = (key, arr) => {
    if (LOCAL_ONLY.has(key)) { localSet(key, arr); return Promise.resolve(true); }
    const prev = cache[key] || [];
    const nextIds = new Set(arr.map(x => x.id));
    cache[key] = arr.map(x => ({ ...x })); // optimistic
    if (db) {
      // Firestore batches are capped at 500 ops — chunk defensively for large arrays.
      const ops = [
        ...arr.map(item => ({ type: 'set', item })),
        ...prev.filter(item => !nextIds.has(item.id)).map(item => ({ type: 'delete', item })),
      ];
      const chunks = [];
      for (let i = 0; i < ops.length; i += 450) chunks.push(ops.slice(i, i + 450));
      // PENTING: kembalikan Promise chain-nya (bukan `true` langsung) supaya
      // pemanggil yang butuh kepastian (mis. seedIfEmpty) bisa `await` sampai
      // benar-benar tersimpan di Firestore, bukan cuma "terkirim".
      return chunks.reduce((p, chunk) => p.then(() => {
        const batch = db.batch();
        chunk.forEach(op => op.type === 'set' ? batch.set(docRef(key, op.item.id), op.item) : batch.delete(docRef(key, op.item.id)));
        return batch.commit();
      }), Promise.resolve()).then(() => true).catch(e => { console.error('Firestore batch write error', key, e); return false; });
    }
    return Promise.resolve(true);
  };

  const remove = (key, id) => {
    if (LOCAL_ONLY.has(key)) { localSet(key, localGet(key, []).filter(x => x.id !== id)); return; }
    cache[key] = (cache[key] || []).filter(x => x.id !== id);
    if (db) docRef(key, id).delete().catch(e => console.error('Firestore delete error', key, e));
  };

  const find = (key, id) => list(key).find(x => x.id === id);

  // ---- Settings ----
  const defaultSettings = {
    theme: 'light',
    accentTheme: 'indigo',
    sessionTimeoutMinutes: 30,
    workStart: '08:00',
    lateToleranceMinutes: 15,
    workEnd: '17:00',
    soundEnabled: true,
    weatherWidget: false,
    reminderEnabled: true,
  };
  // theme/accent/sound/weather are personal-device display prefs → localStorage.
  // work hours & reminder rules are organizational → shared via Firestore.
  const LOCAL_SETTINGS_KEY = `${NS}.localSettings`;
  const getSettings = () => ({ ...defaultSettings, ...get(KEYS.settings, {}), ...localGet(LOCAL_SETTINGS_KEY, {}) });
  const saveSettings = (s) => {
    const localFields = ['theme', 'accentTheme', 'soundEnabled', 'weatherWidget'];
    const localPart = {}, cloudPart = {};
    Object.entries(s).forEach(([k, v]) => { (localFields.includes(k) ? localPart : cloudPart)[k] = v; });
    if (Object.keys(localPart).length) localSet(LOCAL_SETTINGS_KEY, { ...localGet(LOCAL_SETTINGS_KEY, {}), ...localPart });
    if (Object.keys(cloudPart).length) set(KEYS.settings, { ...(get(KEYS.settings, {})), ...cloudPart });
  };

  // ---- Session (always local — this device's login only) ----
  const getSession = () => localGet(KEYS.session, null);
  const saveSession = (s) => localSet(KEYS.session, s);
  const clearSession = () => localStorage.removeItem(KEYS.session);

  // =========================================================================
  // INIT — connect to Firestore, subscribe to every collection in real time,
  // and seed demo data exactly once (globally, across all devices).
  // =========================================================================
  function init() {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      try {
        db = firebase.firestore();
        await Promise.all(CLOUD_KEYS.map(key => new Promise((resolve) => {
          let first = true;
          db.collection(key).onSnapshot(
            (snap) => {
              cache[key] = snap.docs.map(d => d.data());
              if (first) { first = false; resolve(); } else { notify(key); }
            },
            (err) => {
              console.error('Firestore listen error on', key, err);
              if (first) { first = false; cache[key] = cache[key] || []; resolve(); }
            }
          );
        })));
        await seedIfEmpty();
        ready = true;
      } catch (e) {
        console.error('Storage.init() failed — check Firebase config & internet connection.', e);
        throw e;
      }
    })();
    return initPromise;
  }

  function isReady() { return ready; }

  // =========================================================================
  // SEED DATA — runs once (globally, guarded by a Firestore transaction so
  // two devices opening the app for the first time at the same moment can't
  // both seed and create duplicates).
  // =========================================================================
  async function seedIfEmpty() {
    const metaRef = db.collection('_meta').doc(`${NS}_seeded`);
    let alreadySeeded;
    try {
      alreadySeeded = await db.runTransaction(async (tx) => {
        const snap = await tx.get(metaRef);
        if (snap.exists) return true;
        tx.set(metaRef, { seededAt: new Date().toISOString() });
        return false;
      });
    } catch (e) {
      console.error('Seed-check transaction failed', e);
      return; // fail safe — don't risk double-seeding if we can't verify
    }
    if (alreadySeeded) return;

    const participantSeed = [
      ['Ahmad Fauzan Ramadhan', 'ahmad.fauzan@mail.com', 'Universitas Indonesia', 'Front-End Development', '2026-05-01', '2026-08-01'],
      ['Siti Nur Aisyah', 'siti.aisyah@mail.com', 'Institut Teknologi Bandung', 'UI/UX Design', '2026-05-01', '2026-08-01'],
      ['Bagus Prasetyo', 'bagus.prasetyo@mail.com', 'Universitas Gadjah Mada', 'Back-End Development', '2026-06-01', '2026-09-01'],
      ['Dewi Anggraini', 'dewi.anggraini@mail.com', 'Universitas Diponegoro', 'Digital Marketing', '2026-06-01', '2026-09-01'],
      ['Muhammad Rizky Alfarizi', 'rizky.alfarizi@mail.com', 'Politeknik Negeri Jakarta', 'Quality Assurance', '2026-04-15', '2026-07-15'],
    ];
    const participants = participantSeed.map((args, idx) => mkParticipant(idx, ...args));
    participants.forEach(p => { p.supervisorId = 'u_pembimbing'; p.supervisor = 'Yusuf Hidayat'; });
    await saveList(KEYS.participants, participants);

    const users = [
      { id: 'u_admin', username: 'admin', password: 'admin123', role: 'admin', name: 'Rina Kusuma', title: 'HR Administrator', avatar: null },
      { id: 'u_pembimbing', username: 'pembimbing', password: 'bimbing123', role: 'pembimbing', name: 'Yusuf Hidayat', title: 'Pembimbing Lapangan', avatar: null },
      { id: 'u_peserta', username: 'peserta', password: 'magang123', role: 'peserta', name: participants[0].name, title: participants[0].division, avatar: null, participantId: participants[0].id },
    ];
    await saveList(KEYS.users, users);

    await saveList(KEYS.divisions, [...new Set(participants.map(p => p.division))]);
    await saveList(KEYS.passwordResetRequests, []);

    // Generate ~30 working days of attendance history per participant
    const attendance = [];
    participants.forEach((p) => {
      let d = '2026-06-01';
      for (let i = 0; i < 40; i++) {
        const day = new Date(d + 'T00:00:00');
        d = Helpers.addDays(d, 1);
        if (day.getDay() === 0 || day.getDay() === 6) continue; // skip weekends
        if (day > new Date()) break;
        const roll = Math.random();
        let status = 'hadir', checkIn = '07:55', checkOut = '17:05';
        if (roll < 0.08) { status = 'alpha'; checkIn = null; checkOut = null; }
        else if (roll < 0.14) { status = 'izin'; checkIn = null; checkOut = null; }
        else if (roll < 0.18) { status = 'sakit'; checkIn = null; checkOut = null; }
        else if (roll < 0.32) { status = 'terlambat'; checkIn = `08:${10 + Math.floor(Math.random() * 40)}`; checkOut = '17:00'; }
        else { checkIn = `07:${45 + Math.floor(Math.random() * 14)}`.replace(/:(\d{1})$/, ':0$1'); checkOut = `17:0${Math.floor(Math.random() * 9)}`; }
        attendance.push({
          id: Helpers.uid('att'), participantId: p.id,
          date: new Date(day.getTime() - (i * 0)).toISOString().slice(0, 10),
          checkIn, checkOut, status,
          location: status === 'hadir' || status === 'terlambat' ? { lat: -3.4489 + Math.random() * 0.01, lng: 114.8323 + Math.random() * 0.01, address: 'Banjarbaru, Kalimantan Selatan' } : null,
          selfie: null, note: status === 'izin' ? 'Keperluan keluarga' : status === 'sakit' ? 'Demam' : '',
        });
      }
    });
    await saveList(KEYS.attendance, attendance);

    await saveList(KEYS.announcements, [
      { id: Helpers.uid('an'), title: 'Selamat Datang Peserta Magang Batch Juli 2026', content: 'Selamat bergabung! Silakan lengkapi profil dan absen setiap hari kerja melalui menu Absensi.', date: Helpers.todayISO(), author: 'Rina Kusuma' },
      { id: Helpers.uid('an'), title: 'Libur Nasional 17 Agustus', content: 'Kantor libur pada tanggal 17 Agustus 2026 dalam rangka HUT Kemerdekaan RI.', date: Helpers.todayISO(), author: 'Rina Kusuma' },
    ]);

    await saveList(KEYS.agenda, [
      { id: Helpers.uid('ag'), title: 'Onboarding & Pengenalan Tim', date: Helpers.addDays(Helpers.todayISO(), 1), time: '09:00', desc: 'Sesi perkenalan seluruh tim divisi.' },
      { id: Helpers.uid('ag'), title: 'Sharing Session: Git Workflow', date: Helpers.addDays(Helpers.todayISO(), 3), time: '13:00', desc: 'Pembahasan alur kerja Git & code review.' },
    ]);

    await saveList(KEYS.notes, []);
    await saveList(KEYS.assessments, [
      { id: Helpers.uid('as'), participantId: participants[0].id, supervisor: 'Yusuf Hidayat', date: Helpers.todayISO(), score: 88, note: 'Progres baik, komunikatif dan proaktif.' },
    ]);
    await saveList(KEYS.documents, []);
    await saveList(KEYS.loginHistory, []);
    await set(KEYS.settings, { id: 'app' });

    function mkParticipant(idx, name, email, institution, division, start, end) {
      return {
        id: Helpers.uid('p'),
        no: Helpers.generateParticipantId(idx),
        name, email, phone: '08' + Math.floor(100000000 + Math.random() * 899999999),
        institution, division, supervisor: 'Yusuf Hidayat',
        startDate: start, endDate: end,
        photo: Helpers.avatarDataUri(name),
        status: 'active',
        address: 'Banjarbaru, Kalimantan Selatan',
        gender: Math.random() > 0.5 ? 'L' : 'P',
      };
    }
  }

  // =========================================================================
  // Backup / Restore
  // =========================================================================
  function exportAll() {
    const data = {};
    Object.entries(KEYS).forEach(([name, key]) => { data[name] = get(key, null); });
    data._meta = { exportedAt: new Date().toISOString(), version: 2 };
    return data;
  }

  function importAll(data) {
    if (!data || typeof data !== 'object') throw new Error('Format file tidak valid');
    Object.entries(KEYS).forEach(([name, key]) => {
      if (data[name] !== undefined) set(key, data[name]);
    });
    return true;
  }

  async function resetAll() {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
    localStorage.removeItem(LOCAL_SETTINGS_KEY);
    if (!db) return;
    for (const key of CLOUD_KEYS) {
      const items = cache[key] || [];
      const chunks = [];
      for (let i = 0; i < items.length; i += 450) chunks.push(items.slice(i, i + 450));
      for (const chunk of chunks) {
        const batch = db.batch();
        chunk.forEach(item => batch.delete(docRef(key, item.id)));
        await batch.commit();
      }
    }
    await db.collection('_meta').doc(`${NS}_seeded`).delete();
  }

  return {
    KEYS, get, set, list, saveList, upsert, remove, find,
    getSettings, saveSettings, getSession, saveSession, clearSession,
    init, isReady, onChange, exportAll, importAll, resetAll,
  };
})();
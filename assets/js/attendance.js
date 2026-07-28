/**
 * attendance.js — check-in / check-out, geolocation, selfie capture (getUserMedia),
 * QR code generation/scanning, status derivation and attendance analytics.
 */

const Attendance = (() => {

  function all() { return Storage.list(Storage.KEYS.attendance); }

  function todayRecord(participantId) {
    return all().find(a => a.participantId === participantId && a.date === Helpers.todayISO()) || null;
  }

  function forParticipant(participantId) {
    return all().filter(a => a.participantId === participantId).sort((a, b) => b.date.localeCompare(a.date));
  }

  /** Determine status from check-in clock time vs configured work start + tolerance. */
  function deriveStatus(checkInTime) {
    const settings = Storage.getSettings();
    const [wh, wm] = settings.workStart.split(':').map(Number);
    const [ch, cm] = checkInTime.split(':').map(Number);
    const workMinutes = wh * 60 + wm + settings.lateToleranceMinutes;
    const checkMinutes = ch * 60 + cm;
    return checkMinutes > workMinutes ? 'terlambat' : 'hadir';
  }

  /**
   * Check-in validation: prevents duplicate check-in for the day and
   * blocks check-in outside allowed window (simple sanity guard).
   */
  function validateCheckIn(participantId) {
    const rec = todayRecord(participantId);
    if (rec && rec.checkIn) return { ok: false, message: 'Anda sudah melakukan check-in hari ini.' };
    return { ok: true };
  }

  function validateCheckOut(participantId) {
    const rec = todayRecord(participantId);
    if (!rec || !rec.checkIn) return { ok: false, message: 'Anda belum melakukan check-in hari ini.' };
    if (rec.checkOut) return { ok: false, message: 'Anda sudah melakukan check-out hari ini.' };
    return { ok: true };
  }

  function checkIn(participantId, { location = null, selfie = null } = {}) {
    const validation = validateCheckIn(participantId);
    if (!validation.ok) return validation;

    const time = Helpers.nowTime().slice(0, 5);
    const status = deriveStatus(time);
    const list = all();
    let rec = list.find(a => a.participantId === participantId && a.date === Helpers.todayISO());
    if (!rec) {
      rec = { id: Helpers.uid('att'), participantId, date: Helpers.todayISO(), checkIn: null, checkOut: null, status: 'hadir', location: null, selfie: null, note: '' };
    }
    rec.checkIn = time; rec.status = status; rec.location = location; rec.selfie = selfie;
    Storage.upsert(Storage.KEYS.attendance, rec);
    return { ok: true, record: rec };
  }

  function checkOut(participantId, { location = null } = {}) {
    const validation = validateCheckOut(participantId);
    if (!validation.ok) return validation;
    const rec = todayRecord(participantId);
    rec.checkOut = Helpers.nowTime().slice(0, 5);
    rec.checkOutLocation = location;
    Storage.upsert(Storage.KEYS.attendance, rec);
    return { ok: true, record: rec };
  }

  /** Manual entry for Izin/Sakit/Alpha (self-service or admin-entered). */
  function submitLeave(participantId, status, note, date = Helpers.todayISO()) {
    const list = all();
    let rec = list.find(a => a.participantId === participantId && a.date === date);
    if (!rec) rec = { id: Helpers.uid('att'), participantId, date, checkIn: null, checkOut: null, location: null, selfie: null };
    rec.status = status; rec.note = Helpers.cleanInput(note);
    Storage.upsert(Storage.KEYS.attendance, rec);
    return rec;
  }

  function update(id, data) {
    const rec = Storage.find(Storage.KEYS.attendance, id);
    if (!rec) return null;
    Object.assign(rec, data);
    Storage.upsert(Storage.KEYS.attendance, rec);
    return rec;
  }

  function remove(id) { Storage.remove(Storage.KEYS.attendance, id); }

  // ---------------- Geolocation ----------------
  function getLocation() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, address: `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}` }),
        () => resolve(null),
        { timeout: 8000, enableHighAccuracy: true }
      );
    });
  }

  // ---------------- Selfie capture (getUserMedia) ----------------
  let mediaStream = null;
  async function startCamera(videoEl) {
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      videoEl.srcObject = mediaStream;
      await videoEl.play();
      return true;
    } catch (e) {
      return false;
    }
  }
  function stopCamera() {
    if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null; }
  }
  function captureFrame(videoEl, canvasEl) {
    canvasEl.width = videoEl.videoWidth || 320;
    canvasEl.height = videoEl.videoHeight || 240;
    const ctx = canvasEl.getContext('2d');
    ctx.translate(canvasEl.width, 0); ctx.scale(-1, 1); // mirror for selfie feel
    ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
    return canvasEl.toDataURL('image/jpeg', 0.7);
  }

  // ---------------- Analytics helpers ----------------
  function heatmapData(participantId, weeks = 18) {
    const records = forParticipant(participantId);
    const map = {};
    records.forEach(r => { map[r.date] = r.status; });
    const days = [];
    const today = new Date();
    for (let i = weeks * 7; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const iso = `${d.getFullYear()}-${Helpers.pad2(d.getMonth() + 1)}-${Helpers.pad2(d.getDate())}`;
      days.push({ date: iso, status: map[iso] || null });
    }
    return days;
  }

  function mostCommonCheckInHour(participantId) {
    const records = forParticipant(participantId).filter(r => r.checkIn);
    if (!records.length) return null;
    const counts = {};
    records.forEach(r => { const h = r.checkIn.split(':')[0]; counts[h] = (counts[h] || 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return top ? `${top[0]}:00` : null;
  }

  function mostDisciplinedDay(participantId) {
    const records = forParticipant(participantId).filter(r => r.status === 'hadir');
    if (!records.length) return null;
    const dowNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', "Jumat", 'Sabtu'];
    const counts = {};
    records.forEach(r => { const d = new Date(r.date + 'T00:00:00').getDay(); counts[d] = (counts[d] || 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return top ? dowNames[+top[0]] : null;
  }

  function currentStreak(participantId) {
    const records = forParticipant(participantId); // desc by date
    let streak = 0;
    for (const r of records) {
      if (r.status === 'hadir' || r.status === 'terlambat') streak++;
      else break;
    }
    return streak;
  }

  function isPerfectAttendance(participantId, from, to) {
    const s = Participants.attendanceSummary(participantId, from, to);
    return s.total > 0 && s.terlambat === 0 && s.izin === 0 && s.sakit === 0 && s.alpha === 0;
  }

  // ---------------- QR Code ----------------
  /** Renders a QR code (participant check-in token) into the given container element. */
  function renderQR(containerEl, participantId) {
    containerEl.innerHTML = '';
    const payload = JSON.stringify({ t: 'absensi-magang', pid: participantId, ts: Date.now() });
    if (window.QRCode) {
      new QRCode(containerEl, { text: payload, width: 220, height: 220, colorDark: '#12141C', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
    } else {
      containerEl.innerHTML = `<div class="state-block"><p>Library QR tidak tersedia (butuh koneksi internet).</p></div>`;
    }
  }

  /** Scan QR from an image data URL (captured video frame) using jsQR. */
  function decodeQRFromCanvas(canvasEl) {
    if (!window.jsQR) return null;
    const ctx = canvasEl.getContext('2d');
    const imgData = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
    const result = jsQR(imgData.data, imgData.width, imgData.height);
    return result ? result.data : null;
  }

  return {
    all, todayRecord, forParticipant, deriveStatus, validateCheckIn, validateCheckOut,
    checkIn, checkOut, submitLeave, update, remove,
    getLocation, startCamera, stopCamera, captureFrame,
    heatmapData, mostCommonCheckInHour, mostDisciplinedDay, currentStreak, isPerfectAttendance,
    renderQR, decodeQRFromCanvas,
  };
})();

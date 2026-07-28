/**
 * participants.js — CRUD & derived stats for peserta magang.
 */

const Participants = (() => {

  function all() { return Storage.list(Storage.KEYS.participants); }
  function getById(id) { return Storage.find(Storage.KEYS.participants, id); }

  function create(data) {
    const list = all();
    const participant = {
      id: Helpers.uid('p'),
      no: Helpers.generateParticipantId(list.length),
      name: Helpers.cleanInput(data.name),
      email: Helpers.cleanInput(data.email),
      phone: Helpers.cleanInput(data.phone),
      institution: Helpers.cleanInput(data.institution),
      division: Helpers.cleanInput(data.division),
      supervisorId: data.supervisorId || null,
      supervisor: Helpers.cleanInput(data.supervisor || ''),
      startDate: data.startDate,
      endDate: data.endDate,
      address: Helpers.cleanInput(data.address),
      gender: data.gender || 'L',
      status: 'active',
      photo: data.photo || Helpers.avatarDataUri(data.name || 'Peserta'),
    };
    Storage.upsert(Storage.KEYS.participants, participant);
    return participant;
  }

  function update(id, data) {
    const p = getById(id);
    if (!p) return null;
    const updated = { ...p, ...data,
      name: Helpers.cleanInput(data.name ?? p.name),
      email: Helpers.cleanInput(data.email ?? p.email),
      phone: Helpers.cleanInput(data.phone ?? p.phone),
      institution: Helpers.cleanInput(data.institution ?? p.institution),
      division: Helpers.cleanInput(data.division ?? p.division),
      address: Helpers.cleanInput(data.address ?? p.address),
      supervisorId: data.supervisorId !== undefined ? data.supervisorId : p.supervisorId,
      supervisor: Helpers.cleanInput(data.supervisor !== undefined ? data.supervisor : p.supervisor),
    };
    Storage.upsert(Storage.KEYS.participants, updated);
    return updated;
  }

  function remove(id) {
    Storage.remove(Storage.KEYS.participants, id);
    // Cascade: remove attendance, notes, assessments, documents & the linked login account
    Storage.saveList(Storage.KEYS.attendance, Storage.list(Storage.KEYS.attendance).filter(a => a.participantId !== id));
    Storage.saveList(Storage.KEYS.notes, Storage.list(Storage.KEYS.notes).filter(n => n.participantId !== id));
    Storage.saveList(Storage.KEYS.assessments, Storage.list(Storage.KEYS.assessments).filter(a => a.participantId !== id));
    Storage.saveList(Storage.KEYS.documents, Storage.list(Storage.KEYS.documents).filter(d => d.participantId !== id));
    Storage.saveList(Storage.KEYS.users, Storage.list(Storage.KEYS.users).filter(u => u.participantId !== id));
  }

  /** Internship progress percentage 0-100 based on start/end date vs today. */
  function progress(p) {
    const today = Helpers.todayISO();
    const total = Helpers.daysBetween(p.startDate, p.endDate);
    if (total <= 0) return 100;
    const elapsed = Helpers.clamp(Helpers.daysBetween(p.startDate, today), 0, total);
    return Math.round((elapsed / total) * 100);
  }

  function daysRemaining(p) {
    return Math.max(0, Helpers.daysBetween(Helpers.todayISO(), p.endDate));
  }

  /** Attendance summary counts for a participant, optionally within a date range. */
  function attendanceSummary(participantId, from = null, to = null) {
    let records = Storage.list(Storage.KEYS.attendance).filter(a => a.participantId === participantId);
    if (from) records = records.filter(a => a.date >= from);
    if (to) records = records.filter(a => a.date <= to);
    const summary = { hadir: 0, terlambat: 0, izin: 0, sakit: 0, alpha: 0, total: records.length };
    records.forEach(r => { summary[r.status] = (summary[r.status] || 0) + 1; });
    summary.attendanceRate = summary.total ? Math.round(((summary.hadir + summary.terlambat) / summary.total) * 100) : 0;
    return summary;
  }

  /** Rank participants by attendance rate & discipline (used for Ranking/Leaderboard). */
  function leaderboard() {
    return all().map(p => {
      const s = attendanceSummary(p.id);
      const score = s.total ? Math.round(((s.hadir * 1 + s.terlambat * 0.5) / s.total) * 100) : 0;
      return { participant: p, score, summary: s };
    }).sort((a, b) => b.score - a.score);
  }

  function search(query, list = all()) {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(p => [p.name, p.email, p.division, p.institution, p.no].join(' ').toLowerCase().includes(q));
  }

  return { all, getById, create, update, remove, progress, daysRemaining, attendanceSummary, leaderboard, search };
})();

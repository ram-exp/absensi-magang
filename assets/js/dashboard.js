/**
 * dashboard.js — aggregates data for the dashboard page: stat cards,
 * recent activity feed, badges/achievements, attendance calendar cells.
 */

const Dashboard = (() => {

  function globalStats() {
    const participants = Participants.all();
    const today = Helpers.todayISO();
    const todays = Storage.list(Storage.KEYS.attendance).filter(a => a.date === today);
    return {
      totalParticipants: participants.length,
      activeParticipants: participants.filter(p => p.status === 'active').length,
      hadirToday: todays.filter(a => a.status === 'hadir' || a.status === 'terlambat').length,
      terlambatToday: todays.filter(a => a.status === 'terlambat').length,
      izinSakitToday: todays.filter(a => a.status === 'izin' || a.status === 'sakit').length,
      belumAbsenToday: participants.length - todays.length,
    };
  }

  function recentActivity(limit = 8) {
    const attendance = Storage.list(Storage.KEYS.attendance)
      .filter(a => a.checkIn)
      .sort((a, b) => (b.date + b.checkIn).localeCompare(a.date + a.checkIn))
      .slice(0, limit);
    return attendance.map(a => {
      const p = Participants.getById(a.participantId);
      return { ...a, participantName: p ? p.name : 'Peserta', participantPhoto: p ? p.photo : null };
    });
  }

  const BADGE_DEFS = [
    { id: 'perfect_week', name: '7 Hari Sempurna', icon: 'award', test: (s) => s.total >= 5 && s.hadir === s.total },
    { id: 'streak_10', name: 'Streak 10 Hari', icon: 'flame', test: (s, streak) => streak >= 10 },
    { id: 'early_bird', name: 'Tepat Waktu', icon: 'sunrise', test: (s) => s.total > 0 && s.terlambat === 0 },
    { id: 'century', name: '100 Hari Hadir', icon: 'trophy', test: (s) => s.hadir >= 100 },
    { id: 'consistent', name: 'Kehadiran 90%+', icon: 'target', test: (s) => s.total >= 10 && s.attendanceRate >= 90 },
    { id: 'no_absence', name: 'Nol Alpha', icon: 'shield-check', test: (s) => s.total > 0 && s.alpha === 0 },
  ];

  function badgesFor(participantId) {
    const s = Participants.attendanceSummary(participantId);
    const streak = Attendance.currentStreak(participantId);
    return BADGE_DEFS.map(b => ({ ...b, unlocked: b.test(s, streak) }));
  }

  /** Cells for the current month calendar with status color for a participant. */
  function calendarCells(participantId, year, month) {
    const records = {};
    Attendance.forParticipant(participantId).forEach(r => { records[r.date] = r.status; });
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startOffset; i++) cells.push({ empty: true });
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${Helpers.pad2(month + 1)}-${Helpers.pad2(d)}`;
      cells.push({ day: d, date: iso, status: records[iso] || null, isToday: iso === Helpers.todayISO() });
    }
    return cells;
  }

  // ---------------- Widget order (drag & drop persistence) ----------------
  function getWidgetOrder(defaultOrder) {
    const saved = Storage.get(Storage.KEYS.widgetOrder, null);
    if (!saved) return defaultOrder;
    // keep only widgets that still exist, append any new ones
    const valid = saved.filter(id => defaultOrder.includes(id));
    defaultOrder.forEach(id => { if (!valid.includes(id)) valid.push(id); });
    return valid;
  }
  function saveWidgetOrder(order) { Storage.set(Storage.KEYS.widgetOrder, order); }

  return { globalStats, recentActivity, badgesFor, calendarCells, getWidgetOrder, saveWidgetOrder, BADGE_DEFS };
})();

/**
 * admin.js — CRUD helpers for admin-managed reference data:
 * Bidang (divisions) and Pembimbing (supervisor accounts).
 */

const AdminData = (() => {

  // ---------------- Bidang (Divisions) ----------------
  function allDivisions() { return Storage.list(Storage.KEYS.divisions); }

  function addDivision(name) {
    name = Helpers.cleanInput(name);
    if (!name) return { ok: false, message: 'Nama bidang tidak boleh kosong.' };
    const list = allDivisions();
    if (list.some(d => d.toLowerCase() === name.toLowerCase())) return { ok: false, message: 'Bidang tersebut sudah ada.' };
    list.push(name);
    Storage.saveList(Storage.KEYS.divisions, list);
    return { ok: true };
  }

  function renameDivision(oldName, newName) {
    newName = Helpers.cleanInput(newName);
    if (!newName) return { ok: false, message: 'Nama bidang tidak boleh kosong.' };
    const current = allDivisions();
    if (newName.toLowerCase() !== oldName.toLowerCase() && current.some(d => d.toLowerCase() === newName.toLowerCase())) {
      return { ok: false, message: 'Sudah ada bidang lain dengan nama tersebut.' };
    }
    const list = current.map(d => d === oldName ? newName : d);
    Storage.saveList(Storage.KEYS.divisions, list);
    // keep participants pointing at the renamed bidang in sync
    const participants = Storage.list(Storage.KEYS.participants);
    participants.forEach(p => { if (p.division === oldName) p.division = newName; });
    Storage.saveList(Storage.KEYS.participants, participants);
    return { ok: true };
  }

  function removeDivision(name) {
    const inUse = Storage.list(Storage.KEYS.participants).some(p => p.division === name);
    if (inUse) return { ok: false, message: 'Bidang ini masih digunakan oleh salah satu peserta magang.' };
    Storage.saveList(Storage.KEYS.divisions, allDivisions().filter(d => d !== name));
    return { ok: true };
  }

  // ---------------- Pembimbing ----------------
  function allSupervisors() { return Storage.list(Storage.KEYS.users).filter(u => u.role === 'pembimbing'); }

  function addSupervisor({ name, username, password, title }) {
    name = Helpers.cleanInput(name); username = Helpers.cleanInput(username);
    if (!name || !username || !password) return { ok: false, message: 'Nama, username, dan password wajib diisi.' };
    if (Auth.usernameTaken(username)) return { ok: false, message: 'Username sudah digunakan.' };
    const users = Storage.list(Storage.KEYS.users);
    const user = { id: Helpers.uid('u'), username, password, role: 'pembimbing', name, title: Helpers.cleanInput(title || 'Pembimbing Lapangan'), avatar: null };
    users.push(user);
    Storage.saveList(Storage.KEYS.users, users);
    return { ok: true, user };
  }

  function updateSupervisor(id, data) {
    const users = Storage.list(Storage.KEYS.users);
    const u = users.find(x => x.id === id);
    if (!u) return { ok: false, message: 'Pembimbing tidak ditemukan.' };
    if (data.name) u.name = Helpers.cleanInput(data.name);
    if (data.title !== undefined) u.title = Helpers.cleanInput(data.title);
    if (data.username) {
      const uname = Helpers.cleanInput(data.username);
      if (Auth.usernameTaken(uname, id)) return { ok: false, message: 'Username sudah digunakan.' };
      u.username = uname;
    }
    if (data.password) u.password = data.password;
    Storage.saveList(Storage.KEYS.users, users);
    // keep participant-facing supervisor name in sync
    const participants = Storage.list(Storage.KEYS.participants);
    participants.forEach(p => { if (p.supervisorId === id) p.supervisor = u.name; });
    Storage.saveList(Storage.KEYS.participants, participants);
    return { ok: true };
  }

  function removeSupervisor(id) {
    const participants = Storage.list(Storage.KEYS.participants);
    let inUse = false;
    participants.forEach(p => { if (p.supervisorId === id) { inUse = true; p.supervisorId = null; } });
    Storage.saveList(Storage.KEYS.participants, participants);
    Storage.saveList(Storage.KEYS.users, Storage.list(Storage.KEYS.users).filter(u => u.id !== id));
    return { ok: true, hadAssignedParticipants: inUse };
  }

  return {
    allDivisions, addDivision, renameDivision, removeDivision,
    allSupervisors, addSupervisor, updateSupervisor, removeSupervisor,
  };
})();

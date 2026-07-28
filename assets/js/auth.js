/**
 * auth.js — dummy authentication against the users collection in Storage.
 * No real security (this is a static demo) but includes session expiry,
 * login history logging, and role-based page guarding.
 */

const Auth = (() => {

  function login(username, password, role) {
    const users = Storage.list(Storage.KEYS.users);
    const user = users.find(u =>
      u.username.toLowerCase() === String(username).toLowerCase() &&
      u.password === password &&
      u.role === role
    );
    if (!user) return { ok: false, message: 'Username, password, atau role tidak sesuai.' };

    const settings = Storage.getSettings();
    const now = Date.now();
    const session = {
      userId: user.id,
      loginTime: now,
      expiresAt: now + settings.sessionTimeoutMinutes * 60 * 1000,
      lastActivity: now,
    };
    Storage.saveSession(session);

    // Log login history
    const history = Storage.list(Storage.KEYS.loginHistory);
    history.unshift({
      id: Helpers.uid('lh'), userId: user.id, username: user.username,
      timestamp: now, device: navigator.userAgent.slice(0, 80), role: user.role,
    });
    Storage.saveList(Storage.KEYS.loginHistory, history.slice(0, 50));

    return { ok: true, user };
  }

  function logout(redirect = true) {
    Storage.clearSession();
    if (redirect) window.location.href = 'login.html';
  }

  function currentUser() {
    const session = Storage.getSession();
    if (!session) return null;
    if (Date.now() > session.expiresAt) { Storage.clearSession(); return null; }
    return Storage.find(Storage.KEYS.users, session.userId) || null;
  }

  function touchSession() {
    const session = Storage.getSession();
    if (!session) return;
    const settings = Storage.getSettings();
    session.lastActivity = Date.now();
    session.expiresAt = Date.now() + settings.sessionTimeoutMinutes * 60 * 1000;
    Storage.saveSession(session);
  }

  function minutesUntilExpiry() {
    const session = Storage.getSession();
    if (!session) return 0;
    return Math.max(0, Math.round((session.expiresAt - Date.now()) / 60000));
  }

  // ---------------- Passwords & accounts ----------------
  function usernameTaken(username, excludeUserId = null) {
    return Storage.list(Storage.KEYS.users).some(u =>
      u.username.toLowerCase() === String(username).toLowerCase() && u.id !== excludeUserId);
  }

  /** Self-service password change: requires the current password. */
  function changePassword(userId, oldPassword, newPassword) {
    const users = Storage.list(Storage.KEYS.users);
    const u = users.find(x => x.id === userId);
    if (!u) return { ok: false, message: 'Pengguna tidak ditemukan.' };
    if (u.password !== oldPassword) return { ok: false, message: 'Password lama tidak sesuai.' };
    if (!newPassword || newPassword.length < 4) return { ok: false, message: 'Password baru minimal 4 karakter.' };
    u.password = newPassword;
    Storage.saveList(Storage.KEYS.users, users);
    return { ok: true };
  }

  /** Peserta yang lupa password mengirim permintaan; masuk sebagai notifikasi ke admin. */
  function requestPasswordReset(username) {
    const users = Storage.list(Storage.KEYS.users);
    const u = users.find(x => x.username.toLowerCase() === String(username).toLowerCase());
    if (!u) return { ok: false, message: 'Username tidak ditemukan.' };
    const requests = Storage.list(Storage.KEYS.passwordResetRequests);
    if (requests.some(r => r.userId === u.id && r.status === 'pending')) {
      return { ok: false, message: 'Anda sudah memiliki permintaan reset password yang masih menunggu diproses admin.' };
    }
    requests.unshift({ id: Helpers.uid('rst'), userId: u.id, username: u.username, name: u.name, role: u.role, timestamp: Date.now(), status: 'pending' });
    Storage.saveList(Storage.KEYS.passwordResetRequests, requests);
    return { ok: true };
  }

  function pendingPasswordRequests() {
    return Storage.list(Storage.KEYS.passwordResetRequests).filter(r => r.status === 'pending');
  }

  /** Admin resolves a pending request by setting a new password for that user. */
  function resolvePasswordReset(requestId, newPassword) {
    const requests = Storage.list(Storage.KEYS.passwordResetRequests);
    const req = requests.find(r => r.id === requestId);
    if (!req) return { ok: false, message: 'Permintaan tidak ditemukan.' };
    const result = adminSetPassword(req.userId, newPassword);
    if (!result.ok) return result;
    req.status = 'resolved';
    Storage.saveList(Storage.KEYS.passwordResetRequests, requests);
    return { ok: true };
  }

  function dismissPasswordRequest(requestId) {
    const requests = Storage.list(Storage.KEYS.passwordResetRequests).filter(r => r.id !== requestId);
    Storage.saveList(Storage.KEYS.passwordResetRequests, requests);
  }

  /** Admin/pembimbing setting any user's password directly (no old password needed). */
  function adminSetPassword(userId, newPassword) {
    if (!newPassword || newPassword.length < 4) return { ok: false, message: 'Password baru minimal 4 karakter.' };
    const users = Storage.list(Storage.KEYS.users);
    const u = users.find(x => x.id === userId);
    if (!u) return { ok: false, message: 'Pengguna tidak ditemukan.' };
    u.password = newPassword;
    Storage.saveList(Storage.KEYS.users, users);
    return { ok: true };
  }

  function getUserByParticipantId(participantId) {
    return Storage.list(Storage.KEYS.users).find(u => u.participantId === participantId) || null;
  }

  /** Create the login account tied to a newly-added participant. */
  function createParticipantUser(participant, username, password) {
    const users = Storage.list(Storage.KEYS.users);
    const user = {
      id: Helpers.uid('u'), username: Helpers.cleanInput(username), password,
      role: 'peserta', name: participant.name, title: participant.division, avatar: null,
      participantId: participant.id,
    };
    users.push(user);
    Storage.saveList(Storage.KEYS.users, users);
    return user;
  }

  /** Keep the linked account's display name/title/credentials in sync when a participant is edited. */
  function syncParticipantUser(participantId, { username, password, name, title } = {}) {
    const users = Storage.list(Storage.KEYS.users);
    const u = users.find(x => x.participantId === participantId);
    if (!u) return null;
    if (username) u.username = Helpers.cleanInput(username);
    if (password) u.password = password;
    if (name) u.name = name;
    if (title !== undefined) u.title = title;
    Storage.saveList(Storage.KEYS.users, users);
    return u;
  }

  /** Call at top of every protected page. Redirects to login if not authenticated. */
  function guard(allowedRoles = null) {
    const user = currentUser();
    if (!user) {
      window.location.href = 'login.html';
      return null;
    }
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      window.location.href = 'dashboard.html';
      return null;
    }
    return user;
  }

  /** Activity listeners that keep the session alive + auto-logout timer/warning. */
  function initSessionWatcher() {
    ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'].forEach(evt => {
      window.addEventListener(evt, Helpers.debounce(touchSession, 5000), { passive: true });
    });

    setInterval(() => {
      const session = Storage.getSession();
      if (!session) return;
      const minsLeft = minutesUntilExpiry();
      if (minsLeft <= 0) {
        UI.toast('warning', 'Sesi Berakhir', 'Sesi Anda telah berakhir, silakan login kembali.');
        setTimeout(() => logout(), 1200);
      } else if (minsLeft <= 2) {
        UI.showSessionWarning(minsLeft);
      }
    }, 20000);
  }

  return {
    login, logout, currentUser, touchSession, minutesUntilExpiry, guard, initSessionWatcher,
    usernameTaken, changePassword, requestPasswordReset, pendingPasswordRequests,
    resolvePasswordReset, dismissPasswordRequest, adminSetPassword,
    getUserByParticipantId, createParticipantUser, syncParticipantUser,
  };
})();

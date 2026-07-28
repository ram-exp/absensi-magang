/**
 * settings.js — thin controller layer for the Pengaturan (Settings) page.
 * Reads/writes via Storage.getSettings/saveSettings and handles backup/restore.
 */

const Settings = (() => {

  function save(partial) {
    Storage.saveSettings(partial);
    return Storage.getSettings();
  }

  function exportBackup() {
    const data = Storage.exportAll();
    const filename = `absensi-magang-backup-${Helpers.todayISO()}.json`;
    Helpers.downloadFile(filename, JSON.stringify(data, null, 2), 'application/json');
    return filename;
  }

  function restoreBackup(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          Storage.importAll(data);
          resolve(data);
        } catch (e) { reject(e); }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  function factoryReset() {
    Storage.resetAll();
  }

  return { save, exportBackup, restoreBackup, factoryReset };
})();

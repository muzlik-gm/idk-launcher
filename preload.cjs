const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getPathForFile: (file) => webUtils ? webUtils.getPathForFile(file) : file.path,
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),

  launchMinecraft: (username, version, javaPath, loader, autoOptimization, maxMemory, authData, quickConnect, windowSize, globalJavaArgs, forceUpdate) =>
    ipcRenderer.send('launch-minecraft', { username, version, javaPath, loader, autoOptimization, maxMemory, authData, quickConnect, windowSize, globalJavaArgs, forceUpdate }),
  cancelLaunch: () => ipcRenderer.send('cancel-launch'),

  // All IPC listeners — registered once at startup
  onLaunchProgress:  (cb) => ipcRenderer.on('launch-progress',  (_e, data)  => cb(data)),
  onGameLaunched:    (cb) => ipcRenderer.on('game-launched',    ()          => cb()),
  onLaunchClosed:    (cb) => ipcRenderer.on('launch-closed',    (_e, data)  => cb(data)),
  onLaunchError:     (cb) => ipcRenderer.on('launch-error',     (_e, error) => cb(error)),
  onLaunchWarning:   (cb) => ipcRenderer.on('launch-warning',   (_e, msg)   => cb(msg)),
  onClearJavaPath:   (cb) => ipcRenderer.on('clear-java-path',  ()          => cb()),
  onWindowStateChanged: (cb) => ipcRenderer.on('window-state-changed', (_e, data) => cb(data)),
  onEnterGameRunningMode: (cb) => ipcRenderer.on('enter-game-running-mode', () => cb()),

  // Overlay IPC
  onOverlayInit:     (cb) => ipcRenderer.on('overlay-init',     (_e, data)  => cb(data)),
  onToggleOverlay:   (cb) => ipcRenderer.on('toggle-overlay-ui',(_e, state) => cb(state)),
  resumeGame:        ()   => ipcRenderer.send('resume-game'),

  openMinecraftFolder: () => ipcRenderer.send('open-minecraft-folder'),
  selectMinecraftFolder: () => ipcRenderer.invoke('select-minecraft-folder'),
  openExternal: (url) => ipcRenderer.send('open-external', url),
  getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),
  getVersionsPath: () => ipcRenderer.invoke('get-versions-path'),
  scanDownloadedVersions: () => ipcRenderer.invoke('scan-downloaded-versions'),
  scanVersionMods: (version) => ipcRenderer.invoke('scan-version-mods', version),
  scanProfileAchievements: (data) => ipcRenderer.invoke('scan-profile-achievements', data),
  scanAllAchievements: () => ipcRenderer.invoke('scan-all-achievements'),
  downloadVersion: (data) => ipcRenderer.invoke('download-version', data),
  elybyAuthenticate: (data) => ipcRenderer.invoke('elyby-authenticate', data),
  elybyOAuthLogin: () => ipcRenderer.invoke('elyby-oauth-login'),
  microsoftAuthenticate: () => ipcRenderer.invoke('microsoft-authenticate'),
  getMicrosoftAuthData: () => ipcRenderer.invoke('get-microsoft-auth-data'),
  fetchElybyProfile: (username) => ipcRenderer.invoke('fetch-elyby-profile', username),
  getElybyAuthData: () => ipcRenderer.invoke('get-elyby-auth-data'),
  fetchImageBase64: (url) => ipcRenderer.invoke('fetch-image-base64', url),
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  downloadUpdate:   () => ipcRenderer.invoke('update:download'),
  installUpdate:    () => ipcRenderer.invoke('update:install'),
  onUpdateAvailable:  (cb) => ipcRenderer.on('update-available',  (_e, data) => cb(data)),
  onUpdateProgress:   (cb) => ipcRenderer.on('update-progress',   (_e, data) => cb(data)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update-downloaded', (_e, data) => cb(data)),
  onUpdateError:      (cb) => ipcRenderer.on('update-error',      (_e, data) => cb(data)),

  // Mod / resourcepack / shader management
  installMod:          (data) => ipcRenderer.invoke('install-mod',         data),
  installModToVersion: (data) => ipcRenderer.invoke('install-mod-to-version', data),
  importExternalFiles: (data) => ipcRenderer.invoke('import-external-files', data),
  unzipCurseforge:     (data) => ipcRenderer.invoke('unzip-curseforge',    data),
  selectModpackZip:    () => ipcRenderer.invoke('select-modpack-zip'),
  selectImage:         () => ipcRenderer.invoke('select-image'),
  selectExportZip:     (data) => ipcRenderer.invoke('select-export-zip',   data),
  exportModpack:       (data) => ipcRenderer.invoke('export-modpack',      data),
  downloadCurseforgeModpack: (data) => ipcRenderer.invoke('download-curseforge-modpack', data),
  downloadModrinthModpack:   (data) => ipcRenderer.invoke('download-modrinth-modpack',   data),
  removeMod:           (data) => ipcRenderer.invoke('remove-mod',          data),
  installResourcepack: (data) => ipcRenderer.invoke('install-resourcepack', data),
  removeResourcepack:  (data) => ipcRenderer.invoke('remove-resourcepack',  data),
  installShader:       (data) => ipcRenderer.invoke('install-shader',       data),
  removeShader:        (data) => ipcRenderer.invoke('remove-shader',        data),

  launchModpack: (args) => ipcRenderer.send('launch-modpack', args),
  toggleDevTools: () => ipcRenderer.send('toggle-devtools'),
  scanProfiles: () => ipcRenderer.invoke('scan-profiles'),

  // Overlay System IPC Bridge
  setIdkConnectData: (data) => ipcRenderer.send('set-idk-connect-data', data),
  getOverlayData: () => ipcRenderer.invoke('get-overlay-data'),
  closeOverlay: () => ipcRenderer.send('close-overlay'),
  onOverlayToggle: (cb) => ipcRenderer.on('overlay-toggle', (_e, data) => cb(data)),
  onOverlaySyncConnect: (cb) => ipcRenderer.on('overlay-sync-connect', (_e, data) => cb(data)),
  onShowStartupNotification: (cb) => ipcRenderer.on('show-startup-notification', (_e, data) => cb(data)),
  hideOverlayWindow: () => ipcRenderer.send('hide-overlay-window'),

  onDownloadProgress: (cb) => {
    const handler = (_e, downloadId, progress) => cb({ downloadId, ...(progress || {}) });
    ipcRenderer.on('download-progress', handler);
    return () => { ipcRenderer.removeListener('download-progress', handler); };
  },

  // FRPC Multiplayer Tunneling
  ensureFrpc: () => ipcRenderer.invoke('ensure-frpc'),
  startFrpcTunnel: (port) => ipcRenderer.invoke('start-frpc-tunnel', { port }),
  stopFrpcTunnel: () => ipcRenderer.invoke('stop-frpc-tunnel'),
  onFrpcInstallProgress: (cb) => ipcRenderer.on('frpc-install-progress', (_e, data) => cb(data)),
  onFrpcTunnelClosed: (cb) => ipcRenderer.on('frpc-tunnel-closed', () => cb()),

  // Missing mod dependencies (crash report auto-detection)
  onMissingDependencies: (cb) => ipcRenderer.on('missing-dependencies', (_e, data) => cb(data)),
  autoInstallDependencies: (data) => ipcRenderer.invoke('auto-install-dependencies', data),

  // Extract icon from mod/RP/shader JAR file
  extractModIcon: (data) => ipcRenderer.invoke('extract-mod-icon', data),
  
  // Batch extract all icons for a modpack (for legacy profiles)
  extractAllIcons: (data) => ipcRenderer.invoke('extract-all-icons', data),

  // Delete modpack folder from disk
  deleteModpackFolder: (modpackId) => ipcRenderer.invoke('delete-modpack-folder', { modpackId }),

  // Update modpack profile.json on disk (sync user settings to disk)
  updateModpackProfile: (data) => ipcRenderer.invoke('update-modpack-profile', data),

  // Debug: forward renderer logs to terminal
  rendererLog: (msg) => ipcRenderer.send('renderer-log', msg),

  // Download progress tracking
  startDownload: (downloadId, items, downloadPath) => 
    ipcRenderer.invoke('start-download', { downloadId, items, downloadPath }),
  pauseDownload: (downloadId) => 
    ipcRenderer.invoke('pause-download', downloadId),
  resumeDownload: (downloadId) => 
    ipcRenderer.invoke('resume-download', downloadId),
  cancelDownload: (downloadId) => 
    ipcRenderer.invoke('cancel-download', downloadId),
  
  // Download progress event listeners
  onDownloadComplete: (cb) => 
    ipcRenderer.on('download-complete', (_e, downloadId, result) => cb(downloadId, result)),
  onDownloadError: (cb) => 
    ipcRenderer.on('download-error', (_e, downloadId, error) => cb(downloadId, error)),
  onDownloadPaused: (cb) => 
    ipcRenderer.on('download-paused', (_e, downloadId) => cb(downloadId)),
  onDownloadResumed: (cb) => 
    ipcRenderer.on('download-resumed', (_e, downloadId) => cb(downloadId)),
  onDownloadCancelled: (cb) => 
    ipcRenderer.on('download-cancelled', (_e, downloadId) => cb(downloadId)),

  // Settings management
  loadSettings: () => 
    ipcRenderer.invoke('load-settings'),
  saveSettings: (settings) => 
    ipcRenderer.invoke('save-settings', settings),
  resetSettings: () => 
    ipcRenderer.invoke('reset-settings'),
  exportSettings: () => 
    ipcRenderer.invoke('export-settings'),
  importSettings: () => 
    ipcRenderer.invoke('import-settings'),
  getSettingsByCategory: (category) => 
    ipcRenderer.invoke('get-settings-by-category', category),
  searchSettings: (query) => 
    ipcRenderer.invoke('search-settings', query),
  getSettingsCategories: () => 
    ipcRenderer.invoke('get-settings-categories'),
});


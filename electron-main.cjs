const { app, BrowserWindow, ipcMain, shell, dialog, globalShortcut, screen, protocol, net, nativeImage } = require('electron');
require('dotenv').config();

const isDev = !app.isPackaged;
const log = isDev ? console.log : () => {};
const logWarn = isDev ? console.warn : () => {};

// --- Main-process heartbeat watchdog ---
// Windows marks a window as "Not Responding" if the owning process
// doesn't pump its message loop for ~5 seconds. During a heavy
// launch (downloading libraries/assets, extracting natives) the
// main process can starve the loop. This interval keeps a tick
// alive and yields between iterations so IPC stays responsive.
let __heartbeatActive = false;
const __heartbeat = setInterval(() => {
  if (!__heartbeatActive) return;
  // Touch a no-op timer to prove the loop is alive and yield
  // between heavy sync chunks elsewhere.
  if (typeof setImmediate === 'function') setImmediate(() => {});
}, 1000);
if (typeof __heartbeat.unref === 'function') __heartbeat.unref();

// Safely resolve a filename within a base directory, preventing path traversal
function safePath(base, filename) {
  const resolved = path.resolve(base, filename);
  const baseResolved = path.resolve(base);
  const rel = path.relative(baseResolved, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`Path traversal denied: ${filename}`);
  }
  return resolved;
}
const path = require('path');
const { Client } = require('minecraft-launcher-core');
const fs = require('fs');

// --- Launch Performance Optimization: Checksum Bypass for Existing Files ---
const Handler = require('minecraft-launcher-core/components/handler');
const originalCheckSum = Handler.prototype.checkSum;
Handler.prototype.checkSum = async function(hash, file) {
  if (this.options?.overrides?.skipVerify && require('fs').existsSync(file)) {
    return true; // Bypass hashing if file exists
  }
  return originalCheckSum.call(this, hash, file);
};

const https = require('https');
const { exec, execSync, spawn } = require('child_process');
const DiscordRPC = require('discord-rpc');
const { Worker } = require('worker_threads');
const crypto = require('crypto');
const AdmZip = require('adm-zip');
const { scanProfileAchievements, scanAllAchievements, resolveProfilePath } = require('./src/backend/achievements-scanner.cjs');
const msmc = require('msmc');

app.commandLine.appendSwitch('js-flags', '--expose_gc');
app.userAgentFallback = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

protocol.registerSchemesAsPrivileged([
  { scheme: 'idk-cache', privileges: { secure: true, standard: true, supportFetchAPI: true, bypassCSP: true } }
]);

let mainWindow;

// --- Overlay Window State ---
let overlayWindow = null;
let overlayActive = false;
let overlaySessionData = null;
let activeLaunchProcess = null;

let boundsTrackerProcess = null;

function createOverlayWindow(sessionData) {
  if (overlayWindow) return;
  overlaySessionData = sessionData;

  overlayWindow = new BrowserWindow({
    transparent: true,
    frame: false,
    fullscreen: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    focusable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
      webSecurity: true
    }
  });

  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  overlayActive = false;

  const isFullscreen = sessionData && sessionData.isFullscreen;
  const forceBorderlessStr = isFullscreen ? '$true' : '$false';

  // Track window bounds via powershell and apply borderless style if running fullscreen
  const psScript = `
$forceBorderless = ${forceBorderlessStr}
$styled = $false

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class Win32 {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hwnd, out RECT lpRect);
    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
    [DllImport("user32.dll")]
    public static extern int GetSystemMetrics(int nIndex);
    [DllImport("user32.dll")]
    public static extern int GetWindowLong(IntPtr hWnd, int nIndex);
    [DllImport("user32.dll")]
    public static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);
    [DllImport("user32.dll")]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
}
"@

$GWL_STYLE = -16
$WS_POPUP = 0x80000000
$WS_CAPTION = 0x00C00000
$WS_THICKFRAME = 0x00040000
$SWP_FRAMECHANGED = 0x0020
$SWP_SHOWWINDOW = 0x0040

while($true) {
    $hwnd = [Win32]::GetForegroundWindow()
    if ($hwnd -ne [IntPtr]::Zero) {
        $sb = New-Object System.Text.StringBuilder 256
        if ([Win32]::GetWindowText($hwnd, $sb, $sb.Capacity) -gt 0) {
            $title = $sb.ToString()
            if ($title -match "^Minecraft") {
                if ($forceBorderless -eq $true -and $styled -eq $false) {
                    $style = [Win32]::GetWindowLong($hwnd, $GWL_STYLE)
                    if (($style -band $WS_CAPTION) -ne 0) {
                        $newStyle = ($style -band (-bnot $WS_CAPTION) -band (-bnot $WS_THICKFRAME)) -bor $WS_POPUP
                        $null = [Win32]::SetWindowLong($hwnd, $GWL_STYLE, $newStyle)
                        
                        $screenWidth = [Win32]::GetSystemMetrics(0)
                        $screenHeight = [Win32]::GetSystemMetrics(1)
                        $null = [Win32]::SetWindowPos($hwnd, [IntPtr]::Zero, 0, 0, $screenWidth, $screenHeight, $SWP_FRAMECHANGED -bor $SWP_SHOWWINDOW)
                        $styled = $true
                    }
                }

                $rect = New-Object Win32+RECT
                if ([Win32]::GetWindowRect($hwnd, [ref]$rect)) {
                    $w = $rect.Right - $rect.Left
                    $h = $rect.Bottom - $rect.Top
                    Write-Output "$($rect.Left),$($rect.Top),$w,$h"
                }
            }
        }
    }
    Start-Sleep -Milliseconds 500
}
`;

  boundsTrackerProcess = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psScript]);
  
  boundsTrackerProcess.stdout.on('data', (data) => {
    if (!overlayWindow) return;
    const lines = data.toString().trim().split('\n');
    const str = lines[lines.length - 1].trim(); // Get most recent rect
    if (str) {
      const parts = str.split(',').map(Number);
      if (parts.length === 4 && !isNaN(parts[0])) {
        const [x, y, width, height] = parts;
        const bounds = overlayWindow.getBounds();
        if (bounds.x !== x || bounds.y !== y || bounds.width !== width || bounds.height !== height) {
           overlayWindow.setBounds({ x, y, width, height });
        }
      }
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    const baseUrl = process.env.VITE_DEV_SERVER_URL.endsWith('/') ? process.env.VITE_DEV_SERVER_URL : process.env.VITE_DEV_SERVER_URL + '/';
    overlayWindow.loadURL(baseUrl + 'src/features/overlay/overlay.html');
  } else {
    overlayWindow.loadFile(path.join(__dirname, 'dist', 'src', 'features', 'overlay', 'overlay.html'));
  }

  overlayWindow.once('ready-to-show', () => {
    const sendData = () => {
      if (overlayWindow) overlayWindow.webContents.send('overlay-init', overlaySessionData);
    };
    sendData();
    setTimeout(sendData, 1000);
    if (overlaySessionData?.autoOpen) {
      overlayActive = true;
      overlayWindow.setIgnoreMouseEvents(false);
      overlayWindow.showInactive();
      overlayWindow.webContents.send('toggle-overlay-ui', true);
    }
  });

  globalShortcut.register('Shift+Tab', () => {
    if (!overlayWindow) return;
    overlayActive = !overlayActive;
    if (overlayActive) {
      overlayWindow.setIgnoreMouseEvents(false);
      overlayWindow.show();
      overlayWindow.focus();
    } else {
      overlayWindow.setIgnoreMouseEvents(true, { forward: true });
      overlayWindow.hide();
    }
    overlayWindow.webContents.send('toggle-overlay-ui', overlayActive);
  });

  overlayWindow.on('closed', () => {
    overlayWindow = null;
    globalShortcut.unregister('Shift+Tab');
    if (boundsTrackerProcess) {
      boundsTrackerProcess.kill();
      boundsTrackerProcess = null;
    }
  });
}

ipcMain.on('resume-game', () => {
  if (overlayWindow && overlayActive) {
    overlayActive = false;
    overlayWindow.setIgnoreMouseEvents(true, { forward: true });
    overlayWindow.hide();
    overlayWindow.webContents.send('toggle-overlay-ui', false);
  }
});

const activeLaunchSockets = new Set();
global.isLaunchDownloading = false;

// Intercept https to allow brutal cancellation of MCLC
const originalHttpsGet = https.get;
const originalHttpsRequest = https.request;

function trackRequest(req) {
  if (global.isLaunchDownloading) {
    activeLaunchSockets.add(req);
    req.on('close', () => activeLaunchSockets.delete(req));
    req.on('error', () => activeLaunchSockets.delete(req));
  }
  return req;
}

https.get = function(...args) { return trackRequest(originalHttpsGet.apply(this, args)); };
https.request = function(...args) { return trackRequest(originalHttpsRequest.apply(this, args)); };

ipcMain.on('cancel-launch', () => {
  try {
    console.log(`[Launch] User requested launch cancellation. Active sockets to destroy: ${activeLaunchSockets.size}`);
    global.isLaunchDownloading = false;
    
    // Brutally destroy all active MCLC sockets
    for (const req of activeLaunchSockets) {
      try { req.destroy(new Error('Launch cancelled')); } catch (e) {}
    }
    activeLaunchSockets.clear();

    if (activeLaunchProcess && typeof activeLaunchProcess.kill === 'function') {
      if (!global.isLaunchDownloading) {
        console.warn(`[Launch] Launch was cancelled before MCLC started.`);
        return;
      }
      activeLaunchProcess.kill();
    }
  } catch (e) {
    console.warn('[Launch] Failed to cancel active launch:', e.message);
  } finally {
    activeLaunchProcess = null;
  }
});

// Pull-based overlay data G�� renderer requests this once it's ready
ipcMain.handle('get-overlay-data', () => overlaySessionData);

// --- Discord Rich Presence State Management ---
// The Application ID (Client ID) is public and completely safe to share/commit to repositories.
const DISCORD_CLIENT_ID = '1505559083929964554'; // Public client ID for general Minecraft Launcher presence
let rpcClient = null;
let rpcConnected = false;
let currentPresence = null;
let reconnectTimeout = null;
let rpcRetryCount = 0;
const RPC_MAX_RETRIES = 5;
const RPC_BASE_DELAY = 15000;

function initDiscordRPC() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  if (DISCORD_CLIENT_ID === 'YOUR_DISCORD_CLIENT_ID') {
    return;
  }

  rpcClient = new DiscordRPC.Client({ transport: 'ipc' });

  rpcClient.on('ready', () => {
    rpcConnected = true;
    rpcRetryCount = 0;

    // Set initial presence if we already have one queued, otherwise set idle
    if (currentPresence) {
      setDiscordPresence(currentPresence);
    } else {
      updateDiscordPresence('In Main Menu', 'Idle in Launcher');
    }
  });

  // Register game invite handlers (for the Join button)
  rpcClient.on('join', (secret) => {
  });

  rpcClient.on('joinRequest', (user) => {
  });

  rpcClient.on('disconnected', () => {
    rpcConnected = false;
    scheduleRPCReconnect();
  });

  rpcClient.login({ clientId: DISCORD_CLIENT_ID }).catch(err => {
    if (!err.message.includes('Could not connect')) {
      console.warn('[Discord RPC] Login failed:', err.message);
    }
    rpcConnected = false;
    scheduleRPCReconnect();
  });
}

function scheduleRPCReconnect() {
  if (reconnectTimeout) return;
  if (rpcRetryCount >= RPC_MAX_RETRIES) return;
  const delay = RPC_BASE_DELAY * Math.pow(2, rpcRetryCount);
  rpcRetryCount++;
  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = null;
    initDiscordRPC();
  }, Math.min(delay, 120000));
}

function setDiscordPresence(presence) {
  if (!rpcConnected || !rpcClient) return;

  rpcClient.setActivity(presence).catch(err => {
    console.error('[Discord RPC] Failed to set activity:', err.message);
  });
}

let lastActiveUsername = 'Player';
let elybyOAuthInProgress = false;

function updateDiscordPresence(details, state, largeImageKey = 'icon', largeImageText = 'Indkingdom Launcher', showTimer = false, smallImageKey = null, smallImageText = null) {
  const cleanUser = lastActiveUsername.replace(/[^a-zA-Z0-9]/g, '') || 'player';
  const presence = {
    details: details,
    state: state,
    largeImageKey: largeImageKey,
    largeImageText: largeImageText,
    instance: true, // Required to enable game invite cards and Join buttons
    partyId: `indkingdom-party-${cleanUser}`,
    partySize: 1,
    partyMax: 10,
    joinSecret: `indkingdom-join-${cleanUser}-${Date.now()}`
  };

  if (showTimer) {
    presence.startTimestamp = Date.now();
  }

  if (smallImageKey) {
    // Standardize key name (Discord assets must be lowercase alphanumeric and dashes/underscores)
    const cleanKey = smallImageKey.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    presence.smallImageKey = cleanKey;
    presence.smallImageText = smallImageText || '';
  }

  currentPresence = presence;
  setDiscordPresence(presence);
}


function createWindow() {
  const splashWindow = new BrowserWindow({
    width: 400,
    height: 400,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    icon: path.join(__dirname, 'logo.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  splashWindow.loadFile(path.join(__dirname, 'splash.html'));

  mainWindow = new BrowserWindow({
    width: 1250,
    height: 650,
    minWidth: 1250,
    minHeight: 650,
    frame: false,
    resizable: true,
    maximizable: true,
    minimizable: true,
    closable: true,
    show: false, // Don't show immediately
    icon: path.join(__dirname, 'logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Load the Vite dev server in development, or the built files in production
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  // Once main window is ready to show, wait a bit for splash animation then swap
  mainWindow.once('ready-to-show', () => {
    console.log('[Window] ready-to-show event fired');
    try {
      mainWindow.webContents.send('window-state-changed', { maximized: mainWindow.isMaximized() });
    } catch {}
    setTimeout(() => {
      console.log('[Window] Closing splash, showing main window');
      splashWindow.close();
      mainWindow.show();
    }, 3000); // 3 second splash minimum
  });

  mainWindow.on('closed', () => {
    console.log('[Window] Main window closed');
    mainWindow = null;
  });

  mainWindow.on('close', (e) => {
  });

  const syncWindowState = () => {
    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('window-state-changed', { maximized: mainWindow.isMaximized() });
      }
    } catch {}
  };
  mainWindow.on('maximize', syncWindowState);
  mainWindow.on('unmaximize', syncWindowState);
  mainWindow.on('resize', syncWindowState);
}

app.whenReady().then(() => {
  autoCleanJunkFiles();
  const imageCacheDir = path.join(app.getPath('userData'), 'image-cache');
  if (!fs.existsSync(imageCacheDir)) fs.mkdirSync(imageCacheDir, { recursive: true });

  const worker = new Worker(path.join(__dirname, 'image-worker.cjs'));
  const pendingRequests = new Map();

  worker.on('message', (result) => {
    const { url, cachePath, success } = result;
    if (pendingRequests.has(url)) {
      pendingRequests.get(url).forEach(resolve => resolve({ cachePath, success }));
      pendingRequests.delete(url);
    }
  });

  protocol.handle('idk-cache', async (request) => {
    if (request.url.startsWith('idk-cache://custom-icons/')) {
      const fileName = request.url.replace('idk-cache://custom-icons/', '');
      const localPath = path.join(app.getPath('userData'), 'custom-icons', fileName);
      if (fs.existsSync(localPath)) {
        return net.fetch('file://' + localPath.replace(/\\/g, '/'));
      }
      return new Response('Not found', { status: 404 });
    }

    const originalUrl = request.url.replace('idk-cache://', 'https://');
    const hash = crypto.createHash('md5').update(originalUrl).digest('hex');
    const localPath = path.join(imageCacheDir, hash);
    
    if (fs.existsSync(localPath)) {
      return net.fetch('file://' + localPath.replace(/\\/g, '/'));
    }

    return new Promise((resolve) => {
      if (!pendingRequests.has(originalUrl)) {
        pendingRequests.set(originalUrl, []);
        worker.postMessage({ url: originalUrl, cacheDir: imageCacheDir });
      }
      pendingRequests.get(originalUrl).push((result) => {
        if (result.success && fs.existsSync(result.cachePath)) {
          resolve(net.fetch('file://' + result.cachePath.replace(/\\/g, '/')));
        } else {
          resolve(net.fetch(originalUrl)); // Fallback
        }
      });
    });
  });

  createWindow();
  initDiscordRPC(); // Initialize Discord Rich Presence on startup

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Custom window controls IPC
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});
ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  }
});
ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.on('open-minecraft-folder', () => {
  const rootPath = getMinecraftDataPath();
  if (!fs.existsSync(rootPath)) {
    fs.mkdirSync(rootPath, { recursive: true });
  }
  shell.openPath(rootPath);
});

ipcMain.on('open-external', (event, url) => {
  shell.openExternal(url);
});

// Forward renderer console.log to terminal
ipcMain.on('renderer-log', (_e, msg) => { if (isDev) console.log('[Renderer]', msg); });

ipcMain.on('toggle-devtools', () => {
  if (mainWindow) {
    if (mainWindow.webContents.isDevToolsOpened()) {
      mainWindow.webContents.closeDevTools();
    } else {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  }
});
// Mod install IPC (for modpack manager)
ipcMain.handle('install-mod', async (event, { modpackId, downloadUrl, filename }) => {
  if (/^(fabric|forge|neoforge|quilt)-loader-.*\.jar$/i.test(filename || '')) {
    return { success: true, skipped: true, reason: 'loader-artifact' };
  }
  const rootPath = getMinecraftDataPath();
  const modsPath = path.join(rootPath, 'profiles', `modpack-${modpackId}`, 'mods');
  if (!fs.existsSync(modsPath)) fs.mkdirSync(modsPath, { recursive: true });
  const jarPath = safePath(modsPath, filename);
  if (fs.existsSync(jarPath)) return { success: true, cached: true };
  return new Promise((resolve, reject) => {
    downloadFile(downloadUrl, jarPath, () => resolve({ success: true }), (e) => reject(e));
  });
});

// Helper: find the version directory path, preferring exact match (vanilla) over loader dirs
function resolveVersionDir(versionsPath, version) {
  const dirs = fs.readdirSync(versionsPath, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .filter(name => name.endsWith('-' + version) || name === version)
    .sort((a, b) => {
      if (a === version) return -1;
      if (b === version) return 1;
      return a.localeCompare(b);
    });
  return dirs.length > 0 ? dirs[0] : null;
}

// Import external files via drag and drop
ipcMain.handle('import-external-files', async (event, { modpackId, targetType, sourcePaths }) => {
  try {
    const rootPath = getMinecraftDataPath();
    let destDir;

    if (modpackId && modpackId.startsWith('version-')) {
      const version = modpackId.replace('version-', '');
      const versionsPath = path.join(rootPath, 'versions');
      const versionDir = resolveVersionDir(versionsPath, version);
      if (!versionDir) return { success: false, error: 'Version not found' };
      destDir = path.join(versionsPath, versionDir, targetType);
    } else if (modpackId) {
      destDir = path.join(rootPath, 'profiles', `modpack-${modpackId}`, targetType);
    } else {
      return { success: false, error: 'No modpack or version specified' };
    }

    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    let imported = 0;
    for (const src of sourcePaths) {
      try {
        if (!fs.existsSync(src)) continue;
        const filename = path.basename(src);
        const destPath = safePath(destDir, filename);
        // Only copy files (not directories)
        const stat = fs.statSync(src);
        if (stat.isFile()) {
          fs.copyFileSync(src, destPath);
          imported++;
        }
      } catch (err) {
        console.error(`[ImportExternal] Failed to copy ${src}:`, err);
      }
    }

    return { success: true, imported };
  } catch (e) {
    console.error('[ImportExternal] Error:', e);
    return { success: false, error: e.message };
  }
});

// Install mod directly to a version's mods folder
ipcMain.handle('install-mod-to-version', async (event, { version, downloadUrl, filename }) => {
  if (/^(fabric|forge|neoforge|quilt)-loader-.*\.jar$/i.test(filename || '')) {
    return { success: true, skipped: true, reason: 'loader-artifact' };
  }
  const rootPath = getMinecraftDataPath();
  const versionsPath = path.join(rootPath, 'versions');
  const versionDir = resolveVersionDir(versionsPath, version);
  if (!versionDir) throw new Error('Version directory not found');
  const modsPath = path.join(versionsPath, versionDir, 'mods');
  if (!fs.existsSync(modsPath)) fs.mkdirSync(modsPath, { recursive: true });
  const jarPath = safePath(modsPath, filename);
  if (fs.existsSync(jarPath)) return { success: true, cached: true };
  
  return new Promise((resolve, reject) => {
    downloadFile(downloadUrl, jarPath, () => resolve({ success: true }), (e) => reject(e));
  });
});

// Scan unique completed advancements for a modpack or version profile
ipcMain.handle('scan-profile-achievements', async (event, { modpackId, versionId } = {}) => {
  try {
    const rootPath = getMinecraftDataPath();
    const profilePath = resolveProfilePath(rootPath, { modpackId, versionId });
    if (!profilePath) {
      return { success: false, error: 'No profile specified', count: 0, advancements: [] };
    }
    const { count, advancements } = scanProfileAchievements(profilePath);
    return { success: true, count, advancements, profilePath };
  } catch (e) {
    console.error('[Achievements] Scan error:', e);
    return { success: false, error: e.message, count: 0, advancements: [] };
  }
});

// Scan all completed achievements across all profiles
ipcMain.handle('scan-all-achievements', async (event) => {
  try {
    const rootPath = getMinecraftDataPath();
    const { count, advancements } = scanAllAchievements(rootPath);
    return { success: true, count, advancements };
  } catch (e) {
    console.error('[Achievements] Scan error:', e);
    return { success: false, error: e.message, count: 0, advancements: [] };
  }
});

// Scan mods installed for a specific version
ipcMain.handle('scan-version-mods', async (event, version) => {
  try {
    const rootPath = getMinecraftDataPath();
    const versionsPath = path.join(rootPath, 'versions');
    const versionDir = resolveVersionDir(versionsPath, version);
    
    if (!versionDir) {
      return { success: true, mods: [] };
    }
    
    const modsPath = path.join(versionsPath, versionDir, 'mods');
    
    if (!fs.existsSync(modsPath)) {
      return { success: true, mods: [] };
    }
    
    const files = fs.readdirSync(modsPath)
      .filter(f => f.endsWith('.jar'))
      .map(filename => ({ filename }));
    
    return { success: true, mods: files };
  } catch (e) {
    console.error('[ScanVersionMods] Error:', e);
    return { success: false, error: e.message, mods: [] };
  }
});

// Auto-install missing mod dependencies detected from crash reports
ipcMain.handle('auto-install-dependencies', async (event, { modpackId, missing, mcVersion }) => {
  const rootPath = getMinecraftDataPath();
  const modsPath = path.join(rootPath, 'profiles', `modpack-${modpackId}`, 'mods');
  if (!fs.existsSync(modsPath)) fs.mkdirSync(modsPath, { recursive: true });

  const results = [];
  for (const dep of missing) {
    try {
      // Search Modrinth for the dependency mod
      const searchUrl = `https://api.modrinth.com/v2/search?query=${encodeURIComponent(dep.modId)}&facets=${encodeURIComponent(JSON.stringify([["project_type:mod"],["versions:" + mcVersion]]))}&limit=5`;
      const searchRes = await fetch(searchUrl);
      const searchData = await searchRes.json();
      const hit = searchData.hits && searchData.hits[0];
      if (!hit) { results.push({ modId: dep.modId, success: false, reason: 'Not found on Modrinth' }); continue; }

      // Get versions for this project
      const versionsUrl = `https://api.modrinth.com/v2/project/${hit.project_id}/version?game_versions=${encodeURIComponent(JSON.stringify([mcVersion]))}&loaders=${encodeURIComponent(JSON.stringify(['forge','fabric','neoforge','quilt']))}`;
      const versionsRes = await fetch(versionsUrl);
      const versions = await versionsRes.json();
      if (!Array.isArray(versions) || versions.length === 0) { results.push({ modId: dep.modId, success: false, reason: 'No compatible version found' }); continue; }

      const latest = versions[0];
      const file = latest.files && latest.files.find(f => f.primary) || latest.files[0];
      if (!file) { results.push({ modId: dep.modId, success: false, reason: 'No file found' }); continue; }

      const destPath = path.join(modsPath, file.filename);
      if (!fs.existsSync(destPath)) {
        await new Promise((resolve, reject) => {
          downloadFile(file.url, destPath, resolve, reject);
        });
      }
      results.push({ modId: dep.modId, success: true, filename: file.filename, name: hit.title });
    } catch (e) {
      results.push({ modId: dep.modId, success: false, reason: e.message });
    }
  }
  return results;
});

ipcMain.handle('remove-mod', async (event, { modpackId, filename }) => {
  const rootPath = getMinecraftDataPath();
  let basePath;

  if (modpackId.startsWith('version-')) {
    const version = modpackId.replace('version-', '');
    const versionsPath = path.join(rootPath, 'versions');
    const versionDir = resolveVersionDir(versionsPath, version);
    if (!versionDir) return { success: false, error: 'Version not found' };
    basePath = path.join(versionsPath, versionDir, 'mods');
  } else {
    basePath = path.join(rootPath, 'profiles', `modpack-${modpackId}`, 'mods');
  }

  console.log(`[RemoveMod] modpackId=${modpackId} filename=${filename} basePath=${basePath}`);

  try {
    let jarPath;
    try {
      jarPath = safePath(basePath, filename);
    } catch (e) {
      console.error(`[RemoveMod] safePath failed for "${filename}" in ${basePath}:`, e.message);
      return { success: false, error: `Invalid path: ${e.message}` };
    }

    console.log(`[RemoveMod] Resolved jarPath=${jarPath}`);

    if (fs.existsSync(jarPath)) {
      fs.unlinkSync(jarPath);
      console.log(`[RemoveMod] Deleted: ${jarPath}`);
      return { success: true };
    }

    // Fallback: case-insensitive search on Windows
    if (process.platform === 'win32' && fs.existsSync(basePath)) {
      const dirFiles = fs.readdirSync(basePath);
      const target = filename.toLowerCase();
      const match = dirFiles.find((f) => f.toLowerCase() === target);
      if (match) {
        const fallbackPath = safePath(basePath, match);
        fs.unlinkSync(fallbackPath);
        console.log(`[RemoveMod] Deleted (case-insensitive): ${fallbackPath}`);
        return { success: true, deletedAs: match };
      }

      // Second fallback: match by stripping version suffix differences
      // e.g. "sodium-fabric-0.5.3+mc1.20.1.jar" might match "sodium-0.5.3+mc1.20.1.jar"
      const baseName = filename.replace(/\.jar$|\.zip$/i, '').toLowerCase();
      const partialMatch = dirFiles.find((f) => {
        const fn = f.replace(/\.jar$|\.zip$/i, '').toLowerCase();
        return fn.includes(baseName.split('-')[0]) && fn.length > 0;
      });

      if (partialMatch && partialMatch !== filename) {
        const fallbackPath = safePath(basePath, partialMatch);
        fs.unlinkSync(fallbackPath);
        console.log(`[RemoveMod] Deleted (partial match): ${fallbackPath}`);
        return { success: true, deletedAs: partialMatch };
      }

      console.warn(`[RemoveMod] File not found. Tried "${filename}" in ${basePath}. Directory contains: [${dirFiles.join(', ')}]`);
    }

    // File not found G�� treat as already removed (success)
    return { success: true, alreadyGone: true };
  } catch (e) {
    console.error(`[RemoveMod] Error:`, e.message);
    return { success: false, error: e.message };
  }
});

// Delete entire modpack folder from disk
ipcMain.handle('update-modpack-profile', async (event, { modpackId, name, mcVersion, loader, loaderVersion, javaArgs, windowWidth, windowHeight }) => {
  try {
    const rootPath = getMinecraftDataPath();
    // Handle 'version-' prefix for version-specific profiles (mirrors launch-modpack logic).
    const profileDirName = modpackId && modpackId.startsWith('version-') ? modpackId : `modpack-${modpackId}`;
    const profilePath = path.join(rootPath, 'profiles', profileDirName);
    const profileJsonPath = path.join(profilePath, 'profile.json');
    if (!fs.existsSync(profilePath)) fs.mkdirSync(profilePath, { recursive: true });
    let existing = {};
    if (fs.existsSync(profileJsonPath)) {
      try { existing = JSON.parse(fs.readFileSync(profileJsonPath, 'utf8')); } catch (_) {}
    }
    const merged = { ...existing, id: modpackId, name, mcVersion, loader, loaderVersion, javaArgs, windowWidth, windowHeight };
    fs.writeFileSync(profileJsonPath, JSON.stringify(merged, null, 2), 'utf8');
    return { success: true };
  } catch (e) {
    console.error('[update-modpack-profile] Failed:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('delete-modpack-folder', async (event, { modpackId }) => {
  try {
    const rootPath = getMinecraftDataPath();
    const profilePath = path.join(rootPath, 'profiles', `modpack-${modpackId}`);
    
    if (!fs.existsSync(profilePath)) {
      return { success: true }; // Already deleted, so return success
    }



    // Helper function to recursively delete with proper handle management
    // Excludes certain folders that may be locked by other processes
    const deleteRecursiveSync = (dirPath, depth = 0, excludeFolders = ['logs']) => {
      if (!fs.existsSync(dirPath)) return;
      
      let entries;
      try {
        entries = fs.readdirSync(dirPath);
      } catch (e) {
        console.warn(`[Modpacks] Could not read directory ${dirPath}:`, e.message);
        return;
      }
      
      for (const entry of entries) {
        // Skip excluded folders
        if (excludeFolders.includes(entry)) {
          continue;
        }
        
        const fullPath = path.join(dirPath, entry);
        try {
          const stat = fs.lstatSync(fullPath);
          if (stat.isDirectory()) {
            deleteRecursiveSync(fullPath, depth + 1, excludeFolders);
          } else {
            fs.unlinkSync(fullPath);
          }
        } catch (e) {
          console.warn(`[Modpacks] Could not delete ${fullPath}:`, e.message);
        }
      }
      
      // Try to remove the now-empty directory (but only if it's not the root profile path)
      if (dirPath !== profilePath) {
        try {
          fs.rmdirSync(dirPath);
        } catch (e) {
          console.warn(`[Modpacks] Could not remove directory ${dirPath}:`, e.message);
        }
      }
    };

    // Attempt 1: Try standard rmSync
    try {
      fs.rmSync(profilePath, { recursive: true, force: true });
      return { success: true };
    } catch (e) {
      console.warn(`[Modpacks] rmSync failed:`, e.message);
    }

    // Attempt 2: Recursive deletion (excluding locked folders)
    deleteRecursiveSync(profilePath);

    // Verify deletion - check if only logs folder remains
    let remainingItems = [];
    try {
      remainingItems = fs.readdirSync(profilePath);
    } catch (e) {
      return { success: true };
    }

    // If only logs folder remains, that's acceptable
    if (remainingItems.length === 0 || (remainingItems.length === 1 && remainingItems[0] === 'logs')) {
      try {
        fs.rmdirSync(profilePath);
      } catch (e) {
      }
      return { success: true };
    }

    // Attempt 3: Wait and try again
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    try {
      fs.rmSync(profilePath, { recursive: true, force: true });
      return { success: true };
    } catch (e) {
      console.warn(`[Modpacks] Final rmSync attempt failed:`, e.message);
    }

    // Attempt 4: One more recursive try
    deleteRecursiveSync(profilePath);

    // Final check
    try {
      const finalItems = fs.readdirSync(profilePath);
      if (finalItems.length === 0 || (finalItems.length === 1 && finalItems[0] === 'logs')) {
        try {
          fs.rmdirSync(profilePath);
        } catch (e) {
        }
        return { success: true };
      }
    } catch (e) {
      return { success: true };
    }

    console.error(`[Modpacks] Could not delete modpack folder after all attempts: ${profilePath}`);
    return { 
      success: false, 
      error: 'Could not delete folder - some files are locked by Java/Minecraft. Close Minecraft and try again.' 
    };
  } catch (e) {
    console.error(`[Modpacks] Unexpected error during deletion:`, e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('install-resourcepack', async (event, { modpackId, downloadUrl, filename }) => {
  const rootPath = getMinecraftDataPath();
  const rpPath = path.join(rootPath, 'profiles', `modpack-${modpackId}`, 'resourcepacks');
  if (!fs.existsSync(rpPath)) fs.mkdirSync(rpPath, { recursive: true });
  const destPath = safePath(rpPath, filename);
  if (fs.existsSync(destPath)) return { success: true, cached: true };
  return new Promise((resolve, reject) => {
    downloadFile(downloadUrl, destPath, () => resolve({ success: true }), (e) => reject(e));
  });
});

ipcMain.handle('remove-resourcepack', async (event, { modpackId, filename }) => {
  const rootPath = getMinecraftDataPath();
  let basePath;
  
  if (modpackId.startsWith('version-')) {
    const version = modpackId.replace('version-', '');
    const versionsPath = path.join(rootPath, 'versions');
    const versionDir = resolveVersionDir(versionsPath, version);
    if (!versionDir) return { success: false, error: 'Version not found' };
    basePath = path.join(versionsPath, versionDir, 'resourcepacks');
  } else {
    basePath = path.join(rootPath, 'profiles', `modpack-${modpackId}`, 'resourcepacks');
  }
  
  try {
    const destPath = safePath(basePath, filename);
    if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
  } catch (e) { }
  return { success: true };
});

ipcMain.handle('install-shader', async (event, { modpackId, downloadUrl, filename }) => {
  const rootPath = getMinecraftDataPath();
  const shaderPath = path.join(rootPath, 'profiles', `modpack-${modpackId}`, 'shaderpacks');
  if (!fs.existsSync(shaderPath)) fs.mkdirSync(shaderPath, { recursive: true });
  const destPath = safePath(shaderPath, filename);
  if (fs.existsSync(destPath)) return { success: true, cached: true };
  return new Promise((resolve, reject) => {
    downloadFile(downloadUrl, destPath, () => resolve({ success: true }), (e) => reject(e));
  });
});

ipcMain.handle('remove-shader', async (event, { modpackId, filename }) => {
  const rootPath = getMinecraftDataPath();
  let basePath;
  
  if (modpackId.startsWith('version-')) {
    const version = modpackId.replace('version-', '');
    const versionsPath = path.join(rootPath, 'versions');
    const versionDir = resolveVersionDir(versionsPath, version);
    if (!versionDir) return { success: false, error: 'Version not found' };
    basePath = path.join(versionsPath, versionDir, 'shaderpacks');
  } else {
    basePath = path.join(rootPath, 'profiles', `modpack-${modpackId}`, 'shaderpacks');
  }
  
  try {
    const destPath = safePath(basePath, filename);
    if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
  } catch (e) { }
  return { success: true };
});


ipcMain.handle('unzip-curseforge', async (event, { filePath }) => {
  try {
    const tempExt = path.join(app.getPath('userData'), 'temp-import-' + Date.now());
    if (fs.existsSync(tempExt)) fs.rmSync(tempExt, { recursive: true, force: true });
    fs.mkdirSync(tempExt, { recursive: true });

    const zip = new AdmZip(filePath);
    zip.extractAllTo(tempExt, true);

    const manifestPath = path.join(tempExt, 'manifest.json');
    if (!fs.existsSync(manifestPath)) throw new Error("Not a valid CurseForge modpack (manifest.json missing)");

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const modpackId = Date.now().toString(36) + Math.random().toString(36).slice(2);

    const profilePath = path.join(getMinecraftDataPath(), 'profiles', `modpack-${modpackId}`);
    fs.mkdirSync(profilePath, { recursive: true });

    const overridesFolder = manifest.overrides || 'overrides';
    const overridesPath = path.join(tempExt, overridesFolder);
    if (fs.existsSync(overridesPath)) {
      // Use standard Node.js cpSync to copy overrides contents directly to profilePath
      fs.cpSync(overridesPath, profilePath, { recursive: true, force: true });
    }

    fs.rmSync(tempExt, { recursive: true, force: true });

    // Scan profile for resourcepacks and shaderpacks placed by overrides
    const scanDir = (subdir) => {
      const dir = path.join(profilePath, subdir);
      if (!fs.existsSync(dir)) return [];
      return fs.readdirSync(dir)
        .filter(f => fs.statSync(path.join(dir, f)).isFile())
        .map(f => ({ filename: f, name: f.replace(/\.(zip|jar)$/i, '') }));
    };

    const resourcepackFiles = scanDir('resourcepacks');
    const shaderpackFiles = scanDir('shaderpacks');
    const extraModFiles = scanDir('mods'); // mods bundled in overrides

    return { success: true, manifest, modpackId, resourcepackFiles, shaderpackFiles, extraModFiles };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('select-modpack-zip', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select CurseForge Modpack Archive (.zip)',
    filters: [{ name: 'Zip Archive', extensions: ['zip'] }],
    properties: ['openFile']
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('select-export-zip', async (event, { defaultName }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Exported Modpack',
    defaultPath: defaultName || 'MyModpack.zip',
    filters: [{ name: 'Zip Archive', extensions: ['zip'] }]
  });
  if (result.canceled || !result.filePath) return null;
  return result.filePath;
});

ipcMain.handle('export-modpack', async (event, { modpackId, name, mcVersion, loader, loaderVersion, destPath }) => {
  try {
    const rootPath = getMinecraftDataPath();
    const profilePath = path.join(rootPath, 'profiles', `modpack-${modpackId}`);
    if (!fs.existsSync(profilePath)) throw new Error("Modpack folder not found.");

    // Create temporary work folder
    const tempExportDir = path.join(app.getPath('userData'), 'temp-export-' + Date.now());
    fs.mkdirSync(tempExportDir, { recursive: true });

    // 1. Create manifest.json
    const manifest = {
      minecraft: {
        version: mcVersion,
        modLoaders: [
          {
            id: `${loader.toLowerCase()}-${loaderVersion || 'latest'}`,
            primary: true
          }
        ]
      },
      manifestType: "minecraftModpack",
      manifestVersion: 1,
      name: name,
      version: "1.0.0",
      author: "IDK Launcher User",
      files: [],
      overrides: "overrides"
    };
    fs.writeFileSync(path.join(tempExportDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

    // 2. Copy profilePath contents to overrides/
    const overridesDest = path.join(tempExportDir, 'overrides');
    fs.mkdirSync(overridesDest, { recursive: true });
    
    if (fs.existsSync(profilePath)) {
      fs.cpSync(profilePath, overridesDest, { recursive: true, force: true });
    }

    // Privacy & Size Clean: Delete temporary logs inside overrides
    const tempLogs = path.join(overridesDest, 'logs');
    if (fs.existsSync(tempLogs)) {
      fs.rmSync(tempLogs, { recursive: true, force: true });
    }

    // 3. Compress using adm-zip
    if (fs.existsSync(destPath)) {
      fs.unlinkSync(destPath);
    }
    
    const outZip = new AdmZip();
    outZip.addLocalFolder(tempExportDir);
    outZip.writeZip(destPath);

    // Clean up temporary folder
    fs.rmSync(tempExportDir, { recursive: true, force: true });

    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});



ipcMain.handle('download-curseforge-modpack', async (event, { downloadUrl }) => {
  try {
    const cancelToken = { cancelled: false, req: null, cleanup: null };
    activeDownloads.set('curseforge', cancelToken);

    const tempZip = path.join(app.getPath('userData'), 'temp-modpack-' + Date.now() + '.zip');
    await new Promise((resolve, reject) => {
      downloadFile(downloadUrl, tempZip, resolve, reject, 0, (progress) => {
        event.sender.send('download-progress', { id: 'curseforge', ...progress });
      }, cancelToken);
    });

    activeDownloads.delete('curseforge');

    const tempExt = path.join(app.getPath('userData'), 'temp-import-' + Date.now());
    if (fs.existsSync(tempExt)) fs.rmSync(tempExt, { recursive: true, force: true });
    fs.mkdirSync(tempExt, { recursive: true });

    const zip = new AdmZip(tempZip);
    zip.extractAllTo(tempExt, true);

    const manifestPath = path.join(tempExt, 'manifest.json');
    if (!fs.existsSync(manifestPath)) throw new Error("Not a valid CurseForge modpack (manifest.json missing)");

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const modpackId = Date.now().toString(36) + Math.random().toString(36).slice(2);

    const profilePath = path.join(getMinecraftDataPath(), 'profiles', `modpack-${modpackId}`);
    fs.mkdirSync(profilePath, { recursive: true });

    const overridesFolder = manifest.overrides || 'overrides';
    const overridesPath = path.join(tempExt, overridesFolder);
    if (fs.existsSync(overridesPath)) {
      // Use standard Node.js cpSync to copy overrides contents directly to profilePath
      fs.cpSync(overridesPath, profilePath, { recursive: true, force: true });
    }

    fs.rmSync(tempExt, { recursive: true, force: true });
    fs.unlinkSync(tempZip);

    // Scan profile for resourcepacks and shaderpacks placed by overrides
    const scanDir = (subdir) => {
      const dir = path.join(profilePath, subdir);
      if (!fs.existsSync(dir)) return [];
      return fs.readdirSync(dir)
        .filter(f => fs.statSync(path.join(dir, f)).isFile())
        .map(f => ({ filename: f, name: f.replace(/\.(zip|jar)$/i, '') }));
    };

    const resourcepackFiles = scanDir('resourcepacks');
    const shaderpackFiles = scanDir('shaderpacks');
    const extraModFiles = scanDir('mods'); // mods bundled in overrides (not in manifest)

    // Write profile.json immediately with correct values from manifest
    // Prevents scan-profiles from auto-detecting wrong mcVersion from mod filenames
    const rawLoaderId = manifest.minecraft?.modLoaders?.[0]?.id || "";
    const rawLoaderLower = rawLoaderId.toLowerCase();
    const detectedLoader = rawLoaderLower.includes("fabric") ? "Fabric"
      : rawLoaderLower.includes("forge") ? "Forge"
      : rawLoaderLower.includes("neoforge") ? "NeoForge"
      : "Vanilla";
    const manifestMc = manifest.minecraft?.version || "";
    const profileJson = JSON.stringify({
      id: modpackId,
      name: manifest.name || "Imported Modpack",
      mcVersion: isValidMcVersion(manifestMc) ? manifestMc : "Unknown",
      loader: detectedLoader,
    }, null, 2);
    fs.writeFileSync(path.join(profilePath, 'profile.json'), Buffer.from(profileJson, 'utf8'));

    activeDownloads.delete('curseforge');
    return { success: true, manifest, modpackId, resourcepackFiles, shaderpackFiles, extraModFiles };
  } catch (e) {
    activeDownloads.delete('curseforge');
    return { success: false, error: e.message };
  }
});

ipcMain.handle('download-modrinth-modpack', async (event, { downloadUrl }) => {
  try {
    const cancelToken = { cancelled: false, req: null, cleanup: null };
    activeDownloads.set('modrinth', cancelToken);

    const tempZip = path.join(app.getPath('userData'), 'temp-mrpack-' + Date.now() + '.mrpack');
    await new Promise((resolve, reject) => {
      downloadFile(downloadUrl, tempZip, resolve, reject, 0, (progress) => {
        event.sender.send('download-progress', { id: 'modrinth', ...progress });
      }, cancelToken);
    });

    activeDownloads.delete('modrinth');

    // Rename .mrpack to .zip
    const tempZipPath = tempZip.replace(/\.mrpack$/, '.zip');
    if (tempZipPath !== tempZip) {
      fs.renameSync(tempZip, tempZipPath);
    }

    const tempExt = path.join(app.getPath('userData'), 'temp-import-mr-' + Date.now());
    if (fs.existsSync(tempExt)) fs.rmSync(tempExt, { recursive: true, force: true });
    fs.mkdirSync(tempExt, { recursive: true });

    const zip = new AdmZip(tempZipPath);
    zip.extractAllTo(tempExt, true);

    // Modrinth modpacks use modrinth.index.json
    const indexPath = path.join(tempExt, 'modrinth.index.json');
    if (!fs.existsSync(indexPath)) throw new Error("Not a valid Modrinth modpack (modrinth.index.json missing)");

    const indexJson = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

    // Convert Modrinth index format to CurseForge-style manifest for compatibility
    const dependencies = indexJson.dependencies || {};
    let mcVersion = dependencies.minecraft || '';
    if (!isValidMcVersion(mcVersion)) mcVersion = 'Unknown';

    // Build loader entries from dependencies
    const modLoaders = [];
    for (const [dep, ver] of Object.entries(dependencies)) {
      if (dep !== 'minecraft') {
        modLoaders.push({ id: `${dep}-${ver}`, primary: true });
      }
    }

    const manifest = {
      minecraft: {
        version: mcVersion,
        modLoaders: modLoaders.length ? modLoaders : [{ id: 'fabric-0.15.11', primary: true }],
      },
      name: indexJson.name || 'Modrinth Modpack',
      files: indexJson.files || [],
      overrides: indexJson.overrides || 'overrides',
    };

    const modpackId = Date.now().toString(36) + Math.random().toString(36).slice(2);
    const profilePath = path.join(getMinecraftDataPath(), 'profiles', `modpack-${modpackId}`);
    fs.mkdirSync(profilePath, { recursive: true });

    const overridesFolder = manifest.overrides;
    const overridesPath = path.join(tempExt, overridesFolder);
    if (fs.existsSync(overridesPath)) {
      fs.cpSync(overridesPath, profilePath, { recursive: true, force: true });
    }

    fs.rmSync(tempExt, { recursive: true, force: true });
    // Clean up the downloaded zip (may have been renamed from .mrpack)
    if (fs.existsSync(tempZipPath)) {
      fs.unlinkSync(tempZipPath);
    } else if (fs.existsSync(tempZip)) {
      fs.unlinkSync(tempZip);
    }

    // Scan profile for resourcepacks and shaderpacks from overrides
    const scanDir = (subdir) => {
      const dir = path.join(profilePath, subdir);
      if (!fs.existsSync(dir)) return [];
      return fs.readdirSync(dir)
        .filter(f => fs.statSync(path.join(dir, f)).isFile())
        .map(f => ({ filename: f, name: f.replace(/\.(zip|jar)$/i, '') }));
    };

    const resourcepackFiles = scanDir('resourcepacks');
    const shaderpackFiles = scanDir('shaderpacks');
    const extraModFiles = scanDir('mods');

    // Write profile.json immediately with correct values from manifest
    const rawLoaderId = manifest.minecraft?.modLoaders?.[0]?.id || "";
    const rawLoaderLower = rawLoaderId.toLowerCase();
    const detectedLoader = rawLoaderLower.includes("fabric") ? "Fabric"
      : rawLoaderLower.includes("forge") ? "Forge"
      : rawLoaderLower.includes("neoforge") ? "NeoForge"
      : "Vanilla";
    const manifestMc = manifest.minecraft?.version || "";
    const profileJson = JSON.stringify({
      id: modpackId,
      name: manifest.name || "Imported Modpack",
      mcVersion: isValidMcVersion(manifestMc) ? manifestMc : "Unknown",
      loader: detectedLoader,
    }, null, 2);
    fs.writeFileSync(path.join(profilePath, 'profile.json'), Buffer.from(profileJson, 'utf8'));

    activeDownloads.delete('modrinth');
    return { success: true, manifest, modpackId, resourcepackFiles, shaderpackFiles, extraModFiles };
  } catch (e) {
    activeDownloads.delete('modrinth');
    return { success: false, error: e.message };
  }
});

// Retrieve Ely.by auth data from backend settings (stored securely, not in localStorage)
ipcMain.handle('get-elyby-auth-data', async (event) => {
  try {
    const manager = getSettingsManager();
    if (manager && manager.settings && manager.settings.elybyData) {
      return { success: true, data: manager.settings.elybyData.value };
    }
    return { success: false, data: null };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('get-microsoft-auth-data', async () => {
  try {
    const manager = getSettingsManager();
    if (manager && manager.settings && manager.settings.microsoftData) {
      return { success: true, data: manager.settings.microsoftData.value };
    }
    return { success: false, data: null };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Launch minecraft with a specific modpack profile
ipcMain.handle('elyby-authenticate', async (event, { username, password, clientToken }) => {
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      agent: { name: 'Minecraft', version: 1 },
      username, password, clientToken
    });
    const req = https.request({
      hostname: 'authserver.ely.by', port: 443, path: '/auth/authenticate', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ ok: res.statusCode === 200, data: JSON.parse(data) }); }
        catch (e) { resolve({ ok: false, data: { errorMessage: 'Invalid JSON response' } }); }
      });
    });
    req.on('error', (e) => resolve({ ok: false, data: { errorMessage: e.message } }));
    req.write(postData);
    req.end();
  });
});

// Ely.by login — shows a credential window, authenticates via authserver.ely.by
// Docs: https://docs.ely.by/en/minecraft-auth.html
ipcMain.handle('elyby-oauth-login', async () => {
  if (elybyOAuthInProgress) {
    return { success: false, error: 'Login already in progress. Please wait for the browser window to open.' };
  }
  elybyOAuthInProgress = true;

  const CLIENT_ID = process.env.ELYBY_CLIENT_ID || 'idk-launcher';
  const CLIENT_SECRET = process.env.ELYBY_CLIENT_SECRET || '28grdBLhDN4Af1jRnkOkn9fP7tNvKftuGyb9UVzU6xwiwt1D9e1IGfJGtUUTu_ak';
  const REDIRECT_PORT = parseInt(process.env.ELYBY_REDIRECT_PORT, 10) || 29487;
  const REDIRECT_URI = 'http://127.0.0.1:' + REDIRECT_PORT + '/callback';

  return new Promise((resolve) => {
    const http = require('http');
    let resolved = false;
    const doResolve = (val) => { if (!resolved) { resolved = true; elybyOAuthInProgress = false; resolve(val); } };

    let server = null;
    let timeout = null;

    const cleanup = () => {
      if (server) { try { server.close(); } catch (_) {} server = null; }
      if (timeout) { clearTimeout(timeout); timeout = null; }
    };

    server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1:' + REDIRECT_PORT);

      if (url.pathname === '/callback') {
        if (url.searchParams.has('error')) {
          const errMsg = url.searchParams.get('error_description') || url.searchParams.get('error') || 'Authorization denied';
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<html><body style="background:#1b1b1c;color:#fff;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;font-family:sans-serif"><p>Authorization failed: ' + errMsg + '</p><p>You can close this tab.</p></body></html>');
          cleanup();
          doResolve({ success: false, error: errMsg });
          return;
        }

        const code = url.searchParams.get('code');
        if (!code) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<html><body style="background:#1b1b1c;color:#fff;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;font-family:sans-serif"><p>No authorization code received.</p><p>You can close this tab.</p></body></html>');
          doResolve({ success: false, error: 'No authorization code received' });
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<html><body style="background:#1b1b1c;color:#fff;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;font-family:sans-serif"><p>Logging you in&hellip;</p></body></html>');

        const tokenBody = new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          grant_type: 'authorization_code',
          redirect_uri: REDIRECT_URI,
          code: code
        });

        const tokenReq = https.request({
          hostname: 'account.ely.by',
          port: 443,
          path: '/api/oauth2/v1/token',
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }, (tokenRes) => {
          let data = '';
          tokenRes.on('data', chunk => data += chunk);
          tokenRes.on('end', () => {
            try {
              const tokenData = JSON.parse(data);
              if (tokenData.access_token) {
                const userReq = https.request({
                  hostname: 'account.ely.by',
                  port: 443,
                  path: '/api/account/v1/info',
                  method: 'GET',
                  headers: { 'Authorization': 'Bearer ' + tokenData.access_token }
                }, (userRes) => {
                  let userData = '';
                  userRes.on('data', chunk => userData += chunk);
                  userRes.on('end', () => {
                    try {
                      const userInfo = JSON.parse(userData);
                      const elybyUsername = userInfo.username || userInfo.login || 'Unknown';
                      const elybyUuid = userInfo.uuid || userInfo.id || '';
                      const clientToken = crypto.randomUUID();

                      const yggBody = JSON.stringify({
                        agent: { name: 'Minecraft', version: 1 },
                        username: elybyUsername,
                        password: tokenData.access_token,
                        clientToken: clientToken,
                        requestUser: true
                      });

                      const yggReq = https.request({
                        hostname: 'authserver.ely.by',
                        port: 443,
                        path: '/auth/authenticate',
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Content-Length': Buffer.byteLength(yggBody)
                        }
                      }, (yggRes) => {
                        let yggData = '';
                        yggRes.on('data', chunk => yggData += chunk);
                        yggRes.on('end', () => {
                          try {
                            const yggResult = JSON.parse(yggData);
                            const yggProfile = yggResult.selectedProfile;
                            const result = {
                              success: true,
                              data: {
                                accessToken: yggResult.accessToken || tokenData.access_token,
                                clientToken: yggResult.clientToken || clientToken,
                                tokenType: 'Bearer',
                                expiresIn: tokenData.expires_in || 86400,
                                refreshToken: tokenData.refresh_token || null,
                                tokenCreatedAt: Date.now(),
                                user: {
                                  username: elybyUsername,
                                  uuid: elybyUuid
                                },
                                selectedProfile: yggProfile || {
                                  name: elybyUsername,
                                  id: elybyUuid
                                }
                              }
                            };
                            cleanup();
                            doResolve(result);
                          } catch (e) {
                            const result = {
                              success: true,
                              data: {
                                accessToken: tokenData.access_token,
                                clientToken: clientToken,
                                tokenType: 'Bearer',
                                expiresIn: tokenData.expires_in || 86400,
                                refreshToken: tokenData.refresh_token || null,
                                tokenCreatedAt: Date.now(),
                                user: {
                                  username: elybyUsername,
                                  uuid: elybyUuid
                                },
                                selectedProfile: {
                                  name: elybyUsername,
                                  id: elybyUuid
                                }
                              }
                            };
                            cleanup();
                            doResolve(result);
                          }
                        });
                      });
                      yggReq.on('error', () => {
                        const result = {
                          success: true,
                          data: {
                            accessToken: tokenData.access_token,
                            clientToken: clientToken,
                            tokenType: 'Bearer',
                            expiresIn: tokenData.expires_in || 86400,
                            refreshToken: tokenData.refresh_token || null,
                            tokenCreatedAt: Date.now(),
                            user: {
                              username: elybyUsername,
                              uuid: elybyUuid
                            },
                            selectedProfile: {
                              name: elybyUsername,
                              id: elybyUuid
                            }
                          }
                        };
                        cleanup();
                        doResolve(result);
                      });
                      yggReq.write(yggBody);
                      yggReq.end();
                    } catch (e) {
                      cleanup();
                      doResolve({ success: false, error: 'Failed to parse user info' });
                    }
                  });
                });
                userReq.on('error', (e) => { cleanup(); doResolve({ success: false, error: e.message }); });
                userReq.end();
              } else {
                cleanup();
                doResolve({ success: false, error: tokenData.error_description || tokenData.error || 'Token exchange failed' });
              }
            } catch (e) {
              cleanup();
              doResolve({ success: false, error: 'Failed to parse token response' });
            }
          });
        });
        tokenReq.on('error', (e) => { cleanup(); doResolve({ success: false, error: e.message }); });
        tokenReq.write(tokenBody.toString());
        tokenReq.end();
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<html><body style="background:#1b1b1c;color:#fff;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;font-family:sans-serif;flex-direction:column"><h2>IDK Launcher</h2><p>Waiting for authorization callback&hellip;</p></body></html>');
    });

    server.listen(REDIRECT_PORT, '127.0.0.1', () => {
      const authUrl = 'https://account.ely.by/oauth2/v1?' +
        'client_id=' + encodeURIComponent(CLIENT_ID) +
        '&redirect_uri=' + encodeURIComponent(REDIRECT_URI) +
        '&response_type=code' +
        '&scope=' + encodeURIComponent('account_info');

      shell.openExternal(authUrl);
    });

    server.on('error', (e) => {
      cleanup();
      doResolve({ success: false, error: 'Could not start redirect server: ' + e.message });
    });

    timeout = setTimeout(() => {
      cleanup();
      doResolve({ success: false, error: 'Login timed out' });
    }, 300000);
  });
});

// Launch microsoft authentication
ipcMain.handle('microsoft-authenticate', async (event) => {
  try {
    const authManager = new msmc.Auth("login");
    const xboxManager = await authManager.launch("electron", {
      width: 500,
      height: 650,
      resizable: false,
      title: "Sign in to Minecraft",
      icon: path.join(__dirname, 'logo.png')
    });

    const token = await xboxManager.getMinecraft();
    const mclcAuth = token.mclc();

    return { success: true, data: { profile: { name: mclcAuth.name }, mclcAuth } };
  } catch (e) {
    console.error("[Microsoft Auth] Error:", e);
    const rawMsg = (e && e.message) ? e.message : String(e);
    let friendly;
    if (rawMsg === 'error.gui.closed' || /gui\.closed/i.test(rawMsg)) {
      friendly = 'Login window was closed before signing in. Click Microsoft Account to try again.';
    } else if (/network|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|fetch/i.test(rawMsg)) {
      friendly = 'Could not reach Microsoft sign-in. Check your internet connection and try again.';
    } else if (/cancel/i.test(rawMsg)) {
      friendly = 'Microsoft login was cancelled.';
    } else {
      friendly = rawMsg || 'Failed to authenticate with Microsoft.';
    }
    return { success: false, error: friendly };
  }
});

ipcMain.handle('select-image-file', async (event) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Skin',
    filters: [
      { name: 'PNG Images', extensions: ['png'] }
    ],
    properties: ['openFile']
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  
  return result.filePaths[0];
});

ipcMain.handle('upload-microsoft-skin', async (event, filePath, variant) => {
  try {
    const manager = getSettingsManager();
    if (!manager || !manager.settings || !manager.settings.microsoftData || !manager.settings.microsoftData.value) {
      return { success: false, error: "Not logged in with Microsoft." };
    }
    const tokenData = manager.settings.microsoftData.value;
    const token = tokenData.mclcAuth ? tokenData.mclcAuth.access_token : null;
    if (!token) return { success: false, error: "No access token found." };

    const fs = require('fs');
    const https = require('https');
    
    return new Promise((resolve) => {
      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
      const fileData = fs.readFileSync(filePath);
      
      let postData = `--${boundary}\r\n`;
      postData += `Content-Disposition: form-data; name="variant"\r\n\r\n`;
      postData += `${variant}\r\n`;
      postData += `--${boundary}\r\n`;
      postData += `Content-Disposition: form-data; name="file"; filename="skin.png"\r\n`;
      postData += `Content-Type: image/png\r\n\r\n`;
      
      const footer = `\r\n--${boundary}--\r\n`;

      const req = https.request({
        hostname: 'api.minecraftservices.com',
        path: '/minecraft/profile/skins',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': Buffer.byteLength(postData) + fileData.length + Buffer.byteLength(footer)
        }
      }, (res) => {
        let responseBody = '';
        res.on('data', chunk => responseBody += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ success: true });
          } else {
            resolve({ success: false, error: `HTTP ${res.statusCode}: ${responseBody}` });
          }
        });
      });

      req.on('error', (e) => resolve({ success: false, error: e.message }));
      
      req.write(postData);
      req.write(fileData);
      req.write(footer);
      req.end();
    });
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('fetch-microsoft-profile', async (event) => {
  try {
    const manager = getSettingsManager();
    if (!manager || !manager.settings || !manager.settings.microsoftData || !manager.settings.microsoftData.value) {
      return { success: false, error: "Not logged in with Microsoft." };
    }
    const tokenData = manager.settings.microsoftData.value;
    const token = tokenData.mclcAuth ? tokenData.mclcAuth.access_token : null;
    if (!token) return { success: false, error: "No access token found." };

    const https = require('https');
    return new Promise((resolve) => {
      const req = https.request({
        hostname: 'api.minecraftservices.com',
        path: '/minecraft/profile',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      }, (res) => {
        let responseBody = '';
        res.on('data', chunk => responseBody += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try { resolve({ success: true, data: JSON.parse(responseBody) }); } 
            catch(e) { resolve({ success: false, error: 'Invalid JSON' }); }
          } else {
            resolve({ success: false, error: `HTTP ${res.statusCode}: ${responseBody}` });
          }
        });
      });
      req.on('error', (e) => resolve({ success: false, error: e.message }));
      req.end();
    });
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('equip-microsoft-cape', async (event, capeId) => {
  try {
    const manager = getSettingsManager();
    if (!manager || !manager.settings || !manager.settings.microsoftData || !manager.settings.microsoftData.value) {
      return { success: false, error: "Not logged in with Microsoft." };
    }
    const tokenData = manager.settings.microsoftData.value;
    const token = tokenData.mclcAuth ? tokenData.mclcAuth.access_token : null;
    if (!token) return { success: false, error: "No access token found." };

    const https = require('https');
    return new Promise((resolve) => {
      const method = capeId ? 'PUT' : 'DELETE';
      const postData = capeId ? JSON.stringify({ capeId }) : '';

      const req = https.request({
        hostname: 'api.minecraftservices.com',
        path: '/minecraft/profile/capes/active',
        method: method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (res) => {
        let responseBody = '';
        res.on('data', chunk => responseBody += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ success: true });
          } else {
            resolve({ success: false, error: `HTTP ${res.statusCode}: ${responseBody}` });
          }
        });
      });
      req.on('error', (e) => resolve({ success: false, error: e.message }));
      req.write(postData);
      req.end();
    });
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Fetch Ely.by session profile (skin URL) via Node.js to bypass browser CORS
ipcMain.handle('fetch-elyby-profile', async (event, username) => {
  return new Promise((resolve) => {
    const url = `https://skinsystem.ely.by/profile/${username}?unsigned=false`;
    https.get(url, { headers: { 'User-Agent': 'IDKLauncher/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ ok: res.statusCode === 200, data: JSON.parse(data) }); }
        catch (e) { resolve({ ok: false, data: null }); }
      });
    }).on('error', (e) => {
      resolve({ ok: false, data: null });
    });
  });
});

// Fetch any HTTP/HTTPS image as a Base64 string to bypass CORS in the renderer
ipcMain.handle('fetch-image-base64', async (event, imageUrl) => {
  return new Promise((resolve) => {
    const http = require('http');
    const client = imageUrl.startsWith('https') ? https : http;
    client.get(imageUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode !== 200) {
        resolve({ ok: false, data: null });
        return;
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const base64 = buffer.toString('base64');
        const mimeType = res.headers['content-type'] || 'image/png';
        resolve({ ok: true, data: `data:${mimeType};base64,${base64}` });
      });
    }).on('error', (e) => {
      console.error('[Image IPC] Error fetching image:', e.message);
      resolve({ ok: false, data: null });
    });
  });
});

// Auto Update G�� electron-updater with GitHub provider
const { autoUpdater } = require('electron-updater');
autoUpdater.logger = { info: (m) => console.log('[AutoUpdater]', m), warn: (m) => console.warn('[AutoUpdater]', m), error: (m) => console.error('[AutoUpdater]', m) };
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

let updateDownloaded = false;
let updateVersionInfo = null;

autoUpdater.on('update-available', (info) => {
  console.log(`[AutoUpdater] Update available: ${info.version}`);
  updateVersionInfo = info;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-available', {
      currentVersion: app.getVersion(),
      latestVersion: info.version,
      releaseNotes: info.releaseNotes || ''
    });
  }
});

autoUpdater.on('update-not-available', () => {
  console.log('[AutoUpdater] No update available');
  updateVersionInfo = null;
});

autoUpdater.on('download-progress', (progress) => {
  console.log(`[AutoUpdater] Download progress: ${Math.round(progress.percent)}%`);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-progress', {
      percent: Math.round(progress.percent),
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total
    });
  }
});

autoUpdater.on('update-downloaded', (info) => {
  console.log(`[AutoUpdater] Update downloaded: ${info.version}`);
  updateDownloaded = true;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-downloaded', { version: info.version });
  }
});

autoUpdater.on('error', (err) => {
  console.error('[AutoUpdater] Error:', err.message);
  updateVersionInfo = null;
  updateDownloaded = false;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-error', { message: err.message });
  }
});

ipcMain.handle('update:check', async () => {
  try {
    const result = await autoUpdater.checkForUpdates();
    if (result && result.downloadPromise) {
      const info = result.updateInfo;
      return {
        updateAvailable: true,
        currentVersion: app.getVersion(),
        latestVersion: info.version,
        releaseNotes: info.releaseNotes || ''
      };
    }
    return { updateAvailable: false, currentVersion: app.getVersion() };
  } catch (e) {
    console.error('[AutoUpdater] Check failed:', e.message);
    return { updateAvailable: false, error: e.message, currentVersion: app.getVersion() };
  }
});

ipcMain.handle('update:download', async () => {
  if (updateDownloaded) return { alreadyDownloaded: true };
  if (!updateVersionInfo) return { error: 'No update available to download' };
  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (e) {
    console.error('[AutoUpdater] Download failed:', e.message);
    return { error: e.message };
  }
});

ipcMain.handle('update:install', () => {
  if (updateDownloaded) {
    autoUpdater.quitAndInstall(false, true);
  }
});

function isNewerVersion(current, latest) {
  const parseParts = (v) => v.replace(/[^0-9.]/g, '').split('.').map(Number);
  const cParts = parseParts(current);
  const lParts = parseParts(latest);
  for (let i = 0; i < Math.max(cParts.length, lParts.length); i++) {
    const cNum = cParts[i] || 0;
    const lNum = lParts[i] || 0;
    if (lNum > cNum) return true;
    if (lNum < cNum) return false;
  }
  return false;
}

function isModernVersion(ver) {
  if (!ver || typeof ver !== 'string') return false;
  const match = ver.match(/^([0-9]+)\.([0-9]+)/);
  if (match) {
    const major = parseInt(match[1]);
    const minor = parseInt(match[2]);
    if (major > 1) return true;
    if (major === 1 && minor >= 20) return true;
  }
  if (ver.match(/^[0-9]{2}w/)) return true;
  return false;
}

ipcMain.on('launch-modpack', async (event, args) => {
  global.lastLaunchTime = Date.now();
  let { username, modpackId, modpackName, mcVersion, loader, loaderVersion, javaPath, maxMemory, authData, quickConnect, windowSize, globalJavaArgs, forceUpdate } = args;
  const safeSend = (channel, data) => { try { if (event.sender && !event.sender.isDestroyed()) event.sender.send(channel, data); } catch (_) {} };

  console.log(`[Launch] launch-modpack received: modpackId=${modpackId}, name=${modpackName}, version=${mcVersion}, loader=${loader}, memory=${maxMemory}, hasWindowSize=${!!windowSize}, hasQuickConnect=${!!quickConnect}, hasGlobalJavaArgs=${!!globalJavaArgs}`);

  const rootPath = getMinecraftDataPath();
  console.log(`[Launch] Root path: ${rootPath}`);

  // Use 'version-' prefix for version-specific profiles so scanProfiles (which looks for 'modpack-') doesn't pick them up as modpacks.
  const profileDirName = modpackId && modpackId.startsWith('version-') ? modpackId : `modpack-${modpackId}`;
  const profileJsonPath = path.join(rootPath, 'profiles', profileDirName, 'profile.json');
  const profilePath = path.join(rootPath, 'profiles', profileDirName);
  console.log(`[Launch] Profile dir: ${profileDirName}, path: ${profilePath}`);
  // Read profile.json as fallback for missing values only G�� trust renderer's values (from user settings) over disk.
  let profileDataFromDisk = null;
  if (fs.existsSync(profileJsonPath)) {
    try {
      let raw = fs.readFileSync(profileJsonPath, 'utf8');
      if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1); // strip BOM
      profileDataFromDisk = JSON.parse(raw);
      if ((!mcVersion || mcVersion === 'Unknown') && profileDataFromDisk.mcVersion && profileDataFromDisk.mcVersion !== 'Unknown') {
        mcVersion = profileDataFromDisk.mcVersion;
        console.log(`[Launch] Resolved mcVersion from profile.json: ${mcVersion}`);
      }
      if ((!loader || loader === 'Vanilla') && profileDataFromDisk.loader && profileDataFromDisk.loader !== 'Vanilla') {
        loader = profileDataFromDisk.loader;
        console.log(`[Launch] Resolved loader from profile.json: ${loader}`);
      }
    } catch (e) {
      console.warn('[Launch] Could not read profile.json, using frontend-provided values:', e.message);
    }
  }

  if (!isValidMcVersion(mcVersion)) {
    const detectedMcVersion = detectMcVersionFromMods(path.join(profilePath, 'mods'));
    if (detectedMcVersion) {
      mcVersion = detectedMcVersion;
      console.log(`[Launch] Detected mcVersion from mods folder: ${mcVersion}`);
    }
  }

  if (username) lastActiveUsername = username;
  const mpName = modpackName || 'Modpack';
  const loaderName = loader || 'Vanilla';

  console.log(`[Launch] Resolved: version=${mcVersion}, loader=${loaderName}, mpName=${mpName}`);

  // Accept versions that are either valid by format or already installed on disk.
  if (!isValidMcVersion(mcVersion) && !versionExistsOnDisk(rootPath, mcVersion)) {
    console.error(`[Launch] Invalid mcVersion: ${mcVersion}, no fallback on disk`);
    safeSend('launch-error', { message: `Invalid Minecraft version "${mcVersion}". This version does not exist. The modpack manifest may have incorrect metadata.`, version: mcVersion, loader: loaderName });
    return;
  }
  updateDiscordPresence(
    `Launching Modpack: ${mpName}`,
    `Minecraft ${mcVersion} (${loaderName})`,
    'icon',
    'Indkingdom Launcher',
    false,
    loaderName.toLowerCase(),
    loaderName
  );
  if (!fs.existsSync(profilePath)) fs.mkdirSync(profilePath, { recursive: true });
  // Sync profile.json with the user's selected mcVersion/loader so disk stays in sync.
  if (!modpackId?.startsWith('version-')) {
    try {
      const merged = { ...(profileDataFromDisk || {}), mcVersion, loader, id: modpackId, name: mpName };
      fs.writeFileSync(profileJsonPath, JSON.stringify(merged, null, 2), 'utf8');
    } catch (e) { /* non-fatal */ }
  }

  const maxMem = maxMemory || '4G';
  const minMem = parseInt(maxMem) >= 4 ? '2G' : '1G';
  console.log(`[Launch] Memory: max=${maxMem}, min=${minMem}`);

  let opts = {
    clientPackage: null,
    authorization: {
      access_token: '0', client_token: '0',
      uuid: '00000000-0000-0000-0000-000000000000',
      name: username, user_properties: '{}',
      meta: { type: 'mojang', demo: false }
    },
    root: rootPath,
    overrides: {
      gameDirectory: profilePath,
      cwd: profilePath,
      skipVerify: !forceUpdate
    },
    version: { number: mcVersion, type: 'release' },
    memory: { max: maxMem, min: minMem }
  };

  let isLaunchFullscreen = false;
  if (windowSize) {
    console.log(`[Launch] windowSize: fullscreen=${windowSize.fullscreen}, width=${windowSize.width}, height=${windowSize.height}, hideLauncher=${windowSize.hideLauncher}, enableOverlay=${windowSize.enableOverlay}`);
    if (windowSize.fullscreen) {
      isLaunchFullscreen = true;
      const primaryDisplay = screen.getPrimaryDisplay();
      opts.windowSize = {
        width: primaryDisplay.bounds.width,
        height: primaryDisplay.bounds.height
      };
      console.log(`[Launch] Fullscreen resolution: ${opts.windowSize.width}x${opts.windowSize.height}`);
    } else if (windowSize.width && windowSize.height) {
      opts.windowSize = {
        width: parseInt(windowSize.width),
        height: parseInt(windowSize.height)
      };
      console.log(`[Launch] Window size set: ${opts.windowSize.width}x${opts.windowSize.height}`);
    }
  } else {
    console.log(`[Launch] No windowSize provided, using MCLC default`);
  }

  if (!opts.customArgs) opts.customArgs = [];

  if (globalJavaArgs && globalJavaArgs.trim() !== '') {
    const extraArgs = globalJavaArgs.split(/\s+/).filter(x => x.trim() !== '');
    opts.customArgs.push(...extraArgs);
    console.log(`[Launch] Added global Java args: ${extraArgs.join(' ')}`);
  }

  if (quickConnect) {
    console.log(`[Launch] Quick connect: ${quickConnect.host}:${quickConnect.port || 25565}`);
    opts.server = { host: quickConnect.host };
    if (quickConnect.port) opts.server.port = quickConnect.port;
    if (isModernVersion(mcVersion)) {
      if (!opts.customLaunchArgs) {
        opts.customLaunchArgs = [];
      }
      const qpAddr = quickConnect.port
        ? `${quickConnect.host}:${quickConnect.port}`
        : quickConnect.host;
      opts.customLaunchArgs.push('--quickPlayMultiplayer', qpAddr);
      console.log(`[Launch] Added quickPlayMultiplayer arg: ${qpAddr}`);
    }
  }

  if (authData && authData.mclcAuth) {
    opts.authorization = authData.mclcAuth;
    console.log(`[Launch] Using Microsoft auth for user: ${opts.authorization.name}`);
  } else if (authData && authData.accessToken) {
    opts.authorization = {
      access_token: authData.accessToken,
      client_token: authData.clientToken,
      uuid: authData.selectedProfile.id,
      name: authData.selectedProfile.name,
      user_properties: '{}',
      meta: { type: 'mojang', demo: false }
    };
    console.log(`[Launch] Using Ely.by auth for user: ${authData.selectedProfile.name}`);
    try {
      safeSend('launch-progress', { status: 'Downloading Ely.by Injector...', percent: 50 });
      const injectorPath = await ensureAuthlibInjector(rootPath);
      if (injectorPath && fs.existsSync(injectorPath) && _isValidZip(injectorPath)) {
        const prefetched = await prefetchAuthlibMetadata();
        if (prefetched) {
          opts.customArgs.push(`-javaagent:${injectorPath}=https://authserver.ely.by@${prefetched}`);
          console.log("[Launch] Added authlib-injector with prefetched metadata.");
        } else {
          const reachable = await isAuthServerReachable();
          if (reachable) {
            opts.customArgs.push(`-javaagent:${injectorPath}=https://authserver.ely.by`);
            console.log("[Launch] Added authlib-injector (server reachable, no prefetch).");
          } else {
            console.warn("[Launch] authserver.ely.by unreachable — launching WITHOUT injector to avoid crash.");
            safeSend('launch-warning', "Ely.by auth server is unreachable. The game will launch, but Ely.by skins/auth may not work. Check your connection.");
          }
        }
      } else {
        console.warn("[Launch] authlib-injector.jar missing or invalid, skipping agent.");
        safeSend('launch-warning', "Ely.by skins may not work (injector unavailable).");
      }
    } catch (e) {
      console.warn("[Launch] Ely.by injector failed:", e.message);
      safeSend('launch-warning', "Ely.by skins may not work (injector failed).");
    }
  }
  if (javaPath && javaPath.trim() !== '') {
    opts.javaPath = javaPath;
    console.log(`[Launch] Using user-provided Java: ${javaPath}`);
  } else {
    try {
      console.log(`[Launch] Auto-installing Java for ${mcVersion}...`);
      opts.javaPath = await ensureJava(mcVersion, rootPath, loader, (progress) => {
        safeSend('launch-progress', progress);
      });
      console.log(`[Launch] Java resolved to: ${opts.javaPath}`);
    } catch (e) {
      console.error(`[Launch] Java auto-install failed:`, e.message);
      safeSend('launch-error', { message: 'Java Auto-Install Failed: ' + e.message, version: mcVersion, loader: loaderName });
      return;
    }
  }

  const loaderLC = (loader || '').toLowerCase();
  console.log(`[Launch] Loader: ${loaderLC}, version: ${loaderVersion || 'latest'}`);

  // Initialize customArgs if not already present
  if (!opts.customArgs) opts.customArgs = [];

  // Clean corrupt jars before checking for existing installations
  try { await cleanCorruptFabricJars(rootPath); } catch (e) { console.warn('[Launch] cleanCorruptFabricJars failed:', e.message); }

  if (loaderLC === 'fabric') {
    try {
      // MCLC resolves "inheritsFrom" in the Fabric JSON by reading the vanilla
      // version directory. Ensure the vanilla client JAR + JSON exist first.
      await ensureVanillaClient(mcVersion, rootPath, (p) => safeSend('launch-progress', p));
      const existing = await findExistingLoaderOnDisk(rootPath, mcVersion, 'fabric');
      if (existing) {
        opts.version.custom = existing;
        console.log(`[Launch] Found existing Fabric loader: ${existing}`);
      } else {
        safeSend('launch-progress', { status: 'Setting up Fabric...', percent: 10 });
        console.log(`[Launch] Installing Fabric for ${mcVersion}...`);
        try {
          const fabricVersion = await installFabric(mcVersion, rootPath, loaderVersion || null);
          opts.version.custom = fabricVersion;
          console.log(`[Launch] Fabric installed: ${fabricVersion}`);
        } catch (fabricErr) {
          const cached = await findExistingLoaderOnDisk(rootPath, mcVersion, 'fabric');
          if (cached) {
            console.warn(`[Launch] Fabric download failed (${fabricErr.message}), using cached ${cached}`);
            safeSend('launch-warning', `Using cached Fabric loader (download failed: ${fabricErr.message})`);
            opts.version.custom = cached;
          } else {
            throw fabricErr;
          }
        }
      }
    } catch (err) {
      console.error(`[Launch] Fabric install failed:`, err.message);
      safeSend('launch-error', { message: 'Failed to install Fabric: ' + err, version: mcVersion, loader: loaderName });
      return;
    }
  } else if (loaderLC === 'forge') {
    try {
      const existing = await findExistingLoaderOnDisk(rootPath, mcVersion, 'forge');
      if (existing) {
        opts.version.custom = existing;
        console.log(`[Launch] Found existing Forge loader: ${existing}`);
      } else {
        safeSend('launch-progress', { status: 'Installing Forge (this may take a moment)...', percent: 10 });
        console.log(`[Launch] Installing Forge for ${mcVersion}...`);
        const forgeVersionId = await installForge(mcVersion, rootPath, opts.javaPath, (p) => safeSend('launch-progress', p), loaderVersion || null);
        opts.version.custom = forgeVersionId;
        console.log(`[Launch] Forge installed: ${forgeVersionId}`);
      }
    } catch (err) {
      const isNetwork = err.message.includes('ENOTFOUND') || err.message.includes('ECONNREFUSED') || err.message.includes('ETIMEDOUT') || err.message.includes('network');
      const msg = isNetwork
        ? 'Failed to install Forge: No internet connection or Mojang servers are unreachable. Check your connection and try again.'
        : 'Failed to install Forge: ' + err.message;
      console.error(`[Launch] Forge install failed:`, err.message);
      safeSend('launch-error', { message: msg, version: mcVersion, loader: loaderName });
      return;
    }
  } else if (loaderLC === 'neoforge') {
    try {
      const existing = await findExistingLoaderOnDisk(rootPath, mcVersion, 'neoforge');
      if (existing) {
        opts.version.custom = existing;
        console.log(`[Launch] Found existing NeoForge loader: ${existing}`);
      } else {
        safeSend('launch-progress', { status: 'Installing NeoForge (this may take a moment)...', percent: 10 });
        console.log(`[Launch] Installing NeoForge for ${mcVersion}...`);
        const neoVersionId = await installNeoForge(mcVersion, rootPath, opts.javaPath, (p) => safeSend('launch-progress', p));
        opts.version.custom = neoVersionId;
        console.log(`[Launch] NeoForge installed: ${neoVersionId}`);
      }
    } catch (err) {
      console.error(`[Launch] NeoForge install failed:`, err.message);
      safeSend('launch-error', { message: 'Failed to install NeoForge: ' + err.message, version: mcVersion, loader: loaderName });
      return;
    }
  } else if (loaderLC === 'quilt') {
    try {
      await ensureVanillaClient(mcVersion, rootPath, (p) => safeSend('launch-progress', p));
      const existing = await findExistingLoaderOnDisk(rootPath, mcVersion, 'quilt');
      if (existing) {
        opts.version.custom = existing;
        console.log(`[Launch] Found existing Quilt loader: ${existing}`);
      } else {
        safeSend('launch-progress', { status: 'Setting up Quilt loader...', percent: 10 });
        console.log(`[Launch] Installing Quilt for ${mcVersion}...`);
        const quiltVersionId = await installQuilt(mcVersion, rootPath);
        opts.version.custom = quiltVersionId;
        console.log(`[Launch] Quilt installed: ${quiltVersionId}`);
      }
    } catch (err) {
      const isNetwork = err.message.includes('ENOTFOUND') || err.message.includes('ECONNREFUSED') || err.message.includes('ETIMEDOUT');
      const msg = isNetwork
        ? 'Failed to install Quilt: No internet connection or Quilt servers are unreachable. Check your connection and try again.'
        : 'Failed to install Quilt: ' + err.message;
      console.error(`[Launch] Quilt install failed:`, err.message);
      safeSend('launch-error', { message: msg, version: mcVersion, loader: loaderName });
      return;
    }
  }

  // Make Fabric/Quilt JSON self-contained by resolving inheritsFrom.
  // MCLC ignores inheritsFrom, so merging the parent JSON into the
  // loader profile ensures all libraries and the client jar URL are
  // properly resolved without depending on the parent version directory.
  if ((loaderLC === 'fabric' || loaderLC === 'quilt') && opts.version.custom) {
    resolveInheritsFrom(opts.version.custom, mcVersion, rootPath);
  }

  // Inject Forge/NeoForge specific JVM arguments (module paths, etc.)
  if (loaderLC === 'forge' || loaderLC === 'neoforge') {
    const forgeArgs = getForgeJvmArgs(rootPath, opts.version.custom);
    opts.customArgs.push(...forgeArgs);
    console.log(`[Launch] Added Forge/NeoForge JVM args: ${forgeArgs.join(' ')}`);
  }

  let outputBuffer = '';
  const launchClient = new Client();
  launchClient.on('debug', (e) => { if (isDev) console.log(`[MCLC] debug:`, e); });
  launchClient.on('progress', (e) => {
    let percent = e.task !== undefined && e.total > 0 ? Math.round((e.task / e.total) * 100) : undefined;
    const status = `Verifying ${e.type || 'files'} (${e.task}/${e.total})...`;
    if (isDev) console.log(`[MCLC] progress: ${status} ${percent !== undefined ? percent + '%' : ''}`);
    safeSend('launch-progress', { status, percent });
  });
  let dlSpeedTime1 = Date.now();
  let dlSpeedBytes1 = 0;
  let currentSpeedStr1 = "";
  let lastFileName1 = "";
  let lastFileBytes1 = 0;

  launchClient.on('download-status', (e) => {
    let percent = Math.round((e.current / e.total) * 100);
    let status = `Downloading ${e.name}...`;

    let now = Date.now();
    let timeDiff = (now - dlSpeedTime1) / 1000;
    let delta = e.current - (e.name === lastFileName1 ? lastFileBytes1 : 0);
    if (delta > 0) dlSpeedBytes1 += delta;
    lastFileName1 = e.name;
    lastFileBytes1 = e.current;

    if (timeDiff >= 0.5) {
      let speed = dlSpeedBytes1 / timeDiff;
      if (speed >= 1048576) currentSpeedStr1 = (speed / 1048576).toFixed(1) + " MB/s";
      else if (speed >= 1024) currentSpeedStr1 = (speed / 1024).toFixed(0) + " KB/s";
      else currentSpeedStr1 = speed.toFixed(0) + " B/s";
      dlSpeedTime1 = now;
      dlSpeedBytes1 = 0;
    }
    
    if (currentSpeedStr1) {
      status += ` [${currentSpeedStr1}]`;
    }

    safeSend('launch-progress', { percent, status });
  });
  launchClient.on('data', (e) => {
    const str = e.toString();
    if (isDev) console.log(`[Minecraft stdout] ${str.trim()}`);
    outputBuffer += str;
    if (outputBuffer.length > 5000) outputBuffer = outputBuffer.slice(-5000);
    const match = outputBuffer.match(/error reading (.*?\.jar)/i);
    if (match && match[1]) {
      const rawJar = match[1].trim();
      const corruptedJar = path.isAbsolute(rawJar) ? rawJar : path.resolve(rootPath, rawJar);
      const normalizedRoot = rootPath.replace(/\\/g, '/').toLowerCase();
      const normalizedJar = corruptedJar.replace(/\\/g, '/').toLowerCase();
      if (!normalizedJar.startsWith(normalizedRoot)) {
        console.warn(`[Auto-Healer] Skipping deletion: ${corruptedJar} is outside Minecraft directory`);
      } else {
        try {
          if (fs.existsSync(corruptedJar)) {
            console.log(`[Auto-Healer] Detected corrupted JAR, deleting: ${corruptedJar}`);
            fs.unlinkSync(corruptedJar);
            safeSend('launch-warning', `Corrupted file removed: ${path.basename(corruptedJar)}. Click PLAY again to redownload!`);
            outputBuffer = '';
          }
        } catch (err) {
          console.error('[Auto-Healer] Failed to delete corrupted jar', err);
        }
      }
    }
    if (outputBuffer.includes('Level is not supported by the active JRE') ||
      outputBuffer.includes('has been compiled by a more recent version') ||
      outputBuffer.includes('Error parsing or using Mixin config')) {
      console.warn(`[Auto-Healer] Java version mismatch detected, clearing java path`);
      safeSend('clear-java-path');
      outputBuffer = '';
    }
  });
  launchClient.on('close', (code, signal) => {
    console.log(`[Launch] Game process closed. Exit code: ${code}, Signal: ${signal}`);
    try { require('os').setPriority(require('os').constants.priority.PRIORITY_NORMAL); } catch(e){}
    autoCleanJunkFiles();
    if (overlayWindow) overlayWindow.close();
    // Parse crash reports on close
    try {
      const crashDir = path.join(profilePath, 'crash-reports');
      if (fs.existsSync(crashDir)) {
        const files = fs.readdirSync(crashDir)
          .filter(f => f.endsWith('.txt'))
          .map(f => ({ name: f, time: fs.statSync(path.join(crashDir, f)).mtimeMs }))
          .sort((a, b) => b.time - a.time);
        if (files.length > 0) {
          const latest = path.join(crashDir, files[0].name);
          const report = fs.readFileSync(latest, 'utf8');
          if (report.includes('Mod Loading has failed') || report.includes('Mod loading error has occurred')) {
            const missing = [];
            const regex = /Mod (\S+) requires (\S+) ([\d.+\-]+) or above\s+Currently, (\S+) is not installed/g;
            let m;
            while ((m = regex.exec(report)) !== null) {
              const dep = m[2];
              if (!missing.find(x => x.modId === dep)) {
                missing.push({ modId: dep, requiredBy: m[1], version: m[3] });
              }
            }
            if (missing.length > 0) {
              console.log(`[Launch] Detected missing mod dependencies:`, missing);
              safeSend('missing-dependencies', { missing, mcVersion });
            }
          }
        }
      }
    } catch (e) {
      console.error('[Launch] Failed to parse crash report:', e.message);
    }
    if (mainWindow) {
      if (!mainWindow.isVisible()) {
        console.log(`[Launch] Main window was hidden, restoring...`);
        if (process.env.VITE_DEV_SERVER_URL) mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
        else mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
        mainWindow.show();
      } else {
        console.log(`[Launch] Main window already visible, skipping restore`);
      }
    }
    safeSend('launch-closed', { code, signal, output: outputBuffer.slice(-2000) });
    updateDiscordPresence('In Main Menu', 'Idle in Launcher');
  });
  try {
    safeSend('launch-progress', { percent: 0, status: 'Initializing...' });
    console.log(`[Launch] Starting MCLC launch with opts:`, JSON.stringify({
      root: opts.root,
      version: opts.version,
      memory: opts.memory,
      javaPath: opts.javaPath,
      windowSize: opts.windowSize,
      customArgs: opts.customArgs,
      customLaunchArgs: opts.customLaunchArgs,
      overrides: opts.overrides,
      server: opts.server ? `${opts.server.host}:${opts.server.port || 25565}` : undefined,
    }));
    __heartbeatActive = true;
    await cleanEmptyFiles(path.join(rootPath, 'libraries'));
    await cleanEmptyFiles(path.join(rootPath, 'versions'));

    const mcProcess = await launchClient.launch(opts);
    global.isLaunchDownloading = false;
    __heartbeatActive = false;
    activeLaunchProcess = mcProcess;
    
    console.log(`[Launch] MCLC launch resolved. PID: ${mcProcess?.pid}, hasProcess: ${!!mcProcess}`);

    // CPU Priority Tuning
    if (mcProcess && mcProcess.pid) {
      try {
        require('os').setPriority(require('os').constants.priority.PRIORITY_LOW);
        try { require('child_process').exec(`powershell -Command "(Get-Process -Id ${mcProcess.pid}).PriorityClass = 'High'"`, () => {}); } catch (_) {}
      } catch (e) { console.warn('[Launch] Failed to set process priority:', e); }
    }

    // Handle process errors (spawn failure after launch)
    if (mcProcess) {
      mcProcess.on('error', (err) => {
        console.error(`[Launch] Game process error:`, err.message);
        if (activeLaunchProcess === mcProcess) {
          activeLaunchProcess = null;
        }
      });
      mcProcess.on('exit', (exitCode, exitSignal) => {
        console.log(`[Launch] Game process exit: code=${exitCode}, signal=${exitSignal}`);
      });
    }

    safeSend('game-launched');
    console.log(`[Launch] game-launched sent successfully`);
    
    if (mainWindow) {
      const hideLauncher = windowSize && windowSize.hideLauncher === true;
      if (hideLauncher) {
        console.log(`[Launch] Hiding launcher window (hideLauncher enabled)`);
        mainWindow.hide();
        setTimeout(() => {
          console.log(`[Launch] Loading about:blank to free memory`);
          mainWindow.loadURL('about:blank');
          try { if (global.gc) global.gc(); } catch(e){}
        }, 500);
      }
    }
    if (windowSize && windowSize.enableOverlay) {
      console.log(`[Launch] Creating overlay window`);
      createOverlayWindow({
        version: `Minecraft ${mcVersion}`,
        loader: loaderName,
        server: quickConnect
          ? (quickConnect.port ? `${quickConnect.host}:${quickConnect.port}` : quickConnect.host)
          : 'Singleplayer / LAN',
        username: (authData && authData.selectedProfile) ? authData.selectedProfile.name : (username || 'Player'),
        authMode: (authData && authData.accessToken) ? 'elyby' : 'offline',
        isFullscreen: isLaunchFullscreen,
        autoOpen: true
      });
    }
    updateDiscordPresence(
      `Playing Modpack: ${mpName}`,
      `Minecraft ${mcVersion} (${loaderName})`,
      'icon',
      'Indkingdom Launcher',
      true,
      loaderName.toLowerCase(),
      loaderName
    );
  } catch (err) {
    console.error(`[Launch] MCLC launch failed:`, err.message);
    console.error(`[Launch] Stack:`, err.stack);
    __heartbeatActive = false;
    activeLaunchProcess = null;
    safeSend('launch-error', { message: err.message, version: mcVersion, loader: loaderName });
    updateDiscordPresence('In Main Menu', 'Idle in Launcher');
  }
  console.log(`[Launch] launch-modpack handler complete`);
});

// Minecraft Launch IPC
ipcMain.on('launch-minecraft', async (event, args) => {
  global.lastLaunchTime = Date.now();
  const { username, version, javaPath, loader, loaderVersion, autoOptimization, performanceRenderer, maxMemory, authData, quickConnect, windowSize, globalJavaArgs, forceUpdate } = args;
  const safeSend = (channel, data) => { try { if (event.sender && !event.sender.isDestroyed()) event.sender.send(channel, data); } catch (_) {} };

  console.log(`[Launch] launch-minecraft received: version=${version}, loader=${loader}, memory=${maxMemory}, autoOptimization=${autoOptimization}, renderer=${performanceRenderer}, hasWindowSize=${!!windowSize}, hasQuickConnect=${!!quickConnect}, hasGlobalJavaArgs=${!!globalJavaArgs}`);

  if (username) lastActiveUsername = username;
  const loaderName = loader || 'Vanilla';

  // Validate version before attempting any launch
  const rootPath = getMinecraftDataPath();
  const profilePath = path.join(rootPath, 'profiles', version);
  if (!isValidMcVersion(version)) {
    const detectedVersion = detectMcVersionFromMods(path.join(profilePath, 'mods'));
    if (detectedVersion) {
      args.version = detectedVersion;
      console.log(`[Launch] Detected version from mods: ${detectedVersion}`);
    }
  }
  const launchVersion = isValidMcVersion(args.version) || versionExistsOnDisk(rootPath, args.version)
    ? args.version
    : version;
  console.log(`[Launch] Resolved launch version: ${launchVersion}`);
  if (!isValidMcVersion(launchVersion) && !versionExistsOnDisk(rootPath, launchVersion)) {
    console.error(`[Launch] Invalid version: ${launchVersion}, not on disk either`);
    safeSend('launch-error', { message: `Invalid Minecraft version "${version}". This version does not exist.`, version, loader: loaderName });
    return;
  }

  updateDiscordPresence(
    `Launching Minecraft ${launchVersion}`,
    `Mod Loader: ${loaderName}`,
    'icon',
    'Indkingdom Launcher',
    false,
    loaderName.toLowerCase(),
    loaderName
  );

  if (!fs.existsSync(profilePath)) fs.mkdirSync(profilePath, { recursive: true });

  const maxMem = maxMemory || '4G';
  const minMem = parseInt(maxMem) >= 4 ? '2G' : '1G';
  console.log(`[Launch] Memory: max=${maxMem}, min=${minMem}`);

  let opts = {
    clientPackage: null,
    authorization: {
      access_token: '0',
      client_token: '0',
      uuid: '00000000-0000-0000-0000-000000000000',
      name: username,
      user_properties: '{}',
      meta: { type: 'mojang', demo: false }
    },
    root: rootPath,
    overrides: {
      gameDirectory: profilePath,
      cwd: profilePath,
      skipVerify: !forceUpdate
    },
    version: { number: launchVersion, type: 'release' },
    memory: { max: maxMem, min: minMem }
  };

  let isLaunchFullscreen = false;
  if (windowSize) {
    console.log(`[Launch] windowSize: fullscreen=${windowSize.fullscreen}, width=${windowSize.width}, height=${windowSize.height}, hideLauncher=${windowSize.hideLauncher}, enableOverlay=${windowSize.enableOverlay}`);
    if (windowSize.fullscreen) {
      isLaunchFullscreen = true;
      const primaryDisplay = screen.getPrimaryDisplay();
      opts.windowSize = {
        width: primaryDisplay.bounds.width,
        height: primaryDisplay.bounds.height
      };
      console.log(`[Launch] Fullscreen resolution: ${opts.windowSize.width}x${opts.windowSize.height}`);
    } else if (windowSize.width && windowSize.height) {
      opts.windowSize = {
        width: parseInt(windowSize.width),
        height: parseInt(windowSize.height)
      };
      console.log(`[Launch] Window size set: ${opts.windowSize.width}x${opts.windowSize.height}`);
    }
  } else {
    console.log(`[Launch] No windowSize provided, using MCLC default`);
  }

  if (!opts.customArgs) opts.customArgs = [];

  if (globalJavaArgs && globalJavaArgs.trim() !== '') {
    const extraArgs = globalJavaArgs.split(/\s+/).filter(x => x.trim() !== '');
    opts.customArgs.push(...extraArgs);
    console.log(`[Launch] Added global Java args: ${extraArgs.join(' ')}`);
  }

  global.isLaunchDownloading = true;

  if (quickConnect) {
    console.log(`[Launch] Quick connect: ${quickConnect.host}:${quickConnect.port || 25565}`);
    opts.server = { host: quickConnect.host };
    if (quickConnect.port) opts.server.port = quickConnect.port;
    if (isModernVersion(launchVersion)) {
      if (!opts.customLaunchArgs) {
        opts.customLaunchArgs = [];
      }
      const qpAddr = quickConnect.port
        ? `${quickConnect.host}:${quickConnect.port}`
        : quickConnect.host;
      opts.customLaunchArgs.push('--quickPlayMultiplayer', qpAddr);
      console.log(`[Launch] Added quickPlayMultiplayer arg: ${qpAddr}`);
    }
  }

  if (authData && authData.accessToken) {
    opts.authorization = {
      access_token: authData.accessToken,
      client_token: authData.clientToken,
      uuid: authData.selectedProfile.id,
      name: authData.selectedProfile.name,
      user_properties: '{}',
      meta: { type: 'mojang', demo: false }
    };
    console.log(`[Launch] Using Ely.by auth for user: ${authData.selectedProfile.name}`);
    try {
      safeSend('launch-progress', { status: 'Downloading Ely.by Injector...', percent: 50 });
      const injectorPath = await ensureAuthlibInjector(rootPath);
      if (injectorPath && fs.existsSync(injectorPath) && _isValidZip(injectorPath)) {
        const prefetched = await prefetchAuthlibMetadata();
        if (prefetched) {
          opts.customArgs.push(`-javaagent:${injectorPath}=https://authserver.ely.by@${prefetched}`);
          console.log("[Launch] Added authlib-injector with prefetched metadata.");
        } else {
          const reachable = await isAuthServerReachable();
          if (reachable) {
            opts.customArgs.push(`-javaagent:${injectorPath}=https://authserver.ely.by`);
            console.log("[Launch] Added authlib-injector (server reachable, no prefetch).");
          } else {
            console.warn("[Launch] authserver.ely.by unreachable — launching WITHOUT injector to avoid crash.");
            safeSend('launch-warning', "Ely.by auth server is unreachable. The game will launch, but Ely.by skins/auth may not work. Check your connection.");
          }
        }
      } else {
        console.warn("[Launch] authlib-injector.jar missing or invalid, skipping agent.");
        safeSend('launch-warning', "Ely.by skins may not work (injector unavailable).");
      }
    } catch (e) {
      console.warn("[Launch] Ely.by injector failed:", e.message);
      safeSend('launch-warning', "Ely.by skins may not work (injector failed).");
    }
  }

  if (javaPath && javaPath.trim() !== '') {
    opts.javaPath = javaPath;
    console.log(`[Launch] Using user-provided Java: ${javaPath}`);
  } else {
    try {
      console.log(`[Launch] Auto-installing Java for ${launchVersion}...`);
      opts.javaPath = await ensureJava(launchVersion, rootPath, loader, (progress) => {
        safeSend('launch-progress', progress);
      });
      console.log(`[Launch] Java resolved to: ${opts.javaPath}`);
    } catch (e) {
      console.error(`[Launch] Java auto-install failed:`, e.message);
      safeSend('launch-error', { message: 'Java Auto-Install Failed: ' + e.message, version: launchVersion, loader: loaderName });
      return;
    }
  }

  // Clean corrupt jars before checking for existing installations
  try { await cleanCorruptFabricJars(rootPath); } catch (e) { console.warn('[Launch] cleanCorruptFabricJars failed:', e.message); }

  // Handle Mod Loader
  try {
    const loaderNameLC = (loader || '').toLowerCase();
    console.log(`[Launch] Loader: ${loaderNameLC}, autoOptimization=${autoOptimization}`);

    if (!opts.customArgs) opts.customArgs = [];

    if (loaderNameLC === 'fabric') {
      // MCLC resolves "inheritsFrom" in the Fabric JSON by reading the vanilla
      // version directory. Ensure the vanilla client JAR + JSON exist first.
      try {
        await ensureVanillaClient(launchVersion, rootPath, (p) => safeSend('launch-progress', p));
      } catch (ve) {
        const isNetwork = ve.message.includes('ENOTFOUND') || ve.message.includes('ECONNREFUSED') || ve.message.includes('ETIMEDOUT');
        const msg = isNetwork
          ? `Failed to download Minecraft ${launchVersion} client: No internet connection or Mojang servers are unreachable. Check your connection and try again.`
          : `Failed to download Minecraft ${launchVersion} client: ${ve.message}`;
        console.error(`[Launch] ensureVanillaClient failed:`, ve.message);
        safeSend('launch-error', { message: msg, version: launchVersion, loader: loaderName });
        return;
      }
      const existing = await findExistingLoaderOnDisk(rootPath, launchVersion, 'fabric');
      if (existing) {
        opts.version.custom = existing;
        console.log(`[Launch] Found existing Fabric loader: ${existing}`);
      } else {
        safeSend('launch-progress', { status: 'Downloading Fabric loader...', percent: 10 });
        try {
          console.log(`[Launch] Installing Fabric for ${launchVersion}...`);
          const fabricVersion = await installFabric(launchVersion, rootPath, loaderVersion || null);
          opts.version.custom = fabricVersion;
          console.log(`[Launch] Fabric installed: ${fabricVersion}`);
        } catch (fabricErr) {
          // Network/API failure G�� fall back to any cached Fabric loader on disk
          const cached = await findExistingLoaderOnDisk(rootPath, launchVersion, 'fabric');
          if (cached) {
            console.warn(`[Launch] Fabric download failed (${fabricErr.message}), using cached ${cached}`);
            safeSend('launch-warning', `Using cached Fabric loader (download failed: ${fabricErr.message})`);
            opts.version.custom = cached;
          } else {
            const isNetwork = fabricErr.message.includes('ENOTFOUND') || fabricErr.message.includes('ECONNREFUSED') || fabricErr.message.includes('ETIMEDOUT');
            const isBadVersion = fabricErr.message.includes('status 400') || fabricErr.message.includes('status 404');
            const msg = isNetwork
              ? `Failed to install Fabric: No internet connection or Fabric servers are unreachable. Check your connection and try again.`
              : isBadVersion
                ? `Failed to install Fabric: Minecraft ${launchVersion} is not supported by Fabric, or the loader version is invalid. Try selecting a different MC version.`
                : `Failed to install Fabric: ${fabricErr.message}`;
            console.error(`[Launch] Fabric install failed:`, fabricErr.message);
            safeSend('launch-error', { message: msg, version: launchVersion, loader: loaderName });
            return;
          }
        }
      }

      if (autoOptimization) {
        const rendererPref = performanceRenderer || 'sodium';
        const modsPath = path.join(profilePath, 'mods');
        const hasMod = (keyword) => fs.existsSync(modsPath) && fs.readdirSync(modsPath).some(f => f.toLowerCase().includes(keyword));

        if (rendererPref === 'sodium') {
          safeSend('launch-progress', { status: 'Checking Sodium & Iris...', percent: 20 });
          // Clean up conflicting VulkanMod
          if (fs.existsSync(modsPath)) {
            fs.readdirSync(modsPath).forEach(file => {
              if (file.toLowerCase().includes('vulkanmod')) {
                try { fs.unlinkSync(path.join(modsPath, file)); } catch (e) { }
              }
            });
          }
          const needSodium = !hasMod('sodium');
          const needIris = !hasMod('iris');
          
          if (needSodium || needIris) {
            safeSend('launch-progress', { status: 'Downloading Sodium & Iris...', percent: 20 });
            const [sodiumInstalled] = await Promise.all([
              needSodium ? installSodium(launchVersion, profilePath) : Promise.resolve(true),
              needIris ? installIris(launchVersion, profilePath) : Promise.resolve(true)
            ]);
            if (!sodiumInstalled && needSodium) {
              safeSend('launch-warning', `Sodium is not available for Minecraft ${launchVersion}. The game will launch without it.`);
            }
          }
        } else if (rendererPref === 'vulkan') {
          safeSend('launch-progress', { status: 'Checking VulkanMod...', percent: 20 });
          // Clean up conflicting Sodium/Iris
          if (fs.existsSync(modsPath)) {
            fs.readdirSync(modsPath).forEach(file => {
              const lFile = file.toLowerCase();
              if (lFile.includes('sodium') || lFile.includes('iris')) {
                try { fs.unlinkSync(path.join(modsPath, file)); } catch (e) { }
              }
            });
          }
          if (!hasMod('vulkanmod')) {
            safeSend('launch-progress', { status: 'Downloading VulkanMod...', percent: 20 });
            const vulkanInstalled = await installVulkanMod(launchVersion, profilePath);
            if (!vulkanInstalled) {
              safeSend('launch-warning', `VulkanMod is not available for Minecraft ${launchVersion}. The game will launch without it.`);
            }
          }
        }
      }
    } else if (loaderNameLC === 'forge') {
      try {
        const existing = await findExistingLoaderOnDisk(rootPath, launchVersion, 'forge');
        if (existing) {
          opts.version.custom = existing;
          console.log(`[Launch] Found existing Forge loader: ${existing}`);
        } else {
          safeSend('launch-progress', { status: 'Installing Forge (this may take a moment)...', percent: 10 });
          console.log(`[Launch] Installing Forge for ${launchVersion}...`);
          const forgeVersionId = await installForge(launchVersion, rootPath, opts.javaPath, (p) => safeSend('launch-progress', p));
          opts.version.custom = forgeVersionId;
          console.log(`[Launch] Forge installed: ${forgeVersionId}`);
        }
      } catch (err) {
        const isNetwork = err.message.includes('ENOTFOUND') || err.message.includes('ECONNREFUSED') || err.message.includes('ETIMEDOUT');
        const msg = isNetwork
          ? 'Failed to install Forge: No internet connection or Mojang servers are unreachable. Check your connection and try again.'
          : 'Failed to install Forge: ' + err.message;
        console.error(`[Launch] Forge install failed:`, err.message);
        safeSend('launch-error', { message: msg, version: launchVersion, loader: loaderName });
        return;
      }
    } else if (loaderNameLC === 'neoforge') {
      try {
        const existing = await findExistingLoaderOnDisk(rootPath, launchVersion, 'neoforge');
        if (existing) {
          opts.version.custom = existing;
          console.log(`[Launch] Found existing NeoForge loader: ${existing}`);
        } else {
          safeSend('launch-progress', { status: 'Installing NeoForge (this may take a moment)...', percent: 10 });
          console.log(`[Launch] Installing NeoForge for ${launchVersion}...`);
          const neoVersionId = await installNeoForge(launchVersion, rootPath, opts.javaPath, (p) => safeSend('launch-progress', p));
          opts.version.custom = neoVersionId;
          console.log(`[Launch] NeoForge installed: ${neoVersionId}`);
        }
      } catch (err) {
        const isNetwork = err.message.includes('ENOTFOUND') || err.message.includes('ECONNREFUSED') || err.message.includes('ETIMEDOUT');
        const msg = isNetwork
          ? 'Failed to install NeoForge: No internet connection or NeoForge servers are unreachable. Check your connection and try again.'
          : 'Failed to install NeoForge: ' + err.message;
        console.error(`[Launch] NeoForge install failed:`, err.message);
        safeSend('launch-error', { message: msg, version: launchVersion, loader: loaderName });
        return;
      }
    } else if (loaderNameLC === 'quilt') {
      try {
        await ensureVanillaClient(launchVersion, rootPath, (p) => safeSend('launch-progress', p));
        const existing = await findExistingLoaderOnDisk(rootPath, launchVersion, 'quilt');
        if (existing) {
          opts.version.custom = existing;
          console.log(`[Launch] Found existing Quilt loader: ${existing}`);
        } else {
          safeSend('launch-progress', { status: 'Setting up Quilt loader...', percent: 10 });
          console.log(`[Launch] Installing Quilt for ${launchVersion}...`);
          const quiltVersionId = await installQuilt(launchVersion, rootPath);
          opts.version.custom = quiltVersionId;
          console.log(`[Launch] Quilt installed: ${quiltVersionId}`);
        }
      } catch (err) {
        const isNetwork = err.message.includes('ENOTFOUND') || err.message.includes('ECONNREFUSED') || err.message.includes('ETIMEDOUT');
        const msg = isNetwork
          ? 'Failed to install Quilt: No internet connection or Quilt servers are unreachable. Check your connection and try again.'
          : 'Failed to install Quilt: ' + err.message;
        console.error(`[Launch] Quilt install failed:`, err.message);
        safeSend('launch-error', { message: msg, version: launchVersion, loader: loaderName });
        return;
      }
    }

    // Make Fabric/Quilt JSON self-contained by resolving inheritsFrom.
    if ((loaderNameLC === 'fabric' || loaderNameLC === 'quilt') && opts.version.custom) {
      resolveInheritsFrom(opts.version.custom, launchVersion, rootPath);
    }

    // Inject Forge/NeoForge specific JVM arguments (module paths, etc.)
    if (loaderNameLC === 'forge' || loaderNameLC === 'neoforge') {
      const forgeArgs = getForgeJvmArgs(rootPath, opts.version.custom);
      opts.customArgs.push(...forgeArgs);
      console.log(`[Launch] Added Forge/NeoForge JVM args: ${forgeArgs.join(' ')}`);
    }
  } catch (err) {
    const errMsg = typeof err === 'string' ? err : (err.message || String(err));
    console.error(`[Launch] Loader install failed:`, errMsg);
    safeSend('launch-error', { message: 'Failed to install mod loader: ' + errMsg, version: launchVersion, loader: loaderName });
    return;
  }

  // --- Version-launch auto-healing + close handler ---
  let outputBuffer = '';
  const launchClient = new Client();
  launchClient.on('debug', (e) => { if (isDev) console.log(`[MCLC] debug:`, e); });
  launchClient.on('progress', (e) => {
    let statusText = `Verifying ${e.type || 'files'}...`;
    let percent;
    if (e.task !== undefined && e.total !== undefined && e.total > 0) {
      percent = Math.round((e.task / e.total) * 100);
      statusText = `Verifying ${e.type || 'files'} (${e.task}/${e.total})...`;
    }
    console.log(`[MCLC] progress: ${statusText} ${percent !== undefined ? percent + '%' : ''}`);
    safeSend('launch-progress', { status: statusText, percent });
  });
  let dlSpeedTime2 = Date.now();
  let dlSpeedBytes2 = 0;
  let currentSpeedStr2 = "";
  let lastFileName2 = "";
  let lastFileBytes2 = 0;

  launchClient.on('download-status', (e) => {
    let percent = Math.round((e.current / e.total) * 100);
    let status = `Downloading ${e.name}...`;

    let now = Date.now();
    let timeDiff = (now - dlSpeedTime2) / 1000;
    let delta = e.current - (e.name === lastFileName2 ? lastFileBytes2 : 0);
    if (delta > 0) dlSpeedBytes2 += delta;
    lastFileName2 = e.name;
    lastFileBytes2 = e.current;

    if (timeDiff >= 0.5) {
      let speed = dlSpeedBytes2 / timeDiff;
      if (speed >= 1048576) currentSpeedStr2 = (speed / 1048576).toFixed(1) + " MB/s";
      else if (speed >= 1024) currentSpeedStr2 = (speed / 1024).toFixed(0) + " KB/s";
      else currentSpeedStr2 = speed.toFixed(0) + " B/s";
      dlSpeedTime2 = now;
      dlSpeedBytes2 = 0;
    }
    
    if (currentSpeedStr2) {
      status += ` [${currentSpeedStr2}]`;
    }

    safeSend('launch-progress', { percent, status });
  });
  launchClient.on('data', (e) => {
    const str = e.toString();
    if (isDev) console.log(`[Minecraft stdout] ${str.trim()}`);
    outputBuffer += str;
    if (outputBuffer.length > 5000) outputBuffer = outputBuffer.slice(-5000);
    const match = outputBuffer.match(/error reading (.*?\.jar)/i);
    if (match && match[1]) {
      const rawJar = match[1].trim();
      const corruptedJar = path.isAbsolute(rawJar) ? rawJar : path.resolve(rootPath, rawJar);
      const normalizedRoot = rootPath.replace(/\\/g, '/').toLowerCase();
      const normalizedJar = corruptedJar.replace(/\\/g, '/').toLowerCase();
      if (!normalizedJar.startsWith(normalizedRoot)) {
        console.warn(`[Auto-Healer] Skipping deletion: ${corruptedJar} is outside Minecraft directory`);
      } else {
        try {
          if (fs.existsSync(corruptedJar)) {
            console.log(`[Auto-Healer] Detected corrupted JAR, deleting: ${corruptedJar}`);
            fs.unlinkSync(corruptedJar);
            safeSend('launch-warning', `Corrupted file removed: ${path.basename(corruptedJar)}. Click PLAY again to redownload!`);
            outputBuffer = '';
          }
        } catch (err) {
          console.error('[Auto-Healer] Failed to delete corrupted jar', err);
        }
      }
    }
    if (outputBuffer.includes('Level is not supported by the active JRE') ||
      outputBuffer.includes('has been compiled by a more recent version') ||
      outputBuffer.includes('Error parsing or using Mixin config')) {
      console.warn(`[Auto-Healer] Java version mismatch detected, clearing java path`);
      safeSend('clear-java-path');
      outputBuffer = '';
    }
  });
  launchClient.on('close', (code, signal) => {
    console.log(`[Launch] Game process closed. Exit code: ${code}, Signal: ${signal}`);
    try { require('os').setPriority(require('os').constants.priority.PRIORITY_NORMAL); } catch(e){}
    autoCleanJunkFiles();
    if (mainWindow) {
      if (!mainWindow.isVisible()) {
        console.log(`[Launch] Main window was hidden, restoring...`);
        if (process.env.VITE_DEV_SERVER_URL) mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
        else mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
        mainWindow.show();
      } else {
        console.log(`[Launch] Main window already visible, skipping restore`);
      }
    }
    try {
      const crashDir = path.join(profilePath, 'crash-reports');
      if (fs.existsSync(crashDir)) {
        const files = fs.readdirSync(crashDir)
          .filter(f => f.endsWith('.txt'))
          .map(f => ({ name: f, time: fs.statSync(path.join(crashDir, f)).mtimeMs }))
          .sort((a, b) => b.time - a.time);
        if (files.length > 0) {
          const latest = path.join(crashDir, files[0].name);
          const report = fs.readFileSync(latest, 'utf8');
          if (report.includes('Mod Loading has failed') || report.includes('Mod loading error has occurred')) {
            const missing = [];
            const regex = /Mod (\S+) requires (\S+) ([\d.+\-]+) or above\s+Currently, (\S+) is not installed/g;
            let m;
            while ((m = regex.exec(report)) !== null) {
              const dep = m[2];
              if (!missing.find(x => x.modId === dep)) {
                missing.push({ modId: dep, requiredBy: m[1], version: m[3] });
              }
            }
            if (missing.length > 0) {
              console.log(`[Launch] Detected missing mod dependencies:`, missing);
              safeSend('missing-dependencies', { missing, mcVersion: launchVersion });
            }
          }
        }
      }
    } catch (e) {
      console.error('[Launch] Failed to parse crash report:', e.message);
    }
    if (overlayWindow) overlayWindow.close();
    safeSend('launch-closed', { code, signal, output: outputBuffer.slice(-2000) });
    updateDiscordPresence('In Main Menu', 'Idle in Launcher');
  });

  try {
    safeSend('launch-progress', { percent: 0, status: 'Initializing...' });
    console.log(`[Launch] Starting MCLC launch with opts:`, JSON.stringify({
      root: opts.root,
      version: opts.version,
      memory: opts.memory,
      javaPath: opts.javaPath,
      windowSize: opts.windowSize,
      customArgs: opts.customArgs,
      customLaunchArgs: opts.customLaunchArgs,
      overrides: opts.overrides,
      server: opts.server ? `${opts.server.host}:${opts.server.port || 25565}` : undefined,
    }));
    __heartbeatActive = true;
    await cleanEmptyFiles(path.join(rootPath, 'libraries'));
    await cleanEmptyFiles(path.join(rootPath, 'versions'));

    if (!global.isLaunchDownloading) {
      console.warn(`[Launch] Launch was cancelled before MCLC started.`);
      return;
    }
    const mcProcess = await launchClient.launch(opts);
    if (!global.isLaunchDownloading) {
      console.warn(`[Launch] Launch was cancelled during MCLC download.`);
      if (mcProcess && typeof mcProcess.kill === 'function') mcProcess.kill();
      return;
    }
    activeLaunchProcess = mcProcess;
    __heartbeatActive = false;
    global.isLaunchDownloading = false;

    console.log(`[Launch] MCLC launch resolved. PID: ${mcProcess?.pid}, hasProcess: ${!!mcProcess}`);
    
    // CPU Priority Tuning
    if (mcProcess && mcProcess.pid) {
      try {
        require('os').setPriority(require('os').constants.priority.PRIORITY_LOW);
        try { require('child_process').exec(`powershell -Command "(Get-Process -Id ${mcProcess.pid}).PriorityClass = 'High'"`, () => {}); } catch (_) {}
      } catch (e) { console.warn('[Launch] Failed to set process priority:', e); }
    }

    // Handle process errors (spawn failure after launch)
    if (mcProcess) {
      mcProcess.on('error', (err) => {
        console.error(`[Launch] Game process error:`, err.message);
        if (activeLaunchProcess === mcProcess) {
          activeLaunchProcess = null;
        }
      });
      mcProcess.on('exit', (exitCode, exitSignal) => {
        console.log(`[Launch] Game process exit: code=${exitCode}, signal=${exitSignal}`);
      });
    }

    safeSend('game-launched');
    console.log(`[Launch] game-launched sent successfully`);
    
    if (mainWindow) {
      const hideLauncher = windowSize && windowSize.hideLauncher === true;
      if (hideLauncher) {
        console.log(`[Launch] Hiding launcher window (hideLauncher enabled)`);
        mainWindow.hide();
        setTimeout(() => {
          console.log(`[Launch] Loading about:blank to free memory`);
          mainWindow.loadURL('about:blank');
          try { if (global.gc) global.gc(); } catch(e){}
        }, 500);
      }
    }
    if (windowSize && windowSize.enableOverlay) {
      console.log(`[Launch] Creating overlay window`);
      createOverlayWindow({
        version: `Minecraft ${launchVersion}`,
        loader: loaderName,
        server: quickConnect
          ? (quickConnect.port ? `${quickConnect.host}:${quickConnect.port}` : quickConnect.host)
          : 'Singleplayer / LAN',
        username: (authData && authData.selectedProfile) ? authData.selectedProfile.name : (username || 'Player'),
        authMode: (authData && authData.accessToken) ? 'elyby' : 'offline',
        isFullscreen: isLaunchFullscreen,
        autoOpen: true
      });
    }
    updateDiscordPresence(
      `Playing Minecraft ${launchVersion}`,
      `Mod Loader: ${loaderName}`,
      'icon',
      'Indkingdom Launcher',
      true,
      loaderName.toLowerCase(),
      loaderName
    );
  } catch (err) {
    console.error(`[Launch] MCLC launch failed:`, err.message);
    console.error(`[Launch] Stack:`, err.stack);
    __heartbeatActive = false;
    activeLaunchProcess = null;
    safeSend('launch-error', { message: err.message, version, loader: loaderName });
    updateDiscordPresence('In Main Menu', 'Idle in Launcher');
  }
});

// Helper Functions
// Check if a version string looks like a valid Minecraft version (not a modpack version)
function isValidMcVersion(version) {
  if (!version || typeof version !== 'string') return false;
  // Minecraft release pattern: 1.x or 1.x.y (e.g. 1.20, 1.20.4, 1.21.1)
  // Snapshots: 24w14a, 25w03a
  // Snapshots (newer format): 1.21-rc1, etc.
  const releasePattern = /^\d+\.\d+(\.\d+)?$/;
  const snapshotPattern = /^\d{2}w\d{2}[a-z]$/i;
  return releasePattern.test(version) || snapshotPattern.test(version);
}

function versionExistsOnDisk(rootPath, version) {
  if (!rootPath || !version) return false;
  try {
    const versionDir = path.join(rootPath, 'versions', version);
    const versionJsonPath = path.join(versionDir, `${version}.json`);
    const versionJarPath = path.join(versionDir, `${version}.jar`);
    return fs.existsSync(versionDir) && (fs.existsSync(versionJsonPath) || fs.existsSync(versionJarPath));
  } catch {
    return false;
  }
}

function detectMcVersionFromMods(modsPath) {
  if (!modsPath || !fs.existsSync(modsPath)) return null;
  const mods = fs.readdirSync(modsPath).filter(f => f.endsWith('.jar'));
  const versionPatterns = [
    /[_\-+]mc([0-9]+\.[0-9]+(?:\.[0-9]+)?)/i,
    /[_\-+]([0-9]+\.[0-9]+\.[0-9]+)[_\-+.]/,
    /[_\-+]([0-9]+\.[0-9]+\.[0-9]+)$/i,
    /[_\-+]([0-9]+\.[0-9]+)[_\-+]/,
  ];
  const versionCounts = {};
  for (const mod of mods) {
    for (const pattern of versionPatterns) {
      const match = mod.match(pattern);
      if (match) {
        const v = match[1];
        if (isValidMcVersion(v)) {
          versionCounts[v] = (versionCounts[v] || 0) + 1;
        }
        break;
      }
    }
  }
  const versions = Object.keys(versionCounts);
  if (versions.length === 0) return null;
  const filtered = versions.filter(v => !versions.some(other => other !== v && other.startsWith(v + '.')));
  const sorted = filtered
    .map(v => [v, versionCounts[v]])
    .sort((a, b) => b[1] - a[1]);
  return sorted.length > 0 ? sorted[0][0] : null;
}

async function prefetchAuthlibMetadata() {
  return new Promise((resolve) => {
    const url = 'https://authserver.ely.by';
    const req = https.get(url, { timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode === 200 && data) {
          try {
            const buf = Buffer.from(data, 'utf-8');
            resolve(buf.toString('base64'));
            return;
          } catch (_) {}
        }
        resolve(null);
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

async function isAuthServerReachable() {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = https.get('https://authserver.ely.by', { timeout: 5000 }, (res) => {
      res.resume();
      resolve(res.statusCode !== undefined && res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

async function ensureAuthlibInjector(rootPath) {
  const libPath = path.join(rootPath, 'authlib-injector.jar');
  if (fs.existsSync(libPath) && _isValidZip(libPath) && fs.statSync(libPath).size >= 50000) {
    return libPath;
  }

  if (fs.existsSync(libPath)) try { fs.unlinkSync(libPath); } catch {}

  if (!fs.existsSync(rootPath)) {
    fs.mkdirSync(rootPath, { recursive: true });
  }

  const directUrls = [
    'https://github.com/yushijinhun/authlib-injector/releases/download/v1.2.7/authlib-injector-1.2.7.jar',
    'https://github.com/yushijinhun/authlib-injector/releases/download/v1.2.5/authlib-injector-1.2.5.jar'
  ];

  for (const url of directUrls) {
    try {
      await new Promise((resolve, reject) => {
        downloadFile(url, libPath, resolve, reject);
      });
      if (_isValidZip(libPath) && fs.statSync(libPath).size >= 50000) {
        console.log(`[Injector] Successfully downloaded from ${url}`);
        return libPath;
      }
      console.warn(`[Injector] Downloaded JAR failed validation from ${url}`);
      try { fs.unlinkSync(libPath); } catch {}
    } catch (err) {
      console.warn(`[Injector] Direct download failed for ${url}:`, err.message);
    }
  }

  return new Promise((resolve, reject) => {
    https.get('https://api.github.com/repos/yushijinhun/authlib-injector/releases/latest', { headers: { 'User-Agent': 'IDKLauncher/1.0' } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const asset = json.assets.find(a => a.name.endsWith('.jar'));
          if (!asset) return reject(new Error('No authlib-injector jar found'));
          if (fs.existsSync(libPath)) try { fs.unlinkSync(libPath); } catch {}
          downloadFile(asset.browser_download_url, libPath, () => {
            if (_isValidZip(libPath) && fs.statSync(libPath).size >= 50000) {
              console.log(`[Injector] Successfully downloaded from GitHub API`);
              resolve(libPath);
            } else {
              try { fs.unlinkSync(libPath); } catch {}
              reject(new Error('Downloaded authlib-injector.jar failed integrity check'));
            }
          }, reject);
        } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function getRequiredJavaVersion(mcVersion, loader) {
  // Extract the minor version ONLY from legacy "1.x.x" format (e.g., 21 from "1.21.4").
  // The regex is anchored to ^ so "26.1.2" does NOT falsely match "1.2".
  // If the version doesn't start with "1." (modern format like 26.x.x, snapshots, etc),
  // default to 999 which forces the latest Java.
  const match = (mcVersion || '').match(/^1\.(\d+)/);
  const minor = match ? parseInt(match[1], 10) : 999;

  // Modern Minecraft (26.x+) requires Java 25
  if (minor >= 999) return 25; // Non-1.x versions (e.g. 26.1.2) G�� Java 25

  if (minor >= 21) return 21; // 1.21+ G�� Java 21
  if (mcVersion === '1.20.5' || mcVersion === '1.20.6') return 21; // 1.20.5/1.20.6 require Java 21
  if (minor >= 17) return 17; // 1.17 to 1.20.4 G�� Java 17
  return 8; // 1.16.5 and below G�� Java 8
}

async function ensureJava(mcVersion, rootPath, loader, progressCallback) {
  const javaVersion = getRequiredJavaVersion(mcVersion, loader);
  const runtimesPath = path.join(rootPath, 'runtimes');
  if (!fs.existsSync(runtimesPath)) fs.mkdirSync(runtimesPath, { recursive: true });

  const jreFolder = path.join(runtimesPath, `jre-${javaVersion}`);
  const javaExe = path.join(jreFolder, 'bin', 'java.exe');

  if (fs.existsSync(javaExe)) return javaExe; // Already downloaded!

  const zipPath = path.join(runtimesPath, `jre-${javaVersion}.zip`);
  const apiUrl = `https://api.adoptium.net/v3/binary/latest/${javaVersion}/ga/windows/x64/jre/hotspot/normal/eclipse`;

  progressCallback({ status: `Downloading Java ${javaVersion}...`, percent: 0 });

  await new Promise((resolve, reject) => {
    let downloaded = 0;
    function downloadJava(url, dest, depth = 0) {
      if (depth > 5) return reject(new Error('Too many redirects'));
      https.get(url, (r) => {
        if ([301, 302, 303, 307, 308].includes(r.statusCode)) {
          return downloadJava(r.headers.location, dest, depth + 1);
        }
        if (r.statusCode !== 200) return reject(new Error(`Download failed: ${r.statusCode}`));

        const total = parseInt(r.headers['content-length'] || '0', 10);
        const file = fs.createWriteStream(dest);

        r.on('data', (chunk) => {
          downloaded += chunk.length;
          if (total > 0) {
            const percent = Math.round((downloaded / total) * 100);
            progressCallback({ status: `Downloading Java ${javaVersion}...`, percent: Math.min(percent, 99) });
          }
        });

        r.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
        file.on('error', reject);
      }).on('error', reject);
    }
    downloadJava(apiUrl, zipPath);
  });

  progressCallback({ status: `Extracting Java ${javaVersion}... (This may take a minute)`, percent: 100 });

  const tempExt = path.join(runtimesPath, `temp-${javaVersion}`);
  if (fs.existsSync(tempExt)) fs.rmSync(tempExt, { recursive: true, force: true });
  fs.mkdirSync(tempExt, { recursive: true });

  try {
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(tempExt, true);

    const extractedDirs = fs.readdirSync(tempExt);
    if (extractedDirs.length > 0) {
      const innerDir = path.join(tempExt, extractedDirs[0]);
      fs.renameSync(innerDir, jreFolder);
    }

    fs.rmSync(tempExt, { recursive: true, force: true });
    fs.unlinkSync(zipPath);

    if (fs.existsSync(javaExe)) return javaExe;
    throw new Error('java.exe not found after extraction');
  } catch (err) {
    throw new Error(`Extraction failed: ${err.message}`);
  }
}

function autoCleanJunkFiles() {
  try {
    const rootPath = getMinecraftDataPath();
    const pathsToClean = [
      path.join(rootPath, 'versions'),
      path.join(app.getPath('userData'), 'temp'),
      path.join(app.getPath('userData'), 'downloads', 'cache')
    ];
    for (const dir of pathsToClean) {
      if (!fs.existsSync(dir)) continue;
      const walk = (d) => {
        for (const file of fs.readdirSync(d)) {
          const full = path.join(d, file);
          const stat = fs.statSync(full);
          if (stat.isDirectory()) walk(full);
          else if (file.endsWith('.part') || file.endsWith('.tmp')) {
            try { fs.unlinkSync(full); } catch(e){}
          }
        }
      };
      walk(dir);
    }
  } catch(e) { console.warn('Cleanup failed:', e); }
}

async function cleanEmptyFiles(dir) {
  if (!fs.existsSync(dir)) return;
  const files = await fs.promises.readdir(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = await fs.promises.stat(fullPath);
    if (stat.isDirectory()) {
      await cleanEmptyFiles(fullPath);
    } else if (stat.isFile() && stat.size === 0) {
      try { await fs.promises.unlink(fullPath); } catch (e) { }
    }
  }
}

// Patch existing Fabric version JSONs to remove duplicate fabric-loader library entry.
// MCLC already adds the version jar to the classpath; having fabric-loader in the
// libraries list too causes "duplicate fabric loader classes found on classpath" crash.

// Remove corrupt .jar files from Fabric version folders.
// A jar is considered corrupt if it's missing, too small, not a valid ZIP,
// or doesn't contain the Fabric loader class.
async function cleanCorruptFabricJars(dataPath) {
  // Check the real loader jars in libraries/net/fabricmc/fabric-loader/
  const libDir = path.join(dataPath, 'libraries', 'net', 'fabricmc', 'fabric-loader');
  if (fs.existsSync(libDir)) {
    for (const ver of await fs.promises.readdir(libDir)) {
      const jarPath = path.join(libDir, ver, `fabric-loader-${ver}.jar`);
      if (!fs.existsSync(jarPath)) continue;
      if (!await _isValidZipAsync(jarPath)) {
        try { await fs.promises.unlink(jarPath); } catch (_) {}
      }
    }
  }
  // Also check versions/fabric-loader-*/ for structural corruption (these are MC
  // client jars renamed by MCLC, NOT the actual Fabric loader G�� so only check ZIP
  // validity, NOT content marker "net/fabricmc/loader")
  const versionsDir = path.join(dataPath, 'versions');
  if (!fs.existsSync(versionsDir)) return;
  for (const entry of await fs.promises.readdir(versionsDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('fabric-loader-')) continue;
    const jarPath = path.join(versionsDir, entry.name, `${entry.name}.jar`);
    if (!fs.existsSync(jarPath)) continue;
    if (!await _isValidZipAsync(jarPath)) {
      try { await fs.promises.unlink(jarPath); } catch (_) {}
    }
  }
}

function _isValidZip(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size < 4) return false;
    const fd = fs.openSync(filePath, 'r');
    const header = Buffer.alloc(4);
    try { fs.readSync(fd, header, 0, 4, 0); } finally { fs.closeSync(fd); }
    return header[0] === 0x50 && header[1] === 0x4b;
  } catch { return false; }
}

function _isValidJar(filePath) {
  try {
    if (!_isValidZip(filePath)) return false;
    const stat = fs.statSync(filePath);
    if (stat.size < 50000) return false;
    const fd = fs.openSync(filePath, 'r');
    const checkLen = Math.min(stat.size, 1024);
    const head = Buffer.alloc(checkLen);
    try { fs.readSync(fd, head, 0, checkLen, 0); } finally { fs.closeSync(fd); }
    const headStr = head.toString('utf8', 0, Math.min(checkLen, 200));
    if (headStr.includes('<!DOCTYPE') || headStr.includes('<html')) {
      console.warn(`[Injector] ${filePath} is an HTML page, not a JAR`);
      return false;
    }
    return true;
  } catch (e) {
    console.warn(`[Injector] Validation error for ${filePath}:`, e.message);
    return false;
  }
}

async function _isValidZipAsync(filePath) {
  try {
    const stat = await fs.promises.stat(filePath);
    if (stat.size < 4) return false;
    const fd = await fs.promises.open(filePath, 'r');
    const header = Buffer.alloc(4);
    try { await fd.read(header, 0, 4, 0); } finally { await fd.close(); }
    return header[0] === 0x50 && header[1] === 0x4b;
  } catch { return false; }
}

// ============================================================
// === VANILLA CLIENT PRE-DOWNLOADER ===========================
// (Required by the Forge/NeoForge installer to patch against) =
// ============================================================
async function ensureVanillaClient(mcVersion, rootPath, progressCallback) {
  const versionDir = path.join(rootPath, 'versions', mcVersion);
  const versionJsonPath = path.join(versionDir, `${mcVersion}.json`);
  const versionJarPath = path.join(versionDir, `${mcVersion}.jar`);

  // Check both files exist and the JAR is non-empty
  if (fs.existsSync(versionJsonPath) && fs.existsSync(versionJarPath) && fs.statSync(versionJarPath).size > 0) {
    return;
  }

  const httpsGetWithTimeout = (url) => new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    https.get(url, { signal: controller.signal, headers: { 'User-Agent': 'IDKLauncher/1.0' } }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { clearTimeout(timeout); try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
      res.on('error', (e) => { clearTimeout(timeout); reject(e); });
    }).on('error', (e) => { clearTimeout(timeout); reject(e); });
  });

  let versionData;
  if (fs.existsSync(versionJsonPath)) {
    versionData = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
  } else {
    // Step 1 G�� version manifest (only if we don't have the JSON yet)
    progressCallback({ status: `Fetching Minecraft ${mcVersion} manifest...`, percent: 5 });
    const manifest = await httpsGetWithTimeout('https://launchermeta.mojang.com/mc/game/version_manifest.json');
    const versionEntry = manifest.versions.find(v => v.id === mcVersion);
    if (!versionEntry) throw new Error(`Minecraft version ${mcVersion} not found in Mojang manifest`);

    // Step 2 G�� version JSON
    versionData = await httpsGetWithTimeout(versionEntry.url);
    if (!fs.existsSync(versionDir)) fs.mkdirSync(versionDir, { recursive: true });
    fs.writeFileSync(versionJsonPath, JSON.stringify(versionData, null, 2));
  }

  // Step 3 G�� client JAR
  if (!fs.existsSync(versionJarPath) || fs.statSync(versionJarPath).size === 0) {
    progressCallback({ status: `Downloading Minecraft ${mcVersion} client...`, percent: 8 });
    const clientUrl = versionData.downloads?.client?.url;
    if (!clientUrl) throw new Error(`No client download URL for Minecraft ${mcVersion}`);
    await Promise.race([
      new Promise((resolveJar, rejectJar) => {
        downloadFile(clientUrl, versionJarPath, resolveJar, rejectJar);
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Download timed out after 120s')), 120000))
    ]);
  }

}

// Make a loader version JSON self-contained by resolving inheritsFrom.
// Reads the parent Minecraft version JSON and merges libraries, downloads,
// and assetIndex into the loader profile, then removes inheritsFrom.
// This eliminates MCLC's dependency on the parent version being present
// and ensures Fabric/Quilt game providers can always find the game.
async function resolveInheritsFrom(customVersionId, mcVersion, rootPath) {
  const jsonPath = path.join(rootPath, 'versions', customVersionId, `${customVersionId}.json`);
  try {
    if (!fs.existsSync(jsonPath)) return false;
    const raw = fs.readFileSync(jsonPath, 'utf8');
    const profile = JSON.parse(raw);
    if (!profile.inheritsFrom) return true;
    const parentJsonPath = path.join(rootPath, 'versions', profile.inheritsFrom, `${profile.inheritsFrom}.json`);
    if (!fs.existsSync(parentJsonPath)) {
      console.warn(`[Launch] Parent ${profile.inheritsFrom} not found, cannot resolve inheritsFrom for ${customVersionId}`);
      return false;
    }
    const parent = JSON.parse(fs.readFileSync(parentJsonPath, 'utf8'));
    const existingNames = new Set((profile.libraries || []).map(l => l.name));
    const mergedLibraries = [...(profile.libraries || [])];
    for (const lib of (parent.libraries || [])) {
      if (lib.name && !existingNames.has(lib.name)) {
        mergedLibraries.push(lib);
      }
    }
    profile.libraries = mergedLibraries;
    if (!profile.downloads && parent.downloads) profile.downloads = parent.downloads;
    if (!profile.assetIndex && parent.assetIndex) profile.assetIndex = parent.assetIndex;
    const inherited = profile.inheritsFrom;
    delete profile.inheritsFrom;
    fs.writeFileSync(jsonPath, JSON.stringify(profile, null, 2), 'utf8');
    console.log(`[Launch] Resolved inheritsFrom: merged ${inherited} into ${customVersionId}`);
    return true;
  } catch (e) {
    console.warn(`[Launch] Failed to resolve inheritsFrom for ${customVersionId}:`, e.message);
    return false;
  }
}

// ============================================================
// === FORGE INSTALLER =========================================
// ============================================================
async function installForge(mcVersion, rootPath, javaExe, progressCallback, pinnedVersion = null) {
  const { spawn } = require('child_process');

  let forgeVersion;
  if (pinnedVersion) {
    // Use the exact version from the modpack manifest (e.g. '14.23.5.2860')
    forgeVersion = pinnedVersion;
  } else {
    // Fall back to promotions_slim.json for the recommended/latest build
    const promoData = await new Promise((resolve, reject) => {
      https.get('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json',
        { headers: { 'User-Agent': 'IDKLauncher/1.0' } }, (res) => {
          let d = '';
          res.on('data', c => d += c);
          res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
        }).on('error', reject);
    });
    const promos = promoData.promos || {};
    forgeVersion = promos[`${mcVersion}-recommended`] || promos[`${mcVersion}-latest`];
    if (!forgeVersion) throw new Error(`No Forge builds found for MC ${mcVersion}. This version may not have a Forge release.`);
  }

  const forgeFullId = `${mcVersion}-${forgeVersion}`;
  const versionId = `${mcVersion}-forge-${forgeVersion}`;

  // 2. Check if already installed
  const versionsDir = path.join(rootPath, 'versions', versionId);
  const versionJson = path.join(versionsDir, `${versionId}.json`);
  if (fs.existsSync(versionJson)) {
    return versionId;
  }

  // 3. PRE-DOWNLOAD vanilla Minecraft so the Forge installer can patch it
  progressCallback({ status: `Preparing Minecraft ${mcVersion} for Forge...`, percent: 10 });
  await ensureVanillaClient(mcVersion, rootPath, progressCallback);

  // 3.5 Forge installer requires a launcher_profiles.json to exist, or it aborts.
  const profilesPath = path.join(rootPath, 'launcher_profiles.json');
  if (!fs.existsSync(profilesPath)) {
    fs.writeFileSync(profilesPath, JSON.stringify({ profiles: {} }));
  }

  // 4. Download the Forge installer JAR
  const installerFilename = `forge-${forgeFullId}-installer.jar`;
  const installerUrls = [
    `https://maven.minecraftforge.net/net/minecraftforge/forge/${forgeFullId}/${installerFilename}`,
    `https://files.minecraftforge.net/net/minecraftforge/forge/${forgeFullId}/${installerFilename}`
  ];
  const os = require('os');
  const installerPath = path.join(os.tmpdir(), installerFilename);

  if (!fs.existsSync(installerPath) || !_isValidZip(installerPath)) {
    progressCallback({ status: `Downloading Forge ${forgeVersion} installer...`, percent: 25 });
    let downloaded = false;
    for (const url of installerUrls) {
      try {
        if (fs.existsSync(installerPath)) try { fs.unlinkSync(installerPath); } catch (_) {}
        await new Promise((resolve, reject) => downloadFile(url, installerPath, resolve, reject));
        downloaded = true;
        break;
      } catch (e) {
        console.warn(`[Forge] Download failed from ${url}:`, e.message);
        try { if (fs.existsSync(installerPath)) fs.unlinkSync(installerPath); } catch (_) { }
      }
    }
    if (!downloaded) throw new Error(`Could not download Forge ${forgeVersion} installer. Check your internet connection.`);
  }

  // 5. Run the Forge installer headlessly G�� use spawn for real-time stderr capture
  progressCallback({ status: `Installing Forge ${forgeVersion} (this takes ~1 minute)...`, percent: 40 });
  await new Promise((resolve, reject) => {
    let stderrBuf = '';
    const proc = spawn(javaExe, [
      '-jar', installerPath,
      '--installClient', rootPath
    ], { timeout: 600000 });

    proc.stderr.on('data', d => {
      const txt = d.toString();
      console.error('[Forge stderr]', txt.trim());
      stderrBuf += txt;
    });

    proc.on('close', (code) => {
      if (fs.existsSync(versionJson)) {
        resolve();
      } else if (code === 0) {
        resolve();
      } else {
        const lines = stderrBuf.split('\n').filter(l => l.includes('ERROR') || l.includes('Exception') || l.includes('error'));
        const hint = lines[0] || stderrBuf.slice(-300);
        reject(new Error(`Forge installer exited with code ${code}.\n${hint}`));
      }
    });

    proc.on('error', (e) => reject(new Error('Failed to start Forge installer: ' + e.message)));
  });
  // Cleanup: delete the installer from temp
  try { fs.unlinkSync(installerPath); } catch (e) { }

  if (!fs.existsSync(versionJson)) throw new Error('Forge installation failed G�� version JSON not found after install.');
  progressCallback({ status: `Forge ${forgeVersion} installed!`, percent: 65 });
  return versionId;
}

// ============================================================
// === NEOFORGE INSTALLER ======================================
// ============================================================

async function installNeoForge(mcVersion, rootPath, javaExe, progressCallback) {
  const { spawn } = require('child_process');

  // NeoForge uses a different Maven and a different version scheme starting 1.20.2+
  // For 1.20.1 and below NeoForge does not exist (use Forge instead)
  const match = (mcVersion || '').match(/^1\.(\d+)(?:\.(\d+))?/);
  const minor = match ? parseInt(match[1]) : 0;
  const patch = match && match[2] ? parseInt(match[2]) : 0;

  if (minor < 20 || (minor === 20 && patch <= 1)) {
    // NeoForge doesn't support 1.20.1 and below G�� fall back to Forge
    console.warn(`[NeoForge] ${mcVersion} not supported, falling back to Forge`);
    return installForge(mcVersion, rootPath, javaExe, progressCallback);
  }

  // NeoForge version format: mcMinor.mcPatch.neoVersion (e.g. 20.4.x for MC 1.20.4)
  const neoMcPrefix = `${minor}.${patch}`;
  const metaUrl = `https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml`;

  const xmlData = await new Promise((resolve, reject) => {
    https.get(metaUrl, { headers: { 'User-Agent': 'IDKLauncher/1.0' } }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    }).on('error', reject);
  });

  // Parse all <version> tags and find the latest matching this MC minor.patch
  const allVersions = [...xmlData.matchAll(/<version>([^<]+)<\/version>/g)].map(m => m[1]);
  const matching = allVersions.filter(v => v.startsWith(neoMcPrefix + '.'));
  if (matching.length === 0) throw new Error(`No NeoForge builds found for MC ${mcVersion}`);
  const neoVersion = matching[matching.length - 1]; // Latest
  const versionId = `neoforge-${neoVersion}`;

  const versionsDir = path.join(rootPath, 'versions', versionId);
  const versionJson = path.join(versionsDir, `${versionId}.json`);
  if (fs.existsSync(versionJson)) {
    return versionId;
  }

  // PRE-DOWNLOAD vanilla Minecraft so the NeoForge installer can patch it
  progressCallback({ status: `Preparing Minecraft ${mcVersion} for NeoForge...`, percent: 10 });
  await ensureVanillaClient(mcVersion, rootPath, progressCallback);

  // NeoForge installer requires a launcher_profiles.json to exist, or it aborts.
  const profilesPath = path.join(rootPath, 'launcher_profiles.json');
  if (!fs.existsSync(profilesPath)) {
    fs.writeFileSync(profilesPath, JSON.stringify({ profiles: {} }));
  }

  const installerUrl = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${neoVersion}/neoforge-${neoVersion}-installer.jar`;
  const os = require('os');
  const installerPath = path.join(os.tmpdir(), `neoforge-installer-${neoVersion}.jar`);

  if (!fs.existsSync(installerPath) || !_isValidZip(installerPath)) {
    progressCallback({ status: `Downloading NeoForge ${neoVersion} installer...`, percent: 25 });
    if (fs.existsSync(installerPath)) try { fs.unlinkSync(installerPath); } catch (_) {}
    await new Promise((resolve, reject) => downloadFile(installerUrl, installerPath, resolve, reject));
  }

  progressCallback({ status: `Installing NeoForge ${neoVersion} (this takes ~1 minute)...`, percent: 40 });
  await new Promise((resolve, reject) => {
    let stderrBuf = '';
    const proc = spawn(javaExe, [
      '-jar', installerPath,
      '--installClient', rootPath
    ], { timeout: 600000 });

    proc.stderr.on('data', d => {
      const txt = d.toString();
      console.error('[NeoForge stderr]', txt.trim());
      stderrBuf += txt;
    });

    proc.on('close', (code) => {
      if (fs.existsSync(versionJson)) {
        resolve();
      } else if (code === 0) {
        resolve();
      } else {
        const lines = stderrBuf.split('\n').filter(l => l.includes('ERROR') || l.includes('Exception') || l.includes('error'));
        const hint = lines[0] || stderrBuf.slice(-300);
        reject(new Error(`NeoForge installer exited with code ${code}.\n${hint}`));
      }
    });

    proc.on('error', (e) => reject(new Error('Failed to start NeoForge installer: ' + e.message)));
  });
  try { fs.unlinkSync(installerPath); } catch (e) { }

  if (!fs.existsSync(versionJson)) throw new Error('NeoForge installation failed G�� version JSON not found after install.');
  progressCallback({ status: `NeoForge ${neoVersion} installed!`, percent: 65 });
  return versionId;
}

// ============================================================
// === FORGE JVM ARGUMENTS PARSER ==============================
// ============================================================
function getForgeJvmArgs(rootPath, versionId) {
  try {
    if (!versionId) return [];
    const jsonPath = path.join(rootPath, 'versions', versionId, `${versionId}.json`);
    if (!fs.existsSync(jsonPath)) return [];

    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    if (!data.arguments || !data.arguments.jvm) return [];

    const sep = process.platform === 'win32' ? ';' : ':';
    const libDir = path.join(rootPath, 'libraries').replace(/\\/g, '/');

    return data.arguments.jvm
      .filter(arg => typeof arg === 'string') // Ignore rule-based object args (handled by core if needed)
      .map(arg => {
        return arg
          .replace(/\$\{library_directory\}/g, libDir)
          .replace(/\$\{classpath_separator\}/g, sep)
          .replace(/\$\{version_name\}/g, versionId);
      });
  } catch (e) {
    console.error('[Forge Parser] Failed to parse JVM args:', e);
    return [];
  }
}

// ============================================================
// === LOADER EXISTENCE CHECK (skip re-download if present) ===
// ============================================================
// Uses the same detection logic as scan-downloaded-versions for consistency.
// Scans all version directories, detects loader type + game version from names,
// and returns the directory name (fullId) if any installed loader matches the
// requested mcVersion + loaderType.
async function findExistingLoaderOnDisk(rootPath, mcVersion, loaderType) {
  const versionsDir = path.join(rootPath, 'versions');
  if (!fs.existsSync(versionsDir)) return null;

  const lcLoader = (loaderType || '').toLowerCase();
  const entries = await fs.promises.readdir(versionsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dirName = entry.name;

    // Skip directories without a version JSON (not a real MC installation)
    const jsonPath = path.join(versionsDir, dirName, dirName + '.json');
    if (!fs.existsSync(jsonPath)) continue;

    // Detect loader from directory name (same logic as scan-downloaded-versions)
    const lowerName = dirName.toLowerCase();
    let dirLoader;
    if (lowerName.includes('fabric'))       dirLoader = 'fabric';
    else if (lowerName.includes('neoforge')) dirLoader = 'neoforge';
    else if (lowerName.includes('forge'))    dirLoader = 'forge';
    else if (lowerName.includes('quilt'))    dirLoader = 'quilt';
    else                                    dirLoader = 'vanilla';

    // For Forge directories, the JSON filename tells us the version.
    // For Forge dirs named <mcVersion>-forge-<forgeVersion>, extract mcVersion from the prefix.
    // For NeoForge dirs named neoforge-<neoVersion>, we must read the JSON.
    let dirMcVersion;
    if (dirLoader === 'forge') {
      // e.g. "1.21.1-forge-47.1.0" G�� extract "1.21.1" before "-forge-"
      const fi = dirName.toLowerCase().indexOf('-forge-');
      if (fi > 0) dirMcVersion = dirName.substring(0, fi);
    } else if (dirLoader === 'neoforge') {
      // e.g. "neoforge-20.4.123" G�� read JSON to find Minecraft version
      try {
        const raw = await fs.promises.readFile(jsonPath, 'utf8');
        const mvMatch = raw.match(/"minecraftVersion"\s*:\s*"([\d.]+)"/);
        if (mvMatch) dirMcVersion = mvMatch[1];
      } catch (e) { /* skip */ }
    } else {
      // Fabric/Quilt/Vanilla: extract from trailing segment
      // e.g. "fabric-loader-0.16.9-1.21.1" G�� "-1.21.1" G�� "1.21.1"
      const vm = dirName.match(/-([\d.]+)$/);
      if (vm) dirMcVersion = vm[1];
    }

    if (!dirMcVersion || dirMcVersion !== mcVersion) continue;
    if (dirLoader !== lcLoader) continue;

    return dirName;
  }
  return null;
}

// ============================================================
// === QUILT INSTALLER =========================================
// ============================================================
function installQuilt(version, rootPath) {
  return new Promise((resolve, reject) => {
    const findExistingLoader = () => {
      const versionsDir = path.join(rootPath, 'versions');
      if (!fs.existsSync(versionsDir)) return null;
      const entries = fs.readdirSync(versionsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith('quilt-loader-') && entry.name.endsWith(`-${version}`)) {
          const jsonPath = path.join(versionsDir, entry.name, `${entry.name}.json`);
          const jarPath = path.join(versionsDir, entry.name, `${entry.name}.jar`);
          if (fs.existsSync(jsonPath) && fs.existsSync(jarPath) && fs.statSync(jarPath).size > 0) {
            return entry.name;
          }
        }
      }
      return null;
    };

    const req = https.get(`https://meta.quiltmc.org/v3/versions/loader/${version}`,
      { headers: { 'User-Agent': 'IDKLauncher/1.0' } }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (!json.length) return reject(new Error('Quilt not available for this MC version.'));
            const loaderVersion = json[0].loader.version;
            const jarName = `quilt-loader-${loaderVersion}-${version}`;
            const versionsPath = path.join(rootPath, 'versions', jarName);
            if (!fs.existsSync(versionsPath)) fs.mkdirSync(versionsPath, { recursive: true });
            const jsonPath = path.join(versionsPath, `${jarName}.json`);
            const jsonUrl = `https://meta.quiltmc.org/v3/versions/loader/${version}/${loaderVersion}/profile/json`;
            https.get(jsonUrl, { headers: { 'User-Agent': 'IDKLauncher/1.0' } }, (r) => {
              if (r.statusCode !== 200) {
                r.resume();
                const existing = findExistingLoader();
                if (existing) return resolve(existing);
                return reject(new Error(`Quilt profile download failed: HTTP ${r.statusCode}`));
              }
              let profileData = '';
              r.on('data', c => profileData += c);
              r.on('end', () => {
                try {
                  const profile = JSON.parse(profileData);
                  if (!profile || typeof profile !== 'object' || !profile.id) {
                    throw new Error('Quilt profile JSON is invalid.');
                  }
                  fs.writeFileSync(jsonPath, JSON.stringify(profile, null, 2), 'utf8');
                  resolveInheritsFrom(jarName, version, rootPath);
                  resolve(jarName);
                } catch (e) {
                  reject(e);
                }
              });
            }).on('error', (e) => {
              const existing = findExistingLoader();
              if (existing) return resolve(existing);
              reject(e);
            });
          } catch (e) { reject(e); }
        });
      });
    req.on('error', () => {
      const existing = findExistingLoader();
      if (existing) return resolve(existing);
      reject(new Error('Quilt meta API unreachable and no cached installation found.'));
    });
  });
}

function installFabric(version, rootPath, pinnedLoaderVersion = null) {
  return new Promise((resolve, reject) => {
    const isValidFabricJar = (jarPath) => {
      try {
        if (!fs.existsSync(jarPath)) return false;
        const stat = fs.statSync(jarPath);
        if (stat.size < 4) return false;
        const fd = fs.openSync(jarPath, 'r');
        const header = Buffer.alloc(4);
        try {
          fs.readSync(fd, header, 0, 4, 0);
        } finally {
          fs.closeSync(fd);
        }
        if (header[0] !== 0x50 || header[1] !== 0x4b) return false;

        const jarBytes = fs.readFileSync(jarPath);
        return jarBytes.includes(Buffer.from('net/fabricmc/loader'));
      } catch {
        return false;
      }
    };

    const removeBadJar = (jarPath) => {
      if (fs.existsSync(jarPath) && !_isValidZip(jarPath)) {
        try {
          fs.unlinkSync(jarPath);
          console.warn(`[Fabric] Removed invalid loader jar: ${jarPath}`);
        } catch (e) {
          console.warn(`[Fabric] Failed to remove invalid loader jar ${jarPath}:`, e.message);
        }
      }
    };

    const downloadFabricJar = (loaderVersion, jarPath) => new Promise((jarResolve, jarReject) => {
      removeBadJar(jarPath);
      if (_isValidZip(jarPath)) return jarResolve();

      const tmpPath = `${jarPath}.download`;
      try {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      } catch {}

      const jarUrl = `https://maven.fabricmc.net/net/fabricmc/fabric-loader/${loaderVersion}/fabric-loader-${loaderVersion}.jar`;
      downloadFile(jarUrl, tmpPath, () => {
        if (!isValidFabricJar(tmpPath)) {
          try { fs.unlinkSync(tmpPath); } catch {}
          return jarReject(new Error(`Downloaded Fabric loader ${loaderVersion} is not a valid jar.`));
        }
        try {
          fs.renameSync(tmpPath, jarPath);
          jarResolve();
        } catch (e) {
          jarReject(e);
        }
      }, (e) => {
        try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch {}
        jarReject(e);
      });
    });

    const isFabricInstallComplete = (jarName, versionsPath) => {
      const jsonPath = path.join(versionsPath, `${jarName}.json`);
      const jarPath = path.join(versionsPath, `${jarName}.jar`);
      return fs.existsSync(jsonPath) && fs.statSync(jsonPath).size > 0
        && fs.existsSync(jarPath) && _isValidZip(jarPath) && fs.statSync(jarPath).size > 5000000;
    };

    // If we have a pinned version, check the cache before making any network request
    if (pinnedLoaderVersion) {
      const jarName = `fabric-loader-${pinnedLoaderVersion}-${version}`;
      const versionsPath = path.join(rootPath, 'versions', jarName);
      if (isFabricInstallComplete(jarName, versionsPath)) {
        return resolve(jarName);
      }
    }

    // Always fetch the meta API to get the LATEST loader version available.
    // The old caching logic (checking for ANY existing loader dir) was removed
    // because it would pin users to an outdated loader forever G�� e.g. 0.19.2
    // would never be replaced by 0.19.3+ even though the newer version exists.
    // If the meta API is unreachable, we fall back to any existing cached version.

    const findExistingLoader = () => {
      const versionsDir = path.join(rootPath, 'versions');
      if (!fs.existsSync(versionsDir)) return null;
      const entries = fs.readdirSync(versionsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith('fabric-loader-') && entry.name.endsWith(`-${version}`)) {
          if (isFabricInstallComplete(entry.name, path.join(versionsDir, entry.name))) {
            return entry.name;
          }
        }
      }
      return null;
    };

    const req = https.get(`https://meta.fabricmc.net/v2/versions/loader/${version}`, (res) => {
      let data = '';
      const onFail = () => {
        // Fallback: use whatever is cached on disk
        const existing = findExistingLoader();
        if (existing) return resolve(existing);
        reject(`Fabric not available for Minecraft ${version}, and no cached installation found.`);
      };
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (!Array.isArray(json) || json.length === 0) return onFail();
          // Use pinned version from manifest, or fall back to latest
          const loaderVersion = pinnedLoaderVersion || json[0].loader.version;
          const jarName = `fabric-loader-${loaderVersion}-${version}`;

          const versionsPath = path.join(rootPath, 'versions', jarName);
          if (!fs.existsSync(versionsPath)) fs.mkdirSync(versionsPath, { recursive: true });

          const jsonPath = path.join(versionsPath, `${jarName}.json`);
          const jarPath = path.join(versionsPath, `${jarName}.jar`);
          const needsJson = !fs.existsSync(jsonPath) || fs.statSync(jsonPath).size === 0;

          // Returns a promise that resolves when the Minecraft client jar has been
          // copied into the Fabric version directory as the version jar.
          const ensureVersionJar = () => {
            const mcClientJar = path.join(rootPath, 'versions', version, `${version}.jar`);
            if (fs.existsSync(jarPath) && _isValidZip(jarPath) && fs.statSync(jarPath).size > 5000000) {
              return Promise.resolve(); // already a valid client jar
            }
            // Ensure the vanilla client exists, then copy it as our version jar
            return ensureVanillaClient(version, rootPath, () => {})
              .then(() => {
                if (!fs.existsSync(mcClientJar) || fs.statSync(mcClientJar).size === 0) {
                  throw new Error(`Minecraft ${version} client jar not found after download.`);
                }
                fs.copyFileSync(mcClientJar, jarPath);
              });
          };

          const finishInstall = () => {
            ensureVersionJar()
              .then(() => resolve(jarName))
              .catch(reject);
          };

          if (!needsJson) return finishInstall();

          const jsonUrl = `https://meta.fabricmc.net/v2/versions/loader/${version}/${loaderVersion}/profile/json`;
          const tmpJsonPath = `${jsonPath}.download`;
          try { if (fs.existsSync(tmpJsonPath)) fs.unlinkSync(tmpJsonPath); } catch {}
          downloadFile(jsonUrl, tmpJsonPath, () => {
            try {
              const profile = JSON.parse(fs.readFileSync(tmpJsonPath, 'utf8'));
              if (!profile || typeof profile !== 'object' || !profile.id) {
                throw new Error('Fabric profile JSON is invalid.');
              }
              fs.writeFileSync(jsonPath, JSON.stringify(profile, null, 2), 'utf8');
              try { if (fs.existsSync(tmpJsonPath)) fs.unlinkSync(tmpJsonPath); } catch {}
              resolveInheritsFrom(jarName, version, rootPath);
              finishInstall();
            } catch (e) {
              try { if (fs.existsSync(tmpJsonPath)) fs.unlinkSync(tmpJsonPath); } catch {}
              reject(e);
            }
          }, (e) => {
            try { if (fs.existsSync(tmpJsonPath)) fs.unlinkSync(tmpJsonPath); } catch {}
            // If the pinned version is invalid (400/404), fall back to the
            // latest compatible version from the meta API we already fetched.
            const isBadVersion = e.message.includes('status 400') || e.message.includes('status 404');
            if (isBadVersion && pinnedLoaderVersion && json[0]?.loader?.version && json[0].loader.version !== pinnedLoaderVersion) {
              console.warn(`[Fabric] Pinned loader ${pinnedLoaderVersion} not available for MC ${version}, falling back to ${json[0].loader.version}`);
              const fallbackVersion = json[0].loader.version;
              const fallbackJarName = `fabric-loader-${fallbackVersion}-${version}`;
              const fallbackVersionsPath = path.join(rootPath, 'versions', fallbackJarName);
              if (!fs.existsSync(fallbackVersionsPath)) fs.mkdirSync(fallbackVersionsPath, { recursive: true });
              const fallbackJsonPath = path.join(fallbackVersionsPath, `${fallbackJarName}.json`);
              const fallbackJarPath = path.join(fallbackVersionsPath, `${fallbackJarName}.jar`);
              try { if (fs.existsSync(fallbackJsonPath)) fs.unlinkSync(fallbackJsonPath); } catch {}
              const fallbackJsonUrl = `https://meta.fabricmc.net/v2/versions/loader/${version}/${fallbackVersion}/profile/json`;
              downloadFile(fallbackJsonUrl, fallbackJsonPath, () => {
                try {
                  const fbProfile = JSON.parse(fs.readFileSync(fallbackJsonPath, 'utf8'));
                  fs.writeFileSync(fallbackJsonPath, JSON.stringify(fbProfile, null, 2), 'utf8');
                    resolveInheritsFrom(fallbackJarName, version, rootPath);
                } catch (_) { /* non-fatal, MCLC may still handle it */ }
                // Copy MC client jar as version jar instead of downloading fabric-loader jar
                const mcClientJar = path.join(rootPath, 'versions', version, `${version}.jar`);
                if (fs.existsSync(mcClientJar) && _isValidZip(mcClientJar) && fs.statSync(mcClientJar).size > 5000000) {
                  try { fs.copyFileSync(mcClientJar, fallbackJarPath); } catch (_) {}
                }
                resolve(fallbackJarName);
              }, (e2) => {
                try { if (fs.existsSync(fallbackJsonPath)) fs.unlinkSync(fallbackJsonPath); } catch {}
                reject(e2);
              });
              return;
            }
            reject(e);
          });
        } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

// Helper: follow redirects recursively then pipe to a write stream
function downloadFile(url, destPath, resolve, reject, depth = 0, progressCallback, cancelToken = null) {
  if (depth > 5) return reject(new Error('Too many redirects'));
  const startTime = Date.now();
  let bytesDownloaded = 0;
  // Write to a sibling .part file first, then atomically rename on success.
  // This guarantees we never leave a truncated/corrupt file at destPath.
  const tmpPath = destPath + '.part';
  const cleanup = () => { try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (_) {} };
  const req = https.get(url, (r) => {
    const totalSize = parseInt(r.headers['content-length'] || '0', 10);
    if (r.statusCode === 301 || r.statusCode === 302 || r.statusCode === 303 || r.statusCode === 307 || r.statusCode === 308) {
      const location = r.headers.location;
      r.resume();
      return downloadFile(location, destPath, resolve, reject, depth + 1, progressCallback, cancelToken);
    }
    if (r.statusCode !== 200) {
      r.resume();
      cleanup();
      return reject(new Error(`Download failed with status ${r.statusCode}`));
    }
    const file = fs.createWriteStream(tmpPath);
    r.on('data', (chunk) => {
      bytesDownloaded += chunk.length;
      if (typeof progressCallback === 'function' && totalSize > 0) {
        const elapsed = Date.now() - startTime;
        const percent = Math.min(100, (bytesDownloaded / totalSize) * 100);
        const speed = elapsed > 0 ? bytesDownloaded / (elapsed / 1000) : 0;
        const eta = speed > 0 ? (totalSize - bytesDownloaded) / speed : 0;
        progressCallback({ percent, bytesDownloaded, totalSize, speed, eta });
      }
    });
    r.pipe(file);
    file.on('finish', () => {
      file.close();
      // If the server advertised a size, verify we got all of it.
      if (totalSize > 0 && bytesDownloaded !== totalSize) {
        cleanup();
        return reject(new Error(`Download truncated: expected ${totalSize} bytes, got ${bytesDownloaded}`));
      }
      if (cancelToken && cancelToken.cancelled) {
        cleanup();
        return reject(new Error('Download cancelled'));
      }
      // Atomic rename so the final file only ever appears intact.
      try {
        fs.renameSync(tmpPath, destPath);
      } catch (e) {
        cleanup();
        return reject(new Error(`Failed to finalize download: ${e.message}`));
      }
      if (typeof progressCallback === 'function') {
        progressCallback({ percent: 100, bytesDownloaded: totalSize, totalSize, speed: 0, eta: 0 });
      }
      resolve();
    });
    file.on('error', (err) => { cleanup(); reject(err); });
    r.on('error', (err) => { cleanup(); reject(err); });
  }).on('error', (err) => { cleanup(); reject(err); });
  
  if (cancelToken) {
    if (cancelToken.cancelled) {
      req.destroy();
      cleanup();
      return reject(new Error('Download cancelled'));
    }
    cancelToken.req = req;
    cancelToken.cleanup = cleanup;
  }

  req.setTimeout(120000, () => {
    req.destroy();
    cleanup();
    reject(new Error(`Download timed out after 120s`));
  });
}

// profilePath is the per-version directory (e.g. profiles/1.16.4)
// mods are placed in profilePath/mods, fully isolated per game version
function installSodium(version, profilePath) {
  return new Promise((resolve, reject) => {
    const gameVersions = encodeURIComponent(JSON.stringify([version]));
    const loaders = encodeURIComponent(JSON.stringify(["fabric"]));
    const url = `https://api.modrinth.com/v2/project/sodium/version?game_versions=${gameVersions}&loaders=${loaders}`;

    https.get(url, { headers: { 'User-Agent': 'IDKLauncher/1.0 (contact@idklauncher.app)' } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (!Array.isArray(json) || json.length === 0) {
            return resolve(false); // Signal: not supported
          }

          const fileObj = json[0].files.find(f => f.primary) || json[0].files[0];
          const downloadUrl = fileObj.url;
          const fileName = fileObj.filename;

          const modsPath = path.join(profilePath, 'mods');
          const jarPath = path.join(modsPath, fileName);
          let alreadyExists = fs.existsSync(jarPath);

          if (!fs.existsSync(modsPath)) {
            fs.mkdirSync(modsPath, { recursive: true });
          } else {
            // Clean stale sodium JARs and conflicting VulkanMod in this version's mods folder
            fs.readdirSync(modsPath).forEach(file => {
              const lFile = file.toLowerCase();
              if ((lFile.includes('sodium') || lFile.includes('vulkanmod')) && file !== fileName) {
                try { fs.unlinkSync(path.join(modsPath, file)); } catch (e) { }
              }
            });
          }

          if (alreadyExists) {
            return resolve(true);
          }

          downloadFile(downloadUrl, jarPath, () => resolve(true), reject);
        } catch (e) {
          console.error('[Sodium] Error parsing Modrinth response:', e);
          reject(e);
        }
      });
    }).on('error', (e) => {
      console.error('[Sodium] Request error:', e);
      reject(e);
    });
  });
}

function installModrinthProject(projectSlug, version, profilePath, removeKeyword) {
  return new Promise((resolve, reject) => {
    const gameVersions = encodeURIComponent(JSON.stringify([version]));
    const loaders = encodeURIComponent(JSON.stringify(["fabric"]));
    const url = `https://api.modrinth.com/v2/project/${projectSlug}/version?game_versions=${gameVersions}&loaders=${loaders}`;

    https.get(url, { headers: { 'User-Agent': 'IDKLauncher/1.0 (contact@idklauncher.app)' } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (!Array.isArray(json) || json.length === 0) {
            return resolve(false);
          }

          const fileObj = json[0].files.find(f => f.primary) || json[0].files[0];
          const downloadUrl = fileObj.url;
          const fileName = fileObj.filename;

          const modsPath = path.join(profilePath, 'mods');
          const jarPath = path.join(modsPath, fileName);
          let alreadyExists = fs.existsSync(jarPath);

          if (!fs.existsSync(modsPath)) {
            fs.mkdirSync(modsPath, { recursive: true });
          } else {
            // Clean stale jars
            fs.readdirSync(modsPath).forEach(file => {
              if (file.toLowerCase().includes(removeKeyword) && file !== fileName) {
                try { fs.unlinkSync(path.join(modsPath, file)); } catch (e) { }
              }
            });
          }

          if (alreadyExists) {
            return resolve(true);
          }

          downloadFile(downloadUrl, jarPath, () => resolve(true), reject);
        } catch (e) {
          console.error(`[${projectSlug}] Error parsing Modrinth response:`, e);
          reject(e);
        }
      });
    }).on('error', (e) => {
      console.error(`[${projectSlug}] Request error:`, e);
      reject(e);
    });
  });
}

function installIris(version, profilePath) {
  return installModrinthProject('iris', version, profilePath, 'iris');
}

function installVulkanMod(version, profilePath) {
  return new Promise(async (resolve, reject) => {
    try {
      // VulkanMod conflicts with Sodium/Iris, clean them up first
      const modsPath = path.join(profilePath, 'mods');
      if (fs.existsSync(modsPath)) {
        fs.readdirSync(modsPath).forEach(file => {
          const lFile = file.toLowerCase();
          if (lFile.includes('sodium') || lFile.includes('iris')) {
            try { fs.unlinkSync(path.join(modsPath, file)); } catch (e) { }
          }
        });
      }
      const installed = await installModrinthProject('vulkanmod', version, profilePath, 'vulkanmod');
      resolve(installed);
    } catch(e) {
      reject(e);
    }
  });
}
// ============================================================
// === FRPC TUNNEL MULTIPLAYER SYSTEM =========================
// ============================================================
let activeTunnelProcess = null;
let activeAccessProcess = null;
let activeDownloadRequest = null;

ipcMain.handle('ensure-frpc', async (event) => {
  const binDir = path.join(app.getPath('userData'), 'bin');
  if (!fs.existsSync(binDir)) fs.mkdirSync(binDir, { recursive: true });
  const exePath = path.join(binDir, 'frpc.exe');

  if (fs.existsSync(exePath) && fs.statSync(exePath).size > 0) {
    return { success: true, path: exePath };
  }

  const url = 'https://github.com/fatedier/frp/releases/download/v0.56.0/frp_0.56.0_windows_amd64.zip';
  event.sender.send('frpc-install-progress', { status: 'Downloading frpc...', percent: 0 });

  return new Promise((resolve) => {
    function download(downloadUrl, redirectCount = 0) {
      if (redirectCount > 7) {
        return resolve({ success: false, error: 'Too many redirects' });
      }

      const req = https.get(downloadUrl, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
          const nextUrl = res.headers.location;
          if (!nextUrl) {
            activeDownloadRequest = null;
            return resolve({ success: false, error: 'Redirect location missing' });
          }
          return download(nextUrl, redirectCount + 1);
        }

        if (res.statusCode !== 200) {
          activeDownloadRequest = null;
          return resolve({ success: false, error: 'Status ' + res.statusCode });
        }

        const total = parseInt(res.headers['content-length'] || '0', 10);
        const buffers = [];
        let downloadedBytes = 0;

        res.on('data', (chunk) => {
          buffers.push(chunk);
          downloadedBytes += chunk.length;
          if (total > 0) {
            const percent = Math.round((downloadedBytes / total) * 100);
            event.sender.send('frpc-install-progress', { status: 'Downloading frpc...', percent });
          }
        });

        res.on('end', async () => {
          activeDownloadRequest = null;
          try {
            event.sender.send('frpc-install-progress', { status: 'Extracting frpc.exe...', percent: 100 });
            const zipBuffer = Buffer.concat(buffers);
            const JSZip = require('jszip');
            const zip = await JSZip.loadAsync(zipBuffer);
            
            // Find frpc.exe in the zip
            const frpcEntry = Object.values(zip.files).find(file => file.name.endsWith('frpc.exe'));
            if (!frpcEntry) {
              throw new Error('frpc.exe not found in downloaded zip');
            }
            
            const exeBuffer = await frpcEntry.async('nodebuffer');
            fs.writeFileSync(exePath, exeBuffer);
            resolve({ success: true, path: exePath });
          } catch (err) {
            resolve({ success: false, error: 'Failed to extract frpc: ' + err.message });
          }
        });

        res.on('error', (e) => {
          activeDownloadRequest = null;
          resolve({ success: false, error: e.message });
        });
      }).on('error', (e) => {
        activeDownloadRequest = null;
        resolve({ success: false, error: e.message });
      });

      activeDownloadRequest = req;
    }

    download(url);
  });
});

ipcMain.handle('start-frpc-tunnel', async (event, { port }) => {
  if (activeTunnelProcess) {
    try { activeTunnelProcess.kill(); } catch (e) { }
    activeTunnelProcess = null;
  }

  const binDir = path.join(app.getPath('userData'), 'bin');
  const exePath = path.join(binDir, 'frpc.exe');

  if (!fs.existsSync(exePath)) {
    return { success: false, error: 'frpc.exe is not installed' };
  }

  return new Promise((resolve) => {
    const { spawn } = require('child_process');
    
    // Generate a random remote port between 10000 and 65000
    const frpcServer = process.env.IDK_FRPC_SERVER || 'play.somniac.me';
    const frpcPort = process.env.IDK_FRPC_PORT || '7000';
    const frpcToken = process.env.IDK_FRPC_TOKEN || 'indkingdomisalive';
    const remotePort = Math.floor(Math.random() * (65000 - 10000 + 1)) + 10000;
    const proxyName = 'idk_proxy_' + Math.random().toString(36).substring(2, 10);
    
    console.log(`[FRPC] Starting tunnel on local tcp://127.0.0.1:${port} to remote ${frpcServer}:${remotePort}`);

    const proc = spawn(exePath, [
      'tcp',
      '-s', frpcServer,
      '-P', frpcPort,
      '-t', frpcToken,
      '-l', port.toString(),
      '-r', remotePort.toString(),
      '-n', proxyName
    ]);
    
    activeTunnelProcess = proc;

    let resolved = false;
    let logBuffer = '';

    const handleLogData = (data, source) => {
      const line = data.toString();
      logBuffer += line;

      // Scan for successful start
      if (line.includes('start proxy success') && !resolved) {
        resolved = true;
        const tunnelUrl = `tcp://play.somniac.me:${remotePort}`;
        console.log(`[FRPC] Tunnel successfully established: ${tunnelUrl}`);
        resolve({ success: true, url: tunnelUrl });
      }
      
      // Check for port already used
      if (line.includes('port already used') && !resolved) {
        resolved = true;
        resolve({ success: false, error: 'Port collision', retry: true });
      }
    };

    proc.stderr.on('data', (data) => handleLogData(data, 'Stderr'));
    proc.stdout.on('data', (data) => handleLogData(data, 'Stdout'));

    proc.on('close', (code) => {
      console.log(`[FRPC] Process exited with code ${code}`);
      activeTunnelProcess = null;
      if (!resolved) {
        resolve({ success: false, error: `FRPC exited with code ${code}` });
      }
      event.sender.send('frpc-tunnel-closed');
    });

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        try { proc.kill(); } catch (e) { }
        activeTunnelProcess = null;
        resolve({ success: false, error: 'Tunnel connection timed out (20 seconds)' });
      }
    }, 20000);
  });
});

ipcMain.handle('stop-frpc-tunnel', async () => {
  if (activeDownloadRequest) {
    try { activeDownloadRequest.destroy(); } catch (e) {}
    activeDownloadRequest = null;
  }
  if (activeTunnelProcess) {
    try { activeTunnelProcess.kill('SIGTERM'); } catch (e) {}
    activeTunnelProcess = null;
  }
  // Always return success G�� if there's no active process, it's already stopped
  return { success: true };
});

// Get userData path for frontend
ipcMain.handle('get-user-data-path', async () => {
  return app.getPath('userData');
});

// Get versions path for frontend
ipcMain.handle('get-versions-path', async () => {
  return path.join(getMinecraftDataPath(), 'versions');
});

// Scan for downloaded versions
ipcMain.handle('scan-downloaded-versions', async () => {
  try {
    const versionsPath = path.join(getMinecraftDataPath(), 'versions');
    
    try { await fs.promises.access(versionsPath); } catch {
      return { success: true, versions: [], versionDetails: {} };
    }
    
    const entries = await fs.promises.readdir(versionsPath, { withFileTypes: true });
    const downloadedVersions = [];
    const versionDetails = {};
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const versionId = entry.name;
        const versionJsonPath = path.join(versionsPath, versionId, `${versionId}.json`);
        
        try { await fs.promises.access(versionJsonPath); } catch { continue; }
        let versionJson = null;
        try {
          let raw = await fs.promises.readFile(versionJsonPath, 'utf8');
          if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
          versionJson = JSON.parse(raw);
        } catch (_) {}

          // Extract the actual game version from the directory name or JSON
          let gameVersion = versionId;
          let loader = 'Vanilla';
          
          // Detect loader from directory name
          const lowerName = versionId.toLowerCase();
          if (lowerName.includes('fabric')) {
            loader = 'Fabric';
          } else if (lowerName.includes('neoforge')) {
            loader = 'NeoForge';
          } else if (lowerName.includes('forge')) {
            loader = 'Forge';
          } else if (lowerName.includes('quilt')) {
            loader = 'Quilt';
          }
          
          // Try to extract game version from loader format
          const loaderMatch = versionId.match(/-([\d.]+)$/);
          if (loaderMatch) {
            gameVersion = loaderMatch[1];
          }

          // Prefer the explicit minecraft version inside the JSON if present
          const jsonGameVersion =
            versionJson?.inheritsFrom ||
            versionJson?.minecraftVersion ||
            versionJson?.jar ||
            versionJson?.id;
          if (jsonGameVersion && isValidMcVersion(String(jsonGameVersion))) {
            gameVersion = String(jsonGameVersion);
          }
          
          downloadedVersions.push(gameVersion);
          versionDetails[gameVersion] = { loader, fullId: versionId };
      }
    }
    
    return { success: true, versions: downloadedVersions, versionDetails };
  } catch (e) {
    console.error('[Versions] Failed to scan downloaded versions:', e);
    return { success: false, error: e.message, versions: [], versionDetails: {} };
  }
});

const activeDownloads = new Map();

// Download a vanilla Minecraft version (client JAR + version JSON)
ipcMain.handle('download-version', async (event, { version, rootPath }) => {
  try {
    const cancelToken = { cancelled: false, req: null, cleanup: null };
    activeDownloads.set(`version:${version}`, cancelToken);

    const mcDataPath = rootPath || getMinecraftDataPath();
    const versionDir = path.join(mcDataPath, 'versions', version);
    const versionJsonPath = path.join(versionDir, `${version}.json`);
    const versionJarPath = path.join(versionDir, `${version}.jar`);
    const sendProgress = (status, percent) => {
      try {
        event.sender.send('download-progress', {
          downloadId: `version:${version}`,
          status,
          percent,
          item: version,
        });
      } catch {}
    };

    // Check if already downloaded (async)
    try {
      await fs.promises.access(versionJsonPath);
      await fs.promises.access(versionJarPath);
      const jarStat = await fs.promises.stat(versionJarPath);
      if (jarStat.size > 0) {
        sendProgress(`Minecraft ${version} already downloaded`, 100);
        try { event.sender.send('download-complete', `version:${version}`, { success: true, alreadyDownloaded: true }); } catch {}
        activeDownloads.delete(`version:${version}`);
        return { success: true, alreadyDownloaded: true };
      }
    } catch {} // Not downloaded yet, continue
    sendProgress(`Fetching Minecraft ${version} manifest...`, 5);

    // Fetch version manifest to get the version URL
    const manifest = await new Promise((resolve, reject) => {
      const req = https.get('https://launchermeta.mojang.com/mc/game/version_manifest.json',
        { headers: { 'User-Agent': 'IDKLauncher/1.0' } }, (res) => {
          let d = '';
          res.on('data', c => d += c);
          res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
        }).on('error', reject);
      cancelToken.req = req;
    });
    if (cancelToken.cancelled) throw new Error('Download cancelled');

    const versionEntry = manifest.versions.find(v => v.id === version);
    if (!versionEntry) throw new Error(`Minecraft version ${version} not found`);
    sendProgress(`Downloading Minecraft ${version} metadata...`, 15);

    // Download version JSON
    const versionData = await new Promise((resolve, reject) => {
      const req = https.get(versionEntry.url, { headers: { 'User-Agent': 'IDKLauncher/1.0' } }, (res) => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
      }).on('error', reject);
      cancelToken.req = req;
    });
    if (cancelToken.cancelled) throw new Error('Download cancelled');

    if (!fs.existsSync(versionDir)) fs.mkdirSync(versionDir, { recursive: true });
    fs.writeFileSync(versionJsonPath, JSON.stringify(versionData, null, 2));

    // Download client JAR
    const clientUrl = versionData.downloads?.client?.url;
    if (!clientUrl) throw new Error(`No client download URL for Minecraft ${version}`);
    sendProgress(`Downloading Minecraft ${version} client...`, 45);

    await new Promise((resolve, reject) => {
      downloadFile(clientUrl, versionJarPath, resolve, reject, 0, (prog) => {
        try {
          event.sender.send('download-progress', {
            downloadId: `version:${version}`,
            status: `Downloading Minecraft ${version} client...`,
            percent: prog.percent,
            speed: prog.speed,
            eta: prog.eta,
            item: version,
          });
        } catch {}
      }, cancelToken);
    });
    sendProgress(`Finalizing Minecraft ${version}...`, 95);

    try { event.sender.send('download-complete', `version:${version}`, { success: true, alreadyDownloaded: false }); } catch {}
    activeDownloads.delete(`version:${version}`);
    return { success: true, alreadyDownloaded: false };
  } catch (e) {
    activeDownloads.delete(`version:${version}`);
    console.error('[Download Version] Failed:', e);
    try { event.sender.send('download-error', `version:${version}`, { message: e.message, error: e.message }); } catch {}
    return { success: false, error: e.message };
  }
});

ipcMain.handle('cancel-version-download', async (event, { version }) => {
  const token = activeDownloads.get(`version:${version}`);
  if (token) {
    token.cancelled = true;
    if (token.req) token.req.destroy(new Error('Download cancelled'));
    if (token.cleanup) token.cleanup();
    activeDownloads.delete(`version:${version}`);
    return { success: true };
  }
  return { success: false, error: 'Not found' };
});

ipcMain.handle('cancel-all-downloads', async () => {
  for (const [id, token] of activeDownloads.entries()) {
    token.cancelled = true;
    if (token.req) token.req.destroy(new Error('Download cancelled'));
    if (token.cleanup) token.cleanup();
  }
  activeDownloads.clear();

  const manager = getDownloadManager();
  if (manager) {
    await manager.cancelAllDownloads();
  }

  return { success: true };
});

// Extract icon from JAR/ZIP file (mods, resourcepacks, shaders)
// Optimized to extract once and cache to disk
// Checks root directory and common locations for any image file
ipcMain.handle('extract-mod-icon', async (event, { modId, modpackId, typeDir, filename }) => {
  try {
    const JSZip = require('jszip');
    
    // Build paths - handle both modpacks and versions
    let jarPath, cacheDir, cachePath;
    
    if (modpackId.startsWith('version-')) {
      const version = modpackId.replace('version-', '');
      const versionsPath = path.join(getMinecraftDataPath(), 'versions');
      const versionDir = resolveVersionDir(versionsPath, version);
      
      if (!versionDir) {
        return { success: false, reason: 'Version not found', filename };
      }
      
      jarPath = path.join(versionsPath, versionDir, typeDir, filename);
      cacheDir = path.join(getMinecraftDataPath(), 'icon-cache', `version-${version}`, typeDir);
      cachePath = path.join(cacheDir, `${filename}.png`);
    } else {
      // For modpacks, mods are in profiles/modpack-{id}/mods/
      jarPath = path.join(getMinecraftDataPath(), 'profiles', `modpack-${modpackId}`, typeDir, filename);
      cacheDir = path.join(getMinecraftDataPath(), 'icon-cache', modpackId, typeDir);
      cachePath = path.join(cacheDir, `${filename}.png`);
    }
    
    if (fs.existsSync(cachePath)) {
      return { success: true, iconUrl: `file://${cachePath}`, modId, filename, cached: true };
    }
    
    if (!fs.existsSync(jarPath)) {
      console.warn(`[IconExtractor] File not found: ${jarPath}`);
      return { success: false, reason: 'File not found', filename };
    }

    // Read JAR file with size limit to prevent memory issues
    const stats = fs.statSync(jarPath);
    if (stats.size > 500 * 1024 * 1024) { // Skip files larger than 500MB
      console.warn(`[IconExtractor] File too large: ${filename} (${stats.size} bytes)`);
      return { success: false, reason: 'File too large', filename };
    }

    const data = fs.readFileSync(jarPath);
    const zip = await JSZip.loadAsync(data);

    // Image file extensions to search for
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.ico'];
    
    let iconFile = null;

    // Priority 1: Check root directory for any image file
    for (const [filePath, file] of Object.entries(zip.files)) {
      if (file.dir) continue;
      
      // Check if file is in root (no slashes)
      if (!filePath.includes('/')) {
        const hasImageExt = imageExtensions.some(ext => filePath.toLowerCase().endsWith(ext));
        if (hasImageExt) {
          const size = file._data?.uncompressedSize || 0;
          // Accept images up to 5MB
          if (size > 0 && size < 5000000) {
            iconFile = file;
            break;
          }
        }
      }
    }

    // Priority 2: Check common icon patterns
    if (!iconFile) {
      const iconPatterns = [
        'pack.png',
        'assets/modicon.png',
        'assets/icon.png',
        'logo.png',
        'icon.png',
        'assets/minecraft/textures/gui/icon.png',
      ];

      for (const pattern of iconPatterns) {
        if (zip.files[pattern]) {
          iconFile = zip.files[pattern];
          break;
        }
      }
    }

    // Priority 3: Recursive search in common directories
    if (!iconFile) {
      const searchDirs = ['assets', 'textures', 'images', 'icon', 'META-INF'];
      const candidates = [];

      for (const [filePath, file] of Object.entries(zip.files)) {
        if (file.dir) continue;

        const isInSearchDir = searchDirs.some(dir => filePath.toLowerCase().includes(dir.toLowerCase()));
        const hasImageExt = imageExtensions.some(ext => filePath.toLowerCase().endsWith(ext));

        if (isInSearchDir && hasImageExt) {
          const size = file._data?.uncompressedSize || 0;
          if (size > 0 && size < 5000000) {
            candidates.push({ path: filePath, file, size });
          }
        }
      }

      if (candidates.length > 0) {
        candidates.sort((a, b) => a.size - b.size);
        iconFile = candidates[0].file;
      }
    }

    // Priority 4: Try fabric.mod.json
    if (!iconFile && zip.files['fabric.mod.json']) {
      try {
        const fabricJson = await zip.files['fabric.mod.json'].async('string');
        const fabricData = JSON.parse(fabricJson);
        if (fabricData.icon && zip.files[fabricData.icon]) {
          iconFile = zip.files[fabricData.icon];
        }
      } catch (e) {
        console.warn(`[IconExtractor] Failed to parse fabric.mod.json in ${filename}:`, e.message);
      }
    }

    let iconBuffer = null;
    let isGenerated = false;

    if (iconFile) {
      const buffer = await iconFile.async('arraybuffer');
      iconBuffer = Buffer.from(buffer);
    } else {
      iconBuffer = generatePlaceholderIcon(filename);
      isGenerated = true;
    }

    // Save to disk cache
    try {
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }
      fs.writeFileSync(cachePath, iconBuffer);
    } catch (e) {
      console.warn(`[IconExtractor] Failed to cache icon to disk:`, e.message);
    }

    // Return file path instead of base64 to avoid memory overhead
    return { success: true, iconUrl: `file://${cachePath}`, modId, filename, generated: isGenerated };
  } catch (e) {
    console.error('[IconExtractor] Error extracting icon from', filename, ':', e.message);
    return { success: false, reason: e.message, filename };
  }
});

// Generate a placeholder icon with mod initials
function generatePlaceholderIcon(filename) {
  // Extract mod name from filename (remove version and extension)
  let modName = filename.replace(/\.[^.]+$/, ''); // Remove extension
  modName = modName.replace(/-[\d.]+.*$/, ''); // Remove version
  modName = modName.replace(/_/g, ' '); // Replace underscores with spaces
  
  // Get initials (first letter of each word, max 2 chars)
  const words = modName.split(/[\s-]+/).filter(w => w.length > 0);
  const initials = words.map(w => w[0].toUpperCase()).slice(0, 2).join('');
  
  // Generate a simple PNG with initials
  // Using a basic 64x64 PNG with a solid color background and text
  const colors = [
    { bg: '#FF6B6B', text: '#FFFFFF' }, // Red
    { bg: '#4ECDC4', text: '#FFFFFF' }, // Teal
    { bg: '#45B7D1', text: '#FFFFFF' }, // Blue
    { bg: '#96CEB4', text: '#FFFFFF' }, // Green
    { bg: '#FFEAA7', text: '#333333' }, // Yellow
    { bg: '#DDA15E', text: '#FFFFFF' }, // Brown
    { bg: '#BC6C25', text: '#FFFFFF' }, // Dark Brown
    { bg: '#9D4EDD', text: '#FFFFFF' }, // Purple
  ];
  
  // Use filename hash to pick a consistent color
  let hash = 0;
  for (let i = 0; i < filename.length; i++) {
    hash = ((hash << 5) - hash) + filename.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  const color = colors[Math.abs(hash) % colors.length];
  
  // Create a simple SVG and convert to PNG using nativeImage
  const svg = `<svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">
    <rect width="64" height="64" fill="${color.bg}" rx="8"/>
    <text x="32" y="40" font-size="24" font-weight="bold" text-anchor="middle" fill="${color.text}" font-family="Arial, sans-serif">${initials || '?'}</text>
  </svg>`;
  
  const dataUrl = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
  const img = nativeImage.createFromDataURL(dataUrl);
  return img.toPNG();
}

// Batch extract icons for all items in a modpack
// Uses disk cache (like ModMenu) - extract once, reuse forever
// Checks root directory and common locations for any image file
// OPTIMIZED: Skip extraction if icon is already cached on disk, return file:// URLs instead of base64
ipcMain.handle('extract-all-icons', async (event, { modpackId }) => {
  try {
    const JSZip = require('jszip');
    const profilePath = path.join(getMinecraftDataPath(), 'profiles', `modpack-${modpackId}`);
    const cacheBaseDir = path.join(getMinecraftDataPath(), 'icon-cache', modpackId);
    
    if (!fs.existsSync(profilePath)) {
      return { success: false, reason: 'Profile not found', extracted: 0 };
    }

    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.ico'];
    const results = { mods: [], resourcepacks: [], shaders: [], extracted: 0, failed: 0 };
    const typeDirs = [
      { type: 'mods', dir: 'mods', ext: '.jar' },
      { type: 'resourcepacks', dir: 'resourcepacks', ext: ['.zip', '.jar'] },
      { type: 'shaders', dir: 'shaderpacks', ext: ['.zip', '.jar'] }
    ];

    for (const { type, dir, ext } of typeDirs) {
      const dirPath = path.join(profilePath, dir);
      const cacheDir = path.join(cacheBaseDir, dir);
      
      if (!fs.existsSync(dirPath)) continue;

      const files = fs.readdirSync(dirPath).filter(f => {
        const exts = Array.isArray(ext) ? ext : [ext];
        return exts.some(e => f.toLowerCase().endsWith(e));
      });

      for (const filename of files) {
        try {
          const cachePath = path.join(cacheDir, `${filename}.png`);
          
          // Check if already cached - skip extraction if cached
          if (fs.existsSync(cachePath)) {
            results[type].push({ filename, iconUrl: `file://${cachePath}` });
            results.extracted++;
            continue;
          }

          const filePath = path.join(dirPath, filename);
          
          // Check file size before loading into memory
          const stats = fs.statSync(filePath);
          if (stats.size > 500 * 1024 * 1024) { // Skip files larger than 500MB
            console.warn(`[IconExtractor] File too large: ${filename} (${stats.size} bytes)`);
            results.failed++;
            continue;
          }

          const data = fs.readFileSync(filePath);
          const zip = await JSZip.loadAsync(data);

          let iconFile = null;

          // Priority 1: Check root directory for any image file
          for (const [zipPath, file] of Object.entries(zip.files)) {
            if (file.dir) continue;
            
            // Check if file is in root (no slashes)
            if (!zipPath.includes('/')) {
              const hasImageExt = imageExtensions.some(ext => zipPath.toLowerCase().endsWith(ext));
              if (hasImageExt) {
                const size = file._data?.uncompressedSize || 0;
                if (size > 0 && size < 5000000) {
                  iconFile = file;
                  break;
                }
              }
            }
          }

          // Priority 2: Check common patterns
          if (!iconFile) {
            const patterns = ['pack.png', 'assets/modicon.png', 'assets/icon.png', 'logo.png', 'icon.png'];
            for (const pattern of patterns) {
              if (zip.files[pattern]) {
                iconFile = zip.files[pattern];
                break;
              }
            }
          }

          // Priority 3: Search in common directories
          if (!iconFile) {
            const searchDirs = ['assets', 'textures', 'images', 'icon'];
            const candidates = [];
            
            for (const [zipPath, file] of Object.entries(zip.files)) {
              if (file.dir) continue;
              const isInSearchDir = searchDirs.some(dir => zipPath.toLowerCase().includes(dir.toLowerCase()));
              const hasImageExt = imageExtensions.some(ext => zipPath.toLowerCase().endsWith(ext));
              
              if (isInSearchDir && hasImageExt) {
                const size = file._data?.uncompressedSize || 0;
                if (size > 0 && size < 5000000) {
                  candidates.push({ path: zipPath, file, size });
                }
              }
            }

            if (candidates.length > 0) {
              candidates.sort((a, b) => a.size - b.size);
              iconFile = candidates[0].file;
            }
          }

          let iconBuffer = null;
          
          if (iconFile) {
            const buffer = await iconFile.async('arraybuffer');
            iconBuffer = Buffer.from(buffer);
          } else {
            // Generate placeholder icon
            iconBuffer = generatePlaceholderIcon(filename);
          }

          // Save to disk cache
          if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
          }
          fs.writeFileSync(cachePath, iconBuffer);
          
          // Return file:// URL instead of base64 to avoid loading into memory
          results[type].push({ filename, iconUrl: `file://${cachePath}` });
          results.extracted++;
        } catch (e) {
          console.warn(`[IconExtractor] Failed to extract icon from ${filename}:`, e.message);
          results.failed++;
        }
      }
    }

    return { success: true, ...results };
  } catch (e) {
    console.error('[IconExtractor] Batch extraction error:', e.message);
    return { success: false, reason: e.message, extracted: 0 };
  }
});

// Scan profiles directory and return list of modpacks
ipcMain.handle('scan-profiles', async () => {
  try {
    const rootPath = path.join(getMinecraftDataPath(), 'profiles');
    const versionsPath = path.join(getMinecraftDataPath(), 'versions');
    const profiles = [];

    if (!fs.existsSync(rootPath)) {
      return { success: true, profiles: [] };
    }

    // Get installed versions for cross-referencing
    let installedVersions = [];
    if (fs.existsSync(versionsPath)) {
      installedVersions = fs.readdirSync(versionsPath, { withFileTypes: true })
        .filter(e => e.isDirectory())
        .map(e => e.name);
    }

    // Detect loader from installed versions list
    function detectLoaderFromVersions(versionId) {
      for (const v of installedVersions) {
        const vl = v.toLowerCase();
        if (vl.includes(versionId)) {
          if (vl.includes('fabric')) return 'Fabric';
          if (vl.includes('forge')) return 'Forge';
          if (vl.includes('neoforge')) return 'NeoForge';
          if (vl.includes('quilt')) return 'Quilt';
        }
      }
      return null;
    }

    // Detect MC version from mod filenames (e.g. "sodium-fabric-mc1.20.4-..." or "fabric-api-0.91.0+1.20.4")
    function detectVersionFromMods(modsPath) {
      if (!fs.existsSync(modsPath)) return null;
      const mods = fs.readdirSync(modsPath).filter(f => f.endsWith('.jar'));
      const versionPatterns = [
        /[_\-+]mc([0-9]+\.[0-9]+(?:\.[0-9]+)?)/i,   // mc1.20.4 or mc26.1.2
        /[_\-+]([0-9]+\.[0-9]+\.[0-9]+)[_\-+.]/,     // -1.20.4- or -26.1.2-
        /[_\-+]([0-9]+\.[0-9]+\.[0-9]+)$/i,           // ends with -26.1.2
        /[_\-+]([0-9]+\.[0-9]+)[_\-+]/,               // -1.20- (fallback, less specific)
      ];
      const versionCounts = {};
      for (const mod of mods) {
        for (const pattern of versionPatterns) {
          const m = mod.match(pattern);
          if (m) {
            const v = m[1];
            versionCounts[v] = (versionCounts[v] || 0) + 1;
            break;
          }
        }
      }

      if (Object.keys(versionCounts).length === 0) return null;

      // Group versions: if both "26.1" and "26.1.2" exist, the shorter one is
      // just a prefix of the longer G�� always prefer the more specific (longer) version.
      const versions = Object.keys(versionCounts);
      const filtered = versions.filter(v => {
        // Keep v only if no other version starts with v + '.'
        return !versions.some(other => other !== v && other.startsWith(v + '.'));
      });

      // Among the remaining specific versions, pick the most common
      const sorted = filtered
        .map(v => [v, versionCounts[v]])
        .sort((a, b) => b[1] - a[1]);

      return sorted.length > 0 ? sorted[0][0] : null;
    }

    // Detect loader from mod filenames
    function detectLoaderFromMods(modsPath) {
      if (!fs.existsSync(modsPath)) return null;
      const mods = fs.readdirSync(modsPath).filter(f => f.endsWith('.jar'));
      let fabric = 0, forge = 0, neoforge = 0, quilt = 0;
      for (const mod of mods) {
        const ml = mod.toLowerCase();
        if (ml.includes('fabric')) fabric++;
        if (ml.includes('neoforge')) neoforge++;
        else if (ml.includes('forge')) forge++;
        if (ml.includes('quilt')) quilt++;
      }
      // Also check for .fabric folder (definitive Fabric indicator)
      const fabricDir = path.join(path.dirname(modsPath), '.fabric');
      if (fs.existsSync(fabricDir)) return 'Fabric';
      const max = Math.max(fabric, forge, neoforge, quilt);
      if (max === 0) return null;
      if (neoforge >= max) return 'NeoForge';
      if (forge >= max) return 'Forge';
      if (fabric >= max) return 'Fabric';
      if (quilt >= max) return 'Quilt';
      return null;
    }

    const entries = fs.readdirSync(rootPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.startsWith('modpack-')) continue;

      // Skip and clean up double-prefixed duplicates created by a previous bug
      if (entry.name.startsWith('modpack-modpack-')) {
        const dupPath = path.join(rootPath, entry.name);
        // Only delete if it's empty (no mods) G�� safety check
        const dupMods = path.join(dupPath, 'mods');
        const dupModCount = fs.existsSync(dupMods)
          ? fs.readdirSync(dupMods).filter(f => f.endsWith('.jar')).length
          : 0;
        if (dupModCount === 0) {
          try { fs.rmSync(dupPath, { recursive: true, force: true }); } catch (e) { /* non-fatal */ }
        }
        continue;
      }

      const profilePath = path.join(rootPath, entry.name);
      const profileDataPath = path.join(profilePath, 'profile.json');

      // Try reading saved profile.json first
      let profileData = {};
      if (fs.existsSync(profileDataPath)) {
        try {
          // Strip UTF-8 BOM if present before parsing
          let raw = fs.readFileSync(profileDataPath, 'utf8');
          if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
          profileData = JSON.parse(raw);
        } catch (e) {
          console.warn(`[Profiles] Failed to read profile.json for ${entry.name}:`, e.message);
        }
      }

      const modsPath = path.join(profilePath, 'mods');

      // Auto-detect version and loader if not in profile.json
      let mcVersion = profileData.mcVersion;
      let loader = profileData.loader;

      if (!mcVersion || mcVersion === 'Unknown') {
        const detected = detectVersionFromMods(modsPath);
        mcVersion = detected && isValidMcVersion(detected) ? detected : 'Unknown';
      }
      if (!loader || loader === 'Vanilla') {
        loader = detectLoaderFromMods(modsPath)
          || detectLoaderFromVersions(mcVersion)
          || 'Vanilla';
      }

      // Count files AND build file lists for each category
      const scanDir = (dir, exts) => {
        const dirPath = path.join(profilePath, dir);
        if (!fs.existsSync(dirPath)) return [];
        try {
          return fs.readdirSync(dirPath)
            .filter(f => {
              try {
                if (!fs.statSync(path.join(dirPath, f)).isFile()) return false;
                if (exts) return exts.some(e => f.toLowerCase().endsWith(e));
                return true;
              } catch { return false; }
            })
            .map(f => ({ filename: f }));
        } catch { return []; }
      };

      const diskMods         = scanDir('mods', ['.jar']);
      const diskResourcepacks = scanDir('resourcepacks', ['.zip', '.jar']);
      const diskShaders       = scanDir('shaderpacks', ['.zip', '.jar']);



      const modCount = diskMods.length;
      const rpCount  = diskResourcepacks.length;
      const shCount  = diskShaders.length;

      // Build a friendly name from profile.json or folder name
      let name = profileData.name;
      // Only generate a name if there isn't one, or it was previously auto-generated with wrong version
      if (!name || name === `Modpack (${profileData.mcVersion} -+ ${profileData.loader})`) {
        name = `Modpack (${mcVersion} -+ ${loader})`;
      }

      // Only write back to profile.json if we actually auto-detected something new
      const needsWrite = (!profileData.mcVersion || profileData.mcVersion === 'Unknown') ||
                         (!profileData.loader    || profileData.loader    === 'Vanilla') ||
                         (!profileData.id); // also write if id is missing
      if (needsWrite) {
        const folderId = entry.name.replace(/^modpack-/, '');
        try {
          const json = JSON.stringify({ ...profileData, id: folderId, name, mcVersion, loader }, null, 2);
          fs.writeFileSync(profileDataPath, Buffer.from(json, 'utf8'));
        } catch (e) { /* non-fatal */ }
      }

      profiles.push({
        id: entry.name.replace(/^modpack-/, ''),
        name,
        mcVersion,
        loader,
        modCount,
        rpCount,
        shCount,
        iconUrl: profileData.iconUrl || null,
        diskMods,
        diskResourcepacks,
        diskShaders,
        lastPlayed: profileData.lastPlayed || null,
      });
    }

    return { success: true, profiles: profiles.sort((a, b) => a.name.localeCompare(b.name)) };
  } catch (e) {
    console.error('[Profiles] Scan failed:', e.message);
    return { success: false, error: e.message, profiles: [] };
  }
});

// --- Download Queue Manager IPC Handlers ---
const DownloadQueueManager = require('./src/backend/download-queue-manager.cjs');
const IntegrityVerifier = require('./src/backend/integrity-verifier.cjs');

// --- Settings Manager ---
const SettingsManager = require('./src/backend/settings-manager.cjs');

// Global download manager instance
let downloadManager = null;

// Global settings manager instance
let settingsManager = null;

function getDownloadManager() {
  if (!downloadManager) {
    downloadManager = new DownloadQueueManager({
      concurrency: 4,
      chunkSize: 1048576, // 1MB
      timeout: 30000,
      maxRetries: 3,
      verifyIntegrity: true,
      resumeEnabled: true,
      autoRetry: true
    });

    // Set up event listeners to forward to renderer
    downloadManager.on('progress', (data) => {
      if (mainWindow) {
        mainWindow.webContents.send('download-progress', data.downloadId, data);
      }
    });

    downloadManager.on('download-completed', (data) => {
      if (mainWindow) {
        mainWindow.webContents.send('download-complete', data.downloadId, { success: true, ...data });
      }
    });

    downloadManager.on('download-failed', (data) => {
      if (mainWindow) {
        mainWindow.webContents.send('download-error', data.downloadId, {
          type: 'download-failed',
          message: `Download failed: ${data.failedItems.length} items failed`,
          details: data.failedItems
        });
      }
    });

    downloadManager.on('item-failed', (data) => {
      if (mainWindow) {
        mainWindow.webContents.send('download-error', data.downloadId, {
          type: 'item-failed',
          message: `Failed to download ${data.itemName}: ${data.error}`,
          itemId: data.itemId,
          itemName: data.itemName,
          error: data.error,
          retryCount: data.retryCount
        });
      }
    });

    downloadManager.on('paused', (data) => {
      if (mainWindow) {
        mainWindow.webContents.send('download-paused', data.downloadId);
      }
    });

    downloadManager.on('resumed', (data) => {
      if (mainWindow) {
        mainWindow.webContents.send('download-resumed', data.downloadId);
      }
    });

    downloadManager.on('cancelled', (data) => {
      if (mainWindow) {
        mainWindow.webContents.send('download-cancelled', data.downloadId);
      }
    });

    // Error handling events
    downloadManager.on('integrity-verification-failed', (data) => {
      if (mainWindow) {
        mainWindow.webContents.send('download-error', data.downloadId, {
          type: 'integrity-verification-failed',
          message: `Integrity verification failed: ${data.report.failedItems} files corrupted, ${data.report.missingItems} files missing`,
          report: data.report,
          failedItems: data.failedItems
        });
      }
    });

    downloadManager.on('verification-error', (data) => {
      if (mainWindow) {
        mainWindow.webContents.send('download-error', data.downloadId, {
          type: 'verification-error',
          message: `Verification error: ${data.error}`
        });
      }
    });

    downloadManager.on('finalization-error', (data) => {
      if (mainWindow) {
        mainWindow.webContents.send('download-error', data.downloadId, {
          type: 'finalization-error',
          message: `Download finalization error: ${data.error}`
        });
      }
    });
  }
  return downloadManager;
}

function getSettingsManager() {
  if (!settingsManager) {
    settingsManager = new SettingsManager(app.getPath('userData'));
  }
  return settingsManager;
}

let _mcDataPathCache = null;

function invalidateMinecraftDataPathCache() {
  _mcDataPathCache = null;
}

function getMinecraftDataPath() {
  if (_mcDataPathCache) return _mcDataPathCache;

  const manager = getSettingsManager();
  
  // Check in-memory settings first
  const customPath = manager.settings.customMinecraftPath?.value;
  if (customPath && typeof customPath === 'string' && customPath.trim() !== '') {
    _mcDataPathCache = customPath;
    return customPath;
  }

  // If the settings file has not been loaded into memory yet, do a quick synchronous read
  try {
    if (fs.existsSync(manager.settingsPath)) {
      const raw = fs.readFileSync(manager.settingsPath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && parsed.customMinecraftPath) {
        const val = parsed.customMinecraftPath.value !== undefined ? parsed.customMinecraftPath.value : parsed.customMinecraftPath;
        if (val && typeof val === 'string' && val.trim() !== '') {
          _mcDataPathCache = val;
          return val;
        }
      }
    }
  } catch (e) {
    console.error('[MinecraftPath] Error loading settings synchronously:', e.message);
  }

  // Fall back to default path G�� never recurse
  _mcDataPathCache = path.join(app.getPath('userData'), 'minecraft-data');
  return _mcDataPathCache;
}


// Global integrity verifier instance
let integrityVerifier = null;

function getIntegrityVerifier() {
  if (!integrityVerifier) {
    integrityVerifier = new IntegrityVerifier({
      defaultAlgorithm: 'sha256'
    });
  }
  return integrityVerifier;
}

// IPC Handler: Start download
ipcMain.handle('start-download', async (event, downloadId, items, downloadPath) => {
  try {
    const manager = getDownloadManager();
    const session = await manager.startDownload(downloadId, items, downloadPath);
    return { success: true, session };
  } catch (error) {
    console.error('[Download IPC] start-download error:', error.message);
    return { success: false, error: error.message };
  }
});

// IPC Handler: Pause download
ipcMain.handle('pause-download', async (event, downloadId) => {
  try {
    const manager = getDownloadManager();
    await manager.pauseDownload(downloadId);
    return { success: true };
  } catch (error) {
    console.error('[Download IPC] pause-download error:', error.message);
    return { success: false, error: error.message };
  }
});

// IPC Handler: Resume download
ipcMain.handle('resume-download', async (event, downloadId) => {
  try {
    const manager = getDownloadManager();
    await manager.resumeDownload(downloadId);
    return { success: true };
  } catch (error) {
    console.error('[Download IPC] resume-download error:', error.message);
    return { success: false, error: error.message };
  }
});

// IPC Handler: Cancel download
ipcMain.handle('cancel-download', async (event, downloadId) => {
  try {
    const manager = getDownloadManager();
    await manager.cancelDownload(downloadId);
    return { success: true };
  } catch (error) {
    console.error('[Download IPC] cancel-download error:', error.message);
    return { success: false, error: error.message };
  }
});

// IPC Handler: Get download status
ipcMain.handle('get-download-status', async (event, downloadId) => {
  try {
    const manager = getDownloadManager();
    const status = manager.getDownloadStatus(downloadId);
    return { success: true, status };
  } catch (error) {
    console.error('[Download IPC] get-download-status error:', error.message);
    return { success: false, error: error.message };
  }
});

// IPC Handler: Verify download integrity
ipcMain.handle('verify-download-integrity', async (event, downloadId, items, downloadPath) => {
  try {
    const verifier = getIntegrityVerifier();
    const report = await verifier.verifyDownload(downloadId, items, downloadPath);
    return { success: true, report };
  } catch (error) {
    console.error('[Integrity IPC] verify-download-integrity error:', error.message);
    return { success: false, error: error.message };
  }
});

// IPC Handler: Verify single file checksum
ipcMain.handle('verify-checksum', async (event, filePath, expectedHash, algorithm) => {
  try {
    const verifier = getIntegrityVerifier();
    const isValid = await verifier.verifyChecksum(filePath, expectedHash, algorithm);
    return { success: true, isValid };
  } catch (error) {
    console.error('[Integrity IPC] verify-checksum error:', error.message);
    return { success: false, error: error.message };
  }
});

// IPC Handler: Detect missing items
ipcMain.handle('detect-missing-items', async (event, items, downloadPath) => {
  try {
    const verifier = getIntegrityVerifier();
    const missingItems = verifier.detectMissingItems(items, downloadPath);
    return { success: true, missingItems };
  } catch (error) {
    console.error('[Integrity IPC] detect-missing-items error:', error.message);
    return { success: false, error: error.message };
  }
});

app.on('will-quit', () => {
  if (activeTunnelProcess) {
    try { activeTunnelProcess.kill(); } catch (e) { }
  }
});



// IPC Handler: Browse custom Minecraft path
ipcMain.handle('select-minecraft-folder', async (event) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Custom Minecraft Data Folder',
      properties: ['openDirectory', 'createDirectory']
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false };
    }
    return { success: true, filePath: result.filePaths[0] };
  } catch (error) {
    console.error('[Settings IPC] select-minecraft-folder error:', error.message);
    return { success: false, error: error.message };
  }
});

// --- Settings Manager IPC Handlers ---

// IPC Handler: Load settings
ipcMain.handle('load-settings', async (event) => {
  try {
    const manager = getSettingsManager();
    const settings = await manager.loadSettings();
    const allSettings = manager.getAllSettings();
    return { success: true, settings, metadata: allSettings };
  } catch (error) {
    console.error('[Settings IPC] load-settings error:', error.message);
    return { success: false, error: error.message };
  }
});

// IPC Handler: Save settings
ipcMain.handle('save-settings', async (event, newSettings) => {
  try {
    const manager = getSettingsManager();
    await manager.saveSettings(newSettings);
    return { success: true };
  } catch (error) {
    console.error('[Settings IPC] save-settings error:', error.message);
    return { success: false, error: error.message };
  }
});

// IPC Handler: Reset to defaults
ipcMain.handle('reset-settings', async (event) => {
  try {
    const manager = getSettingsManager();
    await manager.resetToDefaults();
    const settings = await manager.loadSettings();
    return { success: true, settings };
  } catch (error) {
    console.error('[Settings IPC] reset-settings error:', error.message);
    return { success: false, error: error.message };
  }
});

// IPC Handler: Export settings
ipcMain.handle('export-settings', async (event) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Settings',
      defaultPath: 'launcher-settings.json',
      filters: [{ name: 'JSON File', extensions: ['json'] }]
    });
    
    if (result.canceled || !result.filePath) {
      return { success: false, error: 'Export cancelled' };
    }
    
    const manager = getSettingsManager();
    await manager.exportSettings(result.filePath);
    return { success: true, path: result.filePath };
  } catch (error) {
    console.error('[Settings IPC] export-settings error:', error.message);
    return { success: false, error: error.message };
  }
});

// IPC Handler: Import settings
ipcMain.handle('import-settings', async (event) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Settings',
      filters: [{ name: 'JSON File', extensions: ['json'] }],
      properties: ['openFile']
    });
    
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: 'Import cancelled' };
    }
    
    const manager = getSettingsManager();
    const settings = await manager.importSettings(result.filePaths[0]);
    return { success: true, settings };
  } catch (error) {
    console.error('[Settings IPC] import-settings error:', error.message);
    return { success: false, error: error.message };
  }
});

// IPC Handler: Get settings by category
ipcMain.handle('get-settings-by-category', async (event, category) => {
  try {
    const manager = getSettingsManager();
    const settings = manager.getSettingsByCategory(category);
    return { success: true, settings };
  } catch (error) {
    console.error('[Settings IPC] get-settings-by-category error:', error.message);
    return { success: false, error: error.message };
  }
});

// IPC Handler: Search settings
ipcMain.handle('search-settings', async (event, query) => {
  try {
    const manager = getSettingsManager();
    const results = manager.searchSettings(query);
    return { success: true, results };
  } catch (error) {
    console.error('[Settings IPC] search-settings error:', error.message);
    return { success: false, error: error.message };
  }
});

// IPC Handler: Get all categories
ipcMain.handle('get-settings-categories', async (event) => {
  try {
    const manager = getSettingsManager();
    const categories = manager.getCategories();
    return { success: true, categories };
  } catch (error) {
    console.error('[Settings IPC] get-settings-categories error:', error.message);
    return { success: false, error: error.message };
  }
});

// IPC Handler: Select custom modpack icon
ipcMain.handle('select-image', async (event) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Modpack Icon',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['jpg', 'png', 'jpeg', 'webp'] }]
    });
    
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false };
    }

    const sourcePath = result.filePaths[0];
    const customIconsDir = path.join(app.getPath('userData'), 'custom-icons');
    if (!fs.existsSync(customIconsDir)) {
      fs.mkdirSync(customIconsDir, { recursive: true });
    }

    const ext = path.extname(sourcePath).toLowerCase();
    const fileName = crypto.randomUUID() + ext;
    const targetPath = path.join(customIconsDir, fileName);

    fs.copyFileSync(sourcePath, targetPath);

    return { success: true, url: 'idk-cache://custom-icons/' + fileName };
  } catch (error) {
    console.error('[Main IPC] select-image error:', error);
    return { success: false, error: error.message };
  }
});

// ============================================================
// === END OF FILE =============================================
// ============================================================

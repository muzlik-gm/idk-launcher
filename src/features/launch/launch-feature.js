import { state, actions } from '../../core/app-state.js';

function updateSetupDisplay() {
  const el = document.getElementById('play-dd-setup-value');
  if (el) {
    if (state.selectedIsModpack) {
      const mp = (JSON.parse(localStorage.getItem('idk_modpacks') || '[]')).find(m => m.id === state.selectedModpackId);
      if (mp) {
        el.textContent = `${mp.name}`;
        return;
      }
    }
    el.textContent = `${state.selectedVersion || '—'} · ${state.selectedLoader || 'Vanilla'}`;
  }
}

function populateVersionList() {
  const list = document.getElementById('play-dd-version-list');
  if (!list) return;

  const downloadedList = (state.allVersions || []).filter(v =>
    state.downloadedVersions.includes(v.id)
  );

  if (downloadedList.length === 0) {
    list.innerHTML = `
      <div style="padding:12px 8px;text-align:center;color:rgba(255,255,255,0.5);font-size:11px;line-height:1.5;">
        No versions installed yet.<br>
        <span style="display:inline-block;margin-top:8px;padding:6px 14px;border-radius:4px;background:rgba(var(--theme-accent-rgb),0.15);color:var(--theme-accent-bright);cursor:pointer;font-family:var(--font-title);font-size:11px;letter-spacing:0.5px;" id="play-dd-go-modpacks">
          Download a Version
        </span>
      </div>
    `;
    const goBtn = document.getElementById('play-dd-go-modpacks');
    if (goBtn) {
      goBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pd = document.getElementById('play-dropdown');
        const pdt = document.getElementById('play-dropdown-trigger');
        if (pd) pd.classList.remove('active');
        if (pdt) pdt.classList.remove('active');
        if (actions.switchView) actions.switchView('mods');
      });
    }
    return;
  }

  // Show up to 8 downloaded versions (latest first)
  const sorted = [...downloadedList].sort((a, b) => {
    const idxA = state.allVersions.indexOf(a);
    const idxB = state.allVersions.indexOf(b);
    return idxA - idxB;
  }).slice(0, 8);

  function getLoaderForVersion(verId) {
    // Truth source: actual installed loader from disk scan
    if (window.__installedLoaders && window.__installedLoaders[verId]) return window.__installedLoaders[verId];
    return 'Vanilla';
  }

  list.innerHTML = '';
  
  const modpacks = JSON.parse(localStorage.getItem('idk_modpacks') || '[]');
  const favorites = modpacks.filter(mp => mp.favorite && !mp.isTemporary);
  
  if (favorites.length > 0) {
    const header = document.createElement('div');
    header.style.cssText = 'padding:6px 10px 4px;font-size:9px;font-weight:700;color:var(--theme-accent);letter-spacing:1px;text-transform:uppercase;';
    header.textContent = 'Favorite Modpacks';
    list.appendChild(header);

    favorites.forEach(mp => {
      const wrapper = document.createElement('div');
      wrapper.className = 'play-dd-version-wrapper';
      wrapper.innerHTML = `
        <button class="play-dd-version-btn${mp.id === state.selectedModpackId ? ' active' : ''}" data-modpack="${mp.id}">
          <span class="play-dd-version-id" style="color:var(--theme-accent-bright);"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="margin-right:4px;vertical-align:-1px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>${mp.name}</span>
          <span class="play-dd-version-loader">${mp.mcVersion} · ${mp.loader}</span>
        </button>
      `;
      const btn = wrapper.querySelector('.play-dd-version-btn');
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.selectedIsModpack = true;
        state.selectedModpackId = mp.id;
        state.selectedVersion = mp.mcVersion;
        state.selectedLoader = mp.loader;
        const txt = document.getElementById('selected-version-text');
        if (txt) txt.textContent = `Modpack: ${mp.name}`;
        
        localStorage.setItem('idk_last_played_is_modpack', 'true');
        localStorage.setItem('idk_last_played_modpack_id', mp.id);
        
        updateSetupDisplay();
        populateVersionList();
        document.getElementById('version-dropdown')?.classList.remove('open');
      });
      list.appendChild(wrapper);
    });

    const vHeader = document.createElement('div');
    vHeader.style.cssText = 'padding:6px 10px 4px;font-size:9px;font-weight:700;color:rgba(255,255,255,0.4);letter-spacing:1px;text-transform:uppercase;margin-top:6px;border-top:1px solid rgba(255,255,255,0.05);';
    vHeader.textContent = 'Versions';
    list.appendChild(vHeader);
  } else {
    const vHeader = document.createElement('div');
    vHeader.style.cssText = 'padding:6px 10px 4px;font-size:9px;font-weight:700;color:rgba(255,255,255,0.4);letter-spacing:1px;text-transform:uppercase;';
    vHeader.textContent = 'Versions';
    list.appendChild(vHeader);
  }

  sorted.forEach(v => {
    const loader = getLoaderForVersion(v.id);
    const wrapper = document.createElement('div');
    wrapper.className = 'play-dd-version-wrapper';
    wrapper.innerHTML = `
      <button class="play-dd-version-btn${v.id === state.selectedVersion && !state.selectedIsModpack ? ' active' : ''}" data-version="${v.id}">
        <span class="play-dd-version-id">${v.id}</span>
        <span class="play-dd-version-loader">${loader}</span>
      </button>
    `;
    const btn = wrapper.querySelector('.play-dd-version-btn');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.selectedIsModpack = false;
      state.selectedModpackId = null;
      localStorage.setItem('idk_last_played_is_modpack', 'false');
      
      state.selectedVersion = v.id;
      const txt = document.getElementById('selected-version-text');
      if (txt) txt.textContent = `Version: ${v.id}`;
      localStorage.setItem('idk_last_played', JSON.stringify({ version: state.selectedVersion, loader: state.selectedLoader }));
      // Use the actual installed loader from disk, not user preference
      const installedLoader = (window.__installedLoaders && window.__installedLoaders[v.id]) || 'Vanilla';
      state.selectedLoader = installedLoader;
      localStorage.setItem('idk_selected_loader', state.selectedLoader);
      updateLoaderUIFromDropdown(state.selectedLoader);
      updateSetupDisplay();
      populateVersionList();
      document.getElementById('version-dropdown')?.classList.remove('open');
      if (window.electronAPI) {
        window.electronAPI.saveSettings({ lastPlayedVersion: state.selectedVersion, lastPlayedLoader: state.selectedLoader }).catch(console.error);
      }
      if (actions.updateLoaderUI) actions.updateLoaderUI(state.selectedLoader);
      if (actions.renderVersions) actions.renderVersions();
    });
    list.appendChild(wrapper);
  });
}

// Own renderer for play-dropdown "All versions" modal — selects version for launch
function renderForLaunchVersionsModal(tab) {
  const list = document.getElementById('mp-all-version-list');
  if (!list) return;
  const filtered = (state.allVersions || []).filter(v => {
    if (tab === 'release') return v.type === 'release';
    if (tab === 'snapshot') return v.type === 'snapshot';
    if (tab === 'old') return v.type === 'old_beta' || v.type === 'old_alpha';
    return true;
  });
  list.innerHTML = '';
  filtered.forEach(v => {
    const isDownloaded = state.downloadedVersions.includes(v.id);
    const installedLoader = (window.__installedLoaders && window.__installedLoaders[v.id]) || null;
    const label = v.type === 'release' ? 'Release' : v.type === 'snapshot' ? 'Snapshot' : 'Old';
    const item = document.createElement('div');
    item.className = 'mp-version-download-item' + (isDownloaded ? ' downloaded' : '');
    if (isDownloaded) {
      item.style.cursor = 'pointer';
      item.title = 'Click to select this version for launch';
    }
    item.innerHTML = `
      <span style="display:flex;align-items:center;gap:8px;">
        <span class="version-name">${v.id}</span>
        ${isDownloaded && installedLoader ? `<span class="mp-dl-loader-badge">${installedLoader}</span>` : ''}
        <span class="version-type">${label}</span>
      </span>
      <button type="button" class="mp-dl-btn${isDownloaded ? ' downloaded' : ''}" data-version="${v.id}">
        ${isDownloaded ? 'Use' : 'Download'}
      </button>
    `;
    const btn = item.querySelector('.mp-dl-btn');
    if (isDownloaded) {
      const handler = (e) => {
        e.stopPropagation();
        state.selectedVersion = v.id;
        const txt = document.getElementById('selected-version-text');
        if (txt) txt.textContent = `Version: ${v.id}`;
        const loader = installedLoader || 'Vanilla';
        state.selectedLoader = loader;
        localStorage.setItem('idk_last_played', JSON.stringify({ version: v.id, loader }));
        localStorage.setItem('idk_selected_loader', loader);
        if (window.electronAPI) {
          window.electronAPI.saveSettings({ lastPlayedVersion: v.id, lastPlayedLoader: loader }).catch(console.error);
        }
        if (actions.updateLoaderUI) actions.updateLoaderUI(loader);
        document.getElementById('mp-all-versions-modal')?.classList.remove('active');
      };
      btn.addEventListener('click', handler);
      item.addEventListener('click', handler);
    } else {
      const startDownload = async (e) => {
        e?.stopPropagation?.();
        e?.preventDefault?.();
        if (!window.electronAPI?.downloadVersion) {
          console.warn('[Launch] downloadVersion API is unavailable');
          return;
        }
        document.getElementById('mp-all-versions-modal')?.classList.remove('active');
        const panelShow = window.showDownloadPanel || window.showDlPanel;
        const panelUpdate = window.updateDownloadPanel || window.updateDlPanel;
        const panelHide = window.hideDownloadPanel || window.hideDlPanel;
        panelShow?.(`Downloading ${v.id}...`, 5, 'Downloading Minecraft Version');
        btn.classList.add('downloading');
        btn.textContent = 'Downloading...';
        btn.disabled = true;
        const progressHandler = (data) => {
          const payload = data?.downloadId ? data : (data || {});
          panelUpdate?.(
            payload.status || `Downloading ${v.id}...`,
            Number.isFinite(payload.percent) ? payload.percent : 5,
            payload.speed,
            payload.eta,
            payload.item || v.id
          );
        };
        const removeProgress = window.electronAPI.onDownloadProgress?.(progressHandler);
        try {
          const result = await window.electronAPI.downloadVersion({ version: v.id });
          if (!result?.success) throw new Error(result?.error || `Failed to download Minecraft ${v.id}`);
          if (!state.downloadedVersions.includes(v.id)) {
            state.downloadedVersions.push(v.id);
            localStorage.setItem('idk_downloaded_versions', JSON.stringify(state.downloadedVersions));
          }
          btn.classList.remove('downloading');
          btn.classList.add('downloaded');
          btn.textContent = 'Use';
          btn.disabled = false;
          panelHide?.();
          renderForLaunchVersionsModal(currentLaunchTab);
        } catch (err) {
          console.error('[Launch] Version download failed:', err);
          btn.classList.remove('downloading');
          btn.textContent = 'Failed';
          panelHide?.();
          setTimeout(() => { btn.textContent = 'Download'; btn.disabled = false; }, 2000);
        } finally {
          removeProgress?.();
        }
      };
      btn.addEventListener('click', startDownload);
      item.addEventListener('click', startDownload);
    }
    list.appendChild(item);
  });
}
let currentLaunchTab = 'release';
window.showLaunchVersionPicker = () => {
  document.getElementById('mp-all-versions-modal')?.classList.add('active');
  // Clone-replace tab buttons to strip modpacks-feature's event listeners
  document.querySelectorAll('#mp-all-versions-modal [data-dl-tab]').forEach(oldBtn => {
    const clone = oldBtn.cloneNode(true);
    oldBtn.parentNode.replaceChild(clone, oldBtn);
    clone.addEventListener('click', () => {
      document.querySelectorAll('#mp-all-versions-modal [data-dl-tab]').forEach(b => b.classList.remove('active'));
      clone.classList.add('active');
      renderForLaunchVersionsModal(clone.getAttribute('id').replace('mp-dl-tab-', ''));
    });
  });
  renderForLaunchVersionsModal('release');
};

function updateLoaderUIFromDropdown(loaderName) {
  document.querySelectorAll('.play-dd-loader-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-loader') === loaderName);
  });
}

export function initLaunchFeature() {
// --- PLAY BUTTON DROPDOWN ---
const playDropdown = document.getElementById('play-dropdown');
const playDropdownTrigger = document.getElementById('play-dropdown-trigger');

if (playDropdownTrigger && playDropdown) {
  playDropdownTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    playDropdown.classList.toggle('active');
    playDropdownTrigger.classList.toggle('active');
    if (playDropdown.classList.contains('active')) {
      updateSetupDisplay();
      populateVersionList();
      updateLoaderUIFromDropdown(state.selectedLoader);
    }
  });

  document.getElementById('play-dd-modpacks').addEventListener('click', () => {
    playDropdown.classList.remove('active');
    playDropdownTrigger.classList.remove('active');
    actions.switchView('mods');
  });

  document.getElementById('play-dd-all-versions').addEventListener('click', (e) => {
    e.stopPropagation();
    playDropdown.classList.remove('active');
    playDropdownTrigger.classList.remove('active');
    if (window.showLaunchVersionPicker) {
      window.showLaunchVersionPicker();
    } else {
      const versionDropdown = document.getElementById('version-dropdown');
      if (versionDropdown) {
        versionDropdown.classList.add('open');
        document.getElementById('selected-version-text')?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  });

  // Loader buttons
  document.querySelectorAll('.play-dd-loader-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const loader = btn.getAttribute('data-loader');
      state.selectedLoader = loader;
      localStorage.setItem('idk_selected_loader', loader);
      if (state.selectedVersion) {
        if (!state.versionSettings[state.selectedVersion]) {
          state.versionSettings[state.selectedVersion] = {};
        }
        state.versionSettings[state.selectedVersion].loader = loader;
        localStorage.setItem('idk_version_settings', JSON.stringify(state.versionSettings));
      }
      if (window.electronAPI) {
        window.electronAPI.saveSettings({ lastPlayedLoader: loader, versionSettings: state.versionSettings }).catch(console.error);
      }
      updateLoaderUIFromDropdown(loader);
      updateSetupDisplay();
      if (actions.updateLoaderUI) actions.updateLoaderUI(loader);
    });
  });

  // Force update checkbox (in Settings > Launch tab)
  const forceUpdateCb = document.getElementById('force-update-toggle');
  if (forceUpdateCb) {
    forceUpdateCb.checked = state.forceUpdate;
    forceUpdateCb.addEventListener('change', () => {
      state.forceUpdate = forceUpdateCb.checked;
      localStorage.setItem('idk_force_update', state.forceUpdate);
    });
  }

  document.addEventListener('click', (e) => {
    const wrapper = document.getElementById('play-btn-wrapper');
    if (wrapper && !wrapper.contains(e.target)) {
      playDropdown.classList.remove('active');
      playDropdownTrigger.classList.remove('active');
    }
  });
}

// --- PLAY LOGIC ---
const playBtn = document.getElementById('play-btn');
const overlay = document.getElementById('launch-overlay');
const launchStatus = document.getElementById('launch-status');
const launchFill = document.getElementById('launch-fill');
const cancelLaunchBtn = document.getElementById('btn-cancel-launch');

// Helper: null-safe setters so IPC callbacks never throw if an element is
// missing (e.g. after a hot-reload that didn't re-create the shell).
const setLaunchFill = (pct) => { if (launchFill) launchFill.style.width = pct; };
const setLaunchStatus = (txt) => { if (launchStatus) launchStatus.innerText = txt; };
const setPlayBtn = (txt, opts = {}) => {
  if (!playBtn) return;
  if (txt != null) playBtn.innerText = txt;
  playBtn.classList.toggle('running', !!opts.running);
  playBtn.disabled = !!opts.disabled;
};
const hideOverlay = () => {
  if (overlay) { overlay.classList.remove('active'); overlay.classList.remove('minimized'); }
};

const mcFunStatuses = [
  "Waking up the Iron Golems...",
  "Feeding the Baby Turtles...",
  "Polishing Diamond Chestplates...",
  "Distracting the Creepers...",
  "Taming a pack of Wolves...",
  "Avoiding the Warden's gaze...",
  "Brewing Swiftness potions...",
  "Trading emeralds with Villagers...",
  "Mining straight down (don't!)...",
  "Spawning Herobrine...",
  "Placing redstone repeaters...",
  "Dodging skeleton arrows...",
  "Shearing pink sheep...",
  "Crafting a Netherite Hoe...",
  "Polishing smooth stone...",
  "Charging the Respawn Anchor...",
  "Watering the Nether Warts...",
  "Chasing Endermen away...",
  "Cleaning up the inventory...",
  "Smelting ancient debris...",
  "Befriending the Allays...",
  "Collecting dragon breath..."
];

let activeFunStatus = "";

function getFunStatus(status) {
  if (!status) return "";
  const s = status.toLowerCase();
  if (s.includes('downloading assets') || 
      s.includes('downloading file') || 
      s.includes('fetching manifest') || 
      s.includes('preparing') || 
      s.includes('asset')) {
    if (!activeFunStatus) {
      activeFunStatus = mcFunStatuses[Math.floor(Math.random() * mcFunStatuses.length)];
    }
    return activeFunStatus;
  }
  activeFunStatus = "";
  return status;
}

// Register ALL IPC listeners ONCE at startup — NOT inside click handlers.
// This is the fix for modpack play getting stuck: the listeners exist for both
// regular play AND modpack play without needing to be re-registered each time.
if (window.electronAPI) {
  window.electronAPI.onLaunchProgress((data) => {
    if (data && data.percent !== undefined) setLaunchFill(`${data.percent}%`);
    const text = data && data.status ? getFunStatus(data.status) : '';
    if (text) {
      setLaunchStatus(text);
      setMiniText(text);
    }
  });
  window.electronAPI.onGameLaunched(() => {
    document.body.classList.add('game-running');
    gameStartTime = Date.now();
    document.querySelectorAll('video').forEach(v => v.pause());

    // Mark the current version as downloaded since the game launched successfully
    if (state.selectedVersion && !state.downloadedVersions.includes(state.selectedVersion)) {
      state.downloadedVersions.push(state.selectedVersion);
      localStorage.setItem('idk_downloaded_versions', JSON.stringify(state.downloadedVersions));
    }

    // Update lastPlayed timestamp for the current modpack
    const mp = actions.modpacks?.mpGet?.();
    if (mp) {
      mp.lastPlayed = new Date().toISOString();
      actions.modpacks?.mpSave?.();
      actions.modpacks?.mpRenderDetail?.();
    }

    setLaunchFill('100%');
    setLaunchStatus('Game is running!');
    // Hide the mini-indicator — the game is now running independently.
    if (miniIndicator) miniIndicator.classList.remove('visible');
    setTimeout(() => {
      hideOverlay();
      setPlayBtn('RUNNING', { running: true, disabled: true });
    }, 800);
  });
  if (window.electronAPI.onEnterGameRunningMode) {
    window.electronAPI.onEnterGameRunningMode(() => {
      document.querySelectorAll('video').forEach(v => { try { v.pause(); } catch(_) {} });
      document.querySelectorAll('.hero-video, .bg-video').forEach(v => { try { v.src = ''; } catch(_) {} });
      document.body.classList.add('game-running');
      try {
        const grids = document.querySelectorAll('.news-grid, .trending-modpacks-grid');
        grids.forEach(g => { g.dataset.preLaunchContent = g.innerHTML; });
      } catch(_) {}
      try {
        document.querySelectorAll('[style*="animation"], [style*="transition"]').forEach(el => {
          el.style.animationPlayState = 'paused';
          el.style.transitionDuration = '0s';
        });
      } catch(_) {}
      try {
        const canvases = document.querySelectorAll('canvas');
        canvases.forEach(c => { try { c.width = 0; c.height = 0; } catch(_) {} });
      } catch(_) {}
      try {
        if (window.particlesJS) window.particlesJS = null;
      } catch(_) {}
      try {
        const style = document.createElement('style');
        style.id = 'ingame-perf-css';
        style.textContent = '*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition-duration: 0s !important; transition-delay: 0s !important; }';
        document.head.appendChild(style);
      } catch(_) {}
    });
  }
  window.electronAPI.onLaunchClosed((data) => {
    document.body.classList.remove('game-running');
    window.dispatchEvent(new Event('reload-content'));
    // Always dismiss the launch overlay regardless of which play button
    // initiated the launch (main page or modpack page).
    hideOverlay();
    if (miniIndicator) miniIndicator.classList.remove('visible');
    setPlayBtn('PLAY', { disabled: false });
    const mpPlayBtn = document.getElementById('btn-play-modpack');
    if (mpPlayBtn) {
      mpPlayBtn.innerText = 'PLAY';
      mpPlayBtn.classList.remove('running');
      mpPlayBtn.disabled = false;
    }

    try {
      const perfCss = document.getElementById('ingame-perf-css');
      if (perfCss) perfCss.remove();
      document.querySelectorAll('[data-pre-launch-content]').forEach(g => {
        g.innerHTML = g.dataset.preLaunchContent;
        delete g.dataset.preLaunchContent;
      });
      document.querySelectorAll('.hero-video, .bg-video').forEach(v => { try { v.play().catch(() => {}); } catch(_) {} });
      document.querySelectorAll('[style*="animation"], [style*="transition"]').forEach(el => {
        el.style.animationPlayState = '';
        el.style.transitionDuration = '';
      });
    } catch(_) {}

    // Crash / quick-exit detection
    const code = data?.code;
    const output = data?.output || '';
    const elapsed = gameStartTime ? (Date.now() - gameStartTime) / 1000 : Infinity;
    gameStartTime = 0;
    if (code !== undefined && code !== null && code !== 0) {
      const isQuickExit = elapsed < 15;
      const header = isQuickExit
        ? 'Game exited unexpectedly right after launch.'
        : `Game exited with code ${code}.`;
      const hint = output
        ? `\n\nLast output:\n${output.slice(-800)}`
        : '';
      showWarningToast(header + hint);
    } else if (output && /Exception|FATAL|Error:/.test(output) && elapsed < 15) {
      showWarningToast('Game crashed shortly after launch. Check the logs for details.');
    }

    updatePlaytime();
    updateAchievementsDisplay();
  });
  window.electronAPI.onLaunchError((error) => {
    const errMsg = typeof error === 'string' ? error : (error?.message || 'An unknown error occurred.');
    const attemptedVersion = error?.version || state.selectedVersion || 'this version';
    const attemptedLoader = error?.loader || state.selectedLoader || 'Unknown';
    hideOverlay();
    if (miniIndicator) miniIndicator.classList.remove('visible');
    setPlayBtn('PLAY', { disabled: false });
    const mpPlayBtn = document.getElementById('btn-play-modpack');
    if (mpPlayBtn) {
      mpPlayBtn.innerText = 'PLAY';
      mpPlayBtn.classList.remove('running');
      mpPlayBtn.disabled = false;
    }

    const errorMessageEl = document.getElementById('error-message');
    const errorModal = document.getElementById('error-modal');
    if (!errorMessageEl || !errorModal) {
      // Element missing — fall back to a warning toast so the error isn't lost.
      showWarningToast(`Launch failed: ${errMsg}`);
      return;
    }

    // Smart loader-unavailable handling.
    // Use textContent on dynamic fields to avoid XSS via modpack name / version.
    const loaderUnavailablePattern = /(Fabric|Forge|NeoForge|Quilt).*?(not available|No.*?builds found)/i;
    const match = errMsg.match(loaderUnavailablePattern);
    if (match) {
      errorMessageEl.replaceChildren();
      const strong1 = document.createElement('strong'); strong1.textContent = attemptedLoader;
      const strong2 = document.createElement('strong'); strong2.textContent = attemptedVersion;
      errorMessageEl.append(
        strong1,
        document.createTextNode(' is not available for Minecraft '),
        strong2,
        document.createTextNode('.\n\nThis version may not have a '),
        document.createTextNode(attemptedLoader),
        document.createTextNode(' release. Use the dropdown to switch to a different loader or version, then try again.'),
      );
      // Preserve line breaks (CSS white-space: pre-wrap needed — handled by .error-message styling)
      errorMessageEl.style.whiteSpace = 'pre-wrap';
      errorModal.classList.add('active');
      return;
    }

    errorMessageEl.textContent = errMsg;
    errorMessageEl.style.whiteSpace = 'pre-wrap';
    errorModal.classList.add('active');
  });
  window.electronAPI.onLaunchWarning((msg) => showWarningToast(msg));

  // Missing mod dependencies detected from crash report
  if (window.electronAPI.onMissingDependencies) {
    window.electronAPI.onMissingDependencies(({ missing, mcVersion }) => {
      showMissingDepsModal(missing, mcVersion);
    });
  }
  window.electronAPI.onClearJavaPath(() => {
    localStorage.removeItem('craftlaunch_javaPath');
    state.javaPath = '';
    const javaPathInput = document.getElementById('java-path');
    if (javaPathInput) javaPathInput.value = '';
    showWarningToast('Auto-Healer: Incompatible Java version detected. Custom Java path was cleared to let the launcher auto-download Java 21!');
    hideOverlay();
    setPlayBtn('PLAY', { disabled: false });
  });
}

if (cancelLaunchBtn && window.electronAPI) {
  cancelLaunchBtn.addEventListener('click', () => {
    window.electronAPI.cancelLaunch?.();
    hideOverlay();
    setPlayBtn('PLAY', { disabled: false });
  });
}

// --- Minimize / restore the launch overlay ---
// When minimized, the full overlay (backdrop + card) is completely
// hidden via display:none, and a small floating "launch-mini-indicator"
// pill is shown at bottom-right. Clicking the pill restores the full
// overlay. Clicking the X on the pill dismisses the indicator only
// (the launch continues in the background).
const minimizeLaunchBtn = document.getElementById('btn-minimize-launch');
const restoreLaunchBtn = document.getElementById('btn-restore-launch');
const miniIndicator = document.getElementById('launch-mini-indicator');
const miniText = document.getElementById('launch-mini-text');
const miniClose = document.getElementById('btn-mini-close');
let miniIndicatorDismissed = false;

function setLaunchMinimized(minimized) {
  if (!overlay) return;
  overlay.classList.toggle('minimized', !!minimized);
  if (minimizeLaunchBtn) minimizeLaunchBtn.style.display = minimized ? 'none' : '';
  if (restoreLaunchBtn) restoreLaunchBtn.style.display = minimized ? '' : 'none';
  if (miniIndicator && !miniIndicatorDismissed) {
    miniIndicator.classList.toggle('visible', !!minimized);
  }
}
function setMiniText(text) {
  if (miniText) miniText.textContent = text;
}
if (minimizeLaunchBtn) minimizeLaunchBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  miniIndicatorDismissed = false;
  setLaunchMinimized(true);
});
if (restoreLaunchBtn) restoreLaunchBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  setLaunchMinimized(false);
});
// Clicking the mini-indicator pill restores the full overlay.
if (miniIndicator) {
  miniIndicator.addEventListener('click', (e) => {
    if (e.target.closest('#btn-mini-close')) return;
    setLaunchMinimized(false);
  });
  miniIndicator.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setLaunchMinimized(false);
    }
  });
}
// X button on the mini-indicator: dismiss the indicator only
// (launch keeps running in the background, no visible UI).
if (miniClose) {
  miniClose.addEventListener('click', (e) => {
    e.stopPropagation();
    miniIndicatorDismissed = true;
    miniIndicator.classList.remove('visible');
  });
}

playBtn.addEventListener('click', async (e) => {
  e.stopPropagation();
  if (overlay?.classList.contains('active') && !overlay.classList.contains('minimized')) {
    return;
  }
  localStorage.setItem('idk_last_played', JSON.stringify({ version: state.selectedVersion, loader: state.selectedLoader }));
  if (window.electronAPI) {
    window.electronAPI.saveSettings({ lastPlayedVersion: state.selectedVersion, lastPlayedLoader: state.selectedLoader }).catch(console.error);
  }
  overlay.classList.remove('minimized');
  overlay.classList.add('active');
  gameStartTime = Date.now();
  launchFill.style.width = '0%';
  launchStatus.innerText = 'Initializing...';
  let authData = null;
  try {
    if (state.authMode === 'elyby' && window.electronAPI?.getElybyAuthData) {
      authData = (await window.electronAPI.getElybyAuthData()).data || null;
    } else if (state.authMode === 'microsoft' && window.electronAPI?.getMicrosoftAuthData) {
      authData = (await window.electronAPI.getMicrosoftAuthData()).data || null;
    }
  } catch (e) {
    console.warn('[Launch] Auth retrieval failed:', e);
  }

  if (window.electronAPI) {
    const windowSize = {
      width: state.defaultWindowWidth,
      height: state.defaultWindowHeight,
      fullscreen: state.defaultFullscreen,
      enableOverlay: state.enableOverlay,
      hideLauncher: state.hideLauncher === true
    };

    if (state.selectedIsModpack && state.selectedModpackId) {
      const modpacks = JSON.parse(localStorage.getItem('idk_modpacks') || '[]');
      const mp = modpacks.find(m => m.id === state.selectedModpackId);
      if (mp) {
        const fallbackVersion = state.downloadedVersions?.[0] || state.selectedVersion || "1.20.1";
        const resolvedModpackVersion = mp.mcVersion ? mp.mcVersion : (state.versionSettings?.[mp.id]?.mcVersion || fallbackVersion);
        const versionSettings = state.versionSettings?.[mp.id] || {};
        
        window.electronAPI.launchModpack({
          username: state.currentUser,
          modpackId: mp.id,
          modpackName: mp.name,
          mcVersion: resolvedModpackVersion,
          loader: versionSettings.loader || mp.loader,
          loaderVersion: mp.loaderVersion || "",
          javaPath: state.javaPath,
          maxMemory: `${state.maxMemoryGB}G`,
          authData,
          windowSize,
          globalJavaArgs: state.globalJavaArgs,
          quickConnect: state.quickConnectTarget,
          forceUpdate: state.forceUpdate,
        });
        state.quickConnectTarget = null;
        return;
      }
    }

    window.electronAPI.launchMinecraft(
      state.currentUser,
      state.selectedVersion,
      state.javaPath,
      state.selectedLoader,
      state.autoOptimization,
      `${state.maxMemoryGB}G`,
      authData,
      state.quickConnectTarget,
      windowSize,
      state.globalJavaArgs,
      state.forceUpdate
    );
    state.quickConnectTarget = null; // Reset after launch
  } else {
    let progress = 0;
    const statuses = ['Fetching manifest...', 'Downloading assets...', 'Finalizing...'];
    let statusIdx = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15 + 5;
      if (progress >= 100) progress = 100;
      launchFill.style.width = `${progress}%`;
      if (progress > (statusIdx + 1) * 33 && statusIdx < statuses.length - 1) {
        statusIdx++; launchStatus.innerText = getFunStatus(statuses[statusIdx]);
      }
      if (progress === 100) {
        clearInterval(interval);
        setTimeout(() => {
          overlay.classList.remove('active');
          playBtn.innerText = 'RUNNING'; playBtn.classList.add('running'); playBtn.disabled = true;
          setTimeout(() => { playBtn.innerText = 'PLAY'; playBtn.classList.remove('running'); playBtn.disabled = false; updatePlaytime(); }, 3000);
        }, 1000);
      }
    }, 200);
  }
});

// Modal Logic
document.getElementById('btn-close-modal').addEventListener('click', () => {
  document.getElementById('error-modal').classList.remove('active');
});

// Missing Dependencies Modal
function showMissingDepsModal(missing, mcVersion) {
  // Remove existing modal if any
  const existing = document.getElementById('missing-deps-modal');
  if (existing) existing.remove();

  const mp = actions.modpacks?.mpGet?.();
  const modpackId = mp ? mp.id : null;

  const modal = document.createElement('div');
  modal.id = 'missing-deps-modal';
  modal.style.cssText = `
    position:fixed;top:0;left:0;right:0;bottom:0;
    background:rgba(0,0,0,0.75);z-index:9999;
    display:flex;align-items:center;justify-content:center;
  `;

  const list = missing.map(d =>
    `<li style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:13px;">
      <strong style="color:var(--theme-accent);">${d.modId}</strong>
      <span style="color:#888;font-size:11px;margin-left:8px;">required by ${d.requiredBy}</span>
    </li>`
  ).join('');

  modal.innerHTML = `
    <div style="background:#1a1a1b;border:2px solid var(--theme-accent);border-radius:8px;padding:32px;max-width:480px;width:90%;font-family:var(--font-title);">
      <div style="text-align:center;margin-bottom:20px;">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" style="margin-bottom:12px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
        <h2 style="font-size:20px;color:white;margin:0 0 8px;">Missing Dependencies</h2>
        <p style="color:#888;font-size:13px;margin:0;">The game crashed because these required mods are missing:</p>
      </div>
      <ul style="list-style:none;padding:0;margin:0 0 24px;max-height:200px;overflow-y:auto;">${list}</ul>
      <div style="display:flex;gap:10px;">
        <button id="btn-auto-install-deps" style="flex:1;background:var(--theme-accent);border:none;border-radius:4px;padding:12px;color:white;font-family:var(--font-title);font-size:13px;font-weight:700;cursor:pointer;">
          Auto-Install All
        </button>
        <button id="btn-dismiss-deps" style="flex:1;background:#3a3a3b;border:none;border-radius:4px;padding:12px;color:white;font-family:var(--font-title);font-size:13px;font-weight:700;cursor:pointer;">
          Dismiss
        </button>
      </div>
      <div id="deps-install-status" style="margin-top:12px;font-size:12px;color:#888;text-align:center;"></div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('btn-dismiss-deps').onclick = () => modal.remove();

  document.getElementById('btn-auto-install-deps').onclick = async () => {
    if (!modpackId || !window.electronAPI) {
      document.getElementById('deps-install-status').innerText = 'Cannot auto-install: no active modpack.';
      return;
    }
    const btn = document.getElementById('btn-auto-install-deps');
    btn.disabled = true;
    btn.innerText = 'Installing...';
    const status = document.getElementById('deps-install-status');
    status.innerText = 'Searching Modrinth for dependencies...';

    try {
      const results = await window.electronAPI.autoInstallDependencies({ modpackId, missing, mcVersion });
      const succeeded = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      // Add installed mods to the modpack profile
      if (succeeded.length > 0) {
        const mp = actions.modpacks?.mpGet?.();
        if (mp) {
          succeeded.forEach(r => {
            if (!mp.mods.find(m => m.filename === r.filename)) {
              mp.mods.push({ name: r.name || r.modId, filename: r.filename, modrinthId: r.modId, version: '', iconUrl: '' });
            }
          });
          actions.modpacks?.mpSave?.();
          actions.modpacks?.mpRenderDetail?.();
          actions.modpacks?.mpRenderList?.();
        }
      }

      if (failed.length === 0) {
        status.style.color = 'var(--theme-accent)';
        status.innerText = `\u2713 Installed ${succeeded.length} dependencies. Launch the game again!`;
        btn.innerText = 'Done!';
      } else {
        status.style.color = '#f59e0b';
        status.innerText = `Installed ${succeeded.length}, failed ${failed.length}: ${failed.map(f => f.modId).join(', ')}`;
        btn.innerText = 'Partial Install';
      }
    } catch (e) {
      status.style.color = '#ef4444';
      status.innerText = 'Error: ' + e.message;
      btn.disabled = false;
      btn.innerText = 'Retry';
    }
  };
}

// Warning Toast Logic
let toastTimeout = null;
function showWarningToast(msg) {
  const toast = document.getElementById('warning-toast');
  document.getElementById('warning-toast-msg').innerText = msg;
  toast.classList.add('visible');
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('visible'), 6000);
}

// Playtime Tracking Logic
let gameStartTime = 0;

function updatePlaytimeDisplay() {
  const totalMs = parseInt(localStorage.getItem('idk_playtime') || '0');
  const hours = (totalMs / (1000 * 60 * 60)).toFixed(1);
  const el = document.getElementById('stat-playtime');
  if (el) el.innerText = `${hours}h`;
}

async function updateAchievementsDisplay() {
  const el = document.getElementById('stat-achievements');
  if (!el) return;
  if (window.electronAPI && window.electronAPI.scanAllAchievements) {
    try {
      const result = await window.electronAPI.scanAllAchievements();
      if (result && result.success) {
        el.innerText = result.count;
      }
    } catch (e) {
      console.error('[Achievements] Failed to fetch total achievements:', e);
    }
  }
}

// Make updatePlaytime global so it can be called inside the event listeners
window.updatePlaytime = function() {
  if (gameStartTime > 0) {
    const playedMs = Date.now() - gameStartTime;
    const totalMs = parseInt(localStorage.getItem('idk_playtime') || '0');
    const newTotalPlaytime = totalMs + playedMs;
    localStorage.setItem('idk_playtime', newTotalPlaytime);
    if (window.electronAPI) {
      window.electronAPI.saveSettings({ playtime: newTotalPlaytime }).catch(console.error);
    }
    gameStartTime = 0;
    updatePlaytimeDisplay();
  }
};

// Initial display
updatePlaytimeDisplay();
updateAchievementsDisplay();

// Background Dimming on Scroll
const viewMain = document.getElementById('view-main');
const bgSlider = document.querySelector('.background-slider');

if (viewMain && bgSlider) {
  viewMain.addEventListener('scroll', () => {
    const scroll = viewMain.scrollTop;
    const opacity = Math.max(0.5, 1.0 - (scroll / 300) * 0.5);
    bgSlider.style.opacity = opacity;
  });
}


  Object.assign(actions, {
    showWarningToast,
    beginLaunchOverlay(status = 'Initializing...') {
      overlay.classList.remove('minimized');
      overlay.classList.add('active');
      gameStartTime = Date.now();
      launchFill.style.width = '0%';
      launchStatus.innerText = status;
      if (minimizeLaunchBtn) minimizeLaunchBtn.style.display = '';
      if (restoreLaunchBtn) restoreLaunchBtn.style.display = 'none';
    },
    playGame: () => playBtn.click(),
    getPlayButton: () => playBtn,
  });
}

/**
 * Game Features Integration
 * Integrates all game-related features into the UI
 */

import { esc } from '../../core/safe-parse.js';
import { state, actions } from '../../core/app-state.js';
import { showAlertDialog } from '../../components/alert-dialog.js';
import { checkModUpdates, getModChangelog, installModUpdate } from '../mod-updates/mod-updates-feature.js';
import { analyzeCrash, formatAnalysis } from '../crash-analyzer/crash-analyzer-feature.js';
import { scanMissingDependencies, resolveDependencies } from '../mod-resolver/mod-resolver-feature.js';

let currentModUpdates = [];

export function initGameFeaturesIntegration() {
  console.log('[GameFeatures] Initializing integration...');
  
  // Setup modal close buttons
  setupModalCloseButtons();
  
  // Setup feature buttons - with retry logic
  setTimeout(() => {
    console.log('[GameFeatures] Setting up buttons after delay...');
    setupModUpdateChecker();
    setupCrashAnalyzer();
    setupDependencyResolver();
  }, 100);
  
  console.log('[GameFeatures] Integration complete');
}

/**
 * Setup modal close buttons
 */
function setupModalCloseButtons() {
  const modals = [
    'mod-updates-modal',
    'changelog-modal',
    'crash-analyzer-modal',
    'dependencies-modal'
  ];

  modals.forEach(modalId => {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    // Close on background click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('active')) {
        modal.classList.remove('active');
      }
    });
  });

  // Setup individual close buttons
  document.getElementById('btn-close-mod-updates')?.addEventListener('click', () => {
    document.getElementById('mod-updates-modal').classList.remove('active');
  });

  document.getElementById('btn-close-changelog')?.addEventListener('click', () => {
    document.getElementById('changelog-modal').classList.remove('active');
  });

  document.getElementById('btn-close-crash-analyzer')?.addEventListener('click', () => {
    document.getElementById('crash-analyzer-modal').classList.remove('active');
  });

  document.getElementById('btn-close-dependencies')?.addEventListener('click', () => {
    document.getElementById('dependencies-modal').classList.remove('active');
  });
}

/**
 * Setup Mod Update Checker
 */
function setupModUpdateChecker() {
  console.log('[GameFeatures] setupModUpdateChecker called');
  
  // The button has an onclick handler in the HTML, so we just need to expose the handler globally
  // This is already done at the end of this file with: window.handleCheckUpdatesClick = handleCheckUpdatesClick;
  console.log('[GameFeatures] Handler exposed globally as window.handleCheckUpdatesClick');
}

async function handleCheckUpdatesClick() {
  console.log('[GameFeatures] handleCheckUpdatesClick called');
  console.log('[GameFeatures] state.activeModpackId:', state.activeModpackId);
  console.log('[GameFeatures] state.modpacks:', state.modpacks.length, 'modpacks');
  
  let mp = state.modpacks.find(m => m.id === state.activeModpackId);
  console.log('[GameFeatures] Active modpack:', mp?.name, 'ID:', state.activeModpackId);
  
  if (!mp) {
    console.warn('[GameFeatures] No modpack selected');
    console.log('[GameFeatures] Available modpacks:', state.modpacks.map(m => ({ id: m.id, name: m.name })));
    // Show warning or use first modpack
    if (state.modpacks.length > 0) {
      console.log('[GameFeatures] Using first modpack instead');
      state.activeModpackId = state.modpacks[0].id;
      mp = state.modpacks[0];
    } else {
      showAlertDialog({ title: 'No Modpack Selected', message: 'Please select a modpack first.', variant: 'warning' });
      return;
    }
  }

  const modal = document.getElementById('mod-updates-modal');
  const content = document.getElementById('mod-updates-content');
  
  console.log('[GameFeatures] Modal found:', !!modal, 'Content found:', !!content);
  
  if (!modal || !content) {
    console.error('[GameFeatures] Modal or content not found');
    return;
  }
  
  modal.classList.add('active');
  content.innerHTML = renderUpdatesLoading(mp);

  try {
    console.log('[GameFeatures] Starting update check for modpack:', state.activeModpackId);
    const updates = await checkModUpdates(state.activeModpackId);
    currentModUpdates = updates;
    console.log('[GameFeatures] Updates found:', updates.length);

    if (updates.length === 0) {
      content.innerHTML = renderNoUpdates(mp);
      return;
    }

    renderUpdateResults(content, mp, updates);
    return;
  } catch (e) {
    console.error('[GameFeatures] Update check failed:', e);
    content.innerHTML = `<div style="color: #ef4444; padding: 20px; text-align: center;">Failed to check for updates: ${e.message}</div>`;
  }
}

// Expose globally for onclick handler
window.handleCheckUpdatesClick = handleCheckUpdatesClick;

function renderUpdatesLoading(mp) {
  return `
    <div class="updates-shell">
      <div class="updates-summary">
        <div>
          <span class="updates-kicker">Scanning</span>
          <strong>${escapeHtml(mp?.name || 'Selected modpack')}</strong>
        </div>
        <span class="updates-count-pill">Working</span>
      </div>
      <div class="updates-loading">
        <div class="launch-spinner"></div>
        <span>Checking mods, resource packs, and shaders...</span>
      </div>
    </div>
  `;
}

function renderNoUpdates(mp) {
  return `
    <div class="updates-shell">
      <div class="updates-summary">
        <div>
          <span class="updates-kicker">Up to date</span>
          <strong>${escapeHtml(mp?.name || 'Selected modpack')}</strong>
        </div>
        <span class="updates-count-pill success">0 updates</span>
      </div>
      <div class="updates-empty">
        <strong>Everything looks current.</strong>
        <span>No compatible updates were found for this modpack.</span>
      </div>
    </div>
  `;
}

function renderUpdateResults(content, mp, updates) {
  const counts = updates.reduce((acc, update) => {
    acc[update.type] = (acc[update.type] || 0) + 1;
    return acc;
  }, {});

  content.innerHTML = `
    <div class="updates-shell">
      <div class="updates-summary">
        <div>
          <span class="updates-kicker">Updates available</span>
          <strong>${escapeHtml(mp?.name || 'Selected modpack')}</strong>
        </div>
        <span class="updates-count-pill">${updates.length} found</span>
      </div>
      <div class="updates-toolbar">
        <div class="updates-breakdown">
          <span>${counts.mod || 0} mods</span>
          <span>${counts.resourcepack || 0} packs</span>
          <span>${counts.shader || 0} shaders</span>
        </div>
        <button class="updates-update-all" id="btn-update-all-mods">Update all</button>
      </div>
      <div class="updates-list">
        ${updates.map((update, index) => renderUpdateCard(update, index)).join('')}
      </div>
    </div>
  `;

  content.querySelectorAll('[data-update-index]').forEach(el => {
    if (el.tagName === 'BUTTON') {
      el.addEventListener('click', () => installSingleUpdate(Number(el.dataset.updateIndex), el));
    }
  });

  // Update the filename line when the user picks a different version
  content.querySelectorAll('.updates-version-select').forEach(sel => {
    sel.addEventListener('change', () => {
      const idx = sel.dataset.updateIndex;
      const card = sel.closest('[data-update-card]');
      if (!card) return;
      const avCount = parseInt(card.dataset.avCount || '0', 10);
      if (avCount <= 1) return;
      const update = currentModUpdates[Number(idx)];
      if (!update?.availableVersions) return;
      const ver = update.availableVersions[parseInt(sel.value, 10)];
      const fnEl = document.getElementById(`updates-filename-${idx}`);
      if (fnEl) fnEl.textContent = ver?.filename || '';
    });
  });

  content.querySelector('#btn-update-all-mods')?.addEventListener('click', () => installAllUpdates(content));
}

function renderUpdateCard(update, index) {
  const typeLabel = update.type === 'resourcepack' ? 'Resource pack' : update.type === 'shader' ? 'Shader' : 'Mod';
  const icon = update.iconUrl
    ? `<img class="updates-icon-image" src="${escapeHtml(update.iconUrl)}" alt="">`
    : `<span class="updates-icon-fallback">${escapeHtml(getUpdateGlyph(update.type))}</span>`;

  // Build version dropdown — always shown so the user can pick any version
  const versions = update.availableVersions && update.availableVersions.length > 0
    ? update.availableVersions
    : [{ versionNumber: update.latestVersion, filename: update.latestFilename, downloadUrl: update.downloadUrl }];
  const defaultIdx = Math.max(0, versions.findIndex(v => v.versionNumber === update.currentVersion));
  const opts = versions.map((v, vi) =>
    `<option value="${vi}"${vi === defaultIdx ? ' selected' : ''}>${escapeHtml(v.versionNumber)}</option>`
  ).join('');

  return `
    <div class="updates-card" data-update-card="${index}" data-av-count="${versions.length}">
      <div class="updates-icon">${icon}</div>
      <div class="updates-card-main">
        <div class="updates-card-header">
          <div class="updates-type">${typeLabel}</div>
          <div class="updates-status-chip">Ready</div>
        </div>
        <strong>${escapeHtml(update.name)}</strong>
        <div class="updates-version-row">
          <span class="updates-version-old">${escapeHtml(formatVersionLabel(update.currentVersion))}</span>
          <span class="updates-version-arrow">→</span>
          <select class="updates-version-select" data-update-index="${index}">${opts}</select>
        </div>
        <div class="updates-filename" id="updates-filename-${index}">${escapeHtml(versions[defaultIdx].filename || '')}</div>
      </div>
      <button class="updates-action-btn" data-update-index="${index}">Update</button>
    </div>
  `;
}

async function installSingleUpdate(index, button) {
  const update = currentModUpdates[index];
  if (!update || !button) return;

  // If there's a version dropdown, use the user-selected version instead of the default latest
  const card = button.closest('.updates-card');
  const versionSelect = card?.querySelector('.updates-version-select');
  if (versionSelect && update.availableVersions) {
    const selectedIndex = parseInt(versionSelect.value, 10);
    const ver = update.availableVersions[selectedIndex];
    if (ver) {
      // Override the update with the selected version's details
      update.latestVersion = ver.versionNumber;
      update.latestFilename = ver.filename;
      update.downloadUrl = ver.downloadUrl;
    }
  }

  button.disabled = true;
  button.textContent = 'Installing';
  card?.classList.add('installing');

  try {
    await installModUpdate(state.activeModpackId, update);
    update.installed = true;
    card?.classList.remove('installing');
    card?.classList.add('installed');
    button.textContent = 'Updated';
    actions.modpacks?.mpRenderDetail?.();
    actions.modpacks?.mpRenderList?.();
    actions.showWarningToast?.(`${update.name} updated`);
  } catch (e) {
    console.error('[GameFeatures] Failed to install update:', e);
    card?.classList.remove('installing');
    button.disabled = false;
    button.textContent = 'Retry';
    actions.showWarningToast?.(`Failed to update ${update.name}: ${e.message}`);
  }
}

async function installAllUpdates(content) {
  const button = content.querySelector('#btn-update-all-mods');
  if (!button) return;

  button.disabled = true;
  button.textContent = 'Updating...';

  const updates = [...currentModUpdates];
  let attempted = 0;
  for (let originalIndex = 0; originalIndex < updates.length; originalIndex += 1) {
    const update = updates[originalIndex];
    if (update.installed) continue;
    const index = currentModUpdates.indexOf(update);
    const itemButton = content.querySelector(`[data-update-index="${index}"]`);
    if (index !== -1 && itemButton && !itemButton.disabled) {
      attempted += 1;
      await installSingleUpdate(index, itemButton);
    }
  }

  button.textContent = attempted === updates.length ? 'Done' : 'Finished';
  if (currentModUpdates.every(update => update.installed)) {
    const mp = state.modpacks.find(m => m.id === state.activeModpackId);
    content.innerHTML = renderNoUpdates(mp);
  }
}

function formatVersionLabel(version) {
  const value = String(version || 'Unknown');
  return value.length > 34 ? `${value.slice(0, 31)}...` : value;
}

function getUpdateGlyph(type) {
  if (type === 'resourcepack') return 'RP';
  if (type === 'shader') return 'SH';
  return 'MD';
}

const escapeHtml = esc;

/**
 * Setup Crash Log Analyzer
 */
function setupCrashAnalyzer() {
  const btn = document.getElementById('btn-analyze-crash');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const crashLog = document.getElementById('crash-log-input').value.trim();
    
    if (!crashLog) {
      actions.showWarningToast('Please paste a crash log');
      return;
    }

    try {
      const analysis = analyzeCrash(crashLog);
      const html = formatAnalysis(analysis);
      document.getElementById('crash-analysis-result').innerHTML = html;
    } catch (e) {
      console.error('[GameFeatures] Crash analysis failed:', e);
      document.getElementById('crash-analysis-result').innerHTML = `
        <div style="color: #ef4444; padding: 20px; text-align: center;">
          Failed to analyze crash log: ${e.message}
        </div>
      `;
    }
  });
}

/**
 * Setup Dependency Resolver
 */
function setupDependencyResolver() {
  // This is called automatically when adding mods
  // Can also be triggered manually if needed
}

/**
 * Check dependencies when adding a mod
 */
export async function checkDependenciesForMod(modpackId, modId) {
  try {
    const missing = await scanMissingDependencies(modpackId);
    
    if (missing.length === 0) return;

    const modal = document.getElementById('dependencies-modal');
    const content = document.getElementById('dependencies-content');
    
    modal.classList.add('active');

    let html = `
      <div style="margin-bottom: 16px;">
        <p style="color: #a0a0a0; margin: 0 0 12px 0;">The following dependencies are missing:</p>
        <div style="display: flex; flex-direction: column; gap: 8px;">
    `;

    for (const dep of missing) {
      html += `
        <div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 4px; border-left: 3px solid #f97316;">
          <div style="font-size: 12px; color: white;">
            <strong>${dep.dependencyName}</strong> (required by ${dep.dependentMod})
          </div>
          <div style="font-size: 11px; color: #a0a0a0; margin-top: 2px;">Version: ${dep.version}</div>
        </div>
      `;
    }

    html += `
        </div>
      </div>
      <button class="submit-btn" id="btn-install-dependencies" style="width: 100%; margin-bottom: 8px;">Install Dependencies</button>
      <button class="modal-btn" id="btn-skip-dependencies" style="width: 100%;">Skip</button>
    `;

    content.innerHTML = html;

    document.getElementById('btn-install-dependencies')?.addEventListener('click', async () => {
      content.innerHTML = '<div style="text-align: center; padding: 20px; color: #a0a0a0;">Installing dependencies...</div>';
      
      try {
        const result = await resolveDependencies(modpackId, modId);
        if (result.success) {
          content.innerHTML = `
            <div style="text-align: center; padding: 20px;">
              <div style="font-size: 14px; color: var(--theme-accent); margin-bottom: 8px;">&#x2713; Dependencies installed</div>
              <div style="font-size: 12px; color: #a0a0a0;">${result.message}</div>
            </div>
          `;
        } else {
          content.innerHTML = `<div style="color: #ef4444; padding: 20px; text-align: center;">Failed: ${result.error}</div>`;
        }
      } catch (e) {
        content.innerHTML = `<div style="color: #ef4444; padding: 20px; text-align: center;">Error: ${e.message}</div>`;
      }
    });

    document.getElementById('btn-skip-dependencies')?.addEventListener('click', () => {
      modal.classList.remove('active');
    });
  } catch (e) {
    console.error('[GameFeatures] Dependency check failed:', e);
  }
}

/**
 * Show changelog for a mod
 */
export async function showChangelog(modrinthId, modName) {
  try {
    const modal = document.getElementById('changelog-modal');
    const content = document.getElementById('changelog-content');
    const title = document.getElementById('changelog-title');
    
    title.innerText = `${modName} - Changelog`;
    modal.classList.add('active');
    content.innerHTML = '<div style="text-align: center; padding: 20px; color: #a0a0a0;">Loading changelog...</div>';

    const changelog = await getModChangelog(modrinthId);
    
    if (!changelog) {
      content.innerHTML = '<div style="color: #a0a0a0; padding: 20px; text-align: center;">No changelog available</div>';
      return;
    }

    let html = `
      <div style="color: white;">
        <div style="margin-bottom: 16px;">
          <p style="margin: 0 0 8px 0; color: #a0a0a0; font-size: 12px;">${changelog.description}</p>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px;">
            <div style="background: rgba(255,255,255,0.05); padding: 8px; border-radius: 4px;">
              <div style="font-size: 10px; color: #707070; text-transform: uppercase;">Downloads</div>
              <div style="font-size: 16px; font-weight: 700; color: var(--theme-accent);">${changelog.downloads.toLocaleString()}</div>
            </div>
            <div style="background: rgba(255,255,255,0.05); padding: 8px; border-radius: 4px;">
              <div style="font-size: 10px; color: #707070; text-transform: uppercase;">Followers</div>
              <div style="font-size: 16px; font-weight: 700; color: var(--theme-accent);">${changelog.followers.toLocaleString()}</div>
            </div>
          </div>
        </div>
        <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 12px;">
          <h4 style="margin: 0 0 8px 0; font-size: 13px; color: var(--theme-accent); text-transform: uppercase;">Changelog</h4>
          <div style="font-size: 12px; color: #d1d1d2; line-height: 1.6; white-space: pre-wrap; word-break: break-word;">
            ${changelog.body || 'No detailed changelog available'}
          </div>
        </div>
      </div>
    `;

    content.innerHTML = html;
  } catch (e) {
    console.error('[GameFeatures] Failed to show changelog:', e);
    document.getElementById('changelog-content').innerHTML = `<div style="color: #ef4444; padding: 20px; text-align: center;">Failed to load changelog: ${e.message}</div>`;
  }
}

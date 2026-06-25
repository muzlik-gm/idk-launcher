import "./style.css";
import "./advanced-theme.css";
import "./launch-overlay-fix.css";
import "./fixes.css";
import "./features/friends/friends.css";
// Side-effect imports: constructors register UI and IPC behavior
import "./components/download-progress.js";
import "./components/accessibility-manager.js";
import "./components/error-display.js";
import "./components/modal-manager.js";
import { renderAppShell } from "./app/app-shell.js";
import { state, actions } from "./core/app-state.js";
import { createViewController, initWindowControls } from "./core/views.js";
import { initBackgroundEffects, restartCurrentEffect } from "./features/background/background-effects.js";
import { initGameFeaturesIntegration } from "./features/game-features/game-features-integration.js";

function applyWindowModeClass(data) {
  const maximized = !!data?.maximized;
  document.body.dataset.windowMode = maximized ? 'maximized' : 'restored';
}

function applyModpackUiScale() {
  const root = document.documentElement;
  const width = root.clientWidth || window.innerWidth || 1366;
  const height = root.clientHeight || window.innerHeight || 768;
  const minDim = Math.min(width, height);
  const scale = Math.max(0.88, Math.min(1, minDim / 900));
  root.style.setProperty("--mods-ui-scale", scale.toFixed(3));
}

if (window.electronAPI) {
  try {
    const result = await window.electronAPI.loadSettings();
    if (result && result.success && result.settings) {
      const s = result.settings;
      const migrate = {};

      const getMigrated = (key, localKey, defaultValue, isBool = false, isInt = false) => {
        const backendVal = s[key];
        const localValRaw = localStorage.getItem(localKey);

        if ((backendVal === defaultValue || backendVal === undefined || backendVal === null) && localValRaw !== null) {
          let localVal = localValRaw;
          if (isBool) localVal = localValRaw === 'true';
          else if (isInt) localVal = parseInt(localValRaw, 10) || defaultValue;

          if (localVal !== defaultValue) {
            migrate[key] = localVal;
            return localVal;
          }
        }
        return (backendVal !== undefined && backendVal !== null) ? backendVal : defaultValue;
      };

      state.javaPath = getMigrated('javaPath', 'craftlaunch_javaPath', '');
      state.globalJavaArgs = getMigrated('globalJavaArgs', 'idk_global_java_args', '');
      state.customMinecraftPath = getMigrated('customMinecraftPath', 'idk_custom_minecraft_path', '');
      state.defaultWindowWidth = getMigrated('defaultWindowWidth', 'idk_default_window_width', 1024, false, true);
      state.defaultWindowHeight = getMigrated('defaultWindowHeight', 'idk_default_window_height', 768, false, true);
      state.defaultFullscreen = getMigrated('defaultFullscreen', 'idk_default_fullscreen', false, true);
      state.enableOverlay = getMigrated('enableOverlay', 'idk_enable_overlay', false, true);
      state.language = getMigrated('language', 'idk_language', 'en');
      state.backgroundEffect = getMigrated('backgroundEffect', 'idk_background_effect', 'none');
      state.backgroundIntensity = getMigrated('backgroundIntensity', 'idk_background_intensity', 50, false, true);
      state.concurrentDownloads = getMigrated('concurrentDownloads', 'idk_concurrent_downloads', 4, false, true);
      state.concurrentIO = Math.min(getMigrated('concurrentIO', 'idk_concurrent_io', 2, false, true), 8);
      state.autoUpdates = getMigrated('autoUpdates', 'idk_auto_updates', true, true);
      state.discordPresence = getMigrated('discordPresence', 'idk_discord_presence', true, true);
      state.betaUpdates = getMigrated('betaUpdates', 'idk_beta_updates', false, true);
      state.openLogsAfterLaunch = getMigrated('openLogsAfterLaunch', 'idk_open_logs', false, true);
      state.analyticsEnabled = getMigrated('analyticsEnabled', 'idk_analytics', false, true);
      state.hideLauncher = getMigrated('hideLauncher', 'idk_hide_launcher', true, true);
      state.maxMemoryGB = getMigrated('maxMemoryGB', 'craftlaunch_maxMemory', 4, false, true);
      state.launcherPerformanceMode = getMigrated('launcherPerformanceMode', 'idk_launcher_performance_mode', 'balanced');
      state.autoOptimization = getMigrated('autoOptimization', 'craftlaunch_autoOptimization', false, true);
      state.currentUser = getMigrated('currentUser', 'craftlaunch_username', '');
      state.authMode = getMigrated('authMode', 'craftlaunch_authmode', 'offline');
      state.launcherTheme = getMigrated('launcherTheme', 'idk_launcher_theme', 'emerald');
      state.launcherAccentColor = getMigrated('launcherAccentColor', 'idk_accent_color', '#4cb837');
      state.launcherBorderRadius = getMigrated('launcherBorderRadius', 'idk_border_radius', 10, false, true);
      state.launcherAnimationSpeed = getMigrated('launcherAnimationSpeed', 'idk_animation_speed', 1, false, true);
      state.launcherFontScale = getMigrated('launcherFontScale', 'idk_font_scale', 1, false, true);
      state.launcherBlurIntensity = getMigrated('launcherBlurIntensity', 'idk_blur_intensity', 'medium');
      state.launcherCompactMode = getMigrated('launcherCompactMode', 'idk_compact_mode', false, true);
      state.launcherUiMode = getMigrated('launcherUiMode', 'idk_launcher_ui_mode', 'classic');

      if (s.elybyData !== undefined && s.elybyData !== null) {
        migrate.elybyData = s.elybyData;
      }
      
      if (s.lastPlayedVersion !== undefined && s.lastPlayedVersion) {
        state.selectedVersion = s.lastPlayedVersion;
      } else {
        const lpRaw = localStorage.getItem('idk_last_played');
        if (lpRaw) {
          try {
            const lp = JSON.parse(lpRaw);
            if (lp && lp.version) {
              state.selectedVersion = lp.version;
              migrate.lastPlayedVersion = lp.version;
            }
          } catch(e) {}
        }
      }

      if (s.lastPlayedLoader !== undefined && s.lastPlayedLoader) {
        state.selectedLoader = s.lastPlayedLoader;
      } else {
        const lpRaw = localStorage.getItem('idk_last_played');
        if (lpRaw) {
          try {
            const lp = JSON.parse(lpRaw);
            if (lp && lp.loader) {
              state.selectedLoader = lp.loader;
              migrate.lastPlayedLoader = lp.loader;
            }
          } catch(e) {}
        }
      }
      
      if (s.versionSettings !== undefined && s.versionSettings !== null && Object.keys(s.versionSettings).length > 0) {
        state.versionSettings = s.versionSettings;
      } else {
        const localVS = localStorage.getItem('idk_version_settings');
        if (localVS) {
          try {
            state.versionSettings = JSON.parse(localVS) || {};
            migrate.versionSettings = state.versionSettings;
          } catch(e) {}
        }
      }
      
      const backendPlaytime = s.playtime !== undefined ? s.playtime : 0;
      const localPlaytimeRaw = localStorage.getItem('idk_playtime');
      let finalPlaytime = backendPlaytime;
      if (backendPlaytime === 0 && localPlaytimeRaw !== null) {
        const localPlaytime = parseInt(localPlaytimeRaw) || 0;
        if (localPlaytime > 0) {
          migrate.playtime = localPlaytime;
          finalPlaytime = localPlaytime;
        }
      }
      localStorage.setItem('idk_playtime', finalPlaytime);
      
      if (Object.keys(migrate).length > 0) {
        window.electronAPI.saveSettings(migrate).catch(console.error);
      }
    }
  } catch (e) {
    console.error('[Main] Failed to load settings from SettingsManager:', e);
  }
}

if (window.electronAPI?.onWindowStateChanged) {
  window.electronAPI.onWindowStateChanged(applyWindowModeClass);
}
applyWindowModeClass({ maximized: window.outerWidth >= screen.availWidth - 20 && window.outerHeight >= screen.availHeight - 20 });
applyModpackUiScale();
window.addEventListener("resize", applyModpackUiScale);

renderAppShell();

const { switchView, getReturnView } = createViewController();
actions.switchView = switchView;

initWindowControls();

const [
  { initAuthFeature },
  { initSettingsFeature },
  { initVersionsFeature },
  { initVersionModsFeature },
  { initLaunchFeature },
  { initModpacksFeature },
  { initContentFeature },
  { initDesktopHelpers },
  { initFriendsFeature },
  { initProfileFeature },
  { showConfirmDialog },
] = await Promise.all([
  import("./features/auth/auth-feature.js"),
  import("./features/settings/settings-feature.js"),
  import("./features/versions/version-feature.js"),
  import("./features/versions/version-mods-feature.js"),
  import("./features/launch/launch-feature.js"),
  import("./features/modpacks/modpacks-feature.js"),
  import("./features/content/content-feature.js"),
  import("./features/desktop/desktop-helpers.js"),
  import("./features/friends/friends-feature.js"),
  import("./features/profile/profile-feature.js"),
  import("./components/confirm-dialog.js"),
]);

actions.showConfirmDialog = showConfirmDialog;

initAuthFeature({ switchView });
initSettingsFeature({ switchView });
initVersionsFeature();
initVersionModsFeature({ switchView });
initLaunchFeature();
initModpacksFeature({ switchView });
initContentFeature();
initDesktopHelpers();
initFriendsFeature();
initProfileFeature({ switchView, getReturnView });
initGameFeaturesIntegration();
initBackgroundEffects();
window.restartCurrentEffect = restartCurrentEffect;

setInterval(() => {
  if (performance && performance.memory) {
    const usedMB = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
    const totalMB = Math.round(performance.memory.totalJSHeapSize / 1024 / 1024);
    console.log(`[Performance] Renderer JS Heap: ${usedMB} MB / ${totalMB} MB`);
  }
}, 10000);
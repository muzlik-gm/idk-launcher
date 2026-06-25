import { state, actions } from "../../core/app-state.js";
import { showAlertDialog } from "../../components/alert-dialog.js";

const UI_MODE_IDS = new Set(["classic", "advanced"]);
const PERFORMANCE_MODE_IDS = new Set(["quality", "balanced", "eco"]);
const BLUR_LEVELS = { none: 0, light: 1, medium: 6, heavy: 16 };

const THEME_PRESETS = {
  emerald: {
    label: "Emerald",
    accent: "#4cb837",
    bg: "#061008",
    bgPanel: "#0b1710",
    bgCard: "#112419",
    accentHover: "#5cc844",
    accentBright: "#6ce24f",
    accentShadow: "#2d6b1f",
    accentDark: "#3c8527",
    accentText: "#86efac",
    accentRgb: "76, 184, 55",
    glowRgb: "34, 197, 94",
    stageRgb: "76, 184, 55",
  },
  amethyst: {
    label: "Amethyst",
    accent: "#8b5cf6",
    bg: "#07030d",
    bgPanel: "#12091f",
    bgCard: "#211236",
    accentHover: "#a78bfa",
    accentBright: "#c4b5fd",
    accentShadow: "#4c1d95",
    accentDark: "#6d28d9",
    accentText: "#ddd6fe",
    accentRgb: "139, 92, 246",
    glowRgb: "168, 85, 247",
    stageRgb: "139, 92, 246",
  },
  ocean: {
    label: "Ocean",
    accent: "#3b82f6",
    bg: "#031018",
    bgPanel: "#071923",
    bgCard: "#0b2534",
    accentHover: "#60a5fa",
    accentBright: "#93c5fd",
    accentShadow: "#1e40af",
    accentDark: "#2563eb",
    accentText: "#bfdbfe",
    accentRgb: "59, 130, 246",
    glowRgb: "59, 130, 246",
    stageRgb: "147, 197, 253",
  },
  sunset: {
    label: "Sunset",
    accent: "#f97316",
    bg: "#130804",
    bgPanel: "#1f1008",
    bgCard: "#32180b",
    accentHover: "#fb923c",
    accentBright: "#fdba74",
    accentShadow: "#7c2d12",
    accentDark: "#c2410c",
    accentText: "#fed7aa",
    accentRgb: "249, 115, 22",
    glowRgb: "234, 88, 12",
    stageRgb: "249, 115, 22",
  },
};

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : "76, 184, 55";
}

function applyThemeVars(accentHex, bg, bgPanel, bgCard, accentHover, accentBright, accentShadow, accentDark, accentText, accentRgb, glowRgb, stageRgb) {
  const root = document.documentElement;
  root.style.setProperty("--theme-accent", accentHex);
  root.style.setProperty("--theme-bg", bg);
  root.style.setProperty("--theme-bg-panel", bgPanel);
  root.style.setProperty("--theme-bg-card", bgCard);
  root.style.setProperty("--theme-accent-hover", accentHover);
  root.style.setProperty("--theme-accent-bright", accentBright);
  root.style.setProperty("--theme-accent-shadow", accentShadow);
  root.style.setProperty("--theme-accent-dark", accentDark);
  root.style.setProperty("--theme-accent-text", accentText);
  root.style.setProperty("--theme-accent-rgb", accentRgb);
  root.style.setProperty("--theme-accent-glow-rgb", glowRgb);
  root.style.setProperty("--theme-stage-grid-rgb", stageRgb);
}

function generateCustomTheme(accentHex) {
  const rgb = hexToRgb(accentHex);
  return {
    accent: accentHex,
    bg: `rgb(${rgb}, 0.03)`,
    bgPanel: `rgb(${rgb}, 0.06)`,
    bgCard: `rgb(${rgb}, 0.1)`,
    accentHover: `color-mix(in srgb, ${accentHex}, white 15%)`,
    accentBright: `color-mix(in srgb, ${accentHex}, white 35%)`,
    accentShadow: `color-mix(in srgb, ${accentHex}, black 50%)`,
    accentDark: `color-mix(in srgb, ${accentHex}, black 20%)`,
    accentText: `color-mix(in srgb, ${accentHex}, white 60%)`,
    accentRgb: rgb,
    glowRgb: rgb,
    stageRgb: rgb,
  };
}

async function persistVisualSettings() {
  if (window.electronAPI) {
    try {
      await window.electronAPI.saveSettings({
        launcherTheme: state.launcherTheme,
        launcherAccentColor: state.launcherAccentColor,
        launcherBorderRadius: state.launcherBorderRadius,
        launcherAnimationSpeed: state.launcherAnimationSpeed,
        launcherFontScale: state.launcherFontScale,
        launcherBlurIntensity: state.launcherBlurIntensity,
        launcherCompactMode: state.launcherCompactMode,
        launcherPerformanceMode: state.launcherPerformanceMode,
        launcherUiMode: state.launcherUiMode,
        hideLauncher: state.hideLauncher,
        autoOptimization: state.autoOptimization,
        language: state.language,
        backgroundEffect: state.backgroundEffect,
        backgroundIntensity: state.backgroundIntensity,
        concurrentDownloads: state.concurrentDownloads,
        concurrentIO: state.concurrentIO,
        autoUpdates: state.autoUpdates,
        discordPresence: state.discordPresence,
        betaUpdates: state.betaUpdates,
        openLogsAfterLaunch: state.openLogsAfterLaunch,
        analyticsEnabled: state.analyticsEnabled,
        maxMemoryGB: state.maxMemoryGB,
        enableOverlay: state.enableOverlay,
        defaultFullscreen: state.defaultFullscreen,
        defaultWindowWidth: state.defaultWindowWidth,
        defaultWindowHeight: state.defaultWindowHeight,
        javaPath: state.javaPath,
        globalJavaArgs: state.globalJavaArgs,
        customMinecraftPath: state.customMinecraftPath,
      });
    } catch (e) {
      console.error("[Settings] Failed to persist visual settings:", e);
    }
  }
}

function applyLauncherTheme(theme) {
  state.launcherTheme = theme;
  document.documentElement.dataset.theme = theme;
  document.body.dataset.theme = theme;
  localStorage.setItem("idk_launcher_theme", theme);

  const preset = THEME_PRESETS[theme];
  if (preset) {
    applyThemeVars(
      preset.accent, preset.bg, preset.bgPanel, preset.bgCard,
      preset.accentHover, preset.accentBright, preset.accentShadow,
      preset.accentDark, preset.accentText, preset.accentRgb,
      preset.glowRgb, preset.stageRgb
    );
    state.launcherAccentColor = preset.accent;
    localStorage.setItem("idk_accent_color", preset.accent);
  } else if (theme === "custom") {
    const customColor = state.launcherAccentColor || "#4cb837";
    const custom = generateCustomTheme(customColor);
    applyThemeVars(
      custom.accent, custom.bg, custom.bgPanel, custom.bgCard,
      custom.accentHover, custom.accentBright, custom.accentShadow,
      custom.accentDark, custom.accentText, custom.accentRgb,
      custom.glowRgb, custom.stageRgb
    );
  }

  document.querySelectorAll(".theme-choice-card").forEach((card) => {
    card.classList.toggle("active", card.dataset.theme === theme);
  });

  persistVisualSettings();
}

function applyCustomAccentColor(hex) {
  state.launcherAccentColor = hex;
  localStorage.setItem("idk_accent_color", hex);
  if (state.launcherTheme === "custom") {
    applyLauncherTheme("custom");
  }
  persistVisualSettings();
}

function applyLauncherBorderRadius(px) {
  state.launcherBorderRadius = px;
  localStorage.setItem("idk_border_radius", String(px));
  document.documentElement.style.setProperty("--theme-radius", `${px}px`);
  persistVisualSettings();
}

function applyAnimationSpeed(speed) {
  state.launcherAnimationSpeed = speed;
  localStorage.setItem("idk_animation_speed", String(speed));
  document.documentElement.style.setProperty("--theme-animation-speed", String(speed));
  persistVisualSettings();
}

function applyFontScale(scale) {
  state.launcherFontScale = scale;
  localStorage.setItem("idk_font_scale", String(scale));
  document.documentElement.style.setProperty("--theme-font-scale", String(scale));
  document.documentElement.style.fontSize = `calc(16px * ${scale})`;
  persistVisualSettings();
}

function getBlurOverrideStyle() {
  let el = document.getElementById("bg-blur-override");
  if (!el) {
    el = document.createElement("style");
    el.id = "bg-blur-override";
    document.head.appendChild(el);
  }
  return el;
}

function applyBlurIntensity(level) {
  state.launcherBlurIntensity = level;
  localStorage.setItem("idk_blur_intensity", level);
  const px = BLUR_LEVELS[level] || 6;
  document.documentElement.style.setProperty("--theme-blur", `${px}px`);
  const style = getBlurOverrideStyle();
  const glassSelectors = [
    '.glass-panel', '.friends-panel',
    '.profile-card', '.launch-card', '.chat-box',
    '.news-card', '.friend-item', '.profile-header',
    '.dropdown-menu', '.pill-switch', '.adv-section',
    '.bg-effect-card', '.blur-choice-card',
    '.glass-card', '.modal-card', '.update-card',
    '.launch-config-section', '.versions-tab', '.mods-tab',
    '.profile-tab', '.settings-tab', '.content-tab',
    '.recommended-card', '.trending-card', '.friend-card',
    '.achievement-item', '.server-card', '.server-item',
    '.download-card', '.user-card',
    '.notification-item', '.toast-item',
    '.glass-input', '.glass-btn', '.modal-btn',
    '.modpacks-sidebar', '.browser-sidebar',
    '.settings-sidebar', '.details-section',
    '.top-bar', '.nav-tabs', '.profile-sidebar', '.mod-browser',
    '.settings-panel', '.download-progress-container',
    '.error-display-container', '.settings-tab-bar',
    '[class*="glass-"]', '[class*="modal-"]'
  ].join(', ');
  const excludeSelectors = [
    '.launch-overlay', '.bg-effects-canvas', '[class*="overlay"]:not([class*="modal"])'
  ].join(', ');

  if (px === 0) {
    style.textContent = `
    ${glassSelectors} {
      backdrop-filter: blur(0px) !important;
      -webkit-backdrop-filter: blur(0px) !important;
    }
    ${excludeSelectors} {
      backdrop-filter: blur(0px) !important;
      -webkit-backdrop-filter: blur(0px) !important;
    }
  `;
  } else {
    style.textContent = `
    ${glassSelectors} {
      backdrop-filter: blur(${px}px) !important;
      -webkit-backdrop-filter: blur(${px}px) !important;
    }
    ${excludeSelectors} {
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
    }
  `;
  }
  persistVisualSettings();
}

function applyCompactMode(enabled) {
  state.launcherCompactMode = enabled;
  localStorage.setItem("idk_compact_mode", String(enabled));
  document.body.classList.toggle("compact-mode", enabled);
  persistVisualSettings();
}

function applyLanguage(lang) {
  state.language = lang;
  localStorage.setItem("idk_language", lang);
  persistVisualSettings();
}

function applyBackgroundEffect(effect) {
  state.backgroundEffect = effect;
  localStorage.setItem("idk_background_effect", effect);
  document.body.dataset.bgEffect = effect;
  persistVisualSettings();
}

function applyBackgroundIntensity(val) {
  state.backgroundIntensity = val;
  localStorage.setItem("idk_background_intensity", String(val));
  document.body.style.setProperty("--bg-intensity", String(val / 100));
  persistVisualSettings();
}

function applyConcurrentDownloads(val) {
  state.concurrentDownloads = val;
  localStorage.setItem("idk_concurrent_downloads", String(val));
  persistVisualSettings();
}

function applyConcurrentIO(val) {
  state.concurrentIO = Math.min(val, 8);
  localStorage.setItem("idk_concurrent_io", String(state.concurrentIO));
  persistVisualSettings();
}

function applyAutoUpdates(enabled) {
  state.autoUpdates = enabled;
  localStorage.setItem("idk_auto_updates", String(enabled));
  persistVisualSettings();
}

function applyDiscordPresence(enabled) {
  state.discordPresence = enabled;
  localStorage.setItem("idk_discord_presence", String(enabled));
  persistVisualSettings();
}

function applyBetaUpdates(enabled) {
  state.betaUpdates = enabled;
  localStorage.setItem("idk_beta_updates", String(enabled));
  persistVisualSettings();
}

function applyOpenLogsAfterLaunch(enabled) {
  state.openLogsAfterLaunch = enabled;
  localStorage.setItem("idk_open_logs", String(enabled));
  persistVisualSettings();
}

function applyAnalytics(enabled) {
  state.analyticsEnabled = enabled;
  localStorage.setItem("idk_analytics", String(enabled));
  persistVisualSettings();
}

function applyLauncherUiMode(mode) {
  const nextMode = UI_MODE_IDS.has(mode) ? mode : "classic";
  state.launcherUiMode = nextMode;
  document.body.dataset.uiMode = nextMode;
  document.body.classList.toggle("ui-advanced", nextMode === "advanced");
  localStorage.setItem("idk_launcher_ui_mode", nextMode);

  document.querySelectorAll("#launcher-ui-modes .pill-switch-option, #adv-launcher-ui-modes .pill-switch-option").forEach((card) => {
    card.classList.toggle("active", card.dataset.uiMode === nextMode);
  });

  if (nextMode === "advanced") {
    actions.refreshHomeSkin?.();
  }
  persistVisualSettings();
}

function applyLauncherPerformanceMode(mode) {
  state.launcherPerformanceMode = mode;
  document.body.dataset.launcherPerformance = mode;
  localStorage.setItem("idk_launcher_performance_mode", mode);

  document.querySelectorAll("#launcher-performance-modes .pill-switch-option, #adv-launcher-performance-modes .pill-switch-option").forEach((card) => {
    card.classList.toggle("active", card.dataset.performanceMode === mode);
  });

  document.querySelectorAll(".bg-video, .hero-video").forEach((video) => {
    if (mode === "eco") {
      video.pause();
    } else {
      video.play().catch(() => {});
    }
  });
  persistVisualSettings();
}

function setMemory(gb) {
  state.maxMemoryGB = gb;
  const memSlider = document.getElementById("memory-slider");
  const memLabel = document.getElementById("memory-value-label");
  if (memSlider) memSlider.value = gb;
  if (memLabel) memLabel.innerText = `${gb} GB`;
  const advMemSlider = document.getElementById("adv-memory-slider");
  const advMemLabel = document.getElementById("adv-memory-value-label");
  if (advMemSlider) advMemSlider.value = gb;
  if (advMemLabel) advMemLabel.innerText = `${gb} GB`;
  localStorage.setItem("craftlaunch_maxMemory", gb);
  document.querySelectorAll(".mem-preset-btn").forEach((b) => {
    b.classList.toggle("active", parseInt(b.dataset.gb) === gb);
  });
  persistVisualSettings();
}

export function initSettingsFeature({ switchView }) {
  // Register all actions
  actions.applyLauncherTheme = applyLauncherTheme;
  actions.applyLauncherUiMode = applyLauncherUiMode;
  actions.applyCustomAccentColor = applyCustomAccentColor;
  actions.applyLauncherBorderRadius = applyLauncherBorderRadius;
  actions.applyAnimationSpeed = applyAnimationSpeed;
  actions.applyFontScale = applyFontScale;
  actions.applyBlurIntensity = applyBlurIntensity;
  actions.applyCompactMode = applyCompactMode;
  actions.applyLanguage = applyLanguage;
  actions.applyBackgroundEffect = applyBackgroundEffect;
  actions.applyBackgroundIntensity = applyBackgroundIntensity;
  actions.applyConcurrentDownloads = applyConcurrentDownloads;
  actions.applyConcurrentIO = applyConcurrentIO;
  actions.applyAutoUpdates = applyAutoUpdates;
  actions.applyDiscordPresence = applyDiscordPresence;
  actions.applyBetaUpdates = applyBetaUpdates;
  actions.applyOpenLogsAfterLaunch = applyOpenLogsAfterLaunch;
  actions.applyAnalytics = applyAnalytics;
  actions.rebindSettingsUI = rebindSettingsUI;

  // Apply base visual state
  applyLauncherTheme(state.launcherTheme);
  applyLauncherBorderRadius(state.launcherBorderRadius);
  applyAnimationSpeed(state.launcherAnimationSpeed);
  applyFontScale(state.launcherFontScale);
  applyBlurIntensity(state.launcherBlurIntensity);
  applyCompactMode(state.launcherCompactMode);
  applyLauncherUiMode(state.launcherUiMode);
  applyBackgroundEffect(state.backgroundEffect);
  applyBackgroundIntensity(state.backgroundIntensity);

  // Navigation
  document.getElementById("btn-open-settings")?.addEventListener("click", () => switchView("settings"));
  document.getElementById("btn-close-settings")?.addEventListener("click", () => switchView("main"));
  document.getElementById("btn-open-mods")?.addEventListener("click", () => {
    switchView("mods");
    actions.modpacks?.mpRenderList?.();
  });
  document.getElementById("btn-close-mods")?.addEventListener("click", () => switchView("main"));

  // Reset settings to main (general) tab when entering the settings view
  document.addEventListener("idk:view-changed", (e) => {
    if (e.detail?.viewName === "settings") {
      const classicTab = document.querySelector('.settings-tab[data-settings-tab="general"]');
      if (classicTab) classicTab.click();
      const advTab = document.querySelector('.advanced-tab[data-adv-tab="general"]');
      if (advTab) advTab.click();
    }
  });

  // UI mode toggle (shared between classic/advanced)
  function bindUiModeToggle(containerSelector) {
    document.querySelectorAll(`${containerSelector} .pill-switch-option`).forEach((card) => {
      card.addEventListener("click", () => {
        applyLauncherUiMode(card.dataset.uiMode);
        rebindSettingsUI();
      });
    });
  }
  bindUiModeToggle("#launcher-ui-modes");

  // Mode-aware binding
  function rebindSettingsUI() {
    // Clear previous binding markers so the current mode can bind fresh
    const view = document.getElementById("view-settings");
    if (view) {
      view.classList.remove("classic-bound", "advanced-bound");
    }

    if (state.launcherUiMode === "advanced") {
      bindAdvancedUI();
    } else {
      bindClassicUI();
    }
  }

  function bindClassicUI() {
    // Prevent double-binding on repeated calls
    if (document.getElementById("view-settings")?.classList.contains("classic-bound")) return;
    document.getElementById("view-settings")?.classList.add("classic-bound");

    function updateCustomColorRow() {
      const row = document.getElementById("custom-color-row");
      if (row) row.style.display = state.launcherTheme === "custom" ? "flex" : "none";
    }

    // Theme picker
    document.querySelectorAll(".theme-choice-card").forEach((card) => {
      card.removeEventListener("click", card._handler);
      card._handler = () => {
        applyLauncherTheme(card.dataset.theme);
        const colorInput = document.getElementById("custom-accent-picker");
        if (colorInput && card.dataset.theme === "custom") {
          colorInput.value = state.launcherAccentColor;
        }
        updateCustomColorRow();
      };
      card.addEventListener("click", card._handler);
    });

    // Custom color picker
    const colorPicker = document.getElementById("custom-accent-picker");
    const colorHexLabel = document.getElementById("custom-accent-hex");
    if (colorPicker) {
      colorPicker.value = state.launcherAccentColor;
      if (colorHexLabel) colorHexLabel.textContent = state.launcherAccentColor;
      colorPicker.addEventListener("input", (e) => {
        applyCustomAccentColor(e.target.value);
        if (colorHexLabel) colorHexLabel.textContent = e.target.value;
        if (state.launcherTheme !== "custom") {
          applyLauncherTheme("custom");
          colorPicker.value = e.target.value;
        }
      });
    }
    updateCustomColorRow();

    // Border radius
    const radiusSlider = document.getElementById("border-radius-slider");
    const radiusLabel = document.getElementById("border-radius-value");
    if (radiusSlider) {
      radiusSlider.value = state.launcherBorderRadius;
      if (radiusLabel) radiusLabel.textContent = `${state.launcherBorderRadius}px`;
      radiusSlider.addEventListener("input", (e) => {
        const v = parseInt(e.target.value);
        applyLauncherBorderRadius(v);
        if (radiusLabel) radiusLabel.textContent = `${v}px`;
      });
    }

    // Animation speed
    const animSlider = document.getElementById("animation-speed-slider");
    const animLabel = document.getElementById("animation-speed-value");
    if (animSlider) {
      animSlider.value = state.launcherAnimationSpeed;
      if (animLabel) animLabel.textContent = `${state.launcherAnimationSpeed}x`;
      animSlider.addEventListener("input", (e) => {
        const v = parseFloat(e.target.value);
        applyAnimationSpeed(v);
        if (animLabel) animLabel.textContent = `${v.toFixed(1)}x`;
      });
    }

    // Font scale
    const fontSlider = document.getElementById("font-scale-slider");
    const fontLabel = document.getElementById("font-scale-value");
    if (fontSlider) {
      fontSlider.value = state.launcherFontScale;
      if (fontLabel) fontLabel.textContent = `${Math.round(state.launcherFontScale * 100)}%`;
      fontSlider.addEventListener("input", (e) => {
        const v = parseFloat(e.target.value);
        applyFontScale(v);
        if (fontLabel) fontLabel.textContent = `${Math.round(v * 100)}%`;
      });
    }

    // Blur intensity
    document.querySelectorAll(".blur-choice-card").forEach((card) => {
      card.addEventListener("click", () => {
        applyBlurIntensity(card.dataset.blur);
        document.querySelectorAll(".blur-choice-card").forEach((c) => {
          c.classList.toggle("active", c.dataset.blur === card.dataset.blur);
        });
      });
    });

    // Compact mode
    const compactToggle = document.getElementById("compact-mode-toggle");
    if (compactToggle) {
      compactToggle.checked = state.launcherCompactMode;
      compactToggle.addEventListener("change", (e) => applyCompactMode(e.target.checked));
    }

    // Accessibility tab – sync sliders
    const accessAnimSlider = document.getElementById("access-animation-speed-slider");
    const accessAnimLabel = document.getElementById("access-animation-speed-value");
    if (accessAnimSlider) {
      accessAnimSlider.value = state.launcherAnimationSpeed;
      if (accessAnimLabel) accessAnimLabel.textContent = `${state.launcherAnimationSpeed}x`;
      accessAnimSlider.addEventListener("input", (e) => {
        const v = parseFloat(e.target.value);
        applyAnimationSpeed(v);
        if (accessAnimLabel) accessAnimLabel.textContent = `${v.toFixed(1)}x`;
        const mainAnimSlider = document.getElementById("animation-speed-slider");
        const mainAnimLabel = document.getElementById("animation-speed-value");
        if (mainAnimSlider) mainAnimSlider.value = v;
        if (mainAnimLabel) mainAnimLabel.textContent = `${v.toFixed(1)}x`;
      });
    }
    const accessCompactToggle = document.getElementById("access-compact-toggle");
    if (accessCompactToggle) {
      accessCompactToggle.checked = state.launcherCompactMode;
      accessCompactToggle.addEventListener("change", (e) => {
        applyCompactMode(e.target.checked);
        const mainCompactToggle = document.getElementById("compact-mode-toggle");
        if (mainCompactToggle) mainCompactToggle.checked = e.target.checked;
      });
    }
    if (compactToggle) {
      compactToggle.addEventListener("change", (e) => {
        if (accessCompactToggle) accessCompactToggle.checked = e.target.checked;
      });
    }

    const btnRedoTutorial = document.getElementById("btn-redo-tutorial");
    if (btnRedoTutorial) {
      btnRedoTutorial.addEventListener("click", async () => {
        localStorage.removeItem("idk_tutorial_completed_v2");
        const { initTutorial } = await import("../tutorial/tutorial.js");
        initTutorial();
      });
    }

    // Classic tab switching
    function switchSettingsTab(tabId) {
      document.querySelectorAll(".settings-tab").forEach((tab) => {
        tab.classList.toggle("active", tab.dataset.settingsTab === tabId);
      });
      document.querySelectorAll(".settings-tab-panel").forEach((panel) => {
        panel.classList.toggle("active", panel.id === `settings-panel-${tabId}`);
      });
      const indicator = document.getElementById("settings-tab-indicator");
      const activeTab = document.querySelector(`.settings-tab[data-settings-tab="${tabId}"]`);
      if (indicator && activeTab) {
        const tabBar = document.getElementById("settings-tab-bar");
        if (tabBar) {
          const tabRect = activeTab.getBoundingClientRect();
          const barRect = tabBar.getBoundingClientRect();
          indicator.style.width = `${tabRect.width}px`;
          indicator.style.transform = `translateX(${tabRect.left - barRect.left}px)`;
        }
      }
    }

    document.querySelectorAll(".settings-tab").forEach((tab) => {
      tab.addEventListener("click", () => switchSettingsTab(tab.dataset.settingsTab));
    });

    requestAnimationFrame(() => {
      const activeTab = document.querySelector(".settings-tab.active");
      const indicator = document.getElementById("settings-tab-indicator");
      const tabBar = document.getElementById("settings-tab-bar");
      if (indicator && activeTab && tabBar) {
        const tabRect = activeTab.getBoundingClientRect();
        const barRect = tabBar.getBoundingClientRect();
        indicator.style.width = `${tabRect.width}px`;
        indicator.style.transform = `translateX(${tabRect.left - barRect.left}px)`;
      }
    });

    // Custom Minecraft Location
    const customMinecraftPathInput = document.getElementById("custom-minecraft-path");
    if (customMinecraftPathInput) {
      customMinecraftPathInput.value = state.customMinecraftPath || "";
      document.getElementById("btn-browse-minecraft-path")?.addEventListener("click", async () => {
        if (window.electronAPI?.selectMinecraftFolder) {
          const result = await window.electronAPI.selectMinecraftFolder();
          if (result && result.success && result.filePath) {
            state.customMinecraftPath = result.filePath;
            customMinecraftPathInput.value = state.customMinecraftPath;
            localStorage.setItem("idk_custom_minecraft_path", state.customMinecraftPath);
            await window.electronAPI.saveSettings({ customMinecraftPath: state.customMinecraftPath });
            if (actions.scanDownloadedVersions) await actions.scanDownloadedVersions();
          }
        }
      });
      document.getElementById("btn-clear-minecraft-path")?.addEventListener("click", async () => {
        state.customMinecraftPath = "";
        customMinecraftPathInput.value = "";
        localStorage.setItem("idk_custom_minecraft_path", "");
        if (window.electronAPI) await window.electronAPI.saveSettings({ customMinecraftPath: "" });
        if (actions.scanDownloadedVersions) await actions.scanDownloadedVersions();
      });
    }

    // Java path
    const javaPathInput = document.getElementById("java-path");
    if (javaPathInput) {
      javaPathInput.value = state.javaPath;
      javaPathInput.addEventListener("input", (e) => {
        state.javaPath = e.target.value;
        localStorage.setItem("craftlaunch_javaPath", state.javaPath);
        persistVisualSettings();
      });
    }

    // Global Java Arguments
    const globalJavaArgsInput = document.getElementById("global-java-args");
    if (globalJavaArgsInput) {
      globalJavaArgsInput.value = state.globalJavaArgs || "";
      globalJavaArgsInput.addEventListener("input", (e) => {
        state.globalJavaArgs = e.target.value;
        localStorage.setItem("idk_global_java_args", state.globalJavaArgs);
        persistVisualSettings();
      });
    }

    // Default Window Size
    const defaultWidthInput = document.getElementById("default-window-width");
    const defaultHeightInput = document.getElementById("default-window-height");
    const fullscreenToggle = document.getElementById("fullscreen-toggle");
    const overlayToggle = document.getElementById("overlay-toggle");

    if (defaultWidthInput) {
      defaultWidthInput.value = state.defaultWindowWidth || 1024;
      defaultWidthInput.addEventListener("input", (e) => {
        state.defaultWindowWidth = parseInt(e.target.value) || 1024;
        localStorage.setItem("idk_default_window_width", state.defaultWindowWidth);
        persistVisualSettings();
      });
    }
    if (defaultHeightInput) {
      defaultHeightInput.value = state.defaultWindowHeight || 768;
      defaultHeightInput.addEventListener("input", (e) => {
        state.defaultWindowHeight = parseInt(e.target.value) || 768;
        localStorage.setItem("idk_default_window_height", state.defaultWindowHeight);
        persistVisualSettings();
      });
    }
    if (fullscreenToggle) {
      fullscreenToggle.checked = state.defaultFullscreen || false;
      fullscreenToggle.addEventListener("change", (e) => {
        state.defaultFullscreen = e.target.checked;
        localStorage.setItem("idk_default_fullscreen", state.defaultFullscreen);
        persistVisualSettings();
      });
    }
    if (overlayToggle) {
      overlayToggle.checked = state.enableOverlay || false;
      overlayToggle.addEventListener("change", (e) => {
        state.enableOverlay = e.target.checked;
        localStorage.setItem("idk_enable_overlay", state.enableOverlay);
        persistVisualSettings();
      });
    }

    // Hide launcher toggle
    const hideLauncherToggle = document.getElementById("hide-launcher-toggle");
    if (hideLauncherToggle) {
      hideLauncherToggle.checked = state.hideLauncher;
      hideLauncherToggle.addEventListener("change", (e) => {
        state.hideLauncher = e.target.checked;
        localStorage.setItem("idk_hide_launcher", String(state.hideLauncher));
        persistVisualSettings();
      });
    }

    // Force verify on launch
    const forceUpdateToggle = document.getElementById("force-update-toggle");
    if (forceUpdateToggle) {
      forceUpdateToggle.checked = state.forceUpdate;
      forceUpdateToggle.addEventListener("change", (e) => {
        state.forceUpdate = e.target.checked;
        localStorage.setItem("idk_force_update", String(state.forceUpdate));
      });
    }

    // Performance boost (auto-optimization)
    const autoOptToggle = document.getElementById("auto-optimization");
    if (autoOptToggle) {
      autoOptToggle.checked = state.autoOptimization;
      autoOptToggle.addEventListener("change", (e) => {
        state.autoOptimization = e.target.checked;
        localStorage.setItem("craftlaunch_autoOptimization", String(state.autoOptimization));
        persistVisualSettings();
      });
    }

    // Memory slider
    const memSlider = document.getElementById("memory-slider");
    if (memSlider) {
      setMemory(state.maxMemoryGB);
      memSlider.addEventListener("input", () => setMemory(parseInt(memSlider.value)));
      document.querySelectorAll(".mem-preset-btn").forEach((b) => {
        b.addEventListener("click", () => setMemory(parseInt(b.dataset.gb)));
      });
    }

    // Performance mode
    document.querySelectorAll("#launcher-performance-modes .pill-switch-option").forEach((card) => {
      card.addEventListener("click", () =>
        applyLauncherPerformanceMode(card.dataset.performanceMode),
      );
    });
    applyLauncherPerformanceMode(state.launcherPerformanceMode);

    // Shared tools (open folder, check updates, devtools)
    bindSharedTools();
  }

  function bindAdvancedUI() {
    // Prevent double-binding on repeated calls
    const advContainer = document.querySelector(".advanced-settings");
    if (advContainer?.classList.contains("advanced-bound")) return;
    advContainer?.classList.add("advanced-bound");

    // Bind advanced UI mode toggle
    bindUiModeToggle("#adv-launcher-ui-modes");

    // Mark active mode on the advanced toggle
    document.querySelectorAll("#adv-launcher-ui-modes .pill-switch-option").forEach((opt) => {
      opt.classList.toggle("active", opt.dataset.uiMode === state.launcherUiMode);
    });

    // Advanced tab switching
    function switchAdvancedTab(tabId) {
      document.querySelectorAll(".advanced-tab").forEach((tab) => {
        tab.classList.toggle("active", tab.dataset.advTab === tabId);
      });
      document.querySelectorAll(".advanced-tab-panel").forEach((panel) => {
        panel.classList.toggle("active", panel.dataset.advPanel === tabId);
      });
      const indicator = document.querySelector(".advanced-tab-indicator");
      const activeTab = document.querySelector(`.advanced-tab[data-adv-tab="${tabId}"]`);
      if (indicator && activeTab) {
        const tabBar = document.querySelector(".advanced-tab-bar");
        if (tabBar) {
          const tabRect = activeTab.getBoundingClientRect();
          const barRect = tabBar.getBoundingClientRect();
          indicator.style.width = `${tabRect.width}px`;
          indicator.style.transform = `translateX(${tabRect.left - barRect.left}px)`;
        }
      }
    }

    document.querySelectorAll(".advanced-tab").forEach((tab) => {
      tab.addEventListener("click", () => switchAdvancedTab(tab.dataset.advTab));
    });

    requestAnimationFrame(() => {
      const activeTab = document.querySelector(".advanced-tab.active");
      const indicator = document.querySelector(".advanced-tab-indicator");
      const tabBar = document.querySelector(".advanced-tab-bar");
      if (indicator && activeTab && tabBar) {
        const tabRect = activeTab.getBoundingClientRect();
        const barRect = tabBar.getBoundingClientRect();
        indicator.style.width = `${tabRect.width}px`;
        indicator.style.transform = `translateX(${tabRect.left - barRect.left}px)`;
      }
    });

    // Accent swatch grid
    document.querySelectorAll(".accent-swatch").forEach((swatch) => {
      swatch.addEventListener("click", () => {
        const hex = swatch.dataset.accent;
        if (hex) {
          actions.applyCustomAccentColor(hex);
          applyLauncherTheme("custom");
          document.querySelectorAll(".accent-swatch").forEach((s) => {
            s.classList.toggle("active", s.dataset.accent === hex);
          });
          const customRow = document.getElementById("adv-accent-custom-row");
          if (customRow) customRow.classList.remove("visible");
        } else if (swatch.id === "adv-accent-custom") {
          const picker = document.getElementById("adv-accent-picker");
          const customRow = document.getElementById("adv-accent-custom-row");
          if (picker && customRow) {
            customRow.classList.toggle("visible");
            picker.click();
          }
        }
      });
    });

    // Custom accent picker
    const advPicker = document.getElementById("adv-accent-picker");
    const advHexLabel = document.getElementById("adv-accent-hex");
    if (advPicker) {
      advPicker.value = state.launcherAccentColor;
      if (advHexLabel) advHexLabel.textContent = state.launcherAccentColor;
      advPicker.addEventListener("input", (e) => {
        actions.applyCustomAccentColor(e.target.value);
        if (advHexLabel) advHexLabel.textContent = e.target.value;
        applyLauncherTheme("custom");
        document.querySelectorAll(".accent-swatch").forEach((s) => {
          s.classList.toggle("active", s.dataset.accent === e.target.value);
        });
      });
    }

    // Mark current accent swatch as active
    document.querySelectorAll(".accent-swatch").forEach((s) => {
      if (s.dataset.accent === state.launcherAccentColor) {
        s.classList.add("active");
      }
    });

    // Language
    const langSelect = document.getElementById("adv-language");
    if (langSelect) {
      langSelect.value = state.language;
      langSelect.addEventListener("change", (e) => applyLanguage(e.target.value));
    }

    // Toggles
    const toggleMap = {
      "adv-toggle-updates": applyAutoUpdates,
      "adv-toggle-discord": applyDiscordPresence,
      "adv-toggle-beta": applyBetaUpdates,
      "adv-toggle-logs": applyOpenLogsAfterLaunch,
      "adv-toggle-hide": (v) => { state.hideLauncher = v; localStorage.setItem("idk_hide_launcher", String(v)); persistVisualSettings(); },
      "adv-toggle-analytics": applyAnalytics,
    };
    const toggleStateMap = {
      "adv-toggle-updates": state.autoUpdates,
      "adv-toggle-discord": state.discordPresence,
      "adv-toggle-beta": state.betaUpdates,
      "adv-toggle-logs": state.openLogsAfterLaunch,
      "adv-toggle-hide": state.hideLauncher,
      "adv-toggle-analytics": state.analyticsEnabled,
    };

    Object.entries(toggleMap).forEach(([id, handler]) => {
      const el = document.getElementById(id);
      if (el) {
        el.checked = toggleStateMap[id];
        el.addEventListener("change", (e) => handler(e.target.checked));
      }
    });

    // Background effect cards
    document.querySelectorAll(".bg-effect-card").forEach((card) => {
      card.addEventListener("click", () => {
        const effect = card.dataset.effect;
        if (!effect) return;
        applyBackgroundEffect(effect);
        document.querySelectorAll(".bg-effect-card").forEach((c) => {
          c.classList.toggle("active", c.dataset.effect === effect);
        });
      });
    });
    // Mark active effect
    document.querySelectorAll(".bg-effect-card").forEach((c) => {
      c.classList.toggle("active", c.dataset.effect === state.backgroundEffect);
    });

    // Background intensity
    const bgIntensity = document.getElementById("adv-bg-intensity");
    const bgIntensityVal = document.getElementById("adv-bg-intensity-value");
    if (bgIntensity) {
      bgIntensity.value = state.backgroundIntensity;
      if (bgIntensityVal) bgIntensityVal.textContent = state.backgroundIntensity;
      bgIntensity.addEventListener("input", (e) => {
        const v = parseInt(e.target.value);
        applyBackgroundIntensity(v);
        if (bgIntensityVal) bgIntensityVal.textContent = v;
      });
    }

    // ── Background effect configs ──
    let bgCfg = {};
    try { bgCfg = JSON.parse(localStorage.getItem("idk_bg_config") || "{}"); } catch {}

    function saveBgCfg() {
      localStorage.setItem("idk_bg_config", JSON.stringify(bgCfg));
      if (window.restartCurrentEffect) window.restartCurrentEffect();
    }

    function updateConfigVisibility() {
      const effect = state.backgroundEffect;
      const nebulaEl = document.getElementById("adv-bg-nebula-config");
      const liquidEl = document.getElementById("adv-bg-liquid-config");
      const starfieldEl = document.getElementById("adv-bg-starfield-config");
      if (nebulaEl) nebulaEl.style.display = effect === "nebula" ? "" : "none";
      if (liquidEl) liquidEl.style.display = effect === "liquid" ? "" : "none";
      if (starfieldEl) starfieldEl.style.display = effect === "starfield" ? "" : "none";
    }
    updateConfigVisibility();

    const origApplyBg = applyBackgroundEffect;
    applyBackgroundEffect = function(effect) {
      origApplyBg(effect);
      updateConfigVisibility();
    };

    document.querySelectorAll("#adv-nebula-schemes .bg-scheme-card").forEach((card) => {
      card.addEventListener("click", () => {
        const scheme = parseInt(card.dataset.scheme);
        bgCfg.nebulaScheme = scheme;
        saveBgCfg();
        document.querySelectorAll("#adv-nebula-schemes .bg-scheme-card").forEach((c) => {
          c.classList.toggle("active", parseInt(c.dataset.scheme) === scheme);
        });
      });
      card.classList.toggle("active", parseInt(card.dataset.scheme) === (bgCfg.nebulaScheme || 0));
    });

    document.querySelectorAll("#adv-liquid-schemes .bg-scheme-card").forEach((card) => {
      card.addEventListener("click", () => {
        const scheme = parseInt(card.dataset.scheme);
        bgCfg.liquidScheme = scheme;
        saveBgCfg();
        document.querySelectorAll("#adv-liquid-schemes .bg-scheme-card").forEach((c) => {
          c.classList.toggle("active", parseInt(c.dataset.scheme) === scheme);
        });
      });
      card.classList.toggle("active", parseInt(card.dataset.scheme) === (bgCfg.liquidScheme || 0));
    });

    const sfToggles = [
      { id: "adv-sf-milkyway", key: "starfieldMilkyWay" },
      { id: "adv-sf-galaxy", key: "starfieldGalaxy" },
      { id: "adv-sf-constellations", key: "starfieldConstellations" },
      { id: "adv-sf-planet", key: "starfieldPlanet" },
    ];
    for (const { id, key } of sfToggles) {
      const el = document.getElementById(id);
      if (el) {
        el.checked = bgCfg[key] !== false;
        el.addEventListener("change", () => {
          bgCfg[key] = el.checked;
          saveBgCfg();
        });
      }
    }

    // Concurrent downloads
    const concDl = document.getElementById("adv-concurrent-dl");
    const concDlVal = document.getElementById("adv-concurrent-dl-value");
    if (concDl) {
      concDl.value = state.concurrentDownloads;
      if (concDlVal) concDlVal.textContent = state.concurrentDownloads;
      concDl.addEventListener("input", (e) => {
        const v = parseInt(e.target.value);
        applyConcurrentDownloads(v);
        if (concDlVal) concDlVal.textContent = v;
      });
    }

    // Concurrent I/O
    const concIo = document.getElementById("adv-concurrent-io");
    const concIoVal = document.getElementById("adv-concurrent-io-value");
    if (concIo) {
      concIo.value = state.concurrentIO;
      if (concIoVal) concIoVal.textContent = state.concurrentIO;
      concIo.addEventListener("input", (e) => {
        const v = parseInt(e.target.value);
        applyConcurrentIO(v);
        if (concIoVal) concIoVal.textContent = v;
      });
    }

    // Advanced performance mode
    document.querySelectorAll("#adv-launcher-performance-modes .pill-switch-option").forEach((card) => {
      card.addEventListener("click", () =>
        applyLauncherPerformanceMode(card.dataset.performanceMode),
      );
    });
    applyLauncherPerformanceMode(state.launcherPerformanceMode);

    // Advanced memory
    const advMemSlider = document.getElementById("adv-memory-slider");
    if (advMemSlider) {
      setMemory(state.maxMemoryGB);
      advMemSlider.addEventListener("input", () => setMemory(parseInt(advMemSlider.value)));
      document.querySelectorAll(".adv-mem-preset").forEach((b) => {
        b.addEventListener("click", () => setMemory(parseInt(b.dataset.gb)));
      });
    }

    // Advanced auto-optimization
    const advAutoOpt = document.getElementById("adv-auto-optimization");
    if (advAutoOpt) {
      advAutoOpt.checked = state.autoOptimization;
      advAutoOpt.addEventListener("change", (e) => {
        state.autoOptimization = e.target.checked;
        localStorage.setItem("craftlaunch_autoOptimization", String(state.autoOptimization));
        persistVisualSettings();
        const classicAutoOpt = document.getElementById("auto-optimization");
        if (classicAutoOpt) classicAutoOpt.checked = e.target.checked;
      });
    }

    // Advanced compact mode
    const advCompactToggle = document.getElementById("adv-compact-mode-toggle");
    if (advCompactToggle) {
      advCompactToggle.checked = state.launcherCompactMode;
      advCompactToggle.addEventListener("change", (e) => {
        applyCompactMode(e.target.checked);
        const classicCompactToggle = document.getElementById("compact-mode-toggle");
        if (classicCompactToggle) classicCompactToggle.checked = e.target.checked;
        const accessCompactToggle = document.getElementById("access-compact-toggle");
        if (accessCompactToggle) accessCompactToggle.checked = e.target.checked;
      });
    }

    // Border radius (advanced)
    const advRadius = document.getElementById("adv-border-radius");
    const advRadiusVal = document.getElementById("adv-border-radius-value");
    if (advRadius) {
      advRadius.value = state.launcherBorderRadius;
      if (advRadiusVal) advRadiusVal.textContent = `${state.launcherBorderRadius}px`;
      advRadius.addEventListener("input", (e) => {
        const v = parseInt(e.target.value);
        applyLauncherBorderRadius(v);
        if (advRadiusVal) advRadiusVal.textContent = `${v}px`;
        const classicRadius = document.getElementById("border-radius-slider");
        const classicRadiusVal = document.getElementById("border-radius-value");
        if (classicRadius) classicRadius.value = v;
        if (classicRadiusVal) classicRadiusVal.textContent = `${v}px`;
      });
    }

    // Debug terminal
    const clearBtn = document.getElementById("adv-debug-clear");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        const term = document.getElementById("adv-debug-terminal");
        if (term) term.innerHTML = "<div class='debug-line' style='color:#666;'>[IDK Launcher] Console cleared.</div>";
      });
    }

    // DevTools in debug tab
    document.getElementById("adv-toggle-devtools")?.addEventListener("click", () => {
      if (window.electronAPI) {
        window.electronAPI.toggleDevTools();
      }
    });

    // Write a startup debug line
    const term = document.getElementById("adv-debug-terminal");
    if (term) {
      const line = document.createElement("div");
      line.className = "debug-line";
      line.style.color = "var(--theme-accent)";
      line.textContent = `[IDK Launcher] Advanced UI initialized. Theme: ${state.launcherTheme}, Border: ${state.launcherBorderRadius}px`;
      term.appendChild(line);
    }


    // Animation speed (Advanced)
    const advAnim = document.getElementById('adv-animation-speed');
    const advAnimVal = document.getElementById('adv-animation-speed-value');
    if (advAnim) {
      advAnim.value = state.launcherAnimationSpeed;
      if (advAnimVal) advAnimVal.textContent = `${parseFloat(state.launcherAnimationSpeed).toFixed(1)}x`;
      advAnim.addEventListener('input', (e) => {
        const v = parseFloat(e.target.value);
        applyAnimationSpeed(v);
        if (advAnimVal) advAnimVal.textContent = `${v.toFixed(1)}x`;
        const classicAnim = document.getElementById('animation-speed-slider');
        const classicAnimVal = document.getElementById('animation-speed-value');
        if (classicAnim) classicAnim.value = v;
        if (classicAnimVal) classicAnimVal.textContent = `${v.toFixed(1)}x`;
        const accessAnim = document.getElementById('access-animation-speed-slider');
        if (accessAnim) accessAnim.value = v;
      });
    }

    // Font scale (Advanced)
    const advFont = document.getElementById('adv-font-scale');
    const advFontVal = document.getElementById('adv-font-scale-value');
    if (advFont) {
      advFont.value = state.launcherFontScale;
      if (advFontVal) advFontVal.textContent = `${Math.round(state.launcherFontScale * 100)}%`;
      advFont.addEventListener('input', (e) => {
        const v = parseFloat(e.target.value);
        applyFontScale(v);
        if (advFontVal) advFontVal.textContent = `${Math.round(v * 100)}%`;
      });
    }

    // Blur intensity (Advanced)
    const advBlurGroup = document.getElementById('adv-blur-choices');
    if (advBlurGroup) {
      advBlurGroup.querySelectorAll('.blur-choice-card').forEach((card) => {
        card.classList.toggle('active', card.dataset.blur === state.launcherBlurIntensity);
        card.addEventListener('click', () => {
          applyBlurIntensity(card.dataset.blur);
          advBlurGroup.querySelectorAll('.blur-choice-card').forEach((c) => {
            c.classList.toggle('active', c.dataset.blur === card.dataset.blur);
          });
        });
      });
    }

    // Advanced duplicate border-radius / compact-mode (cross-sync only; primary controls are in the General tab)
    const advBorder2 = document.getElementById('adv-border-radius-2');
    const advBorder2Val = document.getElementById('adv-border-radius-value-2');
    if (advBorder2) {
      advBorder2.value = state.launcherBorderRadius;
      if (advBorder2Val) advBorder2Val.textContent = `${state.launcherBorderRadius}px`;
      advBorder2.addEventListener('input', (e) => {
        const v = parseInt(e.target.value);
        applyLauncherBorderRadius(v);
        if (advBorder2Val) advBorder2Val.textContent = `${v}px`;
      });
    }
    const advCompact2 = document.getElementById('adv-compact-mode-toggle-2');
    if (advCompact2) {
      advCompact2.checked = state.launcherCompactMode;
      advCompact2.addEventListener('change', (e) => applyCompactMode(e.target.checked));
    }

    const advRedoTutorial = document.getElementById('adv-redo-tutorial');
    if (advRedoTutorial) {
      advRedoTutorial.addEventListener('click', async () => {
        localStorage.removeItem("idk_tutorial_completed_v2");
        const { initTutorial } = await import("../tutorial/tutorial.js");
        initTutorial();
      });
    }

    // Java path / global args / window size / overlay / custom Minecraft path
    const advJavaPath = document.getElementById('adv-java-path');
    if (advJavaPath) {
      advJavaPath.value = state.javaPath || '';
      advJavaPath.addEventListener('input', (e) => {
        state.javaPath = e.target.value;
        localStorage.setItem('craftlaunch_javaPath', state.javaPath);
        const classic = document.getElementById('java-path');
        if (classic) classic.value = e.target.value;
        persistVisualSettings();
      });
    }
    const advGlobalArgs = document.getElementById('adv-global-java-args');
    if (advGlobalArgs) {
      advGlobalArgs.value = state.globalJavaArgs || '';
      advGlobalArgs.addEventListener('input', (e) => {
        state.globalJavaArgs = e.target.value;
        localStorage.setItem('idk_global_java_args', state.globalJavaArgs);
        const classic = document.getElementById('global-java-args');
        if (classic) classic.value = e.target.value;
        persistVisualSettings();
      });
    }
    const advWidth = document.getElementById('adv-default-window-width');
    const advHeight = document.getElementById('adv-default-window-height');
    const advSizeVal = document.getElementById('adv-window-size-value');
    function syncAdvSizeLabel() {
      if (advSizeVal) advSizeVal.textContent = `${state.defaultWindowWidth || 1024} x ${state.defaultWindowHeight || 768}`;
    }
    if (advWidth) {
      advWidth.value = state.defaultWindowWidth || 1024;
      advWidth.addEventListener('input', (e) => {
        state.defaultWindowWidth = parseInt(e.target.value) || 1024;
        localStorage.setItem('idk_default_window_width', state.defaultWindowWidth);
        syncAdvSizeLabel();
        const classic = document.getElementById('default-window-width');
        if (classic) classic.value = e.target.value;
        persistVisualSettings();
      });
    }
    if (advHeight) {
      advHeight.value = state.defaultWindowHeight || 768;
      advHeight.addEventListener('input', (e) => {
        state.defaultWindowHeight = parseInt(e.target.value) || 768;
        localStorage.setItem('idk_default_window_height', state.defaultWindowHeight);
        syncAdvSizeLabel();
        const classic = document.getElementById('default-window-height');
        if (classic) classic.value = e.target.value;
        persistVisualSettings();
      });
    }
    syncAdvSizeLabel();

    const advFullscreen = document.getElementById('adv-fullscreen-toggle');
    if (advFullscreen) {
      advFullscreen.checked = state.defaultFullscreen || false;
      advFullscreen.addEventListener('change', (e) => {
        state.defaultFullscreen = e.target.checked;
        localStorage.setItem('idk_default_fullscreen', state.defaultFullscreen);
        const classic = document.getElementById('fullscreen-toggle');
        if (classic) classic.checked = e.target.checked;
        persistVisualSettings();
      });
    }
    const advOverlay = document.getElementById('adv-overlay-toggle');
    if (advOverlay) {
      advOverlay.checked = state.enableOverlay || false;
      advOverlay.addEventListener('change', (e) => {
        state.enableOverlay = e.target.checked;
        localStorage.setItem('idk_enable_overlay', state.enableOverlay);
        const classic = document.getElementById('overlay-toggle');
        if (classic) classic.checked = e.target.checked;
        persistVisualSettings();
      });
    }

    // Custom Minecraft path (browse + clear)
    const advCustomPath = document.getElementById('adv-custom-minecraft-path');
    if (advCustomPath) {
      advCustomPath.value = state.customMinecraftPath || '';
      const advBrowse = document.getElementById('adv-btn-browse-minecraft-path');
      if (advBrowse) advBrowse.addEventListener('click', async () => {
        if (window.electronAPI?.selectMinecraftFolder) {
          const result = await window.electronAPI.selectMinecraftFolder();
          if (result && result.success && result.filePath) {
            state.customMinecraftPath = result.filePath;
            advCustomPath.value = state.customMinecraftPath;
            localStorage.setItem('idk_custom_minecraft_path', state.customMinecraftPath);
            await window.electronAPI.saveSettings({ customMinecraftPath: state.customMinecraftPath });
            const classic = document.getElementById('custom-minecraft-path');
            if (classic) classic.value = result.filePath;
            if (actions.scanDownloadedVersions) await actions.scanDownloadedVersions();
          }
        }
      });
      const advClear = document.getElementById('adv-btn-clear-minecraft-path');
      if (advClear) advClear.addEventListener('click', async () => {
        state.customMinecraftPath = '';
        advCustomPath.value = '';
        localStorage.setItem('idk_custom_minecraft_path', '');
        if (window.electronAPI) await window.electronAPI.saveSettings({ customMinecraftPath: '' });
        const classic = document.getElementById('custom-minecraft-path');
        if (classic) classic.value = '';
        if (actions.scanDownloadedVersions) await actions.scanDownloadedVersions();
      });
    }

    // About tab buttons (reuse bindSharedTools but with the new adv- IDs)
    document.getElementById('adv-btn-open-folder')?.addEventListener('click', () => {
      if (window.electronAPI) window.electronAPI.openMinecraftFolder();
      else showAlertDialog({ title: 'Unavailable', message: 'This feature is only available in the desktop app.', variant: 'info' });
    });
    document.getElementById('adv-btn-open-folder-top')?.addEventListener('click', () => {
      if (window.electronAPI) window.electronAPI.openMinecraftFolder();
      else showAlertDialog({ title: 'Unavailable', message: 'This feature is only available in the desktop app.', variant: 'info' });
    });
    const advCheckUpdates = document.getElementById('adv-btn-check-launcher-updates');
    if (advCheckUpdates) advCheckUpdates.addEventListener('click', async () => {
      const original = advCheckUpdates.innerText;
      advCheckUpdates.innerText = 'Checking...';
      advCheckUpdates.disabled = true;
      try {
        if (window.electronAPI?.checkForUpdates) {
          const result = await window.electronAPI.checkForUpdates();
          if (result.updateAvailable) {
            const modal = document.getElementById("update-modal");
            if (modal) modal.classList.add("active");
            else actions.showWarningToast(`Update available: ${result.latestVersion}`);
          } else {
            actions.showWarningToast('You are running the latest version!');
          }
        }
      } catch (e) {
        console.error('Failed to check for updates:', e);
        actions.showWarningToast('Failed to check for updates');
      } finally {
        advCheckUpdates.innerText = original;
        advCheckUpdates.disabled = false;
      }
    });
    document.getElementById('adv-btn-toggle-devtools')?.addEventListener('click', () => {
      if (window.electronAPI) window.electronAPI.toggleDevTools();
      else showAlertDialog({ title: 'Unavailable', message: 'Debug console is only available in the desktop app.', variant: 'info' });
    });

    // Shared tools
    bindSharedTools();
  }

  function bindSharedTools() {
    // Open folder
    document.getElementById("btn-open-folder")?.addEventListener("click", () => {
      if (window.electronAPI) {
        window.electronAPI.openMinecraftFolder();
      } else {
        alert("This feature is only available in the desktop app.");
      }
    });

    // Check updates
    document.getElementById("btn-check-launcher-updates")?.addEventListener("click", async () => {
      const btn = document.getElementById("btn-check-launcher-updates");
      const originalText = btn.innerText;
      btn.innerText = "Checking...";
      btn.disabled = true;
      try {
        if (window.electronAPI?.checkForUpdates) {
          const result = await window.electronAPI.checkForUpdates();
          if (result.updateAvailable) {
            const modal = document.getElementById("update-modal");
            if (modal) modal.classList.add("active");
            else actions.showWarningToast(`Update available: ${result.latestVersion}`);
          } else {
            actions.showWarningToast("You are running the latest version!");
          }
        }
      } catch (e) {
        console.error("Failed to check for updates:", e);
        actions.showWarningToast("Failed to check for updates");
      } finally {
        btn.innerText = originalText;
        btn.disabled = false;
      }
    });

    // DevTools
    document.getElementById("btn-toggle-devtools")?.addEventListener("click", () => {
      if (window.electronAPI) {
        window.electronAPI.toggleDevTools();
      } else {
        alert("Debug console is only available in the desktop app.");
      }
    });
  }

  // Initial bind
  rebindSettingsUI();
}

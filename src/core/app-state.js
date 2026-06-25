import { safeParse } from "./safe-parse.js";

const lastPlayed = safeParse(
  localStorage.getItem("idk_last_played"),
  { version: null, loader: "Vanilla" },
);

export const state = {
  quickConnectTarget: null,
  currentUser: localStorage.getItem("craftlaunch_username") || "",
  authMode: localStorage.getItem("craftlaunch_authmode") || "offline",
  selectedVersion: lastPlayed.version,
  selectedLoader: lastPlayed.loader,
  selectedIsModpack: localStorage.getItem('idk_last_played_is_modpack') === 'true',
  selectedModpackId: localStorage.getItem('idk_last_played_modpack_id') || null,
  autoOptimization:
    localStorage.getItem("craftlaunch_autoOptimization") === "true",
  hideLauncher: localStorage.getItem("idk_hide_launcher") !== "false",
  launcherPerformanceMode:
    localStorage.getItem("idk_launcher_performance_mode") || "balanced",
  launcherTheme: localStorage.getItem("idk_launcher_theme") || "emerald",
  launcherUiMode: localStorage.getItem("idk_launcher_ui_mode") || "classic",
  launcherBorderRadius:
    parseInt(localStorage.getItem("idk_border_radius") || "10", 10),
  launcherAccentColor:
    localStorage.getItem("idk_accent_color") || "#4cb837",
  launcherAnimationSpeed:
    parseFloat(localStorage.getItem("idk_animation_speed") || "1"),
  launcherFontScale:
    parseFloat(localStorage.getItem("idk_font_scale") || "1"),
  launcherBlurIntensity:
    localStorage.getItem("idk_blur_intensity") || "medium",
  launcherCompactMode:
    localStorage.getItem("idk_compact_mode") === "true",
  enableOverlay: localStorage.getItem("idk_enable_overlay") === "true",
  language: localStorage.getItem("idk_language") || "en",
  backgroundEffect: localStorage.getItem("idk_background_effect") || "particles",
  backgroundIntensity: parseInt(localStorage.getItem("idk_background_intensity") || "50", 10),
  concurrentDownloads: parseInt(localStorage.getItem("idk_concurrent_downloads") || "4", 10),
  concurrentIO: Math.min(parseInt(localStorage.getItem("idk_concurrent_io") || "2", 10), 8),
  autoUpdates: localStorage.getItem("idk_auto_updates") !== "false",
  discordPresence: localStorage.getItem("idk_discord_presence") !== "false",
  betaUpdates: localStorage.getItem("idk_beta_updates") === "true",
  openLogsAfterLaunch: localStorage.getItem("idk_open_logs") === "true",
  analyticsEnabled: localStorage.getItem("idk_analytics") === "true",
  javaPath: localStorage.getItem("craftlaunch_javaPath") || "",
  globalJavaArgs: localStorage.getItem("idk_global_java_args") || "",
  forceUpdate: localStorage.getItem("idk_force_update") === "true",
  customMinecraftPath: localStorage.getItem("idk_custom_minecraft_path") || "",
  defaultWindowWidth: parseInt(
    localStorage.getItem("idk_default_window_width") || "1024",
    10,
  ),
  defaultWindowHeight: parseInt(
    localStorage.getItem("idk_default_window_height") || "768",
    10,
  ),
  defaultFullscreen: localStorage.getItem("idk_default_fullscreen") === "true",
  maxMemoryGB: parseInt(localStorage.getItem("craftlaunch_maxMemory") || "4", 10),
  allVersions: [],
  sodiumSupportedVersions: new Set(),
  downloadedVersions: [],
  modpacks: safeParse(localStorage.getItem("idk_modpacks"), []),
  versionSettings: safeParse(
    localStorage.getItem("idk_version_settings"),
    {},
  ),
  activeModpackId: null,
  activeVersionForMods: null,
  browserMode: "mod",
  currentProvider: "modrinth",
  browserPage: 0,
  browserQuery: "",
  browserTotalResults: 0,
};

export const actions = {};

window.IdkApp = { state, actions };

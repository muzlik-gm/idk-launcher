import { safeParse, esc } from "../../core/safe-parse.js";
import { state, actions } from "../../core/app-state.js";

export function initModpacksFeature({ switchView }) {
  // Safe JSON parser for API responses
  async function safeJson(resp, fallback = null) {
    if (!resp) return fallback;
    if (!resp.ok) {
      let body = "";
      try { body = await resp.text(); } catch (_) {}
      throw new Error(`API error ${resp.status}: ${resp.statusText}. ${body.slice(0, 200)}`);
    }
    try {
      return await resp.json();
    } catch (e) {
      let body = "";
      try { body = await resp.text(); } catch (_) {}
      throw new Error(`Invalid JSON from API: ${body.slice(0, 200)}`);
    }
  }

  // Fetch with hard timeout — prevents hangs on slow/unreachable APIs.
  // `statusOnTimeout` updates the panel status so the user sees a clear
  // "TIMED OUT" message instead of a silent hang.
  async function fetchWithTimeout(url, options = {}, timeoutMs = 10000, statusOnTimeout = null) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (e) {
      if (e?.name === "AbortError") {
        if (statusOnTimeout) {
          const statusEl = document.getElementById("ddp-status");
          if (statusEl) statusEl.innerText = statusOnTimeout;
        }
        throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s: ${url}`);
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  // === MODPACK MANAGER =====================================
  // =========================================================
  state.modpacks = safeParse(localStorage.getItem("idk_modpacks"), []);
  // Migrate old state.modpacks and remove any "Default Modpack" or generic "Modpack" placeholders
  const originalCount = state.modpacks.length;
  state.modpacks = state.modpacks.filter((mp) => {
    const n = (mp.name || "").trim().toLowerCase();
    return n !== "default modpack" && n !== "modpack" && n !== "new modpack";
  });
  state.modpacks = state.modpacks.map((mp) => ({
    mods: [],
    resourcepacks: [],
    shaders: [],
    ...mp,
  }));

  // Ensure all state.modpacks have iconUrl property
  state.modpacks = state.modpacks.map((mp) => ({
    ...mp,
    iconUrl: mp.iconUrl || "",
  }));

  // Fix IDs that were incorrectly stored with the 'modpack-' prefix
  // The id should be the raw part (e.g. 'mp9qv96i3i3uqistkjd'), not 'modpack-mp9qv96...'
  state.modpacks = state.modpacks.map((mp) => ({
    ...mp,
    id: (mp && typeof mp.id === "string" && mp.id.startsWith("modpack-"))
      ? mp.id.replace(/^modpack-/, "")
      : (mp && mp.id != null ? mp.id : `mp${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`),
  }));

  // Remove any entries whose id still contains 'modpack-' after stripping (double-nested duplicates)
  state.modpacks = state.modpacks.filter((mp) => !(mp && typeof mp.id === "string" && mp.id.startsWith("modpack-")));

  // Save immediately if we filtered anything out to prevent it from coming back
  if (state.modpacks.length !== originalCount) {
    localStorage.setItem("idk_modpacks", JSON.stringify(state.modpacks));
  }

  // Global flag to pause profile scanning during deletion
  let isDeleting = false;

  // Scan profiles directory on disk and merge with localStorage
  async function loadProfilesFromDisk() {
    // Skip if deletion is in progress
    if (isDeleting) {
      console.log("[Modpacks] Skipping scan - deletion in progress");
      return;
    }

    console.log("[Modpacks] loadProfilesFromDisk called");
    if (!window.electronAPI?.scanProfiles) {
      console.log("[Modpacks] scanProfiles API not available");
      return;
    }

    try {
      console.log("[Modpacks] Calling scanProfiles...");
      const result = await window.electronAPI.scanProfiles();
      // Log to main process via IPC so it shows in terminal
      const summary = result.profiles
        ?.map(
          (p) =>
            `${p.name}:mods=${p.diskMods?.length}rp=${p.diskResourcepacks?.length}sh=${p.diskShaders?.length}`,
        )
        .join(" | ");
      const logMsg = `scanProfiles returned: success=${result.success} profiles=${result.profiles?.length} | ${summary}`;
      console.log("[Modpacks]", logMsg);
      window.electronAPI?.rendererLog?.("[Modpacks] " + logMsg);
      console.log("[Modpacks] scanProfiles result:", result);
      if (result.success) {
        try {
          const diskProfiles = result.profiles || [];
          // Debug: log what disk returned
          diskProfiles.forEach((p) => {
            console.log(
              `[Modpacks] Disk profile: ${p.name} (${p.id}) \u2014 mods:${p.diskMods?.length || 0} rp:${p.diskResourcepacks?.length || 0} sh:${p.diskShaders?.length || 0}`,
            );
          });

          // Helper: merge disk file list with stored metadata
          // IMPORTANT: Preserve existing iconUrl from API (Modrinth/CurseForge) to avoid unnecessary JAR extraction
          const mergeFiles = (diskFiles, storedFiles) => {
            // storedFiles might be an object or non-array \u2014 normalize it
            const storedArr = Array.isArray(storedFiles) ? storedFiles : [];
            const storedMap = new Map(storedArr.map((f) => [f.filename, f]));
            return (diskFiles || []).map((df) => {
              const stored = storedMap.get(df.filename);
              return stored
                ? {
                    // Preserve all metadata from stored item, especially iconUrl from API
                    ...stored,
                    filename: df.filename, // Ensure filename is current
                  }
                : {
                    filename: df.filename,
                    name: df.filename.replace(/\.jar$|\.zip$/, ""),
                    modrinthId: "",
                    version: "",
                    iconUrl: "",
                  };
            });
          };

          // Build lookup maps \u2014 by ID and by name (for legacy matching)
          const existingById = new Map(state.modpacks.map((mp) => [mp.id, mp]));
          const existingByName = new Map(
            state.modpacks.map((mp) => [mp.name?.toLowerCase().trim(), mp]),
          );

          console.log(
            "[Modpacks] localStorage IDs:",
            state.modpacks.map((mp) => `${mp.id}="${mp.name}"`).join(", "),
          );
          console.log(
            "[Modpacks] Disk IDs:",
            diskProfiles.map((p) => `${p.id}="${p.name}"`).join(", "),
          );

          // Build a new state.modpacks array entirely from disk \u2014 disk is the source of truth
          // Preserve metadata (iconUrl, lastPlayed, modrinthId per file) from localStorage
          const newModpacks = diskProfiles.map((diskMp) => {
            // Try to find existing entry by ID, then by name
            const existing =
              existingById.get(diskMp.id) ||
              existingByName.get(diskMp.name?.toLowerCase().trim());
            const existingValidMcVersion =
              existing?.mcVersion && isValidMcVersion(existing.mcVersion)
                ? existing.mcVersion
                : null;

            return {
              id: diskMp.id,
              name:
                existing?.name && !existing.name.startsWith("Modpack (")
                  ? existing.name
                  : diskMp.name,
              mcVersion:
                diskMp.mcVersion !== "Unknown"
                  ? diskMp.mcVersion
                  : existingValidMcVersion || diskMp.mcVersion,
              // Loader: prefer localStorage (user's explicit choice) over profile.json.
              // If localStorage has no value but profile.json does, use profile.json.
              // This preserves the user's choice across restarts.
              loader:
                (existing?.loader && existing.loader !== "Vanilla")
                  ? existing.loader
                  : existing?.loader || diskMp.loader || "Vanilla",
              iconUrl: existing?.iconUrl || diskMp.iconUrl || null,
              favorite: existing?.favorite || false,
              lastPlayed: existing?.lastPlayed || diskMp.lastPlayed || null,
              loaderVersion: existing?.loaderVersion || diskMp.loaderVersion || "",
              javaArgs: existing?.javaArgs || diskMp.javaArgs || "",
              windowWidth: existing?.windowWidth || diskMp.windowWidth || 1024,
              windowHeight: existing?.windowHeight || diskMp.windowHeight || 768,
              description: existing?.description || diskMp.description || "",
              mods: mergeFiles(diskMp.diskMods || [], existing?.mods || []),
              resourcepacks: mergeFiles(
                diskMp.diskResourcepacks || [],
                existing?.resourcepacks || [],
              ),
              shaders: mergeFiles(
                diskMp.diskShaders || [],
                existing?.shaders || [],
              ),
            };
          });

          state.modpacks = newModpacks;
          const rebuildMsg =
            "After rebuild: " +
            state.modpacks
              .map(
                (m) =>
                  `${m.name}: mods=${m.mods?.length} rp=${m.resourcepacks?.length} sh=${m.shaders?.length}`,
              )
              .join(" | ");
          console.log("[Modpacks]", rebuildMsg);
          window.electronAPI?.rendererLog?.("[Modpacks] " + rebuildMsg);
          // Keep state.activeModpackId pointing to a valid modpack
          // The ID may have changed (legacy fix) \u2014 try to find by old ID first, then keep first
          if (
            state.activeModpackId &&
            !state.modpacks.find((m) => m.id === state.activeModpackId)
          ) {
            // Try to find by name match from old localStorage
            const oldMp = [
              ...new Map(state.modpacks.map((m) => [m.id, m])).values(),
            ][0];
            state.activeModpackId = oldMp?.id || null;
          }

          localStorage.setItem("idk_modpacks", JSON.stringify(state.modpacks));
          console.log(
            `[Modpacks] Synced ${diskProfiles.length} profiles from disk`,
          );
          mpRenderList();
          mpRenderDetail();
        } catch (innerErr) {
          window.electronAPI?.rendererLog?.(
            "[Modpacks] INNER ERROR: " +
              innerErr.message +
              " | stack: " +
              innerErr.stack?.split("\n").slice(0, 3).join(" | "),
          );
        }
      }
    } catch (e) {
      console.error("[Modpacks] Failed to scan profiles:", e);
      window.electronAPI?.rendererLog?.("[Modpacks] OUTER ERROR: " + e.message);
    }
  }

  // Load profiles from disk on startup
  setTimeout(() => {
    console.log("[Modpacks] Calling loadProfilesFromDisk after delay");
    loadProfilesFromDisk();
  }, 500);

  state.activeModpackId = null;
  state.browserMode = "mod"; // 'mod' | 'resourcepack' | 'shader' | 'modpack'
  state.currentProvider = "modrinth";
  state.browserFilters = {
    category: "all",
    sort: "relevance",
    loader: "all",
    version: "all",
  };

  function mpSave() {
    // Filter out temporary modpacks before saving to localStorage
    const modpacksToSave = state.modpacks.filter((mp) => !mp.isTemporary);
    localStorage.setItem("idk_modpacks", JSON.stringify(modpacksToSave));
    // Sync each permanent modpack's profile to disk so the file system matches localStorage
    saveModpacksToDisk();
  }

  async function saveModpacksToDisk() {
    if (!window.electronAPI?.updateModpackProfile) return;
    const permanent = state.modpacks.filter((mp) => !mp.isTemporary && mp.id);
    for (const mp of permanent) {
      try {
        await window.electronAPI.updateModpackProfile({
          modpackId: mp.id,
          name: mp.name,
          mcVersion: mp.mcVersion,
          loader: mp.loader,
          loaderVersion: mp.loaderVersion || '',
          javaArgs: mp.javaArgs || '',
          windowWidth: mp.windowWidth || 1024,
          windowHeight: mp.windowHeight || 768,
        });
      } catch (_) { /* non-fatal */ }
    }
  }

  function mpGet() {
    return state.modpacks.find((m) => m.id === state.activeModpackId) || null;
  }

  async function ensureVersionOptions(selectEl) {
    if (!selectEl) return [];
    const current = Array.from(selectEl.options).map((opt) => opt.value);
    if (current.length > 0) return current;

    const versions = (state.allVersions || []).filter((v) => v.type === "release");
    const sorted = [...versions]
      .sort((a, b) => {
        const aDl = state.downloadedVersions.includes(a.id) ? 0 : 1;
        const bDl = state.downloadedVersions.includes(b.id) ? 0 : 1;
        if (aDl !== bDl) return aDl - bDl;
        return state.allVersions.indexOf(a) - state.allVersions.indexOf(b);
      })
      .slice(0, 40);

    if (sorted.length > 0) {
      selectEl.innerHTML = "";
      sorted.forEach((v) => {
        const o = document.createElement("option");
        o.value = v.id;
        o.textContent = state.downloadedVersions.includes(v.id) ? `✓ ${v.id}` : v.id;
        selectEl.appendChild(o);
      });
      return Array.from(selectEl.options).map((opt) => opt.value);
    }

    if (window.electronAPI?.scanDownloadedVersions) {
      try {
        const result = await window.electronAPI.scanDownloadedVersions();
        const installed = (result?.versions || []).filter((v) => v && v.id);
        if (installed.length > 0) {
          selectEl.innerHTML = "";
          installed.forEach((v) => {
            const o = document.createElement("option");
            o.value = v.id;
            o.textContent = v.id;
            selectEl.appendChild(o);
          });
        }
      } catch (e) {
        console.warn("[Modpacks] Failed to refresh version options:", e);
      }
    }

    return Array.from(selectEl.options).map((opt) => opt.value);
  }

  function mpRenderList() {
    const list = document.getElementById("modpacks-list");
    if (!list) return; // Guard for startup
    list.innerHTML = "";

    // Get permanent modpacks
    const permanentModpacks = state.modpacks.filter((mp) => !mp.isTemporary);

    // Get downloaded versions
    const downloadedVersions =
      state.allVersions?.filter((v) =>
        state.downloadedVersions.includes(v.id),
      ) || [];

    // Combine both lists
    const hasModpacks = permanentModpacks.length > 0;
    const hasVersions = downloadedVersions.length > 0;

    if (!hasModpacks && !hasVersions) {
      list.innerHTML = `<div class="mp-empty">No modpacks or versions yet.<br>Click <strong>+ New Modpack</strong> to create one.</div>`;
      return;
    }

    // Render versions section
    if (hasVersions) {
      const versionsHeader = document.createElement("div");
      versionsHeader.className = "mp-list-section-header";
      versionsHeader.innerHTML =
        '<span style="font-size:10px;color:var(--text-muted);font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">Versions</span>';
      list.appendChild(versionsHeader);

      downloadedVersions.forEach((v) => {
        // Get version settings to show correct loader
        const displayLoader = getLoaderForVersion(v.id);

        const el = document.createElement("div");
        el.className =
          "modpack-item version-item" +
          (state.activeVersionForMods === v.id ? " active" : "");
        el.innerHTML = `
        <div class="mp-item-icon" style="width:32px;height:32px;border-radius:6px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:rgba(var(--theme-accent-rgb),0.15);flex-shrink:0;border:2px solid rgba(var(--theme-accent-rgb),0.3);">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color:var(--theme-accent);"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 0 0z"></path></svg>
        </div>
        <div class="mp-item-info"><strong>${v.id}</strong><span>${displayLoader}</span></div>`;
        el.addEventListener("click", () => {
          state.activeVersionForMods = v.id;
          state.activeModpackId = null;
          state.selectedVersion = v.id;
          state.selectedLoader = displayLoader;
          mpRenderList();
          mpRenderDetail();
        });
        list.appendChild(el);
      });
    }

    // Render modpacks section
    if (hasModpacks) {
      if (hasVersions) {
        const modpacksHeader = document.createElement("div");
        modpacksHeader.className = "mp-list-section-header";
        modpacksHeader.innerHTML =
          '<span style="font-size:10px;color:var(--text-muted);font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">Modpacks</span>';
        list.appendChild(modpacksHeader);
      }

      permanentModpacks.forEach((mp) => {
        const el = document.createElement("div");
        el.className =
          "modpack-item" + (mp.id === state.activeModpackId ? " active" : "");
        const modCount = mp.mods?.length || 0;
        const rpCount = mp.resourcepacks?.length || 0;
        const shCount = mp.shaders?.length || 0;
        const total = modCount + rpCount + shCount;
        const renderablePackIconUrl = getRenderableIconUrl(mp.iconUrl);
        const iconHtml = renderablePackIconUrl
          ? `<img src="${renderablePackIconUrl}" style="width:100%;height:100%;object-fit:cover;" onerror="this.outerHTML='<svg width=\`20\` height=\`20\` viewBox=\`0 0 24 24\` fill=\`none\` stroke=\`currentColor\` stroke-width=\`2\`><path d=\`M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z\`></path></svg>'" />`
          : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>`;
        el.style.position = "relative";
        el.innerHTML = `
        <div class="mp-item-icon" style="width:32px;height:32px;border-radius:6px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:rgba(255,255,255,0.05);flex-shrink:0;border:1px solid rgba(255,255,255,0.08);">${iconHtml}</div>
        <div class="mp-item-info"><strong>${esc(mp.name)}</strong><span>${esc(mp.mcVersion)} \u00B7 ${esc(mp.loader)}</span></div>
        <span class="mp-item-count">${total}</span>
        <button class="mp-fav-btn${mp.favorite ? ' is-fav' : ''}" title="${mp.favorite ? 'Unfavorite' : 'Favorite'}"><svg width="16" height="16" viewBox="0 0 24 24" fill="${mp.favorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg></button>`;
        const favBtn = el.querySelector('.mp-fav-btn');
        favBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = state.modpacks.findIndex(m => m.id === mp.id);
          if (idx === -1) return;
          state.modpacks[idx].favorite = !state.modpacks[idx].favorite;
          mpSave();
          mpRenderList();
          if (state.activeModpackId === mp.id) mpRenderDetail();
          if (actions.renderVersions) actions.renderVersions();
        });
        el.addEventListener("click", async () => {
          state.activeModpackId = mp.id;
          state.activeVersionForMods = null;
          mpRenderList();
          mpRenderDetail();
          await loadProfilesFromDisk();
          // Sync selectedVersion/selectedLoader AFTER disk sync so profile.json values win
          const freshMp = state.modpacks.find(m => m.id === mp.id);
          state.selectedVersion = freshMp?.mcVersion || mp.mcVersion;
          state.selectedLoader = freshMp?.loader || mp.loader;
        });
        list.appendChild(el);
      });
    }
  }

  // Extract icon from mod JAR - uses disk cache (like ModMenu)
  async function extractAndCacheModIcon(modpackId, typeDir, filename) {
    try {
      const result = await window.electronAPI?.extractModIcon?.({
        modId: filename,
        modpackId,
        typeDir,
        filename,
      });
      if (result?.success && result.iconUrl) {
        console.log(`[IconExtractor] Got icon for ${filename}`);
        return getRenderableIconUrl(result.iconUrl);
      } else {
        console.warn(
          `[IconExtractor] Failed to extract icon for ${filename}:`,
          result?.reason,
        );
      }
    } catch (e) {
      console.error(
        "[IconExtractor] Failed to extract icon for",
        filename,
        ":",
        e,
      );
    }
    return null;
  }

  // Extract version from mod filename (fallback if metadata not available)
  function extractVersionFromFilename(filename) {
    // Common patterns: modname-1.20.4-1.0.0.jar, modname-1.0.0+1.20.4.jar, etc.
    const patterns = [
      /([0-9]+\.[0-9]+\.[0-9]+(?:\.[0-9]+)?)\+/, // 1.0.0+ pattern
      /\-([0-9]+\.[0-9]+\.[0-9]+(?:\.[0-9]+)?)(?:\-|\.jar)/, // -1.0.0- or -1.0.0.jar
      /\-([0-9]+\.[0-9]+(?:\.[0-9]+)?)(?:\-|\.jar)/, // -1.0 or -1.0.0
    ];

    for (const pattern of patterns) {
      const match = filename.match(pattern);
      if (match) return match[1];
    }

    return null;
  }

  function getLaunchOverlayElements() {
    return {
      overlay: document.getElementById("launch-overlay"),
      launchStatus: document.getElementById("launch-status"),
      launchFill: document.getElementById("launch-fill"),
    };
  }

  function showImportOverlay(status, percent = 5) {
    const { overlay, launchStatus, launchFill } = getLaunchOverlayElements();
    if (overlay) overlay.classList.add("active");
    if (launchStatus) launchStatus.innerText = status;
    if (launchFill) launchFill.style.width = `${percent}%`;
  }

  function hideImportOverlay() {
    const { overlay } = getLaunchOverlayElements();
    if (overlay) overlay.classList.remove("active");
  }

  function setImportProgress(status, percent) {
    const { launchStatus, launchFill } = getLaunchOverlayElements();
    if (launchStatus) launchStatus.innerText = status;
    if (launchFill && Number.isFinite(percent))
      launchFill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  }

  function getRenderableIconUrl(iconUrl) {
    if (!iconUrl || iconUrl.startsWith("file://")) return "";
    return iconUrl;
  }

  // Validate that a version string looks like a real Minecraft version (not a modpack version)
  function isValidMcVersion(version) {
    if (!version || typeof version !== 'string') return false;
    const releasePattern = /^\d+\.\d+(\.\d+)?$/;
    const snapshotPattern = /^\d{2}w\d{2}[a-z]$/i;
    return releasePattern.test(version) || snapshotPattern.test(version);
  }

  // Build candidate versions for the browser: exact version + major.minor only.
  // For 1.20.1 returns: ["1.20.1", "1.20"] — matching the Modrinth discover page.
  function buildSimpleVersionCandidates(mcVersion) {
    if (!mcVersion || typeof mcVersion !== 'string') return [];
    const candidates = new Set([mcVersion]);
    const parts = mcVersion.split('.');
    if (parts.length >= 2) {
      candidates.add(`${parts[0]}.${parts[1]}`);
    }
    return [...candidates];
  }

  // Build candidate versions for install: exact → major.minor → ±2 of major.
  // For 1.20.1 returns: ["1.20.1", "1.20", "1.19", "1.21", "1.18", "1.22"]
  // The ±2 range is used as a download fallback when no exact version exists.
  function buildMcVersionCandidates(mcVersion) {
    if (!mcVersion || typeof mcVersion !== 'string') return [];
    const candidates = new Set([mcVersion]);
    const parts = mcVersion.split('.');
    if (parts.length >= 2) {
      const major = parseInt(parts[0], 10);
      const minor = parseInt(parts[1], 10);
      if (!isNaN(major) && !isNaN(minor)) {
        candidates.add(`${major}.${minor}`);
        for (let i = 1; i <= 2; i++) {
          const minusMajor = major - i;
          const plusMajor = major + i;
          if (minusMajor >= 0) candidates.add(`${minusMajor}.${minor}`);
          if (plusMajor >= 1) candidates.add(`${plusMajor}.${minor}`);
        }
      }
    }
    return [...candidates];
  }

  // Score how close a single game-version tag is to the target. Lower = closer.
  function scoreGameVersionTag(gv, target) {
    if (gv === target) return 0;
    const tParts = target.split('.');
    const gParts = gv.split('.');
    if (tParts.length < 2 || gParts.length < 2) return 100;
    const tMaj = parseInt(tParts[0], 10);
    const tMin = parseInt(tParts[1], 10);
    const gMaj = parseInt(gParts[0], 10);
    const gMin = parseInt(gParts[1], 10);
    if (isNaN(tMaj) || isNaN(tMin) || isNaN(gMaj) || isNaN(gMin)) return 100;
    if (gMaj === tMaj && gMin === tMin) return 1; // same major.minor
    const majorDist = Math.abs(gMaj - tMaj);
    if (majorDist <= 2) return 1 + majorDist;       // ±2 of major
    return 4;                                        // way out of range
  }

  // Pick the closest version from a list. Each item must expose a game-version list
  // (default key: 'game_versions' for Modrinth, pass 'gameVersions' for CurseForge).
  // Falls back to the first item if nothing matches any candidate.
  function pickClosestGameVersion(items, target, gameVersionsKey = 'game_versions') {
    if (!items || items.length === 0) return null;
    const candidates = buildMcVersionCandidates(target);
    const candidateSet = new Set(candidates);
    const scored = items.map((item) => {
      const gvList = item[gameVersionsKey] || [];
      let best = 100;
      for (const gv of gvList) {
        if (candidateSet.has(gv)) {
          // Tag is in our candidate set — score it for proximity
          best = Math.min(best, scoreGameVersionTag(gv, target));
        }
      }
      // If no tag was in the candidate set, this item is a fallback (latest)
      if (best === 100) best = 50;
      return { item, score: best };
    });
    scored.sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      const aDate = new Date(a.item.date_published || a.item.fileDate || 0).getTime();
      const bDate = new Date(b.item.date_published || b.item.fileDate || 0).getTime();
      return bDate - aDate; // newest first
    });
    return scored[0]?.item || items[0] || null;
  }

  // Batch extract icons for all items in a modpack (for legacy profiles)
  // OPTIMIZED: Only extract icons for items that don't already have them (from API)
  async function batchExtractIconsForModpack(modpackId) {
    try {
      console.log(
        `[IconBatch] Starting batch extraction for modpack ${modpackId}`,
      );
      const result = await window.electronAPI?.extractAllIcons?.({ modpackId });

      if (result?.success) {
        console.log(
          `[IconBatch] Extracted ${result.extracted} icons, ${result.failed} failed`,
        );

        // Update modpack data with extracted icons
        const mp = state.modpacks.find((m) => m.id === modpackId);
        if (!mp) return;

        // Process mods - only update if item doesn't already have an icon
        if (result.mods && result.mods.length > 0) {
          result.mods.forEach(({ filename, iconUrl }) => {
            const item = mp.mods?.find((m) => m.filename === filename);
            const safeIconUrl = getRenderableIconUrl(iconUrl);
            if (item && !item.iconUrl && safeIconUrl) {
              item.iconUrl = safeIconUrl;
              if (!item.version || item.version === "Unknown") {
                item.version =
                  extractVersionFromFilename(filename) || "Unknown";
              }
            }
          });
        }

        // Process resource packs - only update if item doesn't already have an icon
        if (result.resourcepacks && result.resourcepacks.length > 0) {
          result.resourcepacks.forEach(({ filename, iconUrl }) => {
            const item = mp.resourcepacks?.find((m) => m.filename === filename);
            const safeIconUrl = getRenderableIconUrl(iconUrl);
            if (item && !item.iconUrl && safeIconUrl) {
              item.iconUrl = safeIconUrl;
              if (!item.version || item.version === "Unknown") {
                item.version =
                  extractVersionFromFilename(filename) || "Unknown";
              }
            }
          });
        }

        // Process shaders - only update if item doesn't already have an icon
        if (result.shaders && result.shaders.length > 0) {
          result.shaders.forEach(({ filename, iconUrl }) => {
            const item = mp.shaders?.find((m) => m.filename === filename);
            const safeIconUrl = getRenderableIconUrl(iconUrl);
            if (item && !item.iconUrl && safeIconUrl) {
              item.iconUrl = safeIconUrl;
              if (!item.version || item.version === "Unknown") {
                item.version =
                  extractVersionFromFilename(filename) || "Unknown";
              }
            }
          });
        }

        mpSave();

        // Re-render to show new icons
        mpRenderInstalledList("mods");
        mpRenderInstalledList("resourcepacks");
        mpRenderInstalledList("shaders");
      }
    } catch (e) {
      console.error("[IconBatch] Batch extraction failed:", e);
    }
  }

  // Initial Render
  setTimeout(() => {
    mpRenderList();
    mpRenderDetail();
  }, 100);

  if (window.electronAPI?.onLaunchClosed) {
    window.electronAPI.onLaunchClosed(() => {
      const mp = mpGet();
      if (mp?.id) {
        updateAchievementsStat({ modpackId: mp.id });
      } else if (state.activeVersionForMods) {
        updateAchievementsStat({ versionId: state.activeVersionForMods });
      }
    });
  }

  function mpRenderInstalledList(type) {
    const mp = mpGet();
    const isViewingVersion =
      state.activeVersionForMods && !state.activeModpackId;

    if (!mp && !isViewingVersion) return;

    // For versions, get mods from versionSettings
    let items = [];
    if (isViewingVersion) {
      const versionSettings =
        state.versionSettings?.[state.activeVersionForMods];
      items = versionSettings?.[type] || [];
    } else {
      items = mp ? mp[type] || [] : [];
    }

    const gridId =
      type === "mods"
        ? "installed-mods-list"
        : type === "resourcepacks"
          ? "installed-rp-list"
          : "installed-shaders-list";
    const grid = document.getElementById(gridId);
    const emptyMsgs = {
      mods: "No mods installed. Click <strong>+ Add Mods</strong> to browse Modrinth.",
      resourcepacks:
        "No resource packs installed. Click <strong>+ Add Resource Packs</strong>.",
      shaders: "No shaders installed. Click <strong>+ Add Shaders</strong>.",
    };
    grid.innerHTML = "";

    if (items.length === 0) {
      grid.innerHTML = `<div class="mp-empty" style="padding:40px 0;">${emptyMsgs[type]}</div>`;
      return;
    }

    const typeDir =
      type === "mods"
        ? "mods"
        : type === "resourcepacks"
          ? "resourcepacks"
          : "shaderpacks";

    items.forEach((item, index) => {
      const el = document.createElement("div");
      el.className = "installed-mod-card";
      el.id = `item-${type}-${index}`;

      // Get version - use stored version or extract from filename
      const version =
        item.version || extractVersionFromFilename(item.filename) || "Unknown";

      // Create icon element - prioritize existing iconUrl (from Modrinth/CurseForge API)
      const renderableIconUrl = getRenderableIconUrl(item.iconUrl);
      const firstLetter = (item.name || "M").charAt(0).toUpperCase();
      const iconHtml = renderableIconUrl
        ? `<img src="${renderableIconUrl}" class="mod-icon" onerror="this.style.display='none'" />`
        : `<div class="mod-icon-placeholder" style="display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:11px;color:rgba(255,255,255,0.5);">${firstLetter}</div>`;

      el.innerHTML = `
      ${iconHtml}
      <div class="installed-mod-info"><strong>${item.name}</strong><span>${version}</span></div>
      <button class="remove-mod-btn" title="Remove">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>`;

      el.querySelector(".remove-mod-btn").addEventListener("click", () => {
        if (type === "mods") mpRemoveItem(item, "mods", "removeMod");
        else if (type === "resourcepacks")
          mpRemoveItem(item, "resourcepacks", "removeResourcepack");
        else mpRemoveItem(item, "shaders", "removeShader");
      });
      grid.appendChild(el);

      // Extract icon from JAR ONLY if not already present (no API icon available)
      // This is a fallback - icons should come from Modrinth/CurseForge API first
      if (!item.iconUrl) {
        // For modpacks, use mp.id; for versions, use version ID
        const modpackId = isViewingVersion
          ? `version-${state.activeVersionForMods}`
          : mp.id;
        extractAndCacheModIcon(modpackId, typeDir, item.filename).then(
          (iconUrl) => {
            if (iconUrl) {
              item.iconUrl = iconUrl;
              // Save updated item with icon
              if (isViewingVersion) {
                localStorage.setItem(
                  "idk_version_settings",
                  JSON.stringify(state.versionSettings),
                );
              } else {
                mpSave();
              }

              // Update the card's image
              const cardEl = document.getElementById(`item-${type}-${index}`);
              if (cardEl) {
                const imgEl = cardEl.querySelector("img");
                if (imgEl) {
                  imgEl.src = iconUrl;
                  imgEl.style.display = "block";
                } else {
                  const placeholder = cardEl.querySelector(
                    ".mod-icon-placeholder",
                  );
                  if (placeholder) {
                    const img = document.createElement("img");
                    img.src = iconUrl;
                    img.className = "mod-icon";
                    img.onerror = () => (img.style.display = "none");
                    placeholder.replaceWith(img);
                  }
                }
              }
            }
          },
        );
      }
    });
  }

  function formatAchievementCount(count) {
    const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
    return n === 1 ? "1 achievement" : `${n} achievements`;
  }

  async function updateAchievementsStat({ modpackId, versionId } = {}) {
    const el = document.getElementById("mp-stat-achievements");
    if (!el) return;

    if (!window.electronAPI?.scanProfileAchievements) {
      el.innerText = formatAchievementCount(0);
      return;
    }

    el.innerText = "…";

    try {
      const result = await window.electronAPI.scanProfileAchievements({
        modpackId,
        versionId,
      });
      const count = result?.success ? result.count : 0;
      el.innerText = formatAchievementCount(count);
    } catch (err) {
      console.warn("[Modpacks] Achievement scan failed:", err);
      el.innerText = formatAchievementCount(0);
    }
  }

  function mpRenderDetail() {
    const mp = mpGet();
    const noMpMsg = document.getElementById("no-modpack-msg");
    const mpContent = document.getElementById("modpack-content");

    // Check if we're viewing a version instead of a modpack
    const isViewingVersion =
      state.activeVersionForMods && !state.activeModpackId;

    if (noMpMsg)
      noMpMsg.style.setProperty(
        "display",
        mp || isViewingVersion ? "none" : "flex",
        "important",
      );
    if (mpContent)
      mpContent.style.setProperty(
        "display",
        mp || isViewingVersion ? "flex" : "none",
        "important",
      );

    if (!mp && !isViewingVersion) return;

    // Get version data if viewing a version
    let versionData = null;
    let versionSettings = null;
    if (isViewingVersion) {
      versionData = state.allVersions?.find(
        (v) => v.id === state.activeVersionForMods,
      );
      // Get or create version settings
      versionSettings = state.versionSettings?.[state.activeVersionForMods] || {
        loader: "Vanilla",
        loaderVersion: "",
        javaArgs: "",
        windowWidth: 1024,
        windowHeight: 768,
      };
    }

    const nameEl = document.getElementById("modpack-name-display");
    const metaEl = document.getElementById("modpack-meta-display");

    // Guard against missing DOM elements (e.g. advanced vs classic UI variations).
    // Without this guard, the entire modpacks view silently breaks if any of
    // these IDs is removed from the markup.
    const statVersion = document.getElementById("mp-stat-version");
    const statLoader = document.getElementById("mp-stat-loader");
    const statPlaytime = document.getElementById("mp-stat-playtime");
    const modCount = document.getElementById("mod-count");
    const rpCount = document.getElementById("rp-count");
    const shaderCount = document.getElementById("shader-count");

    if (isViewingVersion && versionData) {
      if (nameEl) nameEl.innerText = versionData.id;
      const displayLoader = getLoaderForVersion(versionData.id);
      if (metaEl) metaEl.innerText = `${versionData.id} \u00B7 ${displayLoader}`;
      if (nameEl) {
        nameEl.title = versionData.id;
        nameEl.style.cursor = "default";
        nameEl.ondblclick = null;
      }
    } else if (mp) {
      if (nameEl) nameEl.innerText = mp.name;
      if (metaEl) metaEl.innerText = `MC ${mp.mcVersion} \u00B7 ${mp.loader}`;
      if (nameEl) {
        nameEl.title = "Double-click to rename";
        nameEl.style.cursor = "pointer";
        nameEl.ondblclick = () => {
          const newName = prompt("Rename modpack:", mp.name);
          if (newName && newName.trim() && newName.trim() !== mp.name) {
            mp.name = newName.trim();
            mpSave();
            mpRenderList();
            mpRenderDetail();
          }
        };
      }
    }

    const iconDisplay = document.getElementById("modpack-icon-display");
    if (iconDisplay) {
      if (isViewingVersion) {
        iconDisplay.innerHTML = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.8;color:var(--theme-accent);"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>`;
      } else {
        const renderablePackIconUrl = getRenderableIconUrl(mp?.iconUrl);
        iconDisplay.innerHTML = renderablePackIconUrl
          ? `<img src="${esc(renderablePackIconUrl)}" style="width:100%;height:100%;object-fit:cover;" onerror="this.outerHTML='<svg width=\`24\` height=\`24\` viewBox=\`0 0 24 24\` fill=\`none\` stroke=\`currentColor\` stroke-width=\`2\` style=\`opacity:0.5;\`><path d=\`M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z\`></path></svg>'" />`
          : `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity:0.5;"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>`;
      }
    }

    // Update dynamic stats
    if (isViewingVersion) {
      if (statVersion) statVersion.innerText = versionData?.id || "1.20.4";
      if (statLoader) statLoader.innerText = getLoaderForVersion(state.activeVersionForMods);
      if (statPlaytime) statPlaytime.innerText = "0h played";
      updateAchievementsStat({ versionId: state.activeVersionForMods });
      if (modCount) modCount.innerText = "0";
      if (rpCount) rpCount.innerText = "0";
      if (shaderCount) shaderCount.innerText = "0";
    } else {
      if (statVersion) statVersion.innerText = mp?.mcVersion || "1.20.4";
      if (statLoader) statLoader.innerText = mp?.loader || "Vanilla";

      // Update playtime
      if (statPlaytime) {
        if (mp?.lastPlayed) {
          const lastPlayedDate = new Date(mp.lastPlayed);
          const now = new Date();
          const diffMs = now - lastPlayedDate;
          const diffMins = Math.floor(diffMs / 60000);
          const diffHours = Math.floor(diffMs / 3600000);
          const diffDays = Math.floor(diffMs / 86400000);

          if (diffMins < 1) statPlaytime.innerText = "Just now";
          else if (diffMins < 60) statPlaytime.innerText = `${diffMins}m ago`;
          else if (diffHours < 24) statPlaytime.innerText = `${diffHours}h ago`;
          else if (diffDays < 7) statPlaytime.innerText = `${diffDays}d ago`;
          else statPlaytime.innerText = lastPlayedDate.toLocaleDateString();
        } else {
          statPlaytime.innerText = "Never Played";
        }
      }

      if (modCount) modCount.innerText = mp?.mods?.length || 0;
      if (rpCount) rpCount.innerText = mp?.resourcepacks?.length || 0;
      if (shaderCount) shaderCount.innerText = mp?.shaders?.length || 0;

      if (mp) updateAchievementsStat({ modpackId: mp.id });
    }

    // Load installed mods for versions
    if (isViewingVersion) {
      loadVersionMods(state.activeVersionForMods);
    }

    mpRenderInstalledList("mods");
    mpRenderInstalledList("resourcepacks");
    mpRenderInstalledList("shaders");
  }

  // Load installed mods for a version from disk
  async function loadVersionMods(version) {
    try {
      const result = await window.electronAPI?.scanVersionMods?.(version);
      if (result && result.success) {
        if (!state.versionSettings[version]) {
          state.versionSettings[version] = {};
        }

        // Convert filenames to full mod objects with metadata
        const diskMods = result.mods || [];
        const existingMods = state.versionSettings[version].mods || [];

        // Merge disk mods with existing metadata
        const mergedMods = diskMods.map((diskMod) => {
          // Try to find existing metadata for this mod
          const existing = existingMods.find(
            (m) => m.filename === diskMod.filename,
          );
          if (existing) {
            return existing; // Keep existing metadata
          }
          // Create new mod entry from disk
          return {
            filename: diskMod.filename,
            name: diskMod.filename.replace(/\.jar$/, ""),
            version: "Unknown",
            modrinthId: diskMod.filename,
            iconUrl: "",
          };
        });

        state.versionSettings[version].mods = mergedMods;
        localStorage.setItem(
          "idk_version_settings",
          JSON.stringify(state.versionSettings),
        );

        // Update counts
        document.getElementById("mod-count").innerText = mergedMods.length || 0;

        // Re-render the installed list
        mpRenderInstalledList("mods");
      }
    } catch (e) {
      console.error("[LoadVersionMods] Error:", e);
    }
  }

  // Tab switching
  document.querySelectorAll(".mp-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document
        .querySelectorAll(".mp-tab")
        .forEach((t) => t.classList.remove("active"));
      document
        .querySelectorAll(".mp-tab-content")
        .forEach((c) => c.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add("active");

      // Show/hide add buttons based on active tab
      document.getElementById("btn-browse-mods").style.display =
        tab.dataset.tab === "mods" ? "block" : "none";
      document.getElementById("btn-browse-rp").style.display =
        tab.dataset.tab === "resourcepacks" ? "block" : "none";
      document.getElementById("btn-browse-shaders").style.display =
        tab.dataset.tab === "shaders" ? "block" : "none";
    });
  });

  async function mpRemoveItem(item, type, apiMethod) {
    const mp = mpGet();
    const isViewingVersion =
      state.activeVersionForMods && !state.activeModpackId;

    let ipcResult = { success: true };
    let mutated = false;
    try {
      if (isViewingVersion) {
        if (!state.versionSettings[state.activeVersionForMods]) return;
        if (!state.versionSettings[state.activeVersionForMods][type]) return;

        // Call IPC first — only update state if disk delete succeeds
        if (window.electronAPI) {
          ipcResult = await window.electronAPI[apiMethod]({
            modpackId: `version-${state.activeVersionForMods}`,
            filename: item.filename,
          });
        }

        if (!ipcResult?.success) {
          actions.showWarningToast(`Failed to remove: ${ipcResult?.error || "unknown error"}`);
          return;
        }

        state.versionSettings[state.activeVersionForMods][type] =
          state.versionSettings[state.activeVersionForMods][type].filter(
            (i) => i.filename !== item.filename,
          );

        localStorage.setItem(
          "idk_version_settings",
          JSON.stringify(state.versionSettings),
        );
        mutated = true;
      } else if (mp) {
        // Call IPC first — only update state if disk delete succeeds
        if (window.electronAPI) {
          ipcResult = await window.electronAPI[apiMethod]({
            modpackId: mp.id,
            filename: item.filename,
          });
        }

        if (!ipcResult?.success) {
          actions.showWarningToast(`Failed to remove: ${ipcResult?.error || "unknown error"}`);
          return;
        }

        // Remove from modpack — filter by filename (unique), not modrinthId (can be empty)
        mp[type] = mp[type].filter((i) => i.filename !== item.filename);
        mpSave();
        mutated = true;
      }
    } catch (e) {
      console.error("[Modpacks] mpRemoveItem failed:", e);
    } finally {
      // Only re-render if we actually mutated state — avoids UI flicker when
      // the early `return` fired before any change.
      if (mutated) {
        mpRenderDetail();
        mpRenderList();
      }
    }
  }

  // --- Create Modpack ---
  function openCreateModpackModal(preSelectedVersion) {
    const sel = document.getElementById("new-mp-version");
    ensureVersionOptions(sel).then(() => {
      // Pre-select the given version, or the first downloaded version, or the first option
      if (preSelectedVersion && [...sel.options].some(o => o.value === preSelectedVersion)) {
        sel.value = preSelectedVersion;
      } else if (!preSelectedVersion) {
        const firstDl = [...sel.options].find(o =>
          state.downloadedVersions.includes(o.value)
        );
        if (firstDl) sel.value = firstDl.value;
      }
    });
    // Pre-select immediately if already present
    if (preSelectedVersion && [...sel.options].some(o => o.value === preSelectedVersion)) {
      sel.value = preSelectedVersion;
    }
    document.getElementById("new-mp-icon").value = "";
    document.getElementById("new-mp-icon-picker").innerHTML = `<div class="icon-picker-placeholder"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg></div>`;
    
    document.getElementById("mp-create-modal").classList.add("active");
    document.getElementById("new-mp-name").focus();
  }

  document.getElementById("btn-new-modpack").addEventListener("click", () => {
    openCreateModpackModal();
  });

  const setupIconPicker = (pickerId, inputId) => {
    const picker = document.getElementById(pickerId);
    if (!picker) return;
    const fileInput = picker.querySelector('.icon-picker-input');
    picker.addEventListener("click", async () => {
      if (window.electronAPI?.selectImage) {
        const result = await window.electronAPI.selectImage();
        if (result && result.success && result.url) {
          document.getElementById(inputId).value = result.url;
          picker.innerHTML = `<img src="${result.url}" />`;
        }
      } else if (fileInput) {
        fileInput.click();
      }
    });
    if (fileInput) {
      fileInput.addEventListener("change", () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
          const url = e.target.result;
          document.getElementById(inputId).value = url;
          picker.innerHTML = `<img src="${url}" />`;
        };
        reader.readAsDataURL(file);
      });
    }
  };

  setupIconPicker("new-mp-icon-picker", "new-mp-icon");
  setupIconPicker("mp-settings-icon-picker", "mp-settings-icon");
  document
    .getElementById("btn-cancel-create-mp")
    .addEventListener("click", () =>
      document.getElementById("mp-create-modal").classList.remove("active"),
    );
  document
    .getElementById("btn-confirm-create-mp")
    .addEventListener("click", async () => {
      const name = document.getElementById("new-mp-name").value.trim();
      const mcVersion = document.getElementById("new-mp-version").value;
      const loader = document.getElementById("new-mp-loader").value;
      if (!name || !mcVersion) return;
      const iconUrl = document.getElementById("new-mp-icon").value;
      const newMp = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2),
        name,
        mcVersion,
        loader,
        iconUrl,
        mods: [],
        resourcepacks: [],
        shaders: [],
      };
      state.modpacks.push(newMp);
      mpSave();

      document.getElementById("mp-create-modal").classList.remove("active");
      document.getElementById("new-mp-name").value = "";
      state.activeModpackId = newMp.id;
      mpRenderList();
      mpRenderDetail();
    });

  // --- Version Download Wizard ---
  let currentDlTab = 'release';
  let versionLoaderCache = {}; // versionId → loader name, populated from scan

  function getLoaderForVersion(versionId) {
    if (versionLoaderCache[versionId]) return versionLoaderCache[versionId];
    const vs = state.versionSettings[versionId];
    if (vs && vs.loader && vs.loader !== 'Vanilla') {
      versionLoaderCache[versionId] = vs.loader;
      return vs.loader;
    }
    return 'Vanilla';
  }

  // Populate loader cache from scan results
  async function refreshLoaderCache() {
    if (window.electronAPI?.scanDownloadedVersions) {
      try {
        const scan = await window.electronAPI.scanDownloadedVersions();
        if (scan.success && scan.versionDetails) {
          const installed = {};
          let settingsChanged = false;
          Object.keys(scan.versionDetails).forEach(v => {
            const loader = scan.versionDetails[v].loader || 'Vanilla';
            versionLoaderCache[v] = loader;
            installed[v] = loader;
            // Only set the loader if the user has never explicitly set one.
            // This preserves the user's explicit choice across restarts, including
            // "Vanilla" and any custom loader selection made in the settings modal.
            if (!state.versionSettings[v]) {
              state.versionSettings[v] = { loader };
              settingsChanged = true;
            } else if (state.versionSettings[v].loader === undefined) {
              state.versionSettings[v].loader = loader;
              settingsChanged = true;
            }
          });
          // Only write back to localStorage if we actually changed something,
          // to avoid clobbering user-saved settings on every startup.
          if (settingsChanged) {
            localStorage.setItem('idk_version_settings', JSON.stringify(state.versionSettings));
          }
          // Store truth source: actual installed loaders from disk
          window.__installedLoaders = installed;
        }
      } catch (e) { /* ignore */ }
    }
  }
  refreshLoaderCache();

  function renderVersionDownloadGrid() {
    const grid = document.getElementById('mp-version-download-grid');
    if (!grid) return;
    const releases = (state.allVersions || []).filter(v => v.type === 'release').slice(0, 8);
    grid.innerHTML = '';
    releases.forEach(v => {
      const isDownloaded = state.downloadedVersions.includes(v.id);
      const loader = isDownloaded ? getLoaderForVersion(v.id) : null;
      const item = document.createElement('div');
      item.className = 'mp-version-download-item' + (isDownloaded ? ' downloaded' : '');
      if (isDownloaded) {
        item.style.cursor = 'pointer';
        item.title = 'Click to create a modpack with this version';
      }
      item.innerHTML = `
        <span style="display:flex;align-items:center;gap:8px;">
          <span class="version-name">${v.id}</span>
          ${isDownloaded ? `<span class="mp-dl-loader-badge">${loader}</span>` : ''}
          <span class="version-type" style="font-size:9px;text-transform:uppercase;color:var(--text-muted);">Release</span>
        </span>
        <button class="mp-dl-btn${isDownloaded ? ' downloaded' : ''}" data-version="${v.id}">
          ${isDownloaded ? 'Use' : 'Download'}
        </button>
      `;
      const btn = item.querySelector('.mp-dl-btn');
      if (isDownloaded) {
        // Click the item or button → open create modal with this version pre-selected
        const handler = (e) => {
          e.stopPropagation();
          openCreateModpackModal(v.id);
        };
        btn.addEventListener('click', handler);
        item.addEventListener('click', handler);
      } else {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!window.electronAPI) return;
          btn.classList.add('downloading');
          btn.textContent = 'Downloading…';
          btn.disabled = true;
          try {
            const result = await window.electronAPI.downloadVersion({ version: v.id });
            if (result && result.success) {
              if (!state.downloadedVersions.includes(v.id)) {
                state.downloadedVersions.push(v.id);
                localStorage.setItem('idk_downloaded_versions', JSON.stringify(state.downloadedVersions));
              }
              await refreshLoaderCache();
              renderVersionDownloadGrid();
              renderAllVersionsModal(currentDlTab);
            } else {
              btn.classList.remove('downloading');
              btn.textContent = 'Failed';
              setTimeout(() => { btn.textContent = 'Download'; btn.disabled = false; }, 2000);
              if (result && result.error) actions.showWarningToast?.(result.error);
            }
          } catch (err) {
            console.error('[Modpacks] downloadVersion threw:', err);
            btn.classList.remove('downloading');
            btn.textContent = 'Failed';
            setTimeout(() => { btn.textContent = 'Download'; btn.disabled = false; }, 2000);
            actions.showWarningToast?.('Download failed: ' + (err.message || err));
          }
        });
      }
      grid.appendChild(item);
    });
  }

  function renderAllVersionsModal(tab) {
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
      const loader = isDownloaded ? getLoaderForVersion(v.id) : null;
      const label = v.type === 'release' ? 'Release' : v.type === 'snapshot' ? 'Snapshot' : 'Old';
      const item = document.createElement('div');
      item.className = 'mp-version-download-item' + (isDownloaded ? ' downloaded' : '');
      if (isDownloaded) {
        item.style.cursor = 'pointer';
        item.title = 'Click to create a modpack with this version';
      }
      item.innerHTML = `
        <span style="display:flex;align-items:center;gap:8px;">
          <span class="version-name">${v.id}</span>
          ${isDownloaded ? `<span class="mp-dl-loader-badge">${loader}</span>` : ''}
          <span class="version-type">${label}</span>
        </span>
        <button class="mp-dl-btn${isDownloaded ? ' downloaded' : ''}" data-version="${v.id}">
          ${isDownloaded ? 'Use' : 'Download'}
        </button>
      `;
      const btn = item.querySelector('.mp-dl-btn');
      if (isDownloaded) {
        const handler = (e) => {
          e.stopPropagation();
          openCreateModpackModal(v.id);
        };
        btn.addEventListener('click', handler);
        item.addEventListener('click', handler);
      } else {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!window.electronAPI) return;
          btn.classList.add('downloading');
          btn.textContent = 'Downloading…';
          btn.disabled = true;
          try {
            const result = await window.electronAPI.downloadVersion({ version: v.id });
            if (result && result.success) {
              if (!state.downloadedVersions.includes(v.id)) {
                state.downloadedVersions.push(v.id);
                localStorage.setItem('idk_downloaded_versions', JSON.stringify(state.downloadedVersions));
              }
              await refreshLoaderCache();
              renderVersionDownloadGrid();
              renderAllVersionsModal(currentDlTab);
            } else {
              btn.classList.remove('downloading');
              btn.textContent = 'Failed';
              setTimeout(() => { btn.textContent = 'Download'; btn.disabled = false; }, 2000);
              if (result && result.error) actions.showWarningToast?.(result.error);
            }
          } catch (err) {
            console.error('[Modpacks] downloadVersion threw:', err);
            btn.classList.remove('downloading');
            btn.textContent = 'Failed';
            setTimeout(() => { btn.textContent = 'Download'; btn.disabled = false; }, 2000);
            actions.showWarningToast?.('Download failed: ' + (err.message || err));
          }
        });
      }
      list.appendChild(item);
    });
  }

  // Expose for external use (e.g. play dropdown "All versions")
  window.showVersionPickerModal = () => {
    currentDlTab = 'release';
    document.querySelectorAll('#mp-all-versions-modal [data-dl-tab]').forEach(b => b.classList.remove('active'));
    const tabBtn = document.getElementById('mp-dl-tab-release');
    if (tabBtn) tabBtn.classList.add('active');
    renderAllVersionsModal('release');
    document.getElementById('mp-all-versions-modal')?.classList.add('active');
  };

  // Populate version grid when no-modpack is visible
  const noModpackMsg = document.getElementById('no-modpack-msg');
  if (noModpackMsg) {
    const observer = new MutationObserver(() => {
      if (noModpackMsg.style.display !== 'none') {
        renderVersionDownloadGrid();
      }
    });
    observer.observe(noModpackMsg, { attributes: true, attributeFilter: ['style'] });
    // Initial render if already visible
    if (noModpackMsg.style.display !== 'none') {
      renderVersionDownloadGrid();
    }
  }
  // Re-render grid when async version fetch completes
  window.addEventListener('versions-loaded', () => {
    renderVersionDownloadGrid();
  });

  // "Show all versions" button
  const showAllBtn = document.getElementById('btn-show-all-versions');
  if (showAllBtn) {
    showAllBtn.addEventListener('click', () => {
      currentDlTab = 'release';
      renderAllVersionsModal('release');
      document.getElementById('mp-all-versions-modal')?.classList.add('active');
    });
  }

  // Tab switching in all-versions modal
  ['release', 'snapshot', 'old'].forEach(tab => {
    const btn = document.getElementById(`mp-dl-tab-${tab}`);
    if (btn) {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#mp-all-versions-modal [data-dl-tab]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentDlTab = tab;
        renderAllVersionsModal(tab);
      });
    }
  });

  // Close all versions modal
  const closeBtn = document.getElementById('btn-close-all-versions');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      document.getElementById('mp-all-versions-modal')?.classList.remove('active');
    });
  }
  // Close on backdrop click
  const allVersionsModal = document.getElementById('mp-all-versions-modal');
  if (allVersionsModal) {
    allVersionsModal.addEventListener('click', (e) => {
      if (e.target === allVersionsModal) allVersionsModal.classList.remove('active');
    });
  }

  // Wire up wizard buttons to existing handlers
  const wizardNew = document.getElementById('btn-new-modpack-wizard');
  if (wizardNew) wizardNew.addEventListener('click', () => document.getElementById('btn-new-modpack')?.click());
  const wizardImport = document.getElementById('btn-import-modpack-wizard');
  if (wizardImport) wizardImport.addEventListener('click', () => document.getElementById('btn-import-modpack')?.click());
  const wizardBrowse = document.getElementById('btn-browse-modpacks-wizard');
  if (wizardBrowse) wizardBrowse.addEventListener('click', () => document.getElementById('btn-browse-modpacks')?.click());

  // --- Modpack Settings ---
  document
    .getElementById("btn-modpack-settings")
    .addEventListener("click", async () => {
      const mp = mpGet();
      const isViewingVersion =
        state.activeVersionForMods && !state.activeModpackId;

      if (!mp && !isViewingVersion) return;

      if (isViewingVersion) {
        // Show version settings
        const versionSettings = state.versionSettings[
          state.activeVersionForMods
        ] || {
          loader: "Vanilla",
          loaderVersion: "",
          javaArgs: "",
          windowWidth: 1024,
          windowHeight: 768,
        };

        document.getElementById("mp-settings-name").value =
          state.activeVersionForMods;
        document.getElementById("mp-settings-name").disabled = true;
        document.getElementById("mp-settings-description").value = "";
        document.getElementById("mp-settings-description").disabled = true;
        document.getElementById("mp-settings-version").value =
          state.activeVersionForMods;
        document.getElementById("mp-settings-version").disabled = true;
        document.getElementById("mp-settings-loader").value =
          getLoaderForVersion(state.activeVersionForMods);
        document.getElementById("mp-settings-loader").disabled = false;
        document.getElementById("mp-settings-loader-version").value =
          versionSettings.loaderVersion || "";
        document.getElementById("mp-settings-loader-version").disabled = false;
        document.getElementById("mp-settings-java-args").value =
          versionSettings.javaArgs || "";
        document.getElementById("mp-settings-java-args").disabled = false;
        document.getElementById("mp-settings-width").value =
          versionSettings.windowWidth || 1024;
        document.getElementById("mp-settings-width").disabled = false;
        document.getElementById("mp-settings-height").value =
          versionSettings.windowHeight || 768;
        document.getElementById("mp-settings-height").disabled = false;
      } else {
        // Show modpack settings
        document.getElementById("mp-settings-name").disabled = false;
        document.getElementById("mp-settings-description").disabled = false;
        document.getElementById("mp-settings-version").disabled = false;
        document.getElementById("mp-settings-loader").disabled = false;
        document.getElementById("mp-settings-loader-version").disabled = false;
        document.getElementById("mp-settings-java-args").disabled = false;
        document.getElementById("mp-settings-width").disabled = false;
        document.getElementById("mp-settings-height").disabled = false;

        document.getElementById("mp-settings-name").value = mp.name;
        document.getElementById("mp-settings-icon").value = mp.iconUrl || "";
        if (mp.iconUrl) {
          document.getElementById("mp-settings-icon-picker").innerHTML = `<img src="${mp.iconUrl}" />`;
        } else {
          document.getElementById("mp-settings-icon-picker").innerHTML = `<div class="icon-picker-placeholder"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg></div>`;
        }
        document.getElementById("mp-settings-description").value =
          mp.description || "";
        const versionSelect = document.getElementById("mp-settings-version");
        await ensureVersionOptions(versionSelect);
        if (mp.mcVersion && [...versionSelect.options].some((o) => o.value === mp.mcVersion)) {
          versionSelect.value = mp.mcVersion;
        } else if (state.downloadedVersions.includes(mp.mcVersion)) {
          versionSelect.value = mp.mcVersion;
        } else if (versionSelect.options.length > 0) {
          versionSelect.value = versionSelect.options[0].value;
        }
        document.getElementById("mp-settings-loader").value =
          mp.loader || "Vanilla";
        document.getElementById("mp-settings-loader-version").value =
          mp.loaderVersion || "";
        document.getElementById("mp-settings-java-args").value =
          mp.javaArgs || "";
        document.getElementById("mp-settings-width").value =
          mp.windowWidth || "1024";
        document.getElementById("mp-settings-height").value =
          mp.windowHeight || "768";
      }

      // Show modal
      document.getElementById("mp-settings-modal").classList.add("active");
    });

  document
    .getElementById("btn-close-mp-settings")
    .addEventListener("click", () => {
      document.getElementById("mp-settings-modal").classList.remove("active");
    });

  document
    .getElementById("btn-cancel-mp-settings")
    .addEventListener("click", () => {
      document.getElementById("mp-settings-modal").classList.remove("active");
    });

  document
    .getElementById("btn-save-mp-settings")
    .addEventListener("click", () => {
      const mp = mpGet();
      const isViewingVersion =
        state.activeVersionForMods && !state.activeModpackId;

      if (isViewingVersion) {
        // Save version settings
        if (!state.versionSettings[state.activeVersionForMods]) {
          state.versionSettings[state.activeVersionForMods] = {};
        }

        state.versionSettings[state.activeVersionForMods].loader =
          document.getElementById("mp-settings-loader").value;
        state.versionSettings[state.activeVersionForMods].loaderVersion =
          document.getElementById("mp-settings-loader-version").value;
        state.versionSettings[state.activeVersionForMods].javaArgs = document
          .getElementById("mp-settings-java-args")
          .value.trim();
        state.versionSettings[state.activeVersionForMods].windowWidth =
          parseInt(document.getElementById("mp-settings-width").value) || 1024;
        state.versionSettings[state.activeVersionForMods].windowHeight =
          parseInt(document.getElementById("mp-settings-height").value) || 768;

        localStorage.setItem(
          "idk_version_settings",
          JSON.stringify(state.versionSettings),
        );
        // Sync version profile to disk so scanDownloadedVersions reflects the change
        if (window.electronAPI?.updateModpackProfile) {
          const versionId = `version-${state.activeVersionForMods}`;
          const vs = state.versionSettings[state.activeVersionForMods];
          window.electronAPI.updateModpackProfile({
            modpackId: versionId,
            name: state.activeVersionForMods,
            mcVersion: state.activeVersionForMods,
            loader: vs.loader || 'Vanilla',
            loaderVersion: vs.loaderVersion || '',
            javaArgs: vs.javaArgs || '',
            windowWidth: vs.windowWidth || 1024,
            windowHeight: vs.windowHeight || 768,
          }).catch(() => {});
        }
        mpRenderList();
        mpRenderDetail();
      } else if (mp) {
        // Save modpack settings
        mp.name =
          document.getElementById("mp-settings-name").value.trim() || mp.name;
        mp.iconUrl = document.getElementById("mp-settings-icon").value || mp.iconUrl;
        mp.description = document
          .getElementById("mp-settings-description")
          .value.trim();
        const selectedMcVersion = document.getElementById("mp-settings-version").value;
        if (selectedMcVersion) mp.mcVersion = selectedMcVersion;
        mp.loader = document.getElementById("mp-settings-loader").value;
        mp.loaderVersion = document.getElementById(
          "mp-settings-loader-version",
        ).value;
        mp.javaArgs = document
          .getElementById("mp-settings-java-args")
          .value.trim();
        mp.windowWidth =
          parseInt(document.getElementById("mp-settings-width").value) || 1024;
        mp.windowHeight =
          parseInt(document.getElementById("mp-settings-height").value) || 768;

        mpSave();
        mpRenderList();
        mpRenderDetail();
      }

      document.getElementById("mp-settings-modal").classList.remove("active");
    });

  // --- Delete Modpack ---
  document
    .getElementById("btn-delete-modpack")
    .addEventListener("click", async () => {
      const mp = mpGet();
      const isViewingVersion =
        state.activeVersionForMods && !state.activeModpackId;

      if (isViewingVersion) {
        actions.showWarningToast("Cannot delete versions.");
        return;
      }

      if (!mp) return;

      // For temporary modpacks (version mods), just remove from state without confirmation
      if (mp.isTemporary) {
        state.modpacks = state.modpacks.filter(
          (m) => m.id !== state.activeModpackId,
        );
        state.activeModpackId = null;
        mpSave();
        mpRenderList();
        mpRenderDetail();
        return;
      }

      // Show delete confirmation modal for permanent modpacks
      const modal = document.getElementById("delete-modpack-modal");
      const checkbox = document.getElementById("delete-files-checkbox");
      const confirmBtn = document.getElementById("delete-modal-confirm");
      const cancelBtn = document.getElementById("delete-modal-cancel");
      const messageEl = document.getElementById("delete-modal-message");

      // Reset checkbox state
      checkbox.checked = false;

      // Update message
      messageEl.textContent = `Are you sure you want to delete "${mp.name}"? This action cannot be undone.`;

      // Show modal
      modal.classList.add("active");

      // Handle confirm
      const handleConfirm = async () => {
        // Only allow deletion if checkbox is checked
        if (!checkbox.checked) {
          actions.showWarningToast("Please check the box to confirm deletion.");
          return;
        }

        // Close modal immediately
        closeModal();

        // Set deletion flag to prevent scanner from running
        isDeleting = true;

        // Remove from state.modpacks list
        state.modpacks = state.modpacks.filter(
          (m) => m.id !== state.activeModpackId,
        );
        state.activeModpackId = null;
        mpSave();
        mpRenderList();
        mpRenderDetail();

        // Delete entire modpack folder from disk using IPC (main process has proper permissions)
        if (window.electronAPI?.deleteModpackFolder) {
          try {
            const result = await window.electronAPI.deleteModpackFolder(mp.id);
            if (!result.success) {
              console.warn(
                "[Modpacks] Failed to delete modpack folder:",
                result.error,
              );
              actions.showWarningToast(
                "Warning: Could not delete all files from disk.",
              );
            } else {
              console.log(
                `[Modpacks] Deleted modpack folder: modpack-${mp.id}`,
              );
            }
          } catch (e) {
            console.warn("[Modpacks] IPC error deleting modpack folder:", e);
            actions.showWarningToast(
              "Warning: Could not delete all files from disk.",
            );
          }
        }

        // Re-enable scanning after deletion
        isDeleting = false;

        // Rescan after a delay to ensure files are fully released
        setTimeout(() => {
          loadProfilesFromDisk();
        }, 1000);

        actions.showWarningToast(`Modpack "${mp.name}" deleted successfully.`);
      };

      const closeModal = () => {
        modal.classList.remove("active");
        confirmBtn.removeEventListener("click", handleConfirm);
        cancelBtn.removeEventListener("click", closeModal);
      };

      confirmBtn.addEventListener("click", handleConfirm);
      cancelBtn.addEventListener("click", closeModal);
    });

  // Close modal when clicking outside
  document
    .getElementById("delete-modpack-modal")
    .addEventListener("click", (e) => {
      if (e.target.id === "delete-modpack-modal") {
        document
          .getElementById("delete-modpack-modal")
          .classList.remove("active");
      }
    });

  // --- Import Modpack (.zip) ---
  document
    .getElementById("btn-import-modpack")
    .addEventListener("click", async () => {
      if (!window.electronAPI) {
        actions.showWarningToast("Only available in the desktop app.");
        return;
      }
      const zipPath = await window.electronAPI.selectModpackZip();
      if (!zipPath) return;

      const overlay = document.getElementById("launch-overlay");
      const launchStatus = document.getElementById("launch-status");
      const launchFill = document.getElementById("launch-fill");

      try {
        overlay.classList.add("active");
        launchStatus.innerText = "Extracting local modpack archive...";
        launchFill.style.width = "5%";

        const importRes = await window.electronAPI.unzipCurseforge({
          filePath: zipPath,
        });
        if (!importRes.success)
          throw new Error(importRes.error || "Import failed");

        const manifest = importRes.manifest;
        const rawLoaderId = manifest.minecraft?.modLoaders?.[0]?.id || "";
        const loaderStr = rawLoaderId.toLowerCase();
        const loader = loaderStr.includes("fabric")
          ? "Fabric"
          : loaderStr.includes("forge")
            ? "Forge"
            : loaderStr.includes("neoforge")
              ? "NeoForge"
              : "Vanilla";
        const loaderVerMatch = rawLoaderId.match(/^[a-z]+-(.+)$/i);
        const loaderVersion = loaderVerMatch ? loaderVerMatch[1] : "";
        const manifestMc = manifest.minecraft?.version || "";
        const mcVersion = isValidMcVersion(manifestMc) ? manifestMc : "Unknown";

        // Parse modpack name from zip filename
        const zipName = zipPath
          .split(/[\\/]/)
          .pop()
          .replace(/\.zip$/i, "");
        const mpName = manifest.name || zipName || "Imported Modpack";

        const newMp = {
          id: importRes.modpackId,
          name: mpName,
          iconUrl: "",
          mcVersion,
          loader,
          loaderVersion,
          mods: [],
          resourcepacks: [],
          shaders: [],
        };

        // First save the modpack base structure to localStorage so it registers
        const mpData = safeParse(localStorage.getItem("idk_modpacks"), []);
        mpData.push(newMp);
        localStorage.setItem("idk_modpacks", JSON.stringify(mpData));
        state.modpacks.push(newMp);
        state.activeModpackId = newMp.id;
        mpRenderList();
        mpRenderDetail();

        const manifestFiles = manifest.files || [];
        let completedCount = 0;
        const concurrencyLimit = 4; // Download mods in parallel (reduced from 12 to prevent memory issues)

        const downloadTask = async (f) => {
          try {
            const [fRes, projRes] = await Promise.all([
              fetch(
                `https://api.curse.tools/v1/cf/mods/${f.projectID}/files/${f.fileID}`,
              ),
              fetch(`https://api.curse.tools/v1/cf/mods/${f.projectID}`),
            ]);

            if (!fRes.ok) {
              console.warn(
                `[CurseForge] Failed to fetch file ${f.fileID}: ${fRes.status}`,
              );
              return;
            }

            const fData = await safeJson(fRes);
            if (!fData.data) return;
            const mf = fData.data;

            // Check if file loader matches modpack loader
            const fileName = mf.fileName.toLowerCase();
            const expectedLoader = newMp.loader.toLowerCase();
            const hasExpectedLoader = fileName.includes(expectedLoader);

            if (
              !hasExpectedLoader &&
              (fileName.includes("fabric") ||
                fileName.includes("forge") ||
                fileName.includes("neoforge") ||
                fileName.includes("quilt"))
            ) {
              console.warn(
                `[CurseForge] WARNING: File ${mf.fileName} is for a different loader than ${newMp.loader}. Expected ${expectedLoader} but got ${fileName}`,
              );
            }

            let mUrl = mf.downloadUrl;
            if (!mUrl) {
              const mp1 = Math.floor(mf.id / 1000),
                mp2 = (mf.id % 1000).toString().padStart(3, "0");
              mUrl = `https://edge.forgecdn.net/files/${mp1}/${mp2}/${encodeURIComponent(mf.fileName)}`;
            }
            let classId = 6;
            try {
              if (projRes.ok) {
                const pj = await safeJson(projRes);
                classId = pj.data?.classId ?? 6;
              }
            } catch (e) {
              console.warn("[CurseForge] Error parsing project data:", e);
            }

            if (classId === 12) {
              newMp.resourcepacks.push({
                modrinthId: f.projectID.toString(),
                name: mf.fileName.replace(/\.(zip|jar)$/, ""),
                version: mf.displayName,
                filename: mf.fileName,
                downloadUrl: mUrl,
                iconUrl: "",
              });
              await window.electronAPI.installResourcepack({
                modpackId: newMp.id,
                downloadUrl: mUrl,
                filename: mf.fileName,
              });
            } else if (classId === 6552) {
              newMp.shaders.push({
                modrinthId: f.projectID.toString(),
                name: mf.fileName.replace(/\.(zip|jar)$/, ""),
                version: mf.displayName,
                filename: mf.fileName,
                downloadUrl: mUrl,
                iconUrl: "",
              });
              await window.electronAPI.installShader({
                modpackId: newMp.id,
                downloadUrl: mUrl,
                filename: mf.fileName,
              });
            } else {
              newMp.mods.push({
                modrinthId: f.projectID.toString(),
                name: mf.fileName.replace(/\.jar$/, ""),
                version: mf.displayName,
                filename: mf.fileName,
                downloadUrl: mUrl,
                iconUrl: "",
              });
              await window.electronAPI.installMod({
                modpackId: newMp.id,
                downloadUrl: mUrl,
                filename: mf.fileName,
              });
            }
          } catch (me) {
            console.warn("Failed file", f.projectID, me);
          } finally {
            completedCount++;
            launchStatus.innerText = `Downloading file ${completedCount} / ${manifestFiles.length}...`;
            launchFill.style.width = `${5 + (completedCount / manifestFiles.length) * 90}%`;
          }
        };

        if (manifestFiles.length > 0) {
          const queue = [...manifestFiles];
        const workers = Array(concurrencyLimit)
          .fill(null)
          .map(async () => {
            while (queue.length > 0) {
              if (currentImportCancelled) {
                queue.length = 0;
                return;
              }
              const item = queue.shift();
              if (item) await downloadTask(item);
            }
          });
        await Promise.all(workers);
        }

        launchStatus.innerText = "Cataloging overrides...";
        (importRes.resourcepackFiles || []).forEach((rp) => {
          newMp.resourcepacks.push({
            modrinthId: "override-" + rp.filename,
            name: rp.name,
            version: "bundled",
            filename: rp.filename,
            iconUrl: "",
          });
        });
        (importRes.shaderpackFiles || []).forEach((sp) => {
          newMp.shaders.push({
            modrinthId: "override-" + sp.filename,
            name: sp.name,
            version: "bundled",
            filename: sp.filename,
            iconUrl: "",
          });
        });
        (importRes.extraModFiles || []).forEach((em) => {
          if (!newMp.mods.find((m) => m.filename === em.filename)) {
            newMp.mods.push({
              modrinthId: "override-" + em.filename,
              name: em.name,
              version: "bundled",
              filename: em.filename,
              downloadUrl: "",
              iconUrl: "",
            });
          }
        });

        const mpData2 = JSON.parse(
          localStorage.getItem("idk_modpacks") || "[]",
        );
        const idx = mpData2.findIndex((m) => m.id === newMp.id);
        if (idx >= 0) mpData2[idx] = newMp;
        else mpData2.push(newMp);
        localStorage.setItem("idk_modpacks", JSON.stringify(mpData2));
        mpRenderDetail();
        updateDlPanel("Import complete.", 100);
        hideDlPanel();
        actions.showWarningToast(`"${newMp.name}" imported successfully!`);
      } catch (e) {
        hideDlPanel();
        actions.showWarningToast("Import failed: " + e.message);
      }
    });

  // --- Export Modpack (.zip) ---
  document
    .getElementById("btn-export-modpack")
    .addEventListener("click", async () => {
      const mp = mpGet();
      const isViewingVersion =
        state.activeVersionForMods && !state.activeModpackId;

      if (isViewingVersion) {
        actions.showWarningToast(
          "Cannot export versions. Create a modpack instead.",
        );
        return;
      }

      if (!mp) return;

      // For temporary modpacks, don't allow export
      if (mp.isTemporary) {
        actions.showWarningToast(
          "Cannot export version mods. Create a modpack instead.",
        );
        return;
      }

      if (!window.electronAPI) {
        actions.showWarningToast("Only available in the desktop app.");
        return;
      }

      const defaultName = mp.name.replace(/[^a-zA-Z0-9_\-]/g, "_") + ".zip";
      const destPath = await window.electronAPI.selectExportZip({
        defaultName,
      });
      if (!destPath) return;

      const overlay = document.getElementById("launch-overlay");
      const launchStatus = document.getElementById("launch-status");
      const launchFill = document.getElementById("launch-fill");

      try {
        overlay.classList.add("active");
        launchStatus.innerText = "Packaging modpack archive...";
        launchFill.style.width = "30%";

        const exportRes = await window.electronAPI.exportModpack({
          modpackId: mp.id,
          name: mp.name,
          mcVersion: mp.mcVersion,
          loader: mp.loader,
          loaderVersion: mp.loaderVersion || "",
          destPath,
        });

        if (!exportRes.success)
          throw new Error(exportRes.error || "Export failed");

        launchFill.style.width = "100%";
        overlay.classList.remove("active");
        actions.showWarningToast(
          `Modpack exported to: ${destPath.split(/[\\/]/).pop()}`,
        );
      } catch (e) {
        overlay.classList.remove("active");
        actions.showWarningToast("Export failed: " + e.message);
      }
    });

  // --- Unified Browser ---
  // Official Modrinth taxonomy for each content type
  const MODRINTH_FILTERS = {
    mod: {
      Category: ["adventure", "cursed", "decoration", "economy", "equipment", "food", "game-mechanics", "library", "magic", "management", "minigame", "mobs", "optimization", "social", "storage", "technology", "transportation", "utility", "worldgen"],
      Loader: ["fabric", "forge", "neoforge", "babric", "bta-babric", "java-agent", "legacy-fabric", "liteloader", "modloader", "nilloader", "ornithe", "quilt", "rift"],
    },
    modpack: {
      Category: ["adventure", "challenging", "combat", "kitchen-sink", "lightweight", "magic", "multiplayer", "optimization", "quests", "technology"],
    },
    datapack: {
      Category: ["adventure", "challenging", "combat", "decoration", "economy", "food", "game-mechanics", "magic", "minigame", "mobs", "optimization", "performance", "technology", "transportation", "tweaks", "utility", "world-gen"],
      Loader: ["datapack"],
    },
    resourcepack: {
      Category: ["combat", "cursed", "decoration", "modded", "realistic", "simplistic", "themed", "tweaks", "utility", "vanilla-like", "audio", "blocks", "core-shaders", "entities", "environment", "equipment", "fonts", "gui", "items", "locale", "models"],
      Resolution: ["8x-", "16x", "32x", "48x", "64x", "128x", "256x", "512x+"],
    },
    shader: {
      Category: ["cartoon", "cursed", "fantasy", "realistic", "semi-realistic", "vanilla-like", "atmosphere", "bloom", "colored-lighting", "foliage", "path-tracing", "pbr", "reflections", "shadows", "potato", "low", "medium", "high", "screenshot"],
      Loader: ["iris", "optifine", "vanilla", "canvas"],
    },
  };

  function populateBrowserFilters(mode) {
    // Reset filter state
    state.browserFilters = { category: "all", sort: "relevance", loader: "all", version: "all", features: "all", resolution: "all", performance: "all" };

    const provider = state.currentProvider;

    // Determine which filter set to use
    const isModrinth = provider === "modrinth";
    const isCurseForgeModpack = provider === "curseforge" && mode === "modpack";

    // --- Category filter ---
    const categoryContainer = document.getElementById("filter-category");
    const categorySection = categoryContainer?.closest(".browser-filter-section");
    if (categoryContainer) {
      let cats = ["all"];
      if (isModrinth && MODRINTH_FILTERS[mode]?.Category) {
        cats = ["all", ...MODRINTH_FILTERS[mode].Category];
      } else if (isCurseForgeModpack) {
        cats = ["all", "adventure", "magic", "tech", "quest", "skyblock", "vanilla+", "hardcore", "combat", "exploration"];
      }
      categoryContainer.innerHTML = cats.map(c => {
        const label = c === "all" ? "All" : c;
        return `<button class="browser-filter-pill${c === "all" ? " active" : ""}" data-filter-category="${c}">${label}</button>`;
      }).join("");
    }

    // --- Loader filter ---
    const loaderContainer = document.getElementById("filter-loader");
    const loaderSection = loaderContainer?.closest(".browser-filter-section");
    if (loaderContainer) {
      let loaders = [];
      if (isModrinth && MODRINTH_FILTERS[mode]?.Loader && mode !== "resourcepack") {
        loaders = ["all", ...MODRINTH_FILTERS[mode].Loader];
      } else if (mode === "mod") {
        loaders = ["all", "fabric", "forge", "neoforge", "quilt", "vanilla"];
      }
      if (loaders.length) {
        loaderContainer.innerHTML = loaders.map(l =>
          `<button class="browser-filter-pill${l === "all" ? " active" : ""}" data-filter-loader="${l}">${l === "all" ? "All" : l.charAt(0).toUpperCase() + l.slice(1)}</button>`
        ).join("");
        if (loaderSection) loaderSection.style.display = "";
      } else {
        loaderContainer.innerHTML = "";
        if (loaderSection) loaderSection.style.display = "none";
      }
    }

    // --- Resolution filter (resource packs only) ---
    const resolutionContainer = document.getElementById("filter-resolution");
    const resolutionSection = resolutionContainer?.closest(".browser-filter-section");
    if (resolutionContainer && resolutionSection) {
      if (isModrinth && mode === "resourcepack" && MODRINTH_FILTERS.resourcepack?.Resolution) {
        const resolutions = ["all", ...MODRINTH_FILTERS.resourcepack.Resolution];
        resolutionContainer.innerHTML = resolutions.map(r =>
          `<button class="browser-filter-pill${r === "all" ? " active" : ""}" data-filter-resolution="${r}">${r === "all" ? "All" : r}</button>`
        ).join("");
        resolutionSection.style.display = "";
      } else {
        resolutionContainer.innerHTML = "";
        resolutionSection.style.display = "none";
      }
    }

    // --- Populate version filter from state ---
    const versionSelect = document.getElementById("filter-version");
    if (versionSelect) {
      const versions = (state.allVersions || []).slice(0, 40);
      versionSelect.innerHTML = `<option value="all">All Versions</option>` +
        versions.map(v => `<option value="${v.id}">${v.id}</option>`).join("");
      // Default to the active modpack's or version's MC version, matching the discover page.
      let defaultVersion = "all";
      try {
        const mp = mpGet();
        if (mp && mp.mcVersion) {
          defaultVersion = mp.mcVersion;
        } else if (state.activeVersionForMods) {
          defaultVersion = state.activeVersionForMods;
        }
      } catch (_) { /* mpGet not available in some contexts */ }
      versionSelect.value = defaultVersion;
      state.browserFilters.version = defaultVersion;
    }

    // Reset sort
    const sortSelect = document.getElementById("filter-sort");
    if (sortSelect) sortSelect.value = "relevance";
  }

  function setupBrowserFilterHandlers() {
    // Category filter pills
    document.getElementById("filter-category")?.addEventListener("click", (e) => {
      const pill = e.target.closest(".browser-filter-pill[data-filter-category]");
      if (!pill) return;
      document.querySelectorAll("#filter-category .browser-filter-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      state.browserFilters.category = pill.dataset.filterCategory;
      mpBrowse(document.getElementById("mod-search").value, 0);
    });

    // Loader filter pills
    document.getElementById("filter-loader")?.addEventListener("click", (e) => {
      const pill = e.target.closest(".browser-filter-pill[data-filter-loader]");
      if (!pill) return;
      document.querySelectorAll("#filter-loader .browser-filter-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      state.browserFilters.loader = pill.dataset.filterLoader;
      mpBrowse(document.getElementById("mod-search").value, 0);
    });

    // Resolution filter pills (resource packs only)
    document.getElementById("filter-resolution")?.addEventListener("click", (e) => {
      const pill = e.target.closest(".browser-filter-pill[data-filter-resolution]");
      if (!pill) return;
      document.querySelectorAll("#filter-resolution .browser-filter-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      state.browserFilters.resolution = pill.dataset.filterResolution;
      mpBrowse(document.getElementById("mod-search").value, 0);
    });

    // Sort select
    document.getElementById("filter-sort")?.addEventListener("change", (e) => {
      state.browserFilters.sort = e.target.value;
      mpBrowse(document.getElementById("mod-search").value, 0);
    });

    // Version select
    document.getElementById("filter-version")?.addEventListener("change", (e) => {
      state.browserFilters.version = e.target.value;
      mpBrowse(document.getElementById("mod-search").value, 0);
    });

    // Clear filters
    document.getElementById("btn-clear-filters")?.addEventListener("click", () => {
      populateBrowserFilters(state.browserMode);
      mpBrowse(document.getElementById("mod-search").value, 0);
    });
  }

  function openBrowser(mode) {
    state.browserMode = mode;
    const titles = {
      mod: "Browse Mods",
      resourcepack: "Browse Resource Packs",
      shader: "Browse Shaders",
      modpack: "Browse Modpacks",
    };
    const placeholders = {
      mod: "Search mods...",
      resourcepack: "Search resource packs...",
      shader: "Search shaders...",
      modpack: "Search modpacks...",
    };
    document.getElementById("browser-title").innerText = titles[mode];
    document.getElementById("mod-search").placeholder =
      placeholders[mode] || "Search...";

    if (mode === "modpack") {
      state.currentProvider = "modrinth";
      document
        .querySelectorAll(".provider-pill")
        .forEach((p) => p.classList.remove("active"));
      document.getElementById("pill-modrinth").classList.add("active");
      document.getElementById("pill-modrinth").style.display = "inline-block";
      document.getElementById("pill-curseforge").style.display = "inline-block";
    } else {
      document.getElementById("pill-modrinth").style.display = "inline-block";
      document.getElementById("pill-curseforge").style.display = "none";
    }

    populateBrowserFilters(mode);

    document.getElementById("mod-browser").classList.add("active");
    document.getElementById("mod-search").value = "";
    mpBrowse("");
  }

  // Initialize filter handlers once
  setupBrowserFilterHandlers();
  document
    .getElementById("btn-browse-mods")
    .addEventListener("click", () => openBrowser("mod"));
  document
    .getElementById("btn-browse-rp")
    .addEventListener("click", () => openBrowser("resourcepack"));
  document
    .getElementById("btn-browse-shaders")
    .addEventListener("click", () => openBrowser("shader"));
  document
    .getElementById("btn-browse-modpacks")
    .addEventListener("click", () => openBrowser("modpack"));
  document
    .getElementById("btn-close-browser")
    .addEventListener("click", () =>
      document.getElementById("mod-browser").classList.remove("active"),
    );

  // Provider pill switching
  document.querySelectorAll(".provider-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      document
        .querySelectorAll(".provider-pill")
        .forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      state.currentProvider = pill.getAttribute("data-provider");
      mpBrowse(document.getElementById("mod-search").value);
    });
  });

  let mpSearchTimeout;
  document.getElementById("mod-search").addEventListener("input", (e) => {
    clearTimeout(mpSearchTimeout);
    mpSearchTimeout = setTimeout(() => mpBrowse(e.target.value, 0), 400);
  });

  async function mpBrowse(query, page = 0) {
    let mp = mpGet();
    const isViewingVersion =
      state.activeVersionForMods && !state.activeModpackId;

    // Create virtual modpack for version if needed
    if (!mp && isViewingVersion) {
      const versionData = state.allVersions?.find(
        (v) => v.id === state.activeVersionForMods,
      );
      const versionSettings = state.versionSettings?.[
        state.activeVersionForMods
      ] || { loader: "Vanilla" };

      mp = {
        id: `version-${state.activeVersionForMods}`,
        name: state.activeVersionForMods,
        mcVersion: state.activeVersionForMods,
        loader: versionSettings.loader,
        mods: [],
        resourcepacks: [],
        shaders: [],
        isVersion: true,
      };
    }

    if (!mp && state.browserMode !== "modpack") return;

    // Store pagination state
    state.browserPage = page;
    state.browserQuery = query;

    const results = document.getElementById("mod-browser-results");
    results.innerHTML = `<div class="mp-loading"><div class="launch-spinner" style="width:32px;height:32px;margin:0 auto 12px;"></div>Searching ${state.currentProvider === "modrinth" ? "Modrinth" : "CurseForge"}...</div>`;
    try {
      let hits = [];
      const pageSize = 20;
      const offset = page * pageSize;

      if (state.currentProvider === "modrinth") {
        const facetGroups = [];

        // Project type facet
        if (state.browserMode === "mod")
          facetGroups.push([`project_type:mod`]);
        else if (state.browserMode === "resourcepack")
          facetGroups.push([`project_type:resourcepack`]);
        else if (state.browserMode === "shader")
          facetGroups.push([`project_type:shader`]);
        else if (state.browserMode === "modpack")
          facetGroups.push([`project_type:modpack`]);

        // Loader facet from filter (mods and shaders only — resource packs have no loader).
        // "All" = all loaders from the Modrinth discover page as an OR group, matching the discover URL.
        if (state.browserMode !== "modpack" && state.browserMode !== "resourcepack") {
          if (state.browserFilters.loader !== "all") {
            facetGroups.push([`categories:${state.browserFilters.loader}`]);
          } else {
            const allLoaders = MODRINTH_FILTERS[state.browserMode]?.Loader;
            if (allLoaders && allLoaders.length) {
              facetGroups.push(allLoaders.map(l => `categories:${l}`));
            }
          }
        }

        // Resolution facet from filter (resource packs only)
        if (state.browserMode === "resourcepack" && state.browserFilters.resolution !== "all") {
          facetGroups.push([`categories:${state.browserFilters.resolution}`]);
        }

        // Version facet from filter or context
        if (state.browserFilters.version !== "all") {
          facetGroups.push([`versions:${state.browserFilters.version}`]);
        } else if (mp && state.browserMode !== "modpack") {
          // Use simple candidates (exact + major.minor) matching the Modrinth discover page.
          // Shaders have no version filter (the Modrinth discover page never includes v=).
          if (state.browserMode !== "shader") {
            const candidates = buildSimpleVersionCandidates(mp.mcVersion);
            facetGroups.push(candidates.map(v => `versions:${v}`));
          }
        }

        // Category facet from filter
        if (state.browserFilters.category !== "all") {
          facetGroups.push([`categories:${state.browserFilters.category}`]);
        }

        const facets = encodeURIComponent(JSON.stringify(facetGroups));

        // Sort parameter
        const sortMap = {
          relevance: "",
          downloads: "&index=downloads",
          updated: "&index=updated",
          follows: "",
        };
        const sortParam = sortMap[state.browserFilters.sort] || "";

        const res = await fetch(
          `https://api.modrinth.com/v2/search?query=${encodeURIComponent(query)}&facets=${facets}&limit=${pageSize}&offset=${offset}${sortParam}`,
        );
        if (!res.ok) throw new Error(`Modrinth API error: ${res.status}`);
        const data = await safeJson(res);
        hits = (data.hits || []).map((m) => ({
          project_id: m.project_id,
          title: m.title,
          description: m.description,
          icon_url: m.icon_url,
          downloads: m.downloads,
          follows: m.follows,
          provider: "modrinth",
        }));
        state.browserTotalResults = data.total_hits || 0;
      } else {
        let classId = 6;
        if (state.browserMode === "resourcepack") classId = 12;
        else if (state.browserMode === "shader") classId = 6552;
        else if (state.browserMode === "modpack") classId = 4471;

        // Game version from filter or context (CurseForge API only accepts a single gameVersion).
        // Shaders don't filter by version (matching the Modrinth discover page).
        const curseGameVer = state.browserFilters.version !== "all"
          ? state.browserFilters.version
          : (mp && state.browserMode !== "modpack" && state.browserMode !== "shader" ? mp.mcVersion : "");
        const gameVerStr = curseGameVer ? `&gameVersion=${curseGameVer}` : "";

        // Sort field: 2=downloads, 3=updated, 4=last updated
        const sortFieldMap = { relevance: 2, downloads: 2, updated: 3, follows: 4 };
        const sortField = sortFieldMap[state.browserFilters.sort] || 2;

        const res = await fetch(
          `https://api.curse.tools/v1/cf/mods/search?gameId=432&classId=${classId}&searchFilter=${encodeURIComponent(query)}${gameVerStr}&sortField=${sortField}&sortOrder=desc&pageSize=${pageSize}&index=${offset}`,
        );
        if (!res.ok) throw new Error(`CurseForge API error: ${res.status}`);
        const data = await safeJson(res);
        hits = (data.data || []).map((m) => ({
          project_id: m.id.toString(),
          title: m.name,
          description: m.summary,
          icon_url: m.logo ? m.logo.thumbnailUrl : "",
          downloads: m.downloadCount,
          follows: 0,
          provider: "curseforge",
        }));
        state.browserTotalResults = data.pagination?.totalCount || 0;
      }
      results.innerHTML = "";
      if (!hits.length) {
        results.innerHTML = `<div class="mp-loading">No results found for "${esc(query)}"</div>`;
        return;
      }

      // Add pagination controls to the header (next to Modrinth pill)
      const totalPages = Math.ceil(state.browserTotalResults / pageSize);
      const currentPage = state.browserPage + 1;

      const paginationContainer = document.getElementById(
        "pagination-controls",
      );
      paginationContainer.innerHTML = "";

      if (totalPages > 1) {
        // Previous button
        if (state.browserPage > 0) {
          const prevBtn = document.createElement("button");
          prevBtn.textContent = "\u2190 Previous";
          prevBtn.style.cssText =
            "padding:8px 14px;background:rgba(var(--theme-accent-rgb),0.5);border:1px solid rgba(var(--theme-accent-rgb),0.9);color:#fff;border-radius:4px;cursor:pointer;font-size:12px;font-weight:700;transition:all 0.2s;box-shadow:0 2px 8px rgba(var(--theme-accent-rgb),0.3);";
          prevBtn.addEventListener(
            "mouseover",
            () =>
              (prevBtn.style.background = "rgba(var(--theme-accent-rgb),0.8)"),
          );
          prevBtn.addEventListener(
            "mouseout",
            () =>
              (prevBtn.style.background = "rgba(var(--theme-accent-rgb),0.5)"),
          );
          prevBtn.addEventListener("click", () =>
            mpBrowse(state.browserQuery, state.browserPage - 1),
          );
          paginationContainer.appendChild(prevBtn);
        }

        // Page info - more visible
        const pageInfo = document.createElement("span");
        pageInfo.textContent = `${currentPage}/${totalPages}`;
        pageInfo.style.cssText =
          "color:#fff;font-size:13px;font-weight:700;min-width:50px;text-align:center;background:rgba(var(--theme-accent-rgb),0.4);padding:6px 12px;border-radius:4px;border:1px solid rgba(var(--theme-accent-rgb),0.6);";
        paginationContainer.appendChild(pageInfo);

        // Next button
        if (currentPage < totalPages) {
          const nextBtn = document.createElement("button");
          nextBtn.textContent = "Next \u2192";
          nextBtn.style.cssText =
            "padding:8px 14px;background:rgba(var(--theme-accent-rgb),0.5);border:1px solid rgba(var(--theme-accent-rgb),0.9);color:#fff;border-radius:4px;cursor:pointer;font-size:12px;font-weight:700;transition:all 0.2s;box-shadow:0 2px 8px rgba(var(--theme-accent-rgb),0.3);";
          nextBtn.addEventListener(
            "mouseover",
            () =>
              (nextBtn.style.background = "rgba(var(--theme-accent-rgb),0.8)"),
          );
          nextBtn.addEventListener(
            "mouseout",
            () =>
              (nextBtn.style.background = "rgba(var(--theme-accent-rgb),0.5)"),
          );
          nextBtn.addEventListener("click", () =>
            mpBrowse(state.browserQuery, state.browserPage + 1),
          );
          paginationContainer.appendChild(nextBtn);
        }
      }

      // Get installed mod IDs - handle both modpacks and versions
      let installedIds = [];
      if (state.browserMode === "modpack") {
        installedIds = [];
      } else if (mp) {
        if (mp.isVersion) {
          // For versions, get from versionSettings
          const versionMods =
            state.versionSettings?.[state.activeVersionForMods]?.mods || [];
          installedIds = versionMods.map((m) => m.modrinthId || m.filename);
        } else {
          // For modpacks, get from modpack object
          if (state.browserMode === "mod") {
            installedIds = (Array.isArray(mp.mods) ? mp.mods : []).map(
              (m) => m.modrinthId,
            );
          } else if (state.browserMode === "resourcepack") {
            installedIds = (
              Array.isArray(mp.resourcepacks) ? mp.resourcepacks : []
            ).map((r) => r.modrinthId);
          } else {
            installedIds = (Array.isArray(mp.shaders) ? mp.shaders : []).map(
              (s) => s.modrinthId,
            );
          }
        }
      }

      hits.forEach((mod) => {
        const installed = installedIds.includes(mod.project_id);
        const el = document.createElement("div");
        el.className = "mod-result-card";
        const firstLetter = (mod.title || "M").charAt(0).toUpperCase();
        const dlStr = mod.downloads >= 1000000
          ? (mod.downloads / 1000000).toFixed(1) + "M"
          : mod.downloads >= 1000
            ? (mod.downloads / 1000).toFixed(0) + "K"
            : String(mod.downloads);
        const followsStr = mod.follows >= 1000
          ? (mod.follows / 1000).toFixed(0) + "K"
          : String(mod.follows || 0);
        el.innerHTML = `
        ${mod.icon_url ? `<img class="mod-result-icon" src="${mod.icon_url}" onerror="this.style.display='none'" />` : `<div class="mod-result-icon mod-icon-placeholder" style="width:56px;height:56px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:22px;color:rgba(255,255,255,0.6);">${firstLetter}</div>`}
        <div class="mod-result-info">
          <strong>${mod.title}</strong><span>${mod.description}</span>
          <div class="mod-result-meta"><span>\u2193 ${dlStr}</span>${mod.follows ? `<span>\u2605 ${followsStr}</span>` : ""}<span>${mod.provider === "modrinth" ? "Modrinth" : "CurseForge"}</span></div>
        </div>
        <button class="add-mod-btn ${installed ? "installed" : ""}" ${installed ? "disabled" : ""}>${installed ? "\u2713 Added" : state.browserMode === "modpack" ? "+ Import" : "+ Add"}</button>`;
        if (!installed)
          el.querySelector(".add-mod-btn").addEventListener("click", () =>
            mpAddItem(mod, el.querySelector(".add-mod-btn")),
          );
        results.appendChild(el);
      });

      // Add centered pagination at the bottom
      if (totalPages > 1) {
        const bottomPaginationDiv = document.createElement("div");
        bottomPaginationDiv.style.cssText =
          "grid-column:1/-1;display:flex;justify-content:center;align-items:center;gap:12px;margin-top:24px;padding:20px;width:100%;";

        // Previous button
        if (state.browserPage > 0) {
          const prevBtn = document.createElement("button");
          prevBtn.textContent = "\u2190 Previous Page";
          prevBtn.style.cssText =
            "padding:8px 16px;background:rgba(var(--theme-accent-rgb),0.3);border:1px solid rgba(var(--theme-accent-rgb),0.7);color:#fff;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;transition:all 0.2s;";
          prevBtn.addEventListener(
            "mouseover",
            () =>
              (prevBtn.style.background = "rgba(var(--theme-accent-rgb),0.6)"),
          );
          prevBtn.addEventListener(
            "mouseout",
            () =>
              (prevBtn.style.background = "rgba(var(--theme-accent-rgb),0.3)"),
          );
          prevBtn.addEventListener("click", () =>
            mpBrowse(state.browserQuery, state.browserPage - 1),
          );
          bottomPaginationDiv.appendChild(prevBtn);
        }

        // Page info - centered and visible
        const pageInfo = document.createElement("span");
        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
        pageInfo.style.cssText =
          "color:#fff;font-size:13px;font-weight:700;background:rgba(var(--theme-accent-rgb),0.2);padding:8px 16px;border-radius:4px;border:1px solid rgba(var(--theme-accent-rgb),0.5);";
        bottomPaginationDiv.appendChild(pageInfo);

        // Next button
        if (currentPage < totalPages) {
          const nextBtn = document.createElement("button");
          nextBtn.textContent = "Next Page \u2192";
          nextBtn.style.cssText =
            "padding:8px 16px;background:rgba(var(--theme-accent-rgb),0.3);border:1px solid rgba(var(--theme-accent-rgb),0.7);color:#fff;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;transition:all 0.2s;";
          nextBtn.addEventListener(
            "mouseover",
            () =>
              (nextBtn.style.background = "rgba(var(--theme-accent-rgb),0.6)"),
          );
          nextBtn.addEventListener(
            "mouseout",
            () =>
              (nextBtn.style.background = "rgba(var(--theme-accent-rgb),0.3)"),
          );
          nextBtn.addEventListener("click", () =>
            mpBrowse(state.browserQuery, state.browserPage + 1),
          );
          bottomPaginationDiv.appendChild(nextBtn);
        }

        results.appendChild(bottomPaginationDiv);
      }
    } catch (e) {
      results.innerHTML = `<div class="mp-loading" style="color:red;font-size:12px;">Error: ${esc(e.message)} <br/> ${esc(e.stack)}</div>`;
    }
  }

  async function mpAddItem(mod, btn, isDependency = false, passedMp = null) {
    const provider =
      typeof mod === "string" ? "modrinth" : mod.provider || "modrinth";

    // ---- CURSEFORGE MODPACK IMPORT FLOW ----
    if (state.browserMode === "modpack" && provider === "curseforge" && !isDependency) {
      if (btn) {
        btn.textContent = "Fetching...";
        btn.disabled = true;
      }
      const projectId = typeof mod === "string" ? mod : mod.project_id;
      const modName = typeof mod === "string" ? "Modpack" : mod.title;
      showDlPanel("Resolving modpack metadata...", 2, modName);
      try {

        // Fetch modpack details to get icon
        let modpackIcon = "";
        try {
          const modDetailsRes = await fetchWithTimeout(
            `https://api.curse.tools/v1/cf/mods/${projectId}`,
            {},
            8000,
            "CurseForge API unreachable (icon)...",
          );
          const modDetails = await safeJson(modDetailsRes);
          if (modDetails.data?.logo?.thumbnailUrl) {
            modpackIcon = modDetails.data.logo.thumbnailUrl;
          }
        } catch (e) {
          console.warn("Could not fetch modpack icon:", e);
        }

        const filesRes = await fetchWithTimeout(
          `https://api.curse.tools/v1/cf/mods/${projectId}/files`,
          {},
          10000,
          "CurseForge API timed out...",
        );
        const filesData = await safeJson(filesRes);
        let files = filesData.data || [];
        files.sort((a, b) => new Date(b.fileDate) - new Date(a.fileDate));
        if (!files.length) {
          hideDlPanel();
          actions.showWarningToast("No downloadable files found.");
          if (btn) {
            btn.textContent = "+ Import";
            btn.disabled = false;
          }
          return;
        }
        const fileObj = files[0];
        const dlFileName = fileObj.fileName || "modpack.zip";
        let dlUrl = fileObj.downloadUrl;
        if (!dlUrl) {
          const p1 = Math.floor(fileObj.id / 1000);
          const p2 = (fileObj.id % 1000).toString().padStart(3, "0");
          dlUrl = `https://edge.forgecdn.net/files/${p1}/${p2}/${encodeURIComponent(dlFileName)}`;
        }
        document.getElementById("mod-browser").classList.remove("active");
        showDlPanel(`Downloading ${dlFileName}...`, 5, modName);
        if (!window.electronAPI) {
          hideDlPanel();
          actions.showWarningToast("Only available in the desktop app.");
          return;
        }
        const onDlProg = (p) => updateDlPanel(p.status || "Downloading...", p.percent, p.speed, p.eta, dlFileName);
        // Capture the cleanup fn so we can detach this listener when the
        // import completes/fails — otherwise every import leaks another
        // ipcRenderer.on('download-progress', …) handler.
        let detachDlProg = null;
        if (window.electronAPI.onDownloadProgress) detachDlProg = window.electronAPI.onDownloadProgress(onDlProg);
        let importRes;
        try {
          importRes = await window.electronAPI.downloadCurseforgeModpack({
            downloadUrl: dlUrl,
          });
        } finally {
          if (detachDlProg) { try { detachDlProg(); } catch (_) {} detachDlProg = null; }
        }
        if (!importRes.success)
          throw new Error(importRes.error || "Import failed");
        const manifest = importRes.manifest;
        const mpTitle = manifest.name || modName;
        const mpVersion = manifest.version || "";
        document.getElementById("ddp-title").innerText = mpVersion ? `${mpTitle} v${mpVersion}` : mpTitle;
        const rawLoaderId = manifest.minecraft?.modLoaders?.[0]?.id || "";
        const loaderStr = rawLoaderId.toLowerCase();
        const loader = loaderStr.includes("fabric")
          ? "Fabric"
          : loaderStr.includes("forge")
            ? "Forge"
            : loaderStr.includes("neoforge")
              ? "NeoForge"
              : "Vanilla";
        // Extract pinned version: 'forge-14.23.5.2860' \u2192 '14.23.5.2860', 'fabric-0.15.11' \u2192 '0.15.11'
        const loaderVerMatch = rawLoaderId.match(/^[a-z]+-(.+)$/i);
        const loaderVersion = loaderVerMatch ? loaderVerMatch[1] : "";
        const manifestMc = manifest.minecraft?.version || "";
        const mcVersion = isValidMcVersion(manifestMc) ? manifestMc : "Unknown";
        const newMp = {
          id: importRes.modpackId,
          name: manifest.name || modName,
          iconUrl: modpackIcon,
          mcVersion,
          loader,
          loaderVersion,
          mods: [],
          resourcepacks: [],
          shaders: [],
        };
        const mpData = safeParse(localStorage.getItem("idk_modpacks"), []);
        mpData.push(newMp);
        localStorage.setItem("idk_modpacks", JSON.stringify(mpData));
        state.modpacks.push(newMp);
        state.activeModpackId = newMp.id;
        mpRenderList();
        mpRenderDetail();

        // Profile metadata is managed by the main process via IPC
        // No need to save to disk here - the main process handles profile.json files

        const manifestFiles = manifest.files || [];
        let completedCount = 0;
        const concurrencyLimit = 4; // Download mods in parallel (reduced from 12 to prevent memory issues)

        const downloadTask = async (f) => {
          let mf = null;
          try {
            // Fetch file metadata + project category in parallel
            const [fRes, projRes] = await Promise.all([
              fetch(
                `https://api.curse.tools/v1/cf/mods/${f.projectID}/files/${f.fileID}`,
              ),
              fetch(`https://api.curse.tools/v1/cf/mods/${f.projectID}`),
            ]);
            const fData = await safeJson(fRes);
            if (!fData.data) return;
            mf = fData.data;
            let mUrl = mf.downloadUrl;
            if (!mUrl) {
              const mp1 = Math.floor(mf.id / 1000),
                mp2 = (mf.id % 1000).toString().padStart(3, "0");
              mUrl = `https://edge.forgecdn.net/files/${mp1}/${mp2}/${encodeURIComponent(mf.fileName)}`;
            }
            if (/^(fabric|forge|neoforge|quilt)-loader-.*\.jar$/i.test(mf.fileName || "")) {
              console.info("Skipping bundled loader artifact:", mf.fileName);
              return;
            }
            // Determine type from classId: 6=Mod, 12=ResourcePack, 6552=Shader
            let classId = 6;
            let projectIcon = ""; // Fetch icon from project data
            try {
              const pj = await safeJson(projRes);
              classId = pj.data?.classId ?? 6;
              projectIcon = pj.data?.logo?.thumbnailUrl || ""; // Get icon from project
            } catch (_) {}

            if (classId === 12) {
              // Resource Pack
              newMp.resourcepacks.push({
                modrinthId: f.projectID.toString(),
                name: mf.fileName.replace(/\.(zip|jar)$/, ""),
                version: mf.displayName,
                filename: mf.fileName,
                downloadUrl: mUrl,
                iconUrl: projectIcon,
              });
              await window.electronAPI.installResourcepack({
                modpackId: newMp.id,
                downloadUrl: mUrl,
                filename: mf.fileName,
              });
            } else if (classId === 6552) {
              // Shader Pack
              newMp.shaders.push({
                modrinthId: f.projectID.toString(),
                name: mf.fileName.replace(/\.(zip|jar)$/, ""),
                version: mf.displayName,
                filename: mf.fileName,
                downloadUrl: mUrl,
                iconUrl: projectIcon,
              });
              await window.electronAPI.installShader({
                modpackId: newMp.id,
                downloadUrl: mUrl,
                filename: mf.fileName,
              });
            } else {
              // Default: Mod
              newMp.mods.push({
                modrinthId: f.projectID.toString(),
                name: mf.fileName.replace(/\.jar$/, ""),
                version: mf.displayName,
                filename: mf.fileName,
                downloadUrl: mUrl,
                iconUrl: projectIcon,
              });
              await window.electronAPI.installMod({
                modpackId: newMp.id,
                downloadUrl: mUrl,
                filename: mf.fileName,
              });
            }
          } catch (me) {
            console.warn("Failed file", f.projectID, me);
          } finally {
            completedCount++;
            const percent = manifestFiles.length
              ? 5 + (completedCount / manifestFiles.length) * 90
              : 95;
            updateDlPanel(
              `Downloading mods (${completedCount} / ${manifestFiles.length})...`,
              percent,
              null,
              null,
              mf?.fileName || f.fileName || 'unknown',
            );
          }
        };

        // Process parallel workers
        const queue = [...manifestFiles];
        const workers = Array(concurrencyLimit)
          .fill(null)
          .map(async () => {
            while (queue.length > 0) {
              const item = queue.shift();
              if (item) await downloadTask(item);
            }
          });
        await Promise.all(workers);
        // --- Catalog resource packs / shaders / extra mods from overrides -----
        updateDlPanel("Cataloging overrides...", 96, null, null, "Overrides");
        (importRes.resourcepackFiles || []).forEach((rp) => {
          newMp.resourcepacks.push({
            modrinthId: "override-" + rp.filename,
            name: rp.name,
            version: "bundled",
            filename: rp.filename,
            iconUrl: "",
          });
        });
        (importRes.shaderpackFiles || []).forEach((sp) => {
          newMp.shaders.push({
            modrinthId: "override-" + sp.filename,
            name: sp.name,
            version: "bundled",
            filename: sp.filename,
            iconUrl: "",
          });
        });
        (importRes.extraModFiles || []).forEach((em) => {
          if (!newMp.mods.find((m) => m.filename === em.filename)) {
            newMp.mods.push({
              modrinthId: "override-" + em.filename,
              name: em.name,
              version: "bundled",
              filename: em.filename,
              downloadUrl: "",
              iconUrl: "",
            });
          }
        });
        // -----------------------------------------------------------------------
        const mpData2 = JSON.parse(
          localStorage.getItem("idk_modpacks") || "[]",
        );
        const idx = mpData2.findIndex((m) => m.id === newMp.id);
        if (idx >= 0) mpData2[idx] = newMp;
        else mpData2.push(newMp);
        localStorage.setItem("idk_modpacks", JSON.stringify(mpData2));
        mpRenderDetail();
        if (currentImportCancelled) {
          actions.showWarningToast(`"${newMp.name}" import cancelled.`);
          hideDlPanel();
        } else {
          updateDlPanel("Import complete.", 100);
          actions.showWarningToast(`"${newMp.name}" imported successfully!`);
          hideDlPanel();
        }
      } catch (e) {
        if (currentImportCancelled) {
          actions.showWarningToast(`"${newMp.name}" import cancelled.`);
          hideDlPanel();
        } else {
          actions.showWarningToast("Import failed: " + e.message);
          // Clean up the partially-created modpack so retry doesn't duplicate
          cleanupPartialModpack(newMp.id, newMp.name);
          // Show retry/dismiss in the panel — keep icon visible
          document.getElementById("ddp-status").innerText = `Failed: ${e.message}`;
          document.getElementById("ddp-progress-fill").style.width = "0%";
          showRetryState();
          lastImportRetry = () => mpAddItem(mod, btn);
        }
        if (btn) {
          btn.textContent = "+ Import";
          btn.disabled = false;
        }
      }
      return;
    }
    if (
      state.browserMode === "modpack" &&
      provider === "modrinth" &&
      !isDependency
    ) {
      if (btn) {
        btn.textContent = "Fetching...";
        btn.disabled = true;
      }
      const projectId = typeof mod === "string" ? mod : mod.project_id;
      const modName = typeof mod === "string" ? "Modpack" : mod.title;
      const modpackIcon = mod.icon_url || "";
      showDlPanel("Resolving modpack metadata...", 2, modName);
      try {

        // Fetch Modrinth modpack versions
        const versionsRes = await fetchWithTimeout(
          `https://api.modrinth.com/v2/project/${projectId}/version`,
          {},
          10000,
          "Modrinth API timed out...",
        );
        const versions = await safeJson(versionsRes);
        if (!Array.isArray(versions) || !versions.length) {
          hideDlPanel();
          actions.showWarningToast("No versions found.");
          if (btn) {
            btn.textContent = "+ Import";
            btn.disabled = false;
          }
          return;
        }

        // Get latest version
        const latestVersion = versions[0];
        const files = latestVersion.files || [];
        const primaryFile = files.find((f) => f.primary) || files[0];
        if (!primaryFile) {
          hideDlPanel();
          actions.showWarningToast("No downloadable file found.");
          if (btn) {
            btn.textContent = "+ Import";
            btn.disabled = false;
          }
          return;
        }
        const dlFileName = primaryFile.filename || latestVersion.name || latestVersion.version_number || "modpack.mrpack";

        const dlUrl = primaryFile.url;
        document.getElementById("mod-browser").classList.remove("active");
        showDlPanel(`Downloading ${dlFileName}...`, 5, modName);
        if (!window.electronAPI) {
          hideDlPanel();
          actions.showWarningToast("Only available in the desktop app.");
          return;
        }

        const onDlProg = (p) => updateDlPanel(p.status || "Downloading...", p.percent, p.speed, p.eta, dlFileName);
        // Capture cleanup fn so we can detach this listener (see CurseForge path above).
        let detachDlProg = null;
        if (window.electronAPI.onDownloadProgress) detachDlProg = window.electronAPI.onDownloadProgress(onDlProg);
        let importRes;
        try {
          importRes = await window.electronAPI.downloadModrinthModpack({
            downloadUrl: dlUrl,
          });
        } finally {
          if (detachDlProg) { try { detachDlProg(); } catch (_) {} detachDlProg = null; }
        }
        if (!importRes.success)
          throw new Error(importRes.error || "Import failed");
        const manifest = importRes.manifest;
        const mpVersionManifest = manifest.version || latestVersion.version_number || "";
        document.getElementById("ddp-title").innerText = mpVersionManifest ? `${modName} v${mpVersionManifest}` : modName;
        const manifestMc = manifest.minecraft?.version || "";
        const mcVersion = isValidMcVersion(manifestMc) ? manifestMc : "Unknown";
        const rawLoaderId = manifest.minecraft?.modLoaders?.[0]?.id || "";
        const loaderStr = rawLoaderId.toLowerCase();
        const loader = loaderStr.includes("fabric")
          ? "Fabric"
          : loaderStr.includes("forge")
            ? "Forge"
            : loaderStr.includes("neoforge")
              ? "NeoForge"
              : "Vanilla";
        const loaderVerMatch = rawLoaderId.match(/^[a-z]+-(.+)$/i);
        const loaderVersion = loaderVerMatch ? loaderVerMatch[1] : "";

        const newMp = {
          id: importRes.modpackId,
          name: manifest.name || modName,
          iconUrl: modpackIcon,
          mcVersion,
          loader,
          loaderVersion,
          mods: [],
          resourcepacks: [],
          shaders: [],
        };
        const mpData = safeParse(localStorage.getItem("idk_modpacks"), []);
        mpData.push(newMp);
        localStorage.setItem("idk_modpacks", JSON.stringify(mpData));
        state.modpacks.push(newMp);
        state.activeModpackId = newMp.id;
        mpRenderList();
        mpRenderDetail();

        // Profile metadata is managed by the main process via IPC
        // No need to save to disk here - the main process handles profile.json files

        const manifestFiles = manifest.files || [];
        let completedCount = 0;
        const concurrencyLimit = 4; // Download mods in parallel (reduced from 12 to prevent memory issues)

        const downloadTask = async (f) => {
          let filename = f.path?.split("/").pop() || f.filename || "file.jar";
          try {
            const fUrl = f.downloads?.[0] || f.url;
            if (!fUrl) return;

            let fileType = "mod";
            if (f.path?.includes("resourcepacks/")) fileType = "resourcepack";
            else if (f.path?.includes("shaderpacks/")) fileType = "shader";

            if (/^(fabric|forge|neoforge|quilt)-loader-.*\.jar$/i.test(filename)) {
              console.info("Skipping bundled loader artifact:", filename);
              return;
            }

            // Try to fetch project icon from Modrinth API if we have a project ID
            let projectIcon = "";
            if (f.project_id) {
              try {
                const projRes = await fetch(
                  `https://api.modrinth.com/v2/project/${f.project_id}`,
                );
                if (projRes.ok) {
                  const projData = await safeJson(projRes);
                  projectIcon = projData.icon_url || "";
                }
              } catch (e) {
                console.warn(
                  `Failed to fetch icon for project ${f.project_id}:`,
                  e,
                );
              }
            }

            if (fileType === "resourcepack") {
              newMp.resourcepacks.push({
                modrinthId: f.hashes?.sha1 || filename,
                name: filename.replace(/\.(zip|jar)$/, ""),
                version: "bundled",
                filename,
                downloadUrl: fUrl,
                iconUrl: projectIcon,
              });
              await window.electronAPI.installResourcepack({
                modpackId: newMp.id,
                downloadUrl: fUrl,
                filename,
              });
            } else if (fileType === "shader") {
              newMp.shaders.push({
                modrinthId: f.hashes?.sha1 || filename,
                name: filename.replace(/\.(zip|jar)$/, ""),
                version: "bundled",
                filename,
                downloadUrl: fUrl,
                iconUrl: projectIcon,
              });
              await window.electronAPI.installShader({
                modpackId: newMp.id,
                downloadUrl: fUrl,
                filename,
              });
            } else {
              newMp.mods.push({
                modrinthId: f.hashes?.sha1 || filename,
                name: filename.replace(/\.jar$/, ""),
                version: "bundled",
                filename,
                downloadUrl: fUrl,
                iconUrl: projectIcon,
              });
              await window.electronAPI.installMod({
                modpackId: newMp.id,
                downloadUrl: fUrl,
                filename,
              });
            }
            } catch (me) {
            console.warn("Failed file", f.path, me);
          } finally {
            completedCount++;
            const percent = manifestFiles.length
              ? 5 + (completedCount / manifestFiles.length) * 90
              : 95;
            updateDlPanel(
              `Downloading mods (${completedCount} / ${manifestFiles.length})...`,
              percent,
              null,
              null,
              filename,
            );
          }
        };

        const queue = [...manifestFiles];
        const workers = Array(concurrencyLimit)
          .fill(null)
          .map(async () => {
            while (queue.length > 0) {
              if (currentImportCancelled) {
                queue.length = 0;
                return;
              }
              const item = queue.shift();
              if (item) await downloadTask(item);
            }
          });
        await Promise.all(workers);

        const mpData2 = JSON.parse(
          localStorage.getItem("idk_modpacks") || "[]",
        );
        const idx = mpData2.findIndex((m) => m.id === newMp.id);
        if (idx >= 0) mpData2[idx] = newMp;
        else mpData2.push(newMp);
        localStorage.setItem("idk_modpacks", JSON.stringify(mpData2));
        mpRenderDetail();
        if (currentImportCancelled) {
          actions.showWarningToast(`"${newMp.name}" import cancelled.`);
          hideDlPanel();
        } else {
          updateDlPanel("Import complete.", 100, null, null, "Done");
          actions.showWarningToast(`"${newMp.name}" imported successfully!`);
          hideDlPanel();
        }
      } catch (e) {
        if (currentImportCancelled) {
          actions.showWarningToast(`"${newMp.name}" import cancelled.`);
          hideDlPanel();
        } else {
          actions.showWarningToast("Import failed: " + e.message);
          // Clean up the partially-created modpack so retry doesn't duplicate
          cleanupPartialModpack(newMp.id, newMp.name);
          document.getElementById("ddp-status").innerText = `Failed: ${e.message}`;
          document.getElementById("ddp-progress-fill").style.width = "0%";
          showRetryState();
          lastImportRetry = () => mpAddItem(mod, btn);
        }
        if (btn) {
          btn.textContent = "+ Import";
          btn.disabled = false;
        }
      }
      return;
    }

    // ---- NORMAL MOD/RP/SHADER FLOW ----
    // Get modpack OR create a virtual modpack for version
    let mp = passedMp || mpGet();
    const isViewingVersion =
      state.activeVersionForMods && !state.activeModpackId;

    if (!mp && isViewingVersion) {
      // Create a virtual modpack object for the version
      const versionData = state.allVersions?.find(
        (v) => v.id === state.activeVersionForMods,
      );
      const versionSettings = state.versionSettings?.[
        state.activeVersionForMods
      ] || { loader: "Vanilla" };

      mp = {
        id: `version-${state.activeVersionForMods}`,
        name: state.activeVersionForMods,
        mcVersion: state.activeVersionForMods,
        loader: versionSettings.loader,
        mods: [],
        resourcepacks: [],
        shaders: [],
        isVersion: true, // Flag to indicate this is a version, not a real modpack
      };
    }

    if (!mp) return;
    if (btn) {
      btn.textContent = "\u2193 Fetching...";
      btn.disabled = true;
    }
    try {
      let versions, fileObj, entry;

      const projectId = typeof mod === "string" ? mod : mod.project_id;
      const modTitle = typeof mod === "string" ? "Dependency" : mod.title;
      const modIcon = typeof mod === "string" ? "" : mod.icon_url || "";
      const provider =
        typeof mod === "string" ? "modrinth" : mod.provider || "modrinth";

      // ---- CURSEFORGE FLOW ----
      if (provider === "curseforge") {
        if (state.browserMode === "mod") {
          if (mp.mods.find((m) => m.modrinthId === projectId)) {
            if (btn) {
              btn.textContent = "\u2713 Added";
              btn.classList.add("installed");
            }
            return;
          }

          const filesRes = await fetch(
            `https://api.curse.tools/v1/cf/mods/${projectId}/files`,
          );
          if (!filesRes.ok)
            throw new Error(`CurseForge API error: ${filesRes.status}`);
          const filesData = await safeJson(filesRes);

          let files = filesData.data || [];
          files.sort((a, b) => new Date(b.fileDate) - new Date(a.fileDate));

          console.log(
            `[CurseForge] Fetching ${modTitle} for MC ${mp.mcVersion} + ${mp.loader}`,
          );
          console.log(`[CurseForge] Found ${files.length} files`);

          // Use proximity scoring to pick the closest version by MC version.
          const loaderName = mp.loader.toLowerCase();

          // Score each file: lower = closer version + has matching loader
          const scoredFiles = files.map((f) => {
            const hasLoader = f.fileName.toLowerCase().includes(loaderName);
            const gvList = f.gameVersions || [];
            const candidates = buildMcVersionCandidates(mp.mcVersion);
            let bestScore = 100;
            for (const gv of gvList) {
              if (candidates.includes(gv)) {
                bestScore = Math.min(bestScore, scoreGameVersionTag(gv, mp.mcVersion));
              }
            }
            // Loader bonus: halve the score if loader matches
            if (hasLoader && bestScore < 100) bestScore = bestScore / 2;
            return { item: f, score: bestScore };
          });

          scoredFiles.sort((a, b) => {
            if (a.score !== b.score) return a.score - b.score;
            const aDate = new Date(a.item.fileDate || 0).getTime();
            const bDate = new Date(b.item.fileDate || 0).getTime();
            return bDate - aDate;
          });

          const compatibleFile = scoredFiles[0]?.item || files[0];

          if (!compatibleFile) {
            if (btn) {
              actions.showWarningToast(
                `${modTitle} has no downloadable version`,
              );
              btn.textContent = "+ Add";
              btn.disabled = false;
            }
            return;
          }

          console.log(`[CurseForge] Selected file: ${compatibleFile.fileName}`);

          // Fetch project icon from CurseForge API if not already available
          let projectIcon = modIcon;
          if (!projectIcon) {
            try {
              const projRes = await fetch(
                `https://api.curse.tools/v1/cf/mods/${projectId}`,
              );
              if (projRes.ok) {
                const projData = await safeJson(projRes);
                projectIcon = projData.data?.logo?.thumbnailUrl || "";
              }
            } catch (e) {
              console.warn("[CurseForge] Failed to fetch project icon:", e);
            }
          }

          entry = {
            modrinthId: projectId,
            name: modTitle,
            version: compatibleFile.displayName,
            filename: compatibleFile.fileName,
            downloadUrl: compatibleFile.downloadUrl,
            iconUrl: projectIcon,
          };

          if (mp.isVersion) {
            // For versions, install directly and track in versionSettings
            if (btn) btn.textContent = "\u2193 Installing...";

            // Initialize versionSettings if needed
            if (!state.versionSettings[state.activeVersionForMods]) {
              state.versionSettings[state.activeVersionForMods] = {};
            }
            if (!state.versionSettings[state.activeVersionForMods].mods) {
              state.versionSettings[state.activeVersionForMods].mods = [];
            }

            // Add mod metadata to versionSettings
            const modEntry = {
              modrinthId: projectId,
              name: modTitle,
              version: compatibleFile.displayName,
              filename: compatibleFile.fileName,
              downloadUrl: compatibleFile.downloadUrl,
              iconUrl: projectIcon,
            };

            // Check if already added
            if (
              !state.versionSettings[state.activeVersionForMods].mods.find(
                (m) => m.filename === compatibleFile.fileName,
              )
            ) {
              state.versionSettings[state.activeVersionForMods].mods.push(
                modEntry,
              );
              localStorage.setItem(
                "idk_version_settings",
                JSON.stringify(state.versionSettings),
              );
            }

            if (window.electronAPI) {
              await window.electronAPI.installModToVersion({
                version: state.activeVersionForMods,
                downloadUrl: compatibleFile.downloadUrl,
                filename: compatibleFile.fileName,
              });
            }
          } else {
            // For modpacks, save and install
            mp.mods.push(entry);
            mpSave();
            if (btn) btn.textContent = "\u2193 Installing...";
            if (window.electronAPI)
              await window.electronAPI.installMod({
                modpackId: mp.id,
                downloadUrl: compatibleFile.downloadUrl,
                filename: compatibleFile.fileName,
              });
          }
        } else if (state.browserMode === "resourcepack") {
          if (mp.resourcepacks.find((r) => r.modrinthId === projectId)) {
            if (btn) {
              btn.textContent = "\u2713 Added";
              btn.classList.add("installed");
            }
            return;
          }

          const filesRes = await fetch(
            `https://api.curse.tools/v1/cf/mods/${projectId}/files`,
          );
          if (!filesRes.ok)
            throw new Error(`CurseForge API error: ${filesRes.status}`);
          const filesData = await safeJson(filesRes);

          let files = filesData.data || [];
          files.sort((a, b) => new Date(b.fileDate) - new Date(a.fileDate));

          // Pick the file whose tagged game versions are closest to mp.mcVersion.
          // Scoring: exact match (0) → same major.minor (1) → ±1 (2) → ±2 (3) → fallback (50).
          const compatibleFile = pickClosestGameVersion(files, mp.mcVersion, 'gameVersions');

          if (!compatibleFile) {
            if (btn) {
              actions.showWarningToast(
                `${modTitle} has no downloadable version`,
              );
              btn.textContent = "+ Add";
              btn.disabled = false;
            }
            return;
          }

          entry = {
            modrinthId: projectId,
            name: modTitle,
            version: compatibleFile.displayName,
            filename: compatibleFile.fileName,
            downloadUrl: compatibleFile.downloadUrl,
            iconUrl: modIcon,
          };
          mp.resourcepacks.push(entry);
          mpSave();
          if (btn) btn.textContent = "\u2193 Installing...";
          if (window.electronAPI)
            await window.electronAPI.installResourcepack({
              modpackId: mp.id,
              downloadUrl: compatibleFile.downloadUrl,
              filename: compatibleFile.fileName,
            });
        } else if (state.browserMode === "shader") {
          if (mp.shaders.find((s) => s.modrinthId === projectId)) {
            if (btn) {
              btn.textContent = "\u2713 Added";
              btn.classList.add("installed");
            }
            return;
          }

          const filesRes = await fetch(
            `https://api.curse.tools/v1/cf/mods/${projectId}/files`,
          );
          if (!filesRes.ok)
            throw new Error(`CurseForge API error: ${filesRes.status}`);
          const filesData = await safeJson(filesRes);

          let files = filesData.data || [];
          files.sort((a, b) => new Date(b.fileDate) - new Date(a.fileDate));

          const compatibleFile = files[0]; // Shaders might not have version filtering
          if (!compatibleFile) {
            if (btn) {
              actions.showWarningToast(
                `${modTitle} has no downloadable version`,
              );
              btn.textContent = "+ Add";
              btn.disabled = false;
            }
            return;
          }

          entry = {
            modrinthId: projectId,
            name: modTitle,
            version: compatibleFile.displayName,
            filename: compatibleFile.fileName,
            downloadUrl: compatibleFile.downloadUrl,
            iconUrl: modIcon,
          };
          mp.shaders.push(entry);
          mpSave();
          if (btn) btn.textContent = "\u2193 Installing...";
          if (window.electronAPI)
            await window.electronAPI.installShader({
              modpackId: mp.id,
              downloadUrl: compatibleFile.downloadUrl,
              filename: compatibleFile.fileName,
            });
        }
      } else {
        // ---- MODRINTH FLOW ----
        if (state.browserMode === "mod" || isDependency) {
          if (mp.mods.find((m) => m.modrinthId === projectId)) {
            if (btn) {
              btn.textContent = "\u2713 Added";
              btn.classList.add("installed");
            }
            return;
          }

          // Query Modrinth with the exact version + a ±2 version range and a fallback (no game version).
          // This way we always pick the closest available match instead of warning the user.
          const candidates = buildMcVersionCandidates(mp.mcVersion);
          const loaderArr = [mp.loader.toLowerCase()];
          const q = (gvs) => `https://api.modrinth.com/v2/project/${projectId}/version?loaders=${encodeURIComponent(JSON.stringify(loaderArr))}&game_versions=${encodeURIComponent(JSON.stringify(gvs))}`;
          let versions = [];
          for (const gvs of [candidates, []]) {
            const r = await fetch(q(gvs));
            if (!r.ok) continue;
            const data = await safeJson(r);
            if (data && data.length) {
              versions = data;
              break;
            }
          }
          if (!versions.length) {
            if (btn) {
              actions.showWarningToast(
                `${modTitle} has no downloadable version.`,
              );
              btn.textContent = "+ Add";
              btn.disabled = false;
            }
            return;
          }
          const versionObj = pickClosestGameVersion(versions, mp.mcVersion, 'game_versions');
          fileObj =
            versionObj.files.find((f) => f.primary) || versionObj.files[0];

          // Fetch project icon from Modrinth API if not already available
          let projectIcon = modIcon;
          if (!projectIcon) {
            try {
              const projRes = await fetch(
                `https://api.modrinth.com/v2/project/${projectId}`,
              );
              if (projRes.ok) {
                const projData = await safeJson(projRes);
                projectIcon = projData.icon_url || "";
              }
            } catch (e) {
              console.warn("[Modrinth] Failed to fetch project icon:", e);
            }
          }

          entry = {
            modrinthId: projectId,
            name:
              modTitle === "Dependency"
                ? fileObj.filename.split("-")[0]
                : modTitle,
            version: versionObj.version_number,
            filename: fileObj.filename,
            downloadUrl: fileObj.url,
            iconUrl: projectIcon,
          };

          if (mp.isVersion) {
            // For versions, install directly and track in versionSettings
            if (btn) btn.textContent = "\u2193 Installing...";

            // Initialize versionSettings if needed
            if (!state.versionSettings[state.activeVersionForMods]) {
              state.versionSettings[state.activeVersionForMods] = {};
            }
            if (!state.versionSettings[state.activeVersionForMods].mods) {
              state.versionSettings[state.activeVersionForMods].mods = [];
            }

            // Add mod metadata to versionSettings
            const modEntry = {
              modrinthId: projectId,
              name:
                modTitle === "Dependency"
                  ? fileObj.filename.split("-")[0]
                  : modTitle,
              version: versionObj.version_number,
              filename: fileObj.filename,
              downloadUrl: fileObj.url,
              iconUrl: projectIcon,
            };

            // Check if already added
            if (
              !state.versionSettings[state.activeVersionForMods].mods.find(
                (m) => m.filename === fileObj.filename,
              )
            ) {
              state.versionSettings[state.activeVersionForMods].mods.push(
                modEntry,
              );
              localStorage.setItem(
                "idk_version_settings",
                JSON.stringify(state.versionSettings),
              );
            }

            if (window.electronAPI) {
              await window.electronAPI.installModToVersion({
                version: state.activeVersionForMods,
                downloadUrl: fileObj.url,
                filename: fileObj.filename,
              });
            }
          } else {
            // For modpacks, save and install
            mp.mods.push(entry);
            mpSave();
            if (btn) btn.textContent = "\u2193 Installing...";
            if (window.electronAPI)
              await window.electronAPI.installMod({
                modpackId: mp.id,
                downloadUrl: fileObj.url,
                filename: fileObj.filename,
              });
          }

          if (versionObj.dependencies) {
            for (const dep of versionObj.dependencies) {
              if (dep.dependency_type === "required" && dep.project_id) {
                await mpAddItem(dep.project_id, null, true, mp);
              }
            }
          }
        } else if (state.browserMode === "resourcepack") {
          // Resource packs have no loader — query with a ±2 version range, then fall back to all versions.
          const candidates = buildMcVersionCandidates(mp.mcVersion);
          const q = (gvs) => `https://api.modrinth.com/v2/project/${projectId}/version?game_versions=${encodeURIComponent(JSON.stringify(gvs))}`;
          let versions = [];
          for (const gvs of [candidates, []]) {
            const r = await fetch(q(gvs));
            if (!r.ok) continue;
            const data = await safeJson(r);
            if (data && data.length) {
              versions = data;
              break;
            }
          }
          if (!versions.length) {
            actions.showWarningToast(
              `${modTitle} has no downloadable version.`,
            );
            if (btn) {
              btn.textContent = "+ Add";
              btn.disabled = false;
            }
            return;
          }
          const versionObj = pickClosestGameVersion(versions, mp.mcVersion, 'game_versions');
          fileObj =
            versionObj.files.find((f) => f.primary) || versionObj.files[0];
          entry = {
            modrinthId: projectId,
            name: modTitle,
            version: versionObj.version_number,
            filename: fileObj.filename,
            downloadUrl: fileObj.url,
            iconUrl: modIcon,
          };
          mp.resourcepacks.push(entry);
          mpSave();
          if (btn) btn.textContent = "\u2193 Installing...";
          if (window.electronAPI)
            await window.electronAPI.installResourcepack({
              modpackId: mp.id,
              downloadUrl: fileObj.url,
              filename: fileObj.filename,
            });
        } else {
          const res = await fetch(
            `https://api.modrinth.com/v2/project/${projectId}/version`,
          );
          if (!res.ok)
            throw new Error(
              `Modrinth API error: ${res.status} ${res.statusText}`,
            );
          versions = await safeJson(res);
          if (!versions.length) {
            actions.showWarningToast(
              `${modTitle} has no downloadable version.`,
            );
            if (btn) {
              btn.textContent = "+ Add";
              btn.disabled = false;
            }
            return;
          }
          const versionObj = versions[0];
          fileObj =
            versionObj.files.find((f) => f.primary) || versionObj.files[0];
          entry = {
            modrinthId: projectId,
            name: modTitle,
            version: versionObj.version_number,
            filename: fileObj.filename,
            downloadUrl: fileObj.url,
            iconUrl: modIcon,
          };
          mp.shaders.push(entry);
          mpSave();
          if (btn) btn.textContent = "\u2193 Installing...";
          if (window.electronAPI)
            await window.electronAPI.installShader({
              modpackId: mp.id,
              downloadUrl: fileObj.url,
              filename: fileObj.filename,
            });
        }
      }
      if (btn) {
        btn.textContent = "\u2713 Added";
        btn.classList.add("installed");
      }

      // Reload version mods if viewing a version
      if (mp.isVersion && state.activeVersionForMods) {
        await loadVersionMods(state.activeVersionForMods);
      }

      mpRenderDetail();
      mpRenderList();
    } catch (e) {
      if (btn && !isDependency) {
        actions.showWarningToast(
          `Failed to add ${typeof mod === "string" ? mod : mod.title}: ${e.message}`,
        );
        btn.textContent = "+ Add";
        btn.disabled = false;
      }
    }
  }

  // --- Download panel helpers ---
  let dlPanelDismissed = false;
  let currentImportCancelled = false;
  let lastImportRetry = null; // () => Promise<void>

  function setPanelActions({ cancel = true, retry = false, dismiss = false } = {}) {
    const cancelBtn = document.getElementById("btn-ddp-cancel");
    const retryBtn = document.getElementById("btn-ddp-retry");
    const dismissBtn = document.getElementById("btn-ddp-dismiss");
    if (cancelBtn) cancelBtn.style.display = cancel ? "" : "none";
    if (retryBtn) retryBtn.style.display = retry ? "" : "none";
    if (dismissBtn) dismissBtn.style.display = dismiss ? "" : "none";
  }

  function showRetryState() {
    setPanelActions({ cancel: false, retry: true, dismiss: true });
  }

  function showProgressState() {
    setPanelActions({ cancel: true, retry: false, dismiss: false });
  }

  // Remove a partially-imported modpack from state, localStorage, and disk
  // so a retry doesn't create a duplicate entry/folder.
  function cleanupPartialModpack(modpackId, modpackName) {
    if (!modpackId) return;
    try {
      const mpData = safeParse(localStorage.getItem("idk_modpacks"), []);
      const filtered = mpData.filter((m) => m.id !== modpackId);
      localStorage.setItem("idk_modpacks", JSON.stringify(filtered));
      state.modpacks = (state.modpacks || []).filter((m) => m.id !== modpackId);
      if (state.activeModpackId === modpackId) state.activeModpackId = null;
      if (typeof mpRenderList === "function") mpRenderList();
      if (typeof mpRenderDetail === "function") mpRenderDetail();
      if (window.electronAPI?.deleteModpackFolder) {
        window.electronAPI.deleteModpackFolder(modpackId).catch(() => {});
      }
    } catch (e) {
      console.warn("Failed to clean up partial modpack:", modpackName, e);
    }
  }

  function positionDlPanel() {
    const btn = document.getElementById("nav-download-btn");
    const panel = document.getElementById("download-detail-panel");
    if (!btn || !panel) return;
    const rect = btn.getBoundingClientRect();
    panel.style.position = "fixed";
    panel.style.right = "auto";
    panel.style.bottom = "auto";
    panel.style.transform = "none";
    if (rect.width > 0 && rect.height > 0) {
      panel.style.left = Math.max(12, rect.right - panel.offsetWidth) + "px";
      panel.style.top = Math.round(rect.bottom + 8) + "px";
    } else {
      const viewportW = window.innerWidth || document.documentElement.clientWidth;
      const offset = 80;
      panel.style.left = Math.max(12, viewportW - panel.offsetWidth - offset) + "px";
      panel.style.top = "60px";
    }
    panel.className = "download-detail-panel panel-top-right visible";
  }

  window.addEventListener("resize", () => {
    const panel = document.getElementById("download-detail-panel");
    if (panel && panel.classList.contains("visible")) positionDlPanel();
  });

  function formatSpeed(bytesPerSec) {
    if (!bytesPerSec || bytesPerSec <= 0) return "\u2014";
    if (bytesPerSec >= 1048576) return (bytesPerSec / 1048576).toFixed(1) + " MB/s";
    if (bytesPerSec >= 1024) return (bytesPerSec / 1024).toFixed(0) + " KB/s";
    return bytesPerSec.toFixed(0) + " B/s";
  }

  function formatEta(seconds) {
    if (!seconds || seconds <= 0 || !isFinite(seconds)) return "\u2014";
    if (seconds >= 3600) return Math.floor(seconds / 3600) + "h " + Math.floor((seconds % 3600) / 60) + "m";
    if (seconds >= 60) return Math.floor(seconds / 60) + "m " + Math.floor(seconds % 60) + "s";
    return Math.floor(seconds) + "s";
  }

  function showDlPanel(status, percent = 5, title = null) {
    dlPanelDismissed = false;
    currentImportCancelled = false;
    showProgressState();
    const navBtn = document.getElementById("nav-download-btn");
    const panel = document.getElementById("download-detail-panel");
    if (navBtn) {
      navBtn.style.display = "";
      navBtn.classList.add("visible");
    }
    if (panel) {
      const statusEl = document.getElementById("ddp-status");
      const fillEl = document.getElementById("ddp-progress-fill");
      const titleEl = document.getElementById("ddp-title");
      if (statusEl) statusEl.innerText = status;
      if (fillEl) fillEl.style.width = percent + "%";
      if (titleEl && title) titleEl.innerText = title;
      panel.classList.add("visible");
      positionDlPanel();
      setTimeout(positionDlPanel, 60);
    }
  }

  // Hide the panel only — the nav button stays visible so the user can
  // re-open progress while the import continues in the background.
  function dismissDlPanel() {
    dlPanelDismissed = true;
    const panel = document.getElementById("download-detail-panel");
    if (panel) panel.classList.remove("visible");
    const closeBtn = document.getElementById("btn-ddp-close");
    if (closeBtn) closeBtn.blur();
  }

  // Fully close the panel AND hide the nav icon — only when the import
  // is actually done (success, error, cancel, or timeout).
  function hideDlPanel() {
    dlPanelDismissed = true;
    const navBtn = document.getElementById("nav-download-btn");
    const panel = document.getElementById("download-detail-panel");
    if (navBtn) {
      navBtn.style.display = "none";
      navBtn.classList.remove("visible");
    }
    if (panel) {
      panel.classList.remove("visible");
    }
    const closeBtn = document.getElementById("btn-ddp-close");
    if (closeBtn) closeBtn.blur();
    const ring = document.getElementById("nav-dl-ring");
    if (ring) ring.style.strokeDashoffset = "69.12";
    // Reset title for next use
    document.getElementById("ddp-title").innerText = "Downloading Modpack";
    document.getElementById("ddp-current-item").innerText = "";
  }

  // Debounce state for the "current item" text — 4 concurrent workers fire
  // updateDlPanel with different filenames in rapid succession; without a
  // debounce the text flickers faster than the eye can read.
  let _itemDebounceTimer = null;
  let _pendingItem = null;

  function updateDlPanel(status, percent, speed, eta, item) {
    const panel = document.getElementById("download-detail-panel");
    if (panel && !panel.classList.contains("visible")) {
      // Don't auto-re-open after user dismissed, but if they click the
      // nav icon to re-open manually, updates will flow through.
      if (dlPanelDismissed) return;
      showDlPanel(status, percent);
      return;
    }
    const statusEl = document.getElementById("ddp-status");
    const fillEl = document.getElementById("ddp-progress-fill");
    const ring = document.getElementById("nav-dl-ring");
    const percentEl = document.getElementById("ddp-percent");
    const speedEl = document.getElementById("ddp-speed");
    const etaEl = document.getElementById("ddp-eta");
    const itemEl = document.getElementById("ddp-current-item");
    if (statusEl) statusEl.innerText = status;
    if (fillEl && Number.isFinite(percent))
      fillEl.style.width = Math.max(0, Math.min(100, percent)) + "%";
    if (ring && Number.isFinite(percent)) {
      const offset = 69.12 - (percent / 100) * 69.12;
      ring.style.strokeDashoffset = offset;
    }
    if (percentEl) percentEl.innerText = Math.round(percent) + "%";
    if (speedEl) speedEl.innerText = formatSpeed(speed);
    if (etaEl) etaEl.innerText = formatEta(eta);
    // Debounce the current-item text so rapid concurrent updates don't flicker
    if (itemEl && item !== undefined) {
      _pendingItem = item;
      if (_itemDebounceTimer) clearTimeout(_itemDebounceTimer);
      _itemDebounceTimer = setTimeout(() => {
        _itemDebounceTimer = null;
        if (itemEl && _pendingItem !== null) itemEl.innerText = _pendingItem;
        _pendingItem = null;
      }, 120);
    }
  }

  window.showDownloadPanel = showDlPanel;
  window.updateDownloadPanel = updateDlPanel;
  window.hideDownloadPanel = hideDlPanel;

  // Expose import function for inline onclick in content-feature trending modpacks
  let pendingTrendingMod = null;
  window.clickTrendingMod = async (mod) => {
    state.browserMode = "modpack";
    pendingTrendingMod = mod;
    const modal = document.getElementById("dl-confirm-modal");
    const nameEl = document.getElementById("dl-confirm-name");
    if (nameEl) nameEl.textContent = mod.title || "Download Modpack?";
    if (modal) modal.classList.add("active");
  };

  document.getElementById("btn-dl-confirm-cancel").addEventListener("click", () => {
    document.getElementById("dl-confirm-modal").classList.remove("active");
    pendingTrendingMod = null;
  });

  document.getElementById("btn-dl-confirm-start").addEventListener("click", async () => {
    document.getElementById("dl-confirm-modal").classList.remove("active");
    const mod = pendingTrendingMod;
    pendingTrendingMod = null;
    if (mod) {
      lastImportRetry = () => mpAddItem(mod, null);
      showDlPanel("Resolving modpack metadata...", 2, mod.title || "Modpack");
      await mpAddItem(mod, null);
      hideDlPanel();
    }
  });

  // Retry button — re-runs the last failed import
  document.getElementById("btn-ddp-retry")?.addEventListener("click", async () => {
    if (!lastImportRetry) {
      hideDlPanel();
      return;
    }
    const retry = lastImportRetry;
    lastImportRetry = null;
    showProgressState();
    document.getElementById("ddp-status").innerText = "Retrying...";
    document.getElementById("ddp-progress-fill").style.width = "5%";
    try {
      await retry();
    } finally {
      // Result handled by mpAddItem's success/catch → updates panel
    }
  });

  // Dismiss button — closes the panel after a failure
  document.getElementById("btn-ddp-dismiss")?.addEventListener("click", () => {
    lastImportRetry = null;
    hideDlPanel();
  });

  // --- Download panel controls ---
  document.getElementById("nav-download-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    const panel = document.getElementById("download-detail-panel");
    if (panel) panel.classList.toggle("visible");
  });

  const ddp = document.getElementById("download-detail-panel");
  ddp?.addEventListener("click", (e) => {
    const close = e.target.closest?.("#btn-ddp-close");
    if (!close) return;
    e.preventDefault();
    e.stopPropagation();
    dismissDlPanel();
  });

  document.getElementById("btn-ddp-cancel").addEventListener("click", () => {
    currentImportCancelled = true;
    dismissDlPanel();
  });

  // Close panel when clicking outside (dismiss, keep icon visible)
  document.addEventListener("click", (e) => {
    const panel = document.getElementById("download-detail-panel");
    const btn = document.getElementById("nav-download-btn");
    if (panel && panel.classList.contains("visible")) {
      if (btn && !btn.contains(e.target) && !panel.contains(e.target)) {
        panel.classList.remove("visible");
        dlPanelDismissed = true;
      }
    }
  });

  // --- Play Modpack ---
  // IPC listeners are already registered globally above \u2014 no setup needed here.
  document.getElementById("btn-play-modpack").addEventListener("click", async () => {
    const mp = mpGet();
    const isViewingVersion =
      state.activeVersionForMods && !state.activeModpackId;

    if (!mp && !isViewingVersion) return;

    const fallbackVersion = state.downloadedVersions?.[0] || state.selectedVersion || "1.20.1";
    const resolvedModpackVersion = mp?.mcVersion && isValidMcVersion(mp.mcVersion)
      ? mp.mcVersion
      : (state.versionSettings?.[mp?.id]?.mcVersion && isValidMcVersion(state.versionSettings[mp.id].mcVersion)
        ? state.versionSettings[mp.id].mcVersion
        : fallbackVersion);
    state.selectedVersion = isViewingVersion ? state.activeVersionForMods : resolvedModpackVersion;
    console.log(`[Modpack] Play clicked: modpack=${mp?.id}, version=${resolvedModpackVersion}, loader=${mp?.loader}, isViewing=${isViewingVersion}`);
    actions.beginLaunchOverlay?.("Launching...");
    let authData = null;
    try {
      if (state.authMode === "elyby" && window.electronAPI?.getElybyAuthData) {
        authData = (await window.electronAPI.getElybyAuthData()).data || null;
      } else if (state.authMode === "microsoft" && window.electronAPI?.getMicrosoftAuthData) {
        authData = (await window.electronAPI.getMicrosoftAuthData()).data || null;
      }
    } catch (e) {
      console.warn('[Modpack] Auth retrieval failed:', e);
    }

    const windowSize = {
      width: state.defaultWindowWidth,
      height: state.defaultWindowHeight,
      fullscreen: state.defaultFullscreen,
      enableOverlay: state.enableOverlay,
      hideLauncher: state.hideLauncher === true,
    };

    if (isViewingVersion) {
      // Launch the version with its settings
      const version = state.activeVersionForMods;
      const versionSettings = state.versionSettings[version] || {
        loader: "Vanilla",
        loaderVersion: "",
        javaArgs: "",
        windowWidth: 1024,
        windowHeight: 768,
      };

      if (window.electronAPI) {
        console.log(`[Modpack] Launching version: ${version}, loader=${versionSettings.loader}, memory=${state.maxMemoryGB}G`);
        window.electronAPI.launchModpack({
          username: state.currentUser,
          modpackId: `version-${version}`,
          modpackName: version,
          mcVersion: version,
          loader: getLoaderForVersion(version),
          loaderVersion: versionSettings.loaderVersion || "",
          javaPath: state.javaPath,
          maxMemory: `${state.maxMemoryGB}G`,
          authData,
          windowSize,
          globalJavaArgs: state.globalJavaArgs,
          quickConnect: state.quickConnectTarget,
        });
        state.quickConnectTarget = null;
      }
    } else if (window.electronAPI) {
      const versionSettings = state.versionSettings?.[mp?.id] || {};
      console.log(`[Modpack] Launching modpack: ${mp.id}, name=${mp.name}, version=${resolvedModpackVersion}, loader=${versionSettings.loader || mp.loader}, memory=${state.maxMemoryGB}G`);
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
      });
      state.quickConnectTarget = null;
    }
  });

  // --- Back to Modpacks List ---
  document.getElementById("btn-back-modpacks").addEventListener("click", () => {
    state.activeModpackId = null;
    state.activeVersionForMods = null;
    mpRenderList();
    mpRenderDetail();
  });

  // --- Refresh Profiles ---
  document
    .getElementById("btn-refresh-profiles")
    .addEventListener("click", async () => {
      const btn = document.getElementById("btn-refresh-profiles");
      if (!btn) return;
      btn.style.opacity = "0.5";
      btn.style.pointerEvents = "none";
      // Rotate icon (null-safe in case the SVG child is missing)
      const svg = btn.querySelector("svg");
      if (svg) svg.style.animation = "spin 0.8s linear infinite";
      try {
        await loadProfilesFromDisk();
      } catch (e) {
        console.error("[Modpacks] refresh failed:", e);
      } finally {
        btn.style.opacity = "";
        btn.style.pointerEvents = "";
        if (svg) svg.style.animation = "";
      }
      actions.showWarningToast("Profiles refreshed from disk!");
    });

  // --- Drag and Drop External Files ---
  const dragContent = document.getElementById("modpack-content");
  if (dragContent) {
    dragContent.addEventListener("dragenter", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    dragContent.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragContent.style.boxShadow = "inset 0 0 0 2px var(--theme-accent)";
      dragContent.style.background = "rgba(var(--theme-accent-rgb), 0.05)";
    });

    dragContent.addEventListener("dragleave", (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragContent.style.boxShadow = "";
      dragContent.style.background = "";
    });

    dragContent.addEventListener("drop", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragContent.style.boxShadow = "";
      dragContent.style.background = "";

      if (window.electronAPI?.rendererLog) {
        window.electronAPI.rendererLog("[Modpacks] DROP event fired on modpack-content!");
      }

      const rawFiles = Array.from(e.dataTransfer.files);
      // Modern Electron: use window.electronAPI.getPathForFile(f) — the
      // deprecated f.path is no longer set on File objects. Surface a
      // clear error if the bridge is missing instead of silently dropping files.
      const files = rawFiles.map(f => {
        if (window.electronAPI?.getPathForFile) {
          try { return window.electronAPI.getPathForFile(f); } catch (_) { return null; }
        }
        // Fallback for legacy Electron where f.path still exists
        return f.path || null;
      }).filter(p => p);
      if (files.length === 0 && rawFiles.length > 0) {
        actions.showWarningToast(`Could not read file paths. Drag-drop requires the desktop app (Electron). Dropped ${rawFiles.length} item(s).`);
        return;
      }
      if (rawFiles.length === 0) return;

      const mp = mpGet();
      const isViewingVersion = state.activeVersionForMods && !state.activeModpackId;
      const targetId = isViewingVersion ? `version-${state.activeVersionForMods}` : (mp ? mp.id : null);
      if (!targetId) {
        actions.showWarningToast("No active modpack or version selected to drop files into.");
        return;
      }

      let targetType = "mods";
      const activeTab = document.querySelector(".mp-tab.active");
      if (activeTab) {
        if (activeTab.dataset.tab === "resourcepacks") targetType = "resourcepacks";
        else if (activeTab.dataset.tab === "shaders") targetType = "shaderpacks";
      }

      if (!window.electronAPI?.importExternalFiles) {
        actions.showWarningToast("Backend not updated. Please close the launcher completely and start it again.");
        return;
      }

      if (window.electronAPI?.importExternalFiles) {
        try {
          const result = await window.electronAPI.importExternalFiles({
            modpackId: targetId,
            targetType,
            sourcePaths: files
          });
          
          if (result.success) {
            actions.showWarningToast(`Imported ${result.imported} file(s) into ${targetType}`);
            if (isViewingVersion) {
              if (typeof loadVersionMods === "function") {
                await loadVersionMods(state.activeVersionForMods);
              }
            } else {
              await loadProfilesFromDisk();
            }
            mpRenderDetail();
            mpRenderList();
          } else {
             actions.showWarningToast(`Failed to import files: ${result.error}`);
          }
        } catch (err) {
           actions.showWarningToast(`Import error: ${err.message}`);
        }
      }
    });
  }

  actions.modpacks = {
    mpGet,
    mpSave,
    mpRenderList,
    mpRenderDetail,
    loadProfilesFromDisk,
  };
}


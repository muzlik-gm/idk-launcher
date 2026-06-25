export function renderAppShell() {
  document.querySelector("#app").innerHTML = `
  <div class="background-slider">
    <video autoplay muted loop playsinline class="bg-video">
      <source src="./background.mp4" type="video/mp4">
    </video>
  </div>
  <div class="bg-overlay"></div>
  <canvas id="bg-effects-canvas" class="bg-effects-canvas"></canvas>

  <!-- TOP TITLE BAR & NAVIGATION -->
  <div class="top-bar">
    <div class="top-bar-left">
      <div class="top-brand"><span class="brand-mark">IDK.</span><span class="brand-word">Launcher</span></div>
      <div class="header-nav">
        <div class="brand-title" style="display:none;"></div>
        <div class="nav-tabs">
          <div class="nav-tab" data-target="main">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            Play
          </div>
          <div class="nav-tab" data-target="mods">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
            Modpacks
          </div>
          <div class="nav-tab" data-target="profile">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            Profile
          </div>
          <div class="nav-tab" data-target="settings">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m5.08 5.08l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m5.08-5.08l4.24-4.24"></path></svg>
            Settings
          </div>
        </div>
      </div>
    </div>

    <div class="top-bar-right">
      <!-- DOWNLOAD STATUS BUTTON -->
      <button class="download-status-btn" id="nav-download-btn" style="display:none;" title="Download Progress">
        <svg class="ds-ring" width="28" height="28" viewBox="0 0 28 28">
          <circle class="ds-ring-bg" cx="14" cy="14" r="11" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="2.5"/>
          <circle class="ds-ring-fill" id="nav-dl-ring" cx="14" cy="14" r="11" fill="none" stroke="var(--theme-accent)" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="69.12" stroke-dashoffset="69.12" transform="rotate(-90 14 14)"/>
        </svg>
        <svg class="ds-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      </button>
      <!-- FRIENDS TOGGLE BUTTON -->
      <button class="friends-toggle-btn" id="btn-friends-toggle" title="Friends List" style="margin-right: 4px;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
        <span class="friends-badge" id="friends-pending-badge" style="display:none;">0</span>
        <span class="friends-unread-dot" id="friends-unread-dot" style="display:none;"></span>
      </button>

      <div class="user-profile-wrapper">
        <div class="user-profile" id="user-profile-btn">
          <div class="user-profile-avatar" aria-hidden="true">
            <canvas id="avatar-canvas" width="40" height="40"></canvas>
          </div>
          <div class="user-details">
            <span class="user-details-label">Playing as</span>
            <h4 id="display-username">PlayerOne</h4>
          </div>
        </div>

        <div class="profile-dropdown" id="profile-dropdown">
          <div class="profile-dropdown-item" id="btn-dropdown-skin" style="display:none;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:8px;"><circle cx="12" cy="12" r="10"></circle><path d="M12 8a4 4 0 0 0-4 4h8a4 4 0 0 0-4-4z"></path></svg>
            Change Skin (Ely.by)
          </div>
          <div class="profile-dropdown-item" id="btn-dropdown-profile">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:8px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            My profile
          </div>
          <div class="profile-dropdown-item logout" id="btn-dropdown-logout">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:8px;"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            Log Out
          </div>
        </div>
      </div>
      <div class="window-controls">
        <div class="ctrl minimize">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1">
            <line x1="0" y1="6" x2="12" y2="6"></line>
          </svg>
        </div>
        <div class="ctrl maximize">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1">
            <rect x="0.5" y="0.5" width="11" height="11"></rect>
          </svg>
        </div>
        <div class="ctrl close">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1">
            <line x1="0" y1="0" x2="12" y2="12"></line>
            <line x1="12" y1="0" x2="0" y2="12"></line>
          </svg>
        </div>
      </div>
    </div>
  </div>

  <!-- LOGIN VIEW -->
  <div id="view-login" class="view active">
    <div class="login-box">
      <h2>Welcome Back</h2>
      <p style="color: var(--text-muted); margin-bottom: 10px;">Select your login method to enter the launcher.</p>

      <div class="login-btn microsoft" id="btn-microsoft-login">
        <img src="./microsoft.png" alt="Microsoft Logo" width="18" height="18" style="object-fit: contain;" />
        Microsoft Account
      </div>

      <div class="login-btn elyby" id="btn-elyby-login">
        <img src="./elyby.jpg" alt="Ely.by Logo" width="18" height="18" style="border-radius: 3px; object-fit: cover;" />
        Ely.by Account
      </div>

      <div id="btn-offline-login" style="text-align: center; margin-top: 8px; cursor: pointer; color: #8c9096; font-size: 11px; text-decoration: underline; transition: color 0.2s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#8c9096'">
        Play Minecraft with Username (Offline)
      </div>

      <div class="offline-form" id="offline-form">
        <input type="text" class="clean-input" id="login-username" placeholder="Enter username..." />
        <button class="submit-btn" id="btn-submit-login">Enter Launcher</button>
      </div>
    </div>
  </div>

  <!-- MAIN VIEW -->
  <div id="view-main" class="view">
    <div class="main-hero-banner">
      <video autoplay muted loop playsinline class="hero-video">
        <source src="./background.mp4" type="video/mp4">
      </video>
      <div class="hero-overlay"></div>

      <!-- Integrated invisible navigation trigger links to keep original JS functional -->
      <div id="btn-open-mods" style="display:none;"></div>
      <div id="btn-open-settings" style="display:none;"></div>

      <div class="main-center">
        <div class="advanced-home-player" aria-hidden="true">
          <h1 class="advanced-home-username" id="advanced-home-username">PLAYER</h1>
           <div class="advanced-home-skin-viewer-wrapper" id="advanced-home-skin-stage" style="display:flex; justify-content:center; align-items:center; overflow:hidden;">
             <div class="advanced-home-skin-loading" id="advanced-home-skin-loading">Loading skin…</div>
             <canvas id="advanced-home-skin-canvas"></canvas>
           </div>
        </div>
        <img src="./java.png" alt="Minecraft Java Edition" class="mc-logo" />
      </div>

      <div class="bottom-bar">
        <div class="controls-left">
          <div class="custom-select-wrapper">
            <div class="custom-select" id="version-dropdown">
              <div class="custom-select-trigger">
                <span style="display: flex; align-items: center; gap: 8px;">
                  <svg class="grass-icon" viewBox="0 0 24 24" width="16" height="16"><path d="M2 2h20v4H2z" fill="#5c8e32"/><path d="M2 6h20v16H2z" fill="#866043"/><path d="M2 6l3 3 3-3 3 3 3-3 3 3 3-3 3 3v2l-3-3-3 3-3-3-3 3-3-3-3 3-3-3z" fill="#4d7729"/></svg>
                  <span id="selected-version-text">Loading versions...</span>
                </span>
                <svg width="12" height="8" viewBox="0 0 12 8" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 1l5 5 5-5"/></svg>
              </div>
              <div class="custom-options">
                <div class="options-filters">
                  <div class="version-tabs">
                    <button class="version-tab active" data-tab="all">All Releases</button>
                    <button class="version-tab" data-tab="downloaded">Installed</button>
                  </div>
                  <label class="toggle-switch" style="display:none;">
                    <input type="checkbox" id="show-snapshots" />
                    <div class="switch"></div>
                    Snapshots
                  </label>

                  <label class="toggle-switch" style="display:none;">
                    <input type="checkbox" id="show-historical" />
                    <div class="switch"></div>
                    Historical
                  </label>
                </div>
                <div class="options-list" id="options-list">
                  <!-- Injected via JS -->
                </div>
              </div>
            </div>
          </div>

          <button class="refresh-versions-btn" id="btn-refresh-versions" title="Refresh downloaded versions">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
          </button>

          <div class="custom-select-wrapper" style="width: 200px;">
            <div class="custom-select" id="loader-dropdown">
              <div class="custom-select-trigger" id="loader-trigger">
                <span id="selected-loader-text" style="display: flex; align-items: center; gap: 8px;">
                  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                  Vanilla
                </span>
                <svg width="12" height="8" viewBox="0 0 12 8" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 1l5 5 5-5"/></svg>
              </div>
              <div class="custom-options">
                <div class="options-list">
                  <div class="custom-option selected" data-loader="Vanilla">
                    <span style="display: flex; align-items: center; gap: 8px;"><svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg> Vanilla</span>
                  </div>
                  <div class="custom-option" data-loader="Forge">
                    <span style="display: flex; align-items: center; gap: 8px;"><svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg> Forge</span>
                  </div>
                  <div class="custom-option" data-loader="Fabric">
                    <span style="display: flex; align-items: center; gap: 8px;"><svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"></path><line x1="16" y1="8" x2="2" y2="22"></line><line x1="17.5" y1="15" x2="9" y2="15"></line></svg> Fabric</span>
                  </div>
                  <div class="custom-option" data-loader="NeoForge">
                    <span style="display: flex; align-items: center; gap: 8px;"><svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg> NeoForge</span>
                  </div>
                  <div class="custom-option" data-loader="Quilt">
                    <span style="display: flex; align-items: center; gap: 8px;"><svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg> Quilt</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="controls-right">
          <div class="play-button-wrapper" id="play-btn-wrapper">
            <button class="play-button" id="play-btn">PLAY</button>
            <button class="play-dropdown-trigger" id="play-dropdown-trigger" aria-label="More options">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
            <div class="play-dropdown" id="play-dropdown">
              <div class="play-dd-setup" id="play-dd-setup">
                <span class="play-dd-setup-label">Current Setup</span>
                <span class="play-dd-setup-value" id="play-dd-setup-value">—</span>
              </div>

              <div class="play-dropdown-divider"></div>

              <div class="play-dd-section">
                <div class="play-dd-section-header">Loader</div>
                <div class="play-dd-loader-list" id="play-dd-loader-list">
                  <button class="play-dd-loader-btn" data-loader="Vanilla">Vanilla</button>
                  <button class="play-dd-loader-btn" data-loader="Forge">Forge</button>
                  <button class="play-dd-loader-btn" data-loader="Fabric">Fabric</button>
                  <button class="play-dd-loader-btn" data-loader="NeoForge">NeoForge</button>
                  <button class="play-dd-loader-btn" data-loader="Quilt">Quilt</button>
                </div>
              </div>

              <div class="play-dropdown-divider"></div>

              <div class="play-dd-section">
                <div class="play-dd-version-list" id="play-dd-version-list">
                  <!-- Injected by JS: section headers + version/modpack items -->
                </div>
              </div>

              <div class="play-dropdown-divider"></div>

              <div class="play-dd-footer" id="play-dd-footer">
                <button id="play-dd-modpacks">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                  Modpacks
                </button>
                <button id="play-dd-all-versions">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  All versions
                </button>
              </div>
            </div>
          </div>
          <button class="manage-mods-button" id="manage-mods-btn" style="display: none;">MANAGE MODS</button>
        </div>
      </div>
    </div>

    <div class="details-section">
      <div class="details-content">
        <div class="featured-server-banner">
          <div class="featured-server-info">
            <img class="featured-server-icon" src="./lunasmp.png" alt="Server Logo" style="image-rendering: pixelated; padding: 8px; background: rgba(0,0,0,0.5);" />
            <div class="featured-server-text">
              <span class="featured-server-label">Partner Server</span>
              <span class="featured-server-title">LunaSMP</span>
              <span class="featured-server-desc">The official survival multiplayer experience! Join now for exclusive rewards.</span>
              <span class="featured-server-ip" style="font-size: 13px; color: var(--text-muted); margin-top: 6px; display: flex; align-items: center; gap: 6px; user-select: text;" title="IP Address">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                play.somniac.me
              </span>
            </div>
          </div>
          <div class="featured-server-action">
            <button class="featured-join-btn" onclick="if(window.IdkApp) { window.IdkApp.state.quickConnectTarget = { host: 'play.somniac.me' }; window.IdkApp.actions.playGame(); } else { alert('Launcher not ready'); }">Join Server</button>
          </div>
        </div>

        <div class="news-section">
          <div class="section-header">
            <h2 class="section-title">Latest News</h2>
            <div class="section-decoration">
              <div class="decoration-block"></div>
              <div class="decoration-block"></div>
              <div class="decoration-block"></div>
            </div>
          </div>
          <div class="news-grid" id="mojang-news-grid">
            <div style="padding: 60px 40px; text-align: center; color: var(--text-muted); width: 100%; grid-column: 1 / -1;">
              <div style="font-size:3rem; margin-bottom: 16px;"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg></div>
              <div>Loading Mojang news...</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- SETTINGS VIEW -->
  <div id="view-settings" class="view">
    <div id="btn-close-settings" style="display:none;"></div>

    <div class="settings-content-wrapper">

      <!-- SETTINGS TAB BAR -->
      <div class="settings-tab-bar" id="settings-tab-bar">
        <button class="settings-tab active" data-settings-tab="general">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          <span>General</span>
        </button>
        <button class="settings-tab" data-settings-tab="performance">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
          <span>Performance</span>
        </button>
        <button class="settings-tab" data-settings-tab="launch">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="16 18 22 12 16 6"></polyline>
            <polyline points="8 6 2 12 8 18"></polyline>
          </svg>
          <span>Java & Launch</span>
        </button>
        <button class="settings-tab" data-settings-tab="accessibility">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M12 8v4l3 3M12 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"></path>
          </svg>
          <span>Accessibility</span>
        </button>
        <button class="settings-tab" data-settings-tab="about">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
          <span>About</span>
        </button>
        <div class="settings-tab-indicator" id="settings-tab-indicator"></div>
      </div>

      <!-- GENERAL TAB -->
      <div class="settings-tab-panel active" id="settings-panel-general">
        <div class="settings-page">

          <h3 class="settings-section-title">Theme & Appearance</h3>
          <p class="settings-section-desc">Color scheme, UI mode, and accent customization</p>

          <div class="settings-row">
            <div class="settings-row-label">
              <span>Theme Presets</span>
              <small>Complete color atmospheres</small>
            </div>
            <div class="theme-palette-grid" id="launcher-theme-picker">
              <button type="button" class="theme-choice-card" data-theme="emerald" aria-label="Emerald theme">
                <span class="theme-swatch" style="--swatch:#4cb837;"></span>
                <span class="theme-name">Emerald</span>
              </button>
              <button type="button" class="theme-choice-card" data-theme="amethyst" aria-label="Amethyst theme">
                <span class="theme-swatch" style="--swatch:#8b5cf6;"></span>
                <span class="theme-name">Amethyst</span>
              </button>
              <button type="button" class="theme-choice-card" data-theme="ocean" aria-label="Ocean theme">
                <span class="theme-swatch" style="--swatch:#3b82f6;"></span>
                <span class="theme-name">Ocean</span>
              </button>
              <button type="button" class="theme-choice-card" data-theme="sunset" aria-label="Sunset theme">
                <span class="theme-swatch" style="--swatch:#f97316;"></span>
                <span class="theme-name">Sunset</span>
              </button>
              <button type="button" class="theme-choice-card" data-theme="custom" aria-label="Custom color">
                <span class="theme-swatch custom-swatch" style="--swatch:var(--theme-accent);">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                </span>
                <span class="theme-name">Custom</span>
              </button>
            </div>
          </div>
          <div class="settings-row" id="custom-color-row">
            <div class="settings-row-label">
              <span>Accent Color</span>
              <small>Custom picker for the "Custom" theme</small>
            </div>
            <div class="color-picker-wrap">
              <input type="color" id="custom-accent-picker" class="color-picker-input" value="#4cb837" />
              <span class="color-hex-label" id="custom-accent-hex">#4cb837</span>
            </div>
          </div>
          <div class="settings-row">
            <div class="settings-row-label">
              <span>UI Mode</span>
              <small>Classic layout or advanced sidebar</small>
            </div>
            <div class="pill-switch" id="launcher-ui-modes">
              <button type="button" class="pill-switch-option" data-ui-mode="classic">Classic</button>
              <button type="button" class="pill-switch-option" data-ui-mode="advanced">Advanced</button>
            </div>
          </div>

          <h3 class="settings-section-title">Visual Tuning</h3>
          <p class="settings-section-desc">Border radius, animation, and compact mode</p>

          <div class="settings-row">
            <div class="settings-row-label">
              <span>Border Radius</span>
              <small>How rounded are UI elements</small>
            </div>
            <div class="slider-group">
              <input type="range" id="border-radius-slider" min="0" max="40" step="1" value="10" class="glass-slider" />
              <span class="slider-value" id="border-radius-value">10px</span>
            </div>
          </div>
          <div class="settings-row">
            <div class="settings-row-label">
              <span>Animation Speed</span>
              <small>UI motion multiplier (0 = off)</small>
            </div>
            <div class="slider-group">
              <input type="range" id="animation-speed-slider" min="0" max="2" step="0.1" value="1" class="glass-slider" />
              <span class="slider-value" id="animation-speed-value">1.0x</span>
            </div>
          </div>
          <div class="settings-row">
            <div class="settings-row-label">
              <span>Compact Mode</span>
              <small>Reduced padding for a denser UI</small>
            </div>
            <label class="tg-switch">
              <input type="checkbox" id="compact-mode-toggle" />
              <span class="tg-slider"></span>
            </label>
          </div>

        </div>
      </div>

      <!-- PERFORMANCE TAB -->
      <div class="settings-tab-panel" id="settings-panel-performance">
        <div class="settings-page">

          <h3 class="settings-section-title">Memory & Performance</h3>
          <p class="settings-section-desc">RAM allocation, launcher smoothness, and mod optimization</p>

          <div class="settings-row">
            <div class="settings-row-label">
              <span>Memory Allocation</span>
              <small>RAM for Minecraft (max ~80% of system)</small>
            </div>
            <div class="slider-group">
              <input type="range" id="memory-slider" min="1" max="16" step="1" value="4" class="glass-slider" />
              <span class="slider-value mem-value" id="memory-value-label">4 GB</span>
            </div>
          </div>
          <div class="memory-presets">
            <button class="mem-preset-btn" data-gb="2">2</button>
            <button class="mem-preset-btn" data-gb="4">4</button>
            <button class="mem-preset-btn" data-gb="6">6</button>
            <button class="mem-preset-btn" data-gb="8">8</button>
            <button class="mem-preset-btn" data-gb="12">12</button>
            <button class="mem-preset-btn" data-gb="16">16</button>
          </div>
          <div class="settings-row">
            <div class="settings-row-label">
              <span>Launcher Performance</span>
              <small>Animation & background rendering load</small>
            </div>
            <div class="pill-switch" id="launcher-performance-modes">
              <button class="pill-switch-option" data-performance-mode="quality">Quality</button>
              <button class="pill-switch-option active" data-performance-mode="balanced">Balanced</button>
              <button class="pill-switch-option" data-performance-mode="eco">Eco</button>
            </div>
          </div>
          <div class="settings-row">
            <div class="settings-row-label">
              <span>Performance Boost Pack</span>
              <small>Auto-install Fabric optimization mods (Sodium, Lithium, etc.)</small>
            </div>
            <label class="tg-switch">
              <input type="checkbox" id="auto-optimization" />
              <span class="tg-slider"></span>
            </label>
          </div>

        </div>
      </div>

      <!-- JAVA & LAUNCH TAB -->
      <div class="settings-tab-panel" id="settings-panel-launch">
        <div class="settings-page">

          <h3 class="settings-section-title">Java & Launch</h3>
          <p class="settings-section-desc">Executable path, JVM arguments, and game launch defaults</p>

          <div class="settings-row">
            <div class="settings-row-label">
              <span>Java Path</span>
              <small>Path to javaw.exe (leave empty for system default)</small>
            </div>
            <input type="text" class="glass-input" id="java-path" placeholder="Use System Default" />
          </div>
          <div class="settings-row">
            <div class="settings-row-label">
              <span>Java Arguments</span>
              <small>Global JVM flags for all launches</small>
            </div>
            <input type="text" class="glass-input" id="global-java-args" placeholder="-XX:+UseG1GC -XX:+ParallelRefProcEnabled" />
          </div>
          <div class="settings-row">
            <div class="settings-row-label">
              <span>Window Size</span>
              <small>Default game resolution</small>
            </div>
            <div class="window-size-group">
              <input type="number" class="glass-input sm" id="default-window-width" value="1024" />
              <span class="win-size-x">&times;</span>
              <input type="number" class="glass-input sm" id="default-window-height" value="768" />
              <label class="tg-switch" style="margin-left:8px;">
                <input type="checkbox" id="fullscreen-toggle" />
                <span class="tg-slider"></span>
                <span class="tg-label">Fullscreen</span>
              </label>
            </div>
          </div>
          <div class="settings-row">
            <div class="settings-row-label">
              <span>Hide on Launch</span>
              <small>Auto-hide launcher when game starts</small>
            </div>
            <label class="tg-switch">
              <input type="checkbox" id="hide-launcher-toggle" />
              <span class="tg-slider"></span>
            </label>
          </div>
          <div class="settings-row">
            <div class="settings-row-label">
              <span>In-Game Overlay</span>
              <small>Browser & friends overlay (experimental, requires fullscreen)</small>
            </div>
            <label class="tg-switch">
              <input type="checkbox" id="overlay-toggle" />
              <span class="tg-slider"></span>
            </label>
          </div>
          <div class="settings-row">
            <div class="settings-row-label">
              <span>Custom Minecraft Location</span>
              <small>Override the default game data folder</small>
            </div>
            <div class="folder-row">
              <input type="text" class="glass-input" id="custom-minecraft-path" placeholder="Default Location" readonly />
              <button class="glass-btn" id="btn-browse-minecraft-path">Browse</button>
              <button class="glass-btn danger" id="btn-clear-minecraft-path" title="Reset">&times;</button>
            </div>
          </div>
          <div class="settings-row force-verify-row">
            <div class="settings-row-label">
              <span>Force Verify on Launch</span>
              <small>Re-verify and re-download game files before every launch</small>
            </div>
            <label class="tg-switch">
              <input type="checkbox" id="force-update-toggle" />
              <span class="tg-slider"></span>
            </label>
          </div>

        </div>
      </div>

      <!-- ACCESSIBILITY TAB -->
      <div class="settings-tab-panel" id="settings-panel-accessibility">
        <div class="settings-page">

          <h3 class="settings-section-title">Accessibility</h3>
          <p class="settings-section-desc">Font size, blur, animation reduction, and visual comfort</p>

          <div class="settings-row">
            <div class="settings-row-label">
              <span>Font Scale</span>
              <small>Overall UI text size (80% to 140%)</small>
            </div>
            <div class="slider-group">
              <input type="range" id="font-scale-slider" min="0.8" max="1.4" step="0.05" value="1" class="glass-slider" />
              <span class="slider-value" id="font-scale-value">100%</span>
            </div>
          </div>
          <div class="settings-row">
            <div class="settings-row-label">
              <span>Blur Intensity</span>
              <small>Backdrop blur effect on glass panels</small>
            </div>
            <div class="blur-choice-group">
              <button class="blur-choice-card" data-blur="none">None</button>
              <button class="blur-choice-card" data-blur="light">Light</button>
              <button class="blur-choice-card active" data-blur="medium">Medium</button>
              <button class="blur-choice-card" data-blur="heavy">Heavy</button>
            </div>
          </div>
          <div class="settings-row">
            <div class="settings-row-label">
              <span>Animation Speed</span>
              <small>Reduce motion (0 = no animations)</small>
            </div>
            <div class="slider-group">
              <input type="range" id="access-animation-speed-slider" min="0" max="2" step="0.1" value="1" class="glass-slider" />
              <span class="slider-value" id="access-animation-speed-value">1.0x</span>
            </div>
          </div>
          <div class="settings-row">
            <div class="settings-row-label">
              <span>Compact Mode</span>
              <small>Reduced spacing for less scrolling</small>
            </div>
            <label class="tg-switch">
              <input type="checkbox" id="access-compact-toggle" />
              <span class="tg-slider"></span>
            </label>
          </div>
          <div class="settings-row">
            <div class="settings-row-label">
              <span>Tutorial</span>
              <small>Replay the guided tour of the launcher</small>
            </div>
            <button class="settings-action-btn" id="btn-redo-tutorial">Redo Tutorial</button>
          </div>

        </div>
      </div>

      <!-- ABOUT TAB -->
      <div class="settings-tab-panel" id="settings-panel-about">
        <div class="settings-page">

          <h3 class="settings-section-title">About & Tools</h3>
          <p class="settings-section-desc">Version info, updates, debugging, and quick actions</p>

          <div class="settings-row">
            <div class="settings-row-label">
              <span>Launcher Updates</span>
              <small>Check for new versions</small>
            </div>
            <button class="glass-btn" id="btn-check-launcher-updates">Check for Updates</button>
          </div>
          <div class="settings-row">
            <div class="settings-row-label">
              <span>Open Game Directory</span>
              <small>Browse your Minecraft files</small>
            </div>
            <button class="glass-btn" id="btn-open-folder">Open Folder</button>
          </div>
          <div class="settings-row">
            <div class="settings-row-label">
              <span>Developer Tools</span>
              <small>Chrome DevTools for debugging</small>
            </div>
            <button class="glass-btn" id="btn-toggle-devtools">Open DevTools</button>
          </div>

        </div>
      </div>

    </div>

    <!-- ADVANCED SETTINGS (only visible when body.ui-advanced) -->
    <div class="advanced-settings">

    <div class="advanced-tab-bar">
      <button class="advanced-tab active" data-adv-tab="general">GENERAL</button>
      <button class="advanced-tab" data-adv-tab="background">BACKGROUND</button>
      <button class="advanced-tab" data-adv-tab="advanced">ADVANCED</button>
      <button class="advanced-tab" data-adv-tab="launch">LAUNCH</button>
      <button class="advanced-tab" data-adv-tab="about">ABOUT</button>
      <button class="advanced-tab" data-adv-tab="debug">DEBUG</button>
      <div class="advanced-tab-indicator"></div>
      <button type="button" class="adv-open-dir-link" id="adv-btn-open-folder-top">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        OPEN DIRECTORY
      </button>
    </div>

    <!-- GENERAL -->
    <div class="advanced-tab-panel active" data-adv-panel="general">
      <div class="adv-section">
        <div class="adv-section-header">
          <h3>Language</h3>
          <p>Interface language preference</p>
        </div>
        <select class="adv-select" id="adv-language">
          <option value="en">English</option>
          <option value="ru">Русский</option>
          <option value="es">Español</option>
          <option value="de">Deutsch</option>
          <option value="fr">Français</option>
          <option value="zh">中文</option>
          <option value="ja">日本語</option>
        </select>
      </div>

      <div class="adv-section">
        <div class="adv-section-header">
          <h3>Accent Color</h3>
          <p>Choose a custom accent color for the launcher</p>
        </div>
        <div class="accent-swatch-grid" id="adv-accent-grid">
          <button type="button" class="accent-swatch" data-accent="#ff3b3b" style="--swatch:#ff3b3b" aria-label="Red"></button>
          <button type="button" class="accent-swatch" data-accent="#ff6b3b" style="--swatch:#ff6b3b" aria-label="Orange"></button>
          <button type="button" class="accent-swatch" data-accent="#ff9d3b" style="--swatch:#ff9d3b" aria-label="Warm orange"></button>
          <button type="button" class="accent-swatch" data-accent="#ffeb3b" style="--swatch:#ffeb3b" aria-label="Yellow"></button>
          <button type="button" class="accent-swatch" data-accent="#6bff6b" style="--swatch:#6bff6b" aria-label="Lime"></button>
          <button type="button" class="accent-swatch" data-accent="#3bbaff" style="--swatch:#3bbaff" aria-label="Cyan"></button>
          <button type="button" class="accent-swatch" data-accent="#3b5eff" style="--swatch:#3b5eff" aria-label="Blue"></button>

          <button type="button" class="accent-swatch" data-accent="#9b3bff" style="--swatch:#9b3bff" aria-label="Purple"></button>
          <button type="button" class="accent-swatch" data-accent="#ff3be6" style="--swatch:#ff3be6" aria-label="Pink"></button>
          <button type="button" class="accent-swatch" data-accent="#e63e3e" style="--swatch:#e63e3e" aria-label="Crimson"></button>
          <button type="button" class="accent-swatch" data-accent="#e68a3e" style="--swatch:#e68a3e" aria-label="Amber"></button>
          <button type="button" class="accent-swatch" data-accent="#4cb837" style="--swatch:#4cb837" aria-label="Green"></button>
          <button type="button" class="accent-swatch" data-accent="#8b5cf6" style="--swatch:#8b5cf6" aria-label="Violet"></button>
          <button type="button" class="accent-swatch" data-accent="#3b82f6" style="--swatch:#3b82f6" aria-label="Ocean"></button>
          <button type="button" class="accent-swatch" data-accent="#f97316" style="--swatch:#f97316" aria-label="Sunset"></button>
          <button type="button" class="accent-swatch custom" id="adv-accent-custom" aria-label="Custom color">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          </button>
        </div>
        <div class="accent-custom-row" id="adv-accent-custom-row">
          <input type="color" id="adv-accent-picker" class="accent-picker-input" value="#4cb837" />
          <span class="accent-hex-label" id="adv-accent-hex">#4cb837</span>
        </div>
      </div>

      <div class="adv-section">
        <div class="adv-section-header">
          <h3>UI Mode</h3>
          <p>Switch between Classic and Advanced interface</p>
        </div>
        <div class="pill-switch" id="adv-launcher-ui-modes">
          <button type="button" class="pill-switch-option" data-ui-mode="classic">Classic</button>
          <button type="button" class="pill-switch-option" data-ui-mode="advanced">Advanced</button>
        </div>
      </div>

      <div class="adv-section">
        <div class="adv-section-header">
          <h3>General Preferences</h3>
          <p>Toggle launcher behavior options</p>
        </div>
        <div class="adv-toggles">
          <label class="adv-toggle-row">
            <span>Auto Updates</span>
            <input type="checkbox" id="adv-toggle-updates" />
            <span class="adv-toggle-track"></span>
          </label>
          <label class="adv-toggle-row">
            <span>Discord Presence</span>
            <input type="checkbox" id="adv-toggle-discord" />
            <span class="adv-toggle-track"></span>
          </label>
          <label class="adv-toggle-row">
            <span>Beta Updates</span>
            <input type="checkbox" id="adv-toggle-beta" />
            <span class="adv-toggle-track"></span>
          </label>
          <label class="adv-toggle-row">
            <span>Open Logs After Launch</span>
            <input type="checkbox" id="adv-toggle-logs" />
            <span class="adv-toggle-track"></span>
          </label>
          <label class="adv-toggle-row">
            <span>Hide Window on Launch</span>
            <input type="checkbox" id="adv-toggle-hide" />
            <span class="adv-toggle-track"></span>
          </label>
          <label class="adv-toggle-row">
            <span>Analytics</span>
            <input type="checkbox" id="adv-toggle-analytics" />
            <span class="adv-toggle-track"></span>
          </label>
        </div>
      </div>



      <div class="adv-section">
        <div class="adv-section-header">
          <h3>Visual Tuning</h3>
          <p>Animation speed, font scale, backdrop blur, border radius, and compact mode</p>
        </div>
        <div class="adv-slider-field">
          <div class="adv-slider-field-header">
            <span>Animation Speed</span>
            <span class="adv-slider-field-value" id="adv-animation-speed-value">1.0x</span>
          </div>
          <input type="range" id="adv-animation-speed" min="0" max="2" step="0.1" value="1" class="adv-slider" />
          <div class="adv-slider-range">
            <span>0x</span>
            <span>2x</span>
          </div>
        </div>
        <div class="adv-slider-field">
          <div class="adv-slider-field-header">
            <span>Font Scale</span>
            <span class="adv-slider-field-value" id="adv-font-scale-value">100%</span>
          </div>
          <input type="range" id="adv-font-scale" min="0.8" max="1.4" step="0.05" value="1" class="adv-slider" />
          <div class="adv-slider-range">
            <span>80%</span>
            <span>140%</span>
          </div>
        </div>
        <div class="adv-slider-field">
          <div class="adv-slider-field-header">
            <span>Border Radius</span>
            <span class="adv-slider-field-value" id="adv-border-radius-value">10px</span>
          </div>
          <input type="range" id="adv-border-radius" min="0" max="40" step="1" value="10" class="adv-slider" />
          <div class="adv-slider-range">
            <span>0px</span>
            <span>40px</span>
          </div>
        </div>
        <div class="adv-slider-field">
          <div class="adv-slider-field-header">
            <span>Backdrop Blur</span>
          </div>
          <div class="blur-choice-group" id="adv-blur-choices">
            <button type="button" class="blur-choice-card" data-blur="none">None</button>
            <button type="button" class="blur-choice-card" data-blur="light">Light</button>
            <button type="button" class="blur-choice-card active" data-blur="medium">Medium</button>
            <button type="button" class="blur-choice-card" data-blur="heavy">Heavy</button>
          </div>
        </div>
        <label class="adv-toggle-row" style="margin-top:12px;">
          <span>Compact Mode</span>
          <input type="checkbox" id="adv-compact-mode-toggle" />
          <span class="adv-toggle-track"></span>
        </label>
        <div class="adv-toggle-row">
          <span>Tutorial</span>
          <button type="button" class="settings-action-btn" id="adv-redo-tutorial">Redo Tutorial</button>
        </div>
      </div>

    </div>

    <!-- BACKGROUND -->
    <div class="advanced-tab-panel" data-adv-panel="background">
      <div class="adv-section">
        <div class="adv-section-header">
          <h3>Background Effects</h3>
          <p>Select a dynamic background for the launcher</p>
        </div>
        <div class="bg-effects-grid" id="adv-bg-effects">
          <button class="bg-effect-card active" data-effect="none">
            <div class="bg-effect-preview bg-none"></div>
            <span>None</span>
          </button>
          <button class="bg-effect-card" data-effect="matrix">
            <div class="bg-effect-preview bg-matrix"></div>
            <span>Matrix Rain</span>
          </button>
          <button class="bg-effect-card" data-effect="nebula">
            <div class="bg-effect-preview bg-nebula"></div>
            <span>Nebula Waves</span>
          </button>
          <button class="bg-effect-card" data-effect="liquid">
            <div class="bg-effect-preview bg-liquid"></div>
            <span>Liquid Chrome</span>
          </button>
          <button class="bg-effect-card" data-effect="starfield">
            <div class="bg-effect-preview bg-starfield"></div>
            <span>Starfield</span>
          </button>
          <button class="bg-effect-card" data-effect="particles">
            <div class="bg-effect-preview bg-particles"></div>
            <span>Particles</span>
          </button>
        </div>
      </div>
      <div class="adv-section">
        <div class="adv-section-header">
          <h3>Intensity</h3>
          <p>Control the effect's visual density</p>
        </div>
        <div class="adv-slider-group">
          <span class="adv-slider-label">Low</span>
          <input type="range" id="adv-bg-intensity" min="0" max="200" value="50" class="adv-slider" />
          <span class="adv-slider-label">High</span>
          <span class="adv-slider-value" id="adv-bg-intensity-value">50</span>
        </div>
      </div>

      <!-- Nebula Config -->
      <div class="adv-section" id="adv-bg-nebula-config" style="display:none;">
        <div class="adv-section-header">
          <h3>Nebula Color Scheme</h3>
          <p>Choose a cosmic color palette</p>
        </div>
        <div class="bg-effects-grid" id="adv-nebula-schemes">
          <button class="bg-effect-card bg-scheme-card active" data-scheme="0">
            <div class="bg-effect-preview" style="background:linear-gradient(135deg,#2a1a4a,#1a3a5a,#5a2a3a);"></div>
            <span>Orion</span>
          </button>
          <button class="bg-effect-card bg-scheme-card" data-scheme="1">
            <div class="bg-effect-preview" style="background:linear-gradient(135deg,#5a2a1a,#4a3a1a,#3a2a0a);"></div>
            <span>Crab</span>
          </button>
          <button class="bg-effect-card bg-scheme-card" data-scheme="2">
            <div class="bg-effect-preview" style="background:linear-gradient(135deg,#3a1a4a,#2a2a5a,#1a3a4a);"></div>
            <span>Eagle</span>
          </button>
          <button class="bg-effect-card bg-scheme-card" data-scheme="3">
            <div class="bg-effect-preview" style="background:linear-gradient(135deg,#1a3a4a,#2a4a3a,#1a3a3a);"></div>
            <span>Helix</span>
          </button>
        </div>
      </div>

      <!-- Liquid Chrome Config -->
      <div class="adv-section" id="adv-bg-liquid-config" style="display:none;">
        <div class="adv-section-header">
          <h3>Color Palette</h3>
          <p>Choose an iridescent color base</p>
        </div>
        <div class="bg-effects-grid" id="adv-liquid-schemes">
          <button class="bg-effect-card bg-scheme-card active" data-scheme="0">
            <div class="bg-effect-preview" style="background:linear-gradient(135deg,#1a4a5a,#2a5a6a,#1a4a5a);"></div>
            <span>Teal</span>
          </button>
          <button class="bg-effect-card bg-scheme-card" data-scheme="1">
            <div class="bg-effect-preview" style="background:linear-gradient(135deg,#2a1a5a,#3a2a6a,#2a1a5a);"></div>
            <span>Violet</span>
          </button>
          <button class="bg-effect-card bg-scheme-card" data-scheme="2">
            <div class="bg-effect-preview" style="background:linear-gradient(135deg,#5a1a3a,#6a2a4a,#5a1a3a);"></div>
            <span>Rose</span>
          </button>
          <button class="bg-effect-card bg-scheme-card" data-scheme="3">
            <div class="bg-effect-preview" style="background:linear-gradient(135deg,#1a5a3a,#2a6a4a,#1a5a3a);"></div>
            <span>Emerald</span>
          </button>
        </div>
      </div>

      <!-- Starfield Config -->
      <div class="adv-section" id="adv-bg-starfield-config" style="display:none;">
        <div class="adv-section-header">
          <h3>Sky Elements</h3>
          <p>Toggle real night sky features</p>
        </div>
        <div style="display:flex;flex-direction:column;gap:12px;padding:0 4px;">
          <label class="adv-toggle-row" style="display:flex;align-items:center;gap:10px;cursor:pointer;">
            <input type="checkbox" id="adv-sf-milkyway" checked class="adv-toggle-input" />
            <span>Milky Way Band</span>
          </label>
          <label class="adv-toggle-row" style="display:flex;align-items:center;gap:10px;cursor:pointer;">
            <input type="checkbox" id="adv-sf-galaxy" checked class="adv-toggle-input" />
            <span>Spiral Galaxy</span>
          </label>
          <label class="adv-toggle-row" style="display:flex;align-items:center;gap:10px;cursor:pointer;">
            <input type="checkbox" id="adv-sf-constellations" checked class="adv-toggle-input" />
            <span>Constellations</span>
          </label>
          <label class="adv-toggle-row" style="display:flex;align-items:center;gap:10px;cursor:pointer;">
            <input type="checkbox" id="adv-sf-planet" checked class="adv-toggle-input" />
            <span>Planet</span>
          </label>
        </div>
      </div>
    </div>

    <!-- ADVANCED -->
    <div class="advanced-tab-panel" data-adv-panel="advanced">
      <div class="adv-section">
        <div class="adv-section-header">
          <h3>Launcher Performance</h3>
          <p>Animation & background rendering load</p>
        </div>
        <div class="pill-switch" id="adv-launcher-performance-modes">
          <button type="button" class="pill-switch-option" data-performance-mode="quality">Quality</button>
          <button type="button" class="pill-switch-option active" data-performance-mode="balanced">Balanced</button>
          <button type="button" class="pill-switch-option" data-performance-mode="eco">Eco</button>
        </div>
      </div>

      <div class="adv-section">
        <div class="adv-section-header">
          <h3>Memory Allocation</h3>
          <p>RAM for Minecraft (max ~80% of system)</p>
        </div>
        <div class="adv-slider-field">
          <div class="adv-slider-field-header">
            <span>Allocated RAM</span>
            <span class="adv-slider-field-value" id="adv-memory-value-label">4 GB</span>
          </div>
          <input type="range" id="adv-memory-slider" min="1" max="16" step="1" value="4" class="adv-slider" />
          <div class="adv-slider-range" style="display:flex;gap:4px;justify-content:space-between;margin-top:8px;">
            <button class="mem-preset-btn adv-mem-preset" data-gb="2">2</button>
            <button class="mem-preset-btn adv-mem-preset" data-gb="4">4</button>
            <button class="mem-preset-btn adv-mem-preset" data-gb="6">6</button>
            <button class="mem-preset-btn adv-mem-preset" data-gb="8">8</button>
            <button class="mem-preset-btn adv-mem-preset" data-gb="12">12</button>
            <button class="mem-preset-btn adv-mem-preset" data-gb="16">16</button>
          </div>
        </div>
      </div>

      <div class="adv-section">
        <div class="adv-section-header">
          <h3>Optimization</h3>
          <p>Download throughput and mod optimization</p>
        </div>
        <div class="adv-slider-field">
          <div class="adv-slider-field-header">
            <span>Concurrent Downloads</span>
            <span class="adv-slider-field-value" id="adv-concurrent-dl-value">4</span>
          </div>
          <input type="range" id="adv-concurrent-dl" min="1" max="10" step="1" value="4" class="adv-slider" />
          <div class="adv-slider-range">
            <span>1</span>
            <span>10</span>
          </div>
        </div>
        <div class="adv-slider-field">
          <div class="adv-slider-field-header">
            <span>Concurrent I/O Operations</span>
            <span class="adv-slider-field-value" id="adv-concurrent-io-value">2</span>
          </div>
          <input type="range" id="adv-concurrent-io" min="1" max="8" step="1" value="2" class="adv-slider" />
          <div class="adv-slider-range">
            <span>1</span>
            <span>8</span>
          </div>
        </div>
        <label class="adv-toggle-row" style="margin-top:12px;">
          <span>Performance Boost Pack</span>
          <input type="checkbox" id="adv-auto-optimization" />
          <span class="adv-toggle-track"></span>
        </label>
      </div>

    </div>

    <!-- JAVA & LAUNCH -->
    <div class="advanced-tab-panel" data-adv-panel="launch">
      <div class="adv-section">
        <div class="adv-section-header">
          <h3>Java Runtime</h3>
          <p>Path to javaw.exe and JVM flags applied to every launch</p>
        </div>
        <div class="adv-input-field">
          <label class="adv-input-label" for="adv-java-path">Java Path</label>
          <input type="text" class="adv-input" id="adv-java-path" placeholder="Use System Default" />
        </div>
        <div class="adv-input-field" style="margin-top:10px;">
          <label class="adv-input-label" for="adv-global-java-args">Global Java Arguments</label>
          <input type="text" class="adv-input" id="adv-global-java-args" placeholder="-XX:+UseG1GC -XX:+ParallelRefProcEnabled" />
        </div>
      </div>

      <div class="adv-section">
        <div class="adv-section-header">
          <h3>Game Window</h3>
          <p>Default resolution, fullscreen, and in-game overlay</p>
        </div>
        <div class="adv-slider-field">
          <div class="adv-slider-field-header">
            <span>Window Size</span>
            <span class="adv-slider-field-value" id="adv-window-size-value">1024 x 768</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <input type="number" id="adv-default-window-width" class="adv-input adv-input--sm" min="640" max="7680" value="1024" />
            <span class="adv-slider-label">x</span>
            <input type="number" id="adv-default-window-height" class="adv-input adv-input--sm" min="480" max="4320" value="768" />
          </div>
        </div>
        <div class="adv-toggles" style="margin-top:12px;">
          <label class="adv-toggle-row">
            <span>Launch in Fullscreen</span>
            <input type="checkbox" id="adv-fullscreen-toggle" />
            <span class="adv-toggle-track"></span>
          </label>
          <label class="adv-toggle-row">
            <span>In-Game Overlay</span>
            <input type="checkbox" id="adv-overlay-toggle" />
            <span class="adv-toggle-track"></span>
          </label>
        </div>
      </div>

      <div class="adv-section">
        <div class="adv-section-header">
          <h3>Custom Minecraft Location</h3>
          <p>Override the default game data folder</p>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <input type="text" class="adv-input" id="adv-custom-minecraft-path" placeholder="Default Location" readonly style="flex:1;min-width:0;" />
          <button type="button" class="adv-btn" id="adv-btn-browse-minecraft-path">Browse</button>
          <button type="button" class="adv-btn adv-btn--danger" id="adv-btn-clear-minecraft-path" title="Reset">&times;</button>
        </div>
      </div>
    </div>

    <!-- ABOUT -->
    <div class="advanced-tab-panel" data-adv-panel="about">
      <div class="adv-section">
        <div class="adv-section-header">
          <h3>Launcher</h3>
          <p>Version info, updates, and quick actions</p>
        </div>
        <div class="adv-action-row">
          <div class="adv-action-label">
            <span>Launcher Updates</span>
            <small>Check for new versions</small>
          </div>
          <button type="button" class="adv-btn" id="adv-btn-check-launcher-updates">Check for Updates</button>
        </div>
        <div class="adv-action-row">
          <div class="adv-action-label">
            <span>Open Game Directory</span>
            <small>Browse your Minecraft files</small>
          </div>
          <button type="button" class="adv-btn" id="adv-btn-open-folder">Open Folder</button>
        </div>
        <div class="adv-action-row">
          <div class="adv-action-label">
            <span>Developer Tools</span>
            <small>Chrome DevTools for debugging</small>
          </div>
          <button type="button" class="adv-btn" id="adv-btn-toggle-devtools">Open DevTools</button>
        </div>
      </div>
    </div>

    <!-- DEBUG -->
    <div class="advanced-tab-panel" data-adv-panel="debug">
      <div class="adv-section">
        <div class="adv-section-header">
          <h3>Log Output</h3>
          <p>Real-time launcher debug information</p>
        </div>
        <div class="debug-terminal" id="adv-debug-terminal">
          <div class="debug-line" style="color: #666;">[IDK Launcher] Debug console ready...</div>
          <div class="debug-line" style="color: #666;">[System] Waiting for events...</div>
        </div>
        <div class="debug-actions">
          <button class="adv-btn" id="adv-debug-clear">Clear</button>
          <button class="adv-btn" id="adv-toggle-devtools">DevTools</button>
        </div>
      </div>
    </div>

    </div>
  </div>

  <!-- PROFILE VIEW -->
  <div id="view-profile" class="view">
    <div class="profile-page">
      <div class="profile-page-content">
        <section class="profile-main-stage">
          <div class="profile-stage-grid"></div>
          <div class="profile-stage-character">
            <div class="profile-stage-heading">
              <h1 class="profile-character-name" id="profile-page-username">MUZLIK_GAMER</h1>
            </div>

            <div class="profile-skin-viewer-wrapper" id="profile-skin-stage" style="display:flex; justify-content:center; align-items:center; overflow:hidden;">
              <div class="profile-skin-loading" id="profile-skin-loading">Loading skin…</div>
              <canvas id="profile-skin-canvas"></canvas>
            </div>

            <div class="profile-stage-bar profile-skin-actions">
              <div class="profile-stage-bar-combined">
                <button type="button" class="profile-stage-bar-main-text" id="profile-stage-change-skin">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>
                  Change Skin
                </button>
                <button type="button" class="profile-stage-bar-export-icon" id="profile-stage-export-skin" title="Export Skin">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                </button>
              </div>
            </div>
            <div class="pose-selector" id="pose-selector">
              <button class="pose-btn active" data-pose="idle" title="Idle">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="5" r="2.5"/>
                  <line x1="12" y1="7.5" x2="12" y2="15"/>
                  <line x1="12" y1="10" x2="8" y2="13"/>
                  <line x1="12" y1="10" x2="16" y2="13"/>
                  <line x1="12" y1="15" x2="9" y2="19"/>
                  <line x1="12" y1="15" x2="15" y2="19"/>
                </svg>
                Idle
              </button>
              <button class="pose-btn" data-pose="walking" title="Walking">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="13" cy="4" r="2.5"/>
                  <line x1="13" y1="6.5" x2="10" y2="13"/>
                  <line x1="10" y1="13" x2="7" y2="19"/>
                  <line x1="10" y1="13" x2="14" y2="15"/>
                  <line x1="14" y1="15" x2="16" y2="19"/>
                  <line x1="10" y1="10" x2="16" y2="11"/>
                </svg>
                Walk
              </button>
              <button class="pose-btn" data-pose="running" title="Running">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="14" cy="4" r="2.5"/>
                  <line x1="14" y1="6.5" x2="11" y2="12"/>
                  <line x1="11" y1="12" x2="7" y2="17"/>
                  <line x1="11" y1="12" x2="16" y2="11"/>
                  <line x1="16" y1="11" x2="19" y2="15"/>
                  <line x1="9" y1="9" x2="12" y2="10"/>
                  <line x1="16" y1="11" x2="18" y2="7"/>
                </svg>
                Run
              </button>
              <button class="pose-btn" data-pose="flying" title="Flying">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="4" r="2.5"/>
                  <line x1="12" y1="6.5" x2="12" y2="14"/>
                  <line x1="12" y1="9" x2="6" y2="6"/>
                  <line x1="12" y1="9" x2="18" y2="6"/>
                  <line x1="12" y1="14" x2="8" y2="18"/>
                  <line x1="12" y1="14" x2="16" y2="18"/>
                </svg>
                Fly
              </button>
              <button class="pose-btn" data-pose="wave" title="Wave">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="4" r="2.5"/>
                  <line x1="12" y1="6.5" x2="12" y2="15"/>
                  <line x1="12" y1="15" x2="9" y2="19"/>
                  <line x1="12" y1="15" x2="15" y2="19"/>
                  <line x1="12" y1="8" x2="8" y2="5"/>
                  <path d="M5 3c0 0-2 2-1 4s2 2 1 4"/>
                  <path d="M1 1c0 0-2 2-1 4"/>
                </svg>
                Wave
              </button>
              <button class="pose-btn" data-pose="crouch" title="Crouch">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="4" r="2.5"/>
                  <line x1="12" y1="6.5" x2="12" y2="11"/>
                  <line x1="12" y1="11" x2="7" y2="14"/>
                  <line x1="12" y1="11" x2="17" y2="14"/>
                  <line x1="7" y1="14" x2="5" y2="18"/>
                  <line x1="17" y1="14" x2="19" y2="18"/>
                  <line x1="12" y1="11" x2="10" y2="8"/>
                </svg>
                Crouch
              </button>
              <button class="pose-btn" data-pose="swim" title="Swim">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="3" r="2.5"/>
                  <line x1="12" y1="5.5" x2="12" y2="11"/>
                  <line x1="12" y1="8" x2="7" y2="4"/>
                  <line x1="12" y1="8" x2="17" y2="4"/>
                  <line x1="12" y1="11" x2="7" y2="16"/>
                  <line x1="12" y1="11" x2="16" y2="14"/>
                  <path d="M4 17c2 0 3-1 5-1s3 1 5 1 3-1 5-1"/>
                </svg>
                Swim
              </button>
            </div>
          </div>
        </section>

        <aside class="profile-sidebar">
          <!-- Identity -->
          <div class="profile-sidebar-identity">
            <div class="profile-sidebar-avatar-wrap">
              <canvas id="profile-sidebar-avatar" width="52" height="52"></canvas>
            </div>
            <div class="profile-sidebar-identity-info">
              <span class="profile-sidebar-identity-name" id="profile-sidebar-name">PLAYER</span>
              <span class="profile-sidebar-identity-acct" id="profile-sidebar-acct">Offline account</span>
            </div>
          </div>

          <!-- Statistics -->
          <section class="profile-stats-section">
            <h4 class="profile-section-title">Statistics</h4>
            <div class="profile-stat-mini-list">
              <div class="profile-stat-mini">
                <span class="profile-stat-mini-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                </span>
                <div class="profile-stat-mini-content">
                  <span class="profile-stat-mini-value" id="profile-stat-playtime">0.0h</span>
                  <span class="profile-stat-mini-label">Playtime</span>
                </div>
              </div>
              <div class="profile-stat-mini">
                <span class="profile-stat-mini-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                </span>
                <div class="profile-stat-mini-content">
                  <span class="profile-stat-mini-value" id="profile-stat-account-type">Offline</span>
                  <span class="profile-stat-mini-label">Account</span>
                </div>
              </div>
              <div class="profile-stat-mini">
                <span class="profile-stat-mini-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
                </span>
                <div class="profile-stat-mini-content">
                  <span class="profile-stat-mini-value" id="profile-stat-modpacks">0</span>
                  <span class="profile-stat-mini-label">Modpacks</span>
                </div>
              </div>
              <div class="profile-stat-mini">
                <span class="profile-stat-mini-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg>
                </span>
                <div class="profile-stat-mini-content">
                  <span class="profile-stat-mini-value" id="profile-stat-achievements">0</span>
                  <span class="profile-stat-mini-label">Achievements</span>
                </div>
              </div>
            </div>
          </section>

          <!-- Quick Actions -->
          <section class="profile-actions-section">
            <h4 class="profile-section-title">Quick actions</h4>
            <button type="button" class="profile-quick-action" id="profile-btn-settings">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m5.08 5.08l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m5.08-5.08l4.24-4.24"></path></svg>
              <span>Launcher settings</span>
            </button>
          </section>

          <!-- Friends List Section -->
          <section class="profile-friends-section">
            <h4 class="profile-section-title">Friends</h4>
            <div class="profile-friends-list" id="profile-friends-list">
              <div class="profile-friends-empty">No friends online</div>
            </div>
          </section>

          <!-- Logout Button -->
          <button type="button" class="profile-quick-action profile-action-danger" id="profile-btn-logout">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            <span>Log out</span>
          </button>
        </aside>
      </div>
    </div>
  </div>

  <!-- MODS VIEW -->
  <div id="view-mods" class="view">
    <div id="btn-close-mods" style="display:none;"></div>

    <div class="mods-content-wrapper">
      <div class="mods-page-header">
        <h2 class="view-title">Modpack Manager</h2>
        <div class="mods-header-actions">
          <button class="create-modpack-btn" id="btn-browse-modpacks">Browse Modpacks</button>
          <button class="create-modpack-btn" id="btn-import-modpack">Import Zip</button>
          <button class="create-modpack-btn" id="btn-new-modpack">+ New Modpack</button>
        </div>
      </div>
      <div class="mods-container">
        <div class="modpacks-sidebar">
          <div class="modpacks-sidebar-header">
            <p class="sidebar-label">YOUR MODPACKS</p>
            <div class="modpacks-sidebar-actions">
            <button class="mp-action-btn back" id="btn-refresh-profiles" title="Refresh all profiles from disk">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
            </button>
            <button class="mp-action-btn back" id="btn-back-modpacks" title="Clear selection">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
              Back
            </button>
            </div>
          </div>
          <div class="modpacks-list" id="modpacks-list"></div>
        </div>
        <div class="modpack-detail" id="modpack-detail">
          <div class="no-modpack-msg" id="no-modpack-msg">

            <div class="mp-welcome">
              <div class="mp-welcome-left">
                <div class="mp-hero-card">
                  <div class="mp-hero-icon">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
                  </div>
                  <div class="mp-hero-text">
                    <h2>Set up your modpack</h2>
                    <p>Download a Minecraft version, then create or import a modpack to get started.</p>
                  </div>
                </div>

                <div class="mp-onboard-grid">
                  <div class="mp-onboard-card" id="mp-version-wizard">
                    <div class="mp-onboard-num">1</div>
                    <div class="mp-onboard-content">
                      <h3>Download a Version</h3>
                      <p>Choose a Minecraft version to install</p>
                    </div>
                    <div class="mp-version-download-grid" id="mp-version-download-grid"></div>
                    <button class="mp-dl-btn" id="btn-show-all-versions">Show all versions…</button>
                  </div>

                  <div class="mp-onboard-card">
                    <div class="mp-onboard-num">2</div>
                    <div class="mp-onboard-content">
                      <h3>Create or Import</h3>
                      <p>Start a new modpack or import an existing one</p>
                    </div>
                    <div class="mp-onboard-actions">
                      <button class="mp-onboard-action" id="btn-new-modpack-wizard">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        <span>New Modpack</span>
                      </button>
                      <button class="mp-onboard-action" id="btn-import-modpack-wizard">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                        <span>Import Zip</span>
                      </button>
                      <button class="mp-onboard-action" id="btn-browse-modpacks-wizard">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        <span>Browse</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div class="mp-welcome-right">
                <div class="mp-trending-panel">
                  <div class="mp-trending-head">
                    <span class="mp-trending-label">Trending on</span>
                    <span class="mp-trending-brand">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6.489 0H0l2.286 4.5H8.48L6.49 0h-.001zM17.51 0H11.02l1.99 4.5h6.494L17.51 0zM0 6.75l5.614 12.5H9.64L4.025 6.75H0zm19.975 0H15.95L10.337 19.25h4.025L19.975 6.75zm-9.988 0l5.613 12.5H9.988L4.374 6.75h5.613z"/></svg>
                      CurseForge
                    </span>
                  </div>
                  <div class="trending-modpacks-grid" id="trending-mods-grid">
                    <div class="mp-loading-placeholder">Loading modpacks...</div>
                  </div>
                </div>
              </div>
            </div>

          </div>
          <div class="modpack-content" id="modpack-content">
            <div class="modpack-content-header">
              <div style="display:flex;align-items:center;gap:16px;flex:1;">
                <div id="modpack-icon-display" title="Click to change icon" style="width:80px;height:80px;border-radius:0px;background:transparent;display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;border:3px solid var(--theme-accent);transition:all 0.2s;box-shadow:inset 0 2px 0 rgba(255,255,255,0.1), inset 0 -2px 0 rgba(0,0,0,0.3);">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.8;color:var(--theme-accent);"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
                </div>
                <div style="flex:1;">
                  <h2 id="modpack-name-display" style="font-size:1.75rem;margin-bottom:2px;font-family:var(--font-title);font-weight:900;letter-spacing:1px;color:#ffffff;text-shadow:2px 2px 0 rgba(0,0,0,0.5);">Modpack</h2>
                  <p id="modpack-meta-display" style="font-size:0.8125rem;color:#a0a0a0;margin-bottom:12px;font-weight:600;font-family:var(--font-title);">MC 1.20.4 &middot; Fabric</p>
                  <div class="mp-stats-row">
                    <div class="mp-stat">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color:var(--theme-accent);"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path></svg>
                      <span id="mp-stat-version">1.20.4</span>
                    </div>
                    <div class="mp-stat">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color:var(--theme-accent);"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"></path></svg>
                      <span id="mp-stat-playtime">0h played</span>
                    </div>
                    <div class="mp-stat">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color:var(--theme-accent);"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
                      <span id="mp-stat-loader">Fabric</span>
                    </div>
                    <div class="mp-stat">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                      <span id="mp-stat-achievements">0 Achievements</span>
                    </div>
                  </div>
                </div>
              </div>
              <div class="modpack-header-actions">
                <div class="mp-action-icon-row">
                  <button class="mp-action-btn icon-btn" id="btn-export-modpack" title="Export Modpack"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg></button>
                  <button class="mp-action-btn icon-btn" id="btn-delete-modpack" title="Delete"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14H6L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4h6v2"></path></svg></button>
                  <button class="mp-action-btn icon-btn" id="btn-modpack-settings" title="Settings"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="3"></circle><path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m5.08 5.08l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m5.08-5.08l4.24-4.24"></path></svg></button>
                </div>
                <button class="mp-action-btn play" id="btn-play-modpack">PLAY</button>
              </div>
            </div>
            <div class="mp-tabs">
              <button class="mp-tab active" data-tab="mods">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
                Mods <span class="mp-tab-count" id="mod-count">0</span>
              </button>
              <button class="mp-tab" data-tab="resourcepacks">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                Resource Packs <span class="mp-tab-count" id="rp-count">0</span>
              </button>
              <button class="mp-tab" data-tab="shaders">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><path d="M12 12l-4-2.3v4.6l4 2.3 4-2.3v-4.6l-4 2.3z" fill="currentColor" opacity="0.3"></path></svg>
                Shaders <span class="mp-tab-count" id="shader-count">0</span>
              </button>
              <div class="mp-tabs-spacer"></div>
              <button class="mp-action-btn browse" id="btn-check-updates" onclick="window.handleCheckUpdatesClick?.();">Check Updates</button>
              <button class="mp-action-btn browse" id="btn-browse-mods" data-tab="mods">+ Add Mods</button>
              <button class="mp-action-btn browse" id="btn-browse-rp" data-tab="resourcepacks" style="display:none;">+ Add Resource Packs</button>
              <button class="mp-action-btn browse" id="btn-browse-shaders" data-tab="shaders" style="display:none;">+ Add Shaders</button>
            </div>
            <div class="mp-tab-content active" id="tab-mods">
              <div class="mp-scroll-area">
                <div class="mods-grid" id="installed-mods-list"></div>
              </div>
            </div>
            <div class="mp-tab-content" id="tab-resourcepacks">
              <div class="mp-scroll-area">
                <div class="mods-grid" id="installed-rp-list"></div>
              </div>
            </div>
            <div class="mp-tab-content" id="tab-shaders">
              <div class="mp-scroll-area">
                <div class="mods-grid" id="installed-shaders-list"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="mod-browser" id="mod-browser">
        <div class="mod-browser-header">
          <h3 id="browser-title">Browse Mods</h3>
          <div class="mod-browser-header-actions">
            <div class="provider-pill-group" id="provider-pill-group">
              <button class="provider-pill active" data-provider="modrinth" id="pill-modrinth">Modrinth</button>
              <button class="provider-pill" data-provider="curseforge" id="pill-curseforge">CurseForge</button>
            </div>
            <button class="mod-browser-close" id="btn-close-browser">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
        <div class="browser-body">
          <div class="browser-main">
            <div class="browser-search-bar">
              <svg class="browser-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <input type="text" class="clean-input" id="mod-search" placeholder="Search mods..." />
              <div id="pagination-controls" class="browser-pagination-bar"></div>
            </div>
            <div class="browser-results" id="mod-browser-results"></div>
          </div>
          <div class="browser-sidebar" id="browser-sidebar">
            <div class="browser-filter-section" id="section-category">
              <h4 class="browser-filter-title">Category</h4>
              <div class="browser-filter-options" id="filter-category"></div>
            </div>
            <div class="browser-filter-section" id="section-resolution" style="display:none">
              <h4 class="browser-filter-title">Resolution</h4>
              <div class="browser-filter-options" id="filter-resolution"></div>
            </div>
            <div class="browser-filter-section">
              <h4 class="browser-filter-title">Sort By</h4>
              <select class="clean-select" id="filter-sort">
                <option value="relevance">Relevance</option>
                <option value="downloads">Most Downloads</option>
                <option value="updated">Recently Updated</option>
                <option value="follows">Most Follows</option>
              </select>
            </div>
            <div class="browser-filter-section" id="section-loader">
              <h4 class="browser-filter-title">Loader</h4>
              <div class="browser-filter-options" id="filter-loader"></div>
            </div>
            <div class="browser-filter-section">
              <h4 class="browser-filter-title">Minecraft Version</h4>
              <select class="clean-select" id="filter-version"></select>
            </div>
            <button class="browser-filter-clear" id="btn-clear-filters">Clear Filters</button>
          </div>
        </div>
      </div>
      <div class="mp-create-modal" id="mp-create-modal" data-modal>
        <div class="mp-create-box">
          <h3>New Modpack</h3>
          <div class="mp-create-body">
            <div class="icon-picker" id="new-mp-icon-picker" title="Select custom icon">
              <div class="icon-picker-placeholder"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg></div>
              <input type="file" accept="image/*" class="icon-picker-input" id="new-mp-icon-input" />
            </div>
            <input type="hidden" id="new-mp-icon" value="" />
            <div class="mp-create-fields">
              <input class="clean-input" id="new-mp-name" placeholder="Modpack name..." />
              <div class="mp-create-selects">
                <select class="clean-select" id="new-mp-version"></select>
                <select class="clean-select" id="new-mp-loader"><option value="Fabric">Fabric</option><option value="Forge">Forge</option><option value="NeoForge">NeoForge</option><option value="Quilt">Quilt</option><option value="Vanilla">Vanilla</option></select>
              </div>
            </div>
          </div>
          <div class="mp-create-actions">
            <button class="submit-btn" id="btn-confirm-create-mp">Create</button>
            <button class="modal-btn cancel" id="btn-cancel-create-mp">Cancel</button>
          </div>
        </div>
      </div>

      <div class="mp-settings-modal" id="mp-settings-modal" data-modal>
        <div class="mp-settings-box">
          <div class="mp-settings-header">
            <h3>Modpack Settings</h3>
            <button class="mp-settings-close" id="btn-close-mp-settings">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="mp-settings-content">
            <div style="display:flex;gap:16px;align-items:center;">
              <div class="icon-picker" id="mp-settings-icon-picker" title="Select custom icon">
                <div class="icon-picker-placeholder"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg></div>
                <input type="file" accept="image/*" class="icon-picker-input" id="mp-settings-icon-input" />
              </div>
              <input type="hidden" id="mp-settings-icon" value="" />
              <div class="mp-settings-section" style="flex:1;">
                <label>Modpack Name</label>
                <input type="text" class="clean-input" id="mp-settings-name" placeholder="Modpack name..." style="text-align:left;" />
              </div>
            </div>

            <div class="mp-settings-section">
              <label>Description</label>
              <textarea class="clean-input" id="mp-settings-description" placeholder="Add a description for this modpack..." style="text-align:left; min-height:80px; resize:vertical;"></textarea>
            </div>

            <div class="mp-settings-section">
              <label>Minecraft Version</label>
              <select class="clean-select" id="mp-settings-version"></select>
            </div>

            <div class="mp-settings-section">
              <label>Mod Loader</label>
              <select class="clean-select" id="mp-settings-loader">
                <option value="Vanilla">Vanilla</option>
                <option value="Fabric">Fabric</option>
                <option value="Forge">Forge</option>
                <option value="NeoForge">NeoForge</option>
                <option value="Quilt">Quilt</option>
              </select>
            </div>

            <div class="mp-settings-section">
              <label>Loader Version</label>
              <input type="text" class="clean-input" id="mp-settings-loader-version" placeholder="Auto-detected" style="text-align:left;" />
            </div>

            <div class="mp-settings-section">
              <label>Java Arguments</label>
              <input type="text" class="clean-input" id="mp-settings-java-args" placeholder="e.g., -XX:+UseG1GC -XX:+ParallelRefProcEnabled" style="text-align:left; font-size:0.6875rem;" />
              <small style="color:var(--text-muted); display:block; margin-top:4px;">Advanced JVM arguments for this modpack</small>
            </div>

            <div class="mp-settings-section">
              <label>Game Window Size</label>
              <div style="display:flex; gap:8px;">
                <input type="number" class="clean-input" id="mp-settings-width" placeholder="Width" style="text-align:center; flex:1;" />
                <span style="display:flex; align-items:center; color:var(--text-muted);">&times;</span>
                <input type="number" class="clean-input" id="mp-settings-height" placeholder="Height" style="text-align:center; flex:1;" />
              </div>
            </div>

            <div class="mp-settings-actions">
              <button class="submit-btn" id="btn-save-mp-settings" style="flex:1;">Save Changes</button>
              <button class="modal-btn" id="btn-cancel-mp-settings" style="flex:1;">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Version Download Modal -->
  <div class="mp-create-modal" id="mp-all-versions-modal" data-modal>
    <div class="mp-create-box" style="width:480px;max-height:80vh;overflow-y:auto;">
      <h3>All Minecraft Versions</h3>
      <div style="display:flex;gap:8px;margin-bottom:12px;">
        <button class="pill-switch-option active" id="mp-dl-tab-release" data-dl-tab="release">Release</button>
        <button class="pill-switch-option" id="mp-dl-tab-snapshot" data-dl-tab="snapshot">Snapshots</button>
        <button class="pill-switch-option" id="mp-dl-tab-old" data-dl-tab="old">Historical</button>
      </div>
      <div class="mods-grid" id="mp-all-version-list" style="max-height:400px;overflow-y:auto;">
        <!-- Injected by JS -->
      </div>
      <div style="display:flex;gap:10px;margin-top:12px;">
        <button class="modal-btn" id="btn-close-all-versions" style="flex:1;">Close</button>
      </div>
    </div>
  </div>

  <!-- LAUNCH OVERLAY -->
  <div class="launch-overlay" id="launch-overlay" data-modal data-modal-noncloseable>
    <div class="launch-overlay-card">
      <div class="launch-card-header">
        <img src="./loading.gif" class="launch-spinner-gif" alt="Loading...">
        <div class="launch-status" id="launch-status">Preparing game...</div>
        <div class="launch-card-controls">
          <button type="button" class="launch-icon-btn" id="btn-minimize-launch"
                  data-action="minimize" title="Minimize (keep using the launcher)" aria-label="Minimize launch overlay">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
          <button type="button" class="launch-icon-btn" id="btn-restore-launch"
                  data-action="restore" title="Expand" aria-label="Expand launch overlay" style="display:none;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
        </div>
      </div>
      <div class="launch-bar">
        <div class="launch-fill" id="launch-fill"></div>
      </div>
      <div class="launch-card-footer">
        <span class="launch-hint">You can keep using the launcher while this runs.</span>
        <button class="modal-btn" id="btn-cancel-launch" style="padding:8px 12px;">Cancel</button>
      </div>
    </div>
  </div>

  <!-- MINI INDICATOR (shown when launch overlay is minimized) -->
  <div class="launch-mini-indicator" id="launch-mini-indicator" role="button" tabindex="0" title="Restore launch overlay" aria-label="Restore launch overlay">
    <span class="launch-mini-spinner" aria-hidden="true"></span>
    <span class="launch-mini-text" id="launch-mini-text">Launching…</span>
    <button type="button" class="launch-mini-close" id="btn-mini-close" title="Hide indicator (launch continues in background)" aria-label="Hide indicator">×</button>
  </div>

  <!-- ERROR MODAL -->
  <div class="custom-modal" id="error-modal" data-modal>
    <div class="modal-content">
      <div class="modal-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
      </div>
      <h3>Launch Error</h3>
      <p id="error-message">An error occurred.</p>
      <button class="modal-btn" id="btn-close-modal">Dismiss</button>
    </div>
  </div>

  <!-- WARNING TOAST -->
  <div class="warning-toast" id="warning-toast">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
    <span id="warning-toast-msg"></span>
  </div>

  <!-- UPDATE MODAL -->
  <div class="custom-modal" id="update-modal" data-modal>
    <div class="modal-content update-box">
      <div class="modal-icon update-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path></svg>
      </div>
      <h3 id="update-modal-title">New Update Available!</h3>
      <p id="update-version-info">A new update is available.</p>
      <div class="update-notes-container" id="update-notes">
        <!-- Injected release notes -->
      </div>
      <div id="update-progress-container" style="display:none;width:100%;margin-top:15px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:0.75rem;color:var(--text-muted);">
          <span id="update-progress-text">Downloading...</span>
          <span id="update-progress-percent">0%</span>
        </div>
        <div style="width:100%;height:6px;background:var(--bg-tertiary);border-radius:3px;overflow:hidden;">
          <div id="update-progress-bar" style="height:100%;width:0%;background:var(--accent);border-radius:3px;transition:width 0.3s;"></div>
        </div>
      </div>
      <div style="display:flex;gap:10px;margin-top:20px;width:100%;">
        <button class="submit-btn" id="btn-download-update" style="flex:1;">Download & Install</button>
        <button class="submit-btn" id="btn-install-update" style="flex:1;display:none;">Install & Restart</button>
        <button class="modal-btn" id="btn-ignore-update" style="flex:1;">Later</button>
      </div>
    </div>
  </div>

  <!-- FRIENDS SIDEBAR BACKDROP — click outside the sidebar closes it -->
  <div class="friends-sidebar-backdrop" id="friends-sidebar-backdrop"></div>

  <!-- FRIENDS SIDEBAR -->
  <div class="friends-sidebar" id="friends-sidebar">
    <div class="friends-sidebar-header">
      <h3>IDK CONNECT <span style="font-size:0.625rem; color: var(--text-dim); font-weight: 600; vertical-align: middle; margin-left: 8px; letter-spacing: 1px; text-transform: uppercase; opacity: 0.6; background: rgba(var(--theme-accent-rgb), 0.1); padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(var(--theme-accent-rgb), 0.15);">Beta</span></h3>
      <button class="friends-sidebar-close" id="btn-friends-sidebar-close">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>

    <div class="friends-sidebar-content">
      <!-- PORTAL PANEL (WHEN NOT AUTHENTICATED WITH IDK SYSTEM) -->
      <div id="friends-auth-panel" class="friends-auth-panel">
        <p class="friends-auth-welcome">
          Connect to <strong>IDK Network</strong> to add friends, sync presence, and join multiplayer worlds with a single click!
        </p>

        <div class="friends-auth-tabs">
          <button class="friends-auth-tab active" id="tab-friends-login">LOGIN</button>
          <button class="friends-auth-tab" id="tab-friends-register">REGISTER</button>
        </div>

        <div class="friends-auth-form">
          <div class="friends-auth-error" id="friends-auth-error">Error message here</div>
          <input type="text" class="clean-input" id="friends-auth-username" placeholder="IDK Username..." />
          <input type="email" class="clean-input" id="friends-auth-email" placeholder="Email Address..." style="display: none; margin-top: 10px;" />
          <input type="password" class="clean-input" id="friends-auth-password" placeholder="Password..." style="margin-top: 10px;" />
          <input type="text" class="clean-input" id="friends-auth-otp" placeholder="6-digit OTP Code" style="display: none; margin-top: 10px; text-align: center; letter-spacing: 2px;" maxlength="6" />
          <button class="submit-btn" id="btn-friends-auth-submit" style="margin-top: 10px;">Connect Account</button>
        </div>
      </div>

      <!-- MAIN PANEL (WHEN AUTHENTICATED WITH IDK SYSTEM) -->
      <div id="friends-main-panel" class="friends-auth-panel" style="display:none;">
        <!-- Identity Card -->
        <div class="friends-identity-card">
          <div class="friends-identity-info">
            <div class="friends-identity-avatar">
              <canvas id="friends-my-avatar" width="28" height="28" style="image-rendering:pixelated;width:100%;height:100%;"></canvas>
            </div>
            <div class="friends-identity-name">
              <h4 id="friends-my-username">Username</h4>
              <span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block;vertical-align:middle;margin-right:4px;">
                  <circle cx="12" cy="12" r="10"></circle>
                </svg>
                Connected
              </span>
            </div>
          </div>
          <button class="friends-identity-disconnect" id="btn-friends-disconnect" title="Disconnect Account">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          </button>
        </div>

        <!-- Share LAN World Card -->
        <div class="friends-share-card" id="friends-share-card">
          <h4>
            <!-- Minecraft-style signal/antenna icon for LAN hosting -->
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 12.55a11 11 0 0 1 14.08 0"></path>
              <path d="M1.42 9a16 16 0 0 1 21.16 0"></path>
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
              <line x1="12" y1="20" x2="12.01" y2="20"></line>
            </svg>
            Host LAN World
          </h4>
          <p id="friends-share-instructions">Open your Minecraft singleplayer world, click "Open to LAN", then enter the port below to invite your friends!</p>

          <div class="friends-share-input-row" id="friends-share-input-row">
            <input type="number" class="clean-input" id="friends-share-port" placeholder="LAN Port (e.g. 54321)" min="1024" max="65535" />
            <button class="friends-share-btn" id="btn-friends-share">Share</button>
            <button class="friends-share-btn stop-sharing" id="btn-friends-share-cancel" style="display:none;">Cancel</button>
          </div>

          <div class="friends-share-tunnel-link" id="friends-share-tunnel-link" style="display:none;" title="Click to copy IP address">
            tcp://...
          </div>

          <!-- FRPC Downloader Progress Panel -->
          <div id="frpc-progress-panel" style="display:none;">
            <div>
              <span id="frpc-status-text">Downloading FRPC...</span>
              <span id="frpc-percent-text">0%</span>
            </div>
            <div class="frpc-progress-bar">
              <div class="frpc-progress-fill" id="frpc-progress-fill"></div>
            </div>
          </div>
        </div>

        <!-- Pending Friend Requests -->
        <div class="friends-requests-section" id="friends-requests-section" style="display:none;">
          <span class="friends-requests-title">Friend Requests</span>
          <div id="friends-requests-list" class="friends-list-container">
            <!-- Dynamic requests -->
          </div>
        </div>

        <!-- Add Friend -->
        <div class="friends-requests-section">
          <span class="friends-requests-title">Add Friend</span>
          <div class="friends-add-row">
            <input type="text" class="clean-input" id="friends-add-username" placeholder="Friend's username..." />
            <button class="friends-add-btn" id="btn-friends-add" title="Send Friend Request">
              <!-- Minecraft-style add player icon -->
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
                <line x1="19" y1="8" x2="19" y2="14"></line>
                <line x1="22" y1="11" x2="16" y2="11"></line>
              </svg>
            </button>
          </div>
        </div>

        <!-- Friends List -->
        <div class="friends-list-section">
          <span class="friends-list-header">My Friends</span>
          <div id="friends-list" class="friends-list-container">
            <div class="friends-list-empty">Your friends list is empty.</div>
          </div>
        </div>
      </div>

      <!-- CHAT PANEL (WHEN CHATTING WITH A FRIEND) -->
      <div id="friends-chat-panel" class="friends-chat-panel" style="display:none; flex-direction:column; height: 100%;">
        <!-- Chat Header -->
        <div class="friends-chat-header">
          <button class="friends-chat-back" id="btn-friends-chat-back" title="Back to Friends List">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </button>
          <div class="friends-chat-info">
            <div class="friend-avatar" style="width:24px;height:24px;">
              <canvas id="friends-chat-avatar" width="24" height="24" style="image-rendering:pixelated;width:100%;height:100%;"></canvas>
            </div>
            <div class="friend-info">
              <strong id="friends-chat-name" style="font-size:0.7812rem;">Friend Name</strong>
              <span id="friends-chat-status" class="friend-status-text" style="font-size:0.5625rem;">Online</span>
            </div>
          </div>
        </div>

        <!-- Scrollable Messages Area -->
        <div id="friends-chat-messages" class="friends-chat-messages">
          <!-- Dynamically populated messages -->
        </div>

        <!-- Chat Input Form -->
        <div class="friends-chat-input-row">
          <input type="text" class="clean-input" id="friends-chat-input" placeholder="Type a message..." maxlength="500" />
          <button class="friends-chat-send-btn" id="btn-friends-chat-send" title="Send Message">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- MOD UPDATE CHECKER MODAL -->
  <div class="custom-modal" id="mod-updates-modal" data-modal>
    <div class="modal-content mod-updates-modal-content">
      <div class="updates-modal-header">
        <div>
          <span class="updates-kicker">Modpack maintenance</span>
          <h3>Mod Updates</h3>
        </div>
        <button class="mp-settings-close" id="btn-close-mod-updates">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div id="mod-updates-content">
        <div class="updates-empty">Checking for updates...</div>
      </div>
    </div>
  </div>

  <!-- CHANGELOG VIEWER MODAL -->
  <div class="custom-modal" id="changelog-modal" data-modal>
    <div class="modal-content" style="max-width: 700px; max-height: 80vh; overflow-y: auto;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h3 id="changelog-title" style="margin: 0; font-size:1.125rem; font-weight: 700;">Changelog</h3>
        <button class="mp-settings-close" id="btn-close-changelog">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div id="changelog-content" style="color: white;">
        <div style="text-align: center; padding: 20px; color: #a0a0a0;">Loading changelog...</div>
      </div>
    </div>
  </div>

  <!-- CRASH LOG ANALYZER MODAL -->
  <div class="custom-modal" id="crash-analyzer-modal" data-modal>
    <div class="modal-content" style="max-width: 700px; max-height: 80vh; overflow-y: auto;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h3 style="margin: 0; font-size:1.125rem; font-weight: 700;">Crash Log Analyzer</h3>
        <button class="mp-settings-close" id="btn-close-crash-analyzer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px; font-size:0.8125rem; font-weight: 600; color: var(--theme-accent); text-transform: uppercase;">Paste Crash Log</label>
        <textarea id="crash-log-input" class="clean-input" placeholder="Paste your crash log here..." style="width: 100%; min-height: 150px; resize: vertical; text-align: left; font-family: monospace; font-size:0.6875rem;"></textarea>
      </div>
      <button class="submit-btn" id="btn-analyze-crash" style="width: 100%; margin-bottom: 16px;">Analyze Crash Log</button>
      <div id="crash-analysis-result" style="color: white;">
        <!-- Analysis results will be displayed here -->
      </div>
    </div>
  </div>

  <!-- DEPENDENCY RESOLVER MODAL -->
  <div class="custom-modal" id="dependencies-modal" data-modal>
    <div class="modal-content" style="max-width: 600px; max-height: 80vh; overflow-y: auto;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h3 style="margin: 0; font-size:1.125rem; font-weight: 700;">Missing Dependencies</h3>
        <button class="mp-settings-close" id="btn-close-dependencies">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div id="dependencies-content" style="color: white;">
        <div style="text-align: center; padding: 20px; color: #a0a0a0;">Scanning for dependencies...</div>
      </div>
    </div>
  </div>

  <!-- DOWNLOAD CONFIRMATION MODAL -->
  <div class="custom-modal" id="dl-confirm-modal" data-modal>
    <div class="modal-content" style="max-width: 400px;">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px;">
        <div id="dl-confirm-icon-wrap" style="width:44px;height:44px;border-radius:8px;background:rgba(255,255,255,0.04);flex-shrink:0;display:flex;align-items:center;justify-content:center;overflow:hidden;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--theme-accent);"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
        </div>
        <div style="min-width:0;">
          <h3 id="dl-confirm-name" style="margin:0 0 3px;font-size:0.9375rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Download Modpack?</h3>
          <p style="margin:0;font-size:0.6875rem;color:var(--text-muted);">Import this modpack into your collection.</p>
        </div>
      </div>
      <div style="display:flex;gap:10px;">
        <button class="modal-btn" id="btn-dl-confirm-cancel" style="flex:1;">Cancel</button>
        <button class="submit-btn" id="btn-dl-confirm-start" style="flex:2;">Download</button>
      </div>
    </div>
  </div>

  <!-- DOWNLOAD DETAIL PANEL -->
  <div class="download-detail-panel" id="download-detail-panel">
    <div class="ddp-header">
      <span class="ddp-title" id="ddp-title">Downloading Modpack</span>
      <button type="button" class="ddp-close" id="btn-ddp-close" aria-label="Close download panel">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="ddp-body">
      <div class="ddp-status" id="ddp-status">Preparing...</div>
      <div class="ddp-progress-bar">
        <div class="ddp-progress-fill" id="ddp-progress-fill"></div>
      </div>
      <div class="ddp-current-item" id="ddp-current-item"></div>
      <div class="ddp-metrics">
        <div class="ddp-metric">
          <span class="ddp-metric-label">Progress</span>
          <span class="ddp-metric-value" id="ddp-percent">0%</span>
        </div>
        <div class="ddp-metric">
          <span class="ddp-metric-label">Speed</span>
          <span class="ddp-metric-value" id="ddp-speed">—</span>
        </div>
        <div class="ddp-metric">
          <span class="ddp-metric-label">ETA</span>
          <span class="ddp-metric-value" id="ddp-eta">—</span>
        </div>
      </div>
    </div>
    <div class="ddp-actions">
      <button class="ddp-btn ddp-cancel" id="btn-ddp-cancel">Cancel</button>
      <button class="ddp-btn ddp-retry" id="btn-ddp-retry" style="display:none;">Retry</button>
      <button class="ddp-btn ddp-dismiss" id="btn-ddp-dismiss" style="display:none;">Dismiss</button>
    </div>
  </div>

`;
}

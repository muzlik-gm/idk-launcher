import { safeParse } from "../../core/safe-parse.js";
import { state, actions } from "../../core/app-state.js";
import { loadAvatarForUser, getSkinTextureUrl, resolveSkinTextureBase64 } from "../../core/skin-texture.js";

function renderFriendsSidebar() {
  if (document.getElementById("friends-search-panel")) return;

  // The sub-panel / friends-btn styles now live in
  // src/features/friends/friends.css (imported from src/main.js) so they
  // apply in BOTH classic and advanced UI modes. The previous inline
  // <style id="friends-sidebar-style"> block was removed because:
  //   1. It defined .friends-sub-panel / .friends-btn inside JS, making
  //      them easy to miss when refactoring.
  //   2. .friends-btn had NO base rule here — only an advanced-mode
  //      override in advanced-theme.css — so every Save / Search / Send /
  //      Submit button rendered as a default grey OS rectangle in classic
  //      mode. That was the single biggest visual bug in the launcher.

  const container = document.getElementById("friends-sidebar");
  if (container) {
    const identityInfo = container.querySelector(".friends-identity-info");
    if (identityInfo && !document.getElementById("btn-my-settings")) {
      identityInfo.insertAdjacentHTML("beforeend",
        '<button id="btn-my-settings" class="icon-btn" title="Settings"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></button>' +
        '<button id="btn-open-search" class="icon-btn" title="Search"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></button>'
      );
    }
    const content = container.querySelector(".friends-sidebar-content");
    if (content && !document.getElementById("friends-search-panel")) {
      content.insertAdjacentHTML("beforeend",
        '<div id="friends-search-panel" class="friends-sub-panel">' +
          '<div class="friends-sub-header">' +
            '<button id="btn-search-back" class="back-btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>' +
            '<div class="search-input-wrap">' +
              '<svg class="search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
              '<input id="input-search-users" type="text" placeholder="Search users..." />' +
            '</div>' +
            '<button id="btn-execute-search" class="friends-btn small">Search</button>' +
          '</div>' +
          '<div id="search-results-list" class="friends-sub-panel-content"></div>' +
        '</div>' +
        '<div id="friends-profile-panel" class="friends-sub-panel">' +
          '<div class="friends-sub-header">' +
            '<button id="btn-profile-back" class="back-btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>' +
            '<span id="profile-username" class="username-label"></span>' +
          '</div>' +
          '<div class="friends-sub-panel-content">' +
            '<div class="profile-hero">' +
              '<div class="profile-skin-wrap"><canvas id="profile-skin-render" width="120" height="200"></canvas></div>' +
              '<span id="profile-status" class="profile-status-badge"></span>' +
              '<p id="profile-bio" class="profile-bio-text"></p>' +
              '<button id="btn-profile-add-friend" class="friends-btn">Add Friend</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div id="friends-settings-panel" class="friends-sub-panel">' +
          '<div class="friends-sub-header">' +
            '<button id="btn-settings-back" class="back-btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>' +
            '<span>Settings</span>' +
          '</div>' +
          '<div class="friends-sub-panel-content">' +
            '<div id="settings-error" class="friends-auth-error"></div>' +
            '<div class="settings-section">' +
              '<div class="settings-section-title">Bio</div>' +
              '<textarea id="settings-bio" placeholder="Write something about yourself..."></textarea>' +
              '<button id="btn-settings-save-bio" class="friends-btn small">Save</button>' +
            '</div>' +
            '<div class="settings-divider"></div>' +
            '<div class="settings-section">' +
              '<div class="settings-section-title">Two-Factor Auth</div>' +
              '<div class="settings-row">' +
                '<span class="settings-row-label" id="settings-2fa">Disabled</span>' +
                '<label class="idk-toggle"><input type="checkbox" id="settings-2fa-toggle" /><span class="idk-toggle-slider"></span></label>' +
              '</div>' +
            '</div>' +
            '<div class="settings-divider"></div>' +
            '<div class="settings-section">' +
              '<div class="settings-section-title">Security</div>' +
              '<div class="settings-section-desc">Change your password or manage 2FA</div>' +
              '<input id="settings-new-password" type="password" placeholder="New password" />' +
              '<div id="settings-security-otp-container" style="display:none">' +
                '<input id="settings-security-otp" type="text" placeholder="OTP Code" />' +
              '</div>' +
              '<button id="btn-settings-save-security" class="friends-btn small">Save</button>' +
            '</div>' +
            '<div class="settings-section">' +
              '<div class="settings-section-title">Linked Minecraft</div>' +
              '<div class="settings-section-desc">Link your launcher Minecraft account to your IDK profile</div>' +
              '<span id="settings-linked-mc-status" style="font-size:.75rem;color:var(--text-dim)">Not linked</span>' +
              '<button id="btn-settings-link-minecraft" class="friends-btn small">Link Current Account</button>' +
            '</div>' +
          '</div>' +
        '</div>'
      );
    }
    return;
  }

  const SVG_ICON = {
    back: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
    settings: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    search: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    close: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    disconnect: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
  };

  const sidebarHtml =
(document.getElementById("friends-sidebar-backdrop") ? "" :
'<div id="friends-sidebar-backdrop" class="friends-sidebar-backdrop"></div>') +
'<div id="friends-sidebar" class="friends-sidebar">' +
  '<div class="friends-sidebar-header">' +
    '<h3>IDK Connect</h3>' +
    '<button id="btn-friends-sidebar-close" class="friends-sidebar-close">' + SVG_ICON.close + '</button>' +
  '</div>' +
  '<div class="friends-sidebar-content">' +

    '<div id="friends-auth-panel" class="friends-auth-panel friends-panel-toggle active">' +
      '<div class="friends-auth-tabs">' +
        '<button id="tab-friends-login" class="friends-auth-tab active">Login</button>' +
        '<button id="tab-friends-register" class="friends-auth-tab">Register</button>' +
      '</div>' +
      '<div id="friends-auth-error" class="friends-auth-error"></div>' +
      '<div class="friends-auth-form">' +
        '<input id="friends-auth-username" type="text" placeholder="Username" />' +
        '<input id="friends-auth-email" type="email" placeholder="Email" />' +
        '<input id="friends-auth-password" type="password" placeholder="Password" />' +
        '<div id="friends-auth-otp-container" style="display:none">' +
          '<input id="friends-auth-otp" type="text" placeholder="OTP Code" />' +
        '</div>' +
        '<button id="btn-friends-auth-submit" class="friends-btn">Submit</button>' +
      '</div>' +
    '</div>' +

    '<div id="friends-main-panel" class="friends-panel-toggle">' +
      '<div class="friends-user-info">' +
        '<canvas id="friends-my-avatar" width="40" height="40" class="avatar-canvas"></canvas>' +
        '<span id="friends-my-username" class="username-label"></span>' +
        '<button id="btn-my-settings" class="icon-btn" title="Settings">' + SVG_ICON.settings + '</button>' +
        '<button id="btn-open-search" class="icon-btn" title="Search">' + SVG_ICON.search + '</button>' +
        '<button id="btn-friends-disconnect" class="icon-btn danger" title="Disconnect">' + SVG_ICON.disconnect + '</button>' +
      '</div>' +

      '<div id="friends-share-card" class="friends-share-card">' +
        '<div id="friends-share-instructions" class="share-instructions">' +
          '<p>Share your local game with friends over the internet.</p>' +
        '</div>' +
        '<div id="friends-share-input-row" class="friends-share-input-row">' +
          '<input id="friends-share-port" type="number" placeholder="Port (e.g. 25565)" />' +
          '<button id="btn-friends-share" class="friends-btn">Share</button>' +
        '</div>' +
        '<button id="btn-friends-share-cancel" class="friends-btn cancel" style="display:none">Cancel</button>' +
        '<div id="friends-share-tunnel-link" class="friends-share-tunnel-link" style="display:none"></div>' +
      '</div>' +

      '<div id="frpc-progress-panel" style="display:none">' +
        '<div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:.6875rem;color:var(--text-muted)">' +
          '<span id="frpc-status-text"></span>' +
          '<span id="frpc-percent-text">0%</span>' +
        '</div>' +
        '<div class="frpc-progress-bar"><div id="frpc-progress-fill" class="frpc-progress-fill" style="width:0%"></div></div>' +
      '</div>' +

      '<div id="friends-requests-section" class="friends-requests-section">' +
        '<h4>Friend Requests</h4>' +
        '<div id="friends-requests-list"></div>' +
      '</div>' +

      '<h4>Friends</h4>' +
      '<div id="friends-list" class="friends-list-container"></div>' +
    '</div>' +

    '<div id="friends-search-panel" class="friends-sub-panel">' +
      '<div class="friends-sub-header">' +
        '<button id="btn-search-back" class="back-btn">' + SVG_ICON.back + '</button>' +
        '<div class="search-input-wrap">' +
          '<svg class="search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
          '<input id="input-search-users" type="text" placeholder="Search users..." />' +
        '</div>' +
        '<button id="btn-execute-search" class="friends-btn small">Search</button>' +
      '</div>' +
      '<div id="search-results-list" class="friends-sub-panel-content"></div>' +
    '</div>' +

    '<div id="friends-profile-panel" class="friends-sub-panel">' +
      '<div class="friends-sub-header">' +
        '<button id="btn-profile-back" class="back-btn">' + SVG_ICON.back + '</button>' +
        '<span id="profile-username" class="username-label"></span>' +
      '</div>' +
      '<div class="friends-sub-panel-content">' +
        '<div class="profile-hero">' +
          '<div class="profile-skin-wrap"><canvas id="profile-skin-render" width="120" height="200"></canvas></div>' +
          '<span id="profile-status" class="profile-status-badge"></span>' +
          '<p id="profile-bio" class="profile-bio-text"></p>' +
          '<button id="btn-profile-add-friend" class="friends-btn">Add Friend</button>' +
        '</div>' +
      '</div>' +
    '</div>' +

    '<div id="friends-settings-panel" class="friends-sub-panel">' +
      '<div class="friends-sub-header">' +
        '<button id="btn-settings-back" class="back-btn">' + SVG_ICON.back + '</button>' +
        '<span>Settings</span>' +
      '</div>' +
      '<div class="friends-sub-panel-content">' +
        '<div id="settings-error" class="friends-auth-error"></div>' +
        '<div class="settings-section">' +
          '<div class="settings-section-title">Bio</div>' +
          '<textarea id="settings-bio" placeholder="Write something about yourself..."></textarea>' +
          '<button id="btn-settings-save-bio" class="friends-btn small">Save</button>' +
        '</div>' +
        '<div class="settings-divider"></div>' +
        '<div class="settings-section">' +
          '<div class="settings-section-title">Two-Factor Auth</div>' +
          '<div class="settings-row">' +
            '<span class="settings-row-label" id="settings-2fa">Disabled</span>' +
            '<label class="idk-toggle"><input type="checkbox" id="settings-2fa-toggle" /><span class="idk-toggle-slider"></span></label>' +
          '</div>' +
        '</div>' +
        '<div class="settings-divider"></div>' +
        '<div class="settings-section">' +
          '<div class="settings-section-title">Security</div>' +
          '<div class="settings-section-desc">Change your password or manage 2FA</div>' +
          '<input id="settings-new-password" type="password" placeholder="New password" />' +
          '<div id="settings-security-otp-container" style="display:none">' +
            '<input id="settings-security-otp" type="text" placeholder="OTP Code" />' +
          '</div>' +
          '<button id="btn-settings-save-security" class="friends-btn small">Save</button>' +
        '</div>' +
        '<div class="settings-divider"></div>' +
        '<div class="settings-section">' +
          '<div class="settings-section-title">Linked Minecraft</div>' +
          '<div class="settings-section-desc">Link your launcher Minecraft account to your IDK profile</div>' +
          '<span id="settings-linked-mc-status" style="font-size:.75rem;color:var(--text-dim)">Not linked</span>' +
          '<button id="btn-settings-link-minecraft" class="friends-btn small">Link Current Account</button>' +
        '</div>' +
      '</div>' +
    '</div>' +

    '<div id="friends-chat-panel" class="friends-sub-panel">' +
      '<div class="friends-sub-header">' +
        '<button id="btn-friends-chat-back" class="back-btn">' + SVG_ICON.back + '</button>' +
        '<canvas id="friends-chat-avatar" width="24" height="24" class="avatar-canvas" style="width:24px;height:24px"></canvas>' +
        '<span id="friends-chat-name" style="flex:1;font-size:.8125rem;font-weight:600;color:white"></span>' +
        '<span id="friends-chat-status" style="font-size:.625rem;color:var(--text-muted)"></span>' +
      '</div>' +
      '<div id="friends-chat-messages" class="friends-chat-messages"></div>' +
      '<div class="friends-chat-input-row">' +
        '<input id="friends-chat-input" type="text" placeholder="Type a message..." />' +
        '<button id="btn-friends-chat-send" class="friends-btn small">Send</button>' +
      '</div>' +
    '</div>' +

  '</div>' +
'</div>';

  const app = document.getElementById("app");
  if (app) {
    app.insertAdjacentHTML("afterend", sidebarHtml);
  } else {
    document.body.insertAdjacentHTML("beforeend", sidebarHtml);
  }
}

export function initFriendsFeature() {
  renderFriendsSidebar();

  // === IDK CONNECT - PREMIUM FRIENDS & CLOUDFLARED LAN SHARING CLIENT ENGINE ===
  // ============================================================================
  (function initFriendsSystem() {
    let IDK_BACKEND_URL = localStorage.getItem("idk_backend_url") || "https://api.somniac.me";
    let idkToken = localStorage.getItem("idk_connect_token") || "";
    let idkUser = safeParse(
      localStorage.getItem("idk_connect_user"),
    );
    let idkAuthTab = "login";
    let activeTunnelUrl = null;
    let activeSharePort = null;
    let presenceInterval = null;
    let refreshInterval = null;
    let cloudflaredInstallInProgress = false;

    // DOM Elements
    const btnToggleSidebar = document.getElementById("btn-friends-toggle");
    const sidebar = document.getElementById("friends-sidebar");
    const sidebarBackdrop = document.getElementById("friends-sidebar-backdrop");
    const btnCloseSidebar = document.getElementById(
      "btn-friends-sidebar-close",
    );
    const badgePending = document.getElementById("friends-pending-badge");

    const openSidebar = () => {
      if (!sidebar) return;
      sidebar.classList.add("active");
      if (sidebarBackdrop) sidebarBackdrop.classList.add("active");
    };
    const closeSidebar = () => {
      if (!sidebar) return;
      sidebar.classList.remove("active");
      if (sidebarBackdrop) sidebarBackdrop.classList.remove("active");
      document.querySelectorAll(".friends-sub-panel.active").forEach(p => p.classList.remove("active"));
      if (chatPanel) chatPanel.style.display = "none";
      if (idkToken && idkUser && mainPanel) {
        mainPanel.style.display = "flex";
      }
    };

    if (btnToggleSidebar) {
      btnToggleSidebar.addEventListener("click", () => {
        if (sidebar.classList.contains("active")) closeSidebar();
        else openSidebar();
      });
    }
    if (btnCloseSidebar) {
      btnCloseSidebar.addEventListener("click", closeSidebar);
    }
    // Click on backdrop → close sidebar (the "click outside the modal closes it" UX)
    if (sidebarBackdrop) {
      sidebarBackdrop.addEventListener("click", closeSidebar);
    }
    // Escape closes the open sub-panel first, then the sidebar itself.
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!sidebar || !sidebar.classList.contains("active")) return;
      const activeSub = document.querySelector(".friends-sub-panel.active");
      if (activeSub) {
        activeSub.classList.remove("active");
        if (chatPanel) chatPanel.style.display = "none";
        if (idkToken && idkUser && mainPanel) {
          mainPanel.style.display = "flex";
        }
        return;
      }
      closeSidebar();
    });

    const authPanel = document.getElementById("friends-auth-panel");
    const mainPanel = document.getElementById("friends-main-panel");

    const tabLogin = document.getElementById("tab-friends-login");
    const tabRegister = document.getElementById("tab-friends-register");
    const authError = document.getElementById("friends-auth-error");
    const inputUsername = document.getElementById("friends-auth-username");
    const inputEmail = document.getElementById("friends-auth-email");
    const inputPassword = document.getElementById("friends-auth-password");
    const inputOtp = document.getElementById("friends-auth-otp");
    const btnSubmit = document.getElementById("btn-friends-auth-submit");
    const errorEl = document.getElementById("friends-auth-error");

    let otpRequested = false;

    const myUsernameLabel = document.getElementById("friends-my-username");
    const myAvatarCanvas = document.getElementById("friends-my-avatar");
    const btnDisconnect = document.getElementById("btn-friends-disconnect");

    const shareCard = document.getElementById("friends-share-card");
    const shareInstructions = document.getElementById(
      "friends-share-instructions",
    );
    const shareInputRow = document.getElementById("friends-share-input-row");
    const inputSharePort = document.getElementById("friends-share-port");
    const btnShare = document.getElementById("btn-friends-share");
    const btnFriendsShareCancel = document.getElementById(
      "btn-friends-share-cancel",
    );
    const tunnelLink = document.getElementById("friends-share-tunnel-link");

    let isCancellingHost = false;

    const progressPanel = document.getElementById("frpc-progress-panel");
    const statusText = document.getElementById("frpc-status-text");
    const percentText = document.getElementById("frpc-percent-text");
    const progressFill = document.getElementById("frpc-progress-fill");

    const requestsSection = document.getElementById("friends-requests-section");
    const requestsList = document.getElementById("friends-requests-list");
    const friendsList = document.getElementById("friends-list");

    // Profile & Search & Settings Panels
    const searchPanel = document.getElementById("friends-search-panel");
    const profilePanel = document.getElementById("friends-profile-panel");
    const settingsPanel = document.getElementById("friends-settings-panel");

    const btnMySettings = document.getElementById("btn-my-settings");
    const btnOpenSearch = document.getElementById("btn-open-search");

    const btnSearchBack = document.getElementById("btn-search-back");
    const inputSearchUsers = document.getElementById("input-search-users");
    const btnExecuteSearch = document.getElementById("btn-execute-search");
    const searchResultsList = document.getElementById("search-results-list");

    const btnProfileBack = document.getElementById("btn-profile-back");
    const profileSkinRender = document.getElementById("profile-skin-render");
    const profileUsername = document.getElementById("profile-username");
    const profileStatus = document.getElementById("profile-status");
    const profileBio = document.getElementById("profile-bio");
    const btnProfileAddFriend = document.getElementById("btn-profile-add-friend");
    let currentProfileUsername = null;

    const btnSettingsBack = document.getElementById("btn-settings-back");
    const settingsBio = document.getElementById("settings-bio");
    const btnSettingsSaveBio = document.getElementById("btn-settings-save-bio");
    const settings2fa = document.getElementById("settings-2fa-toggle");
    const settings2faLabel = document.getElementById("settings-2fa");
    const settingsNewPassword = document.getElementById("settings-new-password");
    const settingsSecurityOtpContainer = document.getElementById("settings-security-otp-container");
    const settingsSecurityOtp = document.getElementById("settings-security-otp");
    const btnSettingsSaveSecurity = document.getElementById("btn-settings-save-security");
    const settingsError = document.getElementById("settings-error");
    const settingsLinkedMcStatus = document.getElementById("settings-linked-mc-status");
    const btnSettingsLinkMinecraft = document.getElementById("btn-settings-link-minecraft");

    // Chat Variables
    let activeChatFriendId = null;
    let activeChatFriendUsername = null;
    let chatPollInterval = null;
    let lastSentClientTime = 0;

    // Chat DOM Elements
    const chatPanel = document.getElementById("friends-chat-panel");
    const btnFriendsChatBack = document.getElementById("btn-friends-chat-back");
    const chatAvatarCanvas = document.getElementById("friends-chat-avatar");
    const chatNameLabel = document.getElementById("friends-chat-name");
    const chatStatusLabel = document.getElementById("friends-chat-status");
    const chatMessagesContainer = document.getElementById("friends-chat-messages");
    const chatInput = document.getElementById("friends-chat-input");
    const btnFriendsChatSend = document.getElementById("btn-friends-chat-send");

    // --- VIEW CHANGED LISTENER ---
    document.addEventListener("idk:view-changed", (e) => {
      if (e.detail.viewName === "idk-connect") {
        refreshFriendsData();
      }
    });

    // --- AVATAR RENDERING HELPERS ---
    function drawSteveFace(canvas) {
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#3c3c3d";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    function renderSkinFaceOnFriendsCanvas(canvas, username, authMode) {
      const ctx = canvas.getContext("2d");
      const img = new Image();

      img.onload = () => {
        const scale = img.naturalWidth / 64;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;
        // Head face layer
        ctx.drawImage(
          img,
          8 * scale,
          8 * scale,
          8 * scale,
          8 * scale,
          0,
          0,
          canvas.width,
          canvas.height,
        );
        // Outer accessory layer (hats/masks)
        ctx.drawImage(
          img,
          40 * scale,
          8 * scale,
          8 * scale,
          8 * scale,
          0,
          0,
          canvas.width,
          canvas.height,
        );
      };

      let fallbackStage = 0;
      img.onerror = () => {
        fallbackStage++;
        if (fallbackStage === 1) {
          // Try official Mojang/Minotar skins next
          img.src = `https://minotar.net/skin/${username}`;
        } else {
          // Draw standard letter avatar
          const accentDark = getComputedStyle(document.documentElement)
            .getPropertyValue("--theme-accent-dark")
            .trim();
          ctx.fillStyle = accentDark || "#16a34a";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = "white";
          ctx.font = "bold 12px Inter";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(
            username.substring(0, 2).toUpperCase(),
            canvas.width / 2,
            canvas.height / 2,
          );
        }
      };

      if (authMode === "offline") {
        img.src = `https://minotar.net/skin/${username}`;
      } else {
        // Ely.by or unknown (e.g. friend) - check Ely.by first, fallback to minotar
        img.src = `https://skinsystem.ely.by/skins/${username}.png`;
      }
    }

    // --- HTTP BACKEND REQUEST WRAPPER ---
    async function idkRequest(endpoint, method = "GET", body = null) {
      const headers = { "Content-Type": "application/json" };
      if (idkToken) headers["Authorization"] = `Bearer ${idkToken}`;

      const res = await fetch(`${IDK_BACKEND_URL}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : null,
      });

      if (!res.ok) {
        try {
          const err = await res.json();
          throw new Error(err.error || `Server error ${res.status}`);
        } catch (e) {
          if (e.message.startsWith("Server error")) throw e;
          throw new Error(`Server error ${res.status}`);
        }
      }
      return res.json();
    }

    // --- UI CONTROLLERS ---
    function updateFriendsAuthUI() {
      if (idkToken && idkUser) {
        authPanel.style.display = "none";
        mainPanel.style.display = "block";
        myUsernameLabel.innerText = idkUser.username;

        // Draw client avatar
        loadAvatarForUser(myAvatarCanvas, state.currentUser || idkUser.username, state.authMode);

        // Initialize intervals
        startHeartbeats();
        refreshFriendsData();
      } else {
        authPanel.style.display = "block";
        mainPanel.style.display = "none";
        // Use classList (not inline display:none) so the .active CSS rule
        // in friends.css can show them again when needed.
        [searchPanel, profilePanel, settingsPanel].forEach(p => {
          if (p) p.classList.remove("active");
        });
        stopHeartbeats();
        exitChat();
      }
    }

    // --- AUTH PORTAL ACTIONS ---
    tabLogin.addEventListener("click", () => {
      idkAuthTab = "login";
      tabLogin.classList.add("active");
      tabRegister.classList.remove("active");
      inputEmail.style.display = "none";
      btnSubmit.innerText = "Connect to Network";
      errorEl.style.display = "none";
      inputOtp.style.display = "none";
      inputPassword.style.display = "block";
      otpRequested = false;
    });

    tabRegister.addEventListener("click", () => {
      idkAuthTab = "register";
      tabRegister.classList.add("active");
      tabLogin.classList.remove("active");
      inputEmail.style.display = "block";
      btnSubmit.innerText = "Request OTP";
      errorEl.style.display = "none";
      inputOtp.style.display = "none";
      inputPassword.style.display = "block";
      otpRequested = false;
    });

    btnSubmit.addEventListener("click", async () => {
      const user = inputUsername.value.trim();
      const pass = inputPassword.value;
      const email = inputEmail.value.trim();
      const otp = inputOtp.value.trim();

      if (!user || !pass) {
        showAuthError("Username and password are required.");
        return;
      }

      if (idkAuthTab === "register" && !email) {
        showAuthError("Email is required for registration.");
        return;
      }

      if (idkAuthTab === "register" && !otpRequested) {
        btnSubmit.innerText = "Requesting OTP...";
        btnSubmit.disabled = true;
        try {
          const res = await fetch(`${IDK_BACKEND_URL}/api/auth/request-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: user, email })
          });
          const data = await res.json();
          if (res.ok) {
            otpRequested = true;
            inputOtp.style.display = "block";
            btnSubmit.innerText = "Verify & Register";
            showAuthError("OTP sent to your email (or console)!");
            errorEl.style.color = "#4ade80"; // temporary green success
            setTimeout(() => errorEl.style.color = "#ef4444", 5000);
          } else {
            showAuthError(data.error || "Failed to request OTP.");
            btnSubmit.innerText = "Request OTP";
          }
        } catch (e) {
          showAuthError("Network error: Backend server not running.");
          btnSubmit.innerText = "Request OTP";
        }
        btnSubmit.disabled = false;
        return;
      }

      if (idkAuthTab === "register" && otpRequested && !otp) {
        showAuthError("Please enter the 6-digit OTP code.");
        return;
      }

      if (idkAuthTab === "login" && otpRequested && !otp) {
        showAuthError("Please enter the 6-digit OTP code sent to your email.");
        return;
      }

      const endpoint =
        idkAuthTab === "login"
          ? (otpRequested ? "/api/auth/verify-2fa" : "/api/auth/login")
          : "/api/auth/register";

      const originalText = btnSubmit.innerText;
      btnSubmit.innerText =
        idkAuthTab === "login" ? (otpRequested ? "Verifying..." : "Connecting...") : "Verifying...";
      btnSubmit.disabled = true;
      errorEl.style.display = "none";

      try {
        const payload = idkAuthTab === "login"
          ? (otpRequested ? { username: user, password: pass, otp } : { username: user, password: pass })
          : { username: user, email, password: pass, otp };

        const res = await fetch(`${IDK_BACKEND_URL}${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();

        if (res.ok) {
          if (data.requires2fa) {
            otpRequested = true;
            inputOtp.style.display = "block";
            btnSubmit.innerText = "Verify 2FA";
            inputPassword.style.display = "none";
            showAuthError(`2FA OTP sent to ${data.email || "your email"}`);
            errorEl.style.color = "#4ade80";
            setTimeout(() => errorEl.style.color = "#ef4444", 5000);
            return;
          }

          idkToken = data.token;
          idkUser = data.user;
          localStorage.setItem("idk_connect_token", idkToken);
          localStorage.setItem("idk_connect_user", JSON.stringify(idkUser));
          updateFriendsAuthUI();

          if (idkAuthTab === "register") {
            actions.showWarningToast("Registration successful! You are now connected.");
          }

          inputPassword.value = "";
          inputOtp.value = "";
          otpRequested = false;
          inputOtp.style.display = "none";
          inputPassword.style.display = "block";
        } else {
          showAuthError(data.error || "Authentication failed.");
        }
      } catch (err) {
        showAuthError("Network error: Backend server not running.");
      } finally {
        btnSubmit.innerText = originalText;
        btnSubmit.disabled = false;
      }
    });

    function showAuthError(msg) {
      authError.innerText = msg;
      authError.style.display = "block";
    }

    btnDisconnect.addEventListener("click", () => {
      if (activeTunnelUrl) {
        btnShare.click(); // Stop sharing first
      }
      if (window.electronAPI) {
        // window.electronAPI.stopCloudflaredAccess(); // No longer needed
      }

      idkToken = "";
      idkUser = null;
      localStorage.removeItem("idk_connect_token");
      localStorage.removeItem("idk_connect_user");

      updateFriendsAuthUI();
      actions.showWarningToast("Disconnected from IDK Network.");
    });

    // --- CLOUDFLARED MULTIPLAYER SHARING ---
    btnShare.addEventListener("click", async () => {
      if (activeTunnelUrl) {
        // STOP SHARING TUNNEL
        btnShare.disabled = true;
        btnShare.innerText = "Stopping...";
        try {
          if (window.electronAPI) {
            await window.electronAPI.stopFrpcTunnel();
          }
          activeTunnelUrl = null;
          activeSharePort = null;

          // Restore sharing Card elements
          if (shareCard) shareCard.classList.remove("active");
          if (shareInstructions) shareInstructions.innerText =
            'Open your Minecraft singleplayer world, click "Open to LAN", then enter the port below to invite your friends!';
          if (shareInputRow) shareInputRow.style.display = "flex";
          if (tunnelLink) tunnelLink.style.display = "none";

          btnShare.innerText = "Share";
          btnShare.classList.remove("stop-sharing");

          // Update presence immediately
          try { await sendPresenceHeartbeat(); } catch (e) {}
          actions.showWarningToast(
            "Multi-player tunnel closed. World is private again.",
          );
        } catch (err) {
          console.error("[Friends] Stop tunnel error:", err);
          // Still reset UI even if stop had issues
          activeTunnelUrl = null;
          activeSharePort = null;
          if (shareCard) shareCard.classList.remove("active");
          if (shareInputRow) shareInputRow.style.display = "flex";
          if (tunnelLink) tunnelLink.style.display = "none";
          btnShare.innerText = "Share";
          btnShare.classList.remove("stop-sharing");
          actions.showWarningToast("Tunnel stopped (may not have been clean).");
        } finally {
          btnShare.disabled = false;
        }
        return;
      }

      // START SHARING TUNNEL
      const portVal = parseInt(inputSharePort.value);
      if (isNaN(portVal) || portVal < 1024 || portVal > 65535) {
        actions.showWarningToast("Please enter a valid LAN port (1024-65535)");
        return;
      }

      isCancellingHost = false;
      btnShare.disabled = true;
      btnShare.innerText = "Starting...";
      btnFriendsShareCancel.style.display = "inline-flex";
      btnFriendsShareCancel.innerText = "Cancel";
      btnFriendsShareCancel.disabled = false;

      if (!window.electronAPI) {
        // Fallback/Mock for Web Browsers
        setTimeout(() => {
          if (isCancellingHost) return;
          activeTunnelUrl = `tcp://mock-tunnel-${Math.random().toString(36).substring(3, 8)}.trycloudflare.com:54321`;
          activeSharePort = portVal;
          shareCard.classList.add("active");
          shareInstructions.innerText =
            "Sharing Active! Click below to copy your IP Address. Friends can join you now:";
          shareInputRow.style.display = "none";

          tunnelLink.innerText = activeTunnelUrl;
          tunnelLink.style.display = "block";
          btnShare.innerText = "Stop";
          btnShare.classList.add("stop-sharing");
          btnShare.disabled = false;

          navigator.clipboard.writeText(activeTunnelUrl);
          sendPresenceHeartbeat();
          actions.showWarningToast(
            "Mock Tunnel active! Copied IP address to clipboard.",
          );
        }, 1500);
        return;
      }

      try {
        // 1. Ensure FRPC binary exists (downloads if not)
        if (progressPanel) progressPanel.style.display = "block";
        if (statusText) statusText.innerText = "Preparing frpc.exe...";
        if (percentText) percentText.innerText = "0%";
        if (progressFill) progressFill.style.width = "0%";

        const cfStatus = await window.electronAPI.ensureFrpc();
        if (!cfStatus.success) {
          throw new Error(cfStatus.error || "Failed to download frpc");
        }

        if (progressPanel) progressPanel.style.display = "none";

        // 2. Start FRPC TCP tunnel forwarding LAN port
        if (statusText) statusText.innerText = "Connecting tunnel...";
        const tunnelStatus = await window.electronAPI.startFrpcTunnel(portVal);
        if (!tunnelStatus.success) {
          throw new Error(
            tunnelStatus.error || "Failed to establish TCP tunnel",
          );
        }

        activeTunnelUrl = tunnelStatus.url;
        activeSharePort = portVal;

        // Render shared status
        if (shareCard) shareCard.classList.add("active");
        if (shareInstructions) shareInstructions.innerText =
          "Sharing Active! Click below to copy your IP Address. Friends can join you now:";
        if (shareInputRow) shareInputRow.style.display = "none";

        if (tunnelLink) { tunnelLink.innerText = activeTunnelUrl; tunnelLink.style.display = "block"; }

        btnShare.innerText = "Stop";
        btnShare.classList.add("stop-sharing");

        navigator.clipboard.writeText(activeTunnelUrl);

        // Update presence immediately
        await sendPresenceHeartbeat();
        actions.showWarningToast(
          "LAN world successfully shared! IP address copied to clipboard.",
        );
      } catch (err) {
        if (!isCancellingHost) {
          actions.showWarningToast(`Tunnel Error: ${err.message}`);
        }
        if (progressPanel) progressPanel.style.display = "none";
        btnShare.innerText = "Share";
      } finally {
        btnShare.disabled = false;
        if (btnFriendsShareCancel) btnFriendsShareCancel.style.display = "none";
      }
    });

    // Cancel host button event listener
    btnFriendsShareCancel.addEventListener("click", async () => {
      btnFriendsShareCancel.disabled = true;
      btnFriendsShareCancel.innerText = "Cancelling...";
      isCancellingHost = true;
      try {
        if (window.electronAPI) {
          await window.electronAPI.stopFrpcTunnel();
        }
      } catch (err) {
        console.error("[Friends] Failed to cancel host:", err);
      } finally {
        btnFriendsShareCancel.disabled = false;
        btnFriendsShareCancel.innerText = "Cancel";
        btnFriendsShareCancel.style.display = "none";
        btnShare.disabled = false;
        btnShare.innerText = "Share";
        progressPanel.style.display = "none";
      }
    });

    // Listen to frpc download progress
    if (window.electronAPI) {
      window.electronAPI.onFrpcInstallProgress((data) => {
        progressPanel.style.display = "block";
        statusText.innerText = data.status || "Downloading...";
        percentText.innerText = `${data.percent}%`;
        progressFill.style.width = `${data.percent}%`;
      });

      window.electronAPI.onFrpcTunnelClosed(() => {
        if (activeTunnelUrl) {
          // Tunnel closed from outside
          activeTunnelUrl = null;
          activeSharePort = null;

          shareCard.classList.remove("active");
          shareInstructions.innerText =
            'Open your Minecraft singleplayer world, click "Open to LAN", then enter the port below to invite your friends!';
          shareInputRow.style.display = "flex";
          tunnelLink.style.display = "none";

          btnShare.innerText = "Share";
          btnShare.classList.remove("stop-sharing");
          sendPresenceHeartbeat();
          actions.showWarningToast("Tunnel connection closed unexpected.");
        }
      });
    }

    // Copy IP on link click
    tunnelLink.addEventListener("click", () => {
      if (activeTunnelUrl) {
        navigator.clipboard.writeText(activeTunnelUrl);
        actions.showWarningToast("IP Address copied to clipboard!");
      }
    });

    // --- PANEL SWITCHING ---
    // Uses classList (not inline display) so CSS in friends.css controls
    // visibility via the .active class — keeps concerns separated.
    function showPanel(panelName) {
      [mainPanel, chatPanel].forEach(p => {
        if (!p) return;
        p.style.display = "none";
      });
      [searchPanel, profilePanel, settingsPanel].forEach(p => {
        if (!p) return;
        p.classList.remove("active");
      });

      if (panelName === "main" && mainPanel) mainPanel.style.display = "flex";
      else if (panelName === "search" && searchPanel) searchPanel.classList.add("active");
      else if (panelName === "profile" && profilePanel) profilePanel.classList.add("active");
      else if (panelName === "settings" && settingsPanel) settingsPanel.classList.add("active");
      else if (panelName === "chat" && chatPanel) chatPanel.classList.add("active");
    }

    btnOpenSearch.addEventListener("click", () => {
      showPanel("search");
      inputSearchUsers.value = "";
      searchResultsList.innerHTML = "";
      loadDefaultSuggestedUsers();
      setTimeout(() => inputSearchUsers.focus(), 100);
    });

    async function loadDefaultSuggestedUsers() {
      searchResultsList.innerHTML = '<div class="search-section-label">Suggested</div><div class="search-empty-state">Loading suggestions...</div>';
      try {
        const res = await idkRequest("/api/users/suggested");
        if (!res.users || res.users.length === 0) {
          searchResultsList.innerHTML = '<div class="search-section-label">Suggested</div><div class="search-empty-state">No suggestions yet. Try searching for a username above.</div>';
          return;
        }
        renderSearchResults(res.users, false);
      } catch (err) {
        searchResultsList.innerHTML = '<div class="search-section-label">Suggested</div><div class="search-empty-state">Couldn\'t load suggestions. Use the search bar above to find users.</div>';
      }
    }

    btnSearchBack.addEventListener("click", () => showPanel("main"));
    btnProfileBack.addEventListener("click", () => showPanel("search"));
    btnSettingsBack.addEventListener("click", () => showPanel("main"));
    btnMySettings.addEventListener("click", async () => {
      showPanel("settings");
      // Guard against null idkUser (corrupt/empty localStorage)
      if (!idkUser) {
        settingsBio.value = "";
        settings2fa.checked = false;
        settings2faLabel.innerText = "Disabled";
        settingsLinkedMcStatus.innerText = "Not signed in";
        settingsLinkedMcStatus.style.color = "var(--text-muted)";
        settings2fa.onchange = () => {
          settings2faLabel.innerText = settings2fa.checked ? "Enabled" : "Disabled";
        };
        settingsNewPassword.value = "";
        settingsSecurityOtp.value = "";
        settingsSecurityOtpContainer.style.display = "none";
        settingsError.style.display = "none";
        return;
      }
      settingsBio.value = idkUser.bio || "";
      settings2fa.checked = idkUser.twoFactorEnabled || false;
      settings2faLabel.innerText = settings2fa.checked ? "Enabled" : "Disabled";
      settings2fa.onchange = () => {
        settings2faLabel.innerText = settings2fa.checked ? "Enabled" : "Disabled";
      };
      settingsNewPassword.value = "";
      settingsSecurityOtp.value = "";
      settingsSecurityOtpContainer.style.display = "none";
      settingsError.style.display = "none";
      
      // Fetch latest me to check linked account
      try {
        settingsLinkedMcStatus.innerText = "Loading...";
        const res = await idkRequest("/api/auth/me");
        idkUser = res.user;
        localStorage.setItem("idk_connect_user", JSON.stringify(idkUser));
        if (idkUser.linkedMinecraftAccount) {
          settingsLinkedMcStatus.innerText = `Linked to: ${idkUser.linkedMinecraftAccount.username} (${idkUser.linkedMinecraftAccount.authMode})`;
          settingsLinkedMcStatus.style.color = "#4ade80"; // green
        } else {
          settingsLinkedMcStatus.innerText = "Not linked";
          settingsLinkedMcStatus.style.color = "var(--text-muted)";
        }
      } catch (err) {
        settingsLinkedMcStatus.innerText = "Failed to load status";
      }
    });

    btnSettingsLinkMinecraft.addEventListener("click", async () => {
      const mcUser = state.currentUser;
      const mcAuthMode = state.authMode;

      if (!mcUser || mcAuthMode === "offline") {
        actions.showWarningToast("You must be logged into a verified (Ely.by or Microsoft) Minecraft account in the launcher to link it!");
        return;
      }

      btnSettingsLinkMinecraft.disabled = true;
      btnSettingsLinkMinecraft.innerText = "Linking...";
      try {
        const res = await idkRequest("/api/auth/link-minecraft", "POST", {
          minecraftUsername: mcUser,
          authMode: mcAuthMode
        });
        idkUser = res.user;
        localStorage.setItem("idk_connect_user", JSON.stringify(idkUser));
        actions.showWarningToast("Successfully linked Minecraft account!");
        settingsLinkedMcStatus.innerText = `Linked to: ${idkUser.linkedMinecraftAccount.username} (${idkUser.linkedMinecraftAccount.authMode})`;
        settingsLinkedMcStatus.style.color = "#4ade80";
      } catch (err) {
        actions.showWarningToast(err.message);
      } finally {
        btnSettingsLinkMinecraft.disabled = false;
        btnSettingsLinkMinecraft.innerText = "Link Current Minecraft Account";
      }
    });

    // --- SEARCH USERS ---
    btnExecuteSearch.addEventListener("click", handleSearchUsers);
    inputSearchUsers.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleSearchUsers();
    });

    function renderSearchResults(users, showSectionLabel = true) {
      if (showSectionLabel) {
        const label = document.createElement("div");
        label.className = "search-section-label";
        label.textContent = "Results";
        searchResultsList.appendChild(label);
      }
      users.forEach(user => {
        const card = document.createElement("div");
        card.className = "search-user-card";
        card.innerHTML =
          '<div class="search-avatar"><canvas id="search-avatar-' + user.id + '" width="36" height="36"></canvas></div>' +
          '<div class="search-user-info">' +
            '<strong>' + user.username + '</strong>' +
            '<span class="search-user-sub">' + (user.status === "offline" ? "Offline" : "Online") + '</span>' +
          '</div>' +
          '<button class="search-user-action">View</button>';
        card.style.cursor = "pointer";
        card.onclick = () => openUserProfile(user.username);
        searchResultsList.appendChild(card);

        const canvas = card.querySelector("#search-avatar-" + user.id);
        if (canvas) renderSkinFaceOnFriendsCanvas(canvas, user.username, "online");
      });
    }

    async function handleSearchUsers() {
      const q = inputSearchUsers.value.trim();
      if (!q) return;

      btnExecuteSearch.disabled = true;
      searchResultsList.innerHTML = '<div class="search-empty-state">Searching...</div>';
      try {
        const res = await idkRequest("/api/users/search?q=" + encodeURIComponent(q));
        searchResultsList.innerHTML = "";
        if (!res.users || res.users.length === 0) {
          searchResultsList.innerHTML = '<div class="search-empty-state">No users found for "' + q.replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#x27;'}[c])) + '".</div>';
          return;
        }
        renderSearchResults(res.users, true);
      } catch (err) {
        searchResultsList.innerHTML = '<div class="search-empty-state" style="color:#ef4444;">Search failed. Please try again.</div>';
      } finally {
        btnExecuteSearch.disabled = false;
      }
    }

    let friendsSkinViewer = null;

    async function openUserProfile(username) {
      showPanel("profile");
      profileUsername.innerText = username;
      profileStatus.innerText = "Loading...";
      profileBio.innerText = "Loading bio...";

      const canvasEl = document.getElementById("profile-skin-render-canvas");
      if (friendsSkinViewer) {
        try { friendsSkinViewer.dispose(); } catch (e) { }
        friendsSkinViewer = null;
      }

      try {
        const { SkinViewer, CrouchAnimation } = await import("skinview3d");
        const skinUrl = await getSkinTextureUrl(username, "elyby");
        const texture = await resolveSkinTextureBase64(skinUrl);

        friendsSkinViewer = new SkinViewer({
          canvas: canvasEl,
          width: 300,
          height: 420,
          skin: texture,
          preserveDrawingBuffer: true
        });

        // Setup lighting
        if (friendsSkinViewer.scene) {
          const THREE = await import("three");
          const existingLights = friendsSkinViewer.scene.children.filter(c => c.isLight);
          existingLights.forEach(l => friendsSkinViewer.scene.remove(l));

          friendsSkinViewer.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
          const mainLight = new THREE.DirectionalLight(0xffffff, 1.0);
          mainLight.position.set(3, 8, 6);
          friendsSkinViewer.scene.add(mainLight);
        }

        // Posisi kamera benar-benar lurus dan fokus tepat di tengah kepala
        friendsSkinViewer.camera.fov = 22;
        friendsSkinViewer.camera.position.set(0, 24, 40);
        friendsSkinViewer.camera.lookAt(0, 24, 0);
        friendsSkinViewer.camera.updateProjectionMatrix();

        if (typeof friendsSkinViewer.zoom === "number") {
          friendsSkinViewer.zoom = 0.85;
        }

        if (friendsSkinViewer.playerObject) {
          friendsSkinViewer.playerObject.rotation.y = -0.5;
        }

        const anim = new CrouchAnimation();
        anim.speed = 0.6;
        friendsSkinViewer.animation = anim;

      } catch (err) {
        console.error("Failed to render 3D skin:", err);
      }

      currentProfileUsername = username;

      try {
        const data = await idkRequest(`/api/users/${username}/profile`);
        const p = data.profile;
        profileStatus.innerText = p.status === 'offline' ? 'Offline' : (p.playingVersion ? `Playing ${p.playingVersion}` : 'Online');
        profileBio.innerText = p.bio || "No bio yet.";
      } catch (err) {
        profileBio.innerText = "Could not load profile details.";
      }
    }

    btnProfileAddFriend.addEventListener("click", async () => {
      if (!currentProfileUsername) return;
      btnProfileAddFriend.disabled = true;
      try {
        const res = await idkRequest("/api/friends/request", "POST", { username: currentProfileUsername });
        actions.showWarningToast(res.message);
      } catch (err) {
        actions.showWarningToast(err.message);
      } finally {
        btnProfileAddFriend.disabled = false;
      }
    });

    // --- SETTINGS ---
    btnSettingsSaveBio.addEventListener("click", async () => {
      btnSettingsSaveBio.disabled = true;
      try {
        const res = await idkRequest("/api/auth/profile", "PUT", { bio: settingsBio.value.trim() });
        idkUser = res.user;
        localStorage.setItem("idk_connect_user", JSON.stringify(idkUser));
        actions.showWarningToast("Bio saved successfully!");
      } catch (err) {
        actions.showWarningToast(err.message);
      } finally {
        btnSettingsSaveBio.disabled = false;
      }
    });

    let securityOtpRequested = false;
    btnSettingsSaveSecurity.addEventListener("click", async () => {
      settingsError.style.display = "none";
      if (!securityOtpRequested) {
        btnSettingsSaveSecurity.innerText = "Requesting OTP...";
        btnSettingsSaveSecurity.disabled = true;
        try {
          const res = await idkRequest("/api/auth/request-otp-security", "POST");
          securityOtpRequested = true;
          settingsSecurityOtpContainer.style.display = "block";
          btnSettingsSaveSecurity.innerText = "Verify OTP & Save";
        } catch (err) {
          settingsError.innerText = err.message;
          settingsError.style.display = "block";
          btnSettingsSaveSecurity.innerText = "Request OTP to Save";
        } finally {
          btnSettingsSaveSecurity.disabled = false;
        }
        return;
      }

      // Verify OTP & Save
      const otp = settingsSecurityOtp.value.trim();
      if (!otp) {
        settingsError.innerText = "Please enter the OTP.";
        settingsError.style.display = "block";
        return;
      }

      btnSettingsSaveSecurity.disabled = true;
      btnSettingsSaveSecurity.innerText = "Saving...";
      try {
        const res = await idkRequest("/api/auth/security", "POST", {
          newPassword: settingsNewPassword.value || null,
          twoFactorEnabled: settings2fa.checked,
          otp
        });
        idkUser = res.user;
        localStorage.setItem("idk_connect_user", JSON.stringify(idkUser));
        actions.showWarningToast("Security settings saved!");
        settingsSecurityOtpContainer.style.display = "none";
        settingsSecurityOtp.value = "";
        settingsNewPassword.value = "";
        securityOtpRequested = false;
        btnSettingsSaveSecurity.innerText = "Request OTP to Save";
      } catch (err) {
        settingsError.innerText = err.message;
        settingsError.style.display = "block";
        btnSettingsSaveSecurity.innerText = "Verify OTP & Save";
      } finally {
        btnSettingsSaveSecurity.disabled = false;
      }
    });

    // --- HEARTBEATS & SYNC ENGINE ---
    function startHeartbeats() {
      stopHeartbeats();

      // Heartbeat every 10 seconds to update presence
      sendPresenceHeartbeat(); // Immediate
      presenceInterval = setInterval(sendPresenceHeartbeat, 10000);

      // Refresh friends list & pending requests every 7 seconds
      refreshFriendsData();
      refreshInterval = setInterval(refreshFriendsData, 7000);
    }

    function stopHeartbeats() {
      if (presenceInterval) clearInterval(presenceInterval);
      if (refreshInterval) clearInterval(refreshInterval);
      presenceInterval = null;
      refreshInterval = null;
    }

    async function sendPresenceHeartbeat() {
      if (!idkToken) return;

      // Determine playing state from playBtn class!
      const playBtn = actions.getPlayButton?.();
      const isPlaying = playBtn?.classList.contains("running");
      const playingVersion = isPlaying
        ? `${state.selectedLoader} ${state.selectedVersion}`
        : null;

      try {
        await idkRequest("/api/presence", "POST", {
          status: "online",
          playingVersion,
          cloudflaredUrl: activeTunnelUrl,
        });
      } catch (err) {
        console.warn("[IDK Connect] Heartbeat failed", err.message);
      }
    }

    // --- REFRESH FRIENDS & RENDER LISTS ---
    async function refreshFriendsData() {
      if (!idkToken) return;

      try {
        // 1. Fetch friend list
        const friendsData = await idkRequest("/api/friends");
        renderFriendsList(friendsData.friends);

        // 2. Fetch pending requests
        const reqData = await idkRequest("/api/friends/requests");
        renderFriendRequests(reqData.requests);

        // Update badge count
        const reqCount = reqData.requests.length;
        badgePending.innerText = reqCount;
        badgePending.style.display = reqCount > 0 ? "flex" : "none";
      } catch (err) {
        console.warn("[IDK Connect] Sync failed", err.message);
      }
    }

    function renderFriendRequests(requests) {
      if (!requests || requests.length === 0) {
        requestsSection.style.display = "none";
        requestsList.innerHTML = "";
        return;
      }

      requestsSection.style.display = "flex";
      requestsList.innerHTML = "";

      requests.forEach((req) => {
        const card = document.createElement("div");
        card.className = "friend-request-card";
        card.innerHTML = `
        <div class="friend-request-info">
          <strong>${req.username}</strong>
          <span>Wants to be friends</span>
        </div>
        <div class="friend-request-actions">
          <button class="friend-request-btn accept" data-id="${req.requestId}" title="Accept Request">&#x2713;</button>
          <button class="friend-request-btn decline" data-id="${req.requestId}" title="Decline Request">&times;</button>
        </div>
      `;

        card.querySelector(".accept").onclick = () =>
          handleFriendRequest(req.requestId, true);
        card.querySelector(".decline").onclick = () =>
          handleFriendRequest(req.requestId, false);
        requestsList.appendChild(card);
      });
    }

    async function handleFriendRequest(requestId, accept) {
      try {
        const res = await idkRequest("/api/friends/requests/handle", "POST", {
          requestId,
          accept,
        });
        actions.showWarningToast(res.message);
        refreshFriendsData();
      } catch (err) {
        actions.showWarningToast(err.message);
      }
    }

    function renderFriendsList(friends) {
      if (!friends || friends.length === 0) {
        friendsList.innerHTML =
          '<div class="friends-list-empty">Your friends list is empty.</div>';
        return;
      }

      friendsList.innerHTML = "";

      // Sort friends: Hosting first, then Online, then Offline
      const sorted = [...friends].sort((a, b) => {
        if (a.cloudflaredUrl && !b.cloudflaredUrl) return -1;
        if (!a.cloudflaredUrl && b.cloudflaredUrl) return 1;
        if (a.status !== "offline" && b.status === "offline") return -1;
        if (a.status === "offline" && b.status !== "offline") return 1;
        return a.username.localeCompare(b.username);
      });

      sorted.forEach((friend) => {
        const card = document.createElement("div");
        card.className = "friend-card";

        const isOnline = friend.status !== "offline";
        const isHosting = !!friend.cloudflaredUrl;
        const isPlaying = !!friend.playingVersion && !isHosting;

        let statusText = "Offline";
        let statusClass = "";
        if (isHosting) {
          statusText = `Hosting ${friend.playingVersion || ""}`;
          statusClass = "hosting";
        } else if (isPlaying) {
          statusText = `Playing ${friend.playingVersion}`;
          statusClass = "playing";
        } else if (isOnline) {
          statusText = "Online";
          statusClass = "online";
        }

        const badgeHtml = (friend.unreadCount && friend.unreadCount > 0)
          ? `<div class="friend-unread-badge">${friend.unreadCount}</div>`
          : "";

        card.innerHTML = `
        <div class="friend-card-left">
          <div class="friend-avatar ${isOnline ? "online" : ""}">
            <canvas id="friend-avatar-${friend.id}" width="28" height="28" style="image-rendering:pixelated;width:100%;height:100%;"></canvas>
          </div>
          <div class="friend-info">
            <strong>${friend.username}</strong>
            <span class="friend-status-text ${statusClass}">
              <span class="friend-status-dot ${isOnline ? "online" : ""}"></span>
              ${statusText}
            </span>
          </div>
        </div>
        <div class="friend-card-right">
          ${badgeHtml}
          ${isHosting ? `<button class="friend-join-btn" title="Join Friend's LAN game!">JOIN</button>` : ""}
          <button class="friend-remove-btn" title="Unfriend" data-id="${friend.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="17" y1="11" x2="23" y2="11"></line></svg>
          </button>
        </div>
      `;

        // Render canvas face async
        const canvas = card.querySelector(`#friend-avatar-${friend.id}`);
        if (canvas) {
          loadAvatarForUser(canvas, friend.username, "elyby");
        }

        // Hook Enter Chat on left click
        card.querySelector(".friend-card-left").onclick = () => {
          enterChat(friend);
        };

        // Hook Remove Friend
        card.querySelector(".friend-remove-btn").onclick = async (e) => {
          e.stopPropagation();
          const confirmFn = actions.showConfirmDialog;
          if (!confirmFn) {
            if (confirm(`Remove ${friend.username} from your friends list?`))
              unfriend(friend.id);
            return;
          }
          const ok = await confirmFn({
            title: "Remove friend",
            message: `Remove ${friend.username} from your friends list? You can send them a new request later.`,
            confirmText: "Unfriend",
            cancelText: "Keep friend",
            variant: "danger",
          });
          if (ok) unfriend(friend.id);
        };

        // Hook Join World
        if (isHosting) {
          card.querySelector(".friend-join-btn").onclick = (e) => {
            e.stopPropagation();
            joinFriendWorld(friend);
          };
        }

        friendsList.appendChild(card);
      });
    }

    async function unfriend(friendId) {
      try {
        const res = await idkRequest(`/api/friends/${friendId}`, "DELETE");
        actions.showWarningToast(res.message);
        refreshFriendsData();
      } catch (err) {
        actions.showWarningToast(err.message);
      }
    }

    // --- JOIN GAME ACTION ---
    function joinFriendWorld(friend) {
      if (!friend.cloudflaredUrl) return;

      let host, port;
      let connectAddressText;

      const hostPort = friend.cloudflaredUrl.replace(/^(tcp|https?):\/\//i, "");
      const colonIdx = hostPort.lastIndexOf(":");
      if (colonIdx > 0) {
        host = hostPort.substring(0, colonIdx);
        port = parseInt(hostPort.substring(colonIdx + 1));
        if (isNaN(port)) port = null;
      } else {
        host = hostPort;
        port = null;
      }

      connectAddressText = port ? `${host}:${port}` : host;

      // Copy IP as fallback
      navigator.clipboard.writeText(connectAddressText);

      // If game is already running, show a notification that IP is copied
      if (actions.getPlayButton?.()?.classList.contains("running")) {
        actions.showWarningToast(
          `IP copied to clipboard! Paste it in Minecraft Multiplayer Direct Connect to join ${friend.username}.`,
        );
        return;
      }

      // Set state.quickConnectTarget details
      state.quickConnectTarget = { host, port };

      // Auto-switch Version & Loader if they mismatch!
      let mustSwitch = false;
      let playingVer = friend.playingVersion || "";

      let friendLoader = state.selectedLoader;
      let friendVersion = state.selectedVersion;

      if (playingVer) {
        let parts = playingVer.split(" ");
        if (parts.length > 1) {
          friendLoader = parts[0];
          friendVersion = parts[1];
        } else {
          // Fallback for single word playingVersion
          if (
            ["Vanilla", "Fabric", "Forge", "NeoForge", "Quilt"].includes(
              parts[0],
            )
          ) {
            friendLoader = parts[0];
          } else {
            friendVersion = parts[0];
          }
        }
      }

      if (
        state.selectedVersion !== friendVersion ||
        state.selectedLoader !== friendLoader
      ) {
        mustSwitch = true;

        // Auto switch loader dropdown selection
        state.selectedLoader = friendLoader;
        const loaderTriggerText = document.getElementById(
          "selected-loader-text",
        );
        if (loaderTriggerText) {
          loaderTriggerText.innerHTML = `<span style="display: flex; align-items: center; gap: 8px;">${friendLoader}</span>`;
        }
        document
          .querySelectorAll("#loader-dropdown .custom-option")
          .forEach((opt) => {
            opt.classList.toggle(
              "selected",
              opt.dataset.loader === friendLoader,
            );
          });

        // Auto switch version dropdown selection
        state.selectedVersion = friendVersion;
        actions.renderVersions?.();
      }

      if (mustSwitch) {
        actions.showWarningToast(
          `Auto-switched to ${friendLoader} ${friendVersion} to match ${friend.username}! Launching game...`,
        );
      } else {
        actions.showWarningToast(
          `Launching Minecraft to join ${friend.username}'s world!`,
        );
      }

      // Programmatically launch the game!
      setTimeout(() => {
        actions.playGame?.();
      }, 800);
    }

    function formatChatTime(timestamp) {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now - date;
      const diffMin = Math.floor(diffMs / 60000);
      const diffHr = Math.floor(diffMs / 3600000);

      if (diffMin < 1) return "just now";
      if (diffMin < 60) return `${diffMin}m ago`;
      if (diffHr < 24) return `${diffHr}h ago`;

      const isToday = date.toDateString() === now.toDateString();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const isYesterday = date.toDateString() === yesterday.toDateString();

      const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      if (isToday) return `Today ${time}`;
      if (isYesterday) return `Yesterday ${time}`;
      return `${date.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
    }

    // --- DIRECT MESSAGING / CHAT SYSTEM ---
    async function enterChat(friend) {
      activeChatFriendId = friend.id;
      activeChatFriendUsername = friend.username;

      // Update UI Views - hide main panel and show chat
      mainPanel.style.display = "none";
      chatPanel.style.display = "flex";

      // Set friend details in header
      chatNameLabel.innerText = friend.username;

      const isOnline = friend.status !== "offline";
      const isHosting = !!friend.cloudflaredUrl;
      const isPlaying = !!friend.playingVersion && !isHosting;
      let statusText = "Offline";
      let statusClass = "";
      if (isHosting) {
        statusText = `Hosting ${friend.playingVersion || ""}`;
        statusClass = "hosting";
      } else if (isPlaying) {
        statusText = `Playing ${friend.playingVersion}`;
        statusClass = "playing";
      } else if (isOnline) {
        statusText = "Online";
        statusClass = "online";
      }

      chatStatusLabel.innerHTML = `
        <span class="friend-status-dot ${isOnline ? "online" : ""}"></span>
        ${statusText}
      `;
      chatStatusLabel.className = `friend-status-text ${statusClass}`;

      // Load avatar
      loadAvatarForUser(chatAvatarCanvas, friend.username, "elyby");

      // Load messages initially
      chatMessagesContainer.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:11px;padding:20px 0;">Loading chat history...</div>';
      await loadChatMessages(true);

      // Start message polling every 3 seconds
      if (chatPollInterval) clearInterval(chatPollInterval);
      chatPollInterval = setInterval(() => loadChatMessages(false), 3000);
    }

    function exitChat() {
      if (chatPollInterval) {
        clearInterval(chatPollInterval);
        chatPollInterval = null;
      }
      activeChatFriendId = null;
      activeChatFriendUsername = null;

      chatPanel.style.display = "none";
      if (idkToken && idkUser && mainPanel) {
        mainPanel.style.display = "flex";
        refreshFriendsData();
      }
    }

    let lastMessagesJson = "";
    async function loadChatMessages(isInitial = false) {
      if (!idkToken || !activeChatFriendId) return;

      try {
        const res = await idkRequest(`/api/messages/${activeChatFriendId}`);
        const messages = res.messages || [];

        // Check if messages actually changed to avoid unnecessary re-rendering
        const currentJson = JSON.stringify(messages);
        if (currentJson === lastMessagesJson && !isInitial) {
          return;
        }
        lastMessagesJson = currentJson;

        const shouldScroll = isInitial || (chatMessagesContainer.scrollHeight - chatMessagesContainer.scrollTop - chatMessagesContainer.clientHeight < 60);

        if (messages.length === 0) {
          chatMessagesContainer.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:11px;padding:20px 0;">No messages yet. Say hello!</div>';
          return;
        }

        chatMessagesContainer.innerHTML = "";

        // Group consecutive messages by sender within a 2-minute window
        const GROUP_WINDOW = 2 * 60 * 1000;
        const groups = [];
        let cur = null;

        messages.forEach(msg => {
          const isMe = msg.senderId === idkUser.id;
          const ts = new Date(msg.timestamp).getTime();
          if (cur && cur.isMe === isMe && ts - cur.lastTime < GROUP_WINDOW) {
            cur.messages.push(msg);
            cur.lastTime = ts;
          } else {
            cur = { isMe, messages: [msg], lastTime: ts };
            groups.push(cur);
          }
        });

        groups.forEach(group => {
          group.messages.forEach((msg, i) => {
            const msgRow = document.createElement("div");
            const isFirst = i === 0;
            msgRow.className = `chat-message-row ${group.isMe ? "me" : "friend"}${!isFirst ? " grouped" : ""}`;
            const isLast = i === group.messages.length - 1;

            msgRow.innerHTML = `
              <div class="chat-message-bubble">${escapeHtml(msg.text)}</div>
              ${isLast ? `<div class="chat-message-time">${formatChatTime(group.lastTime)}</div>` : ""}
            `;
            chatMessagesContainer.appendChild(msgRow);
          });
        });

        if (shouldScroll) {
          chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
        }

        if (lastSentClientTime && Date.now() - lastSentClientTime < 300000) {
          const meRows = chatMessagesContainer.querySelectorAll(".chat-message-row.me");
          if (meRows.length > 0) {
            const lastTimeEl = meRows[meRows.length - 1].querySelector(".chat-message-time");
            if (lastTimeEl) lastTimeEl.textContent = "Just now";
          }
        }
      } catch (err) {
        console.warn("[Chat] Failed to load messages", err.message);
      }
    }

    async function handleSendMessage() {
      const text = chatInput.value.trim();
      if (!text || !activeChatFriendId) return;

      chatInput.value = "";
      chatInput.focus();
      lastSentClientTime = Date.now();

      // Optimistic locally rendered bubble for premium instant feedback feel
      const msgRow = document.createElement("div");
      msgRow.className = "chat-message-row me";
      msgRow.innerHTML = `<div class="chat-message-bubble">${escapeHtml(text)}</div><div class="chat-message-time">Just now</div>`;
      chatMessagesContainer.appendChild(msgRow);
      chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;

      try {
        await idkRequest(`/api/messages/${activeChatFriendId}`, "POST", { text });
        await loadChatMessages(false);
      } catch (err) {
        actions.showWarningToast(err.message);
      }
    }

    function escapeHtml(text) {
      const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      };
      return text.replace(/[&<>"']/g, m => map[m]);
    }

    // Hook DOM Event Listeners for Chat Panel
    if (btnFriendsChatBack) {
      btnFriendsChatBack.addEventListener("click", exitChat);
    }
    if (btnFriendsChatSend) {
      btnFriendsChatSend.addEventListener("click", handleSendMessage);
    }
    if (chatInput) {
      chatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") handleSendMessage();
      });
    }

    // --- AUTO LOGIN VIA MINECRAFT ACCOUNT ---
    async function attemptAutoLogin() {
      if (idkToken) return; // Already logged in
      const mcUser = state.currentUser;
      const mcAuthMode = state.authMode;

      if (!mcUser || mcAuthMode === "offline") return;

      try {
        const res = await idkRequest("/api/auth/login-minecraft", "POST", {
          minecraftUsername: typeof mcUser === 'string' ? mcUser : mcUser.name,
          authMode: mcAuthMode
        });
        idkToken = res.token;
        idkUser = res.user;
        localStorage.setItem("idk_connect_token", idkToken);
        localStorage.setItem("idk_connect_user", JSON.stringify(idkUser));
        updateFriendsAuthUI();
        actions.showWarningToast(`Auto-logged into IDK Connect as ${idkUser.username}`);
      } catch (err) {
        // Silently fail if not linked or other error
      }
    }

    // Attempt auto-login on startup
    attemptAutoLogin();

    // Attempt auto-login when returning to main view (e.g. after Minecraft login)
    document.addEventListener("idk:view-changed", (e) => {
      if (e.detail && e.detail.viewName === "main") {
        attemptAutoLogin();
      }
    });

    // --- INITIAL CHECK ---
    updateFriendsAuthUI();

    // Register action to allow updating from outside
    actions.updateFriendsAuthUI = () => {
      updateFriendsAuthUI();
      if (!idkToken) attemptAutoLogin();
    };

    // Expose enterChat so profile sidebar can open chat with a friend
    actions.openChatWithFriend = enterChat;
    actions.openFriendsSidebar = () => {
      actions.switchView?.("idk-connect");
      mainPanel.style.display = "flex";
      chatPanel.style.display = "none";
      const dot = document.getElementById("friends-unread-dot");
      if (dot) dot.style.display = "none";
    };
    actions.exitChat = exitChat;

    // Background unread message notification polling
    let lastUnreadTotals = {};
    let isFirstUnreadPoll = true;
    const unreadDot = document.getElementById("friends-unread-dot");
    const pollInterval = setInterval(async () => {
      if (!idkToken || !idkUser) return;
      try {
        const res = await idkRequest("/api/friends");
        const friends = res.friends || [];
        let totalUnread = 0;
        for (const friend of friends) {
          const prev = lastUnreadTotals[friend.id] || 0;
          if (friend.unreadCount > prev && !isFirstUnreadPoll) {
            const newCount = friend.unreadCount - prev;
            const plural = newCount > 1 ? "messages" : "message";
            actions.showWarningToast(`${friend.username} sent ${newCount} new ${plural}!`);
          }
          lastUnreadTotals[friend.id] = friend.unreadCount || 0;
          totalUnread += friend.unreadCount || 0;
        }
        if (unreadDot) {
          unreadDot.style.display = totalUnread > 0 ? "block" : "none";
        }
        isFirstUnreadPoll = false;
      } catch (_) { }
    }, 15000);
    actions.friendsCleanup = () => clearInterval(pollInterval);
    actions.stopFriendsPolling = () => clearInterval(pollInterval);
  })();
}



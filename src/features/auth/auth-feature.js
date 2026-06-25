import { state, actions } from "../../core/app-state.js";
import { loadAvatarForUser } from "../../core/skin-texture.js";
import { initTutorial } from "../tutorial/tutorial.js";

export function initAuthFeature({ switchView }) {
  // --- LOGIN LOGIC ---
  const btnOfflineLogin = document.getElementById("btn-offline-login");
  const offlineForm = document.getElementById("offline-form");
  const loginInput = document.getElementById("login-username");
  const btnSubmitLogin = document.getElementById("btn-submit-login");

  const btnElybyLogin = document.getElementById("btn-elyby-login");
  const btnMicrosoftLogin = document.getElementById("btn-microsoft-login");

  if (state.currentUser) {
    updateUserDisplay(state.currentUser);
    handleOnboardingFlow(switchView);
  }

  if (!btnOfflineLogin || !btnElybyLogin || !btnMicrosoftLogin || !loginInput || !btnSubmitLogin) {
    console.warn("[Auth] Login UI elements missing — feature cannot start.");
    return;
  }

  btnOfflineLogin.addEventListener("click", () => {
    offlineForm.classList.add("open");
    loginInput.focus();
  });

  btnElybyLogin.addEventListener("click", async () => {
    offlineForm.classList.remove("open");
    btnElybyLogin.innerText = "Opening browser...";
    try {
      if (window.electronAPI && window.electronAPI.elybyOAuthLogin) {
        const res = await window.electronAPI.elybyOAuthLogin();
        if (res && res.success && res.data && res.data.user) {
          state.currentUser = res.data.user.username;
          state.authMode = "elyby";
          localStorage.setItem("craftlaunch_username", state.currentUser);
          localStorage.setItem("craftlaunch_authmode", state.authMode);

          window.electronAPI.saveSettings({
            currentUser: state.currentUser,
            authMode: state.authMode,
            elybyData: {
              accessToken: res.data.accessToken,
              clientToken: res.data.clientToken,
              tokenType: res.data.tokenType,
              expiresIn: res.data.expiresIn,
              refreshToken: res.data.refreshToken || null,
              tokenCreatedAt: res.data.tokenCreatedAt || Date.now(),
              selectedProfile: res.data.selectedProfile || { name: res.data.user.username, id: res.data.user.uuid },
              user: res.data.user,
            }
          }).catch(console.error);

          updateUserDisplay(state.currentUser);
          handleOnboardingFlow(switchView);
        } else {
          alert(res?.error || "Ely.by login failed or was cancelled.");
        }
      } else {
        alert("Ely.by login is not available in this build.");
      }
    } catch (e) {
      console.error(e);
      alert("Error during Ely.by login.");
    } finally {
      btnElybyLogin.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> Ely.by Account';
    }
  });
  btnMicrosoftLogin.addEventListener("click", async () => {
    offlineForm.classList.remove("open");

    btnMicrosoftLogin.innerText = "Logging in...";
    try {
      if (window.electronAPI && window.electronAPI.microsoftAuthenticate) {
        const res = await window.electronAPI.microsoftAuthenticate();
        if (res && res.success && res.data && res.data.profile) {
          state.currentUser = res.data.profile.name;
          state.authMode = "microsoft";
          localStorage.setItem("craftlaunch_username", state.currentUser);
          localStorage.setItem("craftlaunch_authmode", state.authMode);

          window.electronAPI.saveSettings({
            currentUser: state.currentUser,
            authMode: state.authMode,
            microsoftData: res.data
          }).catch(console.error);

          updateUserDisplay(state.currentUser);
          handleOnboardingFlow(switchView);
        } else {
          alert(res?.error || "Microsoft login failed or cancelled.");
        }
      } else {
        alert("Microsoft login is not available in this build.");
      }
    } catch (e) {
      console.error(e);
      alert("Error during Microsoft login.");
    } finally {
      btnMicrosoftLogin.innerHTML = '<img src="./microsoft.png" alt="Microsoft Logo" width="24" height="24" style="object-fit: contain;" /> Microsoft Account';
    }
  });

  loginInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") login();
  });
  btnSubmitLogin.addEventListener("click", login);

  function login() {
    const val = loginInput.value.trim();
    if (!val) return;
    state.currentUser = val;
    state.authMode = "offline";
    localStorage.setItem("craftlaunch_username", state.currentUser);
    localStorage.setItem("craftlaunch_authmode", state.authMode);
    if (window.electronAPI) {
      window.electronAPI
        .saveSettings({
          currentUser: state.currentUser,
          authMode: state.authMode,
        })
        .catch(console.error);
    }
    updateUserDisplay(state.currentUser);
    handleOnboardingFlow(switchView);
  }

  async function handleOnboardingFlow(switchViewFn) {
    const { showConfirmDialog } = await import("../../components/confirm-dialog.js");

    if (!localStorage.getItem("idk_agreed_eula")) {
      const agreed = await showConfirmDialog({
        title: "GAME ACCESS & LEGALITY",
        message: `By continuing, you agree to our End User License Agreement and Privacy Policy.

• Mojang/Microsoft Account Compliance: This launcher uses official OAuth authentication for Mojang and Microsoft accounts. We DO NOT store your passwords.
• Offline / Custom Access (Cracked): As a compatibility option, this launcher allows you to play offline or use custom credentials. This feature is experimental and only recommended for use on unofficial servers or testing purposes.
• Minecraft EULA Compliance: We are fully committed to respecting and complying with the Minecraft EULA. Using this launcher with custom accounts is entirely your responsibility and is not endorsed or supported by Mojang or Microsoft.

Please review and accept these terms to continue.`,
        confirmText: "AGREE & CONTINUE",
        cancelText: "DECLINE",
        variant: "neutral"
      });

      if (!agreed) {
        state.currentUser = "";
        localStorage.removeItem("craftlaunch_username");
        if (window.electronAPI) {
          window.electronAPI.saveSettings({ currentUser: "", authMode: "offline", elybyData: null }).catch(console.error);
        }
        actions.updateFriendsAuthUI?.();
        switchViewFn("login");
        return;
      }
      localStorage.setItem("idk_agreed_eula", "true");
    }

    if (!localStorage.getItem("idk_connect_prompted_v2")) {
      const wantIdkConnect = await showConfirmDialog({
        title: "IDK Connect",
        message: "Sign in to IDK Connect to get extra features! Multiplayer, chat, profiles, etc.",
        confirmText: "Login / Sign Up",
        cancelText: "Continue Without",
        variant: "neutral"
      });

      localStorage.setItem("idk_connect_prompted_v2", "true");

      if (wantIdkConnect) {
    switchViewFn("main");
    initTutorial();
        setTimeout(() => {
          document.getElementById('btn-friends-toggle')?.click();
        }, 100);
        return;
      }
    }

    switchViewFn("main");
  }

  function updateUserDisplay(name) {
    document.getElementById("display-username").innerText = name;
    const advancedHomeName = document.getElementById("advanced-home-username");
    if (advancedHomeName) advancedHomeName.innerText = name.toUpperCase();
    const accountEl = document.querySelector(".user-details-account");
    if (accountEl) {
      if (state.authMode === "elyby") accountEl.innerText = "Ely.by Account";
      else if (state.authMode === "microsoft") accountEl.innerText = "Microsoft Account";
      else accountEl.innerText = "Offline Account";
    }

    const skinBtn = document.getElementById("btn-dropdown-skin");
    if (skinBtn) {
      skinBtn.style.display = state.authMode === "elyby" ? "flex" : "none";
    }

    const avatarCanvas = document.getElementById("avatar-canvas");
    if (avatarCanvas) {
      if (state.authMode === "elyby") {
        const ctx = avatarCanvas.getContext("2d");
        ctx.fillStyle = "#2d2d2e";
        ctx.fillRect(0, 0, avatarCanvas.width, avatarCanvas.height);
      }
      loadAvatarForUser(avatarCanvas, name, state.authMode);
    }

    actions.updateFriendsAuthUI?.();
  }

  // User Profile Dropdown Triggers
  const userProfileBtn = document.getElementById("user-profile-btn");
  const profileDropdown = document.getElementById("profile-dropdown");
  const btnDropdownSkin = document.getElementById("btn-dropdown-skin");
  const btnDropdownProfile = document.getElementById("btn-dropdown-profile");
  const btnDropdownLogout = document.getElementById("btn-dropdown-logout");

  userProfileBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    profileDropdown.classList.toggle("active");
  });

  userProfileBtn.addEventListener("dblclick", (e) => {
    e.stopPropagation();
    profileDropdown.classList.remove("active");
    actions.openProfile?.();
  });

  document.addEventListener("click", () => {
    profileDropdown.classList.remove("active");
  });

  btnDropdownSkin.addEventListener("click", (e) => {
    e.stopPropagation();
    profileDropdown.classList.remove("active");
    const targetUrl = "https://ely.by/profile";
    if (window.electronAPI && window.electronAPI.openExternal) {
      window.electronAPI.openExternal(targetUrl);
    } else {
      window.open(targetUrl, "_blank");
    }
  });

  btnDropdownProfile.addEventListener("click", (e) => {
    e.stopPropagation();
    profileDropdown.classList.remove("active");
    actions.openProfile?.();
  });

  btnDropdownLogout.addEventListener("click", async (e) => {
    e.stopPropagation();
    profileDropdown.classList.remove("active");
    const { showConfirmDialog } =
      await import("../../components/confirm-dialog.js");
    const ok = await showConfirmDialog({
      title: "Log out",
      message: "Sign out of the launcher on this device?",
      confirmText: "Log out",
      cancelText: "Stay signed in",
      variant: "neutral",
    });
    if (!ok) return;
    state.currentUser = "";
    localStorage.removeItem("craftlaunch_username");

    if (window.electronAPI) {
      window.electronAPI
        .saveSettings({
          currentUser: "",
          authMode: "offline",
          elybyData: null,
        })
        .catch(console.error);
    }

    document.getElementById("btn-friends-disconnect")?.click();
    actions.updateFriendsAuthUI?.();
    switchView("login");
  });
}

/**
 * Styled alert dialog (replaces window.alert).
 * Returns a Promise that resolves when the dialog is dismissed.
 *
 * Variants:
 *   - "info"     (default, neutral accent)
 *   - "error"    (red)
 *   - "success"  (green)
 *   - "warning"  (amber)
 */
export function showAlertDialog({
  title = 'Notice',
  message = '',
  confirmText = 'OK',
  variant = 'info',
} = {}) {
  return new Promise((resolve) => {
    let modal = document.getElementById('alert-dialog-modal');

    if (!modal) {
      modal = _ensureAlertDialogDOM();
    }

    const titleEl = document.getElementById('alert-dialog-title');
    const messageEl = document.getElementById('alert-dialog-message');
    const iconEl = modal.querySelector('.alert-dialog-icon');
    const confirmBtn = document.getElementById('alert-dialog-confirm');
    const closeBtn = document.getElementById('alert-dialog-close');
    const content = modal.querySelector('.alert-dialog-content');

    if (!titleEl || !messageEl || !confirmBtn || !closeBtn || !content) {
      window.alert(message);
      resolve();
      return;
    }

    titleEl.textContent = title;
    if (message instanceof Node) {
      messageEl.replaceChildren(message);
    } else {
      messageEl.textContent = message;
    }
    confirmBtn.textContent = confirmText;

    content.classList.remove(
      'alert-dialog-content--info',
      'alert-dialog-content--error',
      'alert-dialog-content--success',
      'alert-dialog-content--warning',
    );
    content.classList.add(`alert-dialog-content--${variant}`);
    if (iconEl) iconEl.innerHTML = _getIcon(variant);

    let resolved = false;
    const finish = () => {
      if (resolved) return;
      resolved = true;
      modal.classList.remove('active');
      confirmBtn.removeEventListener('click', onConfirm);
      closeBtn.removeEventListener('click', onClose);
      modal.removeEventListener('click', onBackdrop);
      document.removeEventListener('keydown', onKey);
      resolve();
    };

    const onConfirm = () => finish();
    const onClose = () => finish();
    const onBackdrop = (e) => {
      if (e.target === modal) finish();
    };
    const onKey = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        finish();
      }
    };

    confirmBtn.addEventListener('click', onConfirm);
    closeBtn.addEventListener('click', onClose);
    modal.addEventListener('click', onBackdrop);
    document.addEventListener('keydown', onKey);

    requestAnimationFrame(() => {
      modal.classList.add('active');
      confirmBtn.focus();
    });
  });
}

function _ensureAlertDialogDOM() {
  const modal = document.createElement('div');
  modal.id = 'alert-dialog-modal';
  modal.className = 'alert-dialog';
  modal.setAttribute('data-modal', '');
  modal.setAttribute('data-modal-noncloseable', '');
  modal.innerHTML = `
    <div class="alert-dialog-content alert-dialog-content--info" role="alertdialog" aria-modal="true">
      <button type="button" id="alert-dialog-close" class="alert-dialog-close" aria-label="Close">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
      <div class="alert-dialog-icon" aria-hidden="true"></div>
      <div class="alert-dialog-body">
        <h3 id="alert-dialog-title">Notice</h3>
        <p id="alert-dialog-message"></p>
      </div>
      <div class="alert-dialog-actions">
        <button type="button" id="alert-dialog-confirm" class="alert-dialog-btn confirm">OK</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  return modal;
}

function _getIcon(variant) {
  const icons = {
    info: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
    error: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
    success: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
    warning: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
  };
  return icons[variant] || icons.info;
}

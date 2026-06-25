/**
 * Settings UI Component
 *
 * Provides a settings panel with categories, search, form inputs,
 * tooltips, and action buttons for managing download and integrity settings.
 *
 * Responsibilities:
 * - Display settings organized by category
 * - Provide search/filter functionality
 * - Render form inputs for different setting types
 * - Display tooltips for each setting
 * - Handle save, reset, export, import actions
 * - Validate inputs before saving
 */

import { showAlertDialog } from './alert-dialog.js';

class SettingsUI {
  constructor() {
    this.currentSettings = {};
    this.settingsMetadata = {};
    this.currentCategory = 'Download';
    this.searchQuery = '';
    this.isDirty = false;
    this.pendingChanges = {};
  }

  /**
   * Initialize the settings UI
   * 
   * @param {Object} settings - Current settings values
   * @param {Array} settingsMetadata - Settings metadata with labels, tooltips, etc.
   */
  async initialize(settings, settingsMetadata) {
    this.currentSettings = { ...settings };
    this.settingsMetadata = settingsMetadata;
    this.pendingChanges = {};
    this.isDirty = false;
    
    this._createSettingsPanel();
    this._attachEventListeners();
  }

  /**
   * Create the settings panel HTML structure
   * 
   * @private
   */
  _createSettingsPanel() {
    // Check if panel already exists
    let panel = document.getElementById('settings-panel');
    if (panel) {
      panel.remove();
    }

    // Create main panel container
    panel = document.createElement('div');
    panel.id = 'settings-panel';
    panel.className = 'settings-panel';
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-label', 'Settings Panel');

    // Create header
    const header = document.createElement('div');
    header.className = 'settings-header';
    
    const title = document.createElement('h2');
    title.textContent = 'Settings';
    title.className = 'settings-title';
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'settings-close-btn';
    closeBtn.setAttribute('aria-label', 'Close settings');
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => this.close());
    
    header.appendChild(title);
    header.appendChild(closeBtn);

    // Create search bar
    const searchContainer = document.createElement('div');
    searchContainer.className = 'settings-search-container';
    
    const searchInput = document.createElement('input');
    searchInput.id = 'settings-search';
    searchInput.type = 'text';
    searchInput.placeholder = 'Search settings...';
    searchInput.className = 'settings-search-input';
    searchInput.setAttribute('aria-label', 'Search settings');
    
    searchContainer.appendChild(searchInput);

    // Create main content area
    const content = document.createElement('div');
    content.className = 'settings-content';

    // Create sidebar with categories
    const sidebar = document.createElement('div');
    sidebar.className = 'settings-sidebar';
    sidebar.setAttribute('role', 'navigation');
    sidebar.setAttribute('aria-label', 'Settings categories');
    
    const categories = this._getCategories();
    categories.forEach(category => {
      const btn = document.createElement('button');
      btn.className = 'settings-category-btn';
      btn.textContent = category;
      btn.setAttribute('data-category', category);
      if (category === this.currentCategory) {
        btn.classList.add('active');
      }
      btn.addEventListener('click', () => this._switchCategory(category));
      sidebar.appendChild(btn);
    });

    // Create main settings area
    const mainArea = document.createElement('div');
    mainArea.className = 'settings-main';

    // Create form container
    const formContainer = document.createElement('div');
    formContainer.id = 'settings-form-container';
    formContainer.className = 'settings-form-container';
    
    mainArea.appendChild(formContainer);

    content.appendChild(sidebar);
    content.appendChild(mainArea);

    // Create footer with action buttons
    const footer = document.createElement('div');
    footer.className = 'settings-footer';

    const resetBtn = document.createElement('button');
    resetBtn.className = 'settings-btn settings-btn-secondary';
    resetBtn.textContent = 'Reset to Defaults';
    resetBtn.setAttribute('aria-label', 'Reset all settings to default values');
    resetBtn.addEventListener('click', () => this._handleReset());

    const exportBtn = document.createElement('button');
    exportBtn.className = 'settings-btn settings-btn-secondary';
    exportBtn.textContent = 'Export Settings';
    exportBtn.setAttribute('aria-label', 'Export settings to a JSON file');
    exportBtn.addEventListener('click', () => this._handleExport());

    const importBtn = document.createElement('button');
    importBtn.className = 'settings-btn settings-btn-secondary';
    importBtn.textContent = 'Import Settings';
    importBtn.setAttribute('aria-label', 'Import settings from a JSON file');
    importBtn.addEventListener('click', () => this._handleImport());

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'settings-btn settings-btn-secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => this.close());

    const saveBtn = document.createElement('button');
    saveBtn.id = 'settings-save-btn';
    saveBtn.className = 'settings-btn settings-btn-primary';
    saveBtn.textContent = 'Save Changes';
    saveBtn.disabled = true;
    saveBtn.setAttribute('aria-label', 'Save all changes');
    saveBtn.addEventListener('click', () => this._handleSave());

    footer.appendChild(resetBtn);
    footer.appendChild(exportBtn);
    footer.appendChild(importBtn);
    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);

    // Assemble panel
    panel.appendChild(header);
    panel.appendChild(searchContainer);
    panel.appendChild(content);
    panel.appendChild(footer);

    // Add to document
    document.body.appendChild(panel);

    // Render initial settings
    this._renderSettings();
  }

  /**
   * Render settings form based on current category and search
   * 
   * @private
   */
  _renderSettings() {
    const container = document.getElementById('settings-form-container');
    if (!container) return;

    container.innerHTML = '';

    // Get settings to display
    let settingsToDisplay = this.settingsMetadata;
    
    // Filter by category if not searching
    if (!this.searchQuery) {
      settingsToDisplay = settingsToDisplay.filter(s => s.category === this.currentCategory);
    } else {
      // Filter by search query
      const query = this.searchQuery.toLowerCase();
      settingsToDisplay = settingsToDisplay.filter(s => {
        const searchText = `${s.key} ${s.label} ${s.description}`.toLowerCase();
        return searchText.includes(query);
      });
    }

    if (settingsToDisplay.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'settings-empty';
      empty.textContent = 'No settings found';
      container.appendChild(empty);
      return;
    }

    // Render each setting
    settingsToDisplay.forEach(setting => {
      const group = this._createSettingGroup(setting);
      container.appendChild(group);
    });
  }

  /**
   * Create a setting group (label, input, tooltip)
   * 
   * @private
   * @param {Object} setting - Setting metadata
   * @returns {HTMLElement} Setting group element
   */
  _createSettingGroup(setting) {
    const group = document.createElement('div');
    group.className = 'settings-group';

    // Label with tooltip
    const labelContainer = document.createElement('div');
    labelContainer.className = 'settings-label-container';

    const label = document.createElement('label');
    label.htmlFor = `setting-${setting.key}`;
    label.className = 'settings-label';
    label.textContent = setting.label;

    const tooltip = document.createElement('div');
    tooltip.className = 'settings-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    tooltip.textContent = setting.tooltip;

    const tooltipIcon = document.createElement('span');
    tooltipIcon.className = 'settings-tooltip-icon';
    tooltipIcon.textContent = '?';
    tooltipIcon.setAttribute('aria-describedby', `tooltip-${setting.key}`);
    tooltipIcon.addEventListener('mouseenter', () => {
      tooltip.style.display = 'block';
    });
    tooltipIcon.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });

    labelContainer.appendChild(label);
    labelContainer.appendChild(tooltipIcon);
    labelContainer.appendChild(tooltip);

    // Input based on type
    let input;
    if (setting.type === 'boolean') {
      input = document.createElement('input');
      input.id = `setting-${setting.key}`;
      input.type = 'checkbox';
      input.className = 'settings-input settings-checkbox';
      input.checked = this.currentSettings[setting.key];
      input.setAttribute('aria-label', setting.description);
    } else if (setting.type === 'number') {
      input = document.createElement('input');
      input.id = `setting-${setting.key}`;
      input.type = 'number';
      input.className = 'settings-input settings-number';
      input.value = this.currentSettings[setting.key];
      if (setting.min !== undefined) input.min = setting.min;
      if (setting.max !== undefined) input.max = setting.max;
      if (setting.step !== undefined) input.step = setting.step;
      input.setAttribute('aria-label', setting.description);
    } else {
      input = document.createElement('input');
      input.id = `setting-${setting.key}`;
      input.type = 'text';
      input.className = 'settings-input settings-text';
      input.value = this.currentSettings[setting.key];
      input.setAttribute('aria-label', setting.description);
    }

    // Add change listener
    input.addEventListener('change', () => {
      const value = input.type === 'checkbox' ? input.checked : 
                   input.type === 'number' ? parseFloat(input.value) : 
                   input.value;
      
      this.pendingChanges[setting.key] = value;
      this.isDirty = true;
      this._updateSaveButton();
    });

    // Description
    const description = document.createElement('p');
    description.className = 'settings-description';
    description.textContent = setting.description;

    group.appendChild(labelContainer);
    group.appendChild(input);
    group.appendChild(description);

    return group;
  }

  /**
   * Switch to a different category
   * 
   * @private
   * @param {string} category - Category name
   */
  _switchCategory(category) {
    this.currentCategory = category;
    this.searchQuery = '';
    
    // Update active button
    document.querySelectorAll('.settings-category-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.getAttribute('data-category') === category) {
        btn.classList.add('active');
      }
    });

    // Clear search
    const searchInput = document.getElementById('settings-search');
    if (searchInput) {
      searchInput.value = '';
    }

    this._renderSettings();
  }

  /**
   * Handle search input
   * 
   * @private
   * @param {string} query - Search query
   */
  _handleSearch(query) {
    this.searchQuery = query;
    this._renderSettings();
  }

  /**
   * Handle save button click
   * 
   * @private
   */
  async _handleSave() {
    try {
      // Validate all pending changes
      for (const [key, value] of Object.entries(this.pendingChanges)) {
        const setting = this.settingsMetadata.find(s => s.key === key);
        if (!setting) continue;

        // Type validation (text is a string, not literally the word 'text')
        const expectedType = setting.type;
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        const typeOk =
          (expectedType === 'text' && actualType === 'string') ||
          (expectedType === 'boolean' && actualType === 'boolean') ||
          (expectedType === 'number' && actualType === 'number') ||
          (expectedType === 'array' && Array.isArray(value)) ||
          (expectedType === actualType);

        if (!typeOk) {
          await showAlertDialog({ title: 'Invalid Setting', message: `Invalid value for ${setting.label}: expected ${expectedType}, got ${actualType}`, variant: 'error' });
          return;
        }

        // Range validation
        if (expectedType === 'number') {
          if (setting.min !== undefined && value < setting.min) {
            await showAlertDialog({ title: 'Invalid Setting', message: `${setting.label} must be at least ${setting.min}`, variant: 'error' });
            return;
          }
          if (setting.max !== undefined && value > setting.max) {
            await showAlertDialog({ title: 'Invalid Setting', message: `${setting.label} must be at most ${setting.max}`, variant: 'error' });
            return;
          }
        }
      }

      // Save settings via IPC
      await window.electronAPI.saveSettings(this.pendingChanges);
      
      // Update current settings
      Object.assign(this.currentSettings, this.pendingChanges);
      this.pendingChanges = {};
      this.isDirty = false;
      this._updateSaveButton();

      await showAlertDialog({ title: 'Settings Saved', message: 'Settings saved successfully', variant: 'success' });
      this.close();
    } catch (error) {
      console.error('[SettingsUI] Error saving settings:', error);
      await showAlertDialog({ title: 'Save Error', message: `Error saving settings: ${error.message}`, variant: 'error' });
    }
  }

  /**
   * Handle reset to defaults
   * 
   * @private
   */
  async _handleReset() {
    if (!confirm('Reset all settings to defaults? This cannot be undone.')) {
      return;
    }

    try {
      await window.electronAPI.resetSettings();
      
      // Reload settings — backend wraps in { success, settings }
      const result = await window.electronAPI.loadSettings();
      const settings = (result && result.settings) ? result.settings : (result || {});
      this.currentSettings = { ...settings };
      this.pendingChanges = {};
      this.isDirty = false;
      this._updateSaveButton();
      this._renderSettings();

      await showAlertDialog({ title: 'Settings Reset', message: 'Settings reset to defaults', variant: 'success' });
    } catch (error) {
      console.error('[SettingsUI] Error resetting settings:', error);
      await showAlertDialog({ title: 'Reset Error', message: `Error resetting settings: ${error.message}`, variant: 'error' });
    }
  }

  /**
   * Handle export settings
   * 
   * @private
   */
  async _handleExport() {
    try {
      await window.electronAPI.exportSettings();
      await showAlertDialog({ title: 'Exported', message: 'Settings exported successfully', variant: 'success' });
    } catch (error) {
      console.error('[SettingsUI] Error exporting settings:', error);
      await showAlertDialog({ title: 'Export Error', message: `Error exporting settings: ${error.message}`, variant: 'error' });
    }
  }

  /**
   * Handle import settings
   * 
   * @private
   */
  async _handleImport() {
    try {
      const result = await window.electronAPI.importSettings();
      // Backend returns { success, settings } — unwrap before storing.
      const settings = (result && result.settings) ? result.settings : (result || {});
      this.currentSettings = { ...settings };
      this.pendingChanges = {};
      this.isDirty = false;
      this._updateSaveButton();
      this._renderSettings();

      await showAlertDialog({ title: 'Imported', message: 'Settings imported successfully', variant: 'success' });
    } catch (error) {
      console.error('[SettingsUI] Error importing settings:', error);
      await showAlertDialog({ title: 'Import Error', message: `Error importing settings: ${error.message}`, variant: 'error' });
    }
  }

  /**
   * Update save button state
   * 
   * @private
   */
  _updateSaveButton() {
    const saveBtn = document.getElementById('settings-save-btn');
    if (saveBtn) {
      saveBtn.disabled = !this.isDirty;
    }
  }

  /**
   * Attach event listeners
   * 
   * @private
   */
  _attachEventListeners() {
    const searchInput = document.getElementById('settings-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this._handleSearch(e.target.value);
      });
    }
  }

  /**
   * Get unique categories
   * 
   * @private
   * @returns {Array<string>} List of categories
   */
  _getCategories() {
    const categories = new Set();
    this.settingsMetadata.forEach(setting => {
      categories.add(setting.category);
    });
    return Array.from(categories).sort();
  }

  /**
   * Show the settings panel
   */
  show() {
    const panel = document.getElementById('settings-panel');
    if (panel) {
      panel.style.display = 'flex';
      panel.focus();
    }
  }

  /**
   * Close the settings panel
   */
  close() {
    const panel = document.getElementById('settings-panel');
    if (panel) {
      panel.style.display = 'none';
    }
  }

  /**
   * Check if settings panel is visible
   * 
   * @returns {boolean} True if visible
   */
  isVisible() {
    const panel = document.getElementById('settings-panel');
    return panel && panel.style.display !== 'none';
  }
}

// Export for use in main.js
export default SettingsUI;

// Options page script for Rocketer extension
class RocketerOptions {
    constructor() {
        this.defaultSettings = {
            enableNotifications: true,
            notificationTiming: 60,
            soundNotifications: false,
            updateInterval: 30,
            autoRefresh: true,
            filterSpaceX: true,
            filterNASA: true,
            filterULA: true,
            filterBlueOrigin: true,
            filterRocketLab: true,
            filterESA: true,
            filterISRO: true,
            filterJAXA: true,
            filterCNSA: true,
            filterRoscosmos: true,
            filterOthers: true,
            onlyWithStreams: false,
            theme: 'auto',
            compactMode: false,
            showBadge: true
        };
        
        this.currentSettings = { ...this.defaultSettings };
        this.init();
    }

    async init() {
        await this.loadSettings();
        this.setupEventListeners();
        this.applySettings();
    }

    async loadSettings() {
        try {
            const result = await chrome.storage.sync.get(this.defaultSettings);
            this.currentSettings = { ...this.defaultSettings, ...result };
            this.populateForm();
        } catch (error) {
            console.error('Error loading settings:', error);
            this.showSaveIndicator('Error loading settings', 'error');
        }
    }

    populateForm() {
        // Checkboxes
        Object.keys(this.currentSettings).forEach(key => {
            const element = document.getElementById(key);
            if (element && element.type === 'checkbox') {
                element.checked = this.currentSettings[key];
            }
        });

        // Select dropdowns
        const selects = ['notificationTiming', 'updateInterval', 'theme'];
        selects.forEach(key => {
            const element = document.getElementById(key);
            if (element && element.tagName === 'SELECT') {
                element.value = this.currentSettings[key];
            }
        });
    }

    setupEventListeners() {
        // All form inputs
        const inputs = document.querySelectorAll('input, select');
        inputs.forEach(input => {
            input.addEventListener('change', () => {
                this.handleSettingChange(input);
            });
        });

        // Action buttons
        document.getElementById('refreshNowBtn').addEventListener('click', () => {
            this.refreshLaunches();
        });

        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportSettings();
        });

        document.getElementById('importBtn').addEventListener('click', () => {
            this.importSettings();
        });

        document.getElementById('resetBtn').addEventListener('click', () => {
            this.resetSettings();
        });

        // File input for import
        document.getElementById('importFile').addEventListener('change', (event) => {
            this.handleFileImport(event);
        });
    }

    async handleSettingChange(input) {
        const { id, type, checked, value } = input;
        
        // Update current settings
        if (type === 'checkbox') {
            this.currentSettings[id] = checked;
        } else {
            this.currentSettings[id] = type === 'number' ? parseInt(value) : value;
        }

        // Save to storage
        try {
            await chrome.storage.sync.set({ [id]: this.currentSettings[id] });
            this.showSaveIndicator();
            
            // Apply changes that need immediate effect
            this.applySettings();
            
            // Notify background script of important changes
            if (['updateInterval', 'notificationTiming', 'enableNotifications'].includes(id)) {
                await this.notifyBackgroundScript();
            }
            
        } catch (error) {
            console.error('Error saving setting:', error);
            this.showSaveIndicator('Error saving settings', 'error');
        }
    }

    applySettings() {
        // Apply theme
        this.applyTheme();
        
        // Update notification status
        this.updateNotificationStatus();
    }

    applyTheme() {
        const theme = this.currentSettings.theme;
        const body = document.body;
        
        // Remove existing theme classes
        body.classList.remove('theme-light', 'theme-dark');
        
        if (theme === 'light') {
            body.classList.add('theme-light');
        } else if (theme === 'dark') {
            body.classList.add('theme-dark');
        } else {
            // Auto theme - use system preference
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                body.classList.add('theme-dark');
            } else {
                body.classList.add('theme-light');
            }
        }
    }

    async updateNotificationStatus() {
        if (this.currentSettings.enableNotifications) {
            try {
                const permission = await chrome.notifications.getPermissionLevel();
                if (permission !== 'granted') {
                    // Show warning about notification permissions
                    console.warn('Notification permission not granted');
                }
            } catch (error) {
                console.error('Error checking notification permissions:', error);
            }
        }
    }

    async notifyBackgroundScript() {
        try {
            await chrome.runtime.sendMessage({
                action: 'settingsUpdated',
                settings: this.currentSettings
            });
        } catch (error) {
            console.error('Error notifying background script:', error);
        }
    }

    async refreshLaunches() {
        const button = document.getElementById('refreshNowBtn');
        const originalText = button.innerHTML;
        
        // Show loading state
        button.innerHTML = '<span class="btn-icon">⏳</span>Refreshing...';
        button.disabled = true;
        
        try {
            await chrome.runtime.sendMessage({ action: 'refreshLaunches' });
            button.innerHTML = '<span class="btn-icon">✓</span>Refreshed!';
            
            setTimeout(() => {
                button.innerHTML = originalText;
                button.disabled = false;
            }, 2000);
            
        } catch (error) {
            console.error('Error refreshing launches:', error);
            button.innerHTML = '<span class="btn-icon">❌</span>Error';
            
            setTimeout(() => {
                button.innerHTML = originalText;
                button.disabled = false;
            }, 2000);
        }
    }

    exportSettings() {
        const settings = {
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            settings: this.currentSettings
        };
        
        const blob = new Blob([JSON.stringify(settings, null, 2)], {
            type: 'application/json'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rocketer-settings-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showSaveIndicator('Settings exported successfully!');
    }

    importSettings() {
        document.getElementById('importFile').click();
    }

    async handleFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            if (data.settings) {
                // Validate settings
                const validatedSettings = this.validateImportedSettings(data.settings);
                
                // Update current settings
                this.currentSettings = { ...this.defaultSettings, ...validatedSettings };
                
                // Save to storage
                await chrome.storage.sync.set(this.currentSettings);
                
                // Update form
                this.populateForm();
                this.applySettings();
                
                this.showSaveIndicator('Settings imported successfully!');
                
                // Notify background script
                await this.notifyBackgroundScript();
                
            } else {
                throw new Error('Invalid settings file format');
            }
            
        } catch (error) {
            console.error('Error importing settings:', error);
            this.showSaveIndicator('Error importing settings', 'error');
        }
        
        // Reset file input
        event.target.value = '';
    }

    validateImportedSettings(importedSettings) {
        const validated = {};
        
        Object.keys(this.defaultSettings).forEach(key => {
            if (importedSettings.hasOwnProperty(key)) {
                const value = importedSettings[key];
                const defaultValue = this.defaultSettings[key];
                
                // Type validation
                if (typeof value === typeof defaultValue) {
                    validated[key] = value;
                } else {
                    validated[key] = defaultValue;
                }
            } else {
                validated[key] = this.defaultSettings[key];
            }
        });
        
        return validated;
    }

    async resetSettings() {
        if (!confirm('Are you sure you want to reset all settings to defaults? This action cannot be undone.')) {
            return;
        }
        
        try {
            // Clear all settings
            await chrome.storage.sync.clear();
            
            // Reset to defaults
            this.currentSettings = { ...this.defaultSettings };
            await chrome.storage.sync.set(this.currentSettings);
            
            // Update form
            this.populateForm();
            this.applySettings();
            
            this.showSaveIndicator('Settings reset to defaults');
            
            // Notify background script
            await this.notifyBackgroundScript();
            
        } catch (error) {
            console.error('Error resetting settings:', error);
            this.showSaveIndicator('Error resetting settings', 'error');
        }
    }

    showSaveIndicator(message = 'Settings saved automatically', type = 'success') {
        const indicator = document.getElementById('saveIndicator');
        const icon = indicator.querySelector('.save-icon');
        
        // Update message
        const textNode = indicator.lastChild;
        if (textNode.nodeType === Node.TEXT_NODE) {
            textNode.textContent = message;
        }
        
        // Update appearance based on type
        if (type === 'error') {
            indicator.style.color = '#e74c3c';
            icon.style.background = '#e74c3c';
            icon.textContent = '!';
        } else {
            indicator.style.color = '#28a745';
            icon.style.background = '#28a745';
            icon.textContent = '✓';
        }
        
        // Show indicator
        indicator.classList.add('show');
        
        // Hide after 3 seconds
        setTimeout(() => {
            indicator.classList.remove('show');
        }, 3000);
    }

    // Listen for system theme changes
    setupThemeListener() {
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            mediaQuery.addListener(() => {
                if (this.currentSettings.theme === 'auto') {
                    this.applyTheme();
                }
            });
        }
    }
}

// Initialize options page
document.addEventListener('DOMContentLoaded', () => {
    const options = new RocketerOptions();
    
    // Setup theme listener
    options.setupThemeListener();
    
    // Add some additional UI enhancements
    setupUIEnhancements();
});

function setupUIEnhancements() {
    // Add smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // Add hover effects for sections
    const sections = document.querySelectorAll('.settings-section');
    sections.forEach((section, index) => {
        section.style.animationDelay = `${index * 0.1}s`;
    });
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + S to save (though settings auto-save)
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            // Show save indicator as feedback
            const options = new RocketerOptions();
            options.showSaveIndicator('Settings are auto-saved!');
        }
        
        // Escape to close if in popup context
        if (e.key === 'Escape' && window.location.search.includes('popup=true')) {
            window.close();
        }
    });
}

// Handle messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'settingsRequested') {
        // Send current settings to requesting script
        sendResponse({ settings: options.currentSettings });
    }
}); 
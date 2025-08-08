/** Rocketer options page controller */

class RocketerOptions {
    constructor() {
        this.defaultSettings = {
            enableNotifications: true,
            notificationTiming: 60,
            soundNotifications: false,
            updateInterval: 30,
            autoRefresh: true,
            devMode: false,
            dataProvider: 'spacedevs'
        };
        
        this.currentSettings = { ...this.defaultSettings };
        this.init();
    }

    async init() {
        await this.loadSettings();
        this.setupEventListeners();
        this.applySettings();
        this.showVersion();
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
        const selects = ['notificationTiming', 'updateInterval', 'dataProvider'];
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


        // No extra test PiP controls anymore

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
        // Update notification status
        this.updateNotificationStatus();
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


    async resetSettings() {
        // Reset removed in production; no-op
    }

    showVersion() {
        const el = document.getElementById('appVersion');
        if (!el) return;
        try {
            const manifest = chrome.runtime.getManifest();
            el.textContent = `v${manifest.version}`;
        } catch (_) {
            // keep default
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


}


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
            document.getElementById('saveIndicator').classList.add('show');
            setTimeout(() => {
                document.getElementById('saveIndicator').classList.remove('show');
            }, 3000);
        }
        
        // Escape to close if in popup context
        if (e.key === 'Escape' && window.location.search.includes('popup=true')) {
            window.close();
        }
    });
}

// Global options instance for message handling
let globalOptions = null;

// Initialize options page
document.addEventListener('DOMContentLoaded', () => {
    globalOptions = new RocketerOptions();
    
    // Add some additional UI enhancements
    setupUIEnhancements();
});

// Handle messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'settingsRequested') {
        // Send current settings to requesting script
        if (globalOptions) {
            sendResponse({ settings: globalOptions.currentSettings });
        } else {
            sendResponse({ settings: {} });
        }
    }
}); 
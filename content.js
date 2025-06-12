// Content script for Rocketer extension
// This script runs on all pages and handles any page-specific functionality

class RocketerContent {
    constructor() {
        this.init();
    }

    init() {
        this.setupMessageListener();
        this.injectStyles();
    }

    setupMessageListener() {
        // Listen for messages from background script or popup
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            switch (message.action) {
                case 'showLaunchNotification':
                    this.showInPageNotification(message.launch);
                    break;
                case 'initPiP':
                    // Handle PiP initialization if this is the PiP page
                    if (window.location.href.includes('pip.html')) {
                        this.initializePiP(message.streamUrl, message.launchName);
                    }
                    break;
            }
        });
    }

    injectStyles() {
        // Inject styles for in-page notifications
        const style = document.createElement('style');
        style.textContent = `
            .rocketer-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 16px 20px;
                border-radius: 12px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                z-index: 10000;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                max-width: 350px;
                animation: slideInRight 0.5s ease-out;
                backdrop-filter: blur(10px);
            }

            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }

            .rocketer-notification-header {
                display: flex;
                align-items: center;
                margin-bottom: 8px;
            }

            .rocketer-notification-icon {
                font-size: 20px;
                margin-right: 8px;
            }

            .rocketer-notification-title {
                font-weight: 600;
                font-size: 16px;
                margin: 0;
            }

            .rocketer-notification-close {
                margin-left: auto;
                background: none;
                border: none;
                color: white;
                cursor: pointer;
                font-size: 18px;
                opacity: 0.7;
                transition: opacity 0.2s;
            }

            .rocketer-notification-close:hover {
                opacity: 1;
            }

            .rocketer-notification-content {
                font-size: 14px;
                line-height: 1.4;
                margin-bottom: 12px;
            }

            .rocketer-notification-actions {
                display: flex;
                gap: 8px;
            }

            .rocketer-notification-btn {
                background: rgba(255,255,255,0.2);
                color: white;
                border: none;
                padding: 6px 12px;
                border-radius: 6px;
                font-size: 12px;
                cursor: pointer;
                transition: background 0.2s;
                backdrop-filter: blur(10px);
            }

            .rocketer-notification-btn:hover {
                background: rgba(255,255,255,0.3);
            }

            .rocketer-notification-btn.primary {
                background: rgba(255,255,255,0.9);
                color: #667eea;
            }

            .rocketer-notification-btn.primary:hover {
                background: white;
            }
        `;
        document.head.appendChild(style);
    }

    showInPageNotification(launch) {
        // Remove any existing notifications
        const existing = document.querySelector('.rocketer-notification');
        if (existing) {
            existing.remove();
        }

        const notification = document.createElement('div');
        notification.className = 'rocketer-notification';
        
        const streamUrl = this.getStreamUrl(launch);
        const launchTime = new Date(launch.net);
        const now = new Date();
        const minutesUntilLaunch = Math.floor((launchTime - now) / (1000 * 60));

        notification.innerHTML = `
            <div class="rocketer-notification-header">
                <span class="rocketer-notification-icon">🚀</span>
                <h4 class="rocketer-notification-title">Rocket Launch Alert!</h4>
                <button class="rocketer-notification-close" onclick="this.closest('.rocketer-notification').remove()">×</button>
            </div>
            <div class="rocketer-notification-content">
                <strong>${launch.name}</strong><br>
                Launching in ${minutesUntilLaunch} minutes
            </div>
            <div class="rocketer-notification-actions">
                ${streamUrl ? `
                    <button class="rocketer-notification-btn primary" onclick="window.open('${streamUrl}', '_blank')">
                        Watch Live
                    </button>
                    <button class="rocketer-notification-btn" onclick="this.openPiP('${streamUrl}', '${launch.name}')">
                        Picture-in-Picture
                    </button>
                ` : ''}
                <button class="rocketer-notification-btn" onclick="this.closest('.rocketer-notification').remove()">
                    Dismiss
                </button>
            </div>
        `;

        document.body.appendChild(notification);

        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 10000);
    }

    getStreamUrl(launch) {
        if (launch.vid_urls && launch.vid_urls.length > 0) {
            return launch.vid_urls[0].url;
        }
        return null;
    }

    // Helper method for PiP (called from notification HTML)
    openPiP(streamUrl, launchName) {
        chrome.runtime.sendMessage({
            action: 'openPiP',
            streamUrl: streamUrl,
            launchName: launchName
        });
    }

    initializePiP(streamUrl, launchName) {
        // This method would be called if the content script is running on the PiP page
        if (window.initializePiP) {
            window.streamUrl = streamUrl;
            window.launchName = launchName;
            window.initializePiP();
        }
    }

    // Method to check if user is on a streaming platform and enhance experience
    enhanceStreamingExperience() {
        const hostname = window.location.hostname;
        
        if (hostname.includes('youtube.com')) {
            this.enhanceYouTube();
        } else if (hostname.includes('twitch.tv')) {
            this.enhanceTwitch();
        }
    }

    enhanceYouTube() {
        // Add rocket launch detection for YouTube videos
        const titleElement = document.querySelector('h1.title yt-formatted-string');
        if (titleElement) {
            const title = titleElement.textContent.toLowerCase();
            if (title.includes('launch') || title.includes('rocket') || title.includes('spacex') || title.includes('nasa')) {
                this.addLaunchIndicator();
            }
        }
    }

    enhanceTwitch() {
        // Similar enhancement for Twitch streams
        const titleElement = document.querySelector('[data-a-target="stream-title"]');
        if (titleElement) {
            const title = titleElement.textContent.toLowerCase();
            if (title.includes('launch') || title.includes('rocket') || title.includes('spacex') || title.includes('nasa')) {
                this.addLaunchIndicator();
            }
        }
    }

    addLaunchIndicator() {
        // Add a small indicator that this might be a rocket launch stream
        if (document.querySelector('.rocketer-indicator')) return;

        const indicator = document.createElement('div');
        indicator.className = 'rocketer-indicator';
        indicator.innerHTML = '🚀 Rocket Launch Stream';
        indicator.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            z-index: 10000;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            backdrop-filter: blur(10px);
        `;

        document.body.appendChild(indicator);

        // Remove after 5 seconds
        setTimeout(() => {
            if (indicator.parentNode) {
                indicator.remove();
            }
        }, 5000);
    }
}

// Initialize content script
const rocketerContent = new RocketerContent();

// Enhance streaming experience on page load
document.addEventListener('DOMContentLoaded', () => {
    rocketerContent.enhanceStreamingExperience();
});

// Also check after dynamic content loads
setTimeout(() => {
    rocketerContent.enhanceStreamingExperience();
}, 2000); 
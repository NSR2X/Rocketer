// Popup script for Rocketer extension - Updated version with comprehensive error handling
class RocketerPopup {
    constructor() {
        this.launches = [];
        this.countdownInterval = null;
        this.debugMode = true; // Enable detailed logging
        this.init();
    }

    async init() {
        console.log('🚀 Rocketer popup initialized - VERSION 1.2.2 with enhanced countdown + word wrap');
        console.log('DOM ready state:', document.readyState);
        console.log('Current URL:', window.location.href);
        console.log('Document title:', document.title);
        
        // Verify we're on the right page
        this.verifyCorrectPage();
        
        // Check for layout issues
        this.checkLayoutIntegrity();
        
        this.setupEventListeners();
        await this.loadLaunches();
        this.startCountdownUpdates();
    }

    verifyCorrectPage() {
        // Check if we're accidentally loading the options page
        const hasCheckboxes = document.querySelectorAll('input[type="checkbox"]').length > 0;
        const hasSettingsGrid = document.querySelector('.settings-grid') !== null;
        const hasLaunchContainer = document.querySelector('#launchesContainer') !== null;
        
        console.log('🔍 Page verification:');
        console.log('- Has checkboxes:', hasCheckboxes);
        console.log('- Has settings grid:', hasSettingsGrid);
        console.log('- Has launch container:', hasLaunchContainer);
        
        if (hasCheckboxes || hasSettingsGrid) {
            console.error('❌ WRONG PAGE DETECTED! Options page is loading instead of popup!');
            this.handleWrongPageError();
            return false;
        }
        
        if (!hasLaunchContainer) {
            console.error('❌ POPUP HTML CORRUPTED! Launch container not found!');
            this.handleCorruptedHTMLError();
            return false;
        }
        
        console.log('✅ Correct popup page verified');
        return true;
    }

    checkLayoutIntegrity() {
        const body = document.body;
        const container = document.querySelector('.container');
        
        console.log('📐 Layout check:');
        console.log('- Body width:', body.offsetWidth, 'px');
        console.log('- Body computed width:', getComputedStyle(body).width);
        console.log('- Container width:', container ? container.offsetWidth : 'N/A', 'px');
        console.log('- Viewport width:', window.innerWidth, 'px');
        
        // Check for extremely narrow width (user's "few pixels" issue)
        if (body.offsetWidth < 100) {
            console.error('❌ LAYOUT COLLAPSE DETECTED! Body width too narrow:', body.offsetWidth, 'px');
            this.handleLayoutCollapseError();
        }
        
        // Check if CSS is loading properly
        const computedStyle = getComputedStyle(body);
        const expectedWidth = '400px';
        if (computedStyle.width !== expectedWidth) {
            console.error('❌ CSS NOT APPLIED CORRECTLY! Expected width:', expectedWidth, 'Got:', computedStyle.width);
            this.handleCSSError();
        }
    }

    handleWrongPageError() {
        document.body.innerHTML = `
            <div style="padding: 20px; text-align: center; color: red;">
                <h3>⚠️ Error: Wrong Page Loaded</h3>
                <p>The options page is loading instead of the popup.</p>
                <p>This indicates a manifest or Chrome caching issue.</p>
                <button onclick="window.close()" style="margin-top: 10px; padding: 8px 16px;">Close</button>
            </div>
        `;
    }

    handleCorruptedHTMLError() {
        document.body.innerHTML = `
            <div style="padding: 20px; text-align: center; color: red;">
                <h3>⚠️ Error: Popup HTML Corrupted</h3>
                <p>Essential popup elements are missing.</p>
                <p>Please reload the extension.</p>
                <button onclick="window.close()" style="margin-top: 10px; padding: 8px 16px;">Close</button>
            </div>
        `;
    }

    handleLayoutCollapseError() {
        // Force correct dimensions
        document.body.style.width = '400px';
        document.body.style.minWidth = '400px';
        document.body.style.maxWidth = '400px';
        
        const container = document.querySelector('.container');
        if (container) {
            container.style.width = '100%';
            container.style.minWidth = '400px';
        }
        
        console.log('🔧 Applied emergency layout fixes');
    }

    handleCSSError() {
        // Force load CSS if it failed
        const existingLink = document.querySelector('link[href*="popup.css"]');
        if (!existingLink) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'styles/popup.css';
            document.head.appendChild(link);
            console.log('🔧 Re-injected CSS link');
        }
    }

    setupEventListeners() {
        console.log('🔧 Setting up event listeners...');
        
        // Refresh button
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.refreshLaunches();
            });
        } else {
            console.error('❌ refreshBtn not found');
        }

        // Retry buttons
        const retryBtn = document.getElementById('retryBtn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                this.loadLaunches();
            });
        } else {
            console.error('❌ retryBtn not found');
        }

        const checkAgainBtn = document.getElementById('checkAgainBtn');
        if (checkAgainBtn) {
            checkAgainBtn.addEventListener('click', () => {
                this.refreshLaunches();
            });
        } else {
            console.error('❌ checkAgainBtn not found');
        }

        // Footer buttons
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
                window.close();
            });
        } else {
            console.error('❌ settingsBtn not found');
        }

        const aboutBtn = document.getElementById('aboutBtn');
        if (aboutBtn) {
            aboutBtn.addEventListener('click', () => {
                this.showAbout();
            });
        } else {
            console.error('❌ aboutBtn not found');
        }
        
        console.log('✅ Event listeners setup complete');
    }

    async loadLaunches() {
        this.showLoading();
        
        try {
            // Get launches from storage
            const result = await chrome.storage.local.get(['upcomingLaunches', 'lastUpdate']);
            const { upcomingLaunches = [], lastUpdate } = result;
            
            // Apply provider filtering
            this.launches = await this.filterLaunchesByProvider(upcomingLaunches);
            this.updateLastUpdateTime(lastUpdate);
            
            if (this.launches.length === 0) {
                this.showNoLaunches();
            } else {
                this.displayLaunches();
            }
            
            this.updateStatus(`${this.launches.length} upcoming launches`);
            
        } catch (error) {
            console.error('Error loading launches:', error);
            this.showError();
        }
    }

    async filterLaunchesByProvider(launches) {
        // Get user filter settings
        const settings = await chrome.storage.sync.get([
            'filterSpaceX', 'filterNASA', 'filterULA', 'filterBlueOrigin',
            'filterRocketLab', 'filterESA', 'filterISRO', 'filterJAXA',
            'filterCNSA', 'filterRoscosmos', 'filterOthers'
        ]);

        return launches.filter(launch => {
            const provider = launch.launch_service_provider?.name?.toLowerCase() || '';
            
            // Map providers to filter settings
            if (provider.includes('spacex') && settings.filterSpaceX) return true;
            if (provider.includes('nasa') && settings.filterNASA) return true;
            if (provider.includes('ula') && settings.filterULA) return true;
            if (provider.includes('blue origin') && settings.filterBlueOrigin) return true;
            if (provider.includes('rocket lab') && settings.filterRocketLab) return true;
            if ((provider.includes('esa') || provider.includes('european')) && settings.filterESA) return true;
            if (provider.includes('isro') && settings.filterISRO) return true;
            if (provider.includes('jaxa') && settings.filterJAXA) return true;
            if ((provider.includes('cnsa') || provider.includes('china')) && settings.filterCNSA) return true;
            if ((provider.includes('roscosmos') || provider.includes('russia')) && settings.filterRoscosmos) return true;
            
            // All other providers fall under "Others"
            if (settings.filterOthers) {
                const knownProviders = ['spacex', 'nasa', 'ula', 'blue origin', 'rocket lab', 'esa', 'european', 'isro', 'jaxa', 'cnsa', 'china', 'roscosmos', 'russia'];
                return !knownProviders.some(known => provider.includes(known));
            }
            
            return false;
        });
    }

    async refreshLaunches() {
        // Trigger background refresh
        await chrome.runtime.sendMessage({ action: 'refreshLaunches' });
        
        // Reload data
        setTimeout(() => {
            this.loadLaunches();
        }, 1000);
    }

    showLoading() {
        const elements = {
            loadingSpinner: document.getElementById('loadingSpinner'),
            launchesContainer: document.getElementById('launchesContainer'),
            noLaunches: document.getElementById('noLaunches'),
            errorState: document.getElementById('errorState')
        };
        
        // Defensive check - make sure all elements exist
        Object.entries(elements).forEach(([name, element]) => {
            if (!element) {
                console.error(`Element not found: ${name}`);
                return;
            }
        });
        
        if (elements.loadingSpinner) elements.loadingSpinner.style.display = 'flex';
        if (elements.launchesContainer) elements.launchesContainer.style.display = 'none';
        if (elements.noLaunches) elements.noLaunches.style.display = 'none';
        if (elements.errorState) elements.errorState.style.display = 'none';
        this.updateStatus('Loading...');
    }

    showNoLaunches() {
        document.getElementById('loadingSpinner').style.display = 'none';
        document.getElementById('launchesContainer').style.display = 'none';
        document.getElementById('noLaunches').style.display = 'block';
        document.getElementById('errorState').style.display = 'none';
    }

    showError() {
        document.getElementById('loadingSpinner').style.display = 'none';
        document.getElementById('launchesContainer').style.display = 'none';
        document.getElementById('noLaunches').style.display = 'none';
        document.getElementById('errorState').style.display = 'block';
        this.updateStatus('Error loading launches');
    }

    displayLaunches() {
        console.log('🎯 displayLaunches called, launches count:', this.launches.length);
        
        const container = document.getElementById('launchesContainer');
        const template = document.getElementById('launchCardTemplate');
        
        // Defensive checks
        if (!container) {
            console.error('❌ launchesContainer element not found!');
            return;
        }
        if (!template) {
            console.error('❌ launchCardTemplate element not found!');
            return;
        }
        
        // Clear existing content
        container.innerHTML = '';
        
        // Sort launches by time
        const sortedLaunches = [...this.launches].sort((a, b) => 
            new Date(a.net) - new Date(b.net)
        );
        
        sortedLaunches.forEach((launch, index) => {
            try {
                const card = this.createLaunchCard(launch, template);
                if (card) {
                    container.appendChild(card);
                }
            } catch (error) {
                console.error('❌ Error creating launch card:', error);
            }
        });
        
        // Safe element updates with defensive checks
        const loadingSpinner = document.getElementById('loadingSpinner');
        const launchesContainer = document.getElementById('launchesContainer');
        const noLaunches = document.getElementById('noLaunches');
        const errorState = document.getElementById('errorState');
        
        if (loadingSpinner) loadingSpinner.style.display = 'none';
        if (launchesContainer) launchesContainer.style.display = 'flex';
        if (noLaunches) noLaunches.style.display = 'none';
        if (errorState) errorState.style.display = 'none';
        
        console.log('✅ displayLaunches completed successfully');
    }

    createLaunchCard(launch, template) {
        const card = template.content.cloneNode(true);
        const cardElement = card.querySelector('.launch-card');
        
        // Basic info
        card.querySelector('.launch-name').textContent = launch.name || 'Unknown Mission';
        card.querySelector('.launch-provider').textContent = 
            launch.launch_service_provider?.name || 'Unknown Provider';
        
        // Date and location
        const launchDate = new Date(launch.net);
        card.querySelector('.launch-date').textContent = this.formatDate(launchDate);
        card.querySelector('.launch-location').textContent = 
            launch.pad?.name || launch.pad?.location?.name || 'Unknown Location';
        
        // Mission description
        const missionEl = card.querySelector('.launch-mission');
        const mission = launch.mission?.description || launch.mission?.name || 'No description available';
        missionEl.textContent = mission;
        missionEl.title = mission; // Tooltip for full text
        
        // Countdown and 24H highlighting
        this.updateCountdown(card, launch);
        
        // Highlight if within 24 hours
        if (launch.minutesUntilLaunch <= 1440) {
            cardElement.classList.add('next-24h');
        }
        
        // Mark as urgent if launching soon
        if (launch.minutesUntilLaunch <= 60) {
            cardElement.classList.add('urgent');
        }
        
        // Setup buttons with new logic
        this.setupLaunchButtons(card, launch);
        
        return card;
    }

    setupLaunchButtons(card, launch) {
        const playStreamBtn = card.querySelector('.watch-pip');
        const moreInfoBtn = card.querySelector('.more-info');
        
        // Play Stream button - simple stream handling
        const streamUrl = this.getStreamUrl(launch);
        if (streamUrl) {
            playStreamBtn.style.display = 'flex';
            playStreamBtn.innerHTML = '<span class="btn-icon">📺</span>Watch Live';
            playStreamBtn.addEventListener('click', () => {
                this.openPictureInPicture(streamUrl, launch);
            });
        } else {
            playStreamBtn.style.display = 'none';
        }
        
        // More Info button - show details within extension
        moreInfoBtn.addEventListener('click', () => {
            this.showLaunchDetails(launch);
        });
    }

    getStreamUrl(launch) {
        // Use enhanced streams if available, otherwise fallback to API streams
        if (launch.enhanced_streams && launch.enhanced_streams.length > 0) {
            return launch.enhanced_streams[0].url;
        }
        
        if (launch.vid_urls && launch.vid_urls.length > 0) {
            return launch.vid_urls[0].url;
        }
        
        return null;
    }

    async openPictureInPicture(streamUrl, launch) {
        try {
            // Create a new tab with our PiP player
            const tab = await chrome.tabs.create({
                url: chrome.runtime.getURL('pip.html'),
                active: false
            });
            
            // Send stream data to the PiP page
            setTimeout(() => {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'initPiP',
                    streamUrl: streamUrl,
                    launchName: launch.name
                });
            }, 500);
            
        } catch (error) {
            console.error('Error opening PiP:', error);
            // Fallback: try to embed in a modal within the extension
            this.showStreamModal(streamUrl, launch);
        }
    }

    showLaunchDetails(launch) {
        // Create detailed launch information modal within the extension
        const modal = document.createElement('div');
        modal.className = 'launch-details-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>${launch.name}</h2>
                    <button class="close-modal">✕</button>
                </div>
                <div class="modal-body">
                    <div class="detail-section">
                        <h3>🚀 Launch Information</h3>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <span class="label">Provider:</span>
                                <span class="value">${launch.launch_service_provider?.name || 'Unknown'}</span>
                            </div>
                            <div class="detail-item">
                                <span class="label">Rocket:</span>
                                <span class="value">${launch.rocket?.name || 'Unknown'}</span>
                            </div>
                            <div class="detail-item">
                                <span class="label">Launch Date:</span>
                                <span class="value">${this.formatDetailedDate(new Date(launch.net))}</span>
                            </div>
                            <div class="detail-item">
                                <span class="label">Location:</span>
                                <span class="value">${launch.pad?.name || 'Unknown'}</span>
                            </div>
                            <div class="detail-item">
                                <span class="label">Status:</span>
                                <span class="value">${launch.status?.name || 'Unknown'}</span>
                            </div>
                        </div>
                    </div>
                    
                    ${launch.mission ? `
                    <div class="detail-section">
                        <h3>🎯 Mission Details</h3>
                        <div class="mission-info">
                            <h4>${launch.mission.name || 'Mission'}</h4>
                            <p>${launch.mission.description || 'No mission description available.'}</p>
                            ${launch.mission.type ? `<p><strong>Type:</strong> ${launch.mission.type}</p>` : ''}
                            ${launch.mission.orbit ? `<p><strong>Orbit:</strong> ${launch.mission.orbit.name}</p>` : ''}
                        </div>
                    </div>
                    ` : ''}
                    
                    ${launch.rocket ? `
                    <div class="detail-section">
                        <h3>🚀 Vehicle Information</h3>
                        <div class="vehicle-info">
                            <p><strong>Configuration:</strong> ${launch.rocket.configuration?.name || launch.rocket.name}</p>
                            ${launch.rocket.configuration?.description ? `<p>${launch.rocket.configuration.description}</p>` : ''}
                            ${launch.rocket.configuration?.family ? `<p><strong>Family:</strong> ${launch.rocket.configuration.family}</p>` : ''}
                        </div>
                    </div>
                    ` : ''}
                    
                    ${this.getStreamUrl(launch) ? `
                    <div class="detail-section">
                        <h3>📺 Live Stream</h3>
                        <button class="stream-btn" onclick="this.parentElement.parentElement.parentElement.parentElement.querySelector('.close-modal').click(); document.querySelector('.rocketer-popup').openPiP('${this.getStreamUrl(launch)}', '${launch.name}')">
                            <span class="btn-icon">📺</span>Watch Live Stream
                        </button>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Add event listeners
        modal.querySelector('.close-modal').addEventListener('click', () => {
            modal.remove();
        });

        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        // Store reference for stream button
        document.querySelector('.rocketer-popup').openPiP = (url, name) => {
            this.openPictureInPicture(url, { name });
        };
    }

    showStreamModal(streamUrl, launch) {
        // Fallback: show stream in a modal within the extension
        const modal = document.createElement('div');
        modal.className = 'stream-modal';
        modal.innerHTML = `
            <div class="stream-modal-content">
                <div class="stream-header">
                    <h3>${launch.name} - Live Stream</h3>
                    <button class="close-stream">✕</button>
                </div>
                <div class="stream-container">
                    <iframe src="${this.convertToEmbedUrl(streamUrl)}" 
                            frameborder="0" 
                            allowfullscreen
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
                    </iframe>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('.close-stream').addEventListener('click', () => {
            modal.remove();
        });
    }

    convertToEmbedUrl(url) {
        // YouTube
        if (url.includes('youtube.com/watch')) {
            const videoId = url.split('v=')[1]?.split('&')[0];
            return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1` : url;
        }
        
        if (url.includes('youtu.be/')) {
            const videoId = url.split('youtu.be/')[1]?.split('?')[0];
            return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1` : url;
        }
        
        // Twitch
        if (url.includes('twitch.tv/')) {
            const channel = url.split('twitch.tv/')[1]?.split('/')[0];
            return channel ? `https://player.twitch.tv/?channel=${channel}&parent=${location.hostname}` : url;
        }
        
        // For other URLs, return as-is
        return url;
    }

    formatDetailedDate(date) {
        return new Intl.DateTimeFormat('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
        }).format(date);
    }

    updateCountdown(card, launch) {
        const countdownEl = card.querySelector('.countdown-time');
        const launchTime = new Date(launch.net);
        const now = new Date();
        const timeDiff = launchTime - now;
        
        if (timeDiff <= 0) {
            countdownEl.textContent = 'Launched';
            countdownEl.style.color = '#28a745';
            return;
        }
        
        const timeText = this.formatTimeUntilLaunch(timeDiff);
        countdownEl.textContent = timeText;
        
        // Color coding based on urgency
        if (timeDiff < 3600000) { // Less than 1 hour
            countdownEl.style.color = '#e74c3c';
        } else if (timeDiff < 21600000) { // Less than 6 hours
            countdownEl.style.color = '#f39c12';
        } else {
            countdownEl.style.color = '#17a2b8';
        }
    }

    formatTimeUntilLaunch(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) {
            return `${days}d ${hours % 24}h ${minutes % 60}m`;
        } else if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    formatDate(date) {
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
        }).format(date);
    }

    startCountdownUpdates() {
        // Update countdowns every second
        this.countdownInterval = setInterval(() => {
            const cards = document.querySelectorAll('.launch-card');
            cards.forEach((card, index) => {
                if (this.launches[index]) {
                    this.updateCountdown(card, this.launches[index]);
                }
            });
        }, 1000);
    }

    updateStatus(text) {
        document.getElementById('statusText').textContent = text;
    }

    updateLastUpdateTime(lastUpdate) {
        if (lastUpdate) {
            const updateTime = new Date(lastUpdate);
            const timeAgo = this.getTimeAgo(updateTime);
            document.getElementById('lastUpdate').textContent = `Updated ${timeAgo}`;
        }
    }

    getTimeAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays}d ago`;
    }

    showAbout() {
        const aboutText = `
Rocketer v1.0.0

A Chrome extension for tracking upcoming rocket launches.

Features:
• Real-time launch notifications
• Live stream access
• Picture-in-picture viewing
• Countdown timers

Data provided by The Space Devs API
        `.trim();
        
        alert(aboutText);
    }

    // Cleanup when popup closes
    destroy() {
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
        }
    }

    // Legacy method for backward compatibility (now calls async version)
    getInfoUrl(launch) {
        // This method is now deprecated in favor of getValidatedInfoUrl
        // But keeping it for any existing calls that expect synchronous behavior
        
        // Return the first available URL without validation for immediate use
        const officialUrl = this.getOfficialLaunchUrl(launch);
        if (officialUrl) return officialUrl;
        
        if (launch.url) return launch.url;
        
        const wikipediaUrl = this.getWikipediaLaunchUrl(launch);
        if (wikipediaUrl) return wikipediaUrl;
        
        const launchName = encodeURIComponent(launch.name || 'rocket launch');
        return `https://www.spacenews.com/?s=${launchName}`;
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const popup = new RocketerPopup();
    
    // Cleanup on unload
    window.addEventListener('beforeunload', () => {
        popup.destroy();
    });
});

// Handle messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'launchesUpdated') {
        // Reload launches when background script updates them
        window.location.reload();
    }
}); 
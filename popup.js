/** Rocketer popup UI controller */

class RocketerPopup {
    constructor() {
        this.launches = [];
        this.countdownInterval = null;
        this.debugMode = false; // Disable debug logging in production
        this.debug = (...args) => { if (this.debugMode) console.log(...args); };
        this.init();
        this.setupAutoRefreshListener();
    }

    async init() {
    await this.loadDevMode();
        this.debug('🚀 Rocketer popup initialized');
        this.debug('DOM ready state:', document.readyState);
        this.debug('Current URL:', window.location.href);
        this.debug('Document title:', document.title);
        
        // Verify we're on the right page
        this.verifyCorrectPage();
        
        // Check for layout issues
        this.checkLayoutIntegrity();
        
        this.setupEventListeners();
        await this.loadLaunches();
        this.startCountdownUpdates();
        

    }

  async loadDevMode() {
    try {
      const { devMode = false } = await chrome.storage.sync.get('devMode');
      this.debugMode = !!devMode;
    } catch (_) {
      this.debugMode = false;
    }
    // React to changes at runtime (e.g., set via console)
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && changes.devMode) {
        this.debugMode = !!changes.devMode.newValue;
      }
    });
  }

    verifyCorrectPage() {
        // Check if we're accidentally loading the options page
        const hasCheckboxes = document.querySelectorAll('input[type="checkbox"]').length > 0;
        const hasSettingsGrid = document.querySelector('.settings-grid') !== null;
        const hasLaunchContainer = document.querySelector('#launchesContainer') !== null;
        
        this.debug('🔍 Page verification:');
        this.debug('- Has checkboxes:', hasCheckboxes);
        this.debug('- Has settings grid:', hasSettingsGrid);
        this.debug('- Has launch container:', hasLaunchContainer);
        
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
        
        this.debug('✅ Correct popup page verified');
        return true;
    }

    checkLayoutIntegrity() {
        const body = document.body;
        const container = document.querySelector('.container');
        
        this.debug('📐 Layout check:');
        this.debug('- Body width:', body.offsetWidth, 'px');
        this.debug('- Body computed width:', getComputedStyle(body).width);
        this.debug('- Container width:', container ? container.offsetWidth : 'N/A', 'px');
        this.debug('- Viewport width:', window.innerWidth, 'px');
        
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
        
        this.debug('🔧 Applied emergency layout fixes');
    }

    handleCSSError() {
        // Force load CSS if it failed
        const existingLink = document.querySelector('link[href*="popup.css"]');
        if (!existingLink) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'styles/popup.css';
            document.head.appendChild(link);
            this.debug('🔧 Re-injected CSS link');
        }
    }

    handleMissingElement(elementName) {
        console.error(`Critical UI element missing: ${elementName}`);
        // Try to recover by creating a minimal fallback UI
        if (elementName === 'launchesContainer') {
            const container = document.createElement('div');
            container.id = 'launchesContainer';
            container.className = 'launches-container';
            const contentElement = document.querySelector('.content');
            if (contentElement) {
                contentElement.appendChild(container);
            }
        }
    }

    setupEventListeners() {
        this.debug('🔧 Setting up event listeners...');
        
        // Add keyboard navigation support
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardNavigation(e);
        });
        
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

        const privacyBtn = document.getElementById('privacyBtn');
        if (privacyBtn) {
            privacyBtn.addEventListener('click', () => {
                chrome.tabs.create({ url: chrome.runtime.getURL('privacy-policy.html') });
            });
        }
        
        this.debug('✅ Event listeners setup complete');
    }

    async loadLaunches() {
        this.showLoading();
        
        try {
            // Get launches from storage
            const result = await chrome.storage.local.get(['upcomingLaunches', 'lastUpdate']);
            const { upcomingLaunches = [], lastUpdate } = result;
            
            // No filtering - show all launches
            this.launches = upcomingLaunches;
            this.updateLastUpdateTime(lastUpdate);
            
            if (this.launches.length === 0) {
                this.showNoLaunches();
            } else {
                this.displayLaunches();
            }
            
            // Show smart status based on launch timing
            let statusMessage = `${this.launches.length} upcoming launches`;
            
            // Check if any launches are in auto-refresh window
            const now = new Date();
            const launchesNearTime = this.launches.filter(launch => {
                const minutesUntil = Math.floor((new Date(launch.net) - now) / (1000 * 60));
                return minutesUntil >= 0 && minutesUntil <= 10;
            });
            
            if (launchesNearTime.length > 0) {
                const streamsFound = launchesNearTime.filter(launch => 
                    (launch.enhanced_streams && launch.enhanced_streams.length > 0) ||
                    (launch.vid_urls && launch.vid_urls.length > 0)
                ).length;
                
                if (streamsFound > 0) {
                    statusMessage += ` • ${streamsFound} with live streams`;
                } else {
                    statusMessage += ` • Auto-checking for streams`;
                }
            }
            
            this.updateStatus(statusMessage);
            
        } catch (error) {
            console.error('Error loading launches:', error);
            this.showError();
        }
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
                this.handleMissingElement(name);
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
        const empty = document.getElementById('noLaunches');
        empty.style.display = 'block';
        // Accessibility: announce and focus
        const statusText = document.getElementById('statusText');
        if (statusText) statusText.textContent = 'No upcoming launches';
        empty.setAttribute('aria-live', 'polite');
        empty.focus();
        document.getElementById('errorState').style.display = 'none';
    }

    showError() {
        document.getElementById('loadingSpinner').style.display = 'none';
        document.getElementById('launchesContainer').style.display = 'none';
        document.getElementById('noLaunches').style.display = 'none';
        const err = document.getElementById('errorState');
        err.style.display = 'block';
        // Accessibility: announce and focus
        const statusText = document.getElementById('statusText');
        if (statusText) statusText.textContent = 'Error loading launches';
        err.setAttribute('aria-live', 'assertive');
        err.focus();
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
        if (!template || !template.content) {
            console.error('createLaunchCard: Invalid template');
            return null;
        }
        
        const card = template.content.cloneNode(true);
        const cardElement = card.querySelector('.launch-card');
        
        if (!cardElement) {
            console.error('createLaunchCard: Could not find .launch-card in template');
            return null;
        }
        
        // Add launch ID for proper data binding
        cardElement.dataset.launchId = launch.id;
        
        // Add accessibility attributes
        cardElement.setAttribute('role', 'article');
        cardElement.setAttribute('aria-labelledby', `launch-name-${launch.id}`);
        cardElement.setAttribute('tabindex', '0');
        
        // Basic info
        const launchNameElement = card.querySelector('.launch-name');
        launchNameElement.textContent = launch.name || 'Unknown Mission';
        launchNameElement.id = `launch-name-${launch.id}`;
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
        this.updateCountdown(cardElement, launch);
        
        // Highlight if within 24 hours
        if (launch.minutesUntilLaunch <= 1440) {
            cardElement.classList.add('next-24h');
        }
        
        // Mark as urgent if launching soon
        if (launch.minutesUntilLaunch <= 60) {
            cardElement.classList.add('urgent');
        }
        
        // Setup buttons with new logic
        // Pass the actual card element, not the fragment
        this.setupLaunchButtons(cardElement, launch);
        
        return card;
    }



    setupLaunchButtons(card, launch) {
        const playStreamBtn = card.querySelector('.watch-pip');
        const moreInfoBtn = card.querySelector('.more-info');
        
        // Play Stream button - enhanced stream handling
        const availableStreams = this.getAvailableStreams(launch);
        if (availableStreams.length > 0) {
            playStreamBtn.style.display = 'flex';
            
            // If multiple streams available, show dropdown on click
            if (availableStreams.length > 1) {
                playStreamBtn.innerHTML = '<span class="btn-icon">📺</span>Watch Live ▼';
                playStreamBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.showStreamSelectionMenu(e.target, availableStreams, launch);
                });
            } else {
                // Single stream - direct play
                playStreamBtn.innerHTML = '<span class="btn-icon">📺</span>Watch Live';
                playStreamBtn.addEventListener('click', () => {
                    chrome.tabs.create({ url: availableStreams[0].url });
                });
            }
        } else {
            // No streams available - show webcast status instead
            const webcastStatus = this.getWebcastStatus(launch);
            
            playStreamBtn.style.display = 'flex';
            playStreamBtn.innerHTML = webcastStatus.text;
            playStreamBtn.classList.add('status-indicator');
            playStreamBtn.title = webcastStatus.title;
            
            // Make RocketLaunch.live status clickable to visit launch page
            if (launch.url && launch.url.includes('rocketlaunch.live')) {
                playStreamBtn.style.cursor = 'pointer';
                playStreamBtn.style.pointerEvents = 'auto';
                playStreamBtn.addEventListener('click', () => {
                    chrome.tabs.create({ url: launch.url });
                });
            } else {
                playStreamBtn.style.cursor = 'default';
                playStreamBtn.style.pointerEvents = 'none';
            }
        }
        
        // More Info button - toggle expanded details
        moreInfoBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('More Info clicked, card element:', {
                card: card,
                tagName: card?.tagName,
                classList: card?.classList?.toString()
            });
            this.toggleLaunchDetails(card, launch);
        });
    }

    getAvailableStreams(launch) {
        const streams = [];
        
        // Use enhanced streams if available (these should be verified live streams)
        if (launch.enhanced_streams && launch.enhanced_streams.length > 0) {
            // Only return verified live streams
            const verifiedStreams = launch.enhanced_streams.filter(stream => 
                stream.verified === true || stream.source === 'api'
            );
            return verifiedStreams;
        }
        
        // Fallback to original vid_urls (these are usually reliable)
        if (launch.vid_urls && launch.vid_urls.length > 0) {
            launch.vid_urls.forEach(vidUrl => {
                streams.push({
                    url: vidUrl.url,
                    source: 'api',
                    platform: this.detectPlatform(vidUrl.url),
                    priority: 1,
                    title: 'Official Stream',
                    description: 'Stream from launch API',
                    verified: true
                });
            });
        }
        
        return streams.sort((a, b) => a.priority - b.priority);
    }

    getWebcastStatus(launch) {
        const isLive = launch.webcast_live === true;
        const launchTime = new Date(launch.net);
        const now = new Date();
        const hasStreams = launch.vid_urls && launch.vid_urls.length > 0;
        const hasRocketLaunchUrl = launch.url && launch.url.includes('rocketlaunch.live');
        
        if (isLive) {
            return {
                text: '<span class="status-icon live">🔴</span>Webcast Live',
                title: 'Official webcast is currently live'
            };
        } else if (hasStreams) {
            const minutesUntilLaunch = Math.floor((launchTime - now) / (1000 * 60));
            if (minutesUntilLaunch > 0) {
                return {
                    text: '<span class="status-icon scheduled">📺</span>Webcast Scheduled',
                    title: 'Official webcast will be available for this launch'
                };
            } else {
                return {
                    text: '<span class="status-icon recording">📼</span>Webcast Available',
                    title: 'Official webcast recording should be available'
                };
            }
        } else if (hasRocketLaunchUrl) {
            // For RocketLaunch.live data, show generic status since webcast info isn't available
            return {
                text: '<span class="status-icon unknown">📡</span>Check Launch Page',
                title: 'Visit launch page for webcast information'
            };
        } else {
            return {
                text: '<span class="status-icon none">❌</span>No Webcast',
                title: 'No official webcast announced for this launch'
            };
        }
    }

    detectPlatform(url) {
        if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
        if (url.includes('twitch.tv')) return 'twitch';
        if (url.includes('spacex.com')) return 'spacex';
        if (url.includes('nasa.gov')) return 'nasa';
        if (url.includes('facebook.com')) return 'facebook';
        if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
        return 'other';
    }

    showStreamSelectionMenu(buttonElement, streams, launch) {
        // Remove existing menu if any
        const existingMenu = document.querySelector('.stream-menu');
        if (existingMenu) {
            existingMenu.remove();
        }

        // Create stream selection menu
        const menu = document.createElement('div');
        menu.className = 'stream-menu';
        menu.innerHTML = `
            <div class="stream-menu-header">
                <span>Choose Stream Source</span>
                <button class="close-menu">✕</button>
            </div>
            <div class="stream-options">
                ${streams.map((stream, index) => `
                    <div class="stream-option" data-index="${index}">
                        <div class="stream-platform">${this.getPlatformIcon(stream.platform)} ${this.formatPlatformName(stream.platform)}</div>
                        <div class="stream-title">${stream.title || 'Live Stream'}</div>
                        <div class="stream-description">${stream.description || ''}</div>
                    </div>
                `).join('')}
            </div>
        `;

        // Position menu near button
        const rect = buttonElement.getBoundingClientRect();
        menu.style.position = 'absolute';
        menu.style.top = `${rect.bottom + 5}px`;
        menu.style.left = `${rect.left}px`;
        menu.style.zIndex = '1000';

        document.body.appendChild(menu);

        // Add event listeners
        menu.querySelector('.close-menu').addEventListener('click', () => {
            menu.remove();
        });

        menu.querySelectorAll('.stream-option').forEach((option, index) => {
            option.addEventListener('click', () => {
                const selectedStream = streams[index];
                chrome.tabs.create({ url: selectedStream.url });
                menu.remove();
            });
        });

        // Close menu when clicking outside
        setTimeout(() => {
            document.addEventListener('click', function closeMenu(e) {
                if (!menu.contains(e.target) && e.target !== buttonElement) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                }
            });
        }, 100);
    }

    getPlatformIcon(platform) {
        const icons = {
            youtube: '📹',
            twitch: '🎮',
            spacex: '🚀',
            nasa: '🌌',
            facebook: '📘',
            twitter: '🐦',
            official: '🏢',
            other: '📺'
        };
        return icons[platform] || icons.other;
    }

    formatPlatformName(platform) {
        const names = {
            youtube: 'YouTube',
            twitch: 'Twitch',
            spacex: 'SpaceX',
            nasa: 'NASA',
            facebook: 'Facebook',
            twitter: 'Twitter/X',
            official: 'Official',
            other: 'Other'
        };
        return names[platform] || 'Unknown';
    }



    showNotification(title, message) {
        // Create a temporary notification element
        const notification = document.createElement('div');
        notification.className = 'temp-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <strong>${title}</strong>
                <p>${message}</p>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }

    getStreamUrl(launch) {
        const streams = this.getAvailableStreams(launch);
        return streams.length > 0 ? streams[0].url : null;
    }



    getBestInfoUrl(launch) {
        const provider = launch.launch_service_provider?.name?.toLowerCase() || '';
        const missionName = launch.name || '';
        
        // Priority: Real official pages > Wikipedia > Space news search
        
        // SpaceX missions
        if (provider.includes('spacex')) {
            return 'https://www.spacex.com/launches/';
        }
        
        // NASA missions  
        if (provider.includes('nasa')) {
            return 'https://www.nasa.gov/launchschedule/';
        }
        
        // ULA missions
        if (provider.includes('ula')) {
            return 'https://www.ulalaunch.com/missions/upcoming-launches';
        }
        
        // Blue Origin
        if (provider.includes('blue origin')) {
            return 'https://www.blueorigin.com/news/';
        }
        
        // Rocket Lab
        if (provider.includes('rocket lab')) {
            return 'https://www.rocketlabusa.com/missions/upcoming/';
        }
        
        // For other providers, try Wikipedia first
        const wikipediaUrl = this.getWikipediaLaunchUrl(launch);
        if (wikipediaUrl) {
            return wikipediaUrl;
        }
        
        // Final fallback: SpaceNews search
        const searchTerm = encodeURIComponent(`${missionName} ${provider} launch`);
        return `https://www.spacenews.com/?s=${searchTerm}`;
    }


    getWikipediaLaunchUrl(launch) {
        try {
            const launchDate = new Date(launch.net);
            const year = launchDate.getFullYear();
            const month = launchDate.getMonth() + 1; // 0-indexed
            
            let quarterName;
            if (month <= 3) {
                quarterName = 'January%E2%80%93March';
            } else if (month <= 6) {
                quarterName = 'April%E2%80%93June';
            } else if (month <= 9) {
                quarterName = 'July%E2%80%93September';
            } else {
                quarterName = 'October%E2%80%93December';
            }
            
            return `https://en.wikipedia.org/wiki/List_of_spaceflight_launches_in_${quarterName}_${year}`;
        } catch (error) {
            console.error('Error generating Wikipedia URL:', error);
            return null;
        }
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
        // Update countdowns every second with proper data binding
        this.countdownInterval = setInterval(() => {
            const cards = document.querySelectorAll('.launch-card');
            cards.forEach((card) => {
                const launchId = card.dataset.launchId;
                if (launchId) {
                    const launch = this.launches.find(l => l.id === launchId);
                    if (launch) {
                        this.updateCountdown(card, launch);
                    }
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
            
            // Check if any launches are in auto-refresh mode
            const now = new Date();
            const autoRefreshActive = this.launches.some(launch => {
                const minutesUntil = Math.floor((new Date(launch.net) - now) / (1000 * 60));
                const hasStreams = (launch.enhanced_streams && launch.enhanced_streams.length > 0) ||
                                 (launch.vid_urls && launch.vid_urls.length > 0);
                return minutesUntil >= 0 && minutesUntil <= 10 && !hasStreams;
            });
            
            let updateText = `Updated ${timeAgo}`;
            if (autoRefreshActive) {
                updateText += ' • Auto-refreshing streams';
            }
            
            document.getElementById('lastUpdate').textContent = updateText;
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
        // Open GitHub developer page in a new tab
        chrome.tabs.create({ url: 'https://github.com/NSR2X' });
    }

    // Cleanup when popup closes
    destroy() {
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
        }
    }

    setupAutoRefreshListener() {
        // Listen for streams found during auto-refresh
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === 'streamsFound') {
                console.log('🎉 Streams found via auto-refresh, reloading popup data');
                this.loadLaunches(); // Refresh the popup display
                this.showNotification('🎉 Live Stream Found!', 'New live streams detected. Refreshing launch data.');
            }
        });
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

    toggleLaunchDetails(card, launch) {
        if (!card) {
            console.error('toggleLaunchDetails: card is null');
            return;
        }
        
        const expandedSection = card.querySelector('.launch-details-expanded');
        const moreInfoBtn = card.querySelector('.more-info');
        
        if (!expandedSection || !moreInfoBtn) {
            console.error('toggleLaunchDetails: Required elements not found', {
                card: card,
                cardTagName: card?.tagName,
                cardClassList: card?.classList?.toString(),
                expandedSection: !!expandedSection,
                moreInfoBtn: !!moreInfoBtn,
                cardHTML: card?.outerHTML?.substring(0, 200)
            });
            return;
        }
        
        const expandIndicator = moreInfoBtn.querySelector('.expand-indicator');
        const moreInfoText = moreInfoBtn.querySelector('.more-info-text');
        
        if (!expandIndicator || !moreInfoText) {
            console.error('toggleLaunchDetails: Button elements not found', {
                expandIndicator: !!expandIndicator,
                moreInfoText: !!moreInfoText
            });
            return;
        }
        
        if (expandedSection.style.display === 'none' || !expandedSection.style.display) {
            // Expand - show details
            expandedSection.style.display = 'block';
            moreInfoBtn.classList.add('expanded');
            moreInfoText.textContent = 'Less Info';
            expandIndicator.textContent = '▲';
            
            // Populate the details if not already done
            if (!expandedSection.hasAttribute('data-populated')) {
                this.populateLaunchDetails(card, launch);
                expandedSection.setAttribute('data-populated', 'true');
            }
        } else {
            // Collapse - hide details
            expandedSection.style.display = 'none';
            moreInfoBtn.classList.remove('expanded');
            moreInfoText.textContent = 'More Info';
            expandIndicator.textContent = '▼';
        }
    }

    populateLaunchDetails(card, launch) {
        if (!card) {
            console.error('populateLaunchDetails: card is null');
            return;
        }
        
        const expandedContent = card.querySelector('.expanded-content');
        if (!expandedContent) {
            console.error('populateLaunchDetails: expanded-content not found');
            return;
        }
        
        // Show loading state
        expandedContent.classList.add('loading');
        expandedContent.innerHTML = 'Loading detailed information...';
        
        // Simulate brief loading delay for better UX
        setTimeout(() => {
            if (!expandedContent) return; // Double-check in case card was removed
            
            expandedContent.classList.remove('loading');
            
            // Restore the expanded content structure first
            this.restoreExpandedContentStructure(card);
            
            // Populate all the detail fields
            this.setDetailValue(card, '.rocket-name', launch.rocket?.configuration?.full_name || launch.rocket?.name || 'Unknown');
            this.setDetailValue(card, '.launch-pad', this.getLaunchPadInfo(launch));
            this.setDetailValue(card, '.launch-status', launch.status?.name || 'Unknown');
            this.setDetailValue(card, '.launch-window', this.getLaunchWindow(launch));
            
            // Mission details
            this.setDetailValue(card, '.mission-type', launch.mission?.type || 'Unknown');
            this.setDetailValue(card, '.mission-orbit', launch.mission?.orbit?.name || 'Unknown');

            

        }, 300);
    }

    setDetailValue(card, selector, value) {
        if (!card) {
            console.error('setDetailValue: card is null');
            return;
        }
        
        const element = card.querySelector(selector);
        if (element) {
            element.textContent = value || 'Not available';
            if (!value) {
                element.classList.add('empty-value');
            }
        } else {
            console.warn(`setDetailValue: Element not found for selector: ${selector}`);
        }
    }

    getLaunchPadInfo(launch) {
        if (launch.pad) {
            const padName = launch.pad.name || '';
            const locationName = launch.pad.location?.name || '';
            return padName + (locationName ? ` (${locationName})` : '');
        }
        return 'Unknown';
    }

    getLaunchWindow(launch) {
        if (launch.window_start && launch.window_end) {
            const start = new Date(launch.window_start);
            const end = new Date(launch.window_end);
            const duration = Math.round((end - start) / (1000 * 60)); // minutes
            
            if (duration > 0) {
                return `${duration} minute${duration !== 1 ? 's' : ''} window`;
            }
        }
        return 'Instantaneous';
    }

    restoreExpandedContentStructure(card) {
        if (!card) {
            console.error('restoreExpandedContentStructure: card is null');
            return;
        }
        
        const expandedContent = card.querySelector('.expanded-content');
        if (!expandedContent) {
            console.error('restoreExpandedContentStructure: expanded-content not found');
            return;
        }
        
        if (!expandedContent.querySelector('.detail-section')) {
            // If the structure was lost during loading, restore it from the template
            const template = document.getElementById('launchCardTemplate');
            if (template && template.content) {
                const templateExpanded = template.content.querySelector('.expanded-content');
                if (templateExpanded) {
                    expandedContent.innerHTML = templateExpanded.innerHTML;
                } else {
                    console.error('restoreExpandedContentStructure: template expanded-content not found');
                }
            } else {
                console.error('restoreExpandedContentStructure: template not found');
            }
        }
    }

    handleKeyboardNavigation(e) {
        // Handle Escape key to close popups or reset focus
        if (e.key === 'Escape') {
            const streamMenu = document.querySelector('.stream-menu');
            if (streamMenu) {
                streamMenu.remove();
                return;
            }
            
            // Also collapse any expanded details
            const expandedCards = document.querySelectorAll('.launch-card .more-info.expanded');
            expandedCards.forEach(btn => {
                if (btn && typeof btn.click === 'function') {
                    btn.click();
                }
            });
        }
        
        // Handle Enter and Space for better accessibility
        if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('launch-card')) {
            e.preventDefault();
            const moreInfoBtn = e.target.querySelector('.more-info');
            if (moreInfoBtn) {
                moreInfoBtn.click();
            }
        }
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

 
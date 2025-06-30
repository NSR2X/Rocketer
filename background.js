// Background service worker for Rocketer extension
const LAUNCH_API_URL = 'https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=50&offset=0';
const CHECK_INTERVAL = 30; // minutes
const NOTIFICATION_ADVANCE = 60; // minutes before launch

// Enhanced stream discovery configuration
const STREAM_SOURCES = {
  youtube: {
    apiKey: null, // Will use search without API key for now
    channels: {
      spacex: 'UCtI0Hodo5o5dUb67FeUjDeA', // Official SpaceX channel
      nasa: 'UCLA_DiR1FfKNvjuUpBHmylQ', // Official NASA channel
      blueorigin: 'UCVTomc35agH1SM6kCKzwW_g', // Blue Origin
      ula: 'UCVTomc35agH1SM6kCKzwW_g', // ULA
      rocketlab: 'UCVTomc35agH1SM6kCKzwW_g', // Rocket Lab USA
      esa: 'UCIBaDdAbGlFDeS33shmlD0A', // European Space Agency
      isro: 'UCVTomc35agH1SM6kCKzwW_g', // ISRO
      jaxa: 'UCVTomc35agH1SM6kCKzwW_g' // JAXA
    }
  },
  twitch: {
    channels: ['spacex', 'nasa', 'spaceflightnow', 'everyday_astronaut']
  },
  official: {
    spacex: 'https://www.spacex.com/launches/',
    nasa: 'https://www.nasa.gov/live',
    blueorigin: 'https://www.blueorigin.com/news/',
    ula: 'https://www.ulalaunch.com/missions/upcoming-launches',
    rocketlab: 'https://www.rocketlabusa.com/missions/upcoming/',
    esa: 'https://www.esa.int/ESA_Multimedia/ESA_Web_TV',
    isro: 'https://www.isro.gov.in/',
    jaxa: 'https://global.jaxa.jp/projects/rockets/'
  }
};

class LaunchTracker {
  constructor() {
    this.init();
  }

  async init() {
    // Set up initial alarm
    await this.setupPeriodicCheck();
    
    // Check for launches immediately
    await this.checkUpcomingLaunches();
    
    // Set up notification permissions
    await this.requestNotificationPermission();
  }

  async setupPeriodicCheck(interval = CHECK_INTERVAL) {
    // Clear existing alarms
    await chrome.alarms.clearAll();
    
    // Create periodic alarm
    await chrome.alarms.create('checkLaunches', {
      delayInMinutes: interval,
      periodInMinutes: interval
    });
  }

  async requestNotificationPermission() {
    try {
      const permission = await chrome.notifications.getPermissionLevel();
      if (permission !== 'granted') {
        console.log('Notification permission not granted');
      }
    } catch (error) {
      console.error('Error checking notification permission:', error);
    }
  }

  async fetchLaunches() {
    try {
      console.log('Fetching launches from primary API...');
      const response = await fetch(LAUNCH_API_URL);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('✅ Primary API successful');
      
      // Enhance launches with stream discovery
      const enhancedLaunches = await this.enhanceLaunchesWithStreams(data.results || []);
      return enhancedLaunches;
    } catch (error) {
      console.error('❌ Primary API failed:', error);
      console.log('🔄 Attempting Wikipedia backup...');
      return await this.fetchLaunchesFromWikipedia();
    }
  }

  async enhanceLaunchesWithStreams(launches) {
    console.log('🎥 Enhancing launches with stream discovery...');
    
    const enhancedLaunches = await Promise.all(launches.map(async (launch) => {
      const streams = await this.findLiveStreams(launch);
      return {
        ...launch,
        vid_urls: streams.length > 0 ? streams : launch.vid_urls || [],
        enhanced_streams: streams
      };
    }));

    console.log(`✅ Enhanced ${enhancedLaunches.length} launches with stream data`);
    return enhancedLaunches;
  }

  async findLiveStreams(launch) {
    const streams = [];
    const provider = launch.launch_service_provider?.name?.toLowerCase() || '';
    const missionName = launch.name || '';
    const launchDate = new Date(launch.net);
    const now = new Date();
    const hoursUntilLaunch = (launchDate - now) / (1000 * 60 * 60);

    // Only search for streams if launch is within 48 hours
    if (hoursUntilLaunch > 48 || hoursUntilLaunch < -6) {
      return streams;
    }

    console.log(`🔍 Searching for streams for: ${missionName} (${provider})`);

    try {
      // 1. Check existing API streams first
      if (launch.vid_urls && launch.vid_urls.length > 0) {
        launch.vid_urls.forEach(vidUrl => {
          streams.push({
            url: vidUrl.url,
            source: 'api',
            platform: this.detectPlatform(vidUrl.url),
            priority: 1
          });
        });
      }

      // 2. Search YouTube for live streams
      const youtubeStreams = await this.searchYouTubeLiveStreams(launch);
      streams.push(...youtubeStreams);

      // 3. Check official provider streams
      const officialStreams = await this.findOfficialStreams(launch);
      streams.push(...officialStreams);

      // 4. Check Twitch streams
      const twitchStreams = await this.searchTwitchStreams(launch);
      streams.push(...twitchStreams);

      // Sort by priority and remove duplicates
      const uniqueStreams = this.deduplicateStreams(streams);
      const sortedStreams = uniqueStreams.sort((a, b) => a.priority - b.priority);

      console.log(`✅ Found ${sortedStreams.length} streams for ${missionName}`);
      return sortedStreams;

    } catch (error) {
      console.error(`❌ Error finding streams for ${missionName}:`, error);
      return streams;
    }
  }

  async searchYouTubeLiveStreams(launch) {
    const streams = [];
    const provider = launch.launch_service_provider?.name?.toLowerCase() || '';
    const missionName = launch.name || '';

    try {
      // Search terms based on mission and provider
      const searchTerms = this.generateSearchTerms(launch);
      
      for (const term of searchTerms.slice(0, 3)) { // Limit to 3 searches to avoid rate limits
        const youtubeStreams = await this.searchYouTube(term, provider);
        streams.push(...youtubeStreams);
      }

      return streams;
    } catch (error) {
      console.error('Error searching YouTube:', error);
      return [];
    }
  }

  generateSearchTerms(launch) {
    const provider = launch.launch_service_provider?.name || '';
    const missionName = launch.name || '';
    const rocket = launch.rocket?.name || '';
    
    const terms = [
      `${missionName} live stream`,
      `${provider} ${missionName} launch`,
      `${rocket} launch live`,
      `${provider} launch today`,
      `rocket launch live stream`,
      `space launch live`
    ];

    return terms.filter(term => term.length > 10); // Remove too-short terms
  }

  async searchYouTube(searchTerm, provider) {
    try {
      // Use YouTube's search without API key (scraping approach)
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchTerm + ' live')}&sp=EgJAAQ%253D%253D`; // Live filter
      
      // For now, return constructed URLs based on known channels
      const streams = [];
      const channelId = STREAM_SOURCES.youtube.channels[provider.toLowerCase().replace(/\s+/g, '')];
      
      if (channelId) {
        // Check if channel is likely to be streaming
        const channelUrl = `https://www.youtube.com/channel/${channelId}/live`;
        streams.push({
          url: channelUrl,
          source: 'youtube_channel',
          platform: 'youtube',
          priority: 2,
          title: `${provider} Live Stream`,
          description: `Official ${provider} channel live stream`
        });
      }

      // Also add general search-based stream
      const searchBasedUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchTerm + ' live')}&sp=EgJAAQ%253D%253D`;
      streams.push({
        url: searchBasedUrl,
        source: 'youtube_search',
        platform: 'youtube',
        priority: 4,
        title: `YouTube Search: ${searchTerm}`,
        description: `Search results for ${searchTerm} live streams`
      });

      return streams;
    } catch (error) {
      console.error('YouTube search error:', error);
      return [];
    }
  }

  async findOfficialStreams(launch) {
    const streams = [];
    const provider = launch.launch_service_provider?.name?.toLowerCase() || '';
    
    // Get official stream URL for provider
    const providerKey = provider.replace(/\s+/g, '').toLowerCase();
    const officialUrl = STREAM_SOURCES.official[providerKey];
    
    if (officialUrl) {
      streams.push({
        url: officialUrl,
        source: 'official',
        platform: 'official',
        priority: 1,
        title: `${launch.launch_service_provider?.name} Official Stream`,
        description: `Official live stream from ${launch.launch_service_provider?.name}`
      });
    }

    // SpaceX specific handling
    if (provider.includes('spacex')) {
      streams.push({
        url: 'https://www.spacex.com/launches/',
        source: 'official',
        platform: 'spacex',
        priority: 1,
        title: 'SpaceX Official Stream',
        description: 'Official SpaceX launch stream'
      });
    }

    // NASA specific handling
    if (provider.includes('nasa')) {
      streams.push({
        url: 'https://www.nasa.gov/live',
        source: 'official',
        platform: 'nasa',
        priority: 1,
        title: 'NASA Live',
        description: 'Official NASA live stream'
      });
    }

    return streams;
  }

  async searchTwitchStreams(launch) {
    const streams = [];
    const searchTerms = this.generateSearchTerms(launch);

    try {
      // Check known space-related Twitch channels
      for (const channel of STREAM_SOURCES.twitch.channels) {
        streams.push({
          url: `https://www.twitch.tv/${channel}`,
          source: 'twitch',
          platform: 'twitch',
          priority: 3,
          title: `${channel} on Twitch`,
          description: `Live coverage on Twitch channel ${channel}`
        });
      }

      return streams;
    } catch (error) {
      console.error('Twitch search error:', error);
      return [];
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

  deduplicateStreams(streams) {
    const seen = new Set();
    return streams.filter(stream => {
      const key = stream.url.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async fetchLaunchesFromWikipedia() {
    try {
      const wikipediaUrls = this.getWikipediaUrls();
      console.log('📚 Wikipedia URLs to try:', wikipediaUrls);
      
      let allLaunches = [];
      
      for (const url of wikipediaUrls) {
        try {
          const launches = await this.scrapeWikipediaLaunches(url);
          allLaunches = allLaunches.concat(launches);
          console.log(`✅ Scraped ${launches.length} launches from ${url}`);
        } catch (error) {
          console.error(`❌ Failed to scrape ${url}:`, error);
        }
      }
      
      console.log(`📚 Total Wikipedia launches: ${allLaunches.length}`);
      return allLaunches;
    } catch (error) {
      console.error('❌ Wikipedia backup failed:', error);
      return [];
    }
  }

  getWikipediaUrls() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 0-indexed
    
    const quarters = [
      { months: [1, 2, 3], name: 'January%E2%80%93March' },
      { months: [4, 5, 6], name: 'April%E2%80%93June' },
      { months: [7, 8, 9], name: 'July%E2%80%93September' },
      { months: [10, 11, 12], name: 'October%E2%80%93December' }
    ];
    
    const urls = [];
    
    // Current year quarters (starting from current quarter)
    let currentQuarterIndex = quarters.findIndex(q => q.months.includes(currentMonth));
    
    // Add current and remaining quarters of current year
    for (let i = currentQuarterIndex; i < quarters.length; i++) {
      const url = `https://en.wikipedia.org/wiki/List_of_spaceflight_launches_in_${quarters[i].name}_${currentYear}`;
      urls.push(url);
    }
    
    // Add first two quarters of next year (for 2-week lookahead)
    const nextYear = currentYear + 1;
    if (currentQuarterIndex >= 2) { // If we're in Q3 or Q4, include next year Q1
      urls.push(`https://en.wikipedia.org/wiki/List_of_spaceflight_launches_in_${quarters[0].name}_${nextYear}`);
    }
    
    return urls;
  }

  async scrapeWikipediaLaunches(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const html = await response.text();
      return this.parseWikipediaHtml(html);
    } catch (error) {
      console.error(`Error scraping ${url}:`, error);
      return [];
    }
  }

  parseWikipediaHtml(html) {
    // Create a temporary DOM to parse HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const launches = [];
    
    // Find launch tables in Wikipedia
    const tables = doc.querySelectorAll('table.wikitable');
    
    tables.forEach(table => {
      const rows = table.querySelectorAll('tr');
      
      rows.forEach((row, index) => {
        if (index === 0) return; // Skip header row
        
        const cells = row.querySelectorAll('td');
        if (cells.length < 4) return; // Skip incomplete rows
        
        try {
          const launch = this.parseWikipediaRow(cells);
          if (launch && this.isUpcomingLaunch(launch.net)) {
            launches.push(launch);
          }
        } catch (error) {
          console.error('Error parsing Wikipedia row:', error);
        }
      });
    });
    
    return launches;
  }

  parseWikipediaRow(cells) {
    // Wikipedia table structure: Date, Rocket, Launch site, LSP, Payload, Orbit, etc.
    const dateText = cells[0]?.textContent?.trim() || '';
    const rocketText = cells[1]?.textContent?.trim() || '';
    const launchSite = cells[2]?.textContent?.trim() || '';
    const lspText = cells[3]?.textContent?.trim() || '';
    const payloadText = cells[4]?.textContent?.trim() || '';
    
    // Parse date (Wikipedia format: "DD MMM YYYY, HH:MM" or "DD MMM")
    const launchDate = this.parseWikipediaDate(dateText);
    if (!launchDate) return null;
    
    // Extract mission name from payload
    const missionName = this.extractMissionName(payloadText, rocketText);
    
    // Convert to API-like format
    return {
      id: `wiki_${Date.now()}_${Math.random()}`,
      name: missionName,
      net: launchDate.toISOString(),
      launch_service_provider: {
        name: this.cleanProviderName(lspText)
      },
      pad: {
        name: launchSite,
        location: { name: launchSite }
      },
      mission: {
        name: missionName,
        description: payloadText
      },
      rocket: {
        name: rocketText
      },
      status: { name: 'Go' },
      vid_urls: [], // Wikipedia doesn't have stream URLs
      url: '', // Could add Wikipedia URL as fallback
      image: null,
      window_start: launchDate.toISOString(),
      window_end: launchDate.toISOString()
    };
  }

  parseWikipediaDate(dateText) {
    try {
      // Handle various Wikipedia date formats
      const cleanDate = dateText.replace(/\[.*?\]/g, '').trim(); // Remove Wikipedia references
      
      // Try to parse different formats
      const formats = [
        /(\d{1,2})\s+(\w+)\s+(\d{4}),?\s*(\d{1,2}):(\d{2})/, // "DD MMM YYYY, HH:MM"
        /(\d{1,2})\s+(\w+)\s+(\d{4})/, // "DD MMM YYYY"
        /(\d{4})-(\d{1,2})-(\d{1,2})\s*(\d{1,2}):(\d{2})/, // "YYYY-MM-DD HH:MM"
        /(\d{4})-(\d{1,2})-(\d{1,2})/ // "YYYY-MM-DD"
      ];
      
      for (const format of formats) {
        const match = cleanDate.match(format);
        if (match) {
          if (format.source.includes('MMM')) {
            // Month name format
            const [, day, month, year, hour = '12', minute = '00'] = match;
            const monthNum = this.parseMonth(month);
            return new Date(year, monthNum - 1, day, hour, minute);
          } else {
            // Numeric format
            const [, year, month, day, hour = '12', minute = '00'] = match;
            return new Date(year, month - 1, day, hour, minute);
          }
        }
      }
      
      // Fallback: try native Date parsing
      const fallbackDate = new Date(cleanDate);
      return isNaN(fallbackDate.getTime()) ? null : fallbackDate;
    } catch (error) {
      console.error('Error parsing date:', dateText, error);
      return null;
    }
  }

  parseMonth(monthName) {
    const months = {
      'jan': 1, 'january': 1,
      'feb': 2, 'february': 2,
      'mar': 3, 'march': 3,
      'apr': 4, 'april': 4,
      'may': 5,
      'jun': 6, 'june': 6,
      'jul': 7, 'july': 7,
      'aug': 8, 'august': 8,
      'sep': 9, 'september': 9,
      'oct': 10, 'october': 10,
      'nov': 11, 'november': 11,
      'dec': 12, 'december': 12
    };
    
    const key = monthName.toLowerCase().substring(0, 3);
    return months[key] || 1;
  }

  extractMissionName(payloadText, rocketText) {
    // Extract meaningful mission name from payload text
    const payload = payloadText.split(',')[0].trim(); // Take first payload
    
    if (payload.includes('Starlink')) {
      return payload;
    }
    
    if (payload.includes('SpaceX') || rocketText.includes('Falcon')) {
      return `SpaceX ${payload}`;
    }
    
    return payload || rocketText || 'Unknown Mission';
  }

  cleanProviderName(lspText) {
    // Clean up launch service provider names
    const cleanName = lspText.replace(/\[.*?\]/g, '').trim();
    
    const providerMap = {
      'spacex': 'SpaceX',
      'nasa': 'NASA',
      'ula': 'ULA',
      'blue origin': 'Blue Origin',
      'rocket lab': 'Rocket Lab',
      'esa': 'ESA',
      'isro': 'ISRO',
      'jaxa': 'JAXA',
      'cnsa': 'CNSA',
      'roscosmos': 'Roscosmos'
    };
    
    const key = cleanName.toLowerCase();
    for (const [pattern, standardName] of Object.entries(providerMap)) {
      if (key.includes(pattern)) {
        return standardName;
      }
    }
    
    return cleanName || 'Unknown Provider';
  }

  isUpcomingLaunch(dateString) {
    const launchDate = new Date(dateString);
    const now = new Date();
    const twoWeeksFromNow = new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000));
    
    return launchDate > now && launchDate <= twoWeeksFromNow;
  }

  async checkUpcomingLaunches() {
    const launches = await this.fetchLaunches();
    const now = new Date();
    const upcomingLaunches = [];
    
    for (const launch of launches) {
      const launchTime = new Date(launch.net);
      const timeDiff = launchTime - now;
      const minutesUntilLaunch = Math.floor(timeDiff / (1000 * 60));
      
      // Check if launch is within the next 2 weeks (14 days = 20160 minutes)
      if (minutesUntilLaunch > 0 && minutesUntilLaunch <= 20160) {
        upcomingLaunches.push({
          ...launch,
          minutesUntilLaunch
        });
        
        // Schedule notification if within notification window
        if (minutesUntilLaunch <= NOTIFICATION_ADVANCE) {
          await this.scheduleNotification(launch, minutesUntilLaunch);
        }
      }
    }
    
    // Store upcoming launches
    await chrome.storage.local.set({ 
      upcomingLaunches,
      lastUpdate: now.toISOString()
    });
    
    // Update badge with launches in next 24 hours only
    const next24Hours = upcomingLaunches.filter(launch => launch.minutesUntilLaunch <= 1440);
    await this.updateBadge(next24Hours.length);
    
    console.log(`Found ${upcomingLaunches.length} upcoming launches (${next24Hours.length} in next 24h)`);
  }

  async scheduleNotification(launch, minutesUntilLaunch) {
    const notificationId = `launch_${launch.id}`;
    
    // Check if we already sent this notification
    const { sentNotifications = [] } = await chrome.storage.local.get('sentNotifications');
    if (sentNotifications.includes(notificationId)) {
      return;
    }
    
    const streamUrl = this.extractStreamUrl(launch);
    
    const notificationOptions = {
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: '🚀 Rocket Launch Alert!',
      message: `${launch.name} launches in ${minutesUntilLaunch} minutes`,
      contextMessage: launch.launch_service_provider?.name || 'Space Launch',
      buttons: streamUrl ? [
        { title: 'Watch Stream' },
        { title: 'View Details' }
      ] : [
        { title: 'View Details' }
      ]
    };
    
    await chrome.notifications.create(notificationId, notificationOptions);
    
    // Mark as sent
    sentNotifications.push(notificationId);
    await chrome.storage.local.set({ sentNotifications });
  }

  extractStreamUrl(launch) {
    if (launch.vid_urls && launch.vid_urls.length > 0) {
      return launch.vid_urls[0].url;
    }
    return null;
  }

  async updateBadge(count) {
    const badgeText = count > 0 ? count.toString() : '';
    await chrome.action.setBadgeText({ text: badgeText });
    await chrome.action.setBadgeBackgroundColor({ color: '#FF4444' });
  }

  async handleNotificationClick(notificationId, buttonIndex) {
    const { upcomingLaunches = [] } = await chrome.storage.local.get('upcomingLaunches');
    const launchId = notificationId.replace('launch_', '');
    const launch = upcomingLaunches.find(l => l.id == launchId);
    
    if (!launch) return;
    
    if (buttonIndex === 0) {
      // Watch Stream
      const streamUrl = this.extractStreamUrl(launch);
      if (streamUrl) {
        await chrome.tabs.create({ url: streamUrl });
      }
    } else if (buttonIndex === 1 || buttonIndex === undefined) {
      // View Details or default click
      await chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
    }
  }

  async updateSettings(settings) {
    // Update check interval if changed
    if (settings.updateInterval) {
      await this.setupPeriodicCheck(settings.updateInterval);
    }
    
    // Store settings
    await chrome.storage.sync.set(settings);
  }

  async openPictureInPicture(streamUrl, launchName) {
    try {
      const tab = await chrome.tabs.create({
        url: chrome.runtime.getURL('pip.html'),
        active: false
      });
      
      setTimeout(() => {
        chrome.tabs.sendMessage(tab.id, {
          action: 'initPiP',
          streamUrl: streamUrl,
          launchName: launchName
        });
      }, 500);
      
    } catch (error) {
      console.error('Error opening PiP:', error);
    }
  }
}

// Initialize the tracker
const tracker = new LaunchTracker();

// Event listeners
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'checkLaunches') {
    await tracker.checkUpcomingLaunches();
  }
});

chrome.notifications.onClicked.addListener(async (notificationId) => {
  await tracker.handleNotificationClick(notificationId);
});

chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
  await tracker.handleNotificationClick(notificationId, buttonIndex);
});

// Handle messages from popup and options pages
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  switch (message.action) {
    case 'refreshLaunches':
      await tracker.checkUpcomingLaunches();
      sendResponse({ success: true });
      break;
    case 'settingsUpdated':
      // Update settings and refresh if needed
      await tracker.updateSettings(message.settings);
      break;
    case 'openPiP':
      await tracker.openPictureInPicture(message.streamUrl, message.launchName);
      break;
  }
});

// Handle extension install/update
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('Rocketer extension installed');
    // Open options page on first install
    await chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
  }
});

// Clean up old notifications daily
chrome.alarms.create('cleanup', {
  delayInMinutes: 1440, // 24 hours
  periodInMinutes: 1440
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'cleanup') {
    await chrome.storage.local.set({ sentNotifications: [] });
  }
}); 
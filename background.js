/** Rocketer background service worker */

// Background service worker for Rocketer extension
const API_URLS = {
  spacedevs: 'https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=50&offset=0',
  rocketlaunch: 'https://fdo.rocketlaunch.live/json/launches/next/50'
};
const SPACEDEVS_CALENDAR_URL = 'https://ll.thespacedevs.com/launches/latest/feed.ics';
const CHECK_INTERVAL = 30; // minutes
// Notification timing will be retrieved from user settings

// Stream source metadata removed (no in-extension player)

class LaunchTracker {
  constructor() {
    this.streamRefreshIntervals = new Map();
    this.lastStreamCheck = new Map();
    this.cleanupIntervals();
    this.init();
  }

  // Clean up intervals to prevent memory leaks
  cleanupIntervals() {
    if (this.streamRefreshIntervals) {
      for (const [launchId, interval] of this.streamRefreshIntervals) {
        clearInterval(interval);
      }
      this.streamRefreshIntervals.clear();
    }
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
    await chrome.alarms.clearAll();
    
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
      // Get user's preferred data provider
      const settings = await chrome.storage.sync.get(['dataProvider']);
      const provider = settings.dataProvider || 'spacedevs';
      const apiUrl = API_URLS[provider];
      
      
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      
      // Transform data based on provider
      const launches = provider === 'rocketlaunch' 
        ? this.transformRocketLaunchData(data.result || [])
        : data.results || [];
      
      return launches;
    } catch (error) {
      console.error('❌ Primary API failed:', error);
      console.log('🔄 Attempting Wikipedia backup...');
      return await this.fetchLaunchesFromWikipedia();
    }
  }

  transformRocketLaunchData(rocketLaunchData) {
    return rocketLaunchData.map(launch => ({
      id: launch.id,
      name: launch.name,
      net: launch.t0 || launch.win_open, // Use t0 (exact time) or win_open as fallback
      window_start: launch.win_open,
      window_end: launch.win_close,
      status: {
        name: launch.result === -1 ? 'Go' : (launch.result === 1 ? 'Success' : 'TBD')
      },
      launch_service_provider: {
        name: launch.provider?.name || 'Unknown',
        type: 'Commercial' // Default type since RocketLaunch.live doesn't provide this
      },
      rocket: {
        name: launch.vehicle?.name || 'Unknown',
        configuration: {
          full_name: launch.vehicle?.name || 'Unknown'
        }
      },
      pad: {
        name: launch.pad?.name || 'Unknown',
        location: {
          name: launch.pad?.location?.name || 'Unknown'
        }
      },
      mission: {
        name: launch.missions?.[0]?.name || launch.name,
        description: launch.mission_description || launch.missions?.[0]?.description || 'No description available',
        type: 'Unknown'
      },
      image: null, // RocketLaunch.live doesn't provide images
      url: `https://rocketlaunch.live/launch/${launch.slug}`,
      vid_urls: [], // RocketLaunch.live doesn't provide stream URLs in this format
      webcast_live: false, // RocketLaunch.live doesn't provide this field
      tags: launch.tags || []
    }));
  }

  async fetchSpaceDevsVideoUrls() {
    try {
      console.log('Fetching SpaceDevs calendar for video URLs...');
      const response = await fetch(SPACEDEVS_CALENDAR_URL);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const icsData = await response.text();
      const videoUrls = this.parseICSVideoUrls(icsData);
      console.log('📺 Parsed video URLs:', videoUrls);
      return videoUrls;
    } catch (error) {
      console.error('Failed to fetch SpaceDevs calendar:', error);
      return {};
    }
  }

  parseICSVideoUrls(icsData) {
    const videoUrls = {};
    const events = icsData.split('BEGIN:VEVENT');
    
    console.log(`🔍 Processing ${events.length} ICS events`);
    
    events.forEach((event, index) => {
      if (!event.includes('SUMMARY:')) return;
      
      // Extract launch name
      const summaryMatch = event.match(/SUMMARY:(.+?)(?:\n|\r)/);
      if (!summaryMatch) return;
      
      const launchName = summaryMatch[1].trim();
      
      // Extract UID for matching
      const uidMatch = event.match(/UID:(.+?)(?:\n|\r)/);
      if (!uidMatch) return;
      
      const uid = uidMatch[1].replace('@thespacedevs', '').trim();
      
      // Look for VIDEO URLS section in description
      const descriptionMatch = event.match(/DESCRIPTION:(.*?)(?:\nGEO:|\nLAST-MODIFIED:)/s);
      if (!descriptionMatch) {
        if (launchName.includes('Kuiper')) {
          console.log(`⚠️ No DESCRIPTION found for ${launchName}`);
        }
        return;
      }
      
      const description = descriptionMatch[1].replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
      
      // Find VIDEO URLS section
      const videoUrlsMatch = description.match(/VIDEO URLS\n(.*?)(?:\n\n|$)/s);
      if (!videoUrlsMatch) {
        if (launchName.includes('Kuiper')) {
          console.log(`⚠️ No VIDEO URLS section found for ${launchName}`);
          console.log('Description:', description.substring(0, 200) + '...');
        }
        return;
      }
      
      const videoSection = videoUrlsMatch[1];
      
      if (launchName.includes('Kuiper')) {
        console.log(`🎬 Video section for ${launchName}:`, videoSection);
      }
      
      // Look for Official webcast URLs - handle ICS line folding where "Webcast" gets split
      // The ICS format breaks long lines, so "• Official Webcast" becomes "• Official W" + "ebcast"  
      const officialPattern = /• Official W[^\n]*?(?:\n\s*[^\n]*?cast[^\n]*?)*?\n\s*(https?:\/\/[^\s\\]+)/g;
      let match;
      const officialUrls = [];
      
      while ((match = officialPattern.exec(videoSection)) !== null) {
        let cleanUrl = match[1];
        // Clean up any trailing backslashes from ICS encoding
        cleanUrl = cleanUrl.replace(/\\+$/, '');
        
        officialUrls.push({
          url: cleanUrl,
          title: 'Official Webcast',
          verified: true,
          priority: 1
        });
        
        if (launchName.includes('Kuiper')) {
          console.log(`✅ Found official URL for ${launchName}: ${cleanUrl}`);
        }
      }
      
      if (officialUrls.length > 0) {
        videoUrls[uid] = officialUrls;
        videoUrls[launchName] = officialUrls; // Also index by name for fallback
        console.log(`📺 Added ${officialUrls.length} video(s) for ${launchName} (UID: ${uid})`);
      }
    });
    
    return videoUrls;
  }

  enhanceLaunchWithVideoUrls(launch, spaceDevsVideoUrls) {
    console.log(`🔍 Trying to enhance launch: ${launch.name} (ID: ${launch.id})`);
    console.log(`🔍 Available video URL keys:`, Object.keys(spaceDevsVideoUrls));
    
    // Try to match by UID (most reliable)
    const launchId = launch.id;
    let videoUrls = spaceDevsVideoUrls[launchId];
    console.log(`🔍 Match by ID "${launchId}":`, videoUrls ? 'FOUND' : 'NOT FOUND');
    
    // Fallback: try to match by launch name
    if (!videoUrls) {
      videoUrls = spaceDevsVideoUrls[launch.name];
      console.log(`🔍 Match by name "${launch.name}":`, videoUrls ? 'FOUND' : 'NOT FOUND');
    }
    
    // Fallback: try partial name matching
    if (!videoUrls) {
      const launchNameLower = launch.name.toLowerCase();
      console.log(`🔍 Trying partial match for: "${launchNameLower}"`);
      for (const [key, urls] of Object.entries(spaceDevsVideoUrls)) {
        const keyLower = key.toLowerCase();
        const searchTerm = launchNameLower.split('|')[0].trim().toLowerCase();
        console.log(`🔍 Checking if "${keyLower}" includes "${searchTerm}"`);
        if (keyLower.includes(searchTerm)) {
          videoUrls = urls;
          console.log(`✅ Partial match found: "${key}"`);
          break;
        }
      }
    }
    
    if (videoUrls && videoUrls.length > 0) {
      // Convert to vid_urls format for compatibility
      const formattedUrls = videoUrls.map(video => ({
        url: video.url,
        title: video.title
      }));
      
      // Merge with existing vid_urls, prioritizing calendar URLs
      const existingUrls = launch.vid_urls || [];
      launch.vid_urls = [...formattedUrls, ...existingUrls];
      
      // Also add as enhanced_streams for immediate use
      launch.enhanced_streams = videoUrls;
      
      console.log(`✅ Enhanced ${launch.name} with ${videoUrls.length} official video URL(s):`, videoUrls);
    } else {
      console.log(`❌ No video URLs found for ${launch.name}`);
    }
  }

  shouldCheckStreamsForLaunch(launch, minutesUntilLaunch, forceRefresh) {
    // Always check if forced (manual refresh button)
    if (forceRefresh) {
      return true;
    }
    
    // Don't check streams if launch is more than 60 minutes away (align with stream search window)
    if (minutesUntilLaunch > 60) {
      return false;
    }
    
    // Don't check streams if launch has already happened
    if (minutesUntilLaunch < -60) { // Give 1 hour grace period after launch
      return false;
    }
    
    // Check how long ago we last checked streams for this launch
    const lastCheck = this.lastStreamCheck.get(launch.id);
    if (lastCheck) {
      const minutesSinceLastCheck = (Date.now() - lastCheck) / (1000 * 60);
      
      // If we found streams recently, don't check again for 5 minutes
      // If no streams found, check more frequently (every 2 minutes)
      const checkInterval = this.hasStreamsForLaunch(launch.id) ? 5 : 2;
      
      if (minutesSinceLastCheck < checkInterval) {
        return false;
      }
    }
    
    return true;
  }
  
  async getExistingLaunchData(launchId) {
    try {
      const { upcomingLaunches = [] } = await chrome.storage.local.get('upcomingLaunches');
      return upcomingLaunches.find(launch => launch.id === launchId);
    } catch (error) {
      return null;
    }
  }
  
  hasStreamsForLaunch(launchId) {
    // This would need to check stored data - simplified for now
    return false;
  }

  // Stream discovery temporarily disabled - preserve API-provided vid_urls only
  async findLiveStreams(launch) {
    const streams = [];
    try {
      if (launch.vid_urls && launch.vid_urls.length > 0) {
        launch.vid_urls.forEach((vidUrl) => {
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
    } catch (error) {
      console.error('Stream mapping failed:', error);
    }
    return this.deduplicateStreams(streams).sort((a, b) => a.priority - b.priority);
  }

  // Provider stream hints disabled for now
  async checkProviderStreams() { return []; }



  // Official stream hints disabled for now
  async checkOfficialStreams() { return []; }

  async verifyStreamIsLive(url) {
    try {
      // For YouTube videos, we could check the embed endpoint
      if (url.includes('youtube.com/watch') || url.includes('youtu.be/')) {
        // For YouTube videos, assume they're valid streams from API
        return true;
      }
      
      // For other URLs, we assume they're valid if they're from the API
      return true;
    } catch (error) {
      console.error('Error verifying stream:', error);
      return false;
    }
  }
  
  extractYouTubeVideoId(url) {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  }
  
  setupSmartAutoRefresh(launch, minutesUntilLaunch, hasStreams) {
    const launchId = launch.id;
    
    // Clear existing interval for this launch
    if (this.streamRefreshIntervals.has(launchId)) {
      clearInterval(this.streamRefreshIntervals.get(launchId));
      this.streamRefreshIntervals.delete(launchId);
    }
    
    // Don't set up auto-refresh if:
    // - Launch is more than 60 minutes away
    // - Launch has already passed (more than 1 hour ago)
    // - We already found streams
    if (minutesUntilLaunch > 60 || minutesUntilLaunch < -60 || hasStreams) {
      console.log(`⏹️ No auto-refresh needed for ${launch.name} (${minutesUntilLaunch}m, hasStreams: ${hasStreams})`);
      return;
    }
    
    // Set up auto-refresh every 1 minute when close to launch
    console.log(`⏰ Setting up auto-refresh for ${launch.name} (${minutesUntilLaunch}m until launch)`);
    
    const interval = setInterval(async () => {
      const now = new Date();
      const currentMinutesUntil = Math.floor((new Date(launch.net) - now) / (1000 * 60));
      
      console.log(`🔄 Auto-refresh: Checking streams for ${launch.name} (${currentMinutesUntil}m until launch)`);
      
      // Stop auto-refresh if launch has passed or is too far away
      if (currentMinutesUntil < -60 || currentMinutesUntil > 60) {
        console.log(`⏹️ Stopping auto-refresh for ${launch.name} (outside time window)`);
        clearInterval(interval);
        this.streamRefreshIntervals.delete(launchId);
        return;
      }
      
      // Check for streams
      const streams = await this.findLiveStreams(launch);
      
      if (streams.length > 0) {
        console.log(`✅ Auto-refresh found ${streams.length} streams for ${launch.name} - stopping auto-refresh`);
        
        // Update stored data with found streams
        const { upcomingLaunches = [] } = await chrome.storage.local.get('upcomingLaunches');
        const updatedLaunches = upcomingLaunches.map(storedLaunch => {
          if (storedLaunch.id === launchId) {
            return {
              ...storedLaunch,
              enhanced_streams: streams,
              vid_urls: streams.length > 0 ? streams : storedLaunch.vid_urls || []
            };
          }
          return storedLaunch;
        });
        
        await chrome.storage.local.set({ upcomingLaunches: updatedLaunches });
        
        // Notify popup to refresh
        try {
          chrome.runtime.sendMessage({ action: 'streamsFound', launchId: launchId });
        } catch (error) {
          // Popup might not be open, that's fine
        }
        
        // Stop the interval
        clearInterval(interval);
        this.streamRefreshIntervals.delete(launchId);
      }
    }, 60000); // Check every minute
    
    // Store the interval reference
    this.streamRefreshIntervals.set(launchId, interval);
  }

  detectPlatform(url) {
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
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

  async checkUpcomingLaunches(forceStreamRefresh = false) {
    const launches = await this.fetchLaunches();
    
    // Get user's preferred data provider and fetch video URLs if using SpaceDevs
    const settings = await chrome.storage.sync.get(['dataProvider']);
    const provider = settings.dataProvider || 'spacedevs';
    
    let spaceDevsVideoUrls = {};
    if (provider === 'spacedevs') {
      spaceDevsVideoUrls = await this.fetchSpaceDevsVideoUrls();
    }
    
    const now = new Date();
    const upcomingLaunches = [];
    
    for (const launch of launches) {
      const launchTime = new Date(launch.net);
      const timeDiff = launchTime - now;
      const minutesUntilLaunch = Math.floor(timeDiff / (1000 * 60));
      
      // Check if launch is within the next 2 weeks (14 days = 20160 minutes)
      if (minutesUntilLaunch > 0 && minutesUntilLaunch <= 20160) {
        let enhancedLaunch = { ...launch, minutesUntilLaunch };
        
        // Smart stream checking: only check streams when needed
        const shouldCheckStreams = this.shouldCheckStreamsForLaunch(launch, minutesUntilLaunch, forceStreamRefresh);
        
        if (shouldCheckStreams) {
          console.log(`🔄 Checking streams for ${launch.name} (${minutesUntilLaunch}m until launch)`);
          const streams = await this.findLiveStreams(launch);
          enhancedLaunch.enhanced_streams = streams;
          enhancedLaunch.vid_urls = streams.length > 0 ? streams : launch.vid_urls || [];
          
          // Track that we checked streams for this launch
          this.lastStreamCheck.set(launch.id, now.getTime());
          
          // Set up auto-refresh if close to launch and no streams found
          this.setupSmartAutoRefresh(launch, minutesUntilLaunch, streams.length > 0);
        } else {
          // Keep existing stream data if we're not refreshing
          const existing = await this.getExistingLaunchData(launch.id);
          if (existing) {
            enhancedLaunch.enhanced_streams = existing.enhanced_streams || [];
            enhancedLaunch.vid_urls = existing.vid_urls || launch.vid_urls || [];
          }
        }
        
        // Enhance with SpaceDevs video URLs if available
        if (provider === 'spacedevs' && Object.keys(spaceDevsVideoUrls).length > 0) {
          this.enhanceLaunchWithVideoUrls(enhancedLaunch, spaceDevsVideoUrls);
        }
        
        upcomingLaunches.push(enhancedLaunch);
        
        // Schedule notification if within notification window
        // Get user's notification timing preference
        const { notificationTiming = 60 } = await chrome.storage.sync.get('notificationTiming');
        if (minutesUntilLaunch <= notificationTiming) {
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
    
    
  }

  async scheduleNotification(launch, minutesUntilLaunch) {
    // Respect user settings
    const { enableNotifications = true, soundNotifications = false } = await chrome.storage.sync.get([
      'enableNotifications',
      'soundNotifications'
    ]);
    if (!enableNotifications) {
      return;
    }

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
      priority: 2,
      requireInteraction: false,
      buttons: streamUrl ? [
        { title: 'Watch Stream' },
        { title: 'View Details' }
      ] : [
        { title: 'View Details' }
      ]
    };
    
    await chrome.notifications.create(notificationId, notificationOptions);

    // Sound hint: Chrome notifications use OS settings for sound. If the user
    // explicitly enabled sound reminders, ensure the OS sound is allowed.
    // Custom sounds are not supported by chrome.notifications; implementing
    // custom audio would require an offscreen document or a visible tab.
    
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
}

// Initialize the tracker
const tracker = new LaunchTracker();

// Event listeners
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'checkLaunches') {
    await tracker.checkUpcomingLaunches();
  } else if (alarm.name === 'cleanup') {
    await chrome.storage.local.set({ sentNotifications: [] });
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
      await tracker.checkUpcomingLaunches(true); // Force stream refresh
      sendResponse({ success: true });
      break;
    case 'settingsUpdated':
      // Update settings and refresh if needed
      await tracker.updateSettings(message.settings);
      break;
    case 'openPiP':
      // PiP functionality removed - handled as direct redirects in popup
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

// Consolidated alarm handler (cleanup functionality integrated above) 
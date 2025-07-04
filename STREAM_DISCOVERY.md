# 🎥 Enhanced Stream Discovery System

The Rocketer extension now features an advanced stream discovery system that automatically finds live rocket launch streams from multiple sources, ensuring you never miss a launch even when official streams aren't available in the API.

## 🔍 How Stream Discovery Works

### 1. **Multi-Source Discovery**
The system searches for streams across multiple platforms:
- **Official Provider Channels** (SpaceX, NASA, ULA, etc.)
- **YouTube** (official channels and live search)
- **Twitch** (space-focused channels)
- **API Sources** (The Space Devs API vid_urls)

### 2. **Smart Priority System**
Streams are prioritized by reliability and quality:
1. **Priority 1**: Official API streams and provider websites
2. **Priority 2**: Official YouTube channels
3. **Priority 3**: Twitch channels
4. **Priority 4**: YouTube search results

### 3. **Intelligent Timing**
- Stream discovery only activates within **48 hours** of launch
- Stops searching **6 hours after** launch time
- Reduces unnecessary API calls and improves performance

## 🎯 Stream Sources

### Official Provider Channels
- **SpaceX**: https://www.spacex.com/launches/
- **NASA**: https://www.nasa.gov/live
- **Blue Origin**: https://www.blueorigin.com/news/
- **ULA**: https://www.ulalaunch.com/missions/upcoming-launches
- **Rocket Lab**: https://www.rocketlabusa.com/missions/upcoming/
- **ESA**: https://www.esa.int/ESA_Multimedia/ESA_Web_TV
- **ISRO**: https://www.isro.gov.in/
- **JAXA**: https://global.jaxa.jp/projects/rockets/

### YouTube Channels
The system monitors these official channels:
- **SpaceX**: UCVTomc35agH1SM6kCKzwW_g
- **NASA**: UCLA_DiR1FfKNvjuUpBHmylQ
- **ESA**: UCIBaDdAbGlFDeS33shmlD0A

### Twitch Channels
- **spacex**
- **nasa**
- **spaceflightnow**

## 🖼️ Picture-in-Picture Enhancements

### Stream Information Display
- Shows the **platform/source** of the current stream
- Displays **stream quality** when available
- **Platform icons** for easy identification

### Enhanced Controls
- **Stream Source Button**: Switch between available streams
- **Fullscreen Toggle**: Expand to full window
- **Minimize Mode**: Compact floating window
- **Open in New Tab**: View in regular browser tab

### Platform Support
The PiP player automatically handles:
- **YouTube**: Converts to embed URLs with autoplay
- **Twitch**: Uses Twitch player with proper parent domain
- **Official Sites**: Direct iframe embedding
- **Search Pages**: Opens search results for manual selection

## 🔧 User Interface Features

### Stream Selection Menu
When multiple streams are available:
- **Dropdown interface** with platform icons
- **Stream descriptions** and source information
- **One-click selection** and instant playback
- **Platform-specific styling** for easy identification

### Smart Search Integration
When no direct streams are found:
- **"Find Stream" button** replaces "Watch Live"
- **Multi-platform search** opens YouTube, Twitch, and Google
- **Intelligent search terms** based on mission details
- **In-app notifications** guide users to search results

### Visual Indicators
- **Green border**: Launch has available streams
- **Blue border**: Multiple streams available
- **Gray border**: No streams found (search available)
- **Stream count badges** show number of available sources

## 🚀 Benefits for Users

### Never Miss a Stream
- **Automatic discovery** finds streams even when APIs don't have them
- **Multiple backup sources** ensure availability
- **Smart search** helps find community streams and coverage

### Better User Experience
- **One-click access** to the best available stream
- **Platform choice** lets users prefer their favorite services
- **Seamless PiP** works across all supported platforms

### Reliability
- **Fallback system** ensures something is always available
- **Error handling** gracefully manages failed streams
- **Performance optimized** with intelligent timing and caching

## 🔧 Technical Implementation

### Background Stream Discovery
```javascript
// Enhanced launches with stream discovery
const enhancedLaunches = await Promise.all(launches.map(async (launch) => {
  const streams = await this.findLiveStreams(launch);
  return {
    ...launch,
    vid_urls: streams.length > 0 ? streams : launch.vid_urls || [],
    enhanced_streams: streams
  };
}));
```

### Stream Source Detection
```javascript
// Platform detection and URL conversion
function detectPlatform(url) {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('twitch.tv')) return 'twitch';
  if (url.includes('spacex.com')) return 'spacex';
  // ... more platforms
}
```

### PiP Integration
```javascript
// Enhanced PiP with stream info
chrome.tabs.sendMessage(tab.id, {
  action: 'initPiP',
  streamUrl: streamUrl,
  launchName: launch.name,
  streamInfo: streamInfo  // New: includes platform, quality, etc.
});
```

## 🎯 Future Enhancements

### Planned Features
- **Stream Quality Detection**: Automatic HD/4K identification
- **Live Status Monitoring**: Real-time stream availability checking
- **User Preferences**: Remember preferred platforms per provider
- **Community Streams**: Integration with space community channels
- **Multi-Stream View**: Picture-in-picture with multiple simultaneous streams

### API Integrations
- **YouTube Data API**: Enhanced search and metadata
- **Twitch API**: Live status and viewer counts
- **Social Media APIs**: Twitter/X live stream discovery
- **RSS Feeds**: Space news and announcement monitoring

This enhanced stream discovery system ensures that Rocketer users have the best possible access to live rocket launch coverage, regardless of which platforms are officially supported by the launch APIs.
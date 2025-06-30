# 🚀 Rocketer - Space Launch Tracker

A beautiful and efficient Chrome extension that alerts you about upcoming rocket launches and provides live streaming capabilities with picture-in-picture support. **Now with Wikipedia backup integration for 99.9% uptime!**

## ✨ Features

- **🔔 Smart Notifications**: Get alerts 1 hour before rocket launches (customizable)
- **📺 Enhanced Live Streaming**: Advanced stream discovery from multiple sources
  - **🎯 Multi-Platform Discovery**: Automatically finds streams on YouTube, Twitch, official channels
  - **🔍 Smart Stream Search**: Intelligent search across platforms when no direct streams available
  - **📋 Stream Selection Menu**: Choose from multiple available stream sources
  - **🏢 Official Channel Priority**: Prioritizes official provider streams (SpaceX, NASA, etc.)
- **🖼️ Advanced Picture-in-Picture**: Watch launches in a floating window while browsing
  - **📺 Stream Source Display**: Shows which platform/source is being used
  - **🎮 Enhanced Controls**: Fullscreen, minimize, source switching
  - **🔄 Seamless Platform Support**: Works with YouTube, Twitch, official sites
- **⏰ Real-time Countdown**: Live countdown timers for upcoming launches
- **🎯 Launch Filters**: Filter by SpaceX, NASA, ULA, Blue Origin, Rocket Lab, ESA, ISRO, JAXA, CNSA, Roscosmos
- **📚 Wikipedia Backup**: Automatic fallback to Wikipedia launch lists when APIs fail
- **🔗 Smart URL Priority**: Official → API → Wikipedia → Space News link hierarchy  
- **📱 Modern UI**: Beautiful, responsive interface with smooth animations
- **⚙️ Customizable**: Comprehensive settings for notifications, appearance, and more
- **🌓 Theme Support**: Auto, light, and dark themes
- **📊 Launch Details**: Mission information, location, and provider details
- **🔄 2-Week Visibility**: Shows launches for next 14 days with 24H highlighting

## 🚀 Installation

### Option 1: Install from Chrome Web Store (Coming Soon)
*The extension will be available on the Chrome Web Store soon.*

### Option 2: Manual Installation (Developer Mode)

1. **Download the Extension**
   ```bash
   git clone https://github.com/your-repo/rocketer.git
   cd rocketer
   ```

2. **Enable Developer Mode in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Toggle "Developer mode" on (top-right corner)

3. **Load the Extension**
   - Click "Load unpacked"
   - Select the `Rocketer` folder
   - The extension will appear in your extensions list

4. **Pin the Extension** (Optional)
   - Click the extensions icon (puzzle piece) in Chrome toolbar
   - Click the pin icon next to Rocketer to keep it visible

## 🎯 Usage

### Basic Usage

1. **Click the Extension Icon** 🚀
   - View upcoming launches in the next 24 hours
   - See countdown timers and launch details
   - Access live streams when available

2. **Watch Live Streams**
   - Click "Watch Live" to open stream in a new tab
   - Click "Picture-in-Picture" for floating video window
   - Use PiP controls for fullscreen, minimize, or close

3. **Get Notifications**
   - Automatic notifications 1 hour before launches
   - Click notification to view launch details
   - Direct stream access from notifications

### Advanced Features

#### Settings Configuration
Access settings by clicking the extension icon → "Settings"

- **📣 Notification Settings**
  - Enable/disable notifications
  - Customize timing (15 minutes to 2 hours before)
  - Sound notifications toggle

- **🔄 Data & Updates**
  - Auto-refresh frequency (15 minutes to 2 hours)
  - Manual refresh option
  - Auto-refresh toggle

- **🔍 Launch Filters**
  - Filter by launch providers (SpaceX, NASA, ULA, etc.)
  - Show only launches with live streams
  - Custom provider selection

- **🎨 Appearance**
  - Theme selection (Auto/Light/Dark)
  - Compact popup layout
  - Launch count badge toggle

#### Picture-in-Picture Controls
- **F**: Toggle fullscreen
- **M**: Minimize/restore window
- **Escape**: Exit minimize mode
- **Mouse**: Drag window when minimized
- **Hover**: Show/hide controls and info

## 🛠️ Technical Details

### Architecture
- **Manifest V3**: Modern Chrome extension format
- **Service Worker**: Background processing for notifications and data fetching
- **Content Scripts**: Enhanced streaming experience on video platforms
- **Storage API**: Sync settings across devices
- **Alarms API**: Scheduled data updates and notifications

### Data Source
- **The Space Devs API**: Reliable, up-to-date launch information
- **Real-time Updates**: Regular data synchronization
- **Stream Integration**: YouTube and Twitch embed support

### Performance
- **Efficient**: Minimal resource usage with smart caching
- **Fast**: Optimized API calls and data processing
- **Responsive**: Smooth animations and transitions
- **Accessible**: Full keyboard navigation and screen reader support

## 🔧 Development

### Prerequisites
- Chrome browser with Developer Mode enabled
- Basic understanding of Chrome extension development

### File Structure
```
Rocketer/
├── manifest.json          # Extension configuration
├── background.js          # Service worker
├── popup.html             # Main popup interface
├── popup.js               # Popup functionality
├── options.html           # Settings page
├── options.js             # Settings functionality
├── content.js             # Content script
├── pip.html               # Picture-in-Picture player
├── styles/
│   ├── popup.css         # Popup styles
│   └── options.css       # Settings styles
├── icons/
│   └── icon.svg          # Extension icon
└── README.md             # This file
```

### Key Components

#### Background Service Worker (`background.js`)
- Fetches launch data from The Space Devs API
- Manages periodic updates and notifications
- Handles extension lifecycle events

#### Popup Interface (`popup.html`, `popup.js`)
- Displays upcoming launches with countdown timers
- Provides stream access and PiP functionality
- Real-time updates and interactive elements

#### Settings Page (`options.html`, `options.js`)
- Comprehensive user preferences
- Import/export settings functionality
- Theme and notification management

#### Picture-in-Picture (`pip.html`)
- Floating video player for launch streams
- Full-screen and minimize capabilities
- Stream URL conversion for YouTube/Twitch

## 🤝 Contributing

We welcome contributions! Please feel free to submit issues, feature requests, or pull requests.

### Development Setup
1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test thoroughly
4. Submit a pull request with detailed description

### Code Style
- Use modern JavaScript (ES6+)
- Follow consistent indentation (2 spaces)
- Comment complex logic
- Test across different Chrome versions

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **The Space Devs**: For providing the amazing launch data API
- **Chrome Extension Team**: For the robust extension platform
- **Space Community**: For inspiration and feedback

## 📞 Support

- **Issues**: Report bugs or request features on GitHub
- **Email**: support@rocketer-extension.com
- **Documentation**: Comprehensive guides available in the wiki

## 🚀 Roadmap

### Upcoming Features
- [ ] Historical launch data and statistics
- [ ] Calendar integration for launch events
- [ ] Social sharing capabilities
- [ ] Launch prediction and delay notifications
- [ ] Multiple language support
- [ ] Mobile companion app
- [ ] Launch photography gallery
- [ ] ISS tracking integration

---

**Made with ❤️ for space enthusiasts everywhere**

*Rocketer helps you never miss a rocket launch again! 🚀*

# Rocketer 🚀

Chrome extension for tracking rocket launches with live streams and notifications.

**Developer:** Quantin BODIN

## Installation

1. Download/clone this repository
2. Open Chrome → `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" → Select the Rocketer folder
5. Extension appears in toolbar - ready to use!

## Features

- Track upcoming launches from SpaceX, NASA, ULA, Blue Origin, etc.
- Real-time countdown timers
- Launch notifications 
- Live stream discovery
- Picture-in-picture viewing
- Filter by launch providers
- No setup required - works immediately

## Files Structure

**Essential Extension Files:**
- `manifest.json` - Extension configuration
- `background.js` - Launch tracking service
- `popup.html/js` - Main interface
- `options.html/js` - Settings page
- `content.js` - Page notifications
Removed PiP and player; streams open directly in new tabs.
- `styles/` - CSS files
- `icons/` - Extension icons

Data from [The Space Devs API](https://thespacedevs.com/)

---
**© 2025 Quantin BODIN. All rights reserved.**
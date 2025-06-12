# 🔍 DEBUG GUIDE: Layout & Checkbox Issues

## 🚨 Quick Diagnostic Test

**Open the extension popup and press F12 to open Console. Look for these messages:**

### ✅ **GOOD SIGNS:**
```
🚀 Rocketer popup initialized - FIXED VERSION 3.0
🔍 Page verification:
- Has checkboxes: false
- Has settings grid: false  
- Has launch container: true
✅ Correct popup page verified
📐 Layout check:
- Body width: 400 px
- Body computed width: 400px
```

### ❌ **BAD SIGNS & SOLUTIONS:**

#### 1. **Double Checkboxes Issue:**
**Console shows:** `- Has checkboxes: true`
**Problem:** Options page loading instead of popup
**Solution:** Complete extension removal + cache clear + reload

#### 2. **Layout Width Collapse:**
**Console shows:** `- Body width: 15 px` (or other tiny number)
**Problem:** CSS not loading or being overridden
**Solution:** Clear cache and reload with updated CSS

#### 3. **Wrong Page Error:**
**Console shows:** `❌ WRONG PAGE DETECTED!`
**Problem:** Manifest pointing to wrong file or caching issue
**Solution:** Remove extension completely and reload

#### 4. **Missing Elements:**
**Console shows:** `❌ POPUP HTML CORRUPTED!`
**Problem:** HTML file corruption or wrong file loading
**Solution:** Re-download/reload extension files

## 🛠️ **Manual CSS Fix (Emergency)**

If layout is still broken, paste this in Console:

```javascript
// Emergency layout fix
document.body.style.width = '400px';
document.body.style.minWidth = '400px';
document.body.style.maxWidth = '400px';
document.querySelector('.container').style.width = '100%';
document.querySelector('.container').style.minWidth = '400px';
console.log('🔧 Emergency layout applied');
```

## 🕵️ **Deep Debugging**

### Check File Loading:
```javascript
// Check which files are loaded
console.log('CSS files:', Array.from(document.querySelectorAll('link')).map(l => l.href));
console.log('JS files:', Array.from(document.querySelectorAll('script')).map(s => s.src));
console.log('Page title:', document.title);
console.log('Body classes:', document.body.className);
```

### Check Extension Manifest:
1. Go to `chrome://extensions/`
2. Find Rocketer
3. Version should show **1.0.2**
4. Click "Details" → "Extension options" should open Settings (not main popup)

### Verify File Integrity:
- `popup.html` should have **NO** `<input type="checkbox">` elements
- `options.html` should have **MULTIPLE** checkbox elements
- If popup.html has checkboxes = files are corrupted/mixed up

## 🎯 **Expected Behavior:**

### **Popup (clicking extension icon):**
- ❌ **NO CHECKBOXES** visible
- ✅ Launch cards with countdown timers
- ✅ 400px width
- ✅ "Watch Live" and "Picture-in-Picture" buttons

### **Settings (right-click icon → Options):**
- ✅ **MULTIPLE CHECKBOXES** for filters
- ✅ Wide layout (not narrow)
- ✅ Settings sections with toggles

## 🚨 **Root Cause Analysis:**

### **Double Checkboxes = Wrong File**
- If you see checkboxes in popup = `options.html` is loading instead of `popup.html`
- This means manifest caching issue or file corruption

### **Few Pixels Width = CSS Failure**
- CSS not loading: `styles/popup.css` missing or corrupted
- CSS conflict: External styles overriding our layout
- Chrome rendering bug: Fixed with `!important` rules

### **Solutions Applied:**
1. **CSS with `!important`** - Forces our styles to override everything
2. **Multiple fallbacks** - Different CSS rules for same element
3. **Error detection** - JavaScript detects wrong page/layout issues
4. **Emergency fixes** - Auto-repair broken layouts

---

**If none of this works, the issue is likely Chrome caching or file corruption. Try the "Nuclear Option" in FORCE_REFRESH.md** 
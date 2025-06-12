# Icon Generation Instructions

The extension requires PNG icons in multiple sizes. Since we have an SVG icon, here are several ways to generate the required PNG files:

## Required Icon Sizes
- `icons/icon16.png` - 16x16 pixels
- `icons/icon32.png` - 32x32 pixels  
- `icons/icon48.png` - 48x48 pixels
- `icons/icon128.png` - 128x128 pixels

## Method 1: Using Online SVG to PNG Converter

1. Open the `icons/icon.svg` file
2. Visit https://svgtopng.com/ or similar service
3. Upload the SVG file
4. Generate PNG files at the required sizes
5. Save them in the `icons/` directory with the correct names

## Method 2: Using ImageMagick (Command Line)

If you have ImageMagick installed:

```bash
# Navigate to the Rocketer directory
cd icons/

# Convert SVG to different PNG sizes
magick icon.svg -resize 16x16 icon16.png
magick icon.svg -resize 32x32 icon32.png
magick icon.svg -resize 48x48 icon48.png
magick icon.svg -resize 128x128 icon128.png
```

## Method 3: Using Inkscape (Command Line)

If you have Inkscape installed:

```bash
# Navigate to the Rocketer directory
cd icons/

# Convert SVG to different PNG sizes
inkscape icon.svg --export-type=png --export-filename=icon16.png --export-width=16 --export-height=16
inkscape icon.svg --export-type=png --export-filename=icon32.png --export-width=32 --export-height=32
inkscape icon.svg --export-type=png --export-filename=icon48.png --export-width=48 --export-height=48
inkscape icon.svg --export-type=png --export-filename=icon128.png --export-width=128 --export-height=128
```

## Method 4: Using GIMP (GUI)

1. Open GIMP
2. File → Open → Select `icons/icon.svg`
3. Set the import size to 128x128 (for the largest icon)
4. File → Export As → `icon128.png`
5. Repeat for other sizes (or scale down the 128px version)

## Method 5: Using Browser (Quick Method)

1. Open the `icons/icon.svg` file in Chrome/Firefox
2. Right-click and "Inspect Element"
3. In the console, paste this code to download PNGs:

```javascript
// This code converts the SVG to canvas and downloads PNGs
const sizes = [16, 32, 48, 128];
const svg = document.querySelector('svg');

sizes.forEach(size => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();
  
  canvas.width = size;
  canvas.height = size;
  
  img.onload = function() {
    ctx.drawImage(img, 0, 0, size, size);
    
    // Download the PNG
    const link = document.createElement('a');
    link.download = `icon${size}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };
  
  img.src = 'data:image/svg+xml;base64,' + btoa(new XMLSerializer().serializeToString(svg));
});
```

## Temporary Workaround

If you can't generate icons immediately, you can temporarily comment out the icon references in `manifest.json` and the extension will still work, just with a default Chrome extension icon.

## File Structure After Icon Generation

```
Rocketer/
├── icons/
│   ├── icon.svg      # Source SVG (already created)
│   ├── icon16.png    # 16x16 PNG (need to generate)
│   ├── icon32.png    # 32x32 PNG (need to generate)
│   ├── icon48.png    # 48x48 PNG (need to generate)
│   └── icon128.png   # 128x128 PNG (need to generate)
└── ... (other files)
```

Choose the method that works best for your setup! 
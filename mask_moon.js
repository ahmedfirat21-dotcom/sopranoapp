const fs = require('fs');

// As we might not be sure if Jimp is available, let's check.
try {
  const Jimp = require('jimp');
  
  async function maskMoon() {
    console.log("Reading image...");
    const image = await Jimp.read('d:/28-3-26/SopranoChat/assets/images/moon.png');
    const w = image.bitmap.width;
    const h = image.bitmap.height;
    const radius = Math.min(w, h) / 2;
    const cx = w / 2;
    const cy = h / 2;

    // Apply circular mask, anything outside the radius becomes transparent.
    // Also we shrink radius by a few pixels if the checkerboard bled into the edge.
    const effectiveRadius = radius * 0.96; 
    
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dist = Math.sqrt(Math.pow(x - cx, 2) + Math.pow(y - cy, 2));
        if (dist > effectiveRadius) { 
          // Set alpha to 0 (transparent)
          const hex = image.getPixelColor(x, y);
          const r = (hex >> 24) & 255;
          const g = (hex >> 16) & 255;
          const b = (hex >> 8) & 255;
          image.setPixelColor(Jimp.rgbaToInt(r, g, b, 0), x, y);
        }
      }
    }

    console.log("Writing image...");
    await image.writeAsync('d:/28-3-26/SopranoChat/assets/images/moon.png');
    console.log("Done!");
  }

  maskMoon().catch(console.error);
} catch(e) {
  console.log("Jimp not found, trying an alternative borderRadius in React Native.");
}

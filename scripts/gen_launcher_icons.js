// Generates Android launcher icons at all densities from assets/launcher_icon.png
// Run: node scripts/gen_launcher_icons.js
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', 'assets', 'launcher_icon.png');
const RES = path.resolve(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

// { densityFolder: { launcher_px, foreground_px } }
const DENSITIES = {
  'mipmap-mdpi':    { launcher: 48,  foreground: 108 },
  'mipmap-hdpi':    { launcher: 72,  foreground: 162 },
  'mipmap-xhdpi':   { launcher: 96,  foreground: 216 },
  'mipmap-xxhdpi':  { launcher: 144, foreground: 324 },
  'mipmap-xxxhdpi': { launcher: 192, foreground: 432 },
};

async function gen() {
  if (!fs.existsSync(SRC)) {
    console.error('Source not found:', SRC);
    process.exit(1);
  }
  for (const [folder, sizes] of Object.entries(DENSITIES)) {
    const dir = path.join(RES, folder);
    fs.mkdirSync(dir, { recursive: true });

    // ic_launcher.png — legacy square icon (used on Android <8)
    await sharp(SRC).resize(sizes.launcher, sizes.launcher, { fit: 'cover' })
      .png().toFile(path.join(dir, 'ic_launcher.png'));

    // ic_launcher_round.png — legacy round icon
    await sharp(SRC).resize(sizes.launcher, sizes.launcher, { fit: 'cover' })
      .png().toFile(path.join(dir, 'ic_launcher_round.png'));

    // ic_launcher_foreground.png — adaptive icon foreground (Android 8+)
    //   Background #0F7670 applied by mipmap-anydpi-v26/ic_launcher.xml.
    //   Foreground canvas is 108x108dp; icon is centered (no extra safe-zone
    //   padding since launcher_icon already has built-in bg + visual padding).
    await sharp(SRC).resize(sizes.foreground, sizes.foreground, { fit: 'cover' })
      .png().toFile(path.join(dir, 'ic_launcher_foreground.png'));

    console.log(`✓ ${folder}`);
  }
  console.log('Done.');
}
gen().catch(e => { console.error(e); process.exit(1); });

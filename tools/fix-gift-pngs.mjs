// JPEG-disguised-as-PNG dosyalarını gerçek PNG'ye çevir
import sharp from 'sharp';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DIR = 'assets/store/items';

async function isJpeg(buf) {
  // JPEG SOI marker: 0xFF 0xD8 0xFF
  return buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
}

const files = await readdir(DIR);
let converted = 0;
for (const f of files) {
  if (!f.endsWith('.png')) continue;
  const fp = path.join(DIR, f);
  const buf = await readFile(fp);
  if (await isJpeg(buf)) {
    console.log(`Converting ${f}...`);
    const png = await sharp(buf).png().toBuffer();
    await writeFile(fp, png);
    converted++;
  }
}
console.log(`Done. Converted ${converted} files.`);

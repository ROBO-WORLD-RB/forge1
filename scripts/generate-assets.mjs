import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const iconsDir = 'public/icons';

const pngSizes = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon-152.png', 152],
  ['apple-touch-icon-167.png', 167],
  ['apple-touch-icon-180.png', 180],
];

const splashSizes = [
  ['splash-640x1136.png', 640, 1136],
  ['splash-750x1334.png', 750, 1334],
  ['splash-1242x2208.png', 1242, 2208],
  ['splash-1125x2436.png', 1125, 2436],
  ['splash-1536x2048.png', 1536, 2048],
  ['splash-1668x2224.png', 1668, 2224],
  ['splash-2048x2732.png', 2048, 2732],
];

async function main() {
  const svgBuffer = fs.readFileSync(path.join(iconsDir, 'icon-512.svg'));

  for (const [name, size] of pngSizes) {
    await sharp(svgBuffer).resize(size, size).png().toFile(path.join(iconsDir, name));
    console.log('Created:', name);
  }

  await sharp(svgBuffer).resize(180, 180).png().toFile(path.join(iconsDir, 'apple-touch-icon.png'));
  console.log('Created: apple-touch-icon.png');

  const splashSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2732">
    <rect width="2048" height="2732" fill="#1A1A2E"/>
    <text x="1024" y="1300" font-family="Inter,sans-serif" font-size="120" font-weight="700" fill="#FF6B2E" text-anchor="middle">FORGE</text>
    <text x="1024" y="1420" font-family="Inter,sans-serif" font-size="36" fill="rgba(255,255,255,0.5)" text-anchor="middle">Loading...</text>
  </svg>`;

  const splashBuffer = Buffer.from(splashSvg);

  for (const [name, w, h] of splashSizes) {
    await sharp(splashBuffer).resize(w, h).png().toFile(path.join(iconsDir, name));
    console.log('Created:', name);
  }

  // screenshot-mobile.png for manifest screenshots
  const ssW = 375, ssH = 812;
  const ssSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ssW}" height="${ssH}">
    <rect width="${ssW}" height="${ssH}" fill="#1A1A2E"/>
    <text x="${ssW/2}" y="${ssH*0.4}" font-family="Inter,sans-serif" font-size="60" font-weight="700" fill="#FF6B2E" text-anchor="middle">FORGE</text>
    <text x="${ssW/2}" y="${ssH*0.48}" font-family="Inter,sans-serif" font-size="18" fill="rgba(255,255,255,0.6)" text-anchor="middle">Blue-Collar Marketplace</text>
    <rect x="40" y="${ssH*0.55}" width="${ssW-80}" height="50" rx="8" fill="rgba(255,107,46,0.2)"/>
    <text x="${ssW/2}" y="${ssH*0.585}" font-family="Inter,sans-serif" font-size="16" fill="#FF6B2E" text-anchor="middle">Find Verified Professionals</text>
    <rect x="40" y="${ssH*0.63}" width="${ssW-80}" height="50" rx="8" fill="rgba(255,255,255,0.05)"/>
    <text x="${ssW/2}" y="${ssH*0.665}" font-family="Inter,sans-serif" font-size="14" fill="rgba(255,255,255,0.4)" text-anchor="middle">Electricians . Plumbers . Caterers</text>
  </svg>`;

  await sharp(Buffer.from(ssSvg)).resize(ssW, ssH).png().toFile(path.join(iconsDir, 'screenshot-mobile.png'));
  console.log('Created: screenshot-mobile.png');

  // og-image.png for social sharing
  const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
    <rect width="1200" height="630" fill="#1A1A2E"/>
    <text x="100" y="280" font-family="Inter,sans-serif" font-size="96" font-weight="700" fill="#FF6B2E">FORGE</text>
    <text x="100" y="350" font-family="Inter,sans-serif" font-size="32" fill="rgba(255,255,255,0.7)">Blue-Collar Marketplace</text>
    <text x="100" y="400" font-family="Inter,sans-serif" font-size="20" fill="rgba(255,255,255,0.4)">Ghana . Nigeria . Verified Professionals</text>
  </svg>`;

  await sharp(Buffer.from(ogSvg)).resize(1200, 630).png().toFile(path.join('public', 'og-image.png'));
  console.log('Created: og-image.png');

  console.log('\nAll assets generated!');
}

main().catch(console.error);

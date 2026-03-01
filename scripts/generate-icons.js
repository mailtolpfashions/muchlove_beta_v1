/**
 * Generate salon-themed app icons for "Much Love" beauty salon billing app.
 * Run: node scripts/generate-icons.js
 *
 * Design: A prominent heart icon representing "Much Love" with a small
 * receipt/billing accent, on a rose-pink gradient background.
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'images');

// Rose/pink salon color palette
const ROSE = '#E91E63';
const ROSE_DEEP = '#AD1457';
const ROSE_DARKER = '#880E4F';
const GOLD = '#D4AF37';
const WHITE = '#FFFFFF';
const PINK_LIGHT = '#F8BBD0';

function createIconSvg(size) {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const f = s / 1024;

  // Same design as favicon – simple heart on gradient with rounded corners
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${ROSE}" />
      <stop offset="100%" stop-color="${ROSE_DEEP}" />
    </linearGradient>
  </defs>
  <rect width="${s}" height="${s}" rx="${Math.round(s * 0.18)}" fill="url(#bg)" />
  <!-- Heart -->
  <g transform="translate(${cx}, ${cy + Math.round(10 * f)}) scale(${f * 0.55})">
    <path d="M0 220 C0 220, -260 40, -260 -80 C-260 -180, -140 -240, 0 -120 C140 -240, 260 -180, 260 -80 C260 40, 0 220, 0 220Z"
          fill="${WHITE}" opacity="0.95" />
  </g>
</svg>`;
}

function createAdaptiveIconSvg(size) {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const f = s / 1024;

  // Same design as favicon – simple heart on gradient, full bleed (no rounded corners) for adaptive icon
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${ROSE}" />
      <stop offset="100%" stop-color="${ROSE_DEEP}" />
    </linearGradient>
  </defs>
  <!-- Full bleed background for adaptive icon -->
  <rect width="${s}" height="${s}" fill="url(#bg)" />
  <!-- Heart -->
  <g transform="translate(${cx}, ${cy + Math.round(10 * f)}) scale(${f * 0.55})">
    <path d="M0 220 C0 220, -260 40, -260 -80 C-260 -180, -140 -240, 0 -120 C140 -240, 260 -180, 260 -80 C260 40, 0 220, 0 220Z"
          fill="${WHITE}" opacity="0.95" />
  </g>
</svg>`;
}

function createFaviconSvg(size) {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const f = s / 1024;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${ROSE}" />
      <stop offset="100%" stop-color="${ROSE_DEEP}" />
    </linearGradient>
  </defs>
  <rect width="${s}" height="${s}" rx="${Math.round(s * 0.18)}" fill="url(#bg)" />
  <!-- Heart -->
  <g transform="translate(${cx}, ${cy + Math.round(10 * f)}) scale(${f * 0.55})">
    <path d="M0 220 C0 220, -260 40, -260 -80 C-260 -180, -140 -240, 0 -120 C140 -240, 260 -180, 260 -80 C260 40, 0 220, 0 220Z"
          fill="${WHITE}" opacity="0.95" />
  </g>
</svg>`;
}

function createSplashIconSvg(size) {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const f = s / 1024;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs>
    <linearGradient id="heartSplash" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${ROSE}" />
      <stop offset="100%" stop-color="${ROSE_DEEP}" />
    </linearGradient>
  </defs>

  <!-- Transparent background for splash -->
  <rect width="${s}" height="${s}" fill="none" />

  <!-- Large Heart -->
  <g transform="translate(${cx}, ${cy - Math.round(80 * f)}) scale(${f * 1.1})">
    <path d="M0 220 C0 220, -260 40, -260 -80 C-260 -180, -140 -240, 0 -120 C140 -240, 260 -180, 260 -80 C260 40, 0 220, 0 220Z"
          fill="url(#heartSplash)" />
  </g>

  <!-- Receipt accent inside heart -->
  <g transform="translate(${cx}, ${cy - Math.round(100 * f)}) scale(${f * 0.55})">
    <rect x="-55" y="-80" width="110" height="140" rx="10" fill="${WHITE}" opacity="0.9" />
    <polyline points="-55,60 -38,48 -21,60 -4,48 13,60 30,48 47,60 55,60" fill="none" stroke="${WHITE}" stroke-width="3" opacity="0.9" />
    <line x1="-30" y1="-50" x2="30" y2="-50" stroke="${ROSE_DEEP}" stroke-width="5" stroke-linecap="round" opacity="0.6" />
    <line x1="-30" y1="-25" x2="15" y2="-25" stroke="${ROSE_DEEP}" stroke-width="5" stroke-linecap="round" opacity="0.5" />
    <line x1="-30" y1="0" x2="22" y2="0" stroke="${ROSE_DEEP}" stroke-width="5" stroke-linecap="round" opacity="0.5" />
    <text x="0" y="42" text-anchor="middle" font-family="Arial, sans-serif" font-size="42" font-weight="bold" fill="${GOLD}" opacity="0.9">₹</text>
  </g>

  <!-- Gold sparkles -->
  <circle cx="${cx + Math.round(200 * f)}" cy="${cy - Math.round(260 * f)}" r="${Math.round(9 * f)}" fill="${GOLD}" opacity="0.7" />
  <circle cx="${cx - Math.round(190 * f)}" cy="${cy - Math.round(240 * f)}" r="${Math.round(7 * f)}" fill="${GOLD}" opacity="0.6" />

  <!-- Much Love text -->
  <text x="${cx}" y="${cy + Math.round(240 * f)}" text-anchor="middle" font-family="Georgia, serif" font-size="${Math.round(110 * f)}" font-weight="bold" fill="${ROSE_DEEP}" letter-spacing="${Math.round(6 * f)}">Much Love</text>
  <text x="${cx}" y="${cy + Math.round(310 * f)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.round(50 * f)}" fill="${ROSE}" opacity="0.7" letter-spacing="${Math.round(14 * f)}">BILLING</text>
</svg>`;
}

async function generate() {
  console.log('🎨 Generating salon-themed icons...\n');

  // icon.png - 1024x1024
  const iconSvg = Buffer.from(createIconSvg(1024));
  await sharp(iconSvg).png().toFile(path.join(OUTPUT_DIR, 'icon.png'));
  console.log('✅ icon.png (1024x1024)');

  // adaptive-icon.png - 1024x1024 (full bleed for Android)
  const adaptiveSvg = Buffer.from(createAdaptiveIconSvg(1024));
  await sharp(adaptiveSvg).png().toFile(path.join(OUTPUT_DIR, 'adaptive-icon.png'));
  console.log('✅ adaptive-icon.png (1024x1024)');

  // favicon.png - 48x48
  // Generate at higher res then resize for quality
  const faviconSvg = Buffer.from(createFaviconSvg(512));
  await sharp(faviconSvg).resize(48, 48).png().toFile(path.join(OUTPUT_DIR, 'favicon.png'));
  console.log('✅ favicon.png (48x48)');

  // splash-icon.png - 1024x1024
  const splashSvg = Buffer.from(createSplashIconSvg(1024));
  await sharp(splashSvg).png().toFile(path.join(OUTPUT_DIR, 'splash-icon.png'));
  console.log('✅ splash-icon.png (1024x1024)');

  console.log('\n🎉 All icons generated in assets/images/');
}

generate().catch(console.error);

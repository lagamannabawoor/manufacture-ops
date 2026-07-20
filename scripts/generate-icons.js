#!/usr/bin/env node
/**
 * Generates Urbanmud app icons from public/logo.svg using sharp.
 * Run: node scripts/generate-icons.js
 */
const sharp = require('sharp');
const path  = require('path');
const fs    = require('fs');

const svgPath = path.join(__dirname, '..', 'public', 'logo.svg');
const svg = fs.readFileSync(svgPath);

const androidDirs = {
  'mipmap-mdpi':    48,
  'mipmap-hdpi':    72,
  'mipmap-xhdpi':   96,
  'mipmap-xxhdpi':  144,
  'mipmap-xxxhdpi': 192,
};

const androidBase = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');
const publicDir   = path.join(__dirname, '..', 'public');

async function run() {
  // Android launcher icons
  for (const [dir, size] of Object.entries(androidDirs)) {
    const dest = path.join(androidBase, dir, 'ic_launcher.png');
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    await sharp(svg).resize(size, size).png().toFile(dest);
    console.log(`✓ ${dir}/ic_launcher.png (${size}x${size})`);
  }

  // Round icons (same sizes, Android adaptive)
  for (const [dir, size] of Object.entries(androidDirs)) {
    const dest = path.join(androidBase, dir, 'ic_launcher_round.png');
    await sharp(svg).resize(size, size).png().toFile(dest);
    console.log(`✓ ${dir}/ic_launcher_round.png (${size}x${size})`);
  }

  // PWA / web icons
  await sharp(svg).resize(192, 192).png().toFile(path.join(publicDir, 'icon-192.png'));
  console.log('✓ public/icon-192.png');
  await sharp(svg).resize(512, 512).png().toFile(path.join(publicDir, 'icon-512.png'));
  console.log('✓ public/icon-512.png');

  console.log('\nAll icons generated successfully.');
}

run().catch(err => { console.error(err); process.exit(1); });

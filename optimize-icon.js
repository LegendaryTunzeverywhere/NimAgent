#!/usr/bin/env node
/**
 * Optimize icon for PWA and Apple touch icons.
 * 
 * Usage:
 *   node optimize-icon.js input.png
 * 
 * Output:
 *   public/icon-1024.png (1024×1024, optimized)
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function optimizeIcon(inputPath) {
  if (!inputPath) {
    console.error('❌ Usage: node optimize-icon.js <input-image>');
    process.exit(1);
  }

  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Input file not found: ${inputPath}`);
    process.exit(1);
  }

  const outputPath = path.join(__dirname, 'public', 'icon-1024.png');

  console.log('🎨 Optimizing app icon...');
  console.log(`   Input:  ${inputPath}`);
  console.log(`   Output: ${outputPath}`);

  try {
    const metadata = await sharp(inputPath).metadata();
    console.log(`   Original: ${metadata.width}×${metadata.height} (${(metadata.size / 1024).toFixed(1)}KB)`);

    // Icon spec: 1024×1024px, square, optimized PNG
    await sharp(inputPath)
      .resize(1024, 1024, {
        fit: 'contain',      // Maintain aspect ratio, fit within bounds
        background: { r: 0, g: 0, b: 0, alpha: 0 }, // Transparent background
      })
      .png({
        quality: 100,        // Maximum quality for icons
        compressionLevel: 9, // Max compression
        adaptiveFiltering: true,
      })
      .toFile(outputPath);

    const outputStats = fs.statSync(outputPath);
    console.log(`   ✅ Optimized: 1024×1024 (${(outputStats.size / 1024).toFixed(1)}KB)`);

    if (outputStats.size > 500 * 1024) {
      console.warn(`   ⚠️  Warning: File is ${(outputStats.size / 1024).toFixed(1)}KB (recommended <500KB)`);
    }

  } catch (err) {
    console.error('❌ Optimization failed:', err.message);
    process.exit(1);
  }
}

// Run
const inputPath = process.argv[2];
optimizeIcon(inputPath);

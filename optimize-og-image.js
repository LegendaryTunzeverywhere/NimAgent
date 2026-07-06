#!/usr/bin/env node
/**
 * Optimize OG card image for social sharing.
 * 
 * Usage:
 *   node optimize-og-image.js input.png [--format webp|png]
 * 
 * Output:
 *   public/og-image.webp (1200x630, optimized WebP - default)
 *   public/og-image.png (1200x630, optimized PNG - fallback)
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function optimizeOGImage(inputPath, format = 'webp') {
  if (!inputPath) {
    console.error('❌ Usage: node optimize-og-image.js <input-image> [--format webp|png]');
    process.exit(1);
  }

  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Input file not found: ${inputPath}`);
    process.exit(1);
  }

  const extension = format === 'webp' ? 'webp' : 'png';
  const outputPath = path.join(__dirname, 'public', `og-image.${extension}`);
  const normalizedInput = path.resolve(inputPath);
  const normalizedOutput = path.resolve(outputPath);
  
  // Check if input and output are the same file (in-place optimization)
  const isInPlace = normalizedInput === normalizedOutput;
  const tempPath = isInPlace ? path.join(__dirname, 'public', `og-image.temp.${extension}`) : null;
  const finalOutput = isInPlace ? tempPath : outputPath;

  console.log('🖼️  Optimizing OG image...');
  console.log(`   Input:  ${inputPath}`);
  console.log(`   Output: ${outputPath}`);
  console.log(`   Format: ${format.toUpperCase()}`);
  if (isInPlace) {
    console.log('   (In-place optimization detected, using temporary file)');
  }

  try {
    const metadata = await sharp(inputPath).metadata();
    console.log(`   Original: ${metadata.width}×${metadata.height} (${(metadata.size / 1024).toFixed(1)}KB)`);

    // Start with resize
    let pipeline = sharp(inputPath)
      .resize(1200, 630, {
        fit: 'cover',        // Crop to exact 1200×630
        position: 'center',  // Center the crop
      });

    // Apply format-specific optimization
    if (format === 'webp') {
      pipeline = pipeline.webp({
        quality: 85,         // High quality for WebP
        effort: 6,          // Max effort (0-6, higher = better compression)
      });
    } else {
      pipeline = pipeline.png({
        quality: 90,         // High quality
        compressionLevel: 9, // Max compression
        adaptiveFiltering: true,
      });
    }

    await pipeline.toFile(finalOutput);

    // If in-place, replace original with optimized version
    if (isInPlace) {
      fs.unlinkSync(normalizedInput);
      fs.renameSync(tempPath, normalizedOutput);
    }

    const outputStats = fs.statSync(outputPath);
    console.log(`   ✅ Optimized: 1200×630 (${(outputStats.size / 1024).toFixed(1)}KB)`);

    if (outputStats.size > 200 * 1024) {
      console.warn(`   ⚠️  Warning: File is ${(outputStats.size / 1024).toFixed(1)}KB (recommended <200KB)`);
      if (format !== 'webp') {
        console.log('   💡 Try using --format webp for better compression');
      }
    } else {
      console.log(`   ✨ Great! File size is under 200KB`);
    }

  } catch (err) {
    console.error('❌ Optimization failed:', err.message);
    // Clean up temp file if it exists
    if (tempPath && fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    process.exit(1);
  }
}

// Parse arguments
const args = process.argv.slice(2);
const inputPath = args.find(arg => !arg.startsWith('--'));
const formatArg = args.find(arg => arg.startsWith('--format='));
const format = formatArg ? formatArg.split('=')[1] : 'webp';

// Validate format
if (format !== 'webp' && format !== 'png') {
  console.error('❌ Invalid format. Use --format=webp or --format=png');
  process.exit(1);
}

// Run
optimizeOGImage(inputPath, format);

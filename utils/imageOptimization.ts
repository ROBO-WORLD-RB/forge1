/**
 * Image Optimization Utility
 * 
 * Provides functions to analyze and optimize images.
 * This is used for testing image optimization effectiveness (Requirements 5.3).
 */

export interface ImageOptimizationResult {
  originalSize: number;
  optimizedSize: number;
  format: string;
  compressionRatio: number;
}

export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  size: number;
}

/**
 * Simulates image compression by calculating expected output size
 * based on quality settings. In production, this would use actual
 * image processing libraries.
 */
export function estimateCompressedSize(
  originalSize: number,
  quality: number,
  targetFormat: 'webp' | 'jpeg' | 'png' | 'original'
): number {
  // Validate inputs
  if (originalSize <= 0) {
    throw new Error('Original size must be positive');
  }
  if (quality < 0 || quality > 100) {
    throw new Error('Quality must be between 0 and 100');
  }

  // Format-specific compression ratios (approximate)
  const formatRatios: Record<string, number> = {
    webp: 0.65,    // WebP typically achieves 25-35% smaller than JPEG
    jpeg: 0.85,    // JPEG with quality reduction
    png: 0.95,     // PNG is lossless, minimal reduction
    original: 1.0, // No format change
  };

  const formatRatio = formatRatios[targetFormat] || 1.0;
  const qualityRatio = quality / 100;
  
  // Calculate estimated size
  // Higher quality = larger file, lower quality = smaller file
  const estimatedSize = Math.ceil(originalSize * formatRatio * (0.3 + 0.7 * qualityRatio));
  
  // Ensure we don't exceed original size
  return Math.min(estimatedSize, originalSize);
}

/**
 * Generates an optimized image URL with query parameters
 * for vite-imagetools processing
 */
export function getOptimizedImageUrl(
  imagePath: string,
  options: {
    format?: 'webp' | 'jpeg' | 'png';
    width?: number;
    height?: number;
    quality?: number;
  } = {}
): string {
  const params = new URLSearchParams();
  
  if (options.format) {
    params.set('format', options.format);
  }
  if (options.width) {
    params.set('w', options.width.toString());
  }
  if (options.height) {
    params.set('h', options.height.toString());
  }
  if (options.quality) {
    params.set('quality', options.quality.toString());
  }
  
  const queryString = params.toString();
  return queryString ? `${imagePath}?${queryString}` : imagePath;
}

/**
 * Validates that an image optimization result meets requirements
 */
export function validateOptimizationResult(result: ImageOptimizationResult): boolean {
  // Optimized size should not exceed original size
  if (result.optimizedSize > result.originalSize) {
    return false;
  }
  
  // Compression ratio should be between 0 and 1
  if (result.compressionRatio < 0 || result.compressionRatio > 1) {
    return false;
  }
  
  // Format should be valid
  const validFormats = ['webp', 'jpeg', 'png', 'gif', 'svg'];
  if (!validFormats.includes(result.format.toLowerCase())) {
    return false;
  }
  
  return true;
}

/**
 * Creates an optimization result from before/after sizes
 */
export function createOptimizationResult(
  originalSize: number,
  optimizedSize: number,
  format: string
): ImageOptimizationResult {
  return {
    originalSize,
    optimizedSize,
    format,
    compressionRatio: optimizedSize / originalSize,
  };
}

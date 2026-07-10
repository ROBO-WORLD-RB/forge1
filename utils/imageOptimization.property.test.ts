import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  estimateCompressedSize,
  getOptimizedImageUrl,
  validateOptimizationResult,
  createOptimizationResult,
} from './imageOptimization';

/**
 * Feature: infrastructure-enhancements, Property 13: Image Optimization Output
 * Validates: Requirements 5.3
 * 
 * For any input image processed during build, the output file size should be
 * less than or equal to the input file size.
 */
describe('Image Optimization Property Tests', () => {
  // Arbitrary for valid image sizes (1KB to 10MB)
  const imageSizeArb = fc.integer({ min: 1024, max: 10 * 1024 * 1024 });
  
  // Arbitrary for quality settings (1-100)
  const qualityArb = fc.integer({ min: 1, max: 100 });
  
  // Arbitrary for target formats
  const formatArb = fc.constantFrom('webp', 'jpeg', 'png', 'original') as fc.Arbitrary<'webp' | 'jpeg' | 'png' | 'original'>;
  
  // Arbitrary for valid image formats
  const validFormatArb = fc.constantFrom('webp', 'jpeg', 'png', 'gif', 'svg');

  it('optimized size is always less than or equal to original size', () => {
    fc.assert(
      fc.property(
        imageSizeArb,
        qualityArb,
        formatArb,
        (originalSize, quality, format) => {
          const optimizedSize = estimateCompressedSize(originalSize, quality, format);
          
          // Property: Output size should never exceed input size
          expect(optimizedSize).toBeLessThanOrEqual(originalSize);
          expect(optimizedSize).toBeGreaterThan(0);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('WebP format produces smaller output than original', () => {
    fc.assert(
      fc.property(
        imageSizeArb,
        qualityArb,
        (originalSize, quality) => {
          const webpSize = estimateCompressedSize(originalSize, quality, 'webp');
          const originalFormatSize = estimateCompressedSize(originalSize, quality, 'original');
          
          // Property: WebP should produce smaller or equal output
          expect(webpSize).toBeLessThanOrEqual(originalFormatSize);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('lower quality produces smaller or equal output', () => {
    fc.assert(
      fc.property(
        imageSizeArb,
        fc.integer({ min: 50, max: 100 }), // High quality
        fc.integer({ min: 1, max: 49 }),   // Low quality
        formatArb,
        (originalSize, highQuality, lowQuality, format) => {
          const highQualitySize = estimateCompressedSize(originalSize, highQuality, format);
          const lowQualitySize = estimateCompressedSize(originalSize, lowQuality, format);
          
          // Property: Lower quality should produce smaller or equal output
          expect(lowQualitySize).toBeLessThanOrEqual(highQualitySize);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('optimization result validation works correctly', () => {
    fc.assert(
      fc.property(
        imageSizeArb,
        qualityArb,
        validFormatArb,
        (originalSize, quality, format) => {
          const optimizedSize = estimateCompressedSize(originalSize, quality, format === 'gif' || format === 'svg' ? 'original' : format as 'webp' | 'jpeg' | 'png');
          const result = createOptimizationResult(originalSize, optimizedSize, format);
          
          // Property: Valid optimization results should pass validation
          expect(validateOptimizationResult(result)).toBe(true);
          
          // Property: Compression ratio should be between 0 and 1
          expect(result.compressionRatio).toBeGreaterThan(0);
          expect(result.compressionRatio).toBeLessThanOrEqual(1);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('getOptimizedImageUrl generates valid URLs', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^\/images\/[a-z0-9-]+\.(jpg|png|gif)$/),
        fc.option(fc.constantFrom('webp', 'jpeg', 'png') as fc.Arbitrary<'webp' | 'jpeg' | 'png'>),
        fc.option(fc.integer({ min: 100, max: 2000 })),
        fc.option(qualityArb),
        (imagePath, format, width, quality) => {
          const url = getOptimizedImageUrl(imagePath, {
            format: format ?? undefined,
            width: width ?? undefined,
            quality: quality ?? undefined,
          });
          
          // Property: URL should start with the original path
          expect(url.startsWith(imagePath)).toBe(true);
          
          // Property: If options provided, URL should have query params
          if (format || width || quality) {
            expect(url).toContain('?');
          }
          
          // Property: Format param should be present if specified
          if (format) {
            expect(url).toContain(`format=${format}`);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('invalid inputs throw appropriate errors', () => {
    // Test negative size
    expect(() => estimateCompressedSize(-100, 80, 'webp')).toThrow('Original size must be positive');
    
    // Test zero size
    expect(() => estimateCompressedSize(0, 80, 'webp')).toThrow('Original size must be positive');
    
    // Test invalid quality (too low)
    expect(() => estimateCompressedSize(1000, -1, 'webp')).toThrow('Quality must be between 0 and 100');
    
    // Test invalid quality (too high)
    expect(() => estimateCompressedSize(1000, 101, 'webp')).toThrow('Quality must be between 0 and 100');
  });
});

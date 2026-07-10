import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { purgeCSS, extractSelectors, minifyCSS } from './cssPurge';

/**
 * Feature: infrastructure-enhancements, Property 14: CSS Purge Effectiveness
 * Validates: Requirements 5.5
 * 
 * For any CSS input with unused selectors, the purged output should have
 * fewer bytes than the input.
 */
describe('CSS Purge Property Tests', () => {
  // Arbitrary for generating valid CSS class names (unique)
  const uniqueClassNamesArb = fc.uniqueArray(
    fc.stringMatching(/^[a-z][a-z0-9]{1,10}$/),
    { minLength: 2, maxLength: 5 }
  );
  
  // Arbitrary for generating CSS property-value pairs
  const cssPropertyArb = fc.constantFrom(
    'color: red',
    'background: blue',
    'margin: 10px',
    'padding: 5px',
    'display: flex',
    'font-size: 14px',
    'border: 1px solid black'
  );

  it('purged CSS has fewer or equal bytes when unused selectors exist', () => {
    fc.assert(
      fc.property(
        // Generate unique class names
        uniqueClassNamesArb,
        cssPropertyArb,
        // Generate which rules are "used" (count)
        fc.nat({ max: 4 }),
        (classNames, property, usedCount) => {
          // Ensure we have at least one unused rule
          const actualUsedCount = Math.min(usedCount, classNames.length - 1);
          
          // Create CSS rules from unique class names
          const css = classNames.map(name => `.${name} { ${property}; }`).join('\n');
          
          // Only use some of the classes in HTML
          const usedClasses = classNames.slice(0, actualUsedCount);
          const html = usedClasses.length > 0 
            ? `<div class="${usedClasses.join(' ')}"></div>`
            : '<div></div>';
          
          const result = purgeCSS(css, html);
          
          // Property: If there are unused selectors, purged size should be smaller
          if (result.removedSelectors.length > 0) {
            expect(result.purgedSize).toBeLessThan(result.originalSize);
          }
          
          // Property: Retained selectors should all be used in HTML
          for (const selector of result.retainedSelectors) {
            const className = selector.replace('.', '');
            expect(usedClasses).toContain(className);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('extractSelectors finds all CSS selectors', () => {
    fc.assert(
      fc.property(
        uniqueClassNamesArb,
        (classNames) => {
          // Create CSS with known selectors
          const css = classNames.map(name => `.${name} { color: red; }`).join('\n');
          const extracted = extractSelectors(css);
          
          // All class names should be found as selectors
          for (const name of classNames) {
            expect(extracted).toContain(`.${name}`);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('minifyCSS reduces or maintains CSS size', () => {
    fc.assert(
      fc.property(
        uniqueClassNamesArb,
        cssPropertyArb,
        (classNames, property) => {
          // Create CSS rules with extra whitespace
          const css = classNames.map(name => `.${name}  {  ${property};  }`).join('\n\n  ');
          const minified = minifyCSS(css);
          
          // Minified CSS should be smaller or equal
          expect(minified.length).toBeLessThanOrEqual(css.length);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('purging preserves all used selectors', () => {
    fc.assert(
      fc.property(
        uniqueClassNamesArb,
        (classNames) => {
          // Use all classes in HTML
          const html = `<div class="${classNames.join(' ')}"></div>`;
          const css = classNames.map(name => `.${name} { color: red; }`).join('\n');
          
          const result = purgeCSS(css, html);
          
          // No selectors should be removed when all are used
          expect(result.removedSelectors.length).toBe(0);
          expect(result.retainedSelectors.length).toBe(classNames.length);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

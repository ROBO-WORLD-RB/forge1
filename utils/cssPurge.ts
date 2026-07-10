/**
 * CSS Purge Utility
 * 
 * Provides functions to analyze and purge unused CSS selectors.
 * This is used for testing CSS purge effectiveness (Requirements 5.5).
 */

export interface CSSPurgeResult {
  originalSize: number;
  purgedSize: number;
  removedSelectors: string[];
  retainedSelectors: string[];
}

/**
 * Extracts CSS selectors from a CSS string
 */
export function extractSelectors(css: string): string[] {
  const selectorRegex = /([.#]?[\w-]+(?:\s*[>+~]\s*[.#]?[\w-]+)*)\s*\{/g;
  const selectors: string[] = [];
  let match;
  
  while ((match = selectorRegex.exec(css)) !== null) {
    const selector = match[1].trim();
    if (selector && !selector.startsWith('@')) {
      selectors.push(selector);
    }
  }
  
  return selectors;
}

/**
 * Checks if a selector is used in the HTML content
 */
export function isSelectorUsed(selector: string, htmlContent: string): boolean {
  // Handle class selectors
  if (selector.startsWith('.')) {
    const className = selector.slice(1).split(/[\s>+~]/)[0];
    const classRegex = new RegExp(`class=["'][^"']*\\b${escapeRegex(className)}\\b[^"']*["']`, 'i');
    return classRegex.test(htmlContent);
  }
  
  // Handle ID selectors
  if (selector.startsWith('#')) {
    const idName = selector.slice(1).split(/[\s>+~]/)[0];
    const idRegex = new RegExp(`id=["']${escapeRegex(idName)}["']`, 'i');
    return idRegex.test(htmlContent);
  }
  
  // Handle element selectors
  const tagName = selector.split(/[\s>+~.#]/)[0];
  if (tagName) {
    const tagRegex = new RegExp(`<${escapeRegex(tagName)}[\\s>]`, 'i');
    return tagRegex.test(htmlContent);
  }
  
  return false;
}

/**
 * Escapes special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Purges unused CSS selectors based on HTML content
 */
export function purgeCSS(css: string, htmlContent: string): CSSPurgeResult {
  const originalSize = css.length;
  const selectors = extractSelectors(css);
  const removedSelectors: string[] = [];
  const retainedSelectors: string[] = [];
  
  let purgedCSS = css;
  
  for (const selector of selectors) {
    if (!isSelectorUsed(selector, htmlContent)) {
      // Remove the entire rule block for unused selectors
      const ruleRegex = new RegExp(
        `${escapeRegex(selector)}\\s*\\{[^}]*\\}`,
        'g'
      );
      purgedCSS = purgedCSS.replace(ruleRegex, '');
      removedSelectors.push(selector);
    } else {
      retainedSelectors.push(selector);
    }
  }
  
  // Clean up extra whitespace
  purgedCSS = purgedCSS.replace(/\n\s*\n/g, '\n').trim();
  
  return {
    originalSize,
    purgedSize: purgedCSS.length,
    removedSelectors,
    retainedSelectors,
  };
}

/**
 * Minifies CSS by removing whitespace and comments
 */
export function minifyCSS(css: string): string {
  return css
    // Remove comments
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // Remove whitespace around special characters
    .replace(/\s*([{}:;,>+~])\s*/g, '$1')
    // Remove multiple spaces
    .replace(/\s+/g, ' ')
    // Remove leading/trailing whitespace
    .trim();
}

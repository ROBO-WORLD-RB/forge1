import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: ollama-proxy-fix, Bug Condition Exploration Test
 * Validates: Bug Condition
 * 
 * This test explores the bug condition where HTTP requests to `/ollama/api/tags`
 * return HTTP 500 errors instead of being properly proxied to the local Ollama service.
 * 
 * EXPECTED BEHAVIOR FOR BUG EXPLORATION:
 * This test SHOULD FAIL with HTTP 500 errors on unfixed code.
 * The failure confirms the bug exists and documents the failing condition.
 * 
 * When the Vite proxy is properly configured, this test will pass.
 */

describe('Ollama Service - Bug Condition Exploration', () => {
  /**
   * Bug Condition: HTTP 500 errors when accessing /ollama/api/tags
   * 
   * This property test verifies that requests to the Ollama API endpoints
   * do not return HTTP 500 errors. Currently, without proper Vite proxy
   * configuration, these requests fail with 500 errors.
   * 
   * The test makes HTTP requests to `/ollama/api/tags` and documents
   * the failing condition (HTTP 500 response).
   */
  describe('Property: Ollama API requests should not return 500 errors', () => {
    it('for any request to /ollama/api/tags, should not receive HTTP 500 error', async () => {
      // This test explores the bug by making a real HTTP request
      // to the /ollama/api/tags endpoint through the development server
      
      const baseUrl = 'http://localhost:3000';
      const endpoint = '/ollama/api/tags';
      
      try {
        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        // Document the failing condition
        console.log(`[BUG EXPLORATION] Request to ${endpoint}`);
        console.log(`[BUG EXPLORATION] Response Status: ${response.status}`);
        console.log(`[BUG EXPLORATION] Response OK: ${response.ok}`);

        // The bug condition: we expect HTTP 500 errors on unfixed code
        // This assertion will FAIL, confirming the bug exists
        expect(response.status).not.toBe(500);
        
        // If we get here without 500, verify we get a valid response
        if (response.ok) {
          const data = await response.json();
          expect(data).toBeDefined();
          console.log(`[BUG EXPLORATION] Response data:`, data);
        }
      } catch (error) {
        // Connection errors are expected if Ollama is not running
        // or if the proxy is not configured
        console.log(`[BUG EXPLORATION] Request failed with error:`, error);
        
        // Document the error condition
        if (error instanceof TypeError) {
          console.log(`[BUG EXPLORATION] TypeError (likely connection error):`, error.message);
        }
        
        // For bug exploration, we expect this to fail
        // The error confirms the proxy is not working
        throw error;
      }
    });

    /**
     * Bug Condition: Verify the specific failing scenario
     * 
     * This test specifically documents the HTTP 500 error condition
     * that occurs when the Vite proxy is not configured.
     */
    it('documents the HTTP 500 error condition when proxy is not configured', async () => {
      const baseUrl = 'http://localhost:3000';
      const endpoint = '/ollama/api/tags';
      
      let responseStatus: number | null = null;
      let responseOk: boolean | null = null;
      let errorMessage: string | null = null;

      try {
        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: 'GET',
        });

        responseStatus = response.status;
        responseOk = response.ok;

        console.log(`[BUG CONDITION DOCUMENTED]`);
        console.log(`  Endpoint: ${endpoint}`);
        console.log(`  Status: ${responseStatus}`);
        console.log(`  OK: ${responseOk}`);

        // This is the bug condition we're documenting:
        // Without proxy configuration, Vite returns 500 errors
        if (responseStatus === 500) {
          console.log(`[BUG CONFIRMED] HTTP 500 error received - proxy not configured`);
        }

        // The test fails if we get a 500 error (confirming the bug)
        expect(responseStatus).not.toBe(500);
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : String(error);
        console.log(`[BUG CONDITION] Request error:`, errorMessage);
        
        // Connection errors are also part of the bug condition
        throw error;
      }
    });

    /**
     * Bug Condition: Verify /ollama/api/chat endpoint also fails
     * 
     * The bug affects both /ollama/api/tags and /ollama/api/chat endpoints.
     * This test documents the failing condition for the chat endpoint.
     */
    it('documents HTTP 500 error for /ollama/api/chat endpoint', async () => {
      const baseUrl = 'http://localhost:3000';
      const endpoint = '/ollama/api/chat';
      
      try {
        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gemma3:4b',
            messages: [{ role: 'user', content: 'test' }],
          }),
        });

        console.log(`[BUG EXPLORATION] POST request to ${endpoint}`);
        console.log(`[BUG EXPLORATION] Response Status: ${response.status}`);

        // Document the bug condition
        if (response.status === 500) {
          console.log(`[BUG CONFIRMED] HTTP 500 error on /ollama/api/chat - proxy not configured`);
        }

        // The test fails if we get a 500 error
        expect(response.status).not.toBe(500);
      } catch (error) {
        console.log(`[BUG EXPLORATION] Request failed:`, error);
        throw error;
      }
    });
  });

  /**
   * Bug Condition: Verify the root cause
   * 
   * The root cause is that Vite's proxy configuration is missing.
   * This test verifies that requests to /ollama/* are not being proxied
   * to the local Ollama service.
   */
  describe('Root Cause: Missing Vite proxy configuration', () => {
    it('confirms that /ollama requests are not proxied to local Ollama service', async () => {
      const baseUrl = 'http://localhost:3000';
      const endpoint = '/ollama/api/tags';
      
      try {
        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: 'GET',
        });

        // Without proxy configuration, Vite tries to serve /ollama/* as static files
        // This results in 404 or 500 errors
        console.log(`[ROOT CAUSE ANALYSIS]`);
        console.log(`  Request: GET ${endpoint}`);
        console.log(`  Response Status: ${response.status}`);
        console.log(`  Expected: 200 (with proxy) or connection error (without Ollama)`);
        console.log(`  Actual: ${response.status} (indicates proxy not configured)`);

        // The bug: we get 500 instead of proper proxy behavior
        if (response.status === 500) {
          console.log(`[ROOT CAUSE CONFIRMED] Vite proxy not configured for /ollama path`);
        }

        expect(response.status).not.toBe(500);
      } catch (error) {
        console.log(`[ROOT CAUSE] Connection error (expected without Ollama running):`, error);
        throw error;
      }
    });
  });
});

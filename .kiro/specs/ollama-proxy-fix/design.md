# Design Document: Ollama API Proxy Fix

## Overview

This design document outlines the solution for fixing the Ollama API proxy configuration in the Forge application. The issue is that the Vite development server is not configured to proxy requests to the local Ollama service, causing HTTP 500 errors.

## Root Cause

The `vite.config.ts` file does not include a proxy configuration for the `/ollama` path. When Vite receives a request to `/ollama/api/tags` or `/ollama/api/chat`, it attempts to serve these as static files, which don't exist, resulting in a 500 error.

## Solution Architecture

### 1. Vite Proxy Configuration

Add a proxy configuration to `vite.config.ts` that:
- Intercepts requests to `/ollama/*`
- Forwards them to the local Ollama service (default: `http://127.0.0.1:11434`)
- Preserves the request path and query parameters
- Handles connection errors gracefully

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/ollama': {
        target: 'http://127.0.0.1:11434',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ollama/, ''),
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.error('Ollama proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.debug(`Proxying ${req.method} ${req.url} to Ollama`);
          });
        }
      }
    }
  }
});
```

### 2. Environment Variable Support

The proxy target URL should be configurable via environment variables:
- Development: Default to `http://127.0.0.1:11434`
- Production: Use `VITE_OLLAMA_URL` from environment
- Allow override via `.env.local`

### 3. Frontend Error Handling

The `ollamaService.ts` already has error handling for connection failures:
- Detects when Ollama is not running
- Returns user-friendly error message
- Suggests running `ollama serve`
- Falls back to Gemini API if available

### 4. Health Check Endpoint

The `checkOllamaHealth()` function in `ollamaService.ts` will:
- Call `/ollama/api/tags` to verify Ollama is running
- Return true if successful (HTTP 200)
- Return false if connection fails
- Be called on app initialization to determine AI provider availability

## Implementation Steps

1. **Update vite.config.ts** - Add proxy configuration for `/ollama` path
2. **Verify ollamaService.ts** - Ensure error handling is correct (already implemented)
3. **Test proxy** - Verify requests are forwarded correctly
4. **Test error handling** - Verify graceful fallback when Ollama is unavailable
5. **Update documentation** - Document how to run Ollama locally

## Data Flow

```
Frontend Request
    ↓
Vite Dev Server (localhost:3000)
    ↓
Proxy Rule: /ollama/* → http://127.0.0.1:11434/*
    ↓
Local Ollama Service (localhost:11434)
    ↓
Response (JSON)
    ↓
Frontend receives response
```

## Testing Strategy

### Unit Tests
- Verify proxy configuration is loaded correctly
- Test error handling when Ollama is unavailable

### Integration Tests
- Start Ollama service
- Make requests through proxy
- Verify responses are correct
- Stop Ollama service
- Verify graceful error handling

### Manual Testing
- Start Ollama: `ollama serve`
- Run dev server: `npm run dev`
- Open browser console
- Verify no 500 errors
- Verify AI chat works with local model

## Correctness Properties

**Property 1: Proxy Forwards Requests Correctly**
*For any* request to `/ollama/api/tags`, the proxy SHALL forward it to `http://127.0.0.1:11434/api/tags` and return the response.

**Property 2: Proxy Preserves Request Method**
*For any* HTTP method (GET, POST, etc.), the proxy SHALL preserve the method when forwarding to Ollama.

**Property 3: Proxy Preserves Request Body**
*For any* POST request with a JSON body, the proxy SHALL forward the body unchanged to Ollama.

**Property 4: Error Handling is Graceful**
*For any* connection error to Ollama, the frontend SHALL display a user-friendly error message instead of a 500 error.

**Property 5: Health Check Works**
*For any* running Ollama service, `checkOllamaHealth()` SHALL return true.

**Property 6: Health Check Fails Gracefully**
*For any* stopped Ollama service, `checkOllamaHealth()` SHALL return false without throwing an error.


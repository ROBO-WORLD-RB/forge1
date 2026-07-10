# Requirements Document: Ollama API Proxy Fix

## Introduction

This document specifies the requirements for fixing the Ollama API proxy configuration issue in the Forge application. The frontend application attempts to communicate with a locally running Ollama service through a Vite development proxy, but the proxy is not properly configured, resulting in HTTP 500 errors when attempting to access `/ollama/api/tags` and `/ollama/api/chat` endpoints.

## Glossary

- **Ollama**: A local LLM (Large Language Model) service running on the user's machine
- **Vite**: The build tool and development server used by the Forge application
- **Proxy**: A development server feature that forwards requests to a backend service
- **CORS**: Cross-Origin Resource Sharing - browser security mechanism
- **API Endpoint**: A URL path that serves a specific API function

## Bug Condition

**Observed Behavior:**
- Frontend makes requests to `http://localhost:3000/ollama/api/tags` and `http://localhost:3000/ollama/api/chat`
- Both requests return HTTP 500 Internal Server Error
- Console shows: `XHRGEThttp://localhost:3000/ollama/api/tags[HTTP/1.1 500 Internal Server Error 0ms]`

**Expected Behavior:**
- Requests to `/ollama/api/tags` should proxy to the local Ollama service (default: `http://127.0.0.1:11434/api/tags`)
- Requests to `/ollama/api/chat` should proxy to the local Ollama service (default: `http://127.0.0.1:11434/api/chat`)
- Responses should return HTTP 200 with valid JSON data

**Root Cause Analysis:**
The Vite development server is not configured with a proxy rule to forward `/ollama/*` requests to the local Ollama service. Without this configuration, Vite attempts to serve these paths as static files, which don't exist, resulting in 500 errors.

## Requirements

### Requirement 1: Vite Proxy Configuration

**User Story:** As a developer, I want the Vite development server to proxy Ollama API requests to the local Ollama service, so that the frontend can communicate with the local LLM.

#### Acceptance Criteria

1. WHEN the Vite development server starts THEN the proxy configuration SHALL be loaded from vite.config.ts
2. WHEN a request is made to `/ollama/*` THEN the Vite proxy SHALL forward the request to the configured Ollama base URL (default: `http://127.0.0.1:11434`)
3. WHEN the Ollama service is running THEN requests to `/ollama/api/tags` SHALL return HTTP 200 with a valid JSON response
4. WHEN the Ollama service is running THEN requests to `/ollama/api/chat` SHALL return HTTP 200 with a valid JSON response
5. WHEN the Ollama service is not running THEN requests SHALL fail gracefully with a connection error (not 500)
6. WHEN the proxy is configured THEN the frontend code in ollamaService.ts SHALL successfully communicate with the Ollama API

### Requirement 2: Environment Configuration

**User Story:** As a developer, I want to configure the Ollama service URL through environment variables, so that I can easily switch between local and remote Ollama instances.

#### Acceptance Criteria

1. WHEN the application starts in development mode THEN the Ollama base URL SHALL default to `http://127.0.0.1:11434`
2. WHEN the VITE_OLLAMA_URL environment variable is set THEN the proxy SHALL use that URL instead of the default
3. WHEN the application starts in production mode THEN the frontend SHALL use the VITE_OLLAMA_URL from environment variables
4. WHEN the .env.local file is configured THEN the environment variables SHALL be loaded correctly

### Requirement 3: Error Handling and Diagnostics

**User Story:** As a developer, I want clear error messages when the Ollama service is unavailable, so that I can quickly diagnose connectivity issues.

#### Acceptance Criteria

1. WHEN the Ollama service is not running THEN the frontend SHALL display a user-friendly error message
2. WHEN the proxy fails to connect THEN the error message SHALL suggest running `ollama serve`
3. WHEN the Ollama health check fails THEN the checkOllamaHealth function SHALL return false
4. WHEN the Ollama service is unavailable THEN the AI chat interface SHALL gracefully fall back to Gemini API


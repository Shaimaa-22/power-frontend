import { resolveApiBase } from './base.js';
import { createApi } from './http-client.js';

// Public read endpoints only. Vite checks the production origin at build time too.
const base = import.meta.env.DEV
  ? resolveApiBase(import.meta.env.VITE_API_URL, true)
  : new URL(import.meta.env.VITE_API_URL).origin; // Build config has already validated this value.
export const api = createApi(base);

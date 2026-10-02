import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolveApiBase, resolveBuildApiBase } from './src/api/base.js';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const value = process.env.VITE_API_URL ?? env.VITE_API_URL;
  if (command === 'serve') resolveApiBase(value, true);
  else resolveBuildApiBase(value, mode);
  return { plugins: [react()], server: { port: 5173 } };
});

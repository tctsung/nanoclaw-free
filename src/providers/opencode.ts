/**
 * Host-side container config for the `opencode` provider.
 *
 * OpenCode's `opencode serve` process stores state under XDG_DATA_HOME, which
 * we pin to a per-session host directory mounted at /opencode-xdg. The
 * OPENCODE_* env vars tell the CLI which provider/model to use at runtime
 * (read on the host, injected into the container). NO_PROXY / no_proxy are
 * merged with host values so the in-container OpenCode client can talk to
 * 127.0.0.1 even when HTTPS_PROXY is set by OneCLI.
 *
 * Free baseline (single provider, no vault): when OPENCODE_API_KEY is set, the
 * key is passed straight into the container and the provider host (from
 * ANTHROPIC_BASE_URL) is added to NO_PROXY, so the model call skips the OneCLI
 * proxy. OpenCode then sends the provider's own auth header (Zen -> x-api-key),
 * which the proxy's Bearer injection got wrong. Without the key, behaviour is
 * unchanged (placeholder + proxy injection -- the Anthropic-via-vault path).
 *
 * The OPENCODE_ and ANTHROPIC_BASE_URL values are resolved from `.env` (via
 * readEnvFile) with a process.env fallback -- the launchd/systemd host does NOT
 * load .env into its environment (readEnvFile keeps secrets out of process.env
 * by design), so reading process.env alone yields undefined and the container
 * boots with no provider config ("no provider found"). Same precedence rule as
 * config.ts: an explicitly-exported process.env value wins, else the .env file.
 */
import fs from 'fs';
import path from 'path';

import { readEnvFile } from '../env.js';
import { registerProviderContainerConfig } from './provider-container-registry.js';

/** Keys the opencode provider needs from .env (none are in config.ts's allowlist). */
const OPENCODE_ENV_KEYS = [
  'OPENCODE_PROVIDER',
  'OPENCODE_MODEL',
  'OPENCODE_SMALL_MODEL',
  'OPENCODE_API_KEY',
  'ANTHROPIC_BASE_URL',
] as const;

/** Hostname from a base URL, or undefined if unparseable/empty. */
function hostFromUrl(url: string | undefined): string | undefined {
  if (!url?.trim()) return undefined;
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

function mergeNoProxy(current: string | undefined, additions: string): string {
  if (!current?.trim()) return additions;
  const parts = new Set(
    current
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  );
  for (const addition of additions.split(',')) {
    const trimmed = addition.trim();
    if (trimmed) parts.add(trimmed);
  }
  return [...parts].join(',');
}

registerProviderContainerConfig('opencode', (ctx) => {
  const opencodeDir = path.join(ctx.sessionDir, 'opencode-xdg');
  fs.mkdirSync(opencodeDir, { recursive: true });

  // Resolve config from .env (file) with a process.env override -- the host
  // service doesn't load .env into its environment, so ctx.hostEnv lacks these.
  const fileEnv = readEnvFile([...OPENCODE_ENV_KEYS]);
  const resolve = (key: (typeof OPENCODE_ENV_KEYS)[number]): string | undefined => ctx.hostEnv[key] ?? fileEnv[key];

  // When a direct key is set, also bypass the proxy for the provider's own host
  // (derived from ANTHROPIC_BASE_URL), so OpenCode authenticates the provider
  // directly. Always keep localhost in NO_PROXY for the in-container client.
  const apiKey = resolve('OPENCODE_API_KEY');
  const providerHost = apiKey?.trim() ? hostFromUrl(resolve('ANTHROPIC_BASE_URL')) : undefined;
  const noProxyAdditions = ['127.0.0.1', 'localhost', providerHost].filter(Boolean).join(',');

  const env: Record<string, string> = {
    XDG_DATA_HOME: '/opencode-xdg',
    NO_PROXY: mergeNoProxy(ctx.hostEnv.NO_PROXY, noProxyAdditions),
    no_proxy: mergeNoProxy(ctx.hostEnv.no_proxy, noProxyAdditions),
  };
  for (const key of OPENCODE_ENV_KEYS) {
    const value = resolve(key);
    if (value) env[key] = value;
  }

  return {
    mounts: [{ hostPath: opencodeDir, containerPath: '/opencode-xdg', readonly: false }],
    env,
  };
});

const RUNTIME_ENV =
  (import.meta as unknown as { env?: Record<string, string> }).env || {};

const ENV_APP_VERSION = (RUNTIME_ENV.VITE_APP_VERSION || '').trim();
const ENV_APP_VERSION_CODE = Number(RUNTIME_ENV.VITE_APP_VERSION_CODE || 0);

export const APP_VERSION = ENV_APP_VERSION || '1.5.9';
export const APP_VERSION_CODE =
  Number.isFinite(ENV_APP_VERSION_CODE) && ENV_APP_VERSION_CODE > 0
    ? Math.floor(ENV_APP_VERSION_CODE)
    : 4;
export const APP_BUILD_LABEL = `v${APP_VERSION} (Build ${APP_VERSION_CODE})`;

export const GITHUB_REPO_STORAGE_KEY = 'wargaqu_github_repo_slug_v1';

const ENV_GITHUB_REPO = (RUNTIME_ENV.VITE_GITHUB_REPO || '').trim();

export function normalizeGitHubRepoSlug(raw: string): string {
  const cleaned = (raw || '')
    .trim()
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/^\/+|\/+$/g, '');
  if (!cleaned || !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(cleaned)) {
    return '';
  }
  return cleaned;
}

export function inferGitHubRepoSlug(): string {
  if (typeof window === 'undefined') {
    return normalizeGitHubRepoSlug(ENV_GITHUB_REPO);
  }
  try {
    const params = new URLSearchParams(window.location.search);
    const paramRepo = normalizeGitHubRepoSlug(params.get('repo') || '');
    if (paramRepo) {
      localStorage.setItem(GITHUB_REPO_STORAGE_KEY, paramRepo);
      return paramRepo;
    }

    const host = window.location.hostname.toLowerCase();
    if (host.endsWith('.github.io')) {
      const owner = host.replace('.github.io', '').trim();
      const firstSegment = window.location.pathname.split('/').filter(Boolean)[0] || '';
      const guessed =
        owner && firstSegment && firstSegment !== 'store.html'
          ? `${owner}/${firstSegment}`
          : owner
          ? `${owner}/${owner}.github.io`
          : '';
      const norm = normalizeGitHubRepoSlug(guessed);
      if (norm) {
        localStorage.setItem(GITHUB_REPO_STORAGE_KEY, norm);
        return norm;
      }
    }

    const saved = normalizeGitHubRepoSlug(localStorage.getItem(GITHUB_REPO_STORAGE_KEY) || '');
    if (saved) return saved;
  } catch {
    // ignore storage/URL errors
  }
  return normalizeGitHubRepoSlug(ENV_GITHUB_REPO);
}

export function saveGitHubRepoSlug(raw: string): string {
  const norm = normalizeGitHubRepoSlug(raw);
  if (typeof localStorage !== 'undefined') {
    try {
      if (norm) {
        localStorage.setItem(GITHUB_REPO_STORAGE_KEY, norm);
      } else {
        localStorage.removeItem(GITHUB_REPO_STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  }
  return norm;
}

/**
 * Returns > 0 if `a` is newer than `b`, < 0 if older, 0 if equal.
 */
export function compareSemver(a: string, b: string): number {
  const cleanA = (a || '0.0.0').replace(/^v/i, '').split(/[-+]/)[0];
  const cleanB = (b || '0.0.0').replace(/^v/i, '').split(/[-+]/)[0];
  const pa = cleanA.split('.').map(n => parseInt(n, 10) || 0);
  const pb = cleanB.split('.').map(n => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length, 3);
  for (let i = 0; i < len; i += 1) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va !== vb) return va - vb;
  }
  return 0;
}

const KEY = 'signspell-token';
export const tokenStore = {
  // Reads the saved login token.
  get(): string | null { try { return localStorage.getItem(KEY); } catch { return null; } },
  // Saves the login token.
  set(t: string): void { try { localStorage.setItem(KEY, t); } catch { /* private mode */ } },
  // Removes the saved login token.
  clear(): void { try { localStorage.removeItem(KEY); } catch { /* ignore */ } },
};

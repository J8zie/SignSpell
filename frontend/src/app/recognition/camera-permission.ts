/** Helpers so the camera can start by itself once the learner has allowed it once. */
const FLAG = 'signspell-camera-ok';

/** True when the camera can be started without asking the learner anything. */
export async function cameraAllowed(): Promise<boolean> {
  try {
    const state = (await navigator.permissions.query({ name: 'camera' as PermissionName })).state;
    // granted: start by itself. denied: do not try (the page explains how to unblock it). prompt: wait for a click.
    return state === 'granted';
  } catch {
    // Some browsers cannot be asked. Then we trust what happened the last time the camera started here.
    try { return localStorage.getItem(FLAG) === '1'; } catch { return false; }
  }
}

/** Call after the camera started: it works, so next time we may start it by ourselves. */
export function rememberCamera(): void { try { localStorage.setItem(FLAG, '1'); } catch { /* private mode: nothing to remember */ } }

/** Call when the browser said no: stop starting the camera by ourselves. */
export function forgetCamera(): void { try { localStorage.removeItem(FLAG); } catch { /* ignore */ } }

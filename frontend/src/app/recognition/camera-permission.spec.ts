import { cameraAllowed, forgetCamera, rememberCamera } from './camera-permission';

function permissions(impl: () => Promise<{ state: string }>) {
  Object.defineProperty(navigator, 'permissions', { value: { query: impl }, configurable: true });
}

describe('cameraAllowed', () => {
  beforeEach(() => localStorage.clear());

  it('starts by itself only when the browser says granted', async () => {
    permissions(async () => ({ state: 'granted' }));
    expect(await cameraAllowed()).toBe(true);
  });

  it('does not start by itself when the learner has not been asked yet (prompt) or said no (denied)', async () => {
    rememberCamera(); // even an old "it worked" note must not override the browser
    permissions(async () => ({ state: 'prompt' }));
    expect(await cameraAllowed()).toBe(false);
    permissions(async () => ({ state: 'denied' }));
    expect(await cameraAllowed()).toBe(false);
  });

  it('on browsers that cannot be asked, trusts the note from the last successful start', async () => {
    permissions(async () => { throw new TypeError('camera is not a valid permission name'); });
    expect(await cameraAllowed()).toBe(false);
    rememberCamera();
    expect(await cameraAllowed()).toBe(true);
    forgetCamera();
    expect(await cameraAllowed()).toBe(false);
  });
});

export const environment = {
  production: true,
  // Laravel API on Render (see render.yaml). If you rename the service, update this URL and redeploy.
  apiUrl: 'https://signspell-api.onrender.com/api',
  /** Optional: URL of trained landmark samples (docs/RECOGNITION.md). Leave empty to use the built-in rules. */
  classifierSamplesUrl: '',
};

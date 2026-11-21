import { AbstractControl, FormGroup } from '@angular/forms';

/** One friendly message for the first problem on a control (only after it was touched). */
export function errorOf(c: AbstractControl | null, msgs: { pattern?: string } = {}): string {
  if (!c || !(c.touched || c.dirty) || !c.errors) return '';
  const e = c.errors;
  if (e['server']) return e['server'];
  if (e['required']) return 'This is required.';
  if (e['email']) return 'Enter a valid email address.';
  if (e['minlength']) return `Use at least ${e['minlength'].requiredLength} characters.`;
  if (e['maxlength']) return `Use at most ${e['maxlength'].requiredLength} characters.`;
  if (e['pattern']) return msgs.pattern ?? 'That format is not allowed.';
  if (e['mismatch']) return 'The passwords do not match.';
  return 'Check this field.';
}

/** Puts Laravel-style 422 errors ({ field: [message] }) onto the matching controls. */
export function applyServerErrors(form: FormGroup, fields: Record<string, string[]>): void {
  for (const [k, list] of Object.entries(fields)) {
    const c = form.get(k);
    if (c) { c.setErrors({ server: list[0] }); c.markAsTouched(); }
  }
}

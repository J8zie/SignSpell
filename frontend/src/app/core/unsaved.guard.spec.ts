import { TestBed } from '@angular/core/testing';
import { ConfirmService } from './confirm.service';
import { HasUnsavedChanges, unsavedGuard } from './unsaved.guard';

const run = (screen: HasUnsavedChanges) => TestBed.runInInjectionContext(() => unsavedGuard(screen, null as never, null as never, null as never));

describe('unsavedGuard', () => {
  it('lets the person leave a clean screen without asking', async () => {
    const confirm = TestBed.inject(ConfirmService);
    const spy = vi.spyOn(confirm, 'ask');
    expect(await run({ hasUnsavedChanges: () => false })).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });

  it('asks first when there is unsaved work, and obeys the answer', async () => {
    const confirm = TestBed.inject(ConfirmService);
    const spy = vi.spyOn(confirm, 'ask').mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    expect(await run({ hasUnsavedChanges: () => true })).toBe(false);
    expect(await run({ hasUnsavedChanges: () => true })).toBe(true);
    expect(spy.mock.calls[0][0]).toMatchObject({ title: 'Leave without saving?', danger: true });
  });
});

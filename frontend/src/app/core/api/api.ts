import {
  Account, AccountInput, Attempt, AttemptInput, AttemptQuery, AttemptResult, AuditLog, AuditQuery, AuthResponse, LearnerProgressRow,
  Mastery, MediaAnalysis, ProfileInput, ProgressQuery, RegisterInput, SetupInput, Sign, SignInput, SignQuery, SignSampleInfo, SignSampleInput,
  AccountImpact, AdminSummary, LearnerSummary, Page, PasswordInput, SignImpact, TeacherSummary,
} from '../models';

/** Raised for any failed API call. `fields` carries Laravel-style validation errors (422). */
export class ApiError extends Error {
  constructor(message: string, readonly status = 0, readonly fields: Record<string, string[]> = {}) {
    super(message);
  }
}

/** The one contract the UI talks to; HttpApi implements it against the Laravel API. */
export abstract class Api {
  // First-run setup check; the real API always has accounts, so this is false.
  async needsSetup(): Promise<boolean> { return false; }
  // Creates the first super admin; not supported by the real API.
  async setupAdmin(_input: SetupInput): Promise<AuthResponse> { throw new ApiError('Setup is not available.', 404); }

  // Logs in with a username and password.
  abstract login(username: string, password: string): Promise<AuthResponse>;
  // Creates a learner or teacher account.
  abstract register(input: RegisterInput): Promise<AuthResponse>;
  // Ends the current session.
  abstract logout(): Promise<void>;
  // Returns the signed-in account.
  abstract me(): Promise<Account>;
  // Saves changes to the signed-in user's profile.
  abstract updateProfile(input: ProfileInput): Promise<Account>;
  /** Changes the signed-in person's own password. */
  abstract changePassword(input: PasswordInput): Promise<void>;

  // Lists signs with optional filters.
  abstract listSigns(query?: SignQuery): Promise<Sign[]>;
  // Returns one sign's details.
  abstract getSign(id: string): Promise<Sign>;
  // Adds a new sign.
  abstract createSign(input: SignInput): Promise<Sign>;
  // Updates an existing sign.
  abstract updateSign(id: string, input: SignInput): Promise<Sign>;
  /** What deleting this sign would remove; ask before showing the confirm dialog. */
  abstract signImpact(id: string): Promise<SignImpact>;
  /** Deletes a sign; the real API requires prior confirmation. */
  abstract deleteSign(id: string): Promise<void>;

  // Saves one practice attempt and returns the updated mastery.
  abstract recordAttempt(input: AttemptInput): Promise<AttemptResult>;
  // Lists the learner's past attempts.
  abstract myAttempts(query?: AttemptQuery): Promise<Attempt[]>;
  // Lists the learner's mastery level per sign.
  abstract myMastery(): Promise<Mastery[]>;
  /** Totals, streak and suggested next signs in one call. */
  abstract mySummary(): Promise<LearnerSummary>;

  // Lists learner-by-sign progress rows for the teacher.
  abstract learnerProgress(query?: ProgressQuery): Promise<LearnerProgressRow[]>;
  // Returns stats about the teacher's donated signs.
  abstract teacherSummary(): Promise<TeacherSummary>;
  /** Downloads the progress table as a CSV file. */
  abstract exportProgress(query?: ProgressQuery): Promise<Blob>;

  // Lists accounts for the admin, with optional search and role filter.
  abstract listAccounts(query?: { q?: string; role?: string }): Promise<Account[]>;
  // Creates a new account.
  abstract createAccount(input: AccountInput): Promise<Account>;
  // Updates an existing account.
  abstract updateAccount(userId: string, input: AccountInput): Promise<Account>;
  // Returns what deleting this account would affect.
  abstract accountImpact(userId: string): Promise<AccountImpact>;
  // Deletes an account after confirmation.
  abstract deleteAccount(userId: string): Promise<void>;
  // Returns dashboard totals for the admin.
  abstract adminSummary(): Promise<AdminSummary>;

  // Lists audit log entries (Super Admin only, read-only).
  abstract listAuditLogs(query?: AuditQuery): Promise<Page<AuditLog>>;
  // Lists the days (YYYY-MM-DD) that have audit entries, newest first.
  abstract listAuditDates(): Promise<string[]>;
  // Returns one audit log entry.
  abstract getAuditLog(id: string): Promise<AuditLog>;

  // Asks Gemini what sign sequence the sign's media shows.
  abstract analyzeSignMedia(signId: string): Promise<MediaAnalysis>;
  // Lists a sign's landmark samples (metadata only).
  abstract listSignSamples(signId: string): Promise<SignSampleInfo[]>;
  // Saves a landmark sequence extracted on the device.
  abstract addSignSample(signId: string, input: SignSampleInput): Promise<{ sampleId: string; frameCount: number }>;
}

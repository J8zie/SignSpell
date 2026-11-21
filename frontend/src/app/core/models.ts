/** Types mirror the ERD (User, Userinfo, Signs, Attempts, mastery) in camelCase JSON. */
export type Role = 'learner' | 'teacher' | 'admin' | 'super_admin';
export type SignType = 'letter' | 'word' | 'sentence';
export type MasteryLevel = 'new' | 'learning' | 'familiar' | 'mastered';

export type AccountStatus = 'active' | 'disabled';
export interface User { userId: string; username: string; role: Role; status?: AccountStatus; }
export interface UserInfo {
  userinfoId: string; userId: string; firstName: string; lastName: string;
  email: string; profilePhotoUrl: string | null; createdAt: string;
}
/** What the API returns for a signed-in person: User + Userinfo together. */
export interface Account extends User { info: UserInfo; }

export interface Sign {
  signId: string; signType: SignType; imageUrl: string | null; label: string;
  createdAt: string; userOwnershipId: string | null; ownerName?: string | null;
}
export interface Attempt {
  attemptsId: string; learnersId: string; signId: string; predictedLabel: string;
  confidence: number; isCorrect: boolean; createdAt: string;
}
export interface Mastery {
  masteryId: string; learnersId: string; signId: string; attemptsCount: number;
  correctAvg: number; masteryLevel: MasteryLevel; updatedAt: string;
}

export interface AuthResponse { token: string; account: Account; }
export interface RegisterInput {
  username: string; password: string; role: 'learner' | 'teacher';
  firstName: string; lastName: string; email: string;
}
/** The very first account (a Super Admin), created on first run when no accounts exist. */
export interface SetupInput { username: string; password: string; firstName: string; lastName: string; email: string; }
export interface ProfileInput { firstName: string; lastName: string; email: string; photo?: File | null; }
export interface AccountInput {
  username: string; password?: string; role: Role; firstName: string; lastName: string; email: string; status?: AccountStatus;
}
export interface SignInput { label: string; signType: SignType; image?: File | null; ownerId?: string | null; }
export interface SignQuery { type?: SignType; q?: string; mine?: boolean; }
export interface AttemptInput { signId: string; predictedLabel: string; confidence: number; isCorrect: boolean; }
export interface AttemptResult { attempt: Attempt; mastery: Mastery; }
export interface AttemptQuery { signId?: string; type?: SignType; from?: string; to?: string; limit?: number; }
export interface ProgressQuery { from?: string; to?: string; signId?: string; }
/** One row of the teacher's "students progress" table (only signs the teacher donated). */
export interface LearnerProgressRow {
  learnerId: string; learnerName: string; signId: string; signLabel: string; signType: SignType;
  attemptsCount: number; correctAvg: number; masteryLevel: MasteryLevel; lastAttemptAt: string | null;
}

/** What a learner's home screen shows, computed by the API in one call. Fractions (accuracy) run from 0 to 1. */
export interface LearnerSummary {
  totalAttempts: number; accuracy: number; mastered: number; familiar: number; learning: number; newCount: number;
  streakDays: number; byType: Record<SignType, number>; practiceNext: Sign[];
}
export interface TeacherSummary { learners: number; attempts: number; accuracy: number; signsDonated: number; lastActivityAt: string | null; }
export interface AdminSummary { learners: number; teachers: number; admins: number; signs: number; donatedSigns: number; attemptsToday: number; }
/** What deleting would remove, shown in the confirm dialog before the person agrees. */
export interface SignImpact { attempts: number; learners: number; media: number; }
export interface AccountImpact { attempts: number; signsDonated: number; }
export interface PasswordInput { currentPassword: string; newPassword: string; }

/** One row of the append-only audit trail; only the Super Admin can read these. */
export interface AuditLog {
  auditId: string; userId: string | null; username: string | null; userRole: Role | null;
  action: string; resourceType: string | null; resourceId: string | null;
  description: string | null; oldValues: Record<string, unknown> | null; newValues: Record<string, unknown> | null;
  ipAddress: string | null; userAgent: string | null; createdAt: string;
}
export interface AuditQuery { q?: string; user?: string; role?: Role; action?: string; resource?: string; from?: string; to?: string; page?: number; }
/** One page of a paginated list, flattened from the API's paginator meta. */
export interface Page<T> { items: T[]; page: number; pages: number; total: number; }

/** Landmark points extracted on the device: each frame is 21 (one hand) or 42 (two hands) {x,y,z} points. */
export interface LandmarkPoint { x: number; y: number; z: number; }
export interface SignSampleInput {
  source: string; sourceSequenceId?: string; signerRef?: string; landmarks: LandmarkPoint[][]; frameCount?: number;
}
export interface SignSampleInfo { sampleId: string; source: string; signerRef: string | null; sourceSequenceId: string | null; frameCount: number; createdAt: string | null; }
/** What Gemini thinks the sign's media shows, in order. */
export interface MediaAnalysis { mediaType: 'image' | 'video'; labels: string[]; description: string; }

// Builds "First Last" from an account's info.
export const fullName = (a: { info: UserInfo } | null | undefined): string =>
  a ? `${a.info.firstName} ${a.info.lastName}`.trim() : '';

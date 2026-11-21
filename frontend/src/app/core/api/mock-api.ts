import { Injectable } from '@angular/core';
import { Api, ApiError } from './api';
import { levelFor, nextMastery } from '../mastery';
import { tokenStore } from '../token';
import { fileToDataUrl } from '../util/image';
import { labelProblem, normalizeLabel } from '../util/sign-label';
import {
  Account, AccountInput, Attempt, AttemptInput, AttemptQuery, AttemptResult, AuthResponse, LearnerProgressRow,
  Mastery, ProfileInput, ProgressQuery, RegisterInput, Role, Sign, SignInput, SignQuery, SignType, User, UserInfo,
} from '../models';

type StoredUser = User & { password: string };
interface Db { users: StoredUser[]; infos: UserInfo[]; signs: Sign[]; attempts: Attempt[]; mastery: Mastery[]; }
const KEY = 'signspell-mock-db-v1';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const uid = () => (globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(16).slice(2)}`);
const iso = (d = new Date()) => d.toISOString();

/** Browser-only stand-in for the Laravel API. It enforces the same rules the real API must. */
@Injectable({ providedIn: 'root' })
export class MockApi extends Api {
  // ---------- storage ----------
  private db(): Db {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw) as Db;
    } catch { /* fall through and reseed */ }
    const fresh = seed();
    this.save(fresh);
    return fresh;
  }
  private save(db: Db): void { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* quota */ } }
  private currentId(): string {
    const t = tokenStore.get();
    if (!t?.startsWith('mock.')) throw new ApiError('Please log in.', 401);
    return t.slice(5);
  }
  private current(db: Db): StoredUser {
    const u = db.users.find((x) => x.userId === this.currentId());
    if (!u) throw new ApiError('Please log in.', 401);
    return u;
  }
  private requireRole(db: Db, ...roles: Role[]): StoredUser {
    const u = this.current(db);
    if (!roles.includes(u.role)) throw new ApiError('You are not allowed to do that.', 403);
    return u;
  }
  private account(db: Db, userId: string): Account {
    const u = db.users.find((x) => x.userId === userId)!;
    const info = db.infos.find((x) => x.userId === userId)!;
    return { userId: u.userId, username: u.username, role: u.role, info };
  }
  private signOut(db: Db, s: Sign): Sign {
    const owner = s.userOwnershipId ? db.infos.find((i) => i.userId === s.userOwnershipId) : null;
    return { ...s, ownerName: owner ? `${owner.firstName} ${owner.lastName}` : null };
  }

  // ---------- auth ----------
  async login(username: string, password: string): Promise<AuthResponse> {
    await sleep(150);
    const db = this.db();
    const u = db.users.find((x) => x.username.toLowerCase() === username.trim().toLowerCase());
    if (!u || u.password !== password) throw new ApiError('Wrong username or password.', 401);
    return { token: `mock.${u.userId}`, account: this.account(db, u.userId) };
  }
  async register(input: RegisterInput): Promise<AuthResponse> {
    await sleep(200);
    const db = this.db();
    const errors: Record<string, string[]> = {};
    if (db.users.some((u) => u.username.toLowerCase() === input.username.trim().toLowerCase())) errors['username'] = ['That username is taken.'];
    if (db.infos.some((i) => i.email.toLowerCase() === input.email.trim().toLowerCase())) errors['email'] = ['That email is already registered.'];
    if (Object.keys(errors).length) throw new ApiError('Please fix the highlighted fields.', 422, errors);
    if (input.role !== 'learner' && input.role !== 'teacher') throw new ApiError('Choose learner or teacher.', 422, { role: ['Invalid role.'] });
    const userId = uid();
    db.users.push({ userId, username: input.username.trim(), password: input.password, role: input.role });
    db.infos.push({ userinfoId: uid(), userId, firstName: input.firstName.trim(), lastName: input.lastName.trim(), email: input.email.trim(), profilePhotoUrl: null, createdAt: iso() });
    this.save(db);
    return { token: `mock.${userId}`, account: this.account(db, userId) };
  }
  async logout(): Promise<void> { await sleep(30); }
  async me(): Promise<Account> {
    await sleep(60);
    const db = this.db();
    return this.account(db, this.current(db).userId);
  }
  async updateProfile(input: ProfileInput): Promise<Account> {
    await sleep(150);
    const db = this.db();
    const me = this.current(db);
    const info = db.infos.find((i) => i.userId === me.userId)!;
    if (db.infos.some((i) => i.userId !== me.userId && i.email.toLowerCase() === input.email.trim().toLowerCase())) {
      throw new ApiError('That email is already registered.', 422, { email: ['That email is already registered.'] });
    }
    Object.assign(info, { firstName: input.firstName.trim(), lastName: input.lastName.trim(), email: input.email.trim() });
    if (input.photo) info.profilePhotoUrl = await fileToDataUrl(input.photo, 256);
    this.save(db);
    return this.account(db, me.userId);
  }

  // ---------- signs ----------
  async listSigns(q: SignQuery = {}): Promise<Sign[]> {
    await sleep(100);
    const db = this.db();
    const me = this.current(db);
    const needle = q.q?.trim().toLowerCase();
    return db.signs
      .filter((s) => (!q.type || s.signType === q.type) && (!needle || s.label.toLowerCase().includes(needle)) && (!q.mine || s.userOwnershipId === me.userId))
      .map((s) => this.signOut(db, s))
      .sort((a, b) => a.signType.localeCompare(b.signType) || a.label.localeCompare(b.label));
  }
  async getSign(id: string): Promise<Sign> {
    await sleep(60);
    const db = this.db();
    this.current(db);
    const s = db.signs.find((x) => x.signId === id);
    if (!s) throw new ApiError('Sign not found.', 404);
    return this.signOut(db, s);
  }
  private checkSign(db: Db, input: SignInput, ignoreId?: string): string {
    const label = normalizeLabel(input.label);
    const errors: Record<string, string[]> = {};
    const problem = labelProblem(input.signType, input.label);
    if (problem) errors['label'] = [problem];
    else if (db.signs.some((s) => s.signId !== ignoreId && s.signType === input.signType && s.label === label)) errors['label'] = ['That sign already exists.'];
    if (Object.keys(errors).length) throw new ApiError('Please fix the highlighted fields.', 422, errors);
    return label;
  }
  async createSign(input: SignInput): Promise<Sign> {
    await sleep(200);
    const db = this.db();
    const me = this.requireRole(db, 'teacher', 'admin');
    const label = this.checkSign(db, input);
    const sign: Sign = {
      signId: uid(), signType: input.signType, label, createdAt: iso(),
      imageUrl: input.image ? await fileToDataUrl(input.image) : null,
      userOwnershipId: me.role === 'teacher' ? me.userId : (input.ownerId ?? null),
    };
    db.signs.push(sign);
    this.save(db);
    return this.signOut(db, sign);
  }
  async updateSign(id: string, input: SignInput): Promise<Sign> {
    await sleep(200);
    const db = this.db();
    this.requireRole(db, 'admin');
    const s = db.signs.find((x) => x.signId === id);
    if (!s) throw new ApiError('Sign not found.', 404);
    s.label = this.checkSign(db, input, id);
    s.signType = input.signType;
    s.userOwnershipId = input.ownerId ?? null;
    if (input.image) s.imageUrl = await fileToDataUrl(input.image);
    this.save(db);
    return this.signOut(db, s);
  }
  async deleteSign(id: string): Promise<void> {
    await sleep(120);
    const db = this.db();
    this.requireRole(db, 'admin');
    if (!db.signs.some((s) => s.signId === id)) throw new ApiError('Sign not found.', 404);
    db.signs = db.signs.filter((s) => s.signId !== id);
    db.attempts = db.attempts.filter((a) => a.signId !== id);
    db.mastery = db.mastery.filter((m) => m.signId !== id);
    this.save(db);
  }

  // ---------- attempts & mastery ----------
  async recordAttempt(input: AttemptInput): Promise<AttemptResult> {
    await sleep(60);
    const db = this.db();
    const me = this.requireRole(db, 'learner');
    if (!db.signs.some((s) => s.signId === input.signId)) throw new ApiError('Sign not found.', 404);
    if (!(input.confidence >= 0 && input.confidence <= 1)) throw new ApiError('Invalid confidence.', 422, { confidence: ['Must be between 0 and 1.'] });
    const attempt: Attempt = { attemptsId: uid(), learnersId: me.userId, signId: input.signId, predictedLabel: input.predictedLabel, confidence: input.confidence, isCorrect: input.isCorrect, createdAt: iso() };
    db.attempts.push(attempt);
    let m = db.mastery.find((x) => x.learnersId === me.userId && x.signId === input.signId);
    const next = nextMastery(m ?? null, input.isCorrect);
    if (m) Object.assign(m, next, { updatedAt: iso() });
    else { m = { masteryId: uid(), learnersId: me.userId, signId: input.signId, ...next, updatedAt: iso() }; db.mastery.push(m); }
    this.save(db);
    return { attempt, mastery: m };
  }
  async myAttempts(q: AttemptQuery = {}): Promise<Attempt[]> {
    await sleep(80);
    const db = this.db();
    const me = this.requireRole(db, 'learner');
    const types = new Map(db.signs.map((s) => [s.signId, s.signType]));
    const from = q.from ? new Date(q.from).getTime() : -Infinity;
    const to = q.to ? new Date(q.to).getTime() + 86_400_000 : Infinity;
    const rows = db.attempts
      .filter((a) => a.learnersId === me.userId && (!q.signId || a.signId === q.signId) && (!q.type || types.get(a.signId) === q.type))
      .filter((a) => { const t = new Date(a.createdAt).getTime(); return t >= from && t < to; })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return q.limit ? rows.slice(0, q.limit) : rows;
  }
  async myMastery(): Promise<Mastery[]> {
    await sleep(80);
    const db = this.db();
    const me = this.requireRole(db, 'learner');
    return db.mastery.filter((m) => m.learnersId === me.userId);
  }

  // ---------- teacher ----------
  /** Only signs this teacher donated (ownership is validated here, as the API must do). */
  async learnerProgress(q: ProgressQuery = {}): Promise<LearnerProgressRow[]> {
    await sleep(120);
    const db = this.db();
    const me = this.requireRole(db, 'teacher');
    const mine = new Map(db.signs.filter((s) => s.userOwnershipId === me.userId).map((s) => [s.signId, s]));
    const from = q.from ? new Date(q.from).getTime() : -Infinity;
    const to = q.to ? new Date(q.to).getTime() + 86_400_000 : Infinity;
    const groups = new Map<string, Attempt[]>();
    for (const a of db.attempts) {
      const t = new Date(a.createdAt).getTime();
      if (!mine.has(a.signId) || (q.signId && a.signId !== q.signId) || t < from || t >= to) continue;
      const k = `${a.learnersId}|${a.signId}`;
      groups.set(k, [...(groups.get(k) ?? []), a]);
    }
    return [...groups.entries()].map(([k, list]): LearnerProgressRow => {
      const [learnerId, signId] = k.split('|');
      const info = db.infos.find((i) => i.userId === learnerId);
      const sign = mine.get(signId)!;
      const m = list.reduce<{ attemptsCount: number; correctAvg: number }>((acc, a) => nextMastery(acc, a.isCorrect), { attemptsCount: 0, correctAvg: 0 });
      const last = list.map((a) => a.createdAt).sort().at(-1) ?? null;
      return { learnerId, learnerName: info ? `${info.firstName} ${info.lastName}` : 'Unknown', signId, signLabel: sign.label, signType: sign.signType, attemptsCount: m.attemptsCount, correctAvg: m.correctAvg, masteryLevel: levelFor(m.attemptsCount, m.correctAvg), lastAttemptAt: last };
    }).sort((a, b) => a.learnerName.localeCompare(b.learnerName) || a.signLabel.localeCompare(b.signLabel));
  }

  // ---------- admin accounts ----------
  async listAccounts(q: { q?: string; role?: string } = {}): Promise<Account[]> {
    await sleep(100);
    const db = this.db();
    this.requireRole(db, 'admin');
    const needle = q.q?.trim().toLowerCase();
    return db.users
      .map((u) => this.account(db, u.userId))
      .filter((a) => (!q.role || a.role === q.role) && (!needle || `${a.username} ${a.info.firstName} ${a.info.lastName} ${a.info.email}`.toLowerCase().includes(needle)))
      .sort((a, b) => a.info.firstName.localeCompare(b.info.firstName));
  }
  async createAccount(input: AccountInput): Promise<Account> {
    await sleep(200);
    const db = this.db();
    this.requireRole(db, 'admin');
    this.checkAccount(db, input);
    if (!input.password || input.password.length < 8) throw new ApiError('Please fix the highlighted fields.', 422, { password: ['Use at least 8 characters.'] });
    const userId = uid();
    db.users.push({ userId, username: input.username.trim(), password: input.password, role: input.role });
    db.infos.push({ userinfoId: uid(), userId, firstName: input.firstName.trim(), lastName: input.lastName.trim(), email: input.email.trim(), profilePhotoUrl: null, createdAt: iso() });
    this.save(db);
    return this.account(db, userId);
  }
  async updateAccount(userId: string, input: AccountInput): Promise<Account> {
    await sleep(200);
    const db = this.db();
    const me = this.requireRole(db, 'admin');
    const u = db.users.find((x) => x.userId === userId);
    if (!u) throw new ApiError('Account not found.', 404);
    this.checkAccount(db, input, userId);
    if (u.userId === me.userId && input.role !== 'admin') throw new ApiError('You cannot remove your own admin role.', 422, { role: ['You cannot remove your own admin role.'] });
    u.username = input.username.trim(); u.role = input.role;
    if (input.password) u.password = input.password;
    Object.assign(db.infos.find((i) => i.userId === userId)!, { firstName: input.firstName.trim(), lastName: input.lastName.trim(), email: input.email.trim() });
    this.save(db);
    return this.account(db, userId);
  }
  async deleteAccount(userId: string): Promise<void> {
    await sleep(150);
    const db = this.db();
    const me = this.requireRole(db, 'admin');
    if (userId === me.userId) throw new ApiError('You cannot delete your own account.', 422);
    if (!db.users.some((u) => u.userId === userId)) throw new ApiError('Account not found.', 404);
    db.users = db.users.filter((u) => u.userId !== userId);
    db.infos = db.infos.filter((i) => i.userId !== userId);
    db.attempts = db.attempts.filter((a) => a.learnersId !== userId);
    db.mastery = db.mastery.filter((m) => m.learnersId !== userId);
    db.signs.forEach((s) => { if (s.userOwnershipId === userId) s.userOwnershipId = null; });
    this.save(db);
  }
  private checkAccount(db: Db, input: AccountInput, ignoreId?: string): void {
    const errors: Record<string, string[]> = {};
    if (db.users.some((u) => u.userId !== ignoreId && u.username.toLowerCase() === input.username.trim().toLowerCase())) errors['username'] = ['That username is taken.'];
    if (db.infos.some((i) => i.userId !== ignoreId && i.email.toLowerCase() === input.email.trim().toLowerCase())) errors['email'] = ['That email is already registered.'];
    if (Object.keys(errors).length) throw new ApiError('Please fix the highlighted fields.', 422, errors);
  }
}

// ---------- demo data ----------
function seed(): Db {
  const now = Date.now();
  const day = 86_400_000;
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const mkUser = (username: string, password: string, role: Role, first: string, last: string, email: string): [StoredUser, UserInfo] => {
    const userId = `u-${username}`;
    return [{ userId, username, password, role }, { userinfoId: `i-${username}`, userId, firstName: first, lastName: last, email, profilePhotoUrl: null, createdAt: iso(new Date(now - 30 * day)) }];
  };
  const people = [
    mkUser('admin', 'admin123', 'admin', 'Ana', 'Admin', 'admin@signspell.test'),
    mkUser('teacher', 'teacher123', 'teacher', 'Maria', 'Santos', 'maria@signspell.test'),
    mkUser('learner', 'learner123', 'learner', 'Lea', 'Cruz', 'lea@signspell.test'),
    mkUser('juan', 'learner123', 'learner', 'Juan', 'Dela Cruz', 'juan@signspell.test'),
    mkUser('rina', 'learner123', 'learner', 'Rina', 'Lopez', 'rina@signspell.test'),
  ];
  const sign = (type: SignType, label: string, owner: string | null): Sign => ({ signId: `${type}-${label.replace(/ /g, '_')}`, signType: type, imageUrl: null, label, createdAt: iso(new Date(now - 25 * day)), userOwnershipId: owner });
  const signs: Sign[] = [
    ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((l) => sign('letter', l, null)),
    ...['CAT', 'DOG', 'SUN', 'BOOK', 'HELLO'].map((w) => sign('word', w, 'u-teacher')),
    ...['I AM HERE', 'I LOVE YOU', 'THANK YOU'].map((w) => sign('sentence', w, 'u-teacher')),
  ];
  const db: Db = { users: people.map((p) => p[0]), infos: people.map((p) => p[1]), signs, attempts: [], mastery: [] };
  const plan: [string, string[], number][] = [
    ['u-learner', 'ABCDEFGHIJ'.split('').map((l) => `letter-${l}`).concat(['word-CAT', 'word-DOG']), 0.8],
    ['u-juan', ['letter-A', 'letter-B', 'letter-C', 'word-CAT', 'word-SUN'], 0.55],
    ['u-rina', ['letter-A', 'letter-M', 'letter-S', 'word-HELLO', 'sentence-I_AM_HERE'], 0.7],
  ];
  for (const [learner, ids, skill] of plan) {
    ids.forEach((signId, k) => {
      const n = 4 + Math.floor(rnd() * 5);
      for (let i = 0; i < n; i++) {
        const sg = signs.find((x) => x.signId === signId)!;
        const ok = rnd() < skill + (k % 3 === 0 ? 0.15 : -0.1);
        const at = iso(new Date(now - Math.floor(rnd() * 12) * day - Math.floor(rnd() * 5) * 3_600_000));
        db.attempts.push({ attemptsId: `a-${learner}-${signId}-${i}`, learnersId: learner, signId, predictedLabel: ok ? sg.label : 'X', confidence: +(0.7 + rnd() * 0.28).toFixed(2), isCorrect: ok, createdAt: at });
      }
    });
  }
  for (const a of db.attempts.sort((x, y) => x.createdAt.localeCompare(y.createdAt))) {
    let m = db.mastery.find((x) => x.learnersId === a.learnersId && x.signId === a.signId);
    const next = nextMastery(m ?? null, a.isCorrect);
    if (m) Object.assign(m, next, { updatedAt: a.createdAt });
    else db.mastery.push({ masteryId: `m-${a.learnersId}-${a.signId}`, learnersId: a.learnersId, signId: a.signId, ...next, updatedAt: a.createdAt });
  }
  return db;
}

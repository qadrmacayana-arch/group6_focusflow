import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface UserProfile {
  firstName: string;
  middleName: string;
  surname: string;
  gender: string;
  birthDate: string;
  age: number;
  email: string;
  isLoggedIn: boolean;
  provider: 'password';
  avatar: string;
}

interface DemoAccount {
  firstName: string;
  middleName: string;
  surname: string;
  email: string;
  salt: string;
  passwordHash: string;
}

const ACCOUNTS_STORAGE_KEY = 'focusflow.demoAccounts.v1';
const PROFILE_STORAGE_KEY = 'focusflow.profile.v1';
const PBKDF2_ITERATIONS = 210_000;

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private accounts = this.loadAccounts();
  private readonly userSubject = new BehaviorSubject<UserProfile | null>(this.loadUser());
  readonly user$: Observable<UserProfile | null> = this.userSubject.asObservable();
  private lastAuthMessage: string | null = null;

  isAuthenticated(): boolean {
    return this.userSubject.value?.isLoggedIn ?? false;
  }

  getProfile(): UserProfile | null {
    return this.userSubject.value;
  }

  getLastAuthMessage(): string | null {
    return this.lastAuthMessage;
  }

  async signUp(
    firstName: string,
    middleName: string,
    surname: string,
    email: string,
    password: string,
  ): Promise<void> {
    const normalizedEmail = this.normalizeEmail(email);
    if (this.accounts.some((account) => account.email === normalizedEmail)) {
      throw new Error('An account with this email already exists on this device. Log in instead.');
    }

    const salt = this.toBase64(crypto.getRandomValues(new Uint8Array(16)));
    const passwordHash = await this.hashPassword(password, salt);
    const account: DemoAccount = {
      firstName: firstName.trim(),
      middleName: middleName.trim(),
      surname: surname.trim(),
      email: normalizedEmail,
      salt,
      passwordHash,
    };
    const nextAccounts = [...this.accounts, account];
    this.saveAccounts(nextAccounts);
    this.accounts = nextAccounts;
    this.setUser(this.profileFromAccount(account));
    this.lastAuthMessage = `Account created. Welcome, ${account.firstName}!`;
  }

  async signIn(email: string, password: string): Promise<void> {
    const normalizedEmail = this.normalizeEmail(email);
    const account = this.accounts.find((savedAccount) => savedAccount.email === normalizedEmail);
    if (!account) {
      throw new Error('No account for that email was found on this device. Create an account first.');
    }

    const passwordHash = await this.hashPassword(password, account.salt);
    if (!this.constantTimeEquals(passwordHash, account.passwordHash)) {
      throw new Error('That password does not match this account.');
    }

    this.setUser(this.profileFromAccount(account));
    this.lastAuthMessage = 'You’re signed in.';
  }

  signOut(): void {
    this.userSubject.next(null);
    localStorage.removeItem(PROFILE_STORAGE_KEY);
    this.lastAuthMessage = null;
  }

  updateProfile(
    patch: Pick<UserProfile, 'firstName' | 'middleName' | 'surname' | 'email' | 'avatar'>,
  ): void {
    const current = this.userSubject.value;
    if (!current) {
      return;
    }

    const normalizedEmail = this.normalizeEmail(patch.email);
    const duplicate = this.accounts.some(
      (account) => account.email === normalizedEmail && account.email !== current.email,
    );
    if (duplicate) {
      throw new Error('Another account on this device already uses that email.');
    }

    const nextAccount: DemoAccount = {
      firstName: patch.firstName.trim(),
      middleName: patch.middleName.trim(),
      surname: patch.surname.trim(),
      email: normalizedEmail,
      salt: '',
      passwordHash: '',
    };
    const accountIndex = this.accounts.findIndex((account) => account.email === current.email);
    if (accountIndex < 0) {
      throw new Error('This local demo account could not be found. Sign in again.');
    }

    const existing = this.accounts[accountIndex];
    nextAccount.salt = existing.salt;
    nextAccount.passwordHash = existing.passwordHash;
    const nextAccounts = this.accounts.map((account, index) =>
      index === accountIndex ? nextAccount : account,
    );
    this.saveAccounts(nextAccounts);
    this.accounts = nextAccounts;
    this.setUser({
      ...current,
      ...patch,
      firstName: patch.firstName.trim(),
      middleName: patch.middleName.trim(),
      surname: patch.surname.trim(),
      email: normalizedEmail,
    });
  }

  private profileFromAccount(account: DemoAccount): UserProfile {
    return {
      firstName: account.firstName,
      middleName: account.middleName,
      surname: account.surname,
      gender: 'prefer-not-to-say',
      birthDate: '',
      age: 0,
      email: account.email,
      isLoggedIn: true,
      provider: 'password',
      avatar: 'FF',
    };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private async hashPassword(password: string, salt: string): Promise<string> {
    if (!globalThis.crypto?.subtle) {
      throw new Error('Secure password hashing is unavailable in this browser. Use HTTPS or localhost.');
    }

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits'],
    );
    const bits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: this.fromBase64(salt),
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      key,
      256,
    );
    return this.toBase64(new Uint8Array(bits));
  }

  private constantTimeEquals(left: string, right: string): boolean {
    if (left.length !== right.length) {
      return false;
    }
    let difference = 0;
    for (let index = 0; index < left.length; index += 1) {
      difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
    }
    return difference === 0;
  }

  private toBase64(bytes: Uint8Array): string {
    let binary = '';
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary);
  }

  private fromBase64(value: string): Uint8Array {
    return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  }

  private setUser(user: UserProfile): void {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(user));
    this.userSubject.next(user);
  }

  private saveAccounts(accounts: DemoAccount[]): void {
    localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
  }

  private loadAccounts(): DemoAccount[] {
    const saved = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    if (!saved) {
      return [];
    }

    try {
      const parsed: unknown = JSON.parse(saved);
      if (
        !Array.isArray(parsed) ||
        !parsed.every(
          (account) =>
            account &&
            typeof account === 'object' &&
            typeof account['firstName'] === 'string' &&
            typeof account['middleName'] === 'string' &&
            typeof account['surname'] === 'string' &&
            typeof account['email'] === 'string' &&
            typeof account['salt'] === 'string' &&
            typeof account['passwordHash'] === 'string',
        )
      ) {
        throw new Error('Saved demo accounts have an invalid shape.');
      }
      return parsed as DemoAccount[];
    } catch (error) {
      console.error('Could not load FocusFlow demo accounts.', error);
      localStorage.removeItem(ACCOUNTS_STORAGE_KEY);
      return [];
    }
  }

  private loadUser(): UserProfile | null {
    const saved = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!saved) {
      return null;
    }

    try {
      const user: unknown = JSON.parse(saved);
      if (this.isUserProfile(user) && this.accounts.some((account) => account.email === user.email)) {
        return user;
      }
    } catch (error) {
      console.error('Could not load the saved FocusFlow profile.', error);
    }

    localStorage.removeItem(PROFILE_STORAGE_KEY);
    return null;
  }

  private isUserProfile(value: unknown): value is UserProfile {
    if (!value || typeof value !== 'object') {
      return false;
    }
    const user = value as Record<string, unknown>;
    return (
      typeof user['firstName'] === 'string' &&
      typeof user['middleName'] === 'string' &&
      typeof user['surname'] === 'string' &&
      typeof user['gender'] === 'string' &&
      typeof user['birthDate'] === 'string' &&
      typeof user['age'] === 'number' &&
      typeof user['email'] === 'string' &&
      user['isLoggedIn'] === true &&
      user['provider'] === 'password' &&
      typeof user['avatar'] === 'string'
    );
  }
}

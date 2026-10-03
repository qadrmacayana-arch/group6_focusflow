import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { UserProfile, UserService } from '../services/user.service';

@Component({
  selector: 'app-profile',
  template: `
    <ion-content class="account-content">
      <main class="account-page">
        <span class="account-eyebrow">Your account</span>
        <h1 class="account-title">Profile</h1>
        <p class="account-intro">Make FocusFlow feel like yours. Your test profile is saved only in this browser.</p>

        <section class="account-card">
          <h2>Personal details</h2>
          <p>Update the name and email saved with your local account.</p>
          <label class="account-field">First name<input [(ngModel)]="firstName" autocomplete="given-name" /></label>
          <label class="account-field">Last name<input [(ngModel)]="surname" autocomplete="family-name" /></label>
          <label class="account-field">Email address<input [(ngModel)]="email" type="email" autocomplete="email" /></label>
          <p class="account-status" *ngIf="savedMessage" role="status">{{ savedMessage }}</p>
          <button class="account-action" type="button" [disabled]="!canSave" (click)="save()">Save profile</button>
        </section>

        <section class="account-card">
          <h2>Local test account</h2>
          <p>
            Your account and password hash are saved only in this browser. Email ownership is not
            verified, and there is no cloud sync or password reset. Don’t use a password you use
            elsewhere. Your tasks and progress stay on this device when you sign out.
          </p>
          <button class="account-secondary" type="button" (click)="signOut()">Sign out</button>
        </section>
      </main>
    </ion-content>
  `,
  styleUrls: ['./account-shared.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent],
})
export class ProfilePage {
  firstName = '';
  middleName = '';
  surname = '';
  email = '';
  savedMessage = '';

  constructor(private users: UserService, private router: Router) {
    this.applyProfile(users.getProfile());
  }

  get canSave(): boolean {
    return Boolean(
      this.firstName.trim() &&
        this.surname.trim() &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email.trim()),
    );
  }

  save(): void {
    if (!this.canSave) {
      return;
    }
    try {
      this.users.updateProfile({
        firstName: this.firstName,
        middleName: this.middleName,
        surname: this.surname,
        email: this.email,
        avatar: this.profileMark,
      });
      this.savedMessage = 'Profile saved on this device.';
    } catch (error) {
      this.savedMessage =
        error instanceof Error ? error.message : 'Could not save your profile.';
    }
  }

  private get profileMark(): string {
    return `${this.firstName.trim().charAt(0)}${this.surname.trim().charAt(0)}`.toUpperCase();
  }

  signOut(): void {
    this.users.signOut();
    void this.router.navigateByUrl('/auth');
  }

  private applyProfile(profile: UserProfile | null): void {
    if (!profile) {
      return;
    }
    this.firstName = profile.firstName;
    this.middleName = profile.middleName;
    this.surname = profile.surname;
    this.email = profile.email;
  }
}

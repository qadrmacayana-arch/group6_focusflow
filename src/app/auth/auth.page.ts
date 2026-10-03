import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { IonButton, IonContent, IonInput } from '@ionic/angular/standalone';
import { UserService } from '../services/user.service';

type AuthMode = 'welcome' | 'login' | 'signup';

@Component({
  selector: 'app-auth',
  templateUrl: './auth.page.html',
  styleUrls: ['./auth.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonButton, IonContent, IonInput],
})
export class AuthPage {
  mode: AuthMode = 'welcome';
  email = '';
  password = '';
  confirmPassword = '';
  firstName = '';
  middleName = '';
  surname = '';
  notice = '';
  submitting = false;
  private readonly emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  constructor(
    private router: Router,
    private userService: UserService,
  ) {}

  setMode(mode: AuthMode): void {
    this.mode = mode;
    this.notice = '';
    this.password = '';
    this.confirmPassword = '';
  }

  async submit(form: NgForm): Promise<void> {
    if (this.submitting) {
      return;
    }
    this.notice = '';
    if (form.invalid) {
      form.control.markAllAsTouched();
      this.notice =
        this.mode === 'signup'
          ? 'Please fill in all required fields'
          : 'Please enter both email and password';
      return;
    }

    if (!this.emailPattern.test(this.email.trim())) {
      this.notice = 'Enter a valid email address.';
      return;
    }

    if (this.mode === 'signup') {
      if (this.password.length < 8) {
        this.notice = 'Choose a password with at least 8 characters.';
        return;
      }
      if (this.password !== this.confirmPassword) {
        this.notice = 'The passwords do not match.';
        return;
      }
      if (!this.firstName.trim() || !this.surname.trim()) {
        this.notice = 'Enter your first and last name to create your account.';
        return;
      }
    }

    this.submitting = true;
    try {
      if (this.mode === 'signup') {
        await this.userService.signUp(
          this.firstName,
          this.middleName,
          this.surname,
          this.email,
          this.password,
        );
      } else {
        await this.userService.signIn(this.email, this.password);
      }
      this.password = '';
      this.confirmPassword = '';
      await this.router.navigateByUrl('/tabs/home');
    } catch (error) {
      this.notice =
        error instanceof Error
          ? error.message
          : 'Unable to complete sign-in. Please try again.';
    } finally {
      this.submitting = false;
    }
  }
}

import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  barChartOutline,
  bulbOutline,
  calendarOutline,
  cloudOutline,
  headsetOutline,
  peopleOutline,
} from 'ionicons/icons';

type BillingCycle = 'monthly' | 'annual';

interface PremiumFeature {
  icon: string;
  title: string;
  description: string;
  status: string;
}

@Component({
  selector: 'app-subscription',
  template: `
    <ion-content class="account-content">
      <main class="account-page subscription-page">
        <span class="account-eyebrow">More focus, less pressure</span>
        <h1 class="account-title">Plans for student life</h1>
        <p class="account-intro">
          Keep the essentials free. Upgrade only when the extra structure is worth it for you.
          The prices below are only a proposal; Plus is not available to purchase in this build.
        </p>

        <div class="billing-switch" role="group" aria-label="Choose billing period">
          <button type="button" [class.selected]="billingCycle === 'monthly'" [attr.aria-pressed]="billingCycle === 'monthly'" (click)="billingCycle = 'monthly'">Monthly</button>
          <button type="button" [class.selected]="billingCycle === 'annual'" [attr.aria-pressed]="billingCycle === 'annual'" (click)="billingCycle = 'annual'">Annual <span>Save about 33%</span></button>
        </div>

        <div class="plan-grid">
          <section class="plan-card">
            <span class="plan-label">STARTER</span>
            <h2>Free</h2>
            <p class="plan-price">₱0 <span>forever</span></p>
            <p class="plan-description">A genuinely useful place to begin.</p>
            <ul class="account-list">
              <li>Focus timer and recovery breaks</li>
              <li>Tasks, daily planning, and basic insights</li>
              <li>Ambient audio and commitment gate</li>
            </ul>
            <button class="account-secondary plan-button" type="button" disabled>Your current starting plan</button>
          </section>

          <section class="plan-card featured-plan">
            <div class="plan-topline"><span class="plan-label">FOCUSFLOW PLUS</span><span class="popular-tag">Student friendly</span></div>
            <h2>Plus</h2>
            <p class="plan-price">{{ plusPrice }} <span>/ {{ billingCycle === 'monthly' ? 'month' : 'year' }}</span></p>
            <p class="plan-description">{{ billingCycle === 'annual' ? 'Proposed yearly price; checkout is not available.' : 'Proposed monthly price; checkout is not available.' }}</p>
            <ul class="account-list">
              <li>Smart study planning and schedule suggestions</li>
              <li>Calendar sync and cross-device backup</li>
              <li>Deeper focus reports and saved routines</li>
              <li>More soundscapes and personalization</li>
            </ul>
            <button class="account-action plan-button" type="button" disabled>Purchases unavailable</button>
          </section>

          <section class="plan-card student-plan">
            <span class="plan-label">STUDENT DISCOUNT</span>
            <h2>Student Plus</h2>
            <p class="plan-price">{{ studentPrice }} <span>/ {{ billingCycle === 'monthly' ? 'month' : 'year' }}</span></p>
            <p class="plan-description">{{ billingCycle === 'annual' ? 'Proposed student yearly price; not available yet.' : 'Proposed student monthly price; not available yet.' }}</p>
            <ul class="account-list">
              <li>Everything in Plus</li>
              <li>Lower price designed around student budgets</li>
              <li>Eligibility check before the discount launches</li>
            </ul>
            <button class="account-secondary plan-button" type="button" (click)="showStudentNotice()">Student offer details</button>
          </section>
        </div>

        <p class="account-status plan-notice" role="status" *ngIf="notice">{{ notice }}</p>
        <p class="pricing-disclaimer">
          This build has no checkout or verified purchase system. You cannot purchase or unlock Plus
          here, and nothing will be charged. A real subscription must be confirmed by a trusted
          payment provider before paid access is granted.
        </p>

        <section class="premium-section">
          <span class="account-eyebrow">Future membership preview</span>
          <h2>See what Plus may include</h2>
          <p class="account-intro">Preview planned upgrades before deciding. These features are not live or purchasable yet; free essentials remain available to everyone.</p>
          <div class="account-grid">
            <article class="premium-feature" *ngFor="let feature of premiumFeatures">
              <span class="feature-icon"><ion-icon [name]="feature.icon" aria-hidden="true"></ion-icon></span>
              <div class="premium-feature-copy"><h3>{{ feature.title }}</h3><p>{{ feature.description }}</p><small>{{ feature.status }}</small></div>
            </article>
          </div>
          <p class="account-note">When these features are implemented, paid access should unlock only after a trusted store or payment provider confirms a purchase. No payment or unlock is available in this preview.</p>
        </section>
      </main>
    </ion-content>
  `,
  styleUrls: ['./account-shared.scss', './subscription.page.scss'],
  standalone: true,
  imports: [CommonModule, IonContent, IonIcon],
})
export class SubscriptionPage {
  billingCycle: BillingCycle = 'monthly';
  notice = '';
  readonly premiumFeatures: PremiumFeature[] = [
    { icon: 'bulb-outline', title: 'Smart study planner', description: 'Turn task estimates and deadlines into a flexible plan for the day.', status: 'PLANNED · PLUS' },
    { icon: 'calendar-outline', title: 'Calendar connections', description: 'Bring class schedules and assignment deadlines together.', status: 'PLANNED · PLUS' },
    { icon: 'cloud-outline', title: 'Sync and backup', description: 'Keep your tasks and focus history available across devices.', status: 'PLANNED · PLUS' },
    { icon: 'bar-chart-outline', title: 'Deeper insights', description: 'See focus patterns and progress over time, not just a streak.', status: 'PLANNED · PLUS' },
    { icon: 'headset-outline', title: 'Personal focus spaces', description: 'Save routines, sound mixes, and study-friendly appearances.', status: 'PLANNED · PLUS' },
    { icon: 'people-outline', title: 'Study together', description: 'Optional shared focus sessions and friendly accountability.', status: 'PLANNED · PLUS' },
  ];

  constructor() {
    addIcons({
      barChartOutline,
      bulbOutline,
      calendarOutline,
      cloudOutline,
      headsetOutline,
      peopleOutline,
    });
  }

  get plusPrice(): string {
    return this.billingCycle === 'monthly' ? '₱99' : '₱799';
  }

  get studentPrice(): string {
    return this.billingCycle === 'monthly' ? '₱49' : '₱399';
  }

  showStudentNotice(): void {
    this.notice = 'Student pricing is not available yet. Verification and checkout must be connected before this can be offered.';
  }
}

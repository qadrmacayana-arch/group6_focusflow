import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router, Routes } from '@angular/router';
import { UserService } from './services/user.service';
import { TimerService } from './services/timer.service';
import { TabsPage } from './tabs/tabs.page';

const focusSessionActive = (): boolean => {
  const session = inject(TimerService).getSession();
  return session.phase === 'engage' ||
    (session.phase === 'focus' && session.started) ||
    session.protectedRecovery;
};

const keepFocusSessionInFocus: CanActivateFn = (_route, state) => {
  const router = inject(Router);
  return focusSessionActive() && !state.url.startsWith('/tabs/focus')
    ? router.parseUrl('/tabs/focus')
    : true;
};

const keepFocusSessionInFocusChild: CanActivateChildFn = (route, state) =>
  keepFocusSessionInFocus(route, state);

const authenticatedOnly: CanActivateFn = () => {
  const router = inject(Router);
  return inject(UserService).isAuthenticated() ? true : router.parseUrl('/auth');
};

export const routes: Routes = [
  {
    path: 'auth',
    canActivate: [keepFocusSessionInFocus],
    loadComponent: () => import('./auth/auth.page').then((m) => m.AuthPage),
  },
  {
    path: 'tabs',
    component: TabsPage,
    canActivate: [authenticatedOnly],
    canActivateChild: [keepFocusSessionInFocusChild],
    children: [
      {
        path: 'home',
        loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
      },
      {
        path: 'focus',
        loadComponent: () => import('./focus/focus.page').then((m) => m.FocusPage),
      },
      {
        path: 'tasks',
        loadComponent: () => import('./tasks/tasks.page').then((m) => m.TasksPage),
      },
      {
        path: 'canvas',
        loadComponent: () => import('./canvas/canvas.page').then((m) => m.CanvasPage),
      },
      {
        path: 'calendar',
        loadComponent: () => import('./calendar/calendar.page').then((m) => m.CalendarPage),
      },
      {
        path: 'insights',
        loadComponent: () => import('./insights/insights.page').then((m) => m.InsightsPage),
      },
      {
        path: 'profile',
        loadComponent: () => import('./account/profile.page').then((m) => m.ProfilePage),
      },
      {
        path: 'settings',
        loadComponent: () => import('./account/settings.page').then((m) => m.SettingsPage),
      },
      {
        path: 'subscription',
        loadComponent: () =>
          import('./account/subscription.page').then((m) => m.SubscriptionPage),
      },
      {
        path: 'about',
        loadComponent: () => import('./account/about.page').then((m) => m.AboutPage),
      },
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full',
      },
    ],
  },
  {
    path: '',
    redirectTo: 'auth',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: 'auth',
  },
];

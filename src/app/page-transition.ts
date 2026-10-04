import { AnimationBuilder, createAnimation } from '@ionic/angular/standalone';

export const pageTransition: AnimationBuilder = (_baseEl, options) => {
  const reducedMotion =
    document.documentElement.classList.contains('focusflow-reduce-motion') ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animation = createAnimation('focusflow-page-transition')
    .duration(reducedMotion ? 1 : 240)
    .easing('cubic-bezier(0.2, 0, 0, 1)');
  const enteringPage = createAnimation()
    .addElement(options.enteringEl)
    .fromTo('opacity', '0', '1')
    .fromTo(
      'transform',
      options.direction === 'back' ? 'translateY(-8px)' : 'translateY(8px)',
      'translateY(0)',
    );

  animation.addAnimation(enteringPage);

  if (options.leavingEl) {
    animation.addAnimation(
      createAnimation().addElement(options.leavingEl).fromTo('opacity', '1', '0.94'),
    );
  }

  return animation;
};

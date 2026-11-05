import { Component } from 'react';

// A failed decorative scene must leave its HTML course label and all tools usable.
export default class BadgeBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false, route: props.route };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  static getDerivedStateFromProps(props, state) {
    return props.route !== state.route ? { failed: false, route: props.route } : null;
  }

  componentDidCatch() {
    const { registry } = this.props;
    registry.getState().entries.forEach(({ element }) => {
      if (!element) return;
      element.dataset.badgeRendered = 'false';
      // The 3D badge will not come: its card shows now, not after the wait for
      // it (CourseBadge.jsx), and the card's panel is whole again.
      element.dataset.badgeFailed = '';
      const backing = element.closest('[data-badge-clip]')?.querySelector('[data-badge-backing]');
      if (backing) backing.style.clipPath = '';
    });
  }

  render() {
    const { failed } = this.state;
    const { children } = this.props;
    return failed ? null : children;
  }
}

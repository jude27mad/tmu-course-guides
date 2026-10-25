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
      if (element) element.dataset.badgeRendered = 'false';
    });
  }

  render() {
    const { failed } = this.state;
    const { children } = this.props;
    return failed ? null : children;
  }
}

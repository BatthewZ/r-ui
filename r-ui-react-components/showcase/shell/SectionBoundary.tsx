import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  /** Shown in the fallback, so a broken demo says which one it is. */
  title: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * One per demo section: a section that throws renders this box instead of
 * blanking the whole page. `data-section-error` is what the browser checks
 * count, so a tripped boundary fails them even though the page still renders.
 */
export class SectionBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`showcase: the "${this.props.title}" section threw`, error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="sc-invalid" role="alert" data-section-error={this.props.title}>
        <p>
          <strong>{this.props.title}</strong> failed to render: {error.message}
        </p>
        <button type="button" className="sc-retry" onClick={() => this.setState({ error: null })}>
          Retry
        </button>
      </div>
    );
  }
}

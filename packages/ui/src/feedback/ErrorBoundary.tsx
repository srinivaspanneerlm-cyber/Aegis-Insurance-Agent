"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "../components/Button";

interface Props {
  children: ReactNode;
  /** Rendered instead of the crashed subtree. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** Report to the platform's error sink. Never the customer's problem. */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  error: Error | null;
}

/**
 * Stops one broken component from taking the whole page with it.
 *
 * React unmounts the entire tree on an unhandled render error — without a
 * boundary, a null dereference in a sidebar widget leaves the customer staring
 * at a blank white screen with no way forward. This keeps the failure local and
 * always offers a way out.
 *
 * Still a class component: `componentDidCatch` has no hook equivalent.
 *
 * Note it catches render errors only — not errors inside event handlers or
 * async work. Those belong to whoever wrote the handler, which is why the API
 * layer returns `Result` rather than throwing across boundaries.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
    // Kept so a developer sees it in the console during development; production
    // reporting goes through `onError`.
    console.error("[aegis] Unhandled render error:", error, info.componentStack);
  }

  private readonly reset = (): void => this.setState({ error: null });

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div
        role="alert"
        className="rounded-card border-line bg-surface flex min-h-[240px] flex-col items-center justify-center gap-4 border p-8 text-center"
      >
        <div>
          <h2 className="text-h4 text-content font-bold">This part didn&apos;t load</h2>
          <p className="text-body-sm text-content-muted mt-2 max-w-sm">
            Something went wrong on our side — nothing you did caused it, and nothing you entered
            has been lost. Try again, and if it keeps happening our team can help.
          </p>
        </div>
        <Button variant="secondary" onClick={this.reset}>
          Try again
        </Button>
      </div>
    );
  }
}

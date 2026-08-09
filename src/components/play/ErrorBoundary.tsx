import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Game error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex flex-col items-center justify-center min-h-full p-6 gap-4">
            <p className="text-lg font-medium">Something went wrong</p>
            <p className="text-sm text-muted-foreground">An error occurred in this game</p>
            <Button onClick={() => this.setState({ hasError: false })}>Try Again</Button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;

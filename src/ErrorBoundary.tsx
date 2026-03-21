// @ts-nocheck
import React, { ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
    
    // Also save to a variable on window so puppeteer can easily read it if needed
    (window as any).LAST_REACT_ERROR = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack
    };
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, fontFamily: 'monospace', backgroundColor: '#fee', color: '#900', minHeight: '100vh' }}>
          <h1 style={{ fontSize: 24, fontWeight: 'bold' }}>Application Crashed!</h1>
          <p style={{ fontSize: 16, fontWeight: 'bold', marginTop: 10 }}>{this.state.error?.toString()}</p>
          <pre style={{ marginTop: 20, whiteSpace: 'pre-wrap', fontSize: 12 }}>
            {this.state.error?.stack}
          </pre>
          <hr style={{ margin: '20px 0', borderColor: '#faa' }}/>
          <h2 style={{ fontSize: 16, fontWeight: 'bold' }}>Component Stack:</h2>
          <pre style={{ marginTop: 10, whiteSpace: 'pre-wrap', fontSize: 12 }}>
            {this.state.errorInfo?.componentStack}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}

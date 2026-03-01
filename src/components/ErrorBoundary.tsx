import { Component, type ReactNode, type ErrorInfo } from 'react';
import { reportError } from '../services/errorReporter';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    reportError(error, 'ErrorBoundary', errorInfo.componentStack || undefined);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: '#f8fafc',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          padding: '1rem',
        }}>
          <div style={{
            textAlign: 'center',
            maxWidth: '480px',
          }}>
            <div style={{
              fontSize: '3rem',
              marginBottom: '1rem',
            }}>⚠️</div>
            <h1 style={{
              fontSize: '1.5rem',
              fontWeight: 600,
              color: '#1e293b',
              marginBottom: '0.5rem',
            }}>Er is iets misgegaan</h1>
            <p style={{
              color: '#64748b',
              marginBottom: '1.5rem',
              lineHeight: 1.6,
            }}>
              Er is een onverwachte fout opgetreden. Probeer de pagina opnieuw te laden.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                onClick={this.handleReload}
                style={{
                  padding: '0.625rem 1.25rem',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Pagina herladen
              </button>
              <button
                onClick={this.handleGoHome}
                style={{
                  padding: '0.625rem 1.25rem',
                  backgroundColor: 'white',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Naar startpagina
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

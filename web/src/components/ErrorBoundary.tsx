import React from 'react';

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <h2>Algo deu errado nesta página</h2>
          <p style={{ color: '#6b7280', marginBottom: 20 }}>{this.state.message}</p>
          <button
            className="btn-primary"
            onClick={() => this.setState({ hasError: false, message: '' })}
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

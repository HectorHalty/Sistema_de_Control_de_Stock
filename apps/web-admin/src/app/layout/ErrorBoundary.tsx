import { Component, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
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

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="bg-card text-card-foreground rounded-xl shadow-lg p-8 max-w-lg w-full border border-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-950 rounded-full flex items-center justify-center">
                <AlertTriangle size={24} className="text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h2 className="text-foreground">Error en la aplicación</h2>
                <p className="text-sm text-muted-foreground">Algo salió mal al cargar el contenido.</p>
              </div>
            </div>
            {this.state.error && (
              <div className="bg-red-50 dark:bg-red-950/40 rounded-lg p-4 mb-4 border border-red-200 dark:border-red-900">
                <p className="text-sm text-red-800 dark:text-red-300 break-words">{this.state.error.message}</p>
              </div>
            )}
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.href = '/';
              }}
              className="w-full bg-[#3d7a3d] hover:bg-[#2f5f2f] text-white py-2.5 rounded-lg transition-colors"
            >
              Recargar Aplicación
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

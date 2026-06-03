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
        <div className="min-h-screen flex items-center justify-center bg-[#faf8f5] p-6">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-lg w-full border border-[rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle size={24} className="text-red-600" />
              </div>
              <div>
                <h2 className="text-[#3a3a3a]">Error en la aplicación</h2>
                <p className="text-sm text-[#717182]">Algo salió mal al cargar el contenido.</p>
              </div>
            </div>
            {this.state.error && (
              <div className="bg-red-50 rounded-lg p-4 mb-4 border border-red-200">
                <p className="text-sm text-red-800 break-words">{this.state.error.message}</p>
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

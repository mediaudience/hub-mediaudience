import { Component } from "react";

// Sin esto, cualquier excepción no controlada durante el render (ej. leer una
// propiedad de un estado null antes de tiempo, como pasó en Usuarios.jsx)
// hace que React desmonte TODO el árbol y la pantalla quede en blanco, sin
// ningún indicio de que algo falló. Este boundary evita que un bug puntual
// tumbe el panel entero y deja registro del error en el backend para poder
// encontrarlo sin depender de que alguien lo reporte a mano.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Error de render capturado por ErrorBoundary:", error, info);
    fetch("/api/client-error", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error?.message,
        stack: error?.stack?.slice(0, 2000),
        componentStack: info?.componentStack?.slice(0, 2000),
        url: window.location.href,
      }),
    }).catch(() => {});
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
          <div className="max-w-md w-full text-center">
            <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-brand-purple flex items-center justify-center text-white font-bold text-2xl">
              !
            </div>
            <h1 className="text-lg font-semibold text-gray-900 mb-2">Algo salió mal</h1>
            <p className="text-sm text-slate-label mb-6">
              Ocurrió un error inesperado. Ya quedó registrado — probá recargar la página.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center rounded-lg bg-brand-purple px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
            >
              Recargar página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

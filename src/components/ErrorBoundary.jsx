import { Component } from 'react';

/**
 * Error boundary che cattura qualsiasi errore di rendering React
 * e mostra un messaggio in chiaro invece della pagina bianca.
 * Avvolgi App con questo per non perdere mai più un crash silenzioso.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    // Stampa anche in console per il debug remoto
    // eslint-disable-next-line no-console
    console.error('FAMMY crashed:', error, info);
  }

  reset = () => {
    this.setState({ error: null, info: null });
  };

  fullReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {}
    window.location.href = '/';
  };

  render() {
    if (this.state.error) {
      const stack = (this.state.error?.stack || String(this.state.error)).slice(0, 800);
      return (
        <div style={{
          padding: 24, maxWidth: 600, margin: '40px auto',
          background: '#fff', borderRadius: 16,
          border: '2px solid #E74C3C',
          fontFamily: 'system-ui, sans-serif',
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
          <h2 style={{ marginTop: 0 }}>Qualcosa è andato storto</h2>
          <p style={{ color: '#666' }}>
            FAMMY ha incontrato un errore inaspettato. Prova a ricaricare la pagina
            o, se il problema persiste, pulisci i dati locali e rifai login.
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            <button onClick={() => window.location.reload()}
              style={{
                padding: '10px 18px', background: '#2A6FDB', color: 'white',
                border: 'none', borderRadius: 10, fontWeight: 600, cursor: 'pointer',
              }}>
              🔄 Ricarica pagina
            </button>
            <button onClick={this.fullReset}
              style={{
                padding: '10px 18px', background: '#E74C3C', color: 'white',
                border: 'none', borderRadius: 10, fontWeight: 600, cursor: 'pointer',
              }}>
              🧹 Pulisci dati e logout
            </button>
            <button onClick={this.reset}
              style={{
                padding: '10px 18px', background: 'white', color: '#666',
                border: '1.5px solid #ccc', borderRadius: 10, fontWeight: 600, cursor: 'pointer',
              }}>
              Riprova senza ricaricare
            </button>
          </div>
          <details style={{ marginTop: 20, fontSize: 12, color: '#888' }}>
            <summary style={{ cursor: 'pointer' }}>Dettagli tecnici (per Claude)</summary>
            <pre style={{
              marginTop: 8, padding: 12, background: '#f5f5f5',
              borderRadius: 8, overflow: 'auto', maxHeight: 300,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>{stack}</pre>
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}

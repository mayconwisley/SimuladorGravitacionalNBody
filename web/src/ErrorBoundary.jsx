import { Component } from 'react';
import Icon from './Icons.jsx';

// Keeps a rendering failure inside the workspace instead of unmounting the whole app.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) { return { error }; }

  componentDidCatch(error, info) { console.error('OrbitalSim: falha ao renderizar.', error, info.componentStack); }

  componentDidUpdate(previous) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return <div className="crash-panel" role="alert">
      <span className="panel-icon"><Icon name="alert" /></span>
      <h2>Não foi possível exibir esta tela</h2>
      <p>A interface encontrou um erro. Os dados do cenário continuam preservados.</p>
      <code className="mono">{error.message || String(error)}</code>
      <div className="empty-actions">
        <button className="button primary" type="button" onClick={() => { this.setState({ error: null }); this.props.onReset?.(); }}>
          <Icon name="grid" size={14} /> Voltar às simulações</button>
        <button className="button subtle" type="button" onClick={() => window.location.reload()}>
          <Icon name="restart" size={14} /> Recarregar página</button>
      </div>
    </div>;
  }
}

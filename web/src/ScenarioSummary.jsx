import Icon from './Icons.jsx';
import { presets } from './scenario.mjs';
import { presetSummaries } from './presetSummaries.mjs';

// Header card of the results page: the running scenario's name and, for gallery scenarios, a
// short summary of what it shows. Custom and imported runs keep just the name.
export default function ScenarioSummary({ source, presetKey }) {
  const preset = presetKey ? presets[presetKey] : null;
  const summary = presetKey ? presetSummaries[presetKey] : null;
  if (!summary) return source ? <span className="scenario-pill"><Icon name="orbit" size={14} />{source}</span> : null;
  return <section className="scenario-summary" aria-label="Sobre a simulação">
    <header>
      <Icon name="orbit" size={15} />
      <strong>{source}</strong>
      <span className="scenario-category">{preset.category}</span>
    </header>
    <p>{summary}</p>
  </section>;
}

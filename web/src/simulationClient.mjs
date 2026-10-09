// HTTP access to the simulation API. The streaming endpoint answers with NDJSON: a "start"
// line, one "sample" line per sample as soon as it is computed, then "end" or "error".

const unavailable = 'A API .NET está indisponível. Inicie o servidor local na porta 5080.';

async function post(path, scenario, signal) {
  let response;
  try {
    response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scenario), signal });
  } catch (cause) {
    if (cause?.name === 'AbortError') throw cause;
    throw new Error(unavailable);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `A API respondeu com o status ${response.status}.`);
  }
  return response;
}

// Splits a text buffer into complete NDJSON messages and the unfinished remainder.
export function parseNdjson(buffer) {
  const lines = buffer.split('\n');
  const rest = lines.pop();
  return { messages: lines.filter(line => line.trim()).map(line => JSON.parse(line)), rest };
}

export async function streamSimulation(scenario, { signal, onStart, onSamples } = {}) {
  const response = await post('/api/simulations/stream', scenario, signal);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let ended = false;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const { messages, rest } = parseNdjson(buffer);
    buffer = rest;
    const samples = [];
    for (const message of messages) {
      if (message.type === 'start') onStart?.(message);
      else if (message.type === 'sample') samples.push(message.sample);
      else if (message.type === 'error') throw new Error(message.error || 'O motor falhou durante a simulação.');
      else if (message.type === 'end') ended = true;
    }
    if (samples.length) onSamples?.(samples);
  }
  if (!ended) throw new Error('A simulação foi interrompida antes do fim.');
}

export async function runSimulation(scenario, signal) {
  const response = await post('/api/simulations', scenario, signal);
  return response.json();
}

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
  const end = buffer.lastIndexOf('\n');
  if (end < 0) return { messages: [], rest: buffer };
  const messages = [];
  for (const line of buffer.slice(0, end).split('\n')) if (line.trim()) messages.push(JSON.parse(line));
  return { messages, rest: buffer.slice(end + 1) };
}

export async function streamSimulation(scenario, { signal, onStart, onSamples } = {}) {
  const response = await post('/api/simulations/stream', scenario, signal);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let ended = false;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      buffer += text;
      // A sample line with particles spans many chunks: parse only once a line is complete.
      if (!text.includes('\n')) continue;
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
  } catch (cause) {
    // Release the connection so the server stops computing a run nobody reads.
    reader.cancel().catch(() => {});
    throw cause;
  } finally {
    reader.releaseLock();
  }
  if (!ended) throw new Error('A simulação foi interrompida antes do fim.');
}

export async function runSimulation(scenario, signal) {
  const response = await post('/api/simulations', scenario, signal);
  return response.json();
}

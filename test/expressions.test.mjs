// Evaluates the workflow's n8n expressions against the API's real response shapes
// (mocked) and against live refusals (wrong key, no key). No generation is run.
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const wf = JSON.parse(readFileSync(new URL('../aigifmaker-text-to-gif-form.json', import.meta.url)));
const node = (n) => wf.nodes.find((x) => x.name === n);
const expr = (s) => s.replace(/^=\{\{\s*/, '').replace(/\s*\}\}$/, '');
const evalWith = (s, $json, startId = 't1') => new Function('$json', '$', `return (${expr(s)});`)($json, () => ({ item: { json: { data: { id: startId } } } }));

const accepted = ($json) => evalWith(node('Accepted?').parameters.conditions.conditions[0].leftValue, $json);
const refusal = ($json) => evalWith(node('Explain refusal').parameters.assignments.assignments[0].value, $json);
const route = ($json) => {
  const [ready, failed] = node('Route by status').parameters.rules.values.map((r) => r.conditions.conditions[0].leftValue);
  return evalWith(ready, $json) ? 'ready' : evalWith(failed, $json) ? 'failed' : 'wait';
};

test('request body', () => {
  const body = JSON.parse(evalWith(node('Start GIF').parameters.jsonBody, { Prompt: 'a corgi' }));
  assert.deepEqual(body, { provider: 'openlux', mediaType: 'image', model: 'gif-maker-v1', scene: 'text-to-image', prompt: 'a corgi', options: { output_format: 'gif' } });
  assert.deepEqual(JSON.parse(evalWith(node('Check status').parameters.jsonBody, {}, 'abc')), { taskId: 'abc' });
});

test('routing', () => {
  assert.equal(accepted({ code: 0, data: { id: 't1', status: 'pending' } }), true);
  assert.equal(route({ code: 0, data: { status: 'processing', queued: true, queueEta: 20 } }), 'wait');
  assert.equal(route({ code: 0, data: { status: 'pending' } }), 'wait');
  assert.equal(route({ code: 0, data: { status: 'success', images: ['https://x/a.gif'] } }), 'ready');
  assert.equal(route({ code: 0, data: { status: 'failed', errorMessage: 'boom' } }), 'failed');
  assert.equal(route({ code: -1, message: 'invalid API key' }), 'failed');
  assert.equal(evalWith(node('Open the GIF').parameters.redirectUrl, { data: { images: ['https://x/a.gif'] } }), 'https://x/a.gif');
});

test('refusal messages', () => {
  assert.match(refusal({ code: -1, message: 'insufficient credits' }), /pricing/);
  assert.match(refusal({ code: 429, message: 'cooldown' }), /reword/i);
});

async function live(headers) {
  const r = await fetch('https://aigifmaker.ai/api/ai/generate', { method: 'POST', headers: { 'content-type': 'application/json', ...headers },
    body: evalWith(node('Start GIF').parameters.jsonBody, { Prompt: 'smoke test' }) });
  return r.json();
}
test('live: wrong key is refused with the key message', async () => {
  const j = await live({ authorization: 'Bearer sk-invalidtest000' });
  assert.equal(accepted(j), false);
  assert.match(refusal(j), /did not accept the API key/);
});
test('live: no key hits the wall and asks for a key', async () => {
  const j = await live({});
  assert.equal(accepted(j), false);
  assert.match(refusal(j), /needs an API key/);
});

'use strict';
const count = document.querySelector('#count');
const countValue = document.querySelector('#count-value');
const lanes = document.querySelector('#lanes');
const stage = document.querySelector('#stage');
const release = document.querySelector('#release');
const reset = document.querySelector('#reset');
const phase = document.querySelector('#phase');
const status = document.querySelector('#lab-status');
let state = 'ready';

function render() {
  const total = Number(count.value);
  countValue.value = String(total);
  lanes.replaceChildren();
  for (let i = 0; i < total; i++) {
    const lane = document.createElement('div');
    lane.className = `lane ${state}`;
    const connection = document.createElement('span');
    connection.className = 'connection';
    connection.textContent = `TCP ${String(i + 1).padStart(2, '0')}`;
    const bytes = document.createElement('span');
    bytes.className = 'bytes';
    bytes.setAttribute('aria-label', state === 'ready' ? 'Five unsent body bytes' : state === 'staged' ? 'Four body bytes sent, one withheld' : 'All five body bytes sent');
    for (let j = 0; j < 5; j++) {
      const byte = document.createElement('span');
      byte.className = j === 4 ? 'byte last' : 'byte';
      byte.setAttribute('aria-hidden', 'true');
      bytes.append(byte);
    }
    const label = document.createElement('span');
    label.className = 'lane-state';
    label.textContent = state === 'ready' ? 'UNSENT' : state === 'staged' ? '1 HELD' : 'COMPLETE';
    lane.append(connection, bytes, label);
    lanes.append(lane);
  }
  phase.textContent = state.toUpperCase();
  stage.disabled = state !== 'ready';
  release.disabled = state !== 'staged';
  status.textContent = state === 'ready'
    ? 'Ready: no request bytes have been sent in this illustration.'
    : state === 'staged'
      ? `Staged ${total} requests: headers and four body bytes sent on each connection. The final byte is withheld.`
      : `Released ${total} final bytes in sequence. Each illustrated body is now complete. Real arrival and execution times can differ.`;
}
count.addEventListener('input', () => { state = 'ready'; render(); });
stage.addEventListener('click', () => { state = 'staged'; render(); release.focus(); });
release.addEventListener('click', () => { state = 'released'; render(); reset.focus(); });
reset.addEventListener('click', () => { state = 'ready'; render(); stage.focus(); });
for (const button of document.querySelectorAll('[data-copy]')) {
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(button.dataset.copy);
      button.textContent = 'Copied';
      setTimeout(() => { button.textContent = 'Copy command'; }, 2000);
    } catch {
      button.textContent = 'Select command below';
    }
  });
}
render();

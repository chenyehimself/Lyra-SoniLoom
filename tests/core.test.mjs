import test from 'node:test';
import assert from 'node:assert/strict';
const model = await import('../src/project.mjs').catch(() => ({}));
const dsp = await import('../src/engine.mjs').catch(() => ({}));
const wav = await import('../src/wav.mjs').catch(() => ({}));

test('engine renders stable finite stereo and sample-accurate silence before an event', () => {
  assert.equal(typeof dsp.renderProject, 'function', 'owned renderer must exist');
  const p = model.createProject(); p.layers = [model.createLayer('tone')]; p.layers[0].start = 1;
  const a = dsp.renderProject(p), b = dsp.renderProject(p);
  assert.equal(a.channels.length, 2); assert.equal(a.sampleRate, 48000);
  assert.equal(a.channels[0].length, Math.round(p.duration * 48000));
  assert.deepEqual(a.channels, b.channels);
  assert(a.channels.every(c => c.every(Number.isFinite)));
  assert(a.channels[0].slice(0,48000).every(v => v === 0));
  assert(a.channels[0].slice(48000).some(v => Math.abs(v) > .01));
});

test('protected layer survives other edits bit-for-bit; locked edit and stale edit are rejected', () => {
  assert.equal(typeof model.ProjectStore, 'function', 'revision store must exist');
  const s = new model.ProjectStore(model.createProject());
  const id = s.project.layers[2].id, other = s.project.layers[1].id;
  s.lock(id, true); const before = structuredClone(s.project.layers[2]);
  const audio = dsp.renderProject(s.project, {onlyLayerId: id}).channels;
  s.edit(other, {cutoff: 1600});
  assert.deepEqual(s.project.layers[2], before);
  assert.deepEqual(dsp.renderProject(s.project, {onlyLayerId: id}).channels, audio);
  const current = JSON.stringify(s.project);
  assert.throws(() => s.edit(id, {gain: .4}), /locked/i);
  assert.throws(() => s.edit(other, {gain: .4}, 0), /stale/i);
  assert.equal(JSON.stringify(s.project), current);
});

test('undo and redo restore content with monotonic concurrency generations', () => {
  assert.equal(typeof model.ProjectStore, 'function');
  const s = new model.ProjectStore(model.createProject()); const old = structuredClone(s.project);
  const id = s.project.layers[0].id; s.edit(id, {gain:.12}); const edited = structuredClone(s.project);
  const gen = s.generation; s.undo(); assert.deepEqual(s.project, old); assert(s.generation > gen);
  s.redo(); assert.deepEqual(s.project, edited);
  s.undo(); s.edit(id, {pan: .2}); assert.equal(s.canRedo, false);
});

test('validation rejects nonfinite parameters, missing sources, duplicate IDs and oversized timelines', () => {
  assert.equal(typeof model.validateProject, 'function');
  for (const change of [p => p.layers[0].gain = NaN, p => p.duration = 500, p => p.layers[0].type = 'imaginary', p => p.layers[1].id = p.layers[0].id, p => {p.layers[0].type='sample';p.layers[0].assetId='missing';}]) {
    const p=model.createProject(); change(p); assert.throws(()=>model.validateProject(p));
  }
});

test('portable save and reopen reproduces project and rejects malformed files', () => {
  assert.equal(typeof model.serializeProject, 'function');
  const p=model.createProject(); const restored=model.parseProject(model.serializeProject(p));
  assert.deepEqual(restored,p); assert.deepEqual(dsp.renderProject(restored).channels,dsp.renderProject(p).channels);
  assert.throws(()=>model.parseProject('{bad')); assert.throws(()=>model.parseProject('{"schemaVersion":999}'));
});

test('WAV encoding and decoding preserve stereo, duration and quantized samples', () => {
  assert.equal(typeof wav.encodeWav, 'function');
  const channels=[Float32Array.from([0,.25,-.5,.9]),Float32Array.from([.1,-.2,.3,-.4])];
  const bytes=wav.encodeWav(channels,48000); const out=wav.decodeWav(bytes);
  assert.equal(out.sampleRate,48000);assert.equal(out.channels.length,2);assert.equal(out.channels[0].length,4);
  channels.forEach((c,j)=>c.forEach((v,i)=>assert(Math.abs(v-out.channels[j][i]) < 1/32767)));
  assert.throws(()=>wav.decodeWav(new ArrayBuffer(8)),/WAV/i);
});

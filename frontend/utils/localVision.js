// Main-thread wrapper around visionWorker.js
import { VISION_MODEL } from './visionCatalog.js';

let worker = null;
let nextId = 0;
const pending = new Map();
const progressListeners = new Set();
const fileProgress = {};
let modelReady = false;

const emitProgress = (p) => {
  if (p.status === 'progress' && p.file && p.total) {
    fileProgress[p.file] = { loaded: p.loaded, total: p.total };
  }
  if (p.status === 'ready') modelReady = true;

  const files = Object.values(fileProgress);
  const total = files.reduce((s, f) => s + f.total, 0);
  const loaded = files.reduce((s, f) => s + f.loaded, 0);
  const percent = total ? Math.round((loaded / total) * 100) : 0;
  progressListeners.forEach((fn) => fn({ percent, ready: modelReady, loadedMB: loaded / 1e6, totalMB: total / 1e6 }));
};

const getWorker = () => {
  if (!worker) {
    worker = new Worker(new URL('./visionWorker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      if (data.type === 'progress') return emitProgress(data.data);
      const job = pending.get(data.id);
      if (!job) return;
      pending.delete(data.id);
      if (data.type === 'error') job.reject(new Error(data.error));
      else job.resolve(data.data);
    };
  }
  return worker;
};

const call = (message) =>
  new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ ...message, id, model: VISION_MODEL });
  });

export const isVisionModelReady = () => modelReady;

// Subscribe to download progress; returns an unsubscribe function
export const onVisionProgress = (fn) => {
  progressListeners.add(fn);
  return () => progressListeners.delete(fn);
};

// Start downloading the model early (e.g. when the scanner opens)
export const preloadVisionModel = () => call({ action: 'load' }).then(() => { modelReady = true; });

/**
 * Classify an image against groups of prompts.
 * @param {string} dataUrl  image as a data URL
 * @param {Record<string, string[]>} groups  key -> prompts
 * @returns {Promise<Array<{key: string, score: number}>>} sorted, scores sum to 1
 */
export const classifyImage = async (dataUrl, groups) => {
  const blob = await (await fetch(dataUrl)).blob();
  const labelToKey = new Map();
  Object.entries(groups).forEach(([key, prompts]) => prompts.forEach((p) => labelToKey.set(p, key)));

  const output = await call({ action: 'classify', blob, labels: [...labelToKey.keys()] });
  modelReady = true;

  const totals = {};
  output.forEach(({ label, score }) => {
    const key = labelToKey.get(label);
    totals[key] = (totals[key] || 0) + score;
  });
  return Object.entries(totals)
    .map(([key, score]) => ({ key, score }))
    .sort((a, b) => b.score - a.score);
};

// Runs the CLIP model in a Web Worker so the page stays responsive.
// The model is downloaded once from Hugging Face and then cached by the browser.
import { pipeline, env, RawImage } from '@huggingface/transformers';

env.allowLocalModels = false;

let classifierPromise = null;

const getClassifier = (model) => {
  if (!classifierPromise) {
    classifierPromise = pipeline('zero-shot-image-classification', model, {
      dtype: 'q8',
      progress_callback: (p) => self.postMessage({ type: 'progress', data: p })
    }).catch((err) => {
      classifierPromise = null; // allow a retry after a failed download
      throw err;
    });
  }
  return classifierPromise;
};

self.onmessage = async ({ data }) => {
  const { id, action, model, blob, labels } = data;
  try {
    const classifier = await getClassifier(model);
    if (action === 'load') {
      self.postMessage({ id, type: 'result', data: null });
      return;
    }
    const image = await RawImage.fromBlob(blob);
    const output = await classifier(image, labels, { hypothesis_template: '{}' });
    self.postMessage({ id, type: 'result', data: output });
  } catch (err) {
    self.postMessage({ id, type: 'error', error: err?.message || String(err) });
  }
};

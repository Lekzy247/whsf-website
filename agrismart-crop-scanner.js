(() => {
  'use strict';

  const HISTORY_KEY = 'agrismart-crop-scans-v1';
  const FARM_KEY = 'agrismart-farms-v1';
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  let initialized = false;
  let selectedFile = null;
  let selectedImageSignals = null;
  let previewUrl = null;

  const guidance = Object.freeze({
    yellowing: {
      title: 'Possible nutrient or root-zone stress',
      summary: 'Leaf yellowing commonly follows nitrogen shortage, waterlogging, root damage, or natural ageing.',
      actions: ['Compare older and newer leaves to identify where yellowing began.', 'Check soil moisture and drainage before adding nutrients.', 'Use a soil or leaf test before making a major fertilizer application.'],
      urgency: 'Monitor within 48 hours'
    },
    spots: {
      title: 'Possible leaf-spot disease',
      summary: 'Distinct spots can be associated with fungal or bacterial infection, physical injury, or spray damage.',
      actions: ['Photograph both sides of several affected leaves.', 'Remove heavily affected fallen material and avoid working through wet foliage.', 'Ask an agronomist to identify the pathogen before choosing a treatment.'],
      urgency: 'Inspect the field today'
    },
    wilting: {
      title: 'Possible water or root stress',
      summary: 'Wilting can result from dry soil, saturated roots, stem damage, heat stress, or vascular disease.',
      actions: ['Check moisture 5–10 cm below the soil surface.', 'Inspect the stem base and roots for damage or discoloration.', 'Compare affected and healthy sections of the field before irrigating.'],
      urgency: 'Check conditions today'
    },
    holes: {
      title: 'Possible chewing-pest activity',
      summary: 'Holes and missing leaf edges often indicate caterpillars, beetles, grasshoppers, or other feeding damage.',
      actions: ['Inspect early morning and check leaf undersides for insects, eggs, and droppings.', 'Estimate the percentage of plants affected across several field points.', 'Use local economic thresholds before applying any crop-protection product.'],
      urgency: 'Scout within 24 hours'
    },
    powder: {
      title: 'Possible powdery or downy mildew',
      summary: 'Powder-like growth may indicate a mildew disease, although dust and spray residue can look similar.',
      actions: ['Gently check whether the coating wipes away and returns on new growth.', 'Improve airflow and avoid unnecessary overhead watering late in the day.', 'Confirm the diagnosis before applying a fungicide.'],
      urgency: 'Inspect the field today'
    },
    mosaic: {
      title: 'Possible virus-like symptoms',
      summary: 'Mottling, mosaic patterns, distorted leaves, and uneven growth can be associated with viral disease or nutrient stress.',
      actions: ['Mark affected plants and avoid moving tools directly from them to healthy plants.', 'Check for aphids, whiteflies, and other possible vectors.', 'Contact an extension officer or agronomist promptly for confirmation.'],
      urgency: 'Seek expert review promptly'
    },
    stunting: {
      title: 'Possible growth limitation',
      summary: 'Stunting may reflect poor establishment, nutrient imbalance, root pests, compacted soil, or uneven water supply.',
      actions: ['Compare roots and soil conditions between weak and healthy plants.', 'Review planting date, seed source, fertilizer, and irrigation records.', 'Test soil where symptoms follow a consistent field pattern.'],
      urgency: 'Investigate this week'
    },
    other: {
      title: 'Further field inspection needed',
      summary: 'The selected symptoms do not point to one clear cause from a photo alone.',
      actions: ['Capture close-up and whole-plant photos in natural light.', 'Record when the issue began and whether it follows a field pattern.', 'Share the observations with a qualified agronomist or extension officer.'],
      urgency: 'Continue monitoring'
    }
  });

  function readArray(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[character]));
  }

  function saveHistory(records) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(records.slice(0, 50)));
    window.dispatchEvent(new CustomEvent('agrismart:scanchange', { detail: { count: records.length } }));
  }

  function createId() {
    return crypto.randomUUID?.() || `scan-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function enhanceWorkspace(view) {
    const resultPanel = view.querySelector('.scan-result');
    const diagnosis = view.querySelector('[data-diagnosis]');
    if (!resultPanel || !diagnosis || view.querySelector('[data-crop-screening-form]')) return;

    const label = resultPanel.querySelector('.chip');
    if (label) label.textContent = 'Guided screening';
    resultPanel.querySelector('h3').textContent = 'Crop health screening';

    const form = document.createElement('form');
    form.className = 'scanner-form';
    form.dataset.cropScreeningForm = '';
    form.innerHTML = `
      <label class="field"><span>Crop</span><input name="crop" required placeholder="e.g. Maize"></label>
      <label class="field"><span>Main symptom</span><select name="symptom" required>
        <option value="">Select symptom</option>
        <option value="yellowing">Yellowing or pale leaves</option>
        <option value="spots">Spots or lesions</option>
        <option value="wilting">Wilting or drooping</option>
        <option value="holes">Holes or eaten edges</option>
        <option value="powder">Powder-like coating</option>
        <option value="mosaic">Mosaic or distorted leaves</option>
        <option value="stunting">Stunted or uneven growth</option>
        <option value="other">Other or uncertain</option>
      </select></label>
      <label class="field"><span>Affected plants</span><select name="spread">
        <option value="few">A few plants</option>
        <option value="patches">Several patches</option>
        <option value="widespread">Most of the field</option>
      </select></label>
      <label class="field"><span>Soil condition</span><select name="moisture">
        <option value="normal">Normal</option>
        <option value="dry">Very dry</option>
        <option value="wet">Waterlogged or very wet</option>
        <option value="unknown">Not checked</option>
      </select></label>
      <label class="field full"><span>Farm</span><select name="farmId" data-scan-farm><option value="">Not linked to a farm</option></select></label>
      <label class="field full"><span>Field notes</span><textarea name="notes" rows="2" placeholder="When symptoms started, recent weather or inputs used"></textarea></label>`;
    diagnosis.insertAdjacentElement('beforebegin', form);

    const history = document.createElement('section');
    history.className = 'panel scanner-history';
    history.innerHTML = `
      <div class="panel-head">
        <div><h3>Screening history</h3><p>Only observations and results are saved. Crop photos remain on this device and are not stored.</p></div>
        <button class="secondary-btn" type="button" data-export-scans>Export records</button>
      </div>
      <div class="order-list" data-scan-history></div>`;
    view.querySelector('.scan-layout')?.insertAdjacentElement('afterend', history);
    populateFarms(view);
  }

  function populateFarms(view) {
    const select = view.querySelector('[data-scan-farm]');
    if (!select) return;
    const current = select.value;
    const farms = readArray(FARM_KEY);
    select.innerHTML = '<option value="">Not linked to a farm</option>' + farms
      .map(farm => `<option value="${escapeHtml(farm.id)}">${escapeHtml(farm.name || farm.farmName || 'Unnamed farm')}</option>`)
      .join('');
    if (farms.some(farm => String(farm.id) === current)) select.value = current;
  }

  function imageSignals(file) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(file);
      image.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 64;
          canvas.height = 64;
          const context = canvas.getContext('2d', { willReadFrequently: true });
          context.drawImage(image, 0, 0, 64, 64);
          const pixels = context.getImageData(0, 0, 64, 64).data;
          let green = 0;
          let yellow = 0;
          let brown = 0;
          let dark = 0;
          let visible = 0;
          for (let index = 0; index < pixels.length; index += 4) {
            const red = pixels[index];
            const greenChannel = pixels[index + 1];
            const blue = pixels[index + 2];
            if (pixels[index + 3] < 80) continue;
            visible += 1;
            if (greenChannel > red * 1.05 && greenChannel > blue * 1.1) green += 1;
            if (red > 105 && greenChannel > 80 && blue < 125 && Math.abs(red - greenChannel) < 95) yellow += 1;
            if (red > 70 && red > greenChannel * 1.08 && greenChannel < 135 && blue < 110) brown += 1;
            if ((red + greenChannel + blue) / 3 < 58) dark += 1;
          }
          const ratio = count => Math.round((count / Math.max(visible, 1)) * 100);
          resolve({ green: ratio(green), yellow: ratio(yellow), brown: ratio(brown), dark: ratio(dark) });
        } catch (error) {
          reject(error);
        } finally {
          URL.revokeObjectURL(url);
        }
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('The selected image could not be read.'));
      };
      image.src = url;
    });
  }

  function confidenceFor(symptom, spread, signals) {
    let confidence = 58;
    if (symptom !== 'other') confidence += 8;
    if (spread === 'patches' || spread === 'widespread') confidence += 4;
    if (symptom === 'yellowing' && signals.yellow >= 8) confidence += 8;
    if (symptom === 'spots' && (signals.brown >= 5 || signals.dark >= 8)) confidence += 7;
    if (symptom === 'holes' && signals.dark >= 5) confidence += 4;
    return Math.min(82, confidence);
  }

  function screen(form) {
    const values = Object.fromEntries(new FormData(form));
    const rule = guidance[values.symptom] || guidance.other;
    const signals = selectedImageSignals || { green: 0, yellow: 0, brown: 0, dark: 0 };
    const confidence = confidenceFor(values.symptom, values.spread, signals);
    const warnings = [];
    if (values.spread === 'widespread') warnings.push('Symptoms are widespread; prioritize a whole-field inspection.');
    if (values.moisture === 'wet') warnings.push('Waterlogged soil can worsen root and disease problems.');
    if (values.moisture === 'dry') warnings.push('Severe moisture stress may be contributing to the symptoms.');
    if (signals.dark > 48) warnings.push('The image is quite dark; retake it in natural light for a clearer review.');

    return {
      id: createId(),
      crop: String(values.crop || '').trim(),
      symptom: values.symptom,
      symptomLabel: form.elements.symptom.selectedOptions[0]?.textContent || 'Uncertain',
      spread: values.spread,
      moisture: values.moisture,
      farmId: values.farmId || null,
      notes: String(values.notes || '').trim(),
      fileName: selectedFile?.name || '',
      imageSignals: signals,
      title: rule.title,
      summary: rule.summary,
      actions: rule.actions,
      urgency: rule.urgency,
      warnings,
      confidence,
      createdAt: new Date().toISOString()
    };
  }

  function renderResult(view, result) {
    const diagnosis = view.querySelector('[data-diagnosis]');
    diagnosis.innerHTML = `
      <span class="result-badge">Guided screening · ${result.confidence}% match</span>
      <h3>${escapeHtml(result.title)}</h3>
      <p>${escapeHtml(result.summary)}</p>
      ${result.warnings.map(item => `<div class="notice scanner-warning">${escapeHtml(item)}</div>`).join('')}
      <div class="result-list">
        ${result.actions.map((action, index) => `<article><strong>${index + 1}. Recommended action</strong><p>${escapeHtml(action)}</p></article>`).join('')}
        <article><strong>Priority</strong><p>${escapeHtml(result.urgency)}</p></article>
      </div>
      <div class="scanner-signal-note">Image color check: ${result.imageSignals.green}% green, ${result.imageSignals.yellow}% yellow-toned, ${result.imageSignals.brown}% brown-toned.</div>
      <div class="notice">This is an educational screening, not a laboratory diagnosis. Confirm treatment decisions with a qualified agronomist and follow product labels and local regulations.</div>`;
  }

  function renderHistory(view) {
    const target = view.querySelector('[data-scan-history]');
    if (!target) return;
    const records = readArray(HISTORY_KEY);
    target.innerHTML = records.length ? records.map(record => `
      <article class="order-item" data-scan-id="${escapeHtml(record.id)}">
        <div>
          <strong>${escapeHtml(record.crop)} · ${escapeHtml(record.title)}</strong>
          <div>${escapeHtml(record.symptomLabel)} · ${new Date(record.createdAt).toLocaleString()}</div>
          <small>${escapeHtml(record.urgency)} · ${Number(record.confidence || 0)}% guided match</small>
        </div>
        <button class="secondary-btn" type="button" data-remove-scan="${escapeHtml(record.id)}">Remove</button>
      </article>`).join('') : '<div class="notice">No crop screenings saved yet.</div>';
  }

  function exportHistory() {
    const records = readArray(HISTORY_KEY);
    if (!records.length) return;
    const blob = new Blob([JSON.stringify({
      app: 'AgriSmart Connect',
      type: 'crop-screening-history',
      exportedAt: new Date().toISOString(),
      records
    }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `agrismart-crop-screenings-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function resetImage(view) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    selectedFile = null;
    selectedImageSignals = null;
    const input = view.querySelector('#crop-photo');
    const preview = view.querySelector('.scan-preview');
    const placeholder = view.querySelector('[data-scan-placeholder]');
    if (input) input.value = '';
    if (preview) {
      preview.removeAttribute('src');
      preview.style.display = 'none';
    }
    if (placeholder) placeholder.hidden = false;
  }

  function init() {
    if (initialized) return true;
    const view = document.querySelector('[data-view-panel="scan"]');
    if (!view) return false;
    initialized = true;
    enhanceWorkspace(view);

    const input = view.querySelector('#crop-photo');
    const preview = view.querySelector('.scan-preview');
    const placeholder = view.querySelector('[data-scan-placeholder]');
    const analyze = view.querySelector('[data-analyze]');
    const diagnosis = view.querySelector('[data-diagnosis]');
    const form = view.querySelector('[data-crop-screening-form]');

    input?.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return resetImage(view);
      if (!file.type.startsWith('image/')) {
        resetImage(view);
        diagnosis.innerHTML = '<div class="notice">Choose a JPG, PNG, HEIC, or another supported image file.</div>';
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        resetImage(view);
        diagnosis.innerHTML = '<div class="notice">This photo is larger than 10 MB. Choose a smaller image.</div>';
        return;
      }

      selectedFile = file;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = URL.createObjectURL(file);
      preview.src = previewUrl;
      preview.style.display = 'block';
      placeholder.hidden = true;
      analyze.disabled = true;
      diagnosis.innerHTML = '<div class="notice">Checking image quality…</div>';
      try {
        selectedImageSignals = await imageSignals(file);
        analyze.disabled = false;
        diagnosis.innerHTML = '<div class="notice">Photo ready. Add the field observations above, then run the screening.</div>';
      } catch (error) {
        selectedImageSignals = null;
        analyze.disabled = false;
        diagnosis.innerHTML = `<div class="notice">${escapeHtml(error.message)} You can still continue with the symptom-based screening.</div>`;
      }
    });

    analyze?.addEventListener('click', () => {
      if (!selectedFile) return;
      if (!form.reportValidity()) return;
      analyze.disabled = true;
      analyze.textContent = 'Screening…';
      const result = screen(form);
      const records = readArray(HISTORY_KEY);
      records.unshift(result);
      saveHistory(records);
      renderResult(view, result);
      renderHistory(view);
      analyze.textContent = 'Run screening again';
      analyze.disabled = false;
    });

    view.addEventListener('click', event => {
      const remove = event.target.closest('[data-remove-scan]');
      if (remove) {
        saveHistory(readArray(HISTORY_KEY).filter(record => String(record.id) !== remove.dataset.removeScan));
        renderHistory(view);
      }
      if (event.target.closest('[data-export-scans]')) exportHistory();
    });
    window.addEventListener('agrismart:farmchange', () => populateFarms(view));
    window.addEventListener('agrismart:scanchange', event => {
      if (event.detail?.source === 'cloud') renderHistory(view);
    });
    window.addEventListener('beforeunload', () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    });
    renderHistory(view);
    return true;
  }

  window.AgriSmartCropScanner = Object.freeze({ init, readHistory: () => readArray(HISTORY_KEY) });
})();

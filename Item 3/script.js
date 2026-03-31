
// =========================
// [SEÇÃO 1] VARIÁVEIS E ELEMENTOS DOM
// =========================
let originalImage = null;
let lastTransformedImage = null;
let width = 0;
let height = 0;

const upload = document.getElementById("upload");
const originalCanvas = document.getElementById("original");
const resultCanvas = document.getElementById("result");
const ctxOriginal = originalCanvas.getContext("2d");
const ctxResult = resultCanvas.getContext("2d");

const originalInspector = window.PixelInspector.create({
  canvas: originalCanvas,
  marker: document.getElementById("original-marker"),
  coordLabel: document.getElementById("original-center"),
  tableContainer: document.getElementById("original-loupe"),
  markerMode: "hover"
});

const resultInspector = window.PixelInspector.create({
  canvas: resultCanvas,
  marker: document.getElementById("result-marker"),
  coordLabel: document.getElementById("result-center"),
  tableContainer: document.getElementById("result-loupe"),
  markerMode: "hover"
});

// =========================
// [SEÇÃO 2] FUNÇÕES DE UTILIDADE E LEITURA DE IMAGEM
// =========================

function parsePGM(data) {
  const lines = data.split(/\r?\n/).filter((line) => line && !line.startsWith("#"));
  if (lines[0] !== "P2") return null;
  const [w, h] = lines[1].split(" ").map(Number);
  const max = parseInt(lines[2], 10);
  const pixels = lines.slice(3).join(" ").split(/\s+/).map(Number);
  if (pixels.length !== w * h) return null;
  return { width: w, height: h, max, pixels };
}

function drawImage(canvas, pixels, w, h) {
  canvas.width = w;
  canvas.height = h;
  const context = canvas.getContext("2d");
  const imageData = context.createImageData(w, h);
  for (let index = 0; index < w * h; index += 1) {
    const value = pixels[index];
    imageData.data[(index * 4) + 0] = value;
    imageData.data[(index * 4) + 1] = value;
    imageData.data[(index * 4) + 2] = value;
    imageData.data[(index * 4) + 3] = 255;
  }
  context.putImageData(imageData, 0, 0);
}

function clearCanvas(canvas) {
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
}

// =========================
// [SEÇÃO 3] FUNÇÕES DE TRANSFORMAÇÃO DE INTENSIDADE
// =========================

function getTransformedImage(transformFn) {
  if (!originalImage) return;
  const output = originalImage.map(transformFn);
  lastTransformedImage = output;
  drawImage(resultCanvas, output, width, height);
  resultInspector.setImage({ width, height, pixels: output });
}

function applyNegative() {
  getTransformedImage((value) => 255 - value);
}

function applyGamma() {
  const gamma = parseFloat(document.getElementById("gammaValue").value);
  if (gamma <= 0) {
    getTransformedImage((value) => value);
    return;
  }
  getTransformedImage((value) => Math.round(Math.pow(value / 255, 1 / gamma) * 255));
}

function applyLog() {
  const a = parseFloat(document.getElementById("logA").value);
  const c = 255 / Math.log(1 + 255);
  getTransformedImage((value) => {
    const result = Math.round(a * c * Math.log(value + 1));
    return Math.max(0, Math.min(255, result));
  });
}

function applyGeneral() {
  const w = parseInt(document.getElementById("generalW").value, 10);
  const a = parseInt(document.getElementById("generalA").value, 10);
  getTransformedImage((value) => {
    if (a === 0) return value < w ? 0 : 255;
    return Math.round(255 / (1 + Math.exp(-(value - w) / a)));
  });
}

function applyDynamicRange() {
  const targetValue = parseInt(document.getElementById("dynamicTarget")?.value || 255, 10);
  getTransformedImage((value) => Math.round((value / 255) * targetValue));
}

function applyLinear() {
  const a = parseFloat(document.getElementById("linearA")?.value || 1.2);
  const b = parseFloat(document.getElementById("linearB")?.value || 30);
  getTransformedImage((value) => {
    const result = Math.round((a * value) + b);
    return Math.max(0, Math.min(255, result));
  });
}

// =========================
// [SEÇÃO 4] UI DINÂMICA E EVENTOS
// =========================

upload.addEventListener("change", handleFile);

function handleFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (loadEvent) {
    const pgm = parsePGM(loadEvent.target.result);
    if (!pgm) {
      alert("Arquivo PGM inválido.");
      return;
    }
    width = pgm.width;
    height = pgm.height;
    originalImage = pgm.pixels;
    lastTransformedImage = null;
    drawImage(originalCanvas, originalImage, width, height);
    clearCanvas(resultCanvas);
    originalInspector.setImage({ width, height, pixels: originalImage });
    resultInspector.clear();
  };
  reader.readAsText(file);
}

const transformSelect = document.getElementById("transformSelect");
const inputsArea = document.getElementById("inputs-area");

const inputConfigs = {
  negative: [],
  gamma: [
    { id: "gammaValue", label: "γ", type: "number", min: 0.01, max: 5, step: 0.01, value: 0.5 }
  ],
  log: [
    { id: "logA", label: "a", type: "number", min: 0.1, step: 0.1, value: 1 }
  ],
  general: [
    { id: "generalW", label: "w", type: "number", min: 0, max: 255, value: 128 },
    { id: "generalA", label: "a (sigma)", type: "number", min: 1, max: 255, value: 25 }
  ],
  dynamic: [
    { id: "dynamicTarget", label: "Valor alvo", type: "number", min: 1, max: 255, value: 255 }
  ],
  linear: [
    { id: "linearA", label: "a", type: "number", min: 0, max: 5, step: 0.01, value: 1.2 },
    { id: "linearB", label: "b", type: "number", min: -255, max: 255, step: 1, value: 30 }
  ]
};

function renderInputs() {
  const selected = transformSelect.value;
  inputsArea.innerHTML = "";
  inputConfigs[selected].forEach((config) => {
    const label = document.createElement("label");
    label.htmlFor = config.id;
    label.textContent = config.label;
    label.style.marginLeft = "8px";
    const input = document.createElement("input");
    input.type = config.type;
    input.id = config.id;
    input.min = config.min;
    if (config.max !== undefined) input.max = config.max;
    if (config.step !== undefined) input.step = config.step;
    input.value = config.value;
    input.style.marginRight = "8px";
    inputsArea.appendChild(label);
    inputsArea.appendChild(input);
  });
}

transformSelect.addEventListener("change", renderInputs);

function applySelectedTransform() {
  const selected = transformSelect.value;
  switch (selected) {
    case "negative":
      applyNegative();
      break;
    case "gamma":
      applyGamma();
      break;
    case "log":
      applyLog();
      break;
    case "general":
      applyGeneral();
      break;
    case "dynamic":
      applyDynamicRange();
      break;
    case "linear":
      applyLinear();
      break;
  }
}

const downloadBtn = document.createElement("button");
downloadBtn.textContent = "Baixar Transformada (PGM)";
downloadBtn.className = "toolbar-download";
downloadBtn.style.marginLeft = "10px";
downloadBtn.onclick = () => {
  if (!lastTransformedImage) return;
  downloadPGM(lastTransformedImage, width, height);
};

function downloadPGM(pixels, w, h, filename = "transformada.pgm") {
  let header = `P2\n${w} ${h}\n255\n`;
  let body = "";
  for (let index = 0; index < pixels.length; index += 1) {
    body += pixels[index] + (((index + 1) % w === 0) ? "\n" : " ");
  }
  const pgm = header + body;
  const blob = new Blob([pgm], { type: "image/x-portable-graymap" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

window.addEventListener("DOMContentLoaded", () => {
  renderInputs();
  originalInspector.clear();
  resultInspector.clear();
  const toolbar = document.querySelector(".toolbar");
  if (toolbar) {
    toolbar.appendChild(downloadBtn);
  }
});

function applyNegative() {
  getTransformedImage((value) => 255 - value);
}

function applyGamma() {
  const gamma = parseFloat(document.getElementById("gammaValue").value);
  if (gamma <= 0) {
    getTransformedImage((value) => value);
    return;
  }

  getTransformedImage((value) => Math.round(Math.pow(value / 255, 1 / gamma) * 255));
}

function applyLog() {
  const a = parseFloat(document.getElementById("logA").value);
  const c = 255 / Math.log(1 + 255);

  getTransformedImage((value) => {
    const result = Math.round(a * c * Math.log(value + 1));
    return Math.max(0, Math.min(255, result));
  });
}

function applyGeneral() {
  const w = parseInt(document.getElementById("generalW").value, 10);
  const a = parseInt(document.getElementById("generalA").value, 10);

  getTransformedImage((value) => {
    if (a === 0) return value < w ? 0 : 255;
    return Math.round(255 / (1 + Math.exp(-(value - w) / a)));
  });
}

function applyDynamicRange() {
  const targetValue = parseInt(document.getElementById("dynamicTarget")?.value || 255, 10);
  getTransformedImage((value) => Math.round((value / 255) * targetValue));
}

function applyLinear() {
  const a = parseFloat(document.getElementById("linearA")?.value || 1.2);
  const b = parseFloat(document.getElementById("linearB")?.value || 30);

  getTransformedImage((value) => {
    const result = Math.round((a * value) + b);
    return Math.max(0, Math.min(255, result));
  });
}

const transformSelect = document.getElementById("transformSelect");
const inputsArea = document.getElementById("inputs-area");

const inputConfigs = {
  negative: [],
  gamma: [
    { id: "gammaValue", label: "γ", type: "number", min: 0.01, max: 5, step: 0.01, value: 0.5 }
  ],
  log: [
    { id: "logA", label: "a", type: "number", min: 0.1, step: 0.1, value: 1 }
  ],
  general: [
    { id: "generalW", label: "w", type: "number", min: 0, max: 255, value: 128 },
    { id: "generalA", label: "a (sigma)", type: "number", min: 1, max: 255, value: 25 }
  ],
  dynamic: [
    { id: "dynamicTarget", label: "Valor alvo", type: "number", min: 1, max: 255, value: 255 }
  ],
  linear: [
    { id: "linearA", label: "a", type: "number", min: 0, max: 5, step: 0.01, value: 1.2 },
    { id: "linearB", label: "b", type: "number", min: -255, max: 255, step: 1, value: 30 }
  ]
};

function renderInputs() {
  const selected = transformSelect.value;
  inputsArea.innerHTML = "";

  inputConfigs[selected].forEach((config) => {
    const label = document.createElement("label");
    label.htmlFor = config.id;
    label.textContent = config.label;
    label.style.marginLeft = "8px";

    const input = document.createElement("input");
    input.type = config.type;
    input.id = config.id;
    input.min = config.min;
    if (config.max !== undefined) input.max = config.max;
    if (config.step !== undefined) input.step = config.step;
    input.value = config.value;
    input.style.marginRight = "8px";

    inputsArea.appendChild(label);
    inputsArea.appendChild(input);
  });
}

transformSelect.addEventListener("change", renderInputs);

function applySelectedTransform() {
  const selected = transformSelect.value;

  switch (selected) {
    case "negative":
      applyNegative();
      break;
    case "gamma":
      applyGamma();
      break;
    case "log":
      applyLog();
      break;
    case "general":
      applyGeneral();
      break;
    case "dynamic":
      applyDynamicRange();
      break;
    case "linear":
      applyLinear();
      break;
  }
}

const downloadBtn = document.createElement("button");
downloadBtn.textContent = "Baixar Transformada (PGM)";
downloadBtn.className = "toolbar-download";
downloadBtn.style.marginLeft = "10px";
downloadBtn.onclick = () => {
  if (!lastTransformedImage) return;
  downloadPGM(lastTransformedImage, width, height);
};

function downloadPGM(pixels, w, h, filename = "transformada.pgm") {
  let header = `P2\n${w} ${h}\n255\n`;
  let body = "";

  for (let index = 0; index < pixels.length; index += 1) {
    body += pixels[index] + (((index + 1) % w === 0) ? "\n" : " ");
  }

  const pgm = header + body;
  const blob = new Blob([pgm], { type: "image/x-portable-graymap" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

window.addEventListener("DOMContentLoaded", () => {
  renderInputs();
  originalInspector.clear();
  resultInspector.clear();

  const toolbar = document.querySelector(".toolbar");
  if (toolbar) {
    toolbar.appendChild(downloadBtn);
  }
});

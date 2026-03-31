// =========================
// ESTADO E ELEMENTOS DA PAGINA
// =========================
let originalImage = null;
let transformedImage = null;

const uploadInput = document.getElementById("upload");
const transformSelect = document.getElementById("transformSelect");
const inputsArea = document.getElementById("inputs-area");
const applyButton = document.getElementById("applyBtn");
const downloadButton = document.getElementById("downloadBtn");
const statusText = document.getElementById("status");

const originalCanvas = document.getElementById("original");
const resultCanvas = document.getElementById("result");

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

const inputConfigs = {
  negative: [],
  gamma: [
    { id: "gammaValue", label: "gama", type: "number", min: 0.01, max: 5, step: 0.01, value: 0.5 }
  ],
  log: [
    { id: "logA", label: "a", type: "number", min: 0.1, max: 10, step: 0.1, value: 1 }
  ],
  general: [
    { id: "generalW", label: "w", type: "number", min: 0, max: 255, step: 1, value: 128 },
    { id: "generalA", label: "a", type: "number", min: 1, max: 255, step: 1, value: 25 }
  ],
  dynamic: [
    { id: "dynamicTarget", label: "alvo", type: "number", min: 1, max: 255, step: 1, value: 255 }
  ],
  linear: [
    { id: "linearA", label: "a", type: "number", min: 0, max: 5, step: 0.01, value: 1.2 },
    { id: "linearB", label: "b", type: "number", min: -255, max: 255, step: 1, value: 30 }
  ]
};

// =========================
// UTILIDADES GERAIS
// =========================
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function setStatus(message, isError = false) {
  statusText.textContent = message;
  statusText.dataset.state = isError ? "error" : "default";
}

function createImageObject(width, height, pixels) {
  return {
    width,
    height,
    pixels: Uint8ClampedArray.from(pixels)
  };
}

function normalizeToByte(value, maxValue) {
  if (maxValue <= 0) {
    return 0;
  }

  return Math.round((value / maxValue) * 255);
}

// =========================
// LEITURA DE IMAGEM
// =========================
function parsePGM(text) {
  const tokens = text.replace(/#[^\n\r]*/g, " ").trim().split(/\s+/);

  if (tokens.length < 4) {
    throw new Error("Arquivo PGM invalido.");
  }

  const type = tokens[0];
  const width = Number(tokens[1]);
  const height = Number(tokens[2]);
  const maxValue = Number(tokens[3]);

  if (type !== "P2") {
    throw new Error("O Item 3 aceita apenas PGM ASCII do tipo P2.");
  }

  if (!width || !height || !maxValue) {
    throw new Error("Cabecalho PGM invalido.");
  }

  const pixelCount = width * height;
  const rawPixels = tokens.slice(4).map(Number);

  if (rawPixels.length < pixelCount) {
    throw new Error("Arquivo PGM incompleto.");
  }

  const pixels = new Uint8ClampedArray(pixelCount);
  for (let index = 0; index < pixelCount; index += 1) {
    pixels[index] = normalizeToByte(rawPixels[index] || 0, maxValue);
  }

  return createImageObject(width, height, pixels);
}

function browserImageToGrayscale(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const image = new Image();

      image.onload = () => {
        const tempCanvas = document.createElement("canvas");
        const tempContext = tempCanvas.getContext("2d");

        tempCanvas.width = image.naturalWidth;
        tempCanvas.height = image.naturalHeight;
        tempContext.drawImage(image, 0, 0);

        const rgba = tempContext.getImageData(0, 0, tempCanvas.width, tempCanvas.height).data;
        const pixels = new Uint8ClampedArray(tempCanvas.width * tempCanvas.height);

        for (let index = 0; index < pixels.length; index += 1) {
          const offset = index * 4;
          const red = rgba[offset];
          const green = rgba[offset + 1];
          const blue = rgba[offset + 2];
          pixels[index] = Math.round((0.299 * red) + (0.587 * green) + (0.114 * blue));
        }

        resolve(createImageObject(tempCanvas.width, tempCanvas.height, pixels));
      };

      image.onerror = () => reject(new Error("Nao foi possivel interpretar a imagem enviada."));
      image.src = reader.result;
    };

    reader.onerror = () => reject(new Error("Falha ao abrir o arquivo selecionado."));
    reader.readAsDataURL(file);
  });
}

async function loadImageFromFile(file) {
  const name = file.name.toLowerCase();

  if (name.endsWith(".pgm")) {
    const text = await file.text();
    return parsePGM(text);
  }

  return browserImageToGrayscale(file);
}

// =========================
// DESENHO E ATUALIZACAO DE VIEW
// =========================
function drawImage(canvas, image) {
  canvas.width = image.width;
  canvas.height = image.height;

  const context = canvas.getContext("2d");
  const imageData = context.createImageData(image.width, image.height);

  for (let index = 0; index < image.pixels.length; index += 1) {
    const value = image.pixels[index];
    const offset = index * 4;
    imageData.data[offset] = value;
    imageData.data[offset + 1] = value;
    imageData.data[offset + 2] = value;
    imageData.data[offset + 3] = 255;
  }

  context.putImageData(imageData, 0, 0);
}

function clearCanvas(canvas) {
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
}

function resetResultArea() {
  transformedImage = null;
  clearCanvas(resultCanvas);
  resultInspector.clear();
  downloadButton.disabled = true;
}

function loadOriginalImage(image, sourceLabel) {
  originalImage = image;
  drawImage(originalCanvas, originalImage);
  originalInspector.setImage(originalImage);
  resetResultArea();
  applyButton.disabled = false;
  setStatus(`Imagem carregada com sucesso: ${sourceLabel}.`);
}

function renderInputs() {
  const configs = inputConfigs[transformSelect.value] || [];
  inputsArea.innerHTML = "";

  for (const config of configs) {
    const label = document.createElement("label");
    label.htmlFor = config.id;
    label.textContent = config.label;
    label.style.marginLeft = "8px";

    const input = document.createElement("input");
    input.type = config.type;
    input.id = config.id;
    input.min = String(config.min);
    if (config.max !== undefined) input.max = String(config.max);
    if (config.step !== undefined) input.step = String(config.step);
    input.value = String(config.value);
    input.style.marginRight = "8px";

    inputsArea.appendChild(label);
    inputsArea.appendChild(input);
  }
}

function applyTransform(transformFn) {
  if (!originalImage) {
    setStatus("Carregue uma imagem antes de transformar.", true);
    return;
  }

  const outputPixels = new Uint8ClampedArray(originalImage.pixels.length);

  for (let index = 0; index < originalImage.pixels.length; index += 1) {
    const transformedValue = transformFn(originalImage.pixels[index]);
    outputPixels[index] = clamp(Math.round(transformedValue), 0, 255);
  }

  transformedImage = createImageObject(originalImage.width, originalImage.height, outputPixels);
  drawImage(resultCanvas, transformedImage);
  resultInspector.setImage(transformedImage);
  downloadButton.disabled = false;
  setStatus("Transformacao aplicada com sucesso.");
}

// =========================
// TRANSFORMACAO: NEGATIVO
// =========================
function applyNegative() {
  applyTransform((value) => 255 - value);
}

// =========================
// TRANSFORMACAO: GAMMA
// =========================
function applyGamma() {
  const gamma = parseFloat(document.getElementById("gammaValue").value);

  if (!Number.isFinite(gamma) || gamma <= 0) {
    setStatus("Informe um valor de gama maior que zero.", true);
    return;
  }

  applyTransform((value) => Math.pow(value / 255, 1 / gamma) * 255);
}

// =========================
// TRANSFORMACAO: LOGARITMO
// =========================
function applyLog() {
  const a = parseFloat(document.getElementById("logA").value);

  if (!Number.isFinite(a) || a <= 0) {
    setStatus("Informe um valor valido para o parametro a.", true);
    return;
  }

  const c = 255 / Math.log(256);
  applyTransform((value) => a * c * Math.log(value + 1));
}

// =========================
// TRANSFORMACAO: TRANSFERENCIA GERAL
// =========================
function applyGeneral() {
  const w = parseFloat(document.getElementById("generalW").value);
  const a = parseFloat(document.getElementById("generalA").value);

  if (!Number.isFinite(w) || !Number.isFinite(a) || a === 0) {
    setStatus("Os parametros da transferencia geral precisam ser validos e diferentes de zero.", true);
    return;
  }

  applyTransform((value) => 255 / (1 + Math.exp(-(value - w) / a)));
}

// =========================
// TRANSFORMACAO: FAIXA DINAMICA
// =========================
function applyDynamicRange() {
  const targetValue = parseFloat(document.getElementById("dynamicTarget").value);

  if (!Number.isFinite(targetValue) || targetValue <= 0) {
    setStatus("Informe um valor alvo maior que zero.", true);
    return;
  }

  let minPixel = 255;
  let maxPixel = 0;

  for (const pixel of originalImage.pixels) {
    if (pixel < minPixel) minPixel = pixel;
    if (pixel > maxPixel) maxPixel = pixel;
  }

  if (maxPixel === minPixel) {
    applyTransform(() => targetValue);
    return;
  }

  applyTransform((value) => ((value - minPixel) / (maxPixel - minPixel)) * targetValue);
}

// =========================
// TRANSFORMACAO: LINEAR
// =========================
function applyLinear() {
  const a = parseFloat(document.getElementById("linearA").value);
  const b = parseFloat(document.getElementById("linearB").value);

  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    setStatus("Informe valores validos para a transformacao linear.", true);
    return;
  }

  applyTransform((value) => (a * value) + b);
}

function applySelectedTransform() {
  const handlers = {
    negative: applyNegative,
    gamma: applyGamma,
    log: applyLog,
    general: applyGeneral,
    dynamic: applyDynamicRange,
    linear: applyLinear
  };

  const handler = handlers[transformSelect.value];
  if (!handler) {
    setStatus("Transformacao selecionada nao esta disponivel.", true);
    return;
  }

  handler();
}

// =========================
// DOWNLOAD
// =========================
function downloadPGM(image) {
  let body = "";

  for (let index = 0; index < image.pixels.length; index += 1) {
    body += image.pixels[index];
    body += (index + 1) % image.width === 0 ? "\n" : " ";
  }

  const pgmText = `P2\n${image.width} ${image.height}\n255\n${body}`;
  const blob = new Blob([pgmText], { type: "image/x-portable-graymap" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "transformada.pgm";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// =========================
// EVENTOS
// =========================
async function handleUpload(event) {
  const file = event.target.files && event.target.files[0];

  if (!file) {
    return;
  }

  try {
    const image = await loadImageFromFile(file);
    loadOriginalImage(image, file.name);
  } catch (error) {
    setStatus(`Erro ao carregar arquivo: ${error.message}`, true);
  }
}

uploadInput.addEventListener("change", handleUpload);
transformSelect.addEventListener("change", renderInputs);
applyButton.addEventListener("click", applySelectedTransform);
downloadButton.addEventListener("click", () => {
  if (!transformedImage) {
    setStatus("Aplique uma transformacao antes de baixar.", true);
    return;
  }

  downloadPGM(transformedImage);
});

window.addEventListener("DOMContentLoaded", () => {
  renderInputs();
  originalInspector.clear();
  resultInspector.clear();
  applyButton.disabled = true;
  downloadButton.disabled = true;
  setStatus("Carregue uma imagem PGM, PNG, JPG ou BMP para iniciar.");
});

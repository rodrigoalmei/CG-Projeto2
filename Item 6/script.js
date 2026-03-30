const originalCanvas = document.getElementById("originalCanvas");
const resultCanvas = document.getElementById("resultCanvas");
const originalCtx = originalCanvas.getContext("2d");
const resultCtx = resultCanvas.getContext("2d");

const originalMeta = document.getElementById("originalMeta");
const resultMeta = document.getElementById("resultMeta");
const imageModeLabel = document.getElementById("imageMode");
const currentTransformLabel = document.getElementById("currentTransform");
const statusText = document.getElementById("statusText");

const imageInput = document.getElementById("imageInput");
const sampleSelect = document.getElementById("sampleSelect");
const loadSelectedSampleButton = document.getElementById("loadSelectedSample");
const loadGraySampleButton = document.getElementById("loadGraySample");
const loadGrayAltSampleButton = document.getElementById("loadGrayAltSample");
const loadAirplaneSampleButton = document.getElementById("loadAirplaneSample");
const useResultAsBaseCheckbox = document.getElementById("useResultAsBase");
const resetControlsButton = document.getElementById("resetControls");
const promoteResultButton = document.getElementById("promoteResult");
const resetResultButton = document.getElementById("resetResult");
const clearCanvasesButton = document.getElementById("clearCanvases");

let baseImage = null;
let resultImage = null;
let originalSnapshot = null;

const viewers = {
  original: {
    canvas: originalCanvas,
    context: originalCtx,
    meta: originalMeta,
    marker: document.getElementById("originalMarker"),
    coordLabel: document.getElementById("originalCoordLabel"),
    pixelTable: document.getElementById("originalPixelTable"),
    state: { pos: { x: 0, y: 0 }, hover: null }
  },
  result: {
    canvas: resultCanvas,
    context: resultCtx,
    meta: resultMeta,
    marker: document.getElementById("resultMarker"),
    coordLabel: document.getElementById("resultCoordLabel"),
    pixelTable: document.getElementById("resultPixelTable"),
    state: { pos: { x: 0, y: 0 }, hover: null }
  }
};

const sampleAssets = {
  lena: { label: "lena.pgm", path: "./assets/lena.pgm", kind: "portable" },
  lenag: { label: "Lenag.pgm", path: "./assets/Lenag.pgm", kind: "portable" },
  lenasalp: { label: "Lenasalp.pgm", path: "./assets/Lenasalp.pgm", kind: "portable" },
  airplane: { label: "Airplane.pgm", path: "./assets/Airplane.pgm", kind: "portable" },
};

const defaultControlValues = {
  scaleX: 1.5,
  scaleY: 1.5,
  translateX: 50,
  translateY: 50,
  shearX: 0.5,
  shearY: 0,
  rotation: 45,
  reflectionAxis: "x",
  useResultAsBase: false,
  sampleSelect: "lena"
};

// Cria o objeto-padrão usado pela aplicação para representar uma imagem.
// Os pixels são mantidos em vetor linear para facilitar o processamento manual.
function createImageObject(width, height, pixels, mode = "grayscale", label = "Imagem", type = "P2") {
  return { width, height, pixels, mode, label, type };
}

// Gera uma cópia independente da imagem atual.
// Isso evita alterar acidentalmente a matriz usada como referência.
function cloneImage(image) {
  return createImageObject(
    image.width,
    image.height,
    new Uint8ClampedArray(image.pixels),
    image.mode,
    image.label,
    image.type
  );
}

function clearCanvas(canvas, context) {
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
}

function describeMode(mode) {
  return mode === "binary" ? "Imagem binária" : "Imagem em níveis de cinza";
}

function detectMode(pixels) {
  for (let index = 0; index < pixels.length; index += 1) {
    const value = pixels[index];
    if (value !== 0 && value !== 255) {
      return "grayscale";
    }
  }
  return "binary";
}

function setPixel(pixels, width, x, y, value) {
  pixels[y * width + x] = value;
}

// Define a imagem base mostrada à esquerda.
// O primeiro carregamento também vira o "snapshot" usado para restauração.
function setBaseImage(image, preserveOriginal = false) {
  baseImage = cloneImage(image);

  if (!preserveOriginal || !originalSnapshot) {
    originalSnapshot = cloneImage(image);
  }

  drawViewerImage(baseImage, viewers.original, "Imagem original");
  updateSummary();
}

function setResultImage(image, operationName) {
  resultImage = cloneImage(image);
  resultImage.lastOperation = operationName;
  drawViewerImage(resultImage, viewers.result, "Imagem transformada");
  updateSummary();
}

function updateSummary() {
  imageModeLabel.textContent = baseImage ? describeMode(baseImage.mode) : "Nenhum";
  currentTransformLabel.textContent = resultImage?.lastOperation || "Nenhuma";
}

// Desenha a imagem no canvas e reinicializa a lupa de pixels no centro.
// O canvas é apenas a superfície de exibição; a transformação é feita nos vetores.
function drawViewerImage(image, viewer, emptyLabel) {
  if (!image) {
    clearCanvas(viewer.canvas, viewer.context);
    viewer.meta.textContent = emptyLabel;
    viewer.coordLabel.textContent = "Centro: [ - , - ]";
    viewer.pixelTable.innerHTML = "";
    viewer.marker.style.display = "none";
    return;
  }

  viewer.canvas.width = image.width;
  viewer.canvas.height = image.height;

  const imageData = viewer.context.createImageData(image.width, image.height);
  for (let index = 0; index < image.pixels.length; index += 1) {
    const value = image.pixels[index];
    const offset = index * 4;
    imageData.data[offset] = value;
    imageData.data[offset + 1] = value;
    imageData.data[offset + 2] = value;
    imageData.data[offset + 3] = 255;
  }

  viewer.context.putImageData(imageData, 0, 0);
  viewer.meta.textContent = `${image.width} x ${image.height} px`;

  viewer.state.pos = {
    x: Math.floor(image.width / 2),
    y: Math.floor(image.height / 2)
  };
  viewer.state.hover = null;

  renderPixelInspector(image, viewer);
}

// Monta a tabela 15x15 de vizinhança ao redor do pixel selecionado.
// Isso replica a ideia do projeto-base para facilitar a inspeção do resultado.
function renderPixelInspector(image, viewer) {
  if (!image) {
    viewer.coordLabel.textContent = "Centro: [ - , - ]";
    viewer.pixelTable.innerHTML = "";
    return;
  }

  const { x: centerX, y: centerY } = viewer.state.pos;
  viewer.coordLabel.textContent = `Centro: [ ${centerX}, ${centerY} ]`;

  const radius = 7;
  const startX = centerX - radius;
  const startY = centerY - radius;

  let html = '<table class="pixel-grid"><thead><tr>';
  html += '<th>X→<br>Y↓</th>';

  for (let j = 0; j < 15; j += 1) {
    const x = startX + j;
    html += `<th>${x >= 0 && x < image.width ? x : ""}</th>`;
  }

  html += "</tr></thead><tbody>";

  for (let i = 0; i < 15; i += 1) {
    const y = startY + i;
    const validY = y >= 0 && y < image.height;
    html += `<tr><th>${validY ? y : ""}</th>`;

    for (let j = 0; j < 15; j += 1) {
      const x = startX + j;
      const out = !validY || x < 0 || x >= image.width;
      const value = out ? "-" : Math.round(image.pixels[y * image.width + x]);
      const isCenter = x === centerX && y === centerY;
      const isHover = viewer.state.hover && viewer.state.hover.x === x && viewer.state.hover.y === y;

      let className = "";
      if (out) className = "outside";
      if (isCenter) className = "center";
      if (isHover) className = "hovered";

      html += `<td class="${className}">${value}</td>`;
    }

    html += "</tr>";
  }

  html += "</tbody></table>";
  viewer.pixelTable.innerHTML = html;
}

// Posiciona o marcador visual sobre o pixel atualmente destacado pela lupa.
function updateMarkerPosition(image, viewer, point) {
  if (!image || !point) {
    viewer.marker.style.display = "none";
    return;
  }

  const rect = viewer.canvas.getBoundingClientRect();
  const markerWidth = Math.max(rect.width / image.width, 8);
  const markerHeight = Math.max(rect.height / image.height, 8);
  const left = (point.x / image.width) * rect.width;
  const top = (point.y / image.height) * rect.height;

  viewer.marker.style.display = "block";
  viewer.marker.style.width = `${markerWidth}px`;
  viewer.marker.style.height = `${markerHeight}px`;
  viewer.marker.style.left = `${left - markerWidth / 2}px`;
  viewer.marker.style.top = `${top - markerHeight / 2}px`;
}

// Liga eventos de mouse ao canvas para hover e clique.
// O clique redefine o centro da lupa e o hover atualiza a pré-visualização.
function attachViewerInteractions(imageGetter, viewer) {
  viewer.canvas.addEventListener("mousemove", (event) => {
    const image = imageGetter();
    if (!image) return;

    const rect = viewer.canvas.getBoundingClientRect();
    const scaleX = image.width / rect.width;
    const scaleY = image.height / rect.height;
    const x = Math.floor((event.clientX - rect.left) * scaleX);
    const y = Math.floor((event.clientY - rect.top) * scaleY);

    if (x >= 0 && x < image.width && y >= 0 && y < image.height) {
      viewer.state.hover = { x, y };
      updateMarkerPosition(image, viewer, viewer.state.hover);
      renderPixelInspector(image, viewer);
    } else {
      viewer.state.hover = null;
      updateMarkerPosition(image, viewer, null);
      renderPixelInspector(image, viewer);
    }
  });

  viewer.canvas.addEventListener("mouseleave", () => {
    const image = imageGetter();
    viewer.state.hover = null;
    updateMarkerPosition(image, viewer, null);
    renderPixelInspector(image, viewer);
  });

  viewer.canvas.addEventListener("click", () => {
    const image = imageGetter();
    if (!image || !viewer.state.hover) return;

    viewer.state.pos = { ...viewer.state.hover };
    renderPixelInspector(image, viewer);
  });
}

function normalizeValue(value, maxValue) {
  if (maxValue <= 0) return 0;
  return Math.round((value / maxValue) * 255);
}

// Faz o parse manual de imagens portáteis P1/P2.
// Não usa bibliotecas prontas.
function parsePortableImage(arrayBuffer, label) {
  const bytes = new Uint8Array(arrayBuffer);
  const decoder = new TextDecoder("ascii");
  let cursor = 0;

  function readToken() {
    while (cursor < bytes.length) {
      const char = String.fromCharCode(bytes[cursor]);

      if (char === "#") {
        while (cursor < bytes.length && String.fromCharCode(bytes[cursor]) !== "\n") {
          cursor += 1;
        }
      } else if (/\s/.test(char)) {
        cursor += 1;
      } else {
        break;
      }
    }

    let token = "";
    while (cursor < bytes.length) {
      const char = String.fromCharCode(bytes[cursor]);
      if (/\s/.test(char) || char === "#") break;
      token += char;
      cursor += 1;
    }
    return token;
  }

  const magic = readToken();
  const width = Number(readToken());
  const height = Number(readToken());
  if (!magic || !width || !height) throw new Error("Cabeçalho inválido.");

  let maxValue = 1;
  if (magic === "P2" || magic === "P5") {
    maxValue = Number(readToken());
  }

  while (cursor < bytes.length && /\s/.test(String.fromCharCode(bytes[cursor]))) {
    cursor += 1;
  }

  const pixels = new Uint8ClampedArray(width * height);

  if (magic === "P1") {
    const textLines = decoder
      .decode(bytes.slice(cursor))
      .replace(/\r/g, "")
      .split("\n")
      .map((line) => line.replace(/#.*/, "").trim())
      .filter((line) => line.length > 0);

    const values = [];
    for (const line of textLines) {
      if (line.includes(" ")) {
        line.split(/\s+/).forEach((token) => {
          if (token !== "") values.push(Number(token));
        });
      } else {
        line.split("").forEach((char) => values.push(Number(char)));
      }
    }

    for (let index = 0; index < pixels.length; index += 1) {
      pixels[index] = values[index] === 1 ? 0 : 255;
    }
  } else if (magic === "P2") {
    const values = decoder
      .decode(bytes.slice(cursor))
      .replace(/#[^\n\r]*/g, " ")
      .trim()
      .split(/\s+/)
      .map(Number);

    for (let index = 0; index < pixels.length; index += 1) {
      pixels[index] = normalizeValue(values[index] || 0, maxValue);
    }
  } else {
    throw new Error("Para o Item 6, use P1/P2 ou imagens comuns.");
  }

  return createImageObject(width, height, pixels, detectMode(pixels), label, magic === "P1" ? "P1" : "P2");
}

// Converte imagens comuns carregadas pelo navegador para tons de cinza.
// A leitura dos pixels é feita via canvas, mas a transformação continua manual.
function convertBrowserImage(imageElement, label, options = {}) {
  const { forceBinary = false, threshold = 127 } = options;
  const tempCanvas = document.createElement("canvas");
  const tempContext = tempCanvas.getContext("2d");

  tempCanvas.width = imageElement.naturalWidth;
  tempCanvas.height = imageElement.naturalHeight;
  tempContext.drawImage(imageElement, 0, 0);

  const source = tempContext.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
  const pixels = new Uint8ClampedArray(tempCanvas.width * tempCanvas.height);

  for (let index = 0; index < pixels.length; index += 1) {
    const offset = index * 4;
    const red = source.data[offset];
    const green = source.data[offset + 1];
    const blue = source.data[offset + 2];
    const gray = Math.round(0.299 * red + 0.587 * green + 0.114 * blue);
    pixels[index] = forceBinary ? (gray < threshold ? 0 : 255) : gray;
  }

  return createImageObject(
    tempCanvas.width,
    tempCanvas.height,
    pixels,
    forceBinary ? "binary" : detectMode(pixels),
    label,
    forceBinary ? "P1" : "P2"
  );
}

// Decide qual rotina usar no upload:
// PGM/PBM passam pelo parser textual; outras imagens passam pela conversão em canvas.
function readUploadedFile(file) {
  const extension = file.name.split(".").pop().toLowerCase();

  if (["pgm", "pbm"].includes(extension)) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        loadNewImage(parsePortableImage(reader.result, file.name));
      } catch (error) {
        statusText.textContent = `Não foi possível ler o arquivo: ${error.message}`;
      }
    };
    reader.readAsArrayBuffer(file);
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const imageElement = new Image();
    imageElement.onload = () => loadNewImage(convertBrowserImage(imageElement, file.name));
    imageElement.src = reader.result;
  };
  reader.readAsDataURL(file);
}

// Carrega uma das imagens disponibilizadas na pasta assets.
async function loadSample(sampleKey) {
  const sample = sampleAssets[sampleKey];
  if (!sample) return;

  try {
    if (sample.kind === "portable") {
      const response = await fetch(sample.path);
      const buffer = await response.arrayBuffer();
      loadNewImage(parsePortableImage(buffer, sample.label));
      return;
    }

    const response = await fetch(sample.path);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const imageElement = new Image();
    imageElement.onload = () => {
      loadNewImage(convertBrowserImage(imageElement, sample.label, { forceBinary: sample.forceBinary }));
      URL.revokeObjectURL(url);
    };
    imageElement.src = url;
  } catch (error) {
    statusText.textContent = `Falha ao carregar o exemplo local: ${error.message}`;
  }
}

// Reseta o resultado transformado quando uma nova imagem é carregada.
function loadNewImage(image) {
  setBaseImage(image);
  resultImage = null;
  drawViewerImage(null, viewers.result, "Aguardando processamento");
  currentTransformLabel.textContent = "Nenhuma";
  statusText.textContent = `Imagem carregada: ${image.label}. Tipo detectado: ${describeMode(image.mode)}.`;
}

function getWorkingImage() {
  if (!baseImage) {
    statusText.textContent = "Carregue ou gere uma imagem antes de aplicar uma transformação.";
    return null;
  }
  return useResultAsBaseCheckbox.checked && resultImage ? resultImage : baseImage;
}

// Vizinho mais próximo.
// Se o mapeamento cair fora da imagem, retorna fundo preto (0).
function getNearestPixel(image, x, y, background = 0) {
  const px = Math.round(x);
  const py = Math.round(y);

  if (px < 0 || px >= image.width || py < 0 || py >= image.height) {
    return background;
  }
  return image.pixels[py * image.width + px];
}

// Interpolação bilinear usada somente na rotação.
// Ela combina os 4 vizinhos mais próximos para reduzir serrilhado no giro.
function getBilinearPixel(image, x, y, background = 0) {
  if (x < 0 || x >= image.width - 1 || y < 0 || y >= image.height - 1) {
    return background;
  }

  const x1 = Math.floor(x);
  const y1 = Math.floor(y);
  const x2 = x1 + 1;
  const y2 = y1 + 1;
  const dx = x - x1;
  const dy = y - y1;

  const p11 = image.pixels[y1 * image.width + x1];
  const p21 = image.pixels[y1 * image.width + x2];
  const p12 = image.pixels[y2 * image.width + x1];
  const p22 = image.pixels[y2 * image.width + x2];

  const r1 = p11 * (1 - dx) + p21 * dx;
  const r2 = p12 * (1 - dx) + p22 * dx;
  return Math.round(r1 * (1 - dy) + r2 * dy);
}

// 1. Translação
// Implementada por mapeamento inverso: cada pixel de destino busca sua origem em (x - dx, y - dy).
function translation(image, dx, dy) {
  const result = new Uint8ClampedArray(image.width * image.height);
  result.fill(0);

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const srcX = x - dx;
      const srcY = y - dy;
      setPixel(result, image.width, x, y, getNearestPixel(image, srcX, srcY, 0));
    }
  }

  return createImageObject(image.width, image.height, result, image.mode, image.label, image.type);
}

// 2. Escala
// Recalcula o tamanho de saída e usa mapeamento inverso dividindo pelas escalas sx e sy.
function scale(image, sx, sy) {
  if (sx === 0 || sy === 0) {
    throw new Error("Os fatores de escala não podem ser zero.");
  }

  const newWidth = Math.max(1, Math.round(image.width * sx));
  const newHeight = Math.max(1, Math.round(image.height * sy));
  const result = new Uint8ClampedArray(newWidth * newHeight);
  result.fill(0);

  for (let y = 0; y < newHeight; y += 1) {
    for (let x = 0; x < newWidth; x += 1) {
      const srcX = x / sx;
      const srcY = y / sy;
      setPixel(result, newWidth, x, y, getNearestPixel(image, srcX, srcY, 0));
    }
  }

  return createImageObject(newWidth, newHeight, result, image.mode, image.label, image.type);
}

// 3. Reflexão
// Espelha a imagem em torno de um único eixo, exatamente como no projeto-base.
function reflection(image, axis = "x") {
  const result = new Uint8ClampedArray(image.width * image.height);

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const srcX = axis === "x" ? image.width - 1 - x : x;
      const srcY = axis === "y" ? image.height - 1 - y : y;
      setPixel(result, image.width, x, y, getNearestPixel(image, srcX, srcY, 0));
    }
  }

  return createImageObject(image.width, image.height, result, image.mode, image.label, image.type);
}

// 4. Cisalhamento
// O cálculo é feito em torno do centro e usa aritmética modular para produzir o efeito cilíndrico.
function shear(image, cx, cy) {
  const result = new Uint8ClampedArray(image.width * image.height);
  const halfW = image.width / 2;
  const halfH = image.height / 2;

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const dx = x - halfW;
      const dy = y - halfH;

      let srcX = dx + cx * dy;
      let srcY = dy + cy * dx;

      srcX = Math.round(srcX + halfW);
      srcY = Math.round(srcY + halfH);

      srcX = ((srcX % image.width) + image.width) % image.width;
      srcY = ((srcY % image.height) + image.height) % image.height;

      setPixel(result, image.width, x, y, image.pixels[Math.floor(srcY) * image.width + Math.floor(srcX)]);
    }
  }

  return createImageObject(image.width, image.height, result, image.mode, image.label, image.type);
}

// 5. Rotação
// Usa o mesmo zoomFactor do projeto-base para manter o conteúdo no quadro e bilinear para amostragem.
function rotation(image, angle) {
  const radians = angle * (Math.PI / 180);
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const centerX = (image.width - 1) / 2;
  const centerY = (image.height - 1) / 2;
  const zoomFactor = Math.abs(cosine) + Math.abs(sine);
  const result = new Uint8ClampedArray(image.width * image.height);
  result.fill(0);

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const dx = x - centerX;
      const dy = y - centerY;
      const zoomedDx = dx / zoomFactor;
      const zoomedDy = dy / zoomFactor;

      const srcX = (zoomedDx * cosine) - (zoomedDy * sine) + centerX;
      const srcY = (zoomedDx * sine) + (zoomedDy * cosine) + centerY;
      const value = getBilinearPixel(image, srcX, srcY, 0);

      setPixel(result, image.width, x, y, value);
    }
  }

  return createImageObject(image.width, image.height, result, image.mode, image.label, image.type);
}

// Centraliza a leitura dos parâmetros da interface e aplica a transformação escolhida.
function applyTransformation(type) {
  const sourceImage = getWorkingImage();
  if (!sourceImage) return;

  let transformedImage = null;
  let operationName = "";

  if (type === "translate") {
    const tx = Number(document.getElementById("translateX").value);
    const ty = Number(document.getElementById("translateY").value);
    transformedImage = translation(sourceImage, tx, ty);
    operationName = `Translação (tx=${tx}, ty=${ty})`;
  }

  if (type === "scale") {
    const sx = Number(document.getElementById("scaleX").value);
    const sy = Number(document.getElementById("scaleY").value);
    transformedImage = scale(sourceImage, sx, sy);
    operationName = `Escala (sx=${sx}, sy=${sy})`;
  }

  if (type === "reflect") {
    const axis = document.getElementById("reflectionAxis").value;
    transformedImage = reflection(sourceImage, axis);
    operationName = `Reflexão (${axis === "x" ? "Horizontal / eixo X" : "Vertical / eixo Y"})`;
  }

  if (type === "shear") {
    const cx = Number(document.getElementById("shearX").value);
    const cy = Number(document.getElementById("shearY").value);
    transformedImage = shear(sourceImage, cx, cy);
    operationName = `Cisalhamento (cx=${cx}, cy=${cy})`;
  }

  if (type === "rotate") {
    const angle = Number(document.getElementById("rotation").value);
    transformedImage = rotation(sourceImage, angle);
    operationName = `Rotação (${angle}°)`;
  }

  if (!transformedImage) return;

  transformedImage.label = `${sourceImage.label} - ${operationName}`;
  setResultImage(transformedImage, operationName);
  statusText.textContent = `${operationName} aplicada com a mesma lógica matemática do projeto-base em transformações geométricas.`;
}

// Recupera a primeira imagem carregada, descartando a cadeia atual de testes.
function resetToOriginal() {
  if (!originalSnapshot) {
    statusText.textContent = "Ainda não existe uma imagem original para restaurar.";
    return;
  }

  setBaseImage(originalSnapshot, true);
  resultImage = null;
  drawViewerImage(null, viewers.result, "Aguardando processamento");
  currentTransformLabel.textContent = "Nenhuma";
  statusText.textContent = "A imagem original foi restaurada.";
  updateSummary();
}

// Promove a imagem transformada atual para virar a nova base de comparação.
function promoteResultToBase() {
  if (!resultImage) {
    statusText.textContent = "Gere um resultado antes de promovê-lo para imagem original.";
    return;
  }

  setBaseImage(resultImage);
  resultImage = null;
  drawViewerImage(null, viewers.result, "Aguardando processamento");
  currentTransformLabel.textContent = "Nenhuma";
  statusText.textContent = "O resultado atual passou a ser a nova imagem original.";
  updateSummary();
}

// Limpa toda a interface para começar um novo teste do zero.
function clearAll() {
  baseImage = null;
  resultImage = null;
  originalSnapshot = null;

  drawViewerImage(null, viewers.original, "Nenhuma imagem carregada");
  drawViewerImage(null, viewers.result, "Aguardando processamento");
  originalMeta.textContent = "Nenhuma imagem carregada";
  resultMeta.textContent = "Aguardando processamento";
  imageModeLabel.textContent = "Nenhum";
  currentTransformLabel.textContent = "Nenhuma";
  statusText.textContent = "Tudo foi limpo. Carregue uma imagem ou use um dos exemplos locais do Item 6.";
  imageInput.value = "";
}

// Restaura os valores iniciais dos campos de transformação sem recarregar a página.
function resetControlsToDefault() {
  document.getElementById("scaleX").value = defaultControlValues.scaleX;
  document.getElementById("scaleY").value = defaultControlValues.scaleY;
  document.getElementById("translateX").value = defaultControlValues.translateX;
  document.getElementById("translateY").value = defaultControlValues.translateY;
  document.getElementById("shearX").value = defaultControlValues.shearX;
  document.getElementById("shearY").value = defaultControlValues.shearY;
  document.getElementById("rotation").value = defaultControlValues.rotation;
  document.getElementById("reflectionAxis").value = defaultControlValues.reflectionAxis;
  useResultAsBaseCheckbox.checked = defaultControlValues.useResultAsBase;
  sampleSelect.value = defaultControlValues.sampleSelect;
  statusText.textContent = "Os valores padrão dos controles foram restaurados.";
}

document.querySelectorAll("[data-transform]").forEach((button) => {
  button.addEventListener("click", () => {
    try {
      applyTransformation(button.dataset.transform);
    } catch (error) {
      statusText.textContent = `Falha ao aplicar a transformação: ${error.message}`;
    }
  });
});

imageInput.addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (file) readUploadedFile(file);
});

loadSelectedSampleButton.addEventListener("click", () => loadSample(sampleSelect.value));
loadGraySampleButton.addEventListener("click", () => loadSample("lena"));
loadGrayAltSampleButton.addEventListener("click", () => loadSample("lenag"));
loadAirplaneSampleButton.addEventListener("click", () => loadSample("airplane"));

resetControlsButton.addEventListener("click", resetControlsToDefault);
promoteResultButton.addEventListener("click", promoteResultToBase);
resetResultButton.addEventListener("click", resetToOriginal);
clearCanvasesButton.addEventListener("click", clearAll);

attachViewerInteractions(() => baseImage, viewers.original);
attachViewerInteractions(() => resultImage, viewers.result);

clearAll();
resetControlsToDefault();
loadSample("lena");

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
const loadGraySampleButton = document.getElementById("loadGraySample");
const loadBinarySampleButton = document.getElementById("loadBinarySample");
const loadBinaryJpegSampleButton = document.getElementById("loadBinaryJpegSample");
const useResultAsBaseCheckbox = document.getElementById("useResultAsBase");
const resetControlsButton = document.getElementById("resetControls");
const promoteResultButton = document.getElementById("promoteResult");
const resetResultButton = document.getElementById("resetResult");
const clearCanvasesButton = document.getElementById("clearCanvases");

/*
  Esta estrutura representa a imagem em memória.
  A matriz de pixels é linear para facilitar cópia, transformação e renderização.
*/
let baseImage = null;
let resultImage = null;
let originalSnapshot = null;

const sampleAssets = {
  gray: {
    label: "Lena PGM",
    path: "./assets/lena.pgm",
    kind: "portable"
  },
  binary: {
    label: "Fingerprint PBM",
    path: "./assets/fingerprint.pbm",
    kind: "portable"
  },
  binaryJpeg: {
    label: "Imagem binária JPEG",
    path: "./assets/imagem-binaria.jpeg",
    kind: "browser",
    forceBinary: true
  }
};

const defaultControlValues = {
  scaleX: 1.2,
  scaleY: 1.2,
  translateX: 60,
  translateY: 40,
  shearX: 0.35,
  shearY: 0,
  rotation: 30,
  reflectX: false,
  reflectY: false,
  useResultAsBase: false
};

function createImageObject(width, height, pixels, mode = "grayscale", label = "Imagem", type = "P2") {
  return {
    width,
    height,
    pixels,
    mode,
    label,
    type
  };
}

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

/*
  O canvas é usado apenas como superfície de desenho.
  O cálculo das transformações é feito manualmente em JavaScript.
*/
function drawImageOnCanvas(image, canvas, context, metaElement, caption) {
  if (!image) {
    clearCanvas(canvas, context);
    metaElement.textContent = caption;
    return;
  }

  canvas.width = image.width;
  canvas.height = image.height;

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
  metaElement.textContent = `${image.width} x ${image.height} px`;
}

function clearCanvas(canvas, context) {
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
}

function describeMode(mode) {
  return mode === "binary" ? "Imagem binária" : "Imagem em níveis de cinza";
}

function updateSummary() {
  imageModeLabel.textContent = baseImage ? describeMode(baseImage.mode) : "Nenhum";
  currentTransformLabel.textContent = resultImage?.lastOperation || "Nenhuma";
}

function setBaseImage(image, preserveOriginal = false) {
  baseImage = cloneImage(image);

  if (!preserveOriginal || !originalSnapshot) {
    originalSnapshot = cloneImage(image);
  }

  drawImageOnCanvas(baseImage, originalCanvas, originalCtx, originalMeta, "Imagem original");
  updateSummary();
}

function setResultImage(image, operationName) {
  resultImage = cloneImage(image);
  resultImage.lastOperation = operationName;
  drawImageOnCanvas(resultImage, resultCanvas, resultCtx, resultMeta, "Imagem transformada");
  updateSummary();
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

function getNearestPixel(image, x, y, background = 255) {
  const px = Math.round(x);
  const py = Math.round(y);

  if (px < 0 || px >= image.width || py < 0 || py >= image.height) {
    return background;
  }

  return image.pixels[py * image.width + px];
}

function normalizeValue(value, maxValue) {
  if (maxValue <= 0) {
    return 0;
  }

  return Math.round((value / maxValue) * 255);
}

/*
  Faz o parse manual dos formatos P1, P2, P4 e P5.
  Isso permite usar as imagens disponibilizadas sem bibliotecas externas.
*/
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
      if (/\s/.test(char) || char === "#") {
        break;
      }
      token += char;
      cursor += 1;
    }

    return token;
  }

  const magic = readToken();
  const width = Number(readToken());
  const height = Number(readToken());

  if (!magic || !width || !height) {
    throw new Error("Cabeçalho inválido.");
  }

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

    /*
      No formato P1 os valores podem vir separados por espaço
      ou "colados" em sequência na mesma linha. Por isso,
      tratamos os dois casos manualmente.
    */
    for (const line of textLines) {
      if (line.includes(" ")) {
        line.split(/\s+/).forEach((token) => {
          if (token !== "") values.push(Number(token));
        });
      } else {
        line.split("").forEach((char) => {
          values.push(Number(char));
        });
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
  } else if (magic === "P4") {
    let byteIndex = cursor;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 8) {
        const currentByte = bytes[byteIndex];
        byteIndex += 1;

        for (let bit = 0; bit < 8 && x + bit < width; bit += 1) {
          const mask = 1 << (7 - bit);
          const value = (currentByte & mask) !== 0 ? 0 : 255;
          setPixel(pixels, width, x + bit, y, value);
        }
      }
    }
  } else if (magic === "P5") {
    if (maxValue > 255) {
      for (let index = 0; index < pixels.length; index += 1) {
        const high = bytes[cursor + index * 2];
        const low = bytes[cursor + index * 2 + 1];
        pixels[index] = normalizeValue((high << 8) | low, maxValue);
      }
    } else {
      for (let index = 0; index < pixels.length; index += 1) {
        pixels[index] = normalizeValue(bytes[cursor + index], maxValue);
      }
    }
  } else {
    throw new Error("Formato não suportado. Use P1, P2, P4, P5 ou imagens comuns do navegador.");
  }

  return createImageObject(width, height, pixels, detectMode(pixels), label, magic === "P1" || magic === "P4" ? "P1" : "P2");
}

/*
  Converte imagens comuns em níveis de cinza.
  Se forceBinary for verdadeiro, aplica limiar e gera uma imagem binária.
*/
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

  const mode = forceBinary ? "binary" : detectMode(pixels);
  const type = forceBinary ? "P1" : "P2";

  return createImageObject(tempCanvas.width, tempCanvas.height, pixels, mode, label, type);
}

function readUploadedFile(file) {
  const extension = file.name.split(".").pop().toLowerCase();

  if (["pgm", "pbm"].includes(extension)) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        loadNewImage(parsePortableImage(reader.result, file.name));
      } catch (error) {
        statusText.textContent = `Não foi possível ler o arquivo PGM/PBM: ${error.message}`;
      }
    };
    reader.readAsArrayBuffer(file);
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const imageElement = new Image();
    imageElement.onload = () => {
      loadNewImage(convertBrowserImage(imageElement, file.name));
    };
    imageElement.src = reader.result;
  };
  reader.readAsDataURL(file);
}

async function loadSample(sampleKey) {
  const sample = sampleAssets[sampleKey];
  if (!sample) {
    return;
  }

  try {
    if (sample.kind === "portable") {
      const response = await fetch(sample.path);
      const buffer = await response.arrayBuffer();
      loadNewImage(parsePortableImage(buffer, sample.label));
      return;
    }

    const response = await fetch(sample.path);
    const blob = await response.blob();
    const imageUrl = URL.createObjectURL(blob);
    const imageElement = new Image();

    imageElement.onload = () => {
      loadNewImage(convertBrowserImage(imageElement, sample.label, {
        forceBinary: sample.forceBinary,
        threshold: 127
      }));
      URL.revokeObjectURL(imageUrl);
    };

    imageElement.src = imageUrl;
  } catch (error) {
    statusText.textContent = `Falha ao carregar a imagem de exemplo: ${error.message}.`;
  }
}

function loadNewImage(image) {
  setBaseImage(image);
  resultImage = null;
  drawImageOnCanvas(null, resultCanvas, resultCtx, resultMeta, "Aguardando processamento");
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

function multiplyMatrixAndPoint(matrix, point) {
  return [
    matrix[0][0] * point[0] + matrix[0][1] * point[1] + matrix[0][2] * point[2],
    matrix[1][0] * point[0] + matrix[1][1] * point[1] + matrix[1][2] * point[2],
    matrix[2][0] * point[0] + matrix[2][1] * point[1] + matrix[2][2] * point[2]
  ];
}

function multiplyMatrices(a, b) {
  const result = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0]
  ];

  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      for (let k = 0; k < 3; k += 1) {
        result[row][col] += a[row][k] * b[k][col];
      }
    }
  }

  return result;
}

function invertAffineMatrix(matrix) {
  const a = matrix[0][0];
  const b = matrix[0][1];
  const c = matrix[0][2];
  const d = matrix[1][0];
  const e = matrix[1][1];
  const f = matrix[1][2];
  const determinant = a * e - b * d;

  if (determinant === 0) {
    throw new Error("A matriz da transformação não possui inversa.");
  }

  return [
    [e / determinant, -b / determinant, (b * f - e * c) / determinant],
    [-d / determinant, a / determinant, (d * c - a * f) / determinant],
    [0, 0, 1]
  ];
}

function translationMatrix(tx, ty) {
  return [
    [1, 0, tx],
    [0, 1, ty],
    [0, 0, 1]
  ];
}

function buildCenteredAffine(baseMatrix, width, height) {
  const centerX = (width - 1) / 2;
  const centerY = (height - 1) / 2;

  return multiplyMatrices(
    translationMatrix(centerX, centerY),
    multiplyMatrices(baseMatrix, translationMatrix(-centerX, -centerY))
  );
}

function computeBounds(matrix, width, height, includeOriginalFrame = false) {
  const corners = [
    [0, 0, 1],
    [width - 1, 0, 1],
    [0, height - 1, 1],
    [width - 1, height - 1, 1]
  ];

  const transformedCorners = corners.map((corner) => multiplyMatrixAndPoint(matrix, corner));
  const xs = transformedCorners.map((point) => point[0]);
  const ys = transformedCorners.map((point) => point[1]);

  if (includeOriginalFrame) {
    xs.push(0, width - 1);
    ys.push(0, height - 1);
  }

  return {
    minX: Math.floor(Math.min(...xs)),
    maxX: Math.ceil(Math.max(...xs)),
    minY: Math.floor(Math.min(...ys)),
    maxY: Math.ceil(Math.max(...ys))
  };
}

/*
  Aqui está o coração do item 6:
  usamos mapeamento inverso com vizinho mais próximo e recalculamos o quadro
  de saída para respeitar as mudanças espaciais após a transformação.
*/
function applyAffineTransform(image, affineMatrix, options = {}) {
  const {
    includeOriginalFrame = false,
    background = image.mode === "binary" ? 255 : 0
  } = options;

  const bounds = computeBounds(affineMatrix, image.width, image.height, includeOriginalFrame);
  const newWidth = Math.max(1, bounds.maxX - bounds.minX + 1);
  const newHeight = Math.max(1, bounds.maxY - bounds.minY + 1);
  const newPixels = new Uint8ClampedArray(newWidth * newHeight);
  newPixels.fill(background);

  const inverseMatrix = invertAffineMatrix(affineMatrix);

  for (let targetY = 0; targetY < newHeight; targetY += 1) {
    for (let targetX = 0; targetX < newWidth; targetX += 1) {
      const worldX = targetX + bounds.minX;
      const worldY = targetY + bounds.minY;
      const [srcX, srcY] = multiplyMatrixAndPoint(inverseMatrix, [worldX, worldY, 1]);
      const value = getNearestPixel(image, srcX, srcY, background);
      setPixel(newPixels, newWidth, targetX, targetY, value);
    }
  }

  return createImageObject(newWidth, newHeight, newPixels, image.mode, image.label, image.type);
}

function buildTransformation(type, image) {
  const background = image.mode === "binary" ? 255 : 0;
  let matrix = null;
  let operationName = "";
  let includeOriginalFrame = false;

  if (type === "scale") {
    const sx = Number(document.getElementById("scaleX").value);
    const sy = Number(document.getElementById("scaleY").value);

    if (sx === 0 || sy === 0) {
      throw new Error("Os fatores de escala não podem ser zero.");
    }

    matrix = buildCenteredAffine([
      [sx, 0, 0],
      [0, sy, 0],
      [0, 0, 1]
    ], image.width, image.height);
    operationName = `Escala (sx=${sx}, sy=${sy})`;
  }

  if (type === "translate") {
    const tx = Number(document.getElementById("translateX").value);
    const ty = Number(document.getElementById("translateY").value);

    matrix = translationMatrix(tx, ty);
    includeOriginalFrame = true;
    operationName = `Translação (tx=${tx}, ty=${ty})`;
  }

  if (type === "reflect") {
    const reflectX = document.getElementById("reflectX").checked;
    const reflectY = document.getElementById("reflectY").checked;

    if (!reflectX && !reflectY) {
      throw new Error("Marque ao menos um eixo para aplicar a reflexão.");
    }

    matrix = buildCenteredAffine([
      [reflectY ? -1 : 1, 0, 0],
      [0, reflectX ? -1 : 1, 0],
      [0, 0, 1]
    ], image.width, image.height);
    operationName = `Reflexão (${reflectX ? "eixo X" : ""}${reflectX && reflectY ? " e " : ""}${reflectY ? "eixo Y" : ""})`;
  }

  if (type === "shear") {
    const shx = Number(document.getElementById("shearX").value);
    const shy = Number(document.getElementById("shearY").value);

    if ((1 - shx * shy) === 0) {
      throw new Error("Essa combinação de cisalhamento gera matriz não inversível.");
    }

    matrix = buildCenteredAffine([
      [1, shx, 0],
      [shy, 1, 0],
      [0, 0, 1]
    ], image.width, image.height);
    operationName = `Cisalhamento (shx=${shx}, shy=${shy})`;
  }

  if (type === "rotate") {
    const degrees = Number(document.getElementById("rotation").value);
    const radians = (degrees * Math.PI) / 180;

    matrix = buildCenteredAffine([
      [Math.cos(radians), -Math.sin(radians), 0],
      [Math.sin(radians), Math.cos(radians), 0],
      [0, 0, 1]
    ], image.width, image.height);
    operationName = `Rotação (${degrees}°)`;
  }

  return {
    transformedImage: applyAffineTransform(image, matrix, {
      includeOriginalFrame,
      background
    }),
    operationName
  };
}

function applyTransformation(type) {
  const sourceImage = getWorkingImage();
  if (!sourceImage) {
    return;
  }

  const { transformedImage, operationName } = buildTransformation(type, sourceImage);
  transformedImage.label = `${sourceImage.label} - ${operationName}`;

  if (sourceImage.mode === "binary") {
    for (let index = 0; index < transformedImage.pixels.length; index += 1) {
      transformedImage.pixels[index] = transformedImage.pixels[index] < 128 ? 0 : 255;
    }
  }

  setResultImage(transformedImage, operationName);
  statusText.textContent =
    `${operationName} aplicada com mapeamento inverso e interpolação por vizinho mais próximo. O quadro de saída foi recalculado para considerar a mudança espacial da imagem.`;
}

function resetToOriginal() {
  if (!originalSnapshot) {
    statusText.textContent = "Ainda não existe uma imagem original para restaurar.";
    return;
  }

  setBaseImage(originalSnapshot, true);
  resultImage = null;
  drawImageOnCanvas(null, resultCanvas, resultCtx, resultMeta, "Aguardando processamento");
  currentTransformLabel.textContent = "Nenhuma";
  statusText.textContent = "A imagem original foi restaurada.";
  updateSummary();
}

function promoteResultToBase() {
  if (!resultImage) {
    statusText.textContent = "Gere um resultado antes de promovê-lo para imagem original.";
    return;
  }

  setBaseImage(resultImage);
  resultImage = null;
  drawImageOnCanvas(null, resultCanvas, resultCtx, resultMeta, "Aguardando processamento");
  currentTransformLabel.textContent = "Nenhuma";
  statusText.textContent = "O resultado atual passou a ser a nova imagem original.";
  updateSummary();
}

function clearAll() {
  baseImage = null;
  resultImage = null;
  originalSnapshot = null;

  clearCanvas(originalCanvas, originalCtx);
  clearCanvas(resultCanvas, resultCtx);

  originalMeta.textContent = "Nenhuma imagem carregada";
  resultMeta.textContent = "Aguardando processamento";
  imageModeLabel.textContent = "Nenhum";
  currentTransformLabel.textContent = "Nenhuma";
  statusText.textContent = "Tudo foi limpo. Carregue uma imagem ou use um dos exemplos locais do item 6.";
  imageInput.value = "";
}

/*
  Restaura os parâmetros padrão da interface sem apagar as imagens.
  Isso ajuda a repetir demonstrações sem precisar recarregar a página.
*/
function resetControlsToDefault() {
  document.getElementById("scaleX").value = defaultControlValues.scaleX;
  document.getElementById("scaleY").value = defaultControlValues.scaleY;
  document.getElementById("translateX").value = defaultControlValues.translateX;
  document.getElementById("translateY").value = defaultControlValues.translateY;
  document.getElementById("shearX").value = defaultControlValues.shearX;
  document.getElementById("shearY").value = defaultControlValues.shearY;
  document.getElementById("rotation").value = defaultControlValues.rotation;
  document.getElementById("reflectX").checked = defaultControlValues.reflectX;
  document.getElementById("reflectY").checked = defaultControlValues.reflectY;
  useResultAsBaseCheckbox.checked = defaultControlValues.useResultAsBase;

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
  if (file) {
    readUploadedFile(file);
  }
});

loadGraySampleButton.addEventListener("click", () => loadSample("gray"));
loadBinarySampleButton.addEventListener("click", () => loadSample("binary"));
loadBinaryJpegSampleButton.addEventListener("click", () => loadSample("binaryJpeg"));
resetControlsButton.addEventListener("click", resetControlsToDefault);

promoteResultButton.addEventListener("click", promoteResultToBase);
resetResultButton.addEventListener("click", resetToOriginal);
clearCanvasesButton.addEventListener("click", clearAll);

clearAll();
resetControlsToDefault();
loadSample("gray");

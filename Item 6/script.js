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
const useResultAsBaseCheckbox = document.getElementById("useResultAsBase");
const promoteResultButton = document.getElementById("promoteResult");
const resetResultButton = document.getElementById("resetResult");
const clearCanvasesButton = document.getElementById("clearCanvases");

let baseImage = null;
let resultImage = null;
let originalSnapshot = null;

/*
  A estrutura abaixo representa uma imagem em tons de cinza.
  Cada posição do vetor pixels guarda um valor entre 0 e 255.
*/
function createImageObject(width, height, pixels, mode = "grayscale", label = "Imagem") {
  return {
    width,
    height,
    pixels,
    mode,
    label
  };
}

function cloneImage(image) {
  return createImageObject(
    image.width,
    image.height,
    new Uint8ClampedArray(image.pixels),
    image.mode,
    image.label
  );
}

/*
  O canvas é usado apenas para desenhar.
  O processamento geométrico ocorre sobre o vetor de pixels em memória.
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

function updateSummary() {
  imageModeLabel.textContent = baseImage ? describeMode(baseImage.mode) : "Nenhum";
  currentTransformLabel.textContent = resultImage?.lastOperation || "Nenhuma";
}

function describeMode(mode) {
  return mode === "binary" ? "Imagem binária" : "Imagem em níveis de cinza";
}

function setBaseImage(image, preserveOriginal = false) {
  baseImage = cloneImage(image);

  if (!preserveOriginal || !originalSnapshot) {
    originalSnapshot = cloneImage(image);
  }

  drawImageOnCanvas(baseImage, originalCanvas, originalCtx, originalMeta, "Imagem original");
  imageModeLabel.textContent = describeMode(baseImage.mode);
}

function setResultImage(image, operationName) {
  resultImage = cloneImage(image);
  resultImage.lastOperation = operationName;
  drawImageOnCanvas(resultImage, resultCanvas, resultCtx, resultMeta, "Imagem transformada");
  currentTransformLabel.textContent = operationName;
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

function getPixel(image, x, y) {
  if (x < 0 || x >= image.width || y < 0 || y >= image.height) {
    return 255;
  }

  return image.pixels[y * image.width + x];
}

function setPixel(pixels, width, x, y, value) {
  pixels[y * width + x] = value;
}

function createGraySample() {
  const width = 240;
  const height = 240;
  const pixels = new Uint8ClampedArray(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const gradient = Math.round((x / (width - 1)) * 180);
      const circleX = x - width / 2;
      const circleY = y - height / 2;
      const radius = Math.sqrt(circleX * circleX + circleY * circleY);
      const shapeBoost = radius < 58 ? 60 : 0;
      const stripe = y > 120 && y < 150 ? 35 : 0;
      const value = Math.max(0, Math.min(255, gradient + shapeBoost + stripe));
      setPixel(pixels, width, x, y, value);
    }
  }

  return createImageObject(width, height, pixels, "grayscale", "Exemplo em cinza");
}

function createBinarySample() {
  const width = 220;
  const height = 220;
  const pixels = new Uint8ClampedArray(width * height);
  pixels.fill(255);

  for (let y = 40; y <= 180; y += 1) {
    for (let x = 40; x <= 180; x += 1) {
      if (x > 70 && x < 150 && y > 70 && y < 150) {
        setPixel(pixels, width, x, y, 0);
      }
    }
  }

  for (let y = 65; y <= 155; y += 1) {
    for (let x = 95; x <= 125; x += 1) {
      setPixel(pixels, width, x, y, 255);
    }
  }

  for (let y = 100; y <= 120; y += 1) {
    for (let x = 65; x <= 155; x += 1) {
      setPixel(pixels, width, x, y, 255);
    }
  }

  return createImageObject(width, height, pixels, "binary", "Exemplo binário");
}

function readUploadedFile(file) {
  const extension = file.name.split(".").pop().toLowerCase();

  if (["pgm", "pbm"].includes(extension)) {
    const reader = new FileReader();

    reader.onload = () => {
      try {
        const image = parsePortableGrayOrBitmap(reader.result, file.name);
        loadNewImage(image);
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
      const image = convertBrowserImageToGray(imageElement, file.name);
      loadNewImage(image);
    };
    imageElement.src = reader.result;
  };
  reader.readAsDataURL(file);
}

/*
  Conversão manual de uma imagem comum para tons de cinza.
  A luminância é calculada a partir dos canais RGB.
*/
function convertBrowserImageToGray(imageElement, label) {
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
    pixels[index] = gray;
  }

  return createImageObject(
    tempCanvas.width,
    tempCanvas.height,
    pixels,
    detectMode(pixels),
    label
  );
}

function parsePortableGrayOrBitmap(arrayBuffer, label) {
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

  let pixels;

  if (magic === "P1") {
    const text = decoder.decode(bytes.slice(cursor));
    const values = text
      .replace(/#[^\n\r]*/g, " ")
      .trim()
      .split(/\s+/)
      .map(Number);

    pixels = new Uint8ClampedArray(width * height);
    for (let index = 0; index < pixels.length; index += 1) {
      pixels[index] = values[index] === 1 ? 0 : 255;
    }
  } else if (magic === "P2") {
    const text = decoder.decode(bytes.slice(cursor));
    const values = text
      .replace(/#[^\n\r]*/g, " ")
      .trim()
      .split(/\s+/)
      .map(Number);

    pixels = new Uint8ClampedArray(width * height);
    for (let index = 0; index < pixels.length; index += 1) {
      pixels[index] = normalizeValue(values[index] || 0, maxValue);
    }
  } else if (magic === "P4") {
    pixels = new Uint8ClampedArray(width * height);
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
    pixels = new Uint8ClampedArray(width * height);

    if (maxValue > 255) {
      for (let index = 0; index < pixels.length; index += 1) {
        const high = bytes[cursor + index * 2];
        const low = bytes[cursor + index * 2 + 1];
        const value = (high << 8) | low;
        pixels[index] = normalizeValue(value, maxValue);
      }
    } else {
      for (let index = 0; index < pixels.length; index += 1) {
        pixels[index] = normalizeValue(bytes[cursor + index], maxValue);
      }
    }
  } else {
    throw new Error("Formato não suportado. Use P1, P2, P4 ou P5.");
  }

  return createImageObject(width, height, pixels, detectMode(pixels), label);
}

function normalizeValue(value, maxValue) {
  if (maxValue <= 0) {
    return 0;
  }

  return Math.round((value / maxValue) * 255);
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

  if (useResultAsBaseCheckbox.checked && resultImage) {
    return resultImage;
  }

  return baseImage;
}

function applyTransformation(type) {
  const sourceImage = getWorkingImage();
  if (!sourceImage) {
    return;
  }

  let matrix;
  let operationName;

  if (type === "scale") {
    const sx = Number(document.getElementById("scaleX").value);
    const sy = Number(document.getElementById("scaleY").value);

    if (sx === 0 || sy === 0) {
      statusText.textContent = "Os fatores de escala não podem ser zero.";
      return;
    }

    matrix = [
      [sx, 0, 0],
      [0, sy, 0],
      [0, 0, 1]
    ];
    operationName = `Escala (sx=${sx}, sy=${sy})`;
  }

  if (type === "translate") {
    const tx = Number(document.getElementById("translateX").value);
    const ty = Number(document.getElementById("translateY").value);

    matrix = [
      [1, 0, tx],
      [0, 1, ty],
      [0, 0, 1]
    ];
    operationName = `Translação (tx=${tx}, ty=${ty})`;
  }

  if (type === "reflect") {
    const reflectX = document.getElementById("reflectX").checked;
    const reflectY = document.getElementById("reflectY").checked;

    if (!reflectX && !reflectY) {
      statusText.textContent = "Marque ao menos um eixo para aplicar a reflexão.";
      return;
    }

    matrix = [
      [reflectY ? -1 : 1, 0, 0],
      [0, reflectX ? -1 : 1, 0],
      [0, 0, 1]
    ];
    operationName = `Reflexão (${reflectX ? "eixo X" : ""}${reflectX && reflectY ? " e " : ""}${reflectY ? "eixo Y" : ""})`;
  }

  if (type === "shear") {
    const shx = Number(document.getElementById("shearX").value);
    const shy = Number(document.getElementById("shearY").value);

    const determinant = 1 - shx * shy;
    if (determinant === 0) {
      statusText.textContent = "Essa combinação de cisalhamento gera matriz não inversível.";
      return;
    }

    matrix = [
      [1, shx, 0],
      [shy, 1, 0],
      [0, 0, 1]
    ];
    operationName = `Cisalhamento (shx=${shx}, shy=${shy})`;
  }

  if (type === "rotate") {
    const degrees = Number(document.getElementById("rotation").value);
    const radians = (degrees * Math.PI) / 180;
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);

    matrix = [
      [cosine, -sine, 0],
      [sine, cosine, 0],
      [0, 0, 1]
    ];
    operationName = `Rotação (${degrees}°)`;
  }

  const transformedImage = transformImage(sourceImage, matrix);
  transformedImage.label = `${sourceImage.label} - ${operationName}`;
  transformedImage.mode = sourceImage.mode;

  if (sourceImage.mode === "binary") {
    for (let index = 0; index < transformedImage.pixels.length; index += 1) {
      transformedImage.pixels[index] = transformedImage.pixels[index] < 128 ? 0 : 255;
    }
  }

  setResultImage(transformedImage, operationName);
  updateSummary();
  statusText.textContent =
    `${operationName} aplicada com remapeamento inverso de pixels e interpolação por vizinho mais próximo. O novo quadro foi recalculado para evitar cortes na imagem transformada.`;
}

/*
  A transformação é aplicada por coordenadas homogêneas.
  Primeiro calculamos o retângulo de saída; depois, para cada pixel de destino,
  usamos a matriz inversa para descobrir de qual ponto da imagem original ele veio.
*/
function transformImage(image, matrix) {
  const sourceCenterX = (image.width - 1) / 2;
  const sourceCenterY = (image.height - 1) / 2;

  const corners = [
    [-sourceCenterX, -sourceCenterY, 1],
    [image.width - 1 - sourceCenterX, -sourceCenterY, 1],
    [-sourceCenterX, image.height - 1 - sourceCenterY, 1],
    [image.width - 1 - sourceCenterX, image.height - 1 - sourceCenterY, 1]
  ];

  const transformedCorners = corners.map((corner) => multiplyMatrixAndPoint(matrix, corner));
  const xs = transformedCorners.map((point) => point[0]);
  const ys = transformedCorners.map((point) => point[1]);

  const minX = Math.floor(Math.min(...xs));
  const maxX = Math.ceil(Math.max(...xs));
  const minY = Math.floor(Math.min(...ys));
  const maxY = Math.ceil(Math.max(...ys));

  const newWidth = Math.max(1, maxX - minX + 1);
  const newHeight = Math.max(1, maxY - minY + 1);
  const newPixels = new Uint8ClampedArray(newWidth * newHeight);
  newPixels.fill(255);

  const inverseMatrix = invertAffineMatrix(matrix);

  for (let targetY = 0; targetY < newHeight; targetY += 1) {
    for (let targetX = 0; targetX < newWidth; targetX += 1) {
      const centeredX = targetX + minX;
      const centeredY = targetY + minY;
      const sourcePoint = multiplyMatrixAndPoint(inverseMatrix, [centeredX, centeredY, 1]);

      const sampleX = Math.round(sourcePoint[0] + sourceCenterX);
      const sampleY = Math.round(sourcePoint[1] + sourceCenterY);
      const value = getPixel(image, sampleX, sampleY);

      setPixel(newPixels, newWidth, targetX, targetY, value);
    }
  }

  return createImageObject(newWidth, newHeight, newPixels, image.mode, image.label);
}

function multiplyMatrixAndPoint(matrix, point) {
  return [
    matrix[0][0] * point[0] + matrix[0][1] * point[1] + matrix[0][2] * point[2],
    matrix[1][0] * point[0] + matrix[1][1] * point[1] + matrix[1][2] * point[2],
    matrix[2][0] * point[0] + matrix[2][1] * point[1] + matrix[2][2] * point[2]
  ];
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
  statusText.textContent = "Tudo foi limpo. Você pode carregar outra imagem ou usar um exemplo. O processamento usa remapeamento manual e vizinho mais próximo.";
  imageInput.value = "";
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

loadGraySampleButton.addEventListener("click", () => {
  loadNewImage(createGraySample());
});

loadBinarySampleButton.addEventListener("click", () => {
  loadNewImage(createBinarySample());
});

promoteResultButton.addEventListener("click", promoteResultToBase);
resetResultButton.addEventListener("click", resetToOriginal);
clearCanvasesButton.addEventListener("click", clearAll);

clearAll();
loadNewImage(createGraySample());

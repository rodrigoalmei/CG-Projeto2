const originalCanvas = document.getElementById("originalCanvas");
const resultCanvas = document.getElementById("resultCanvas");
const originalCtx = originalCanvas.getContext("2d");
const resultCtx = resultCanvas.getContext("2d");

const originalMeta = document.getElementById("originalMeta");
const resultMeta = document.getElementById("resultMeta");

const imageInput = document.getElementById("imageInput");
const resetControlsButton = document.getElementById("resetControls");
const promoteResultButton = document.getElementById("promoteResult");
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
    pixelTable: document.getElementById("originalPixelTable")
  },
  result: {
    canvas: resultCanvas,
    context: resultCtx,
    meta: resultMeta,
    marker: document.getElementById("resultMarker"),
    coordLabel: document.getElementById("resultCoordLabel"),
    pixelTable: document.getElementById("resultPixelTable")
  }
};

viewers.original.inspector = window.PixelInspector.create({
  canvas: viewers.original.canvas,
  marker: viewers.original.marker,
  coordLabel: viewers.original.coordLabel,
  tableContainer: viewers.original.pixelTable,
  markerMode: "hover"
});

viewers.result.inspector = window.PixelInspector.create({
  canvas: viewers.result.canvas,
  marker: viewers.result.marker,
  coordLabel: viewers.result.coordLabel,
  tableContainer: viewers.result.pixelTable,
  markerMode: "hover"
});

const defaultControlValues = {
  scaleX: 1.5,
  scaleY: 1.5,
  translateX: 50,
  translateY: 50,
  shearX: 0.5,
  shearY: 0,
  rotation: 45,
  reflectionAxis: "x"
};

function createImageObject(width, height, pixels, mode = "grayscale", label = "Imagem", type = "P2") {
  return { width, height, pixels, mode, label, type };
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

function clearCanvas(canvas, context) {
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
}

function describeMode(mode) {
  return mode === "binary" ? "Imagem binaria" : "Imagem em niveis de cinza";
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

function setBaseImage(image, preserveOriginal = false) {
  baseImage = cloneImage(image);

  if (!preserveOriginal || !originalSnapshot) {
    originalSnapshot = cloneImage(image);
  }

  drawViewerImage(baseImage, viewers.original, "Imagem original");
}

function setResultImage(image, operationName) {
  resultImage = cloneImage(image);
  resultImage.lastOperation = operationName;
  drawViewerImage(resultImage, viewers.result, "Imagem transformada");
}

function drawViewerImage(image, viewer, emptyLabel, resetCenter = true) {
  if (!image) {
    clearCanvas(viewer.canvas, viewer.context);
    viewer.meta.textContent = emptyLabel;
    viewer.inspector.clear();
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
  viewer.inspector.setImage({
    width: image.width,
    height: image.height,
    pixels: image.pixels
  }, resetCenter);
}

function normalizeValue(value, maxValue) {
  if (maxValue <= 0) return 0;
  return Math.round((value / maxValue) * 255);
}

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
  if (!magic || !width || !height) throw new Error("Cabecalho invalido.");

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

function readUploadedFile(file) {
  const extension = file.name.split(".").pop().toLowerCase();

  if (["pgm", "pbm"].includes(extension)) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        loadNewImage(parsePortableImage(reader.result, file.name));
      } catch (_error) {}
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

function loadNewImage(image) {
  setBaseImage(image);
  resultImage = null;
  drawViewerImage(null, viewers.result, "Aguardando processamento");
}

function getWorkingImage() {
  if (!baseImage) {
    return null;
  }
  return baseImage;
}

function getNearestPixel(image, x, y, background = 0) {
  const px = Math.round(x);
  const py = Math.round(y);

  if (px < 0 || px >= image.width || py < 0 || py >= image.height) {
    return background;
  }
  return image.pixels[py * image.width + px];
}

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

function scale(image, sx, sy) {
  if (sx === 0 || sy === 0) {
    throw new Error("Os fatores de escala nao podem ser zero.");
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

function applyTransformation(type) {
  const sourceImage = getWorkingImage();
  if (!sourceImage) return;

  let transformedImage = null;
  let operationName = "";

  if (type === "translate") {
    const tx = Number(document.getElementById("translateX").value);
    const ty = Number(document.getElementById("translateY").value);
    transformedImage = translation(sourceImage, tx, ty);
    operationName = `Translacao (tx=${tx}, ty=${ty})`;
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
    operationName = `Reflexao (${axis === "x" ? "Horizontal / eixo X" : "Vertical / eixo Y"})`;
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
    operationName = `Rotacao (${angle} graus)`;
  }

  if (!transformedImage) return;

  transformedImage.label = `${sourceImage.label} - ${operationName}`;
  setResultImage(transformedImage, operationName);
}

function promoteResultToBase() {
  if (!resultImage) return;

  setBaseImage(resultImage);
  resultImage = null;
  drawViewerImage(null, viewers.result, "Aguardando processamento");
}

function clearAll() {
  baseImage = null;
  resultImage = null;
  originalSnapshot = null;

  drawViewerImage(null, viewers.original, "Nenhuma imagem carregada");
  drawViewerImage(null, viewers.result, "Aguardando processamento");
  originalMeta.textContent = "Nenhuma imagem carregada";
  resultMeta.textContent = "Aguardando processamento";
  imageInput.value = "";
}

function resetControlsToDefault() {
  document.getElementById("scaleX").value = defaultControlValues.scaleX;
  document.getElementById("scaleY").value = defaultControlValues.scaleY;
  document.getElementById("translateX").value = defaultControlValues.translateX;
  document.getElementById("translateY").value = defaultControlValues.translateY;
  document.getElementById("shearX").value = defaultControlValues.shearX;
  document.getElementById("shearY").value = defaultControlValues.shearY;
  document.getElementById("rotation").value = defaultControlValues.rotation;
  document.getElementById("reflectionAxis").value = defaultControlValues.reflectionAxis;
}

document.querySelectorAll("[data-transform]").forEach((button) => {
  button.addEventListener("click", () => {
    try {
      applyTransformation(button.dataset.transform);
    } catch (_error) {}
  });
});

imageInput.addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (file) readUploadedFile(file);
});

resetControlsButton.addEventListener("click", resetControlsToDefault);
promoteResultButton.addEventListener("click", promoteResultToBase);
clearCanvasesButton.addEventListener("click", clearAll);

clearAll();
resetControlsToDefault();

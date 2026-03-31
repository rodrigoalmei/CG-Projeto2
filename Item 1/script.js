// ============================================
// CONSTANTS & UTILITIES
// ============================================

function clamp(value, min = 0, max = 255) {
  return Math.max(min, Math.min(max, value));
}

// ============================================
// OPERADORES
// ============================================

const OPERATORS = {
  1: (a, b) => a + b, // Add
  2: (a, b) => a - b, // Sub
  3: (a, b) => a * b, // Mul
  4: (a, b) => (b === 0 ? 0 : a / b), // Div
  5: (a, b) => a | b, // OR
  6: (a, b) => a & b, // AND
  7: (a, b) => a ^ b, // XOR
};

// ============================================
// PGM PARSING
// ============================================

function parsePGM(arrayBuffer) {
  const view = new Uint8Array(arrayBuffer);
  let pos = 0;

  // Read magic number
  let magic = String.fromCharCode(view[pos], view[pos + 1]);
  pos += 2;

  if (magic !== "P5" && magic !== "P2") {
    throw new Error("Arquivo não é um PGM válido");
  }

  // Skip whitespace and comments
  function skipWhitespaceAndComments() {
    while (pos < view.length) {
      const char = view[pos];
      if (char === 10 || char === 13 || char === 32 || char === 9) {
        pos++;
      } else if (char === 35) {
        // '#'
        while (pos < view.length && view[pos] !== 10 && view[pos] !== 13) pos++;
        pos++;
      } else {
        break;
      }
    }
  }

  // Read number
  function readNumber() {
    skipWhitespaceAndComments();
    let numStr = "";
    while (pos < view.length) {
      const char = view[pos];
      if (char >= 48 && char <= 57) {
        // '0'-'9'
        numStr += String.fromCharCode(char);
        pos++;
      } else {
        break;
      }
    }
    return parseInt(numStr);
  }

  const width = readNumber();
  const height = readNumber();
  const maxval = readNumber();

  skipWhitespaceAndComments();

  const data = [];
  const bytes = 255 / maxval;

  if (magic === "P5") {
    for (let i = 0; i < height; i++) {
      data[i] = [];
      for (let j = 0; j < width; j++) {
        data[i][j] = Math.round(view[pos] * bytes);
        pos++;
      }
    }
  } else {
    for (let i = 0; i < height; i++) {
      data[i] = [];
      for (let j = 0; j < width; j++) {
        data[i][j] = Math.round(readNumber() * bytes);
      }
    }
  }

  return { data, w: width, h: height, type: "P5" };
}

// ============================================
// APLICAR OPERAÇÃO
// ============================================

function applyComposition(
  matrixA,
  matrixB,
  w,
  h,
  operatorFn,
  doNormalize = true,
) {
  const result = [];
  let minVal = Infinity;
  let maxVal = -Infinity;

  for (let i = 0; i < h; i++) {
    result[i] = [];
    for (let j = 0; j < w; j++) {
      let val = operatorFn(matrixA[i][j], matrixB[i][j]);
      result[i][j] = val;

      if (val < minVal) minVal = val;
      if (val > maxVal) maxVal = val;
    }
  }

  if (doNormalize && minVal !== maxVal) {
    for (let i = 0; i < h; i++) {
      for (let j = 0; j < w; j++) {
        result[i][j] = Math.round(
          ((result[i][j] - minVal) / (maxVal - minVal)) * 255,
        );
      }
    }
  } else if (!doNormalize) {
    for (let i = 0; i < h; i++) {
      for (let j = 0; j < w; j++) {
        result[i][j] = clamp(result[i][j]);
      }
    }
  }

  return result;
}

// ============================================
// RENDERING
// ============================================

function drawMatrixToCanvas(canvas, matrix, w, h) {
  if (!canvas || !matrix || !matrix.length) return;

  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d");
  const imageData = ctx.createImageData(w, h);
  const data = imageData.data;

  for (let i = 0; i < h; i++) {
    for (let j = 0; j < w; j++) {
      const idx = (i * w + j) * 4;
      const val = clamp(Math.round(matrix[i][j]));
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

// ============================================
// MATRIX TO PGM
// ============================================

function matrixToPGM(matrix, w, h) {
  let pgm = "P5\n";
  pgm += w + " " + h + "\n";
  pgm += "255\n";

  const bytes = [];
  for (let i = 0; i < h; i++) {
    for (let j = 0; j < w; j++) {
      bytes.push(clamp(Math.round(matrix[i][j])));
    }
  }

  return new Blob([pgm, new Uint8Array(bytes)], {
    type: "application/octet-stream",
  });
}

// ============================================
// MATRIX TO LINEAR ARRAY
// ============================================

function matrixToLinearArray(matrix, w, h) {
  const pixels = new Uint8ClampedArray(w * h);
  for (let i = 0; i < h; i++) {
    for (let j = 0; j < w; j++) {
      pixels[i * w + j] = clamp(Math.round(matrix[i][j]));
    }
  }
  return pixels;
}

// ============================================
// STATE & DOM ELEMENTS
// ============================================

let imageA = null;
let imageB = null;
let processedMatrix = null;

const imgAUpload = document.getElementById("img-a-upload");
const imgBUpload = document.getElementById("img-b-upload");
const operationSelect = document.getElementById("operation-select");
const operationNormalize = document.getElementById("operation-normalize");
const applyOperationBtn = document.getElementById("apply-operation-btn");
const downloadOperationBtn = document.getElementById("download-operation-btn");

const imgACanvas = document.getElementById("img-a-canvas");
const imgBCanvas = document.getElementById("img-b-canvas");
const resultCanvas = document.getElementById("result-canvas");

// ============================================
// PIXEL INSPECTORS
// ============================================

const inspectors = {
  a: window.PixelInspector.create({
    canvas: imgACanvas,
    marker: document.getElementById("img-a-marker"),
    coordLabel: document.getElementById("img-a-coord"),
    tableContainer: document.getElementById("img-a-table"),
    markerMode: "hover",
  }),
  b: window.PixelInspector.create({
    canvas: imgBCanvas,
    marker: document.getElementById("img-b-marker"),
    coordLabel: document.getElementById("img-b-coord"),
    tableContainer: document.getElementById("img-b-table"),
    markerMode: "hover",
  }),
  result: window.PixelInspector.create({
    canvas: resultCanvas,
    marker: document.getElementById("result-marker"),
    coordLabel: document.getElementById("result-coord"),
    tableContainer: document.getElementById("result-table"),
    markerMode: "hover",
  }),
};

// ============================================
// UPLOAD HANDLERS
// ============================================

imgAUpload.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const arrayBuffer = await file.arrayBuffer();
    imageA = parsePGM(arrayBuffer);
    processedMatrix = null;

    drawMatrixToCanvas(imgACanvas, imageA.data, imageA.w, imageA.h);

    inspectors.a.setImage({
      width: imageA.w,
      height: imageA.h,
      pixels: matrixToLinearArray(imageA.data, imageA.w, imageA.h),
    });

    inspectors.result.clear();
  } catch (error) {
    alert("Erro ao ler imagem A: " + error.message);
  }
});

imgBUpload.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const arrayBuffer = await file.arrayBuffer();
    imageB = parsePGM(arrayBuffer);
    processedMatrix = null;

    drawMatrixToCanvas(imgBCanvas, imageB.data, imageB.w, imageB.h);

    inspectors.b.setImage({
      width: imageB.w,
      height: imageB.h,
      pixels: matrixToLinearArray(imageB.data, imageB.w, imageB.h),
    });

    inspectors.result.clear();
  } catch (error) {
    alert("Erro ao ler imagem B: " + error.message);
  }
});

// ============================================
// APPLY COMBINATION
// ============================================

applyOperationBtn.addEventListener("click", () => {
  if (!imageA || !imageB) {
    alert("Por favor, carregue as duas imagens (A e B) primeiro.");
    return;
  }

  if (imageA.w !== imageB.w || imageA.h !== imageB.h) {
    alert(
      "Atenção: As matrizes precisam ter exatamente as mesmas dimensões para serem combinadas!",
    );
    return;
  }

  applyOperationBtn.disabled = true;
  applyOperationBtn.textContent = "Calculando...";

  setTimeout(() => {
    const operatorId = parseInt(operationSelect.value);
    const doNormalize = operationNormalize.checked;
    const operatorFn = OPERATORS[operatorId];

    const resultMatrix = applyComposition(
      imageA.data,
      imageB.data,
      imageA.w,
      imageA.h,
      operatorFn,
      doNormalize,
    );

    processedMatrix = resultMatrix;

    if (resultCanvas && resultMatrix.length > 0) {
      drawMatrixToCanvas(resultCanvas, resultMatrix, imageA.w, imageA.h);

      inspectors.result.setImage({
        width: imageA.w,
        height: imageA.h,
        pixels: matrixToLinearArray(resultMatrix, imageA.w, imageA.h),
      });
    }

    applyOperationBtn.disabled = false;
    applyOperationBtn.textContent = "Combinar";
  }, 50);
});

// ============================================
// DOWNLOAD
// ============================================

downloadOperationBtn.addEventListener("click", () => {
  if (!processedMatrix || !imageA) {
    alert("Aplique uma operação primeiro");
    return;
  }

  const blob = matrixToPGM(processedMatrix, imageA.w, imageA.h);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "combinacao_resultado.pgm";
  a.click();
  URL.revokeObjectURL(url);
});

// ============================================
// FILTROS - STATE & DOM ELEMENTS
// ============================================

let filterImageState = null;
let filterProcessedMatrix = null;

const filterUpload = document.getElementById("filter-upload");
const filterSelect = document.getElementById("filter-select");
const highBoostInput = document.getElementById("high-boost-input");
const highBoostGroup = document.getElementById("high-boost-group");
const filterNormalize = document.getElementById("filter-normalize");
const applyFilterBtn = document.getElementById("apply-filter-btn");
const downloadFilterBtn = document.getElementById("download-filter-btn");

const filterOriginalCanvas = document.getElementById("filter-original-canvas");
const filterResultCanvas = document.getElementById("filter-result-canvas");

// ============================================
// FILTROS - PIXEL INSPECTORS
// ============================================

const filterInspectors = {
  original: window.PixelInspector.create({
    canvas: filterOriginalCanvas,
    marker: document.getElementById("filter-original-marker"),
    coordLabel: document.getElementById("filter-original-coord"),
    tableContainer: document.getElementById("filter-original-table"),
    markerMode: "hover",
  }),
  result: window.PixelInspector.create({
    canvas: filterResultCanvas,
    marker: document.getElementById("filter-result-marker"),
    coordLabel: document.getElementById("filter-result-coord"),
    tableContainer: document.getElementById("filter-result-table"),
    markerMode: "hover",
  }),
};

// ============================================
// FILTROS - UPLOAD HANDLER
// ============================================

filterUpload.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const arrayBuffer = await file.arrayBuffer();
    filterImageState = parsePGM(arrayBuffer);
    filterProcessedMatrix = null;

    drawMatrixToCanvas(
      filterOriginalCanvas,
      filterImageState.data,
      filterImageState.w,
      filterImageState.h,
    );

    filterInspectors.original.setImage({
      width: filterImageState.w,
      height: filterImageState.h,
      pixels: matrixToLinearArray(
        filterImageState.data,
        filterImageState.w,
        filterImageState.h,
      ),
    });

    filterInspectors.result.clear();
  } catch (error) {
    alert("Erro ao ler a imagem: " + error.message);
  }
});

// ============================================
// FILTROS - SELECT CHANGE HANDLER
// ============================================

filterSelect.addEventListener("change", (event) => {
  const filterValue = event.target.value;
  if (filterValue === "24") {
    highBoostGroup.style.display = "flex";
  } else {
    highBoostGroup.style.display = "none";
  }
});

// ============================================
// FILTROS - APPLY HANDLER
// ============================================

applyFilterBtn.addEventListener("click", () => {
  if (!filterImageState) {
    alert("Por favor, carregue uma imagem primeiro.");
    return;
  }

  applyFilterBtn.disabled = true;
  applyFilterBtn.textContent = "Calculando...";

  setTimeout(() => {
    const { data, w, h } = filterImageState;
    const filterValue = parseInt(filterSelect.value);
    let result = [];

    if (isNaN(filterValue) || filterValue === 0) {
      result = data; // Sem filtro, apenas a imagem original
    } else if (filterValue === 23) {
      result = medianFilter(data, w, h, filterNormalize.checked);
    } else if (filterValue === 24) {
      result = highBoostFilter(
        data,
        w,
        h,
        parseFloat(highBoostInput.value),
        filterNormalize.checked,
      );
    } else if (filterValue === 19) {
      result = robertsXY(data, w, h, filterNormalize.checked);
    } else if (filterValue === 20) {
      result = gradientXY(data, w, h, filterNormalize.checked);
    } else if (filterValue === 22) {
      result = prewittXY(data, w, h, filterNormalize.checked);
    } else if (filterValue === 21) {
      result = sobelXY(data, w, h, filterNormalize.checked);
    } else {
      const activeKernel = kernelMap[filterValue];
      if (activeKernel) {
        result = convolution(data, w, h, activeKernel, filterNormalize.checked);
      }
    }

    filterProcessedMatrix = result;

    if (filterResultCanvas && result.length > 0) {
      drawMatrixToCanvas(filterResultCanvas, result, w, h);

      filterInspectors.result.setImage({
        width: w,
        height: h,
        pixels: matrixToLinearArray(result, w, h),
      });
    }

    applyFilterBtn.disabled = false;
    applyFilterBtn.textContent = "Aplicar";
  }, 50);
});

// ============================================
// FILTROS - DOWNLOAD HANDLER
// ============================================

downloadFilterBtn.addEventListener("click", () => {
  if (!filterProcessedMatrix || !filterImageState) {
    alert("Aplique um filtro primeiro");
    return;
  }

  const blob = matrixToPGM(
    filterProcessedMatrix,
    filterImageState.w,
    filterImageState.h,
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "filtro_resultado.pgm";
  a.click();
  URL.revokeObjectURL(url);
});

// ============================================
// TAB NAVIGATION
// ============================================

document.querySelectorAll(".tab-button").forEach((button) => {
  button.addEventListener("click", (e) => {
    // Remove is-active de todos os botões
    document
      .querySelectorAll(".tab-button")
      .forEach((b) => b.classList.remove("is-active"));
    // Remove is-active de todos os conteúdos
    document
      .querySelectorAll(".tab-content")
      .forEach((content) => content.classList.remove("is-active"));

    // Adiciona is-active ao botão clicado
    e.target.classList.add("is-active");
    // Adiciona is-active ao conteúdo correspondente
    const tabName = e.target.getAttribute("data-tab");
    document.getElementById(`tab-${tabName}`).classList.add("is-active");
  });
});

// Initialize inspectors
window.addEventListener("DOMContentLoaded", () => {
  inspectors.a.clear();
  inspectors.b.clear();
  inspectors.result.clear();
  filterInspectors.original.clear();
  filterInspectors.result.clear();
});

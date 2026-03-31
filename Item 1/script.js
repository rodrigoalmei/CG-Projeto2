// ============================================
// CONSTANTS
// ============================================

const HALF = 1.0 / 2.0;
const FOURTH = 1.0 / 4.0;
const EIGHTH = 1.0 / 8.0;
const NINTH = 1.0 / 9.0;
const SIXTEENTH = 1.0 / 16.0;

// ============================================
// FILTER KERNELS
// ============================================

const KERNELS = {
    average: [[NINTH, NINTH, NINTH], [NINTH, NINTH, NINTH], [NINTH, NINTH, NINTH]],
    gaussianBlur: [[SIXTEENTH, EIGHTH, SIXTEENTH], [EIGHTH, FOURTH, EIGHTH], [SIXTEENTH, EIGHTH, SIXTEENTH]],
    sobelX: [[-1, -2, -1], [0, 0, 0], [1, 2, 1]],
    sobelY: [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]],
    prewittX: [[-1, -1, -1], [0, 0, 0], [1, 1, 1]],
    prewittY: [[-1, 0, 1], [-1, 0, 1], [-1, 0, 1]],
    gradientX: [[0, 0, 0], [0, 1, 0], [0, -1, 0]],
    gradientY: [[0, 0, 0], [0, 1, -1], [0, 0, 0]],
    robertsX: [[0, 0, 0], [0, 1, 0], [0, 0, -1]],
    robertsY: [[0, 0, 0], [0, 0, 1], [0, -1, 0]]
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

function clamp(value, min = 0, max = 255) {
    return Math.max(min, Math.min(max, value));
}

function normalize(matrix, w, h) {
    if (!matrix || matrix.length === 0) return matrix;

    let min = Infinity;
    let max = -Infinity;

    for (let i = 0; i < h; i++) {
        for (let j = 0; j < w; j++) {
            const val = matrix[i][j];
            if (val < min) min = val;
            if (val > max) max = val;
        }
    }

    if (min === max) {
        for (let i = 0; i < h; i++) {
            for (let j = 0; j < w; j++) {
                matrix[i][j] = 0;
            }
        }
    } else {
        for (let i = 0; i < h; i++) {
            for (let j = 0; j < w; j++) {
                matrix[i][j] = Math.round(((matrix[i][j] - min) / (max - min)) * 255);
            }
        }
    }

    return matrix;
}

function magnitude(matrixX, matrixY, w, h, doNormalize) {
    const result = [];
    for (let i = 0; i < h; i++) {
        result[i] = [];
        for (let j = 0; j < w; j++) {
            const gx = matrixX[i][j];
            const gy = matrixY[i][j];
            result[i][j] = Math.sqrt(gx * gx + gy * gy);
        }
    }
    return doNormalize ? normalize(result, w, h) : result;
}

// ============================================
// PGM PARSING
// ============================================

function parsePGM(arrayBuffer) {
    const view = new Uint8Array(arrayBuffer);
    let pos = 0;

    // Read magic number
    let magic = String.fromCharCode(view[pos], view[pos + 1]);
    pos += 2;

    if (magic !== 'P5' && magic !== 'P2') {
        throw new Error('Arquivo nao eh um PGM valido');
    }

    // Skip whitespace and comments
    function skipWhitespaceAndComments() {
        while (pos < view.length) {
            const char = view[pos];
            if (char === 10 || char === 13 || char === 32 || char === 9) {
                pos++;
            } else if (char === 35) { // '#'
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
        let numStr = '';
        while (pos < view.length) {
            const char = view[pos];
            if (char >= 48 && char <= 57) { // '0'-'9'
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

    if (magic === 'P5') {
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

    return { data, w: width, h: height, type: 'P5' };
}

// ============================================
// CONVOLUTION
// ============================================

function convolution(matrix, w, h, kernel, doNormalize = true) {
    const result = [];
    const kSize = kernel.length;
    const offset = Math.floor(kSize / 2);

    for (let i = 0; i < h; i++) {
        result[i] = [];
        for (let j = 0; j < w; j++) {
            let sum = 0;

            for (let ki = 0; ki < kSize; ki++) {
                for (let kj = 0; kj < kSize; kj++) {
                    const ii = i + ki - offset;
                    const jj = j + kj - offset;

                    const pixelValue = (ii >= 0 && ii < h && jj >= 0 && jj < w)
                        ? matrix[ii][jj]
                        : 0;

                    sum += pixelValue * kernel[ki][kj];
                }
            }

            result[i][j] = sum;
        }
    }

    return doNormalize ? normalize(result, w, h) : result;
}

// ============================================
// MEDIAN FILTER
// ============================================

function medianFilter(matrix, w, h, doNormalize = true) {
    const result = [];

    for (let i = 0; i < h; i++) {
        result[i] = [];
        for (let j = 0; j < w; j++) {
            const neighborhood = [];

            for (let di = -1; di <= 1; di++) {
                for (let dj = -1; dj <= 1; dj++) {
                    const ii = i + di;
                    const jj = j + dj;
                    if (ii >= 0 && ii < h && jj >= 0 && jj < w) {
                        neighborhood.push(matrix[ii][jj]);
                    } else {
                        neighborhood.push(0);
                    }
                }
            }

            neighborhood.sort((a, b) => a - b);
            result[i][j] = neighborhood[4]; // Median
        }
    }

    return doNormalize ? normalize(result, w, h) : result;
}

// ============================================
// HIGH-BOOST FILTER
// ============================================

function highBoostFilter(matrix, w, h, A = 1.5, doNormalize = true) {
    A = parseFloat(A);
    if (isNaN(A)) A = 1.5;

    const blurred = convolution(matrix, w, h, KERNELS.gaussianBlur, false);
    const result = [];

    for (let i = 0; i < h; i++) {
        result[i] = [];
        for (let j = 0; j < w; j++) {
            const original = matrix[i][j];
            const smooth = blurred[i][j];
            const gMask = original - smooth;
            let boosted = original + (A * gMask);
            result[i][j] = boosted;
        }
    }

    return doNormalize ? normalize(result, w, h) : result;
}

// ============================================
// MAGNITUDE FILTERS
// ============================================

function roberts(matrix, w, h, doNormalize = true) {
    const xResult = convolution(matrix, w, h, KERNELS.robertsX, false);
    const yResult = convolution(matrix, w, h, KERNELS.robertsY, false);
    return magnitude(xResult, yResult, w, h, doNormalize);
}

function sobel(matrix, w, h, doNormalize = true) {
    const xResult = convolution(matrix, w, h, KERNELS.sobelX, false);
    const yResult = convolution(matrix, w, h, KERNELS.sobelY, false);
    return magnitude(xResult, yResult, w, h, doNormalize);
}

function prewitt(matrix, w, h, doNormalize = true) {
    const xResult = convolution(matrix, w, h, KERNELS.prewittX, false);
    const yResult = convolution(matrix, w, h, KERNELS.prewittY, false);
    return magnitude(xResult, yResult, w, h, doNormalize);
}

function gradientFilter(matrix, w, h, doNormalize = true) {
    const xResult = convolution(matrix, w, h, KERNELS.gradientX, false);
    const yResult = convolution(matrix, w, h, KERNELS.gradientY, false);
    return magnitude(xResult, yResult, w, h, doNormalize);
}

// ============================================
// OPERACOES ENTRE IMAGENS
// ============================================

const OPERATORS = {
    1: (a, b) => a + b, // Add
    2: (a, b) => a - b, // Sub
    3: (a, b) => a * b, // Mul
    4: (a, b) => b === 0 ? 0 : a / b, // Div
    5: (a, b) => a | b, // OR
    6: (a, b) => a & b, // AND
    7: (a, b) => a ^ b  // XOR
};

function applyOperation(matrixA, matrixB, w, h, operatorFn, doNormalize = true) {
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
                result[i][j] = Math.round(((result[i][j] - minVal) / (maxVal - minVal)) * 255);
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
    if (!canvas || !matrix || matrix.length === 0) return;

    // Limpa o canvas e ajusta o tamanho
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);

    // Fundo cinza claro para facilitar visualização de imagens pequenas
    ctx.fillStyle = '#eaeaea';
    ctx.fillRect(0, 0, w, h);

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
    let pgm = 'P5\n';
    pgm += w + ' ' + h + '\n';
    pgm += '255\n';

    const bytes = [];
    for (let i = 0; i < h; i++) {
        for (let j = 0; j < w; j++) {
            bytes.push(clamp(Math.round(matrix[i][j])));
        }
    }

    return new Blob([pgm, new Uint8Array(bytes)], { type: 'application/octet-stream' });
}

// ============================================
// TAB MANAGEMENT
// ============================================

document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;
        document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        e.target.classList.add('active');
        document.getElementById(tabName + '-tab').classList.add('active');
    });
});

// ============================================
// FILTROS TAB
// ============================================

let filterImageState = null;

const filterUpload = document.getElementById('filter-upload');
const filterSelect = document.getElementById('filter-select');
const highboostControl = document.getElementById('highboost-control');
const highboostFactor = document.getElementById('highboost-factor');
const filterNormalize = document.getElementById('filter-normalize');
const applyFilterBtn = document.getElementById('apply-filter-btn');
const downloadFilterBtn = document.getElementById('download-filter-btn');
const filterOriginalCanvas = document.getElementById('filter-original-canvas');
const filterProcessedCanvas = document.getElementById('filter-processed-canvas');
const filterOriginalInfo = document.getElementById('filter-original-info');
const filterProcessedInfo = document.getElementById('filter-processed-info');

filterUpload.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const arrayBuffer = await file.arrayBuffer();
        filterImageState = parsePGM(arrayBuffer);
        // Primeiro ajusta o tamanho dos canvases
        filterProcessedCanvas.width = filterOriginalCanvas.width = filterImageState.w;
        filterProcessedCanvas.height = filterOriginalCanvas.height = filterImageState.h;
        // Depois desenha a imagem
        drawMatrixToCanvas(filterOriginalCanvas, filterImageState.data, filterImageState.w, filterImageState.h);
        filterOriginalInfo.textContent = `${filterImageState.w}x${filterImageState.h}px`;
    } catch (error) {
        alert('Erro ao ler imagem: ' + error.message);
    }
});

filterSelect.addEventListener('change', (e) => {
    highboostControl.style.display = e.target.value === '4' ? 'flex' : 'none';
});

applyFilterBtn.addEventListener('click', () => {
    if (!filterImageState) return alert('Carregue uma imagem primeiro');

    const filterType = parseInt(filterSelect.value);
    const doNormalize = filterNormalize.checked;
    const { data, w, h } = filterImageState;
    let result = [];

    applyFilterBtn.disabled = true;
    applyFilterBtn.textContent = 'Processando...';

    setTimeout(() => {
        switch (filterType) {
            case 0:
                result = data;
                break;
            case 1:
                result = convolution(data, w, h, KERNELS.average, doNormalize);
                break;
            case 2:
                result = medianFilter(data, w, h, doNormalize);
                break;
            case 3:
                result = convolution(data, w, h, KERNELS.gaussianBlur, doNormalize);
                break;
            case 4:
                result = highBoostFilter(data, w, h, highboostFactor.value, doNormalize);
                break;
            case 5:
                result = roberts(data, w, h, doNormalize);
                break;
            case 6:
                result = sobel(data, w, h, doNormalize);
                break;
            case 7:
                result = prewitt(data, w, h, doNormalize);
                break;
            case 8:
                result = gradientFilter(data, w, h, doNormalize);
                break;
        }

        drawMatrixToCanvas(filterProcessedCanvas, result, w, h);
        filterProcessedInfo.textContent = 'Filtro aplicado';
        applyFilterBtn.disabled = false;
        applyFilterBtn.textContent = 'Aplicar Filtro';
    }, 50);
});

downloadFilterBtn.addEventListener('click', () => {
    if (!filterImageState) return;
    const filterType = parseInt(filterSelect.value);
    if (filterType === 0) return alert('Selecione um filtro');

    const { data, w, h } = filterImageState;
    let result = [];

    switch (filterType) {
        case 1:
            result = convolution(data, w, h, KERNELS.average, filterNormalize.checked);
            break;
        case 2:
            result = medianFilter(data, w, h, filterNormalize.checked);
            break;
        case 3:
            result = convolution(data, w, h, KERNELS.gaussianBlur, filterNormalize.checked);
            break;
        case 4:
            result = highBoostFilter(data, w, h, highboostFactor.value, filterNormalize.checked);
            break;
        case 5:
            result = roberts(data, w, h, filterNormalize.checked);
            break;
        case 6:
            result = sobel(data, w, h, filterNormalize.checked);
            break;
        case 7:
            result = prewitt(data, w, h, filterNormalize.checked);
            break;
        case 8:
            result = gradientFilter(data, w, h, filterNormalize.checked);
            break;
    }

    const blob = matrixToPGM(result, w, h);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'filtered_image.pgm';
    a.click();
    URL.revokeObjectURL(url);
});

// ============================================
// OPERACOES TAB
// ============================================

let imageAState = null;
let imageBState = null;

const imgAUpload = document.getElementById('img-a-upload');
const imgBUpload = document.getElementById('img-b-upload');
const operationSelect = document.getElementById('operation-select');
const operationNormalize = document.getElementById('operation-normalize');
const applyOperationBtn = document.getElementById('apply-operation-btn');
const downloadOperationBtn = document.getElementById('download-operation-btn');
const imgACanvas = document.getElementById('img-a-canvas');
const imgBCanvas = document.getElementById('img-b-canvas');
const resultCanvas = document.getElementById('result-canvas');
const imgAInfo = document.getElementById('img-a-info');
const imgBInfo = document.getElementById('img-b-info');
const resultInfo = document.getElementById('result-info');

imgAUpload.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const arrayBuffer = await file.arrayBuffer();
        imageAState = parsePGM(arrayBuffer);
        drawMatrixToCanvas(imgACanvas, imageAState.data, imageAState.w, imageAState.h);
        imgAInfo.textContent = `${imageAState.w}x${imageAState.h}px`;
    } catch (error) {
        alert('Erro ao ler imagem A: ' + error.message);
    }
});

imgBUpload.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const arrayBuffer = await file.arrayBuffer();
        imageBState = parsePGM(arrayBuffer);
        drawMatrixToCanvas(imgBCanvas, imageBState.data, imageBState.w, imageBState.h);
        imgBInfo.textContent = `${imageBState.w}x${imageBState.h}px`;
    } catch (error) {
        alert('Erro ao ler imagem B: ' + error.message);
    }
});

applyOperationBtn.addEventListener('click', () => {
    if (!imageAState || !imageBState) {
        return alert('Carregue as duas imagens primeiro');
    }

    // Recorta ambas para o menor tamanho comum
    const minW = Math.min(imageAState.w, imageBState.w);
    const minH = Math.min(imageAState.h, imageBState.h);

    function cropMatrix(matrix, w, h, newW, newH) {
        const cropped = [];
        for (let i = 0; i < newH; i++) {
            cropped[i] = [];
            for (let j = 0; j < newW; j++) {
                cropped[i][j] = matrix[i][j];
            }
        }
        return cropped;
    }

    const matrixA = cropMatrix(imageAState.data, imageAState.w, imageAState.h, minW, minH);
    const matrixB = cropMatrix(imageBState.data, imageBState.w, imageBState.h, minW, minH);

    const operationId = parseInt(operationSelect.value);
    const doNormalize = operationNormalize.checked;
    const operatorFn = OPERATORS[operationId];

    applyOperationBtn.disabled = true;
    applyOperationBtn.textContent = 'Processando...';

    setTimeout(() => {
        const result = applyOperation(
            matrixA,
            matrixB,
            minW,
            minH,
            operatorFn,
            doNormalize
        );

        drawMatrixToCanvas(resultCanvas, result, minW, minH);
        resultInfo.textContent = 'Operacao aplicada';
        applyOperationBtn.disabled = false;
        applyOperationBtn.textContent = 'Combinar';
    }, 10);
});

downloadOperationBtn.addEventListener('click', () => {
    if (!imageAState || !imageBState) return;

    const operationId = parseInt(operationSelect.value);
    const doNormalize = operationNormalize.checked;
    const operatorFn = OPERATORS[operationId];

    const result = applyOperation(
        imageAState.data,
        imageBState.data,
        imageAState.w,
        imageAState.h,
        operatorFn,
        doNormalize
    );

    const blob = matrixToPGM(result, imageAState.w, imageAState.h);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'operation_result.pgm';
    a.click();
    URL.revokeObjectURL(url);
});

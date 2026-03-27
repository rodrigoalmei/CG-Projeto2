const imgSelector = document.getElementById("img-selector");
const filterSelector = document.getElementById("input-filter");
const applyAgainBtn = document.getElementById("apply-again-btn");
const downloadBtn = document.getElementById("download-btn");
const statusText = document.getElementById("status");
const inputMatrix = document.getElementById("input-matrix");
const inputMatrixValues = document.getElementsByName("array[]");

const originalCanvas = document.getElementById("original-img");
const processedCanvas = document.getElementById("processed-img");

const imagesPath = {
    0: "assets/fingerprint.pbm",
    2: "assets/text.pbm",
    3: "assets/map.pbm",
    4: "assets/lena.pgm",
    5: "assets/airplane.pgm",
    9: "assets/tomography.pgm"
};

let kernelList = [0, 1, 0, 1, 1, 1, 0, 1, 0];
let originalImage = null;
let processedImage = null;
let currentOperator = null;

function getKernel() {
    for (let i = 0; i < 9; i += 1) {
        kernelList[i] = parseInt(inputMatrixValues[i].value, 10) === 1 ? 1 : 0;
    }

    const sum = kernelList.reduce((acc, value) => acc + value, 0);
    if (sum === 0) {
        kernelList[4] = 1;
        inputMatrixValues[4].value = "1";
    }

    return kernelList;
}

function parsePortableImage(text) {
    const lines = text.trim().split("\n");

    let count = 0;
    const type = lines[count++].trim();
    if (lines[count] && lines[count].trim().charAt(0) === "#") count++;

    const resolution = lines[count++].trim().split(/\s+/);
    const width = Number(resolution[0]);
    const height = Number(resolution[1]);

    if (!type || !width || !height) {
        throw new Error("Cabecalho invalido.");
    }

    if (type !== "P1" && type !== "P2") {
        throw new Error("Formato nao suportado. Use P1/P2.");
    }

    if (type === "P2") {
        count++;
    }

    const separator = type === "P1" ? "" : " ";
    const flat = [];

    let k = 0;
    for (let i = count; i < lines.length; i++) {
        const line = lines[i].trim().split(separator);
        for (let j = 0; j < line.length; j++) {
            if (line[j]) {
                flat[k++] = parseInt(line[j], 10) || 0;
            }
        }
    }

    k = 0;
    const data = [];
    for (let y = 0; y < height; y += 1) {
        data[y] = [];
        for (let x = 0; x < width; x += 1) {
            data[y][x] = flat[k++] ?? 0;
        }
    }

    return {
        type,
        mode: type === "P1" ? "binary" : "grayscale",
        width,
        height,
        data
    };
}

function cloneImage(img) {
    return {
        type: img.type,
        mode: img.mode,
        width: img.width,
        height: img.height,
        data: img.data.map((row) => row.slice())
    };
}

function drawImage(canvas, img) {
    const ctx = canvas.getContext("2d");
    canvas.width = img.width;
    canvas.height = img.height;

    const imageData = ctx.createImageData(img.width, img.height);
    let offset = 0;

    for (let y = 0; y < img.height; y += 1) {
        for (let x = 0; x < img.width; x += 1) {
            const value = img.data[y][x];
            const gray = img.mode === "binary" ? (value === 0 ? 255 : 0) : value;
            imageData.data[offset++] = gray;
            imageData.data[offset++] = gray;
            imageData.data[offset++] = gray;
            imageData.data[offset++] = 255;
        }
    }

    ctx.putImageData(imageData, 0, 0);
}

function operationBinary(img, width, height, kernel, operate = "erosion") {
    const result = Array.from({ length: height }, () => Array(width).fill(0));
    const kernelSum = kernel.reduce((a, b) => a + b, 0);

    for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
            let match = 0;

            for (let ki = -1; ki <= 1; ki++) {
                for (let kj = -1; kj <= 1; kj++) {
                    const kernelIdx = (ki + 1) * 3 + (kj + 1);
                    if (!kernel[kernelIdx]) continue;

                    const ni = i + ki;
                    const nj = j + kj;
                    if (ni >= 0 && ni < height && nj >= 0 && nj < width) {
                        if (img[ni][nj]) match++;
                    }
                }
            }

            if (operate === "dilation") {
                result[i][j] = match > 0 ? 1 : 0;
            } else {
                result[i][j] = match === kernelSum ? 1 : 0;
            }
        }
    }

    return result;
}

function composition(a, b, width, height, operator) {
    const out = [];
    for (let i = 0; i < height; i++) {
        out[i] = [];
        for (let j = 0; j < width; j++) {
            out[i][j] = operator(a[i][j], b[i][j]);
        }
    }
    return out;
}

function subtract(a, b) {
    return a - b;
}

const dilation = (img, w, h, k) => operationBinary(img, w, h, k, "erosion");
const erosion = (img, w, h, k) => operationBinary(img, w, h, k, "dilation");
const opening = (img, w, h, k) => erosion(dilation(img, w, h, k), w, h, k);
const closing = (img, w, h, k) => dilation(erosion(img, w, h, k), w, h, k);
const complement = (img) => img.map((row) => row.map((pixel) => 1 - pixel));
const external = (img, w, h, k) => composition(dilation(img, w, h, k), img, w, h, subtract);
const internal = (img, w, h, k) => composition(img, erosion(img, w, h, k), w, h, subtract);
const gradient = (img, w, h, k) => composition(dilation(img, w, h, k), erosion(img, w, h, k), w, h, subtract);
const thinning = (img, w, h, k) => composition(img, gradient(img, w, h, k), w, h, subtract);

function applyGrayNeighborhood(img, kernel, op) {
    const result = Array.from({ length: img.height }, () => Array(img.width).fill(0));

    for (let y = 0; y < img.height; y += 1) {
        for (let x = 0; x < img.width; x += 1) {
            const neighbors = [];

            for (let ky = -1; ky <= 1; ky += 1) {
                for (let kx = -1; kx <= 1; kx += 1) {
                    const index = (ky + 1) * 3 + (kx + 1);
                    if (!kernel[index]) {
                        continue;
                    }

                    const ny = y + ky;
                    const nx = x + kx;
                    if (ny >= 0 && ny < img.height && nx >= 0 && nx < img.width) {
                        neighbors.push(img.data[ny][nx]);
                    } else {
                        neighbors.push(0);
                    }
                }
            }

            if (op === "erosion") {
                result[y][x] = Math.min(...neighbors);
            } else {
                result[y][x] = Math.max(...neighbors);
            }
        }
    }

    return result;
}

const erosionGray = (img, w, h, k) => applyGrayNeighborhood({ data: img, width: w, height: h }, k, "erosion");
const dilationGray = (img, w, h, k) => applyGrayNeighborhood({ data: img, width: w, height: h }, k, "dilation");
const openingGray = (img, w, h, k) => dilationGray(erosionGray(img, w, h, k), w, h, k);
const closingGray = (img, w, h, k) => erosionGray(dilationGray(img, w, h, k), w, h, k);
const gradientGray = (img, w, h, k) => composition(dilationGray(img, w, h, k), erosionGray(img, w, h, k), w, h, subtract);
const topHat = (img, w, h, k) => composition(img, openingGray(img, w, h, k), w, h, subtract);
const bottomHat = (img, w, h, k) => composition(closingGray(img, w, h, k), img, w, h, subtract);

const operators = {
    1: complement,
    2: erosion,
    3: dilation,
    4: opening,
    5: closing,
    6: external,
    7: internal,
    8: gradient,
    9: thinning,
    10: erosionGray,
    11: dilationGray,
    12: openingGray,
    13: closingGray,
    14: gradientGray,
    15: topHat,
    16: bottomHat
};

function applyOperatorBySelection() {
    if (!originalImage) return;

    const value = filterSelector.value;

    processedImage.type = originalImage.type;
    processedImage.mode = originalImage.mode;
    processedImage.width = originalImage.width;
    processedImage.height = originalImage.height;

    if (value === "0") {
        currentOperator = null;
        processedImage.data = originalImage.data.map((row) => row.slice());
    } else {
        currentOperator = operators[value];
        processedImage.data = currentOperator(originalImage.data, originalImage.width, originalImage.height, getKernel());
    }

    drawImage(processedCanvas, processedImage);
    statusText.textContent = `Operador aplicado: ${filterSelector.options[filterSelector.selectedIndex].textContent}.`;
}

function imageToText(img) {
    let text = `${img.type}\n${img.width} ${img.height}\n`;

    if (img.type === "P2") {
        text += "255\n";
    }

    for (let y = 0; y < img.height; y += 1) {
        const row = img.data[y].join(img.type === "P1" ? "" : " ");
        text += `${row}\n`;
    }

    return text;
}

function downloadImage(img) {
    const blob = new Blob([imageToText(img)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "image.pbm";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

async function loadSelectedImage() {
    const path = imagesPath[imgSelector.value];
    statusText.textContent = `Carregando ${path}...`;

    const response = await fetch(path);
    const text = await response.text();
    originalImage = parsePortableImage(text);
    processedImage = {
        type: originalImage.type,
        mode: originalImage.mode,
        width: originalImage.width,
        height: originalImage.height,
        data: originalImage.data.map((row) => row.slice())
    };

    drawImage(originalCanvas, originalImage);
    drawImage(processedCanvas, processedImage);
    statusText.textContent = "Imagem carregada. Selecione um operador.";
}

function initialize() {
    loadSelectedImage().catch((error) => {
        statusText.textContent = `Erro ao carregar imagem: ${error.message}`;
    });
}

imgSelector.addEventListener("change", () => {
    loadSelectedImage().catch((error) => {
        statusText.textContent = `Erro ao carregar imagem: ${error.message}`;
    });
});

filterSelector.addEventListener("change", applyOperatorBySelection);

applyAgainBtn.addEventListener("click", () => {
    if (!processedImage) {
        statusText.textContent = "Aplique um operador antes de reusar o resultado.";
        return;
    }

    originalImage = cloneImage(processedImage);
    drawImage(originalCanvas, originalImage);
    applyOperatorBySelection();
    statusText.textContent = "Resultado promovido para imagem de entrada.";
});

inputMatrix.addEventListener("change", () => {
    const kernel = getKernel();
    if (currentOperator) {
        processedImage.data = currentOperator(originalImage.data, originalImage.width, originalImage.height, kernel);
        drawImage(processedCanvas, processedImage);
    }
});

downloadBtn.addEventListener("click", () => {
    if (!processedImage) {
        statusText.textContent = "Nenhum resultado para baixar.";
        return;
    }
    downloadImage(processedImage);
});

initialize();

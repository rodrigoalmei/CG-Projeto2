const imgSelector = document.getElementById("img-selector");
const filterSelector = document.getElementById("input-filter");
const applyAgainBtn = document.getElementById("apply-again-btn");
const downloadBtn = document.getElementById("download-btn");
const uploadInput = document.getElementById("upload-input");
const statusText = document.getElementById("status");
const inputMatrix = document.getElementById("input-matrix");
const inputMatrixValues = document.getElementsByName("array[]");

const originalCanvas = document.getElementById("original-img");
const processedCanvas = document.getElementById("processed-img");
const originalLoupeWrap = document.getElementById("original-loupe");
const processedLoupeWrap = document.getElementById("processed-loupe");
const originalCenterText = document.getElementById("original-center");
const processedCenterText = document.getElementById("processed-center");

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
let originalHover = null;
let processedHover = null;
let originalCenter = { x: 0, y: 0 };
let processedCenter = { x: 0, y: 0 };

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

function drawFocusMarker(canvas, point, color) {
    if (!point) return;
    const ctx = canvas.getContext("2d");

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(point.x - 0.5, point.y - 0.5, 1, 1);
    ctx.fillStyle = color;
    ctx.fillRect(point.x, point.y, 1, 1);
    ctx.restore();
}

function redrawCanvasesWithMarkers() {
    if (!originalImage || !processedImage) return;

    drawImage(originalCanvas, originalImage);
    drawFocusMarker(originalCanvas, originalCenter, "#2d7ff9");
    drawFocusMarker(originalCanvas, originalHover, "#ff3b30");

    drawImage(processedCanvas, processedImage);
    drawFocusMarker(processedCanvas, processedCenter, "#2d7ff9");
    drawFocusMarker(processedCanvas, processedHover, "#ff3b30");
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function getImageCenter(img) {
    if (!img) return { x: 0, y: 0 };
    return {
        x: Math.floor(img.width / 2),
        y: Math.floor(img.height / 2)
    };
}

function getPixelForLoupe(img, x, y, fallbackZero) {
    if (!img) {
        return fallbackZero ? 0 : "-";
    }
    if (y < 0 || y >= img.height || x < 0 || x >= img.width) {
        return "-";
    }
    return img.data[y][x];
}

function renderLoupe({ wrap, centerLabel, img, center, hover, width, height, fallbackZero = false }) {
    centerLabel.textContent = `Centro: [${center.x}, ${center.y}]`;

    const effectiveWidth = Math.max(0, width || 0);
    const effectiveHeight = Math.max(0, height || 0);
    if (!effectiveWidth || !effectiveHeight) {
        wrap.innerHTML = "";
        return;
    }

    const radius = 7;
    const startX = center.x - radius;
    const startY = center.y - radius;

    let html = '<table class="loupe-table"><thead><tr>';
    html += '<th class="axis">X&rarr;<br>Y&darr;</th>';
    for (let j = 0; j < 15; j += 1) {
        const x = startX + j;
        const valid = x >= 0 && x < effectiveWidth;
        html += `<th>${valid ? x : ""}</th>`;
    }
    html += "</tr></thead><tbody>";

    for (let i = 0; i < 15; i += 1) {
        const y = startY + i;
        const validY = y >= 0 && y < effectiveHeight;
        html += "<tr>";
        html += `<td class="axis">${validY ? y : ""}</td>`;

        for (let j = 0; j < 15; j += 1) {
            const x = startX + j;
            const out = !validY || x < 0 || x >= effectiveWidth;
            const value = out ? "-" : getPixelForLoupe(img, x, y, fallbackZero);

            const isHover = hover && hover.x === x && hover.y === y;
            const isCenter = x === center.x && y === center.y;

            let klass = "";
            if (out) {
                klass = "out";
            } else if (isHover) {
                klass = "hover";
            } else if (isCenter) {
                klass = "center";
            }

            html += `<td class="${klass}" data-x="${x}" data-y="${y}">${value}</td>`;
        }

        html += "</tr>";
    }

    html += "</tbody></table>";
    wrap.innerHTML = html;
}

function renderLoupes() {
    if (!originalImage) {
        originalLoupeWrap.innerHTML = "";
        processedLoupeWrap.innerHTML = "";
        originalCenterText.textContent = "Centro: [0, 0]";
        processedCenterText.textContent = "Centro: [0, 0]";
        return;
    }

    originalCenter.x = clamp(originalCenter.x, 0, originalImage.width - 1);
    originalCenter.y = clamp(originalCenter.y, 0, originalImage.height - 1);

    renderLoupe({
        wrap: originalLoupeWrap,
        centerLabel: originalCenterText,
        img: originalImage,
        center: originalCenter,
        hover: originalHover,
        width: originalImage.width,
        height: originalImage.height,
        fallbackZero: false
    });

    const processedWidth = processedImage ? processedImage.width : originalImage.width;
    const processedHeight = processedImage ? processedImage.height : originalImage.height;
    processedCenter.x = clamp(processedCenter.x, 0, processedWidth - 1);
    processedCenter.y = clamp(processedCenter.y, 0, processedHeight - 1);

    renderLoupe({
        wrap: processedLoupeWrap,
        centerLabel: processedCenterText,
        img: processedImage,
        center: processedCenter,
        hover: processedHover,
        width: processedWidth,
        height: processedHeight,
        fallbackZero: false
    });
}

function updateHoverFromMouse(event, canvas, dimensions, setHover) {
    if (!dimensions || !dimensions.width || !dimensions.height) {
        setHover(null);
        return;
    }

    const rect = canvas.getBoundingClientRect();
    const scaleX = dimensions.width / rect.width;
    const scaleY = dimensions.height / rect.height;
    const x = Math.floor((event.clientX - rect.left) * scaleX);
    const y = Math.floor((event.clientY - rect.top) * scaleY);

    if (x >= 0 && x < dimensions.width && y >= 0 && y < dimensions.height) {
        setHover({ x, y });
    } else {
        setHover(null);
    }
}

function samePoint(a, b) {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return a.x === b.x && a.y === b.y;
}

function setupLoupeTableInteraction({ wrap, getDimensions, getHover, setHover, getCenter, setCenter }) {
    wrap.addEventListener("mousemove", (event) => {
        const cell = event.target.closest("td[data-x][data-y]");
        if (!cell || !wrap.contains(cell)) {
            return;
        }

        const dims = getDimensions();
        if (!dims || !dims.width || !dims.height) {
            return;
        }

        const x = Number(cell.dataset.x);
        const y = Number(cell.dataset.y);
        if (x < 0 || x >= dims.width || y < 0 || y >= dims.height) {
            return;
        }

        const next = { x, y };
        if (!samePoint(getHover(), next)) {
            setHover(next);
            redrawCanvasesWithMarkers();
            renderLoupes();
        }
    });

    wrap.addEventListener("mouseleave", () => {
        if (getHover()) {
            setHover(null);
            redrawCanvasesWithMarkers();
            renderLoupes();
        }
    });

    wrap.addEventListener("click", (event) => {
        const cell = event.target.closest("td[data-x][data-y]");
        if (!cell || !wrap.contains(cell)) {
            return;
        }

        const x = Number(cell.dataset.x);
        const y = Number(cell.dataset.y);
        const next = { x, y };
        if (!samePoint(getCenter(), next)) {
            setCenter(next);
            redrawCanvasesWithMarkers();
            renderLoupes();
        }
    });
}

function syncView() {
    if (!originalImage || !processedImage) return;
    redrawCanvasesWithMarkers();
    renderLoupes();
}

function resetLoupesCenter() {
    originalCenter = getImageCenter(originalImage);
    processedCenter = getImageCenter(processedImage || originalImage);
    originalHover = null;
    processedHover = null;
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
    return Math.max(0, a - b);
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

    redrawCanvasesWithMarkers();
    renderLoupes();
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

    resetLoupesCenter();
    syncView();
    statusText.textContent = "Imagem carregada. Selecione um operador.";
}

async function loadUploadedImage(file) {
    const text = await file.text();
    originalImage = parsePortableImage(text);
    processedImage = {
        type: originalImage.type,
        mode: originalImage.mode,
        width: originalImage.width,
        height: originalImage.height,
        data: originalImage.data.map((row) => row.slice())
    };

    filterSelector.value = "0";
    currentOperator = null;
    resetLoupesCenter();
    syncView();
    statusText.textContent = `Upload concluido: ${file.name}. Selecione um operador.`;
}

function initialize() {
    loadSelectedImage().catch((error) => {
        statusText.textContent = `Erro ao carregar imagem: ${error.message}`;
    });
}

imgSelector.addEventListener("change", () => {
    uploadInput.value = "";
    loadSelectedImage().catch((error) => {
        statusText.textContent = `Erro ao carregar imagem: ${error.message}`;
    });
});

uploadInput.addEventListener("change", () => {
    const file = uploadInput.files && uploadInput.files[0];
    if (!file) return;

    loadUploadedImage(file).catch((error) => {
        statusText.textContent = `Erro ao carregar upload: ${error.message}`;
    });
});

filterSelector.addEventListener("change", applyOperatorBySelection);

applyAgainBtn.addEventListener("click", () => {
    if (!processedImage) {
        statusText.textContent = "Aplique um operador antes de reusar o resultado.";
        return;
    }

    originalImage = cloneImage(processedImage);
    resetLoupesCenter();
    redrawCanvasesWithMarkers();
    applyOperatorBySelection();
    statusText.textContent = "Resultado promovido para imagem de entrada.";
});

inputMatrix.addEventListener("change", () => {
    const kernel = getKernel();
    if (currentOperator) {
        processedImage.data = currentOperator(originalImage.data, originalImage.width, originalImage.height, kernel);
        redrawCanvasesWithMarkers();
        renderLoupes();
    }
});

downloadBtn.addEventListener("click", () => {
    if (!processedImage) {
        statusText.textContent = "Nenhum resultado para baixar.";
        return;
    }
    downloadImage(processedImage);
});

originalCanvas.addEventListener("mousemove", (event) => {
    updateHoverFromMouse(event, originalCanvas, originalImage, (next) => {
        originalHover = next;
    });
    redrawCanvasesWithMarkers();
    renderLoupes();
});

originalCanvas.addEventListener("mouseleave", () => {
    originalHover = null;
    redrawCanvasesWithMarkers();
    renderLoupes();
});

originalCanvas.addEventListener("click", () => {
    if (originalHover) {
        originalCenter = { ...originalHover };
        redrawCanvasesWithMarkers();
        renderLoupes();
    }
});

processedCanvas.addEventListener("mousemove", (event) => {
    updateHoverFromMouse(event, processedCanvas, processedImage, (next) => {
        processedHover = next;
    });
    redrawCanvasesWithMarkers();
    renderLoupes();
});

processedCanvas.addEventListener("mouseleave", () => {
    processedHover = null;
    redrawCanvasesWithMarkers();
    renderLoupes();
});

processedCanvas.addEventListener("click", () => {
    if (processedHover) {
        processedCenter = { ...processedHover };
        redrawCanvasesWithMarkers();
        renderLoupes();
    }
});

setupLoupeTableInteraction({
    wrap: originalLoupeWrap,
    getDimensions: () => originalImage,
    getHover: () => originalHover,
    setHover: (value) => {
        originalHover = value;
    },
    getCenter: () => originalCenter,
    setCenter: (value) => {
        originalCenter = value;
    }
});

setupLoupeTableInteraction({
    wrap: processedLoupeWrap,
    getDimensions: () => processedImage,
    getHover: () => processedHover,
    setHover: (value) => {
        processedHover = value;
    },
    getCenter: () => processedCenter,
    setCenter: (value) => {
        processedCenter = value;
    }
});

initialize();

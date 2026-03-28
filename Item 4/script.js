const originalCanvas = document.getElementById("original-img");
const equalizedCanvas = document.getElementById("processed-img");
const originalHistCanvas = document.getElementById("original-hist");
const equalizedHistCanvas = document.getElementById("processed-hist");
const equalizeBtn = document.getElementById("equalize-btn");
const showOriginalHistBtn = document.getElementById("show-original-hist");
const showProcessedHistBtn = document.getElementById("show-processed-hist");
const downloadBtn = document.getElementById("download-btn");
const imgSelector = document.getElementById("img-selector");
const uploadInput = document.getElementById("upload-input");
const statusText = document.getElementById("status");
const originalLoupeWrap = document.getElementById("original-loupe");
const processedLoupeWrap = document.getElementById("processed-loupe");
const originalCenterText = document.getElementById("original-center");
const processedCenterText = document.getElementById("processed-center");

let originalImage = null;
let equalizedImage = null;
let originalHover = null;
let processedHover = null;
let originalCenter = { x: 0, y: 0 };
let processedCenter = { x: 0, y: 0 };

const imagesPath = {
    0: "assets/lena.pgm",
    2: "assets/airplane.pgm",
    3: "assets/pedrokid.pgm",
    4: "assets/kidnathan.pgm",
    5: "assets/pedroadult.pgm",
    6: "assets/nathanadult.pgm"
};

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function samePoint(a, b) {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return a.x === b.x && a.y === b.y;
}

function getCenterByImage(img) {
    if (!img) return { x: 0, y: 0 };
    return {
        x: Math.floor(img.width / 2),
        y: Math.floor(img.height / 2)
    };
}

function parsePortableImage(text) {
    const withoutComments = text
        .replace(/#[^\n\r]*/g, " ")
        .trim()
        .split(/\s+/);

    let cursor = 0;
    const type = withoutComments[cursor++];
    const width = Number(withoutComments[cursor++]);
    const height = Number(withoutComments[cursor++]);

    if (!type || !width || !height) {
        throw new Error("Cabecalho invalido.");
    }

    if (type !== "P2") {
        throw new Error("Somente P2 (PGM ASCII) e suportado neste item.");
    }

    const maxValue = Number(withoutComments[cursor++]);
    const values = withoutComments.slice(cursor).map(Number);

    const data = [];
    let k = 0;
    for (let y = 0; y < height; y += 1) {
        data[y] = [];
        for (let x = 0; x < width; x += 1) {
            const raw = values[k++] ?? 0;
            data[y][x] = maxValue > 0 ? Math.round((raw / maxValue) * 255) : 0;
        }
    }

    return { type, width, height, data };
}

function drawGrayImage(canvas, img) {
    const ctx = canvas.getContext("2d");
    canvas.width = img.width;
    canvas.height = img.height;

    const imageData = ctx.createImageData(img.width, img.height);
    let offset = 0;

    for (let y = 0; y < img.height; y += 1) {
        for (let x = 0; x < img.width; x += 1) {
            const value = img.data[y][x];
            imageData.data[offset++] = value;
            imageData.data[offset++] = value;
            imageData.data[offset++] = value;
            imageData.data[offset++] = 255;
        }
    }

    ctx.putImageData(imageData, 0, 0);
}

function clearCanvas(canvas) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
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
    if (!originalImage) return;

    drawGrayImage(originalCanvas, originalImage);
    drawFocusMarker(originalCanvas, originalCenter, "#2d7ff9");
    drawFocusMarker(originalCanvas, originalHover, "#ff3b30");

    if (equalizedImage) {
        drawGrayImage(equalizedCanvas, equalizedImage);
    } else {
        clearCanvas(equalizedCanvas);
    }
    drawFocusMarker(equalizedCanvas, processedCenter, "#2d7ff9");
    drawFocusMarker(equalizedCanvas, processedHover, "#ff3b30");
}

function getPixelFromImage(img, x, y, fallbackZero) {
    if (!img) {
        return fallbackZero ? 0 : "-";
    }
    if (y < 0 || y >= img.height || x < 0 || x >= img.width) {
        return "-";
    }
    return img.data[y][x];
}

function renderLoupe({ wrap, label, img, center, hover, width, height, fallbackZero = false }) {
    label.textContent = `Centro: [${center.x}, ${center.y}]`;

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
            const value = out ? "-" : getPixelFromImage(img, x, y, fallbackZero);

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
        label: originalCenterText,
        img: originalImage,
        center: originalCenter,
        hover: originalHover,
        width: originalImage.width,
        height: originalImage.height,
        fallbackZero: false
    });

    const processedWidth = equalizedImage ? equalizedImage.width : originalImage.width;
    const processedHeight = equalizedImage ? equalizedImage.height : originalImage.height;
    processedCenter.x = clamp(processedCenter.x, 0, processedWidth - 1);
    processedCenter.y = clamp(processedCenter.y, 0, processedHeight - 1);

    renderLoupe({
        wrap: processedLoupeWrap,
        label: processedCenterText,
        img: equalizedImage,
        center: processedCenter,
        hover: processedHover,
        width: processedWidth,
        height: processedHeight,
        fallbackZero: !equalizedImage
    });
}

function updateHoverFromMouse(event, canvas, dims, setHover) {
    if (!dims || !dims.width || !dims.height) {
        setHover(null);
        return;
    }

    const rect = canvas.getBoundingClientRect();
    const scaleX = dims.width / rect.width;
    const scaleY = dims.height / rect.height;
    const x = Math.floor((event.clientX - rect.left) * scaleX);
    const y = Math.floor((event.clientY - rect.top) * scaleY);

    if (x >= 0 && x < dims.width && y >= 0 && y < dims.height) {
        setHover({ x, y });
    } else {
        setHover(null);
    }
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
        if (!samePoint(getCenter(), next)) {
            setCenter(next);
            redrawCanvasesWithMarkers();
            renderLoupes();
        }
    });
}

function buildHistogram(img) {
    const hist = new Array(256).fill(0);
    for (let y = 0; y < img.height; y += 1) {
        for (let x = 0; x < img.width; x += 1) {
            const value = Math.max(0, Math.min(255, Math.round(img.data[y][x])));
            hist[value] += 1;
        }
    }
    return hist;
}

function getHistProb(hist, n) {
    const h = [];
    for (let i = 0; i < 256; i += 1) {
        h[i] = hist[i] / n;
    }
    return h;
}

function getAccumulatedProba(histProb) {
    const acc = [];
    let sum = 0;
    for (let i = 0; i < 256; i += 1) {
        sum += histProb[i];
        acc[i] = sum;
    }
    return acc;
}

function getScaleArr(acc) {
    const scale = new Array(256).fill(0);
    for (let i = 0; i < 256; i += 1) {
        scale[i] = Math.max(0, Math.min(255, Math.round(acc[i] * 255)));
    }
    return scale;
}

function equalize(img) {
    const hist = buildHistogram(img);
    const histProb = getHistProb(hist, img.width * img.height);
    const acc = getAccumulatedProba(histProb);
    const scale = getScaleArr(acc);

    const resultData = [];
    for (let y = 0; y < img.height; y += 1) {
        resultData[y] = [];
        for (let x = 0; x < img.width; x += 1) {
            resultData[y][x] = scale[img.data[y][x]];
        }
    }

    return {
        type: img.type,
        width: img.width,
        height: img.height,
        data: resultData
    };
}

function drawHistogram(canvas, histogram, color) {
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);
    const maxVal = Math.max(...histogram);
    if (maxVal === 0) return;

    const barWidth = width / 256;
    ctx.fillStyle = color;

    for (let i = 0; i < 256; i += 1) {
        const barHeight = (histogram[i] / maxVal) * (height * 0.9);
        ctx.fillRect(i * barWidth, height - barHeight, barWidth, barHeight);
    }

    const cumulative = new Array(256).fill(0);
    let running = 0;
    for (let i = 0; i < 256; i += 1) {
        running += histogram[i];
        cumulative[i] = running;
    }

    const maxCdf = cumulative[255] || 1;
    ctx.strokeStyle = "#0b2239";
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let i = 0; i < 256; i += 1) {
        const x = i * barWidth + barWidth / 2;
        const normalized = cumulative[i] / maxCdf;
        const y = height - normalized * (height * 0.9);

        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }

    ctx.stroke();
}

function imageToText(img) {
    let text = `${img.type}\n${img.width} ${img.height}\n255\n`;
    for (let y = 0; y < img.height; y += 1) {
        text += `${img.data[y].join(" ")}\n`;
    }
    return text;
}

function downloadImage(img) {
    const blob = new Blob([imageToText(img)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "image.pgm";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function updateView() {
    if (!originalImage) {
        return;
    }

    redrawCanvasesWithMarkers();
    renderLoupes();
}

function resetCenters() {
    originalCenter = getCenterByImage(originalImage);
    processedCenter = equalizedImage ? getCenterByImage(equalizedImage) : { ...originalCenter };
    originalHover = null;
    processedHover = null;
}

async function loadFromFile(file) {
    const text = await file.text();
    originalImage = parsePortableImage(text);
    equalizedImage = null;
    resetCenters();
    updateView();
    clearCanvas(originalHistCanvas);
    clearCanvas(equalizedHistCanvas);
    statusText.textContent = `Imagem carregada via upload: ${file.name}. Clique em Equalizar para gerar a processada.`;
}

async function loadLena() {
    const path = imagesPath[imgSelector.value] || "assets/lena.pgm";
    statusText.textContent = `Carregando ${path}...`;
    const response = await fetch(path);
    const text = await response.text();
    originalImage = parsePortableImage(text);

    equalizedImage = null;
    resetCenters();
    updateView();

    clearCanvas(originalHistCanvas);
    clearCanvas(equalizedHistCanvas);
    statusText.textContent = "Imagem original carregada. Clique em Equalizar para gerar a processada.";
}

imgSelector.addEventListener("change", () => {
    uploadInput.value = "";
    loadLena().catch((error) => {
        statusText.textContent = `Erro ao carregar imagem: ${error.message}`;
    });
});

uploadInput.addEventListener("change", () => {
    const file = uploadInput.files && uploadInput.files[0];
    if (!file) return;

    loadFromFile(file).catch((error) => {
        statusText.textContent = `Erro ao carregar upload: ${error.message}`;
    });
});

equalizeBtn.addEventListener("click", () => {
    if (!originalImage) {
        return;
    }
    equalizedImage = equalize(originalImage);
    processedCenter = getCenterByImage(equalizedImage);
    processedHover = null;
    updateView();
    statusText.textContent = "Equalizacao recalculada com sucesso.";
});

showOriginalHistBtn.addEventListener("click", () => {
    if (!originalImage) return;
    drawHistogram(originalHistCanvas, buildHistogram(originalImage), "#2f8fca");
});

showProcessedHistBtn.addEventListener("click", () => {
    if (!equalizedImage) return;
    drawHistogram(equalizedHistCanvas, buildHistogram(equalizedImage), "#0f6a8f");
});

downloadBtn.addEventListener("click", () => {
    if (!equalizedImage) {
        statusText.textContent = "Nenhuma imagem equalizada para baixar.";
        return;
    }
    downloadImage(equalizedImage);
});

originalCanvas.addEventListener("mousemove", (event) => {
    updateHoverFromMouse(event, originalCanvas, originalImage, (nextHover) => {
        originalHover = nextHover;
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

equalizedCanvas.addEventListener("mousemove", (event) => {
    const dims = equalizedImage || originalImage;
    updateHoverFromMouse(event, equalizedCanvas, dims, (nextHover) => {
        processedHover = nextHover;
    });
    redrawCanvasesWithMarkers();
    renderLoupes();
});

equalizedCanvas.addEventListener("mouseleave", () => {
    processedHover = null;
    redrawCanvasesWithMarkers();
    renderLoupes();
});

equalizedCanvas.addEventListener("click", () => {
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
    getDimensions: () => equalizedImage || originalImage,
    getHover: () => processedHover,
    setHover: (value) => {
        processedHover = value;
    },
    getCenter: () => processedCenter,
    setCenter: (value) => {
        processedCenter = value;
    }
});

loadLena().catch((error) => {
    statusText.textContent = `Erro ao carregar imagem: ${error.message}`;
});

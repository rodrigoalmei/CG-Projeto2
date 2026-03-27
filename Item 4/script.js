const originalCanvas = document.getElementById("original-img");
const equalizedCanvas = document.getElementById("processed-img");
const originalHistCanvas = document.getElementById("original-hist");
const equalizedHistCanvas = document.getElementById("processed-hist");
const equalizeBtn = document.getElementById("equalize-btn");
const showOriginalHistBtn = document.getElementById("show-original-hist");
const showProcessedHistBtn = document.getElementById("show-processed-hist");
const downloadBtn = document.getElementById("download-btn");
const imgSelector = document.getElementById("img-selector");
const statusText = document.getElementById("status");

let originalImage = null;
let equalizedImage = null;

const imagesPath = {
    0: "assets/lena.pgm",
    2: "assets/airplane.pgm",
    3: "assets/pedrokid.pgm",
    4: "assets/kidnathan.pgm",
    5: "assets/pedroadult.pgm",
    6: "assets/nathanadult.pgm"
};

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

function buildHistogram(img) {
    const hist = new Array(256).fill(0);
    for (let y = 0; y < img.height; y += 1) {
        for (let x = 0; x < img.width; x += 1) {
            hist[img.data[y][x]] += 1;
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
    const scale = [];
    scale[0] = 0;
    for (let i = 1; i < 256; i += 1) {
        scale[i] = Math.ceil(acc[i] * 255);
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
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    const range = 256;
    const vPadding = 20;
    const paddingLeft = Math.floor(width * 0.2);
    const graphWidth = range;
    const graphHeight = height - 2 * vPadding;
    const yBase = height - vPadding;

    const min = Math.min(...histogram);
    const max = Math.max(...histogram, 1);

    // Eixos e rotulos no mesmo estilo do modulo base.
    ctx.save();
    ctx.translate(paddingLeft, vPadding);

    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-2, yBase - vPadding + 2);
    ctx.lineTo(graphWidth, yBase - vPadding + 2);
    ctx.moveTo(-2, yBase - vPadding + 2);
    ctx.lineTo(-2, vPadding);
    ctx.stroke();

    ctx.fillStyle = "#000";
    ctx.font = "10px Helvetica";
    ctx.fillText("0", 2, yBase - vPadding + 14);
    ctx.fillText("255", graphWidth + 2, yBase - vPadding + 14);
    ctx.fillText("< Nivel de cinza >", graphWidth / 2 - 35, yBase - vPadding + 14);
    ctx.fillText(String(min), -24, yBase - vPadding);
    ctx.fillText(String(max), -24, vPadding + 2);
    ctx.fillText("1 - FDA", graphWidth + 2, vPadding + 2);

    ctx.save();
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("< Intensidade >", -graphHeight / 2 - 14, 18);
    ctx.restore();

    const barWidth = graphWidth / range;
    ctx.fillStyle = color;

    for (let i = 0; i < range; i += 1) {
        const barHeight = ((histogram[i] - min) / Math.max(1, max - min)) * graphHeight;
        const x = i * barWidth;
        const y = yBase - vPadding - barHeight;
        if (barHeight > 0) {
            ctx.fillRect(x, y, Math.max(1, barWidth), barHeight);
        }
    }

    // Curva CDF sobreposta, como no modulo base de histograma.
    const cumulative = [];
    let running = 0;
    for (let i = 0; i < 256; i += 1) {
        running += histogram[i];
        cumulative[i] = running;
    }

    const minCdf = Math.min(...cumulative);
    const maxCdf = Math.max(...cumulative) || 1;

    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < range; i += 1) {
        const normalized = (cumulative[i] - minCdf) / Math.max(1, maxCdf - minCdf);
        const y = yBase - vPadding - normalized * graphHeight;
        const x = i * barWidth;

        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.stroke();
    ctx.restore();
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

    drawGrayImage(originalCanvas, originalImage);

    if (equalizedImage) {
        drawGrayImage(equalizedCanvas, equalizedImage);
    } else {
        clearCanvas(equalizedCanvas);
    }
}

async function loadLena() {
    const path = imagesPath[imgSelector.value] || "assets/lena.pgm";
    statusText.textContent = `Carregando ${path}...`;
    const response = await fetch(path);
    const text = await response.text();
    originalImage = parsePortableImage(text);

    // No fluxo base, a imagem processada nasce apenas apos clicar em Equalizar.
    equalizedImage = null;
    updateView();

    clearCanvas(originalHistCanvas);
    clearCanvas(equalizedHistCanvas);
    statusText.textContent = "Imagem original carregada. Clique em Equalizar para gerar a processada.";
}

imgSelector.addEventListener("change", () => {
    loadLena().catch((error) => {
        statusText.textContent = `Erro ao carregar imagem: ${error.message}`;
    });
});

equalizeBtn.addEventListener("click", () => {
    if (!originalImage) {
        return;
    }
    equalizedImage = equalize(originalImage);
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

loadLena().catch((error) => {
    statusText.textContent = `Erro ao carregar imagem: ${error.message}`;
});

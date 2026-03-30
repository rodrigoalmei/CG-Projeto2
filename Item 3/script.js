// script.js - Item 3 - Transformações de Intensidade

let originalImage = null;
let width = 0, height = 0;

const upload = document.getElementById('upload');
const originalCanvas = document.getElementById('original');
const resultCanvas = document.getElementById('result');
const ctxOriginal = originalCanvas.getContext('2d');
const ctxResult = resultCanvas.getContext('2d');

upload.addEventListener('change', handleFile);

function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (ev) {
        const pgm = parsePGM(ev.target.result);
        if (!pgm) {
            alert('Arquivo PGM inválido.');
            return;
        }
        width = pgm.width;
        height = pgm.height;
        originalImage = pgm.pixels;
        // Reset loupe centers and hovers to image center
        originalCenter = { x: Math.floor(width / 2), y: Math.floor(height / 2) };
        resultCenter = { x: Math.floor(width / 2), y: Math.floor(height / 2) };
        originalHover = null;
        resultHover = null;
        drawImage(originalCanvas, originalImage, width, height);
        clearCanvas(resultCanvas);
        lastTransformedImage = null;
        redrawLoupes();
    };
    reader.readAsText(file);
}

function parsePGM(data) {
    // Suporta P2 (ASCII) PGM
    const lines = data.split(/\r?\n/).filter(l => l && !l.startsWith('#'));
    if (lines[0] !== 'P2') return null;
    let [w, h] = lines[1].split(' ').map(Number);
    let max = parseInt(lines[2]);
    let pixels = lines.slice(3).join(' ').split(/\s+/).map(Number);
    if (pixels.length !== w * h) return null;
    return { width: w, height: h, max, pixels };
}

function drawImage(canvas, pixels, w, h) {
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
        const v = pixels[i];
        imgData.data[i * 4 + 0] = v;
        imgData.data[i * 4 + 1] = v;
        imgData.data[i * 4 + 2] = v;
        imgData.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
}

function clearCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function getTransformedImage(transformFn) {
    if (!originalImage) return;
    const out = originalImage.map(transformFn);
    lastTransformedImage = out;
    drawImage(resultCanvas, out, width, height);
    redrawLoupe();
}

// a) Negativo
function applyNegative() {
    getTransformedImage(r => 255 - r);
}

// b) Gamma (corrigido: expoente 1/gamma)
function applyGamma() {
    const gamma = parseFloat(document.getElementById('gammaValue').value);
    if (gamma <= 0) {
        getTransformedImage(r => r);
        return;
    }
    getTransformedImage(r => Math.round(Math.pow(r / 255, 1 / gamma) * 255));
}

// c) Logarítmica (corrigido: fator c)
function applyLog() {
    const a = parseFloat(document.getElementById('logA').value);
    const c = 255 / Math.log(1 + 255);
    getTransformedImage(r => {
        const val = Math.round(a * c * Math.log(r + 1));
        return Math.max(0, Math.min(255, val));
    });
}

// d) Sigmoide (corrigido: função sigmoide)
function applyGeneral() {
    const w = parseInt(document.getElementById('generalW').value);
    const a = parseInt(document.getElementById('generalA').value);
    // Evita divisão por zero
    getTransformedImage(r => {
        if (a === 0) return r < w ? 0 : 255;
        return Math.round(255 / (1 + Math.exp(-(r - w) / a)));
    });
}

// e) Faixa Dinâmica (corrigido: mapeamento linear)
function applyDynamicRange() {
    const targetValue = parseInt(document.getElementById('dynamicTarget')?.value || 255);
    getTransformedImage(r => Math.round((r / 255) * targetValue));
}

// f) Linear (corrigido: parâmetros a e b)
function applyLinear() {
    const a = parseFloat(document.getElementById('linearA')?.value || 1.2);
    const b = parseFloat(document.getElementById('linearB')?.value || 30);
    getTransformedImage(r => {
        const val = Math.round(a * r + b);
        return Math.max(0, Math.min(255, val));
    });
}

// --- NOVO: Transformação dinâmica via select ---
const transformSelect = document.getElementById('transformSelect');
const inputsArea = document.getElementById('inputs-area');
const applyBtn = document.getElementById('applyBtn');

const inputConfigs = {
    negative: [],
    gamma: [
        { id: 'gammaValue', label: 'γ', type: 'number', min: 0.01, max: 5, step: 0.01, value: 0.5 }
    ],
    log: [
        { id: 'logA', label: 'a', type: 'number', min: 0.1, step: 0.1, value: 1 }
    ],
    general: [
        { id: 'generalW', label: 'w', type: 'number', min: 0, max: 255, value: 128 },
        { id: 'generalA', label: 'a (sigma)', type: 'number', min: 1, max: 255, value: 25 }
    ],
    dynamic: [
        { id: 'dynamicTarget', label: 'Valor alvo', type: 'number', min: 1, max: 255, value: 255 }
    ],
    linear: [
        { id: 'linearA', label: 'a', type: 'number', min: 0, max: 5, step: 0.01, value: 1.2 },
        { id: 'linearB', label: 'b', type: 'number', min: -255, max: 255, step: 1, value: 30 }
    ]
};

function renderInputs() {
    const selected = transformSelect.value;
    inputsArea.innerHTML = '';
    inputConfigs[selected].forEach(cfg => {
        const label = document.createElement('label');
        label.htmlFor = cfg.id;
        label.textContent = cfg.label;
        label.style.marginLeft = '8px';
        const input = document.createElement('input');
        input.type = cfg.type;
        input.id = cfg.id;
        input.min = cfg.min;
        if (cfg.max !== undefined) input.max = cfg.max;
        if (cfg.step !== undefined) input.step = cfg.step;
        input.value = cfg.value;
        input.style.marginRight = '8px';
        inputsArea.appendChild(label);
        inputsArea.appendChild(input);
    });
}

transformSelect.addEventListener('change', renderInputs);
window.addEventListener('DOMContentLoaded', renderInputs);

function applySelectedTransform() {
    const selected = transformSelect.value;
    switch (selected) {
        case 'negative':
            applyNegative(); break;
        case 'gamma':
            applyGamma(); break;
        case 'log':
            applyLog(); break;
        case 'general':
            applyGeneral(); break;
        case 'dynamic':
            applyDynamicRange(); break;
        case 'linear':
            applyLinear(); break;
    }
}

// Adiciona botão de download
const downloadBtn = document.createElement('button');
downloadBtn.textContent = 'Baixar Transformada (PGM)';
downloadBtn.className = 'toolbar-download';
downloadBtn.style.marginLeft = '10px';
downloadBtn.onclick = () => {
    if (!lastTransformedImage) return;
    downloadPGM(lastTransformedImage, width, height);
};

// Adiciona o botão na interface
window.addEventListener('DOMContentLoaded', () => {
    const toolbar = document.querySelector('.toolbar');
    if (toolbar) {
        toolbar.appendChild(downloadBtn);
    }
});

// Salva a última imagem transformada
let lastTransformedImage = null;
function downloadPGM(pixels, w, h, filename = "transformada.pgm") {
    // Gera P2 (ASCII)
    let header = `P2\n${w} ${h}\n255\n`;
    let body = '';
    for (let i = 0; i < pixels.length; i++) {
        body += pixels[i] + ((i + 1) % w === 0 ? '\n' : ' ');
    }
    const pgm = header + body;
    const blob = new Blob([pgm], { type: 'image/x-portable-graymap' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// --- Lupa/Matriz dinâmica para imagem original e transformada ---
const originalLoupeWrap = document.getElementById('original-loupe');
const resultLoupeWrap = document.getElementById('result-loupe');
const originalCenterText = document.getElementById('original-center');
const resultCenterText = document.getElementById('result-center');

let originalCenter = { x: 0, y: 0 };
let resultCenter = { x: 0, y: 0 };
let originalHover = null;
let resultHover = null;

function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

function getPixel(pixels, w, h, x, y) {
    if (!pixels || x < 0 || x >= w || y < 0 || y >= h) return '-';
    return pixels[y * w + x];
}

function renderLoupe({ wrap, label, pixels, w, h, center, hover }) {
    label.textContent = `Centro: [${center.x}, ${center.y}]`;
    if (!pixels || !w || !h) {
        wrap.innerHTML = '';
        return;
    }
    center.x = clamp(center.x, 0, w - 1);
    center.y = clamp(center.y, 0, h - 1);
    const radius = 7;
    const startX = center.x - radius;
    const startY = center.y - radius;
    let html = '<table class="loupe-table"><thead><tr>';
    html += '<th class="axis">X&rarr;<br>Y&darr;</th>';
    for (let j = 0; j < 15; j++) {
        const x = startX + j;
        const valid = x >= 0 && x < w;
        html += `<th>${valid ? x : ''}</th>`;
    }
    html += '</tr></thead><tbody>';
    for (let i = 0; i < 15; i++) {
        const y = startY + i;
        const validY = y >= 0 && y < h;
        html += '<tr>';
        html += `<td class="axis">${validY ? y : ''}</td>`;
        for (let j = 0; j < 15; j++) {
            const x = startX + j;
            const out = !validY || x < 0 || x >= w;
            const value = out ? '-' : getPixel(pixels, w, h, x, y);
            const isHover = hover && hover.x === x && hover.y === y;
            const isCenter = x === center.x && y === center.y;
            let klass = '';
            if (out) klass = 'out';
            else if (isHover) klass = 'hover';
            else if (isCenter) klass = 'center';
            html += `<td class="${klass}" data-x="${x}" data-y="${y}">${value}</td>`;
        }
        html += '</tr>';
    }
    html += '</tbody></table>';
    wrap.innerHTML = html;
}

function redrawLoupes() {
    // Original
    if (!originalImage) {
        renderLoupe({ wrap: originalLoupeWrap, label: originalCenterText, pixels: null, w: 0, h: 0, center: originalCenter, hover: originalHover });
    } else {
        renderLoupe({ wrap: originalLoupeWrap, label: originalCenterText, pixels: originalImage, w: width, h: height, center: originalCenter, hover: originalHover });
    }
    // Transformada
    if (!lastTransformedImage) {
        renderLoupe({ wrap: resultLoupeWrap, label: resultCenterText, pixels: null, w: 0, h: 0, center: resultCenter, hover: resultHover });
    } else {
        renderLoupe({ wrap: resultLoupeWrap, label: resultCenterText, pixels: lastTransformedImage, w: width, h: height, center: resultCenter, hover: resultHover });
    }
}

// --- Canvas interaction for both images ---
originalCanvas.addEventListener('mousemove', (e) => {
    if (!originalImage) return;
    const rect = originalCanvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) * (width / rect.width));
    const y = Math.floor((e.clientY - rect.top) * (height / rect.height));
    if (x >= 0 && x < width && y >= 0 && y < height) {
        originalHover = { x, y };
    } else {
        originalHover = null;
    }
    redrawLoupes();
});
originalCanvas.addEventListener('mouseleave', () => {
    originalHover = null;
    redrawLoupes();
});
originalCanvas.addEventListener('click', (e) => {
    if (!originalImage) return;
    const rect = originalCanvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) * (width / rect.width));
    const y = Math.floor((e.clientY - rect.top) * (height / rect.height));
    if (x >= 0 && x < width && y >= 0 && y < height) {
        originalCenter = { x, y };
        redrawLoupes();
    }
});

resultCanvas.addEventListener('mousemove', (e) => {
    if (!lastTransformedImage) return;
    const rect = resultCanvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) * (width / rect.width));
    const y = Math.floor((e.clientY - rect.top) * (height / rect.height));
    if (x >= 0 && x < width && y >= 0 && y < height) {
        resultHover = { x, y };
    } else {
        resultHover = null;
    }
    redrawLoupes();
});
resultCanvas.addEventListener('mouseleave', () => {
    resultHover = null;
    redrawLoupes();
});
resultCanvas.addEventListener('click', (e) => {
    if (!lastTransformedImage) return;
    const rect = resultCanvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) * (width / rect.width));
    const y = Math.floor((e.clientY - rect.top) * (height / rect.height));
    if (x >= 0 && x < width && y >= 0 && y < height) {
        resultCenter = { x, y };
        redrawLoupes();
    }
});

// --- Loupe table interaction for both images ---
function setupLoupeTableInteraction(wrap, getCenter, setCenter, getHover, setHover, w, h) {
    wrap.addEventListener('mousemove', (event) => {
        const cell = event.target.closest('td[data-x][data-y]');
        if (!cell || !wrap.contains(cell)) return;
        const x = Number(cell.dataset.x);
        const y = Number(cell.dataset.y);
        if (x < 0 || x >= w || y < 0 || y >= h) return;
        setHover({ x, y });
        redrawLoupes();
    });
    wrap.addEventListener('mouseleave', () => {
        setHover(null);
        redrawLoupes();
    });
    wrap.addEventListener('click', (event) => {
        const cell = event.target.closest('td[data-x][data-y]');
        if (!cell || !wrap.contains(cell)) return;
        const x = Number(cell.dataset.x);
        const y = Number(cell.dataset.y);
        if (x < 0 || x >= w || y < 0 || y >= h) return;
        setCenter({ x, y });
        redrawLoupes();
    });
}

window.addEventListener('DOMContentLoaded', () => {
    redrawLoupes();
    setupLoupeTableInteraction(
        originalLoupeWrap,
        () => originalCenter,
        (v) => { originalCenter = v; },
        () => originalHover,
        (v) => { originalHover = v; },
        width,
        height
    );
    setupLoupeTableInteraction(
        resultLoupeWrap,
        () => resultCenter,
        (v) => { resultCenter = v; },
        () => resultHover,
        (v) => { resultHover = v; },
        width,
        height
    );
});

// Atualiza as lupas sempre que a imagem transformada mudar
function getTransformedImage(transformFn) {
    if (!originalImage) return;
    const out = originalImage.map(transformFn);
    lastTransformedImage = out;
    drawImage(resultCanvas, out, width, height);
    redrawLoupes();
}

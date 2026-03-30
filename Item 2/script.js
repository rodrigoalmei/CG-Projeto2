const childCanvas = document.getElementById("child-canvas");
const adultCanvas = document.getElementById("adult-canvas");
const morphCanvas = document.getElementById("morph-canvas");

const childCtx = childCanvas.getContext("2d");
const adultCtx = adultCanvas.getContext("2d");
const morphCtx = morphCanvas.getContext("2d");

const fileChild = document.getElementById("file-child");
const fileAdult = document.getElementById("file-adult");
const timeSlider = document.getElementById("time-slider");
const timeValue = document.getElementById("time-value");
const renderBtn = document.getElementById("render-btn");
const playBtn = document.getElementById("play-btn");
const resetMorphBtn = document.getElementById("reset-morph-btn");
const statusText = document.getElementById("status");

const markingControls = document.getElementById("marking-controls");
const morphControls = document.getElementById("morph-controls");
const startMarkingBtn = document.getElementById("start-marking-btn");
const undoChildBtn = document.getElementById("undo-child-btn");
const undoAdultBtn = document.getElementById("undo-adult-btn");
const doneMarkingBtn = document.getElementById("done-marking-btn");
const pointInstruction = document.getElementById("point-instruction");

const HANDLE_RADIUS = 5;

let imageChild = null;
let imageAdult = null;
let morphImage = null;

let pointsChild = [];
let pointsAdult = [];
let triangles = [];

let isMarking = false;

let isPlaying = false;
let animationId = null;
let previousAnimationTime = 0;
let isProcessingDoneMarking = false;

function createImageObject(width, height, data) {
    return { width, height, data };
}

function cloneImage(image) {
    return createImageObject(image.width, image.height, new Uint8ClampedArray(image.data));
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function normalizeValue(value, maxValue) {
    if (maxValue <= 0) return 0;
    return Math.round((value / maxValue) * 255);
}

function parsePGM(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    let cursor = 0;

    function skipWhitespaceAndComments() {
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
    }

    function readToken() {
        skipWhitespaceAndComments();
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

    if (magic !== "P2" && magic !== "P5") {
        throw new Error("Use arquivo PGM nos formatos P2 ou P5.");
    }

    if (!width || !height) {
        throw new Error("Cabecalho PGM invalido.");
    }

    const maxValue = Number(readToken());
    skipWhitespaceAndComments();

    const total = width * height;
    const data = new Uint8ClampedArray(total);

    if (magic === "P2") {
        const decoder = new TextDecoder("ascii");
        const text = decoder.decode(bytes.slice(cursor));
        const values = text.replace(/#[^\n\r]*/g, " ").trim().split(/\s+/).map(Number);
        for (let i = 0; i < total; i += 1) {
            data[i] = normalizeValue(values[i] || 0, maxValue);
        }
    } else {
        if (maxValue > 255) {
            for (let i = 0; i < total; i += 1) {
                const high = bytes[cursor + i * 2] || 0;
                const low = bytes[cursor + i * 2 + 1] || 0;
                data[i] = normalizeValue((high << 8) | low, maxValue);
            }
        } else {
            for (let i = 0; i < total; i += 1) {
                data[i] = normalizeValue(bytes[cursor + i] || 0, maxValue);
            }
        }
    }

    return createImageObject(width, height, data);
}

function browserImageToGrayscale(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const image = new Image();
            image.onload = () => {
                const tempCanvas = document.createElement("canvas");
                const tempCtx = tempCanvas.getContext("2d");
                tempCanvas.width = image.naturalWidth;
                tempCanvas.height = image.naturalHeight;
                tempCtx.drawImage(image, 0, 0);

                const rgba = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height).data;
                const data = new Uint8ClampedArray(tempCanvas.width * tempCanvas.height);

                for (let i = 0; i < data.length; i += 1) {
                    const r = rgba[i * 4];
                    const g = rgba[i * 4 + 1];
                    const b = rgba[i * 4 + 2];
                    data[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
                }

                resolve(createImageObject(tempCanvas.width, tempCanvas.height, data));
            };
            image.onerror = () => reject(new Error("Falha ao ler imagem."));
            image.src = reader.result;
        };
        reader.onerror = () => reject(new Error("Falha ao abrir arquivo."));
        reader.readAsDataURL(file);
    });
}

async function loadImageFromFile(file) {
    const name = file.name.toLowerCase();
    if (name.endsWith(".pgm")) {
        const buffer = await file.arrayBuffer();
        return parsePGM(buffer);
    }
    return browserImageToGrayscale(file);
}

function resizeImageNearest(image, newWidth, newHeight) {
    if (image.width === newWidth && image.height === newHeight) {
        return cloneImage(image);
    }

    const resized = new Uint8ClampedArray(newWidth * newHeight);
    for (let y = 0; y < newHeight; y += 1) {
        const srcY = Math.round((y / Math.max(1, newHeight - 1)) * (image.height - 1));
        for (let x = 0; x < newWidth; x += 1) {
            const srcX = Math.round((x / Math.max(1, newWidth - 1)) * (image.width - 1));
            resized[y * newWidth + x] = image.data[srcY * image.width + srcX];
        }
    }

    return createImageObject(newWidth, newHeight, resized);
}

function imageToImageData(image) {
    const imageData = new ImageData(image.width, image.height);
    for (let i = 0; i < image.data.length; i += 1) {
        const gray = image.data[i];
        imageData.data[i * 4] = gray;
        imageData.data[i * 4 + 1] = gray;
        imageData.data[i * 4 + 2] = gray;
        imageData.data[i * 4 + 3] = 255;
    }
    return imageData;
}

function drawBaseImage(ctx, canvas, image) {
    canvas.width = image.width;
    canvas.height = image.height;
    ctx.putImageData(imageToImageData(image), 0, 0);
}

function drawPoints(ctx, points, color) {
    ctx.save();
    for (let i = 0; i < points.length; i += 1) {
        const p = points[i];
        ctx.beginPath();
        ctx.arc(p.x, p.y, HANDLE_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = "#000";
        ctx.font = "10px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(i + 1), p.x, p.y);
    }
    ctx.restore();
}

function drawTriangulation(ctx, points, triangles) {
    if (!triangles || triangles.length === 0) return;

    ctx.save();
    ctx.strokeStyle = "rgba(200, 150, 255, 0.4)";
    ctx.lineWidth = 1;

    for (const tri of triangles) {
        const p0 = points[tri[0]];
        const p1 = points[tri[1]];
        const p2 = points[tri[2]];

        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.closePath();
        ctx.stroke();
    }

    ctx.restore();
}

// Triangulação de Delaunay — algoritmo Bowyer-Watson, sem biblioteca externa.
function triangulateDelaunay(points) {
    if (points.length < 3) return [];

    // Calcula circumcírculo de um triângulo (índices em pts)
    function circumcircle(pts, i, j, k) {
        const ax = pts[i].x, ay = pts[i].y;
        const bx = pts[j].x, by = pts[j].y;
        const cx = pts[k].x, cy = pts[k].y;

        const D = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
        if (Math.abs(D) < 1e-10) return null; // pontos colineares

        const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / D;
        const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / D;

        const dx = ax - ux;
        const dy = ay - uy;
        const r2 = dx * dx + dy * dy;

        return { cx: ux, cy: uy, r2 };
    }

    // Ponto dentro do circumcírculo?
    function inCircumcircle(cc, px, py) {
        const dx = px - cc.cx;
        const dy = py - cc.cy;
        return dx * dx + dy * dy < cc.r2 - 1e-10;
    }

    // Super-triângulo que contém todos os pontos
    let minX = points[0].x, minY = points[0].y;
    let maxX = minX, maxY = minY;
    for (const p of points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
    }
    const dx = maxX - minX;
    const dy = maxY - minY;
    const delta = Math.max(dx, dy) * 10;

    const st = [
        { x: minX - delta, y: minY - delta },
        { x: minX + dx / 2, y: maxY + delta },
        { x: maxX + delta, y: minY - delta },
    ];

    // Trabalha com cópia dos pontos + super-triângulo no final
    const pts = [...points, ...st];
    const n = points.length;
    const s0 = n, s1 = n + 1, s2 = n + 2;

    // Lista de triângulos: cada entrada é { verts: [i,j,k], cc }
    let tris = [];
    const cc0 = circumcircle(pts, s0, s1, s2);
    if (cc0) tris.push({ verts: [s0, s1, s2], cc: cc0 });

    for (let pi = 0; pi < n; pi++) {
        const px = pts[pi].x, py = pts[pi].y;

        // Acha triângulos cujo circumcírculo contém o ponto
        const bad = [];
        const good = [];
        for (const tri of tris) {
            if (inCircumcircle(tri.cc, px, py)) {
                bad.push(tri);
            } else {
                good.push(tri);
            }
        }

        // Acha o contorno do buraco (arestas não compartilhadas)
        const edgeCount = new Map();
        for (const tri of bad) {
            const [a, b, c] = tri.verts;
            for (const edge of [[a, b], [b, c], [c, a]]) {
                const key = edge[0] < edge[1] ? `${edge[0]}_${edge[1]}` : `${edge[1]}_${edge[0]}`;
                edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
            }
        }

        // Reconstrói triângulos a partir do contorno com o novo ponto
        tris = good;
        for (const [key, count] of edgeCount.entries()) {
            if (count === 1) {
                const [a, b] = key.split("_").map(Number);
                const cc = circumcircle(pts, a, b, pi);
                if (cc) tris.push({ verts: [a, b, pi], cc });
            }
        }
    }

    // Remove triângulos que compartilham vértice com o super-triângulo
    const result = [];
    for (const tri of tris) {
        const [a, b, c] = tri.verts;
        if (a >= n || b >= n || c >= n) continue;
        result.push([a, b, c]);
    }

    return result;
}

function barycentric(px, py, a, b, c) {
    const denom = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
    if (Math.abs(denom) < 1e-8) return null;

    const w1 = ((b.y - c.y) * (px - c.x) + (c.x - b.x) * (py - c.y)) / denom;
    const w2 = ((c.y - a.y) * (px - c.x) + (a.x - c.x) * (py - c.y)) / denom;
    const w3 = 1 - w1 - w2;

    return [w1, w2, w3];
}

function sampleNearest(image, x, y) {
    const sx = clamp(Math.round(x), 0, image.width - 1);
    const sy = clamp(Math.round(y), 0, image.height - 1);
    return image.data[sy * image.width + sx];
}

function lerpPoint(a, b, t) {
    return {
        x: (1 - t) * a.x + t * b.x,
        y: (1 - t) * a.y + t * b.y
    };
}

function morphAtTime(t) {
    if (!imageChild || !imageAdult) {
        return null;
    }

    const width = imageChild.width;
    const height = imageChild.height;
    const output = new Uint8ClampedArray(width * height);

    if (pointsChild.length === 0 || pointsAdult.length === 0 || triangles.length === 0) {
        for (let i = 0; i < output.length; i += 1) {
            output[i] = Math.round((1 - t) * imageChild.data[i] + t * imageAdult.data[i]);
        }
        return createImageObject(width, height, output);
    }

    const covered = new Uint8Array(width * height);

    for (const tri of triangles) {
        const a0 = pointsChild[tri[0]];
        const a1 = pointsChild[tri[1]];
        const a2 = pointsChild[tri[2]];

        const b0 = pointsAdult[tri[0]];
        const b1 = pointsAdult[tri[1]];
        const b2 = pointsAdult[tri[2]];

        const u0 = lerpPoint(a0, b0, t);
        const u1 = lerpPoint(a1, b1, t);
        const u2 = lerpPoint(a2, b2, t);

        const minX = Math.floor(Math.min(u0.x, u1.x, u2.x));
        const maxX = Math.ceil(Math.max(u0.x, u1.x, u2.x));
        const minY = Math.floor(Math.min(u0.y, u1.y, u2.y));
        const maxY = Math.ceil(Math.max(u0.y, u1.y, u2.y));

        for (let y = minY; y <= maxY; y += 1) {
            if (y < 0 || y >= height) continue;
            for (let x = minX; x <= maxX; x += 1) {
                if (x < 0 || x >= width) continue;

                const bc = barycentric(x + 0.5, y + 0.5, u0, u1, u2);
                if (!bc) continue;

                const eps = -1e-4;
                if (bc[0] < eps || bc[1] < eps || bc[2] < eps) continue;

                const srcAX = bc[0] * a0.x + bc[1] * a1.x + bc[2] * a2.x;
                const srcAY = bc[0] * a0.y + bc[1] * a1.y + bc[2] * a2.y;
                const srcBX = bc[0] * b0.x + bc[1] * b1.x + bc[2] * b2.x;
                const srcBY = bc[0] * b0.y + bc[1] * b1.y + bc[2] * b2.y;

                const gA = sampleNearest(imageChild, srcAX, srcAY);
                const gB = sampleNearest(imageAdult, srcBX, srcBY);
                const value = Math.round((1 - t) * gA + t * gB);

                const index = y * width + x;
                output[index] = value;
                covered[index] = 1;
            }
        }
    }

    for (let i = 0; i < output.length; i += 1) {
        if (!covered[i]) {
            output[i] = Math.round((1 - t) * imageChild.data[i] + t * imageAdult.data[i]);
        }
    }

    return createImageObject(width, height, output);
}

function drawMorphImage() {
    const t = Number(timeSlider.value);
    timeValue.value = t.toFixed(2);

    if (!imageChild || !imageAdult) {
        return;
    }

    morphImage = morphAtTime(t);
    if (!morphImage) {
        return;
    }

    morphCanvas.width = morphImage.width;
    morphCanvas.height = morphImage.height;
    morphCtx.putImageData(imageToImageData(morphImage), 0, 0);

    statusText.textContent = `Quadro gerado para t=${t.toFixed(2)}.`;
}

function redrawInputCanvases() {
    if (imageChild) {
        drawBaseImage(childCtx, childCanvas, imageChild);
        drawTriangulation(childCtx, pointsChild, triangles);
        drawPoints(childCtx, pointsChild, "#4fc3ff");
    }

    if (imageAdult) {
        drawBaseImage(adultCtx, adultCanvas, imageAdult);
        drawTriangulation(adultCtx, pointsAdult, triangles);
        drawPoints(adultCtx, pointsAdult, "#64c0b0");
    }
}

// ALTERADO: sem dependência de isMarking/currentMarkingImage.
// Habilita desfazer individualmente por lado e finalizar quando ambos têm
// pelo menos 3 pontos e a mesma quantidade.
function updateMarkingButtonsState() {
    if (undoChildBtn) undoChildBtn.disabled = !isMarking || pointsChild.length === 0;
    if (undoAdultBtn) undoAdultBtn.disabled = !isMarking || pointsAdult.length === 0;

    const canFinish =
        isMarking &&
        pointsChild.length >= 3 &&
        pointsAdult.length >= 3 &&
        pointsChild.length === pointsAdult.length;

    doneMarkingBtn.disabled = !canFinish;
}

// ALTERADO: apenas entra no modo de marcação livre, sem fase.
// Limpa ambos os arrays e libera cliques nos dois canvas.
function startMarking() {
    if (!imageChild || !imageAdult) {
        statusText.textContent = "Carregue ambas as imagens antes de iniciar a marcacao.";
        return;
    }

    isMarking = true;
    pointsChild = [];
    pointsAdult = [];
    triangles = [];

    pointInstruction.textContent =
        "Marque pontos correspondentes em ambas as imagens (mínimo 3 em cada, mesma quantidade). Clique num ponto existente para removê-lo.";

    startMarkingBtn.style.display = "none";
    if (undoChildBtn) undoChildBtn.style.display = "inline-block";
    if (undoAdultBtn) undoAdultBtn.style.display = "inline-block";
    doneMarkingBtn.style.display = "inline-block";

    redrawInputCanvases();
    updateMarkingButtonsState();
}

// ALTERADO: valida só se ambos têm >= 3 pontos e mesma quantidade.
// Remove toda a lógica de fase (child → adult).
function doneMarking() {
    if (isProcessingDoneMarking) return;
    isProcessingDoneMarking = true;

    if (!isMarking) {
        statusText.textContent = "Clique em 'Iniciar Marcacao' antes de confirmar os pontos.";
        updateMarkingButtonsState();
        isProcessingDoneMarking = false;
        return;
    }

    if (pointsChild.length < 3 || pointsAdult.length < 3) {
        statusText.textContent = "Marque pelo menos 3 pontos em cada imagem antes de finalizar.";
        updateMarkingButtonsState();
        isProcessingDoneMarking = false;
        return;
    }

    if (pointsChild.length !== pointsAdult.length) {
        statusText.textContent = `Número de pontos diferente: criança tem ${pointsChild.length} e adulto tem ${pointsAdult.length}. Marque a mesma quantidade em ambas.`;
        updateMarkingButtonsState();
        isProcessingDoneMarking = false;
        return;
    }

    isMarking = false;

    // Adiciona os 4 cantos da imagem como pontos fixos de correspondência
    const w = imageChild.width;
    const h = imageChild.height;
    const corners = [
        { x: 0, y: 0 },
        { x: w - 1, y: 0 },
        { x: 0, y: h - 1 },
        { x: w - 1, y: h - 1 },
    ];
    pointsChild = [...pointsChild, ...corners];
    pointsAdult = [...pointsAdult, ...corners];

    console.log("pointsChild com cantos:", JSON.stringify(pointsChild));
    console.log("pointsAdult com cantos:", JSON.stringify(pointsAdult));

    triangles = triangulateDelaunay(pointsChild);
    console.log("triangles resultado:", JSON.stringify(triangles));

    if (triangles.length === 0) {
        statusText.textContent =
            "Falha na triangulação mesmo com cantos. Verifique no console (F12) o erro exato.";
        isProcessingDoneMarking = false;
        return;
    }

    redrawInputCanvases();
    drawMorphImage();

    markingControls.style.display = "none";
    morphControls.style.display = "block";
    startMarkingBtn.textContent = "Remarcar Pontos";
    statusText.textContent = `Pronto! ${pointsChild.length} pontos marcados, ${triangles.length} triângulos. Deformação e blend ativados.`;
    updateMarkingButtonsState();
    isProcessingDoneMarking = false;
}

// ALTERADO: desfaz o último ponto do lado especificado independentemente.
function undoLastPoint(side) {
    if (!isMarking) {
        statusText.textContent = "Inicie a marcacao para desfazer pontos.";
        return;
    }

    const points = side === "child" ? pointsChild : pointsAdult;
    const label = side === "child" ? "criança" : "adulto";

    if (points.length === 0) {
        statusText.textContent = `Não há pontos para desfazer na imagem de ${label}.`;
        return;
    }

    points.pop();
    redrawInputCanvases();
    statusText.textContent = `Último ponto da ${label} removido. (${points.length} ponto(s) restante(s))`;
    updateMarkingButtonsState();
}

function getCanvasRelativePosition(event, canvas) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY
    };
}

// ALTERADO: ambos os canvas ficam ativos ao mesmo tempo durante isMarking,
// sem verificar currentMarkingImage.
function setupCanvasClickListener(canvas, isChildImage) {
    canvas.addEventListener("click", (event) => {
        if (!isMarking) return;

        const points = isChildImage ? pointsChild : pointsAdult;
        const pos = getCanvasRelativePosition(event, canvas);

        const idx = points.findIndex((p) => Math.hypot(p.x - pos.x, p.y - pos.y) < 8);
        if (idx !== -1) {
            points.splice(idx, 1);
            statusText.textContent = `Ponto removido (${points.length} ponto(s) nesta imagem).`;
        } else {
            points.push({
                x: clamp(pos.x, 0, canvas.width - 1),
                y: clamp(pos.y, 0, canvas.height - 1)
            });
            statusText.textContent = `Ponto adicionado (${points.length} ponto(s) nesta imagem).`;
        }

        redrawInputCanvases();
        updateMarkingButtonsState();
    });
}

function stopAnimation() {
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    isPlaying = false;
    playBtn.textContent = "Play";
}

function animate(timestamp) {
    if (!isPlaying) return;

    if (!previousAnimationTime) {
        previousAnimationTime = timestamp;
    }

    const elapsed = timestamp - previousAnimationTime;
    previousAnimationTime = timestamp;

    const speed = 0.0008;
    const current = Number(timeSlider.value);
    let next = current + elapsed * speed;

    if (next >= 1) {
        next = 1;
        stopAnimation();
    }

    timeSlider.value = next.toFixed(2);
    drawMorphImage();

    if (isPlaying) {
        animationId = requestAnimationFrame(animate);
    }
}

function togglePlay() {
    if (!imageChild || !imageAdult) {
        return;
    }

    if (isPlaying) {
        stopAnimation();
        return;
    }

    if (Number(timeSlider.value) >= 0.99) {
        timeSlider.value = "0";
        drawMorphImage();
    }

    isPlaying = true;
    playBtn.textContent = "Pause";
    previousAnimationTime = 0;
    animationId = requestAnimationFrame(animate);
}

async function handleChildUpload() {
    const file = fileChild.files[0];
    if (!file) return;

    imageChild = await loadImageFromFile(file);

    if (imageAdult && (imageAdult.width !== imageChild.width || imageAdult.height !== imageChild.height)) {
        imageAdult = resizeImageNearest(imageAdult, imageChild.width, imageChild.height);
        statusText.textContent = "Imagem 2 redimensionada.";
    }

    redrawInputCanvases();

    if (imageAdult) {
        morphControls.style.display = "block";
        markingControls.style.display = "block";
        drawMorphImage();
        statusText.textContent = "Ambas as imagens carregadas! Opcao 1: Marque pontos correspondentes. Opcao 2: Use o slider para blend simples.";
    } else {
        markingControls.style.display = "block";
        morphControls.style.display = "none";
        statusText.textContent = "Imagem 1 carregada. Carregue a imagem 2.";
    }
}

async function handleAdultUpload() {
    const file = fileAdult.files[0];
    if (!file) return;

    imageAdult = await loadImageFromFile(file);

    if (imageChild && (imageAdult.width !== imageChild.width || imageAdult.height !== imageChild.height)) {
        imageAdult = resizeImageNearest(imageAdult, imageChild.width, imageChild.height);
        statusText.textContent = "Imagem 2 redimensionada.";
    }

    redrawInputCanvases();

    morphControls.style.display = "block";
    markingControls.style.display = "block";
    drawMorphImage();
    statusText.textContent = "Carregadas! Clique em 'Iniciar Marcacao' para marcar pontos livremente em ambas as imagens e ativar deformacao com blend.";
}

fileChild.addEventListener("change", () => {
    handleChildUpload().catch((error) => {
        statusText.textContent = `Erro ao carregar imagem 1: ${error.message}`;
    });
});

fileAdult.addEventListener("change", () => {
    handleAdultUpload().catch((error) => {
        statusText.textContent = `Erro ao carregar imagem 2: ${error.message}`;
    });
});

startMarkingBtn.addEventListener("click", () => {
    startMarking();
});

// Botões de desfazer independentes por lado
if (undoChildBtn) undoChildBtn.addEventListener("click", () => undoLastPoint("child"));
if (undoAdultBtn) undoAdultBtn.addEventListener("click", () => undoLastPoint("adult"));

doneMarkingBtn.addEventListener("click", doneMarking);

timeSlider.addEventListener("input", drawMorphImage);

renderBtn.addEventListener("click", drawMorphImage);

playBtn.addEventListener("click", togglePlay);

resetMorphBtn.addEventListener("click", () => {
    pointsChild = [];
    pointsAdult = [];
    triangles = [];
    imageChild = null;
    imageAdult = null;
    morphImage = null;
    isMarking = false;
    stopAnimation();
    timeSlider.value = "0";
    markingControls.style.display = "none";
    morphControls.style.display = "none";
    childCtx.clearRect(0, 0, childCanvas.width, childCanvas.height);
    adultCtx.clearRect(0, 0, adultCanvas.width, adultCanvas.height);
    morphCtx.clearRect(0, 0, morphCanvas.width, morphCanvas.height);
    fileChild.value = "";
    fileAdult.value = "";
    statusText.textContent = "Tudo limpo. Carregue as imagens novamente.";
    updateMarkingButtonsState();
});

setupCanvasClickListener(childCanvas, true);
setupCanvasClickListener(adultCanvas, false);

updateMarkingButtonsState();

statusText.textContent = "Carregue as duas imagens (crianca e atual) para iniciar.";
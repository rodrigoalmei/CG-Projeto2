// ============================================
// FILTROS ESPACIAIS E OPERAÇÕES DE CONVOLUÇÃO
// ============================================

/**
 * Realiza convolução de uma imagem com um kernel
 */
function convolution(data, w, h, kernel, doNormalize = true) {
    const result = [];
    let minVal = Infinity;
    let maxVal = -Infinity;

    const kernelSize = Math.sqrt(kernel.length);
    const offset = Math.floor(kernelSize / 2);

    for (let i = 0; i < h; i++) {
        result[i] = [];
        for (let j = 0; j < w; j++) {
            let sum = 0;

            for (let ky = 0; ky < kernelSize; ky++) {
                for (let kx = 0; kx < kernelSize; kx++) {
                    const y = i + ky - offset;
                    const x = j + kx - offset;

                    if (y >= 0 && y < h && x >= 0 && x < w) {
                        sum += data[y][x] * kernel[ky * kernelSize + kx];
                    }
                }
            }

            result[i][j] = sum;

            if (sum < minVal) minVal = sum;
            if (sum > maxVal) maxVal = sum;
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
                result[i][j] = Math.max(0, Math.min(255, Math.round(result[i][j])));
            }
        }
    }

    return result;
}

/**
 * Mapa de kernels predefinidos
 */
const kernelMap = {
    // Passa-Baixa (Média 3x3)
    9: [
        1, 1, 1,
        1, 1, 1,
        1, 1, 1
    ].map(x => x / 9),

    // Sobel X
    5: [
        -1, 0, 1,
        -2, 0, 2,
        -1, 0, 1
    ],

    // Sobel Y
    6: [
        -1, -2, -1,
        0, 0, 0,
        1, 2, 1
    ],

    // Prewitt X
    7: [
        -1, 0, 1,
        -1, 0, 1,
        -1, 0, 1
    ],

    // Prewitt Y
    8: [
        -1, -1, -1,
        0, 0, 0,
        1, 1, 1
    ],

    // Gradiente X
    11: [
        -1, 0, 1,
        -2, 0, 2,
        -1, 0, 1
    ],

    // Gradiente Y
    12: [
        -1, -2, -1,
        0, 0, 0,
        1, 2, 1
    ],

    // Roberts X
    13: [
        1, 0,
        0, -1
    ],

    // Roberts Y
    14: [
        0, 1,
        -1, 0
    ],
    // Passa Alta
    15: [
        -1, -1, -1,
        -1, 8, -1,
        -1, -1, -1
    ]
};

/**
 * Filtro Mediana
 */
function medianFilter(data, w, h, doNormalize = false) {
    const result = [];
    const radius = 1;

    for (let i = 0; i < h; i++) {
        result[i] = [];
        for (let j = 0; j < w; j++) {
            const neighbors = [];

            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    const y = i + dy;
                    const x = j + dx;

                    if (y >= 0 && y < h && x >= 0 && x < w) {
                        neighbors.push(data[y][x]);
                    }
                }
            }

            neighbors.sort((a, b) => a - b);
            const median = neighbors[Math.floor(neighbors.length / 2)];
            result[i][j] = median;
        }
    }

    return result;
}

/**
 * Filtro High-Boost
 * High-Boost = (A * Original) - Low-Pass
 * onde A é um fator de amplificação
 */
function highBoostFilter(data, w, h, boostFactor = 1.5, doNormalize = true) {
    const result = [];
    let minVal = Infinity;
    let maxVal = -Infinity;

    // Primeiro, calcula a versão passa-baixa (média)
    const lowPassKernel = [
        1, 1, 1,
        1, 1, 1,
        1, 1, 1
    ].map(x => x / 9);

    const lowPass = [];
    const kernelSize = 3;
    const offset = 1;

    for (let i = 0; i < h; i++) {
        lowPass[i] = [];
        for (let j = 0; j < w; j++) {
            let sum = 0;

            for (let ky = 0; ky < kernelSize; ky++) {
                for (let kx = 0; kx < kernelSize; kx++) {
                    const y = i + ky - offset;
                    const x = j + kx - offset;

                    if (y >= 0 && y < h && x >= 0 && x < w) {
                        sum += data[y][x] * lowPassKernel[ky * kernelSize + kx];
                    }
                }
            }

            lowPass[i][j] = sum;
        }
    }

    // Aplica a fórmula High-Boost
    for (let i = 0; i < h; i++) {
        result[i] = [];
        for (let j = 0; j < w; j++) {
            const val = (boostFactor * data[i][j]) - lowPass[i][j];
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
                result[i][j] = Math.max(0, Math.min(255, Math.round(result[i][j])));
            }
        }
    }

    return result;
}

/**
 * Roberts XY - Magnitude cruzada
 */
function robertsXY(data, w, h, doNormalize = true) {
    const result = [];
    let minVal = Infinity;
    let maxVal = -Infinity;

    const kernelX = [1, 0, 0, -1];
    const kernelY = [0, 1, -1, 0];
    const kernelSize = 2;
    const offset = 0;

    for (let i = 0; i < h; i++) {
        result[i] = [];
        for (let j = 0; j < w; j++) {
            let sumX = 0;
            let sumY = 0;

            for (let ky = 0; ky < kernelSize; ky++) {
                for (let kx = 0; kx < kernelSize; kx++) {
                    const y = i + ky - offset;
                    const x = j + kx - offset;

                    if (y >= 0 && y < h && x >= 0 && x < w) {
                        sumX += data[y][x] * kernelX[ky * kernelSize + kx];
                        sumY += data[y][x] * kernelY[ky * kernelSize + kx];
                    }
                }
            }

            const magnitude = Math.sqrt(sumX * sumX + sumY * sumY);
            result[i][j] = magnitude;

            if (magnitude < minVal) minVal = magnitude;
            if (magnitude > maxVal) maxVal = magnitude;
        }
    }

    if (doNormalize && minVal !== maxVal) {
        for (let i = 0; i < h; i++) {
            for (let j = 0; j < w; j++) {
                // Inverte: max magnitude vira 0, min magnitude vira 255
                result[i][j] = Math.round(((maxVal - result[i][j]) / (maxVal - minVal)) * 255);
            }
        }
    } else if (!doNormalize) {
        for (let i = 0; i < h; i++) {
            for (let j = 0; j < w; j++) {
                result[i][j] = Math.max(0, Math.min(255, Math.round(result[i][j])));
            }
        }
    }

    return result;
}

/**
 * Sobel XY - Magnitude cruzada
 */
function sobelXY(data, w, h, doNormalize = true) {
    const result = [];
    let minVal = Infinity;
    let maxVal = -Infinity;

    const kernelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const kernelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
    const kernelSize = 3;
    const offset = 1;

    for (let i = 0; i < h; i++) {
        result[i] = [];
        for (let j = 0; j < w; j++) {
            let sumX = 0;
            let sumY = 0;

            for (let ky = 0; ky < kernelSize; ky++) {
                for (let kx = 0; kx < kernelSize; kx++) {
                    const y = i + ky - offset;
                    const x = j + kx - offset;

                    if (y >= 0 && y < h && x >= 0 && x < w) {
                        sumX += data[y][x] * kernelX[ky * kernelSize + kx];
                        sumY += data[y][x] * kernelY[ky * kernelSize + kx];
                    }
                }
            }

            const magnitude = Math.sqrt(sumX * sumX + sumY * sumY);
            result[i][j] = magnitude;

            if (magnitude < minVal) minVal = magnitude;
            if (magnitude > maxVal) maxVal = magnitude;
        }
    }

    if (doNormalize && minVal !== maxVal) {
        for (let i = 0; i < h; i++) {
            for (let j = 0; j < w; j++) {
                // Inverte: max magnitude vira 0, min magnitude vira 255
                result[i][j] = Math.round(((maxVal - result[i][j]) / (maxVal - minVal)) * 255);
            }
        }
    } else if (!doNormalize) {
        for (let i = 0; i < h; i++) {
            for (let j = 0; j < w; j++) {
                result[i][j] = Math.max(0, Math.min(255, Math.round(result[i][j])));
            }
        }
    }

    return result;
}

/**
 * Prewitt XY - Magnitude cruzada
 */
function prewittXY(data, w, h, doNormalize = true) {
    const result = [];
    let minVal = Infinity;
    let maxVal = -Infinity;

    const kernelX = [-1, 0, 1, -1, 0, 1, -1, 0, 1];
    const kernelY = [-1, -1, -1, 0, 0, 0, 1, 1, 1];
    const kernelSize = 3;
    const offset = 1;

    for (let i = 0; i < h; i++) {
        result[i] = [];
        for (let j = 0; j < w; j++) {
            let sumX = 0;
            let sumY = 0;

            for (let ky = 0; ky < kernelSize; ky++) {
                for (let kx = 0; kx < kernelSize; kx++) {
                    const y = i + ky - offset;
                    const x = j + kx - offset;

                    if (y >= 0 && y < h && x >= 0 && x < w) {
                        sumX += data[y][x] * kernelX[ky * kernelSize + kx];
                        sumY += data[y][x] * kernelY[ky * kernelSize + kx];
                    }
                }
            }

            const magnitude = Math.sqrt(sumX * sumX + sumY * sumY);
            result[i][j] = magnitude;

            if (magnitude < minVal) minVal = magnitude;
            if (magnitude > maxVal) maxVal = magnitude;
        }
    }

    if (doNormalize && minVal !== maxVal) {
        for (let i = 0; i < h; i++) {
            for (let j = 0; j < w; j++) {
                // Inverte: max magnitude vira 0, min magnitude vira 255
                result[i][j] = Math.round(((maxVal - result[i][j]) / (maxVal - minVal)) * 255);
            }
        }
    } else if (!doNormalize) {
        for (let i = 0; i < h; i++) {
            for (let j = 0; j < w; j++) {
                result[i][j] = Math.max(0, Math.min(255, Math.round(result[i][j])));
            }
        }
    }

    return result;
}

/**
 * Gradient XY - Magnitude cruzada
 */
function gradientXY(data, w, h, doNormalize = true) {
    const result = [];
    let minVal = Infinity;
    let maxVal = -Infinity;

    const kernelX = [-1, 0, 1, -1, 0, 1, -1, 0, 1];
    const kernelY = [-1, -1, -1, 0, 0, 0, 1, 1, 1];
    const kernelSize = 3;
    const offset = 1;

    for (let i = 0; i < h; i++) {
        result[i] = [];
        for (let j = 0; j < w; j++) {
            let sumX = 0;
            let sumY = 0;

            for (let ky = 0; ky < kernelSize; ky++) {
                for (let kx = 0; kx < kernelSize; kx++) {
                    const y = i + ky - offset;
                    const x = j + kx - offset;

                    if (y >= 0 && y < h && x >= 0 && x < w) {
                        sumX += data[y][x] * kernelX[ky * kernelSize + kx];
                        sumY += data[y][x] * kernelY[ky * kernelSize + kx];
                    }
                }
            }

            const magnitude = Math.sqrt(sumX * sumX + sumY * sumY);
            result[i][j] = magnitude;

            if (magnitude < minVal) minVal = magnitude;
            if (magnitude > maxVal) maxVal = magnitude;
        }
    }

    if (doNormalize && minVal !== maxVal) {
        for (let i = 0; i < h; i++) {
            for (let j = 0; j < w; j++) {
                // Inverte: max magnitude vira 0, min magnitude vira 255
                result[i][j] = Math.round(((maxVal - result[i][j]) / (maxVal - minVal)) * 255);
            }
        }
    } else if (!doNormalize) {
        for (let i = 0; i < h; i++) {
            for (let j = 0; j < w; j++) {
                result[i][j] = Math.max(0, Math.min(255, Math.round(result[i][j])));
            }
        }
    }

    return result;
}

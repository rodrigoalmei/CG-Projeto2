# Item 2 — Morfismo Dependente do Tempo

## Visão Geral

O Item 2 do projeto implementa um sistema de **morfismo temporal** entre duas imagens em tons de cinza (PGM ou imagens comuns convertidas para escala de cinza). O objetivo é criar uma transição suave (animação) entre uma imagem inicial (ex: você criança) e uma imagem final (ex: você adulto), utilizando correspondência de pontos faciais e interpolação geométrica e de intensidade.

O usuário marca pontos correspondentes nas duas imagens (olhos, boca, nariz, etc). O sistema utiliza esses pontos para calcular uma triangulação de Delaunay e, para cada quadro da animação, interpola tanto a posição dos vértices quanto a intensidade dos pixels, gerando uma deformação realista.

## Fundamento Teórico

O morfismo temporal é baseado em dois princípios:

1. **Interpolação Geométrica dos Pontos**
   - Para cada par de pontos correspondentes $v_i$ (imagem inicial) e $w_i$ (imagem final), a posição intermediária $u_i(t)$ é dada por:
     $$
     u_i(t) = (1-t) v_i + t w_i
     $$
   - $t \in [0,1]$ representa o tempo da animação (0 = início, 1 = final).

2. **Interpolação de Intensidade (Blend)**
   - Para cada pixel, a intensidade intermediária é:
     $$
     \rho_t(u) = (1-t) \rho_0(v) + t \rho_1(w)
     $$
   - $\rho_0(v)$ é a intensidade do pixel na imagem inicial, $\rho_1(w)$ na final.

3. **Triangulação de Delaunay**
   - Os pontos marcados são triangulados (Delaunay) para dividir a imagem em regiões. Cada triângulo é deformado independentemente ao longo do tempo.

## Estrutura do Código

O código está organizado em seções para facilitar a leitura e manutenção:

### 1. Variáveis e Elementos DOM

- Referências aos canvas, controles, botões e variáveis de estado.

### 2. Funções de Utilidade Geral

- `clamp`, `createImageObject`, `cloneImage`, etc.

### 3. Funções de Leitura e Conversão de Imagem

- `parsePGM`: Lê arquivos PGM (P2/P5) e converte para objeto de imagem.
- `browserImageToGrayscale`: Converte imagens comuns (PNG/JPG) para escala de cinza.
- `loadImageFromFile`: Decide qual função usar com base na extensão.
- `resizeImageNearest`: Redimensiona imagens para garantir compatibilidade.

### 4. Funções de Desenho e Visualização

- `imageToImageData`, `drawBaseImage`: Desenham imagens no canvas.
- `drawPoints`, `drawTriangulation`: Visualizam pontos de controle e triangulação.
- `redrawInputCanvases`: Atualiza as imagens de entrada.
- `drawMorphImage`: Desenha o quadro atual do morphing.

### 5. Funções de Triangulação e Morphing

- `triangulateDelaunay`: Calcula a triangulação de Delaunay dos pontos.
- `barycentric`, `sampleNearest`, `lerpPoint`: Utilitários matemáticos para interpolação.
- `morphAtTime`: **Função principal** — para cada triângulo, interpola os vértices e calcula a intensidade blendada para cada pixel, usando coordenadas baricêntricas.

### 6. Funções de Controle de Interação e Eventos

- Handlers de upload, marcação de pontos, animação, play/pause, etc.
- `setupCanvasClickListener`: Permite marcar/remover pontos nas imagens.
- `startMarking`, `doneMarking`, `undoLastPoint`: Controle do fluxo de marcação.
- `togglePlay`, `animate`, `stopAnimation`: Controle da animação.

## Fluxo do Morfismo no Código

1. **Upload das Imagens**
   - O usuário carrega as duas imagens. Se necessário, a segunda é redimensionada para coincidir com a primeira.

2. **Marcação de Pontos**
   - O usuário marca pontos correspondentes nas duas imagens (mínimo 3).
   - O sistema adiciona automaticamente os 4 cantos como pontos extras para garantir cobertura total.

3. **Triangulação**
   - É calculada a triangulação de Delaunay sobre os pontos.

4. **Morphing**
   - Para cada valor de $t$ (slider ou animação):
     - Para cada triângulo, interpola os vértices.
     - Para cada pixel dentro do triângulo, calcula as coordenadas baricêntricas e encontra a posição correspondente nas imagens original e final.
     - Interpola a intensidade dos pixels (blend).
   - O resultado é desenhado no canvas de morphing.

5. **Animação**
   - O botão Play executa a animação de $t=0$ até $t=1$.

## Pontos Importantes para Explicação

- O morfismo depende tanto da deformação geométrica (posição dos pontos) quanto do blend de intensidade.
- A triangulação permite que a deformação seja local e realista.
- O uso de coordenadas baricêntricas garante que a interpolação dentro de cada triângulo seja suave.
- O código é modular: cada parte (leitura, desenho, morphing, interação) está separada para facilitar o entendimento.

## Sugestão de Demonstração

1. Carregue as duas imagens.
2. Marque pontos correspondentes (olhos, boca, etc).
3. Clique em "Finalizar Marcação".
4. Use o slider para ver o morphing manualmente ou clique em Play para animar.

---

Se precisar explicar detalhes matemáticos, foque nas fórmulas de interpolação e no papel da triangulação/baricêntricas. Se quiser mostrar o fluxo do código, siga as seções acima.

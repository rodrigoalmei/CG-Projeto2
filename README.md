<h1 align="center">Projeto de Computação Gráfica</h1>

<p align="center">
  Módulos interativos para estudo de processamento digital de imagens,
  morfologia matemática, histogramas, morphing e transformações geométricas.
</p>

<p align="center">
  <img alt="Status" src="https://img.shields.io/badge/status-acad%C3%AAmico-1f6feb">
  <img alt="HTML" src="https://img.shields.io/badge/HTML5-e34f26">
  <img alt="CSS" src="https://img.shields.io/badge/CSS3-1572b6">
  <img alt="JavaScript" src="https://img.shields.io/badge/JavaScript-vanilla-f7df1e">
  <img alt="Canvas" src="https://img.shields.io/badge/Canvas-API-0f766e">
</p>

<p align="center">
  <a href="#sobre">Sobre</a> •
  <a href="#módulos">Módulos</a> •
  <a href="#estrutura">Estrutura</a> •
  <a href="#como-executar">Como executar</a> •
  <a href="#prévia-para-github">Prévia para GitHub</a>
</p>

---

## Sobre

Este repositório reúne **seis módulos independentes** desenvolvidos para estudo de **Computação Gráfica** e **Processamento Digital de Imagens**. Cada item possui sua própria interface em HTML, lógica em JavaScript e estilos em CSS, o que facilita tanto a apresentação quanto a manutenção do código.

O foco do projeto é didático. Em vez de esconder o processamento em bibliotecas prontas, os algoritmos aparecem de forma explícita no código, o que ajuda bastante em:

- estudo para disciplina;
- apresentação acadêmica;
- demonstração prática de conceitos;
- análise de pixels, vizinhanças e transformações;
- leitura e explicação do funcionamento interno.

---

## Módulos

| Item | Tema | O que o módulo faz |
| --- | --- | --- |
| **Item 1** | Operações entre imagens e filtros | Combina imagens e aplica filtros como média, mediana, Sobel, Prewitt, Roberts, Gradient e high-boost. |
| **Item 2** | Morphing temporal | Gera transição entre duas imagens por marcação de pontos, triangulação e interpolação. |
| **Item 3** | Transformações de intensidade | Aplica negativo, gama, logaritmo, linear, faixa dinâmica e transferência geral. |
| **Item 4** | Histogramas e equalização | Mostra histogramas e realiza equalização para redistribuição dos níveis de cinza. |
| **Item 5** | Morfologia matemática | Trabalha com erosão, dilatação, abertura, fechamento, gradiente, contornos e thinning. |
| **Item 6** | Transformações geométricas | Aplica escala, translação, reflexão, cisalhamento e rotação em imagens. |

### Destaques por item

#### Item 1

- operações aritméticas e lógicas entre duas imagens;
- filtros espaciais com análise por lupa de pixels;
- comparação entre entrada e saída com matriz de vizinhança.

#### Item 2

- morphing guiado por pontos correspondentes;
- triangulação de Delaunay;
- uso de coordenadas baricêntricas e interpolação ao longo do tempo.

#### Item 3

- transformações pontuais de intensidade;
- parâmetros configuráveis por operação;
- estudo direto de brilho, contraste e curvas de transformação.

#### Item 4

- construção do histograma da imagem;
- cálculo da distribuição acumulada;
- equalização para melhora de contraste global.

#### Item 5

- operações morfológicas em imagens binárias e em tons de cinza;
- uso de elemento estruturante `3x3`;
- estudo do efeito espacial da vizinhança sobre forma e contorno.

#### Item 6

- transformações geométricas clássicas;
- uso de mapeamento inverso;
- amostragem por vizinho mais próximo e interpolação bilinear.

---

## Conceitos trabalhados

- leitura de arquivos `PGM` e `PBM`;
- conversão para tons de cinza;
- transformações ponto a ponto;
- convolução e filtros espaciais;
- histogramas e equalização;
- morfologia matemática;
- triangulação de Delaunay;
- coordenadas baricêntricas;
- interpolação de intensidade;
- transformações geométricas em imagens.

---

## Estrutura

```text
CG-Projeto2/
|-- index.html
|-- style.css
|-- README.md
|-- assets/
|-- shared/
|-- Item 1/
|-- Item 2/
|-- Item 3/
|-- Item 4/
|-- Item 5/
`-- Item 6/
```

### Pastas principais

- `assets/`: imagens de apoio e arquivos usados em testes dos módulos.
- `shared/`: componentes reutilizados, como lupa de pixels, filtros e estilos compartilhados.
- `Item 1` a `Item 6`: módulos independentes, cada um com sua própria página e lógica.

---

## Tecnologias

- **HTML5**
- **CSS3**
- **JavaScript puro**
- **Canvas API**

---

## Como executar

Você pode usar o projeto de duas formas.

### Abrindo diretamente

Abra o arquivo abaixo em um navegador:

```text
index.html
```

### Usando servidor local

Se preferir rodar com servidor local:

```bash
python -m http.server 8000
```

Depois acesse:

```text
http://localhost:8000
```

---

## Formatos suportados

Dependendo do item, o projeto utiliza:

- `PGM` (`P2` e, em alguns módulos, `P5`);
- `PBM` (`P1`);
- `PNG`, `JPG/JPEG` e `BMP` em módulos com conversão no navegador.



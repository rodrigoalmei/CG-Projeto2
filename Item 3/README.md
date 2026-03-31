# Item 3 - Transformacoes de Intensidade

## Visao Geral

O Item 3 aplica transformacoes de intensidade em imagens em tons de cinza.
O usuario pode carregar uma imagem, escolher a operacao desejada, visualizar o resultado em um segundo canvas e inspecionar os pixels nas duas imagens com a lupa compartilhada do projeto.

## Formatos suportados

- `PGM` ASCII (`P2`)
- `PNG`
- `JPG` / `JPEG`
- `BMP`

Imagens coloridas enviadas por upload sao convertidas automaticamente para escala de cinza antes da transformacao.

## Transformacoes disponiveis

- `Negativo`: inverte a intensidade de cada pixel.
- `Gamma`: aplica correcao por potencia usando o parametro `gama`.
- `Logaritmo`: destaca tons escuros com o parametro `a`.
- `Transferencia Geral`: usa uma curva sigmoide com os parametros `w` e `a`.
- `Faixa Dinamica`: remapeia os tons da imagem para um novo valor alvo.
- `Linear`: aplica a expressao `a * r + b`.

## Estrutura do script

O arquivo `script.js` foi organizado em blocos:

1. Estado e elementos da pagina.
2. Utilidades gerais.
3. Leitura de imagem.
4. Desenho e atualizacao de tela.
5. Transformacoes individuais.
6. Download.
7. Eventos.

Cada transformacao possui um comentario proprio no formato:

- `TRANSFORMACAO: NEGATIVO`
- `TRANSFORMACAO: GAMMA`
- `TRANSFORMACAO: LOGARITMO`
- `TRANSFORMACAO: TRANSFERENCIA GERAL`
- `TRANSFORMACAO: FAIXA DINAMICA`
- `TRANSFORMACAO: LINEAR`

Isso facilita localizar rapidamente cada operacao com `Ctrl+F`.

## Fluxo de uso

1. Carregue uma imagem pelo campo de upload.
2. Escolha a transformacao desejada.
3. Ajuste os parametros exibidos para a operacao selecionada.
4. Clique em `Transformar`.
5. Inspecione os pixels nas imagens original e transformada.
6. Clique em `Baixar Transformada (PGM)` se quiser exportar o resultado.

## Observacoes tecnicas

- O problema principal anterior estava no `script.js`, que tinha blocos duplicados e gerava erro de sintaxe antes da pagina iniciar.
- O arquivo `shared/pixel-inspector.js` nao estava impedindo o funcionamento do Item 3.
- A pasta `assets` tambem nao era a causa do erro de upload, porque o upload usa `FileReader` no navegador e nao depende dessa pasta.

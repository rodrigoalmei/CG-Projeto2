# Item 3 — Transformações de Intensidade

## Visão Geral

O Item 3 do projeto implementa um sistema de **transformações de intensidade** para imagens em tons de cinza (PGM). O usuário pode carregar uma imagem, escolher uma transformação e visualizar tanto a imagem original quanto a transformada, além de inspecionar valores de pixels com uma lupa interativa.

## Transformações Disponíveis

- **Negativo:** Inverte os valores de intensidade (255 - valor).
- **Gamma:** Corrige a intensidade usando a fórmula $s = (r/255)^{1/\gamma} \cdot 255$.
- **Logarítmica:** Realça tons escuros usando $s = a \cdot c \cdot \log(r+1)$, com $c = 255/\log(1+255)$.
- **Transferência Geral (Sigmoide):** Realça faixas específicas usando uma função sigmoide.
- **Faixa Dinâmica:** Redimensiona a faixa de tons para um valor alvo.
- **Linear:** Aplica transformação linear $s = a \cdot r + b$ (com saturação).

## Estrutura do Código

O código está organizado em seções para facilitar a leitura e manutenção:

### 1. Variáveis e Elementos DOM

- Referências aos canvas, controles, botões e variáveis de estado.

### 2. Funções de Utilidade

- `parsePGM`: Lê arquivos PGM (P2) e converte para objeto de imagem.
- `drawImage`, `clearCanvas`: Desenham e limpam imagens no canvas.

### 3. Funções de Transformação

- Cada transformação possui uma função dedicada (`applyNegative`, `applyGamma`, etc.), que aplica a fórmula correspondente a cada pixel.
- `getTransformedImage`: Função central que aplica a transformação escolhida e atualiza a visualização.

### 4. UI Dinâmica

- O seletor de transformação exibe dinamicamente os parâmetros necessários.
- O botão de download permite baixar a imagem transformada em formato PGM.

### 5. Lupa/Inspeção de Pixels

- O usuário pode inspecionar valores de pixels em ambas as imagens (original e transformada) usando uma matriz/lupa interativa.

## Fluxo de Funcionamento

1. **Upload da Imagem**
   - O usuário carrega uma imagem PGM.
   - A imagem é exibida no canvas original e pode ser inspecionada.

2. **Escolha e Aplicação da Transformação**
   - O usuário seleciona uma transformação e ajusta os parâmetros (se necessário).
   - Ao clicar em "Transformar", a função correspondente é chamada e a imagem transformada é exibida.

3. **Inspeção de Pixels**
   - O usuário pode clicar ou passar o mouse sobre a imagem para ver os valores dos pixels em uma matriz 15x15 centrada no ponto selecionado.

4. **Download**
   - O usuário pode baixar a imagem transformada em formato PGM.

## Pontos Importantes para Explicação

- Cada transformação é implementada de acordo com a fórmula matemática clássica da área de processamento de imagens.
- O código é modular: cada transformação é uma função separada, facilitando a adição de novas operações.
- A interface é dinâmica e responsiva, mostrando apenas os parâmetros relevantes para cada transformação.
- A lupa/matriz permite análise detalhada dos valores de pixels, útil para estudos e depuração.

## Sugestão de Demonstração

1. Carregue uma imagem PGM.
2. Selecione uma transformação e ajuste os parâmetros.
3. Clique em "Transformar" e observe o resultado.
4. Use a lupa para inspecionar valores de pixels antes e depois da transformação.
5. Baixe a imagem transformada para análise posterior.

---

Se precisar explicar detalhes matemáticos, foque nas fórmulas de cada transformação. Se quiser mostrar o fluxo do código, siga as seções acima.

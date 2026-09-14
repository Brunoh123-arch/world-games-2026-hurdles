# 🏃 World Games 2026 — 100m Hurdles

> **Motion Gaming AAAA (Estilo Kinect Sports)** com rastreamento corporal por IA Google MediaPipe (100% gratuito e executado localmente na GPU/WASM do navegador).

---

## 🎮 Sobre o Jogo
O **World Games 2026** é um jogo competitivo de atletismo 3D em tempo real. Inspirado no clássico *Kinect Sports: Track & Field*, o jogador controla o velocista com o próprio corpo em frente à webcam:
- **Corra no lugar** para impulsionar a velocidade do atleta.
- **Salte fisicamente** no momento certo para transpor as 10 barreiras olímpicas com técnica real.
- Dispute medalhas de ouro contra oponentes controlados por IA com torcida vibrante, tiro de largada e efeitos cinemáticos de slow-motion!

---

## ⚡ Controles Suportados
1. **Câmera / Visão Corporal (IA Google MediaPipe):**
   - Corra no lugar (elevação dos joelhos/cadência).
   - Salte fisicamente em frente à câmera.
2. **Teclado:**
   - `Espaço` / `Seta Cima` / `W`: Salto sobre as barreiras.
   - `Setas` / `A`, `D`, `S`: Impulso de sprint e cadência.
3. **Toque na Tela (Mobile / Tablet):**
   - Toque na parte superior (35%): Salto.
   - Toques rápidos na parte inferior (65%): Sprint acelerado.

---

## 🛠️ Tecnologias Utilizadas
- **Three.js** (WebGL 3D com iluminação PBR, sombras dinâmicas e shaders)
- **Google MediaPipe Pose Landmarker** (visão computacional para 33 pontos corporais)
- **Web Audio API** (síntese sonora contínua sem vazamento de memória)
- **TypeScript & Vite**

---

## 🚀 Como Executar Localmente

```bash
# 1. Instalar dependências
npm install

# 2. Iniciar servidor de desenvolvimento
npm run dev

# 3. Compilar para produção
npm run build
```

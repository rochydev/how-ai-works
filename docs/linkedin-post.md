# Borrador del post de LinkedIn

> Sube el vídeo `docs/video/walkthrough-es.webm` (LinkedIn acepta WebM) o la imagen
> `docs/screenshots/00-hero.png`, y pega uno de estos textos. Cambia el enlace si tu usuario
> de GitHub no es `rochydev`.

---

## Versión en español

¿Qué pasa de verdad cuando le escribes a una IA?

He construido una experiencia 3D interactiva para verlo por dentro: alguien en su habitación,
de noche, con LEDs y lluvia en la ventana… y todo lo que ocurre dentro del modelo pasa en la
pantalla de su PC.

Tu prompt recorre 11 etapas:

— Tokenización: el texto se trocea en subpalabras
— IDs: cada token es un número de un vocabulario de ~100k
— Embeddings: vectores donde las palabras parecidas quedan cerca
— Posición: ondas que le dicen al modelo el orden
— Self-attention: cada token decide a quién “mirar” (en 3D, sobre el escritorio)
— Capas transformer: atención + MLP, apiladas
— Probabilidades y muestreo, con la temperatura en directo
— Bucle autorregresivo: la respuesta sale token a token

Puedes escribir tu propio prompt, subir la temperatura y ver cómo empieza a desvariar, cambiar de
cabeza de atención o pasear la cámara por la habitación. Hasta la música lo-fi de fondo se genera
en directo.

Hecho con Three.js y WebAudio, 100 % procedural (sin modelos 3D, imágenes ni audios externos) y
open source.

Demo: https://rochydev.github.io/how-ai-works/
Código: https://github.com/rochydev/how-ai-works

#InteligenciaArtificial #LLM #ThreeJS #WebGL #MachineLearning #CreativeCoding #OpenSource

---

## English version

What actually happens when you type to an AI?

I built an interactive 3D experience to look inside: someone in their bedroom at night, LEDs on,
rain on the window… and everything happening inside the model plays out on their PC screen.

Your prompt travels through 11 stages: tokenization, vocabulary IDs, embeddings, positional encoding,
self-attention (in 3D, above the desk), transformer layers, logits & softmax, sampling and the
autoregressive loop — until the answer appears, token by token.

Type your own prompt, crank the temperature up and watch it go off the rails, switch attention heads,
or walk the camera around the room. Even the lo-fi background music is generated live.

Built with Three.js and WebAudio, 100% procedural and open source.

Demo: https://rochydev.github.io/how-ai-works/
Code: https://github.com/rochydev/how-ai-works

#AI #LLM #ThreeJS #WebGL #MachineLearning #CreativeCoding #OpenSource

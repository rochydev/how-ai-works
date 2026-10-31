import '../styles/welcome.css';

export const AUTHOR = 'rochydev';
export const AUTHOR_URL = `https://github.com/${AUTHOR}`;

/**
 * Welcome splash shown once the scene is ready: a big "hola", a welcome
 * line and the developer credit, then it dissolves into the room.
 * Clicking (or any key) skips it. Resolves when it is gone.
 */
export function showWelcome(S, { duration = 3600 } = {}) {
  const el = document.createElement('div');
  el.id = 'welcome';
  el.innerHTML = `
    <div class="welcome-inner">
      <h1 class="welcome-hello" aria-label="${S.hello}">${[...S.hello].map((c, i) => `<span style="--i:${i}">${c}</span>`).join('')}</h1>
      <p class="welcome-line">${S.welcome}</p>
      <p class="welcome-credit">${S.developedBy} <a href="${AUTHOR_URL}" target="_blank" rel="noopener">@${AUTHOR}</a></p>
    </div>`;
  document.body.appendChild(el);

  return new Promise((resolve) => {
    let done = false;
    const close = () => {
      if (done) return;
      done = true;
      el.classList.add('out');
      setTimeout(() => {
        el.remove();
        resolve();
      }, 900);
      removeEventListener('keydown', close);
    };
    el.addEventListener('click', (e) => {
      if (!e.target.closest('a')) close();
    });
    addEventListener('keydown', close);
    setTimeout(close, duration);
  });
}

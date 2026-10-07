'use strict';
/* Arrastar com o dedo. O arrastar nativo do navegador não funciona no toque, então aqui:
   segure um bloco por um instante, leve até o destino e solte. Usa as mesmas áreas `data-drop` do mouse
   e termina chamando soltar(id, área, elemento sob o dedo, ponto). */
(() => {
  const ESPERA = 380, FOLGA = 9, BORDA = 56, PASSO = 14;
  let timer = null, el = null, ghost = null, zona = null, ativo = false, x0 = 0, y0 = 0, px = 0, py = 0, raf = 0;

  const sob = (x, y) => { if (ghost) ghost.style.display = 'none'; const a = document.elementFromPoint(x, y); if (ghost) ghost.style.display = ''; return a; };
  const segue = () => { ghost.style.transform = `translate(${px - 44}px, ${py - 26}px) rotate(2deg)`; };
  function limpa() {
    clearTimeout(timer); timer = null; cancelAnimationFrame(raf);
    if (ghost) ghost.remove(); ghost = null;
    if (zona) zona.classList.remove('over'); zona = null;
    if (el) el.classList.remove('pego'); el = null;
    document.body.classList.remove('tdrag', 'drag'); ativo = false;
  }
  function marca() {
    const a = sob(px, py), z = a && a.closest('[data-drop]');
    if (z !== zona) { if (zona) zona.classList.remove('over'); zona = z; if (z) z.classList.add('over'); }
    return a;
  }
  // perto das bordas da tela: rola a página na vertical e a área rolável sob o dedo na horizontal
  function rola() {
    if (!ativo) return;
    if (py < BORDA + 64) scrollBy(0, -PASSO); else if (py > innerHeight - BORDA - 56) scrollBy(0, PASSO);
    const a = marca(), h = a && a.closest('.kb, .tw, .fxr, .prat, .abas, .mesa, .seg');
    if (h) { if (px < BORDA) h.scrollLeft -= PASSO; else if (px > innerWidth - BORDA) h.scrollLeft += PASSO; }
    raf = requestAnimationFrame(rola);
  }
  function comeca() {
    timer = null; if (!el || !el.isConnected) return limpa();
    ativo = true;
    if (navigator.vibrate) try { navigator.vibrate(12); } catch (e) {}
    const r = el.getBoundingClientRect();
    ghost = el.cloneNode(true); ghost.removeAttribute('data-act'); ghost.removeAttribute('id'); ghost.classList.add('fantasma');
    Object.assign(ghost.style, { position: 'fixed', left: '0', top: '0', width: Math.min(r.width, 230) + 'px', height: 'auto', margin: '0', pointerEvents: 'none', zIndex: '60' });
    document.body.appendChild(ghost); segue();
    el.classList.add('pego'); document.body.classList.add('tdrag', 'drag');
    rola();
  }

  document.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return limpa();
    const c = e.target.closest('[draggable=true][data-id]');
    if (!c || e.target.closest('input, select, textarea, label, .chk, button:not([draggable]), a:not([draggable])')) return;
    limpa(); el = c; x0 = px = e.touches[0].clientX; y0 = py = e.touches[0].clientY;
    timer = setTimeout(comeca, ESPERA);
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    const p = e.touches[0];
    if (timer) { if (Math.abs(p.clientX - x0) > FOLGA || Math.abs(p.clientY - y0) > FOLGA) limpa(); return; } // era só uma rolagem
    if (!ativo) return;
    e.preventDefault(); px = p.clientX; py = p.clientY; segue();
  }, { passive: false });
  document.addEventListener('touchend', e => {
    if (timer) return limpa();
    if (!ativo) return;
    e.preventDefault(); // sem isto o navegador ainda dispararia um clique e abriria o cartão
    const a = sob(px, py), z = a && a.closest('[data-drop]'), id = el.dataset.id, p = { clientX: px, clientY: py };
    limpa();
    if (z) soltar(id, z, a, p);
  }, { passive: false });
  document.addEventListener('touchcancel', limpa);
  // o toque longo não deve abrir o menu do navegador nem iniciar o arrastar nativo por cima do nosso
  document.addEventListener('contextmenu', e => { if (timer || ativo) e.preventDefault(); });
  document.addEventListener('dragstart', e => { if (timer || ativo) e.preventDefault(); }, true);
})();

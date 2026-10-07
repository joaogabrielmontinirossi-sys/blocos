'use strict';
/* Blocos — efeitos: animações das peças, sons, vibração, confete e o modo foco. */

const FX = {
  q: [], ctx: null, novo: '',
  on: () => S.set.anim !== false && !matchMedia('(prefers-reduced-motion: reduce)').matches,
  // a tela é redesenhada inteira; as animações ficam na fila e entram depois do desenho
  mark(id, cls) { FX.q.push([id, cls]); },
  flush() {
    const q = FX.q; FX.q = []; FX.novo = '';
    if (!FX.on()) return;
    q.forEach(([id, cls]) => document.querySelectorAll(`#main [data-id="${id}"], #main [data-fx="${id}"]`).forEach(el => FX.play(el, cls)));
  },
  play(el, cls) { if (!el || !FX.on()) return; el.classList.remove('fx-' + cls); void el.offsetWidth; el.classList.add('fx-' + cls); el.addEventListener('animationend', () => el.classList.remove('fx-' + cls), { once: true }); },
  tone(freqs, dur, type) {
    if (!S.set.som) return;
    try {
      const ctx = FX.ctx || (FX.ctx = new (window.AudioContext || window.webkitAudioContext)());
      freqs.forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + i * dur;
        o.type = type || 'triangle'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.1, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
      });
    } catch (e) {}
  },
  vib(p) { if (S.set.vibra && navigator.vibrate) try { navigator.vibrate(p); } catch (e) {} },
  snap() { FX.tone([170, 540], 0.07, 'square'); FX.vib(18); },          // peça encaixando
  free() { FX.tone([660, 880], 0.09); },                               // bloco saindo da caixa
  no() { FX.tone([140], 0.16, 'sawtooth'); FX.vib([30, 40, 30]); },    // não cabe
  crack() { FX.tone([320, 240], 0.05, 'square'); },                    // quebra
  win() { FX.tone([523, 659, 784, 1047], 0.13); FX.vib([40, 60, 40, 60, 120]); },
  confete() {
    if (!FX.on()) return;
    const box = document.createElement('div'), cores = S.tipos.map(t => t.cor);
    box.className = 'confete';
    for (let i = 0; i < 80; i++) {
      const p = document.createElement('i');
      p.style.cssText = `left:${Math.random() * 100}%;width:${12 + Math.random() * 26}px;background:${cores[i % cores.length] || '#2D7DD2'};animation-delay:${Math.random() * 0.7}s;animation-duration:${1.6 + Math.random() * 1.4}s;--r:${(Math.random() * 720 - 360) | 0}deg`;
      box.appendChild(p);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 3800);
  },
  notify(titulo, corpo) { if (S.set.notif && 'Notification' in window && Notification.permission === 'granted') try { new Notification(titulo, { body: corpo, icon: 'icons/icon-192.png' }); } catch (e) {} },
};

/* Modo foco: um bloco na tela, a peça enchendo conforme o tempo do tamanho passa. */
const Foco = {
  id: '', t: null, extra: 0, tocou: false,
  open(id) {
    const b = byId(S.blocos, id); if (!b) return;
    if (estado(b) === 'liberado' && !iniciar(id)) return;
    if (estado(b) !== 'montando') return toast('Só dá para focar num bloco liberado.');
    Foco.id = id; Foco.extra = 0; Foco.tocou = gastoDe(b) >= tamDe(b.tam).min * 60000;
    closeSheet(); draw(); Foco.draw();
    document.body.classList.add('foco');
    clearInterval(Foco.t); Foco.t = setInterval(Foco.tick, 500); Foco.tick();
  },
  draw() {
    const b = byId(S.blocos, Foco.id), t = tipoDe(b.tipo), o = obraDe(b), m = byId(S.modulos, b.modulo);
    $('#foco').innerHTML = `<div class="fbox" style="--c:${t.cor}">
      <button class="ib fx" data-act="focoSair" aria-label="Sair do foco">✕</button>
      <p class="muted">${esc(o ? o.nome : '')}${m ? ' › ' + esc(m.nome) : ''} · ${esc(t.nome)}</p>
      <h1>${esc(b.acao)}</h1>
      <div class="ftij"><i id="ffill"></i><b id="ftime"></b><span class="fst"></span></div>
      <p class="fsaida">Saída prometida: <b>${esc(b.saida)}</b></p>
      ${b.pinos.length ? `<div class="pinos">${b.pinos.map((p, i) => `<label><input type="checkbox" data-pino="${i}" data-id="${b.id}" ${p.ok ? 'checked' : ''}><span>${esc(p.t)}</span></label>`).join('')}</div>` : ''}
      <div class="acts"><button class="btn pri" data-act="inspecionar" data-id="${b.id}">Inspecionar e encaixar</button><button class="btn" data-act="focoPausa">Pausar</button><button class="btn" data-act="focoMais">+5 min</button></div>
    </div>`;
  },
  tick() {
    const b = byId(S.blocos, Foco.id);
    if (!b || estado(b) !== 'montando') return Foco.close();
    const total = tamDe(b.tam).min * 60000 + Foco.extra, gasto = gastoDe(b), rest = total - gasto, s = Math.abs(Math.round(rest / 1000));
    const el = $('#ftime'); if (!el) return;
    el.textContent = (rest < 0 ? '+' : '') + pad(Math.floor(s / 60)) + ':' + pad(s % 60);
    $('#ffill').style.height = Math.min(100, gasto / total * 100) + '%';
    $('#foco .ftij').classList.toggle('over', rest < 0);
    if (rest <= 0 && !Foco.tocou) { Foco.tocou = true; FX.win(); FX.notify('Tempo do bloco', b.acao + ': hora de inspecionar a saída.'); toast('O tempo do bloco acabou. A saída existe?'); }
  },
  close() { clearInterval(Foco.t); Foco.id = ''; document.body.classList.remove('foco'); $('#foco').innerHTML = ''; },
};

'use strict';
/* Blocos — telas: Montar (bancada + dia), Obras, Plantas, Diagnóstico e Ajustes. */

const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
const today = () => ymd(new Date());
const fmtMin = m => { const h = Math.floor(m / 60), r = m % 60; return h ? h + 'h' + (r ? pad(r) : '') : r + ' min'; };
const fmtData = (s, o) => parse(s).toLocaleDateString('pt-BR', o || { weekday: 'long', day: 'numeric', month: 'long' });
const fmtDia = s => { const t = today(); return s === t ? 'Hoje' : s === addDays(t, 1) ? 'Amanhã' : s === addDays(t, -1) ? 'Ontem' : fmtData(s, { weekday: 'short', day: 'numeric', month: 'short' }); };
const plural = (n, um, varios) => n + ' ' + (n === 1 ? um : varios);
// texto escuro ou claro, conforme a cor da peça
const ink = c => { const n = parseInt(c.slice(1), 16), l = 0.299 * (n >> 16) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255); return l > 150 ? '#1B1F2A' : '#FFFFFF'; };

const SEM_TIPO = { id: '', nome: 'Sem tipo', cor: '#9AA3AF', desc: '' }, SEM_TAM = { id: '', sigla: '?', nome: 'Sem tamanho', min: 0 };
const tipoDe = id => byId(S.tipos, id) || SEM_TIPO;
const tamDe = id => byId(S.tamanhos, id) || SEM_TAM;
const tipos = () => S.tipos.slice().sort((a, b) => a.ordem - b.ordem);
const tams = () => S.tamanhos.slice().sort((a, b) => b.min - a.min);
const cfg = () => byId(S.ajustes, 'cfg');
const capDia = () => tams().reduce((n, z) => n + (cfg().cap[z.id] || 0) * z.min, 0);
const blocosDe = obra => S.blocos.filter(b => b.obra === obra).sort((a, b) => a.ordem - b.ordem);

const ROT = { caixa: 'Na caixa', liberado: 'Liberado', montando: 'Montando', encaixado: 'Encaixado' };
const faltam = b => b.deps.map(d => byId(S.blocos, d)).filter(x => x && !x.feito);
const estado = b => b.feito ? 'encaixado' : b.inicio ? 'montando' : faltam(b).length ? 'caixa' : 'liberado';

const U = { tab: 'montar', dia: today(), obra: null, sem: 0 };
let inst = null, toastT = null;

function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 3200); }

/* ---------- peças ---------- */
function brick(b, o = {}) {
  const t = tipoDe(b.tipo), z = tamDe(b.tam), st = estado(b), obra = byId(S.obras, b.obra);
  const late = !b.feito && b.dia && b.dia < today();
  const sub = o.fluxo ? `${esc(b.entrada)} → ${esc(b.saida)}` : `${esc(obra ? obra.nome : '')} · ${esc(t.nome)}`;
  return `<div class="brick st-${st}" role="button" tabindex="0" draggable="${st === 'liberado' || st === 'montando'}" data-act="bloco" data-id="${b.id}" style="--c:${t.cor};--ink:${ink(t.cor)};--h:${36 + z.min / 5}px">
    <span class="sz" title="${esc(z.nome)}: ${z.min} min">${esc(z.sigla)}</span>
    <span class="tx"><b>${esc(b.acao)}</b><small>${sub}</small></span>
    ${o.estado || st === 'montando' || st === 'encaixado' || late ? `<span class="pill">${late ? 'Atrasado' : ROT[st]}</span>` : ''}
  </div>`;
}
function pile(obra) {
  const bs = blocosDe(obra.id), done = bs.filter(b => b.feito).sort((a, b) => a.feito - b.feito), rest = bs.filter(b => !b.feito);
  const pc = (b, g) => { const t = tipoDe(b.tipo); return `<i class="${g ? 'ghost' : ''}" style="--c:${t.cor};--w:${Math.max(14, tamDe(b.tam).min / 15 * 12)}px" title="${esc(b.acao)}"></i>`; };
  return `<div class="pile">${done.map(b => pc(b)).join('')}${rest.map(b => pc(b, 1)).join('')}</div>`;
}
// progresso real: blocos e minutos entregues, e se o que falta cabe na capacidade até o prazo
function conta(obra) {
  const bs = blocosDe(obra.id), min = l => l.reduce((n, b) => n + tamDe(b.tam).min, 0), done = bs.filter(b => b.feito), rest = min(bs) - min(done);
  let cabe = null;
  if (obra.prazo && rest > 0) {
    let dias = 0;
    for (let d = today(); d <= obra.prazo && dias < 3660; d = addDays(d, 1)) if (cfg().dias[parse(d).getDay()]) dias++;
    cabe = { dias, cap: dias * capDia(), ok: rest <= dias * capDia() };
  }
  return { n: bs.length, feitos: done.length, total: min(bs), rest, cabe };
}
function selo(c, prazo) {
  if (!prazo) return '';
  if (!c.rest) return `<span class="selo ok">Entregue</span>`;
  if (prazo < today()) return `<span class="selo bad">Prazo vencido</span>`;
  return c.cabe.ok ? `<span class="selo ok">Cabe até ${fmtData(prazo, { day: 'numeric', month: 'short' })}</span>`
    : `<span class="selo bad">Não cabe: faltam ${fmtMin(c.rest)}, cabem ${fmtMin(c.cabe.cap)}</span>`;
}

/* ---------- Montar: bancada + dia ---------- */
function vMontar() {
  const d = U.dia, t = today();
  const livres = S.blocos.filter(b => { const e = estado(b); return (e === 'liberado' || e === 'montando') && (!b.dia || (b.dia < t && b.dia !== d)); });
  const doDia = S.blocos.filter(b => b.dia === d);
  const usado = doDia.reduce((n, b) => n + tamDe(b.tam).min, 0);
  const grupos = tipos().concat(SEM_TIPO).map(tp => ({ tp, l: livres.filter(b => tipoDe(b.tipo).id === tp.id) })).filter(g => g.l.length);
  const naCaixa = S.blocos.filter(b => estado(b) === 'caixa').length;
  const folga = !cfg().dias[parse(d).getDay()];
  return `<div class="cols">
    <section class="panel" id="dia" data-drop="dia">
      <div class="phead"><button class="ib" data-act="dia" data-n="-1" aria-label="Dia anterior">‹</button>
        <div class="grow"><h2>${fmtDia(d)}</h2><p class="muted">${fmtData(d)}${folga ? ' · dia de folga' : ''}</p></div>
        ${d !== t ? `<button class="btn sm" data-act="dia" data-n="0">Hoje</button>` : ''}
        <button class="ib" data-act="dia" data-n="1" aria-label="Próximo dia">›</button></div>
      <div class="meter"><i style="width:${Math.min(100, capDia() ? usado / capDia() * 100 : 0)}%"></i></div>
      <p class="muted sm">${fmtMin(usado)} de ${fmtMin(capDia())} ocupados</p>
      ${tams().map(z => {
        const l = doDia.filter(b => b.tam === z.id), cap = cfg().cap[z.id] || 0;
        if (!cap && !l.length) return '';
        return `<h4>${esc(z.sigla)} · ${z.min} min <span class="muted">${l.length}/${cap}</span></h4><div class="slots">${l.map(b => brick(b)).join('')}${Array.from({ length: Math.max(0, cap - l.length) }, () => `<div class="slot" style="--h:${36 + z.min / 5}px">espaço ${esc(z.sigla)}</div>`).join('')}</div>`;
      }).join('')}
      ${doDia.filter(b => !byId(S.tamanhos, b.tam)).map(b => brick(b)).join('')}
    </section>
    <section class="panel" id="bancada" data-drop="bancada">
      <div class="phead"><div class="grow"><h2>Bancada</h2><p class="muted">${plural(livres.length, 'bloco liberado', 'blocos liberados')}${naCaixa ? ` · ${naCaixa} na caixa` : ''}</p></div></div>
      ${grupos.length ? grupos.map(g => `<h4><i class="dot" style="background:${g.tp.cor}"></i>${esc(g.tp.nome)} <span class="muted">${g.l.length}</span></h4>${g.l.map(b => brick(b)).join('')}`).join('')
        : `<p class="empty">${S.blocos.some(b => !b.feito) ? 'Nada na bancada: os blocos liberados já estão no dia.' : 'Nenhum bloco para montar. Desmonte um projeto em <b>Obras</b>.'}</p>`}
      <p class="muted sm hint">Arraste um bloco para o dia, ou toque nele. Só aparecem os blocos cujas entradas já existem.</p>
    </section>
  </div>`;
}

/* ---------- Obras ---------- */
function vObras() {
  const o = U.obra && byId(S.obras, U.obra);
  if (o) return vObra(o);
  U.obra = null;
  const l = S.obras.slice().sort((a, b) => (a.prazo || '9') < (b.prazo || '9') ? -1 : 1);
  return `<div class="phead top"><div class="grow"><h2>Obras</h2><p class="muted">Cada projeto é uma pilha que cresce a cada bloco encaixado.</p></div><button class="btn pri" data-act="novaObra">Nova obra</button></div>
  <div class="grid">${l.map(ob => { const c = conta(ob); return `<article class="card" data-act="abrirObra" data-id="${ob.id}" role="button" tabindex="0">
      ${pile(ob)}<h3>${esc(ob.nome)}</h3>
      <p class="muted sm">${c.feitos} de ${plural(c.n, 'bloco', 'blocos')} · ${fmtMin(c.total - c.rest)} de ${fmtMin(c.total)}</p>${selo(c, ob.prazo)}</article>`; }).join('') || `<p class="empty">Nenhuma obra ainda. Comece por <b>Nova obra</b> e use uma planta pronta.</p>`}</div>`;
}
function vObra(o) {
  const c = conta(o), mods = S.modulos.filter(m => m.obra === o.id).sort((a, b) => a.ordem - b.ordem);
  return `<div class="phead top"><button class="ib" data-act="abrirObra" data-id="" aria-label="Voltar">‹</button>
      <div class="grow"><input class="title" data-store="obras" data-id="${o.id}" data-f="nome" value="${esc(o.nome)}" aria-label="Nome da obra"></div>
      <button class="btn sm" data-act="salvarPlanta" data-id="${o.id}">Salvar como planta</button><button class="btn sm danger" data-act="delObra" data-id="${o.id}">Excluir</button></div>
    <div class="panel obrahead">${pile(o)}<div><p><b>${c.feitos} de ${plural(c.n, 'bloco', 'blocos')}</b> · ${fmtMin(c.total - c.rest)} de ${fmtMin(c.total)}</p>
      <label class="inl">Prazo <input type="date" data-store="obras" data-id="${o.id}" data-f="prazo" data-redraw value="${o.prazo}"></label> ${selo(c, o.prazo)}</div></div>
    ${mods.map(m => { const bs = S.blocos.filter(b => b.modulo === m.id).sort((a, b) => a.ordem - b.ordem); return `<section class="panel mod">
      <div class="phead"><input class="title sm" data-store="modulos" data-id="${m.id}" data-f="nome" value="${esc(m.nome)}" aria-label="Nome do módulo">
        <span class="muted sm">${bs.filter(b => b.feito).length}/${bs.length}</span><button class="ib sm" data-act="delMod" data-id="${m.id}" aria-label="Excluir módulo">✕</button></div>
      ${bs.map(b => brick(b, { fluxo: 1, estado: 1 })).join('')}
      <button class="btn sm add" data-act="novoBloco" data-mod="${m.id}">＋ Bloco</button></section>`; }).join('')}
    <button class="btn" data-act="novoMod" data-id="${o.id}">＋ Módulo</button>`;
}

/* ---------- Plantas ---------- */
function vPlantas() {
  return `<div class="phead top"><div class="grow"><h2>Plantas</h2><p class="muted">Projetos que se repetem viram modelos. Abra uma obra e use <b>Salvar como planta</b> para criar a sua.</p></div></div>
  <div class="grid">${S.plantas.map(p => { const f = Data.flat(p); return `<article class="card planta">
    <input class="title sm" data-store="plantas" data-id="${p.id}" data-f="nome" value="${esc(p.nome)}" aria-label="Nome da planta">
    <p class="muted sm">${plural(f.length, 'bloco', 'blocos')} · cerca de ${fmtMin(f.reduce((n, b) => n + tamDe(b.tam).min, 0))}</p>
    ${p.modulos.map(m => `<div class="pm"><b>${esc(m.nome)}</b><div class="chips">${m.blocos.map(b => { const t = tipoDe(b.tipo); return `<span class="chip" style="--c:${t.cor};--ink:${ink(t.cor)}">${esc(b.acao)} (${b.vezes > 1 ? b.vezes + '× ' : ''}${esc(tamDe(b.tam).sigla)})</span>`; }).join('<span class="arr">→</span>')}</div></div>`).join('')}
    <div class="row"><button class="btn pri sm" data-act="novaObra" data-planta="${p.id}">Usar esta planta</button><button class="btn sm danger" data-act="delPlanta" data-id="${p.id}">Excluir</button></div></article>`; }).join('') || `<p class="empty">Nenhuma planta salva.</p>`}</div>`;
}

/* ---------- Diagnóstico semanal ---------- */
function vDiag() {
  const t = parse(today()); t.setDate(t.getDate() - (t.getDay() + 6) % 7 + 7 * U.sem);
  const ini = ymd(t), fim = addDays(ini, 6), a = t.getTime(), z = parse(addDays(ini, 7)).getTime(), hoje = today();
  const feitos = S.blocos.filter(b => b.feito >= a && b.feito < z), quebras = S.blocos.filter(b => b.quebradoEm >= a && b.quebradoEm < z).length;
  const min = l => l.reduce((n, b) => n + tamDe(b.tam).min, 0);
  const linhas = tipos().concat(SEM_TIPO).map(tp => {
    const meus = S.blocos.filter(b => tipoDe(b.tipo).id === tp.id), ab = meus.filter(b => { const e = estado(b); return e === 'liberado' || e === 'montando'; });
    return { tp, f: feitos.filter(b => tipoDe(b.tipo).id === tp.id), ab: ab.length, at: ab.filter(b => b.dia && b.dia < hoje).length };
  }).filter(r => r.tp.id || r.f.length || r.ab);
  const maxF = Math.max(1, ...linhas.map(r => r.f.length)), maxA = Math.max(1, ...linhas.map(r => r.ab));
  const pior = linhas.slice().sort((x, y) => y.at - x.at || y.ab - x.ab)[0];
  const bar = (r, n, max, txt) => `<div class="bar"><span class="bl"><i class="dot" style="background:${r.tp.cor}"></i>${esc(r.tp.nome)}</span><span class="bt"><i style="width:${n / max * 100}%;background:${r.tp.cor}"></i></span><span class="bv">${txt}</span></div>`;
  return `<div class="phead top"><button class="ib" data-act="sem" data-n="-1" aria-label="Semana anterior">‹</button>
      <div class="grow"><h2>Diagnóstico${U.sem ? '' : ' desta semana'}</h2><p class="muted">${fmtData(ini, { day: 'numeric', month: 'short' })} a ${fmtData(fim, { day: 'numeric', month: 'short' })}</p></div>
      ${U.sem < 0 ? `<button class="ib" data-act="sem" data-n="1" aria-label="Semana seguinte">›</button>` : ''}</div>
    <div class="stats"><div class="panel stat"><b>${feitos.length}</b><span>blocos encaixados</span></div><div class="panel stat"><b>${fmtMin(min(feitos))}</b><span>de trabalho entregue</span></div>
      <div class="panel stat ${quebras > 2 ? 'warn' : ''}"><b>${quebras}</b><span>${quebras === 1 ? 'bloco quebrado' : 'blocos quebrados'}${quebras > 2 ? ': estimativas curtas demais' : ''}</span></div></div>
    <div class="cols"><section class="panel"><h3>Concluídos por tipo</h3>${linhas.map(r => bar(r, r.f.length, maxF, r.f.length ? `${r.f.length} · ${fmtMin(min(r.f))}` : '0')).join('')}</section>
      <section class="panel"><h3>O que está acumulando agora</h3>${linhas.map(r => bar(r, r.ab, maxA, r.ab + (r.at ? ` · ${r.at} atras.` : ''))).join('')}
        <p class="note">${pior && pior.ab ? (pior.at ? `<b>${esc(pior.tp.nome)}</b> é a cor que mais atrasa: ${plural(pior.at, 'bloco passou', 'blocos passaram')} do dia marcado. O seu gargalo está em ${esc(pior.tp.desc || pior.tp.nome.toLowerCase())}.` : `<b>${esc(pior.tp.nome)}</b> é a cor com mais blocos liberados à espera (${pior.ab}). Nenhum está atrasado.`) : 'Nada acumulado: tudo o que estava liberado foi encaixado.'}</p></section></div>`;
}

/* ---------- Ajustes ---------- */
function vAjustes() {
  const c = cfg(), s = S.set, gOn = Sync.gOn(), sem = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  const canInst = !Sync.avail && !matchMedia('(display-mode: standalone)').matches;
  return `<div class="phead top"><div class="grow"><h2>Ajustes</h2><p class="muted">As peças são suas: mude cores, nomes, tamanhos e a capacidade do dia.</p></div></div>
  <div class="cols">
  <section class="panel"><h3>Tipos de bloco</h3>
    ${tipos().map(t => `<div class="rowf"><input type="color" data-store="tipos" data-id="${t.id}" data-f="cor" value="${t.cor}" aria-label="Cor"><input data-store="tipos" data-id="${t.id}" data-f="nome" value="${esc(t.nome)}" aria-label="Nome" class="w1"><input data-store="tipos" data-id="${t.id}" data-f="desc" value="${esc(t.desc)}" aria-label="Para que serve" class="w2" placeholder="para que serve"><button class="ib sm" data-act="delReg" data-store="tipos" data-id="${t.id}" aria-label="Excluir tipo">✕</button></div>`).join('')}
    <button class="btn sm add" data-act="novoTipo">＋ Tipo</button></section>
  <section class="panel"><h3>Tamanhos</h3><p class="muted sm">O maior tamanho é o teto: o que passar dele vira dois ou mais blocos.</p>
    ${tams().map(z => `<div class="rowf"><input data-store="tamanhos" data-id="${z.id}" data-f="sigla" value="${esc(z.sigla)}" maxlength="3" class="w0" aria-label="Sigla"><input data-store="tamanhos" data-id="${z.id}" data-f="nome" value="${esc(z.nome)}" class="w1" aria-label="Nome"><label class="inl"><input type="number" min="5" max="480" step="5" data-store="tamanhos" data-id="${z.id}" data-f="min" value="${z.min}" class="w0"> min</label><label class="inl">cabem <input type="number" min="0" max="20" data-cap="${z.id}" value="${c.cap[z.id] || 0}" class="w0"> por dia</label><button class="ib sm" data-act="delReg" data-store="tamanhos" data-id="${z.id}" aria-label="Excluir tamanho">✕</button></div>`).join('')}
    <button class="btn sm add" data-act="novoTam">＋ Tamanho</button>
    <h4>Dias de trabalho</h4><div class="chips">${sem.map((n, i) => `<label class="tog"><input type="checkbox" data-dia="${i}" ${c.dias[i] ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div></section>
  <section class="panel"><h3>Sincronização</h3>
    ${Sync.avail ? `<h4>Pasta do Google Drive para computador</h4>
      <p class="muted sm">${Sync.on ? `Ativa em <b>${esc(Sync.folder)}</b>${Sync.error ? ' · ' + esc(Sync.error) : ''}` : Sync.detected ? 'Desativada.' : 'Não encontrei o Google Drive neste computador; escolha uma pasta sincronizada.'}</p>
      <div class="row">${Sync.drives.filter(d => d !== Sync.folder).map(d => `<button class="btn sm" data-act="syncUse" data-path="${esc(d)}">Usar ${esc(d)}</button>`).join('')}
        <button class="btn sm" data-act="syncPick">Escolher pasta…</button>${Sync.on ? `<button class="btn sm" data-act="syncOff">Desativar</button>` : ''}</div>` : ''}
    <h4>Conta Google (Windows, site e celular)</h4>
    <p class="muted sm">${gOn ? `Conectada${Sync.g.error ? ' · ' + esc(Sync.g.error) : ''}. O arquivo blocos-sync.json fica na área privada do app no seu Google Drive.` : 'Use o mesmo ID de cliente em todos os aparelhos para ver as mesmas obras.'}</p>
    <label class="fld">ID do cliente OAuth<input data-s="gClient" value="${esc(s.gClient)}" placeholder="0000000000-xxxxxxxx.apps.googleusercontent.com" autocomplete="off" spellcheck="false"></label>
    <div class="row"><button class="btn pri sm" data-act="gConnect">${gOn ? 'Sincronizar agora' : s.gWas ? 'Reconectar' : 'Conectar'}</button>${gOn || s.gWas ? `<button class="btn sm" data-act="gOff">Desconectar</button>` : ''}</div>
    <details><summary>Como criar o ID do cliente (uma vez só)</summary><ol class="muted sm">
      <li>Abra <a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noopener">console.cloud.google.com</a> e crie um projeto, ou use o mesmo dos seus outros aplicativos (o ID já existente serve).</li>
      <li>Em <b>APIs e serviços › Biblioteca</b>, ative a <b>Google Drive API</b>.</li>
      <li>Em <b>Tela de permissão OAuth</b>, escolha <b>Externo</b> e adicione o seu e-mail em <b>Usuários de teste</b>.</li>
      <li>Em <b>Credenciais › Criar credenciais › ID do cliente OAuth</b>, tipo <b>Aplicativo da Web</b>. Em <b>Origens JavaScript autorizadas</b>, adicione:<br><code>https://joaogabrielmontinirossi-sys.github.io</code><br><code>http://localhost:${PORT}</code>${new RegExp('github\\.io|localhost:' + PORT).test(location.origin) || !/^http/.test(location.origin) ? '' : `<br><code>${esc(location.origin)}</code>`}</li>
      <li>Copie o ID do cliente, cole acima e clique em Conectar. Repita só a colagem nos outros aparelhos.</li></ol></details></section>
  <section class="panel"><h3>Este aparelho</h3>
    <h4>Aparência</h4><div class="chips">${[['auto', 'Automática'], ['claro', 'Clara'], ['escuro', 'Escura']].map(([v, n]) => `<button class="btn sm ${s.tema === v ? 'pri' : ''}" data-act="tema" data-v="${v}">${n}</button>`).join('')}</div>
    <h4>Backup</h4><div class="row"><button class="btn sm" data-act="exportar">Exportar backup</button><button class="btn sm" data-act="importar">Importar backup</button></div>
    ${canInst ? `<h4>Aplicativo</h4><p class="muted sm">${inst ? 'Instale o Blocos para abrir em tela cheia, com ícone próprio e sem internet.' : 'No celular: menu do navegador › “Adicionar à tela inicial”. No Windows há também o Blocos.exe em <a href="https://github.com/joaogabrielmontinirossi-sys/blocos/releases/latest" target="_blank" rel="noopener">Releases</a>.'}</p>${inst ? `<button class="btn sm" data-act="install">Instalar o aplicativo</button>` : ''}` : ''}</section>
  </div>`;
}

/* ---------- desenho ---------- */
const TABS = [['montar', 'Montar', vMontar], ['obras', 'Obras', vObras], ['plantas', 'Plantas', vPlantas], ['diag', 'Diagnóstico', vDiag], ['ajustes', 'Ajustes', vAjustes]];
function draw() {
  document.documentElement.dataset.theme = S.set.tema === 'claro' ? 'light' : S.set.tema === 'escuro' ? 'dark' : '';
  $('#tabs').innerHTML = TABS.map(([id, n]) => `<button data-act="tab" data-tab="${id}" class="${U.tab === id ? 'on' : ''}">${n}</button>`).join('');
  $('#main').innerHTML = TABS.find(t => t[0] === U.tab)[2]();
  drawStatus();
}
function drawStatus() { const el = $('#sync'), err = Sync.error || Sync.g.error; el.textContent = Sync.status(); el.classList.toggle('bad', !!(Sync.any() && err)); el.title = err || ''; }

/* ---------- folhas (detalhe e formulários) ---------- */
function sheet(html) { $('#sheet').innerHTML = html; document.body.classList.add('sheet'); const f = $('#sheet [autofocus]'); if (f) f.focus(); }
function closeSheet() { document.body.classList.remove('sheet'); $('#sheet').innerHTML = ''; }

function sheetBloco(id) {
  const b = byId(S.blocos, id); if (!b) return;
  const st = estado(b), t = tipoDe(b.tipo), z = tamDe(b.tam), o = byId(S.obras, b.obra), m = byId(S.modulos, b.modulo), f = faltam(b);
  const noDia = b.dia && (b.dia >= today() || b.dia === U.dia);
  sheet(`<div class="shead"><span class="chip" style="--c:${t.cor};--ink:${ink(t.cor)}">${esc(t.nome)} · ${esc(z.sigla)} ${z.min} min</span><span class="pill st-${st}">${ROT[st]}</span><button class="ib" data-act="fechar" aria-label="Fechar">✕</button></div>
    <h2>${esc(b.acao)}</h2><p class="muted">${esc(o ? o.nome : '')}${m ? ' › ' + esc(m.nome) : ''}${b.dia ? ' · ' + fmtDia(b.dia) : ''}</p>
    <dl class="io"><dt>Entrada</dt><dd>${esc(b.entrada)}</dd><dt>Saída</dt><dd>${esc(b.saida)}</dd></dl>
    ${st === 'caixa' ? `<p class="note">Na caixa: ${f.length === 1 ? 'falta encaixar' : 'faltam encaixar'} ${f.map(x => `<b>${esc(x.acao)}</b>`).join(', ')}.</p>` : ''}
    <div class="acts">
      ${st === 'liberado' ? `<button class="btn pri" data-act="iniciar" data-id="${id}">Começar a montar</button>${noDia ? `<button class="btn" data-act="tirar" data-id="${id}">Devolver à bancada</button>` : `<button class="btn" data-act="agendar" data-id="${id}">Pôr em ${fmtDia(U.dia).toLowerCase()}</button>`}` : ''}
      ${st === 'montando' ? `<button class="btn pri" data-act="inspecionar" data-id="${id}">Inspecionar e encaixar</button><button class="btn" data-act="pausar" data-id="${id}">Pausar</button>` : ''}
      ${st === 'encaixado' ? `<button class="btn" data-act="desfazer" data-id="${id}">Desfazer o encaixe</button>` : `<button class="btn" data-act="quebrar" data-id="${id}">Quebrar em dois</button>`}
      <button class="btn" data-act="editar" data-id="${id}">Editar</button>
    </div>`);
}
function sheetInspecao(id) {
  const b = byId(S.blocos, id);
  sheet(`<div class="shead"><b>Inspeção</b><span class="grow"></span><button class="ib" data-act="fechar" aria-label="Fechar">✕</button></div>
    <h2>A saída existe de fato?</h2><p class="muted">${esc(b.acao)}</p><div class="saida">${esc(b.saida)}</div>
    <div class="acts"><button class="btn pri" data-act="encaixar" data-id="${id}">Sim, existe: encaixar</button><button class="btn" data-act="bloco" data-id="${id}">Ainda não</button></div>`);
}
// quem depende (direta ou indiretamente) de um bloco não pode virar entrada dele
function depende(a, alvo, seen = new Set()) { if (a.id === alvo) return true; if (seen.has(a.id)) return false; seen.add(a.id); return a.deps.some(d => { const x = byId(S.blocos, d); return x && depende(x, alvo, seen); }); }
function sheetEditar(id, modId) {
  const novo = !id, m = byId(S.modulos, novo ? modId : byId(S.blocos, id).modulo);
  const irmaos = blocosDe(m.obra), ult = irmaos.filter(x => x.modulo === m.id).pop() || irmaos.filter(x => (byId(S.modulos, x.modulo) || {}).ordem < m.ordem).pop();
  const b = novo ? { acao: '', tipo: tipos()[0] ? tipos()[0].id : '', tam: (tams().slice(-1)[0] || {}).id || '', entrada: '', saida: '', deps: ult ? [ult.id] : [], modulo: m.id } : byId(S.blocos, id);
  const opts = irmaos.filter(x => x.id !== id && (novo || !depende(x, id)));
  sheet(`<form data-form="bloco" data-id="${id || ''}" data-obra="${m.obra}">
    <div class="shead"><b>${novo ? 'Novo bloco' : 'Editar bloco'}</b><span class="grow"></span><button type="button" class="ib" data-act="fechar" aria-label="Fechar">✕</button></div>
    <label class="fld">Ação: um verbo e um entregável<input name="acao" value="${esc(b.acao)}" placeholder="Fichar o artigo do Tartuce" required autofocus maxlength="120"></label>
    <div class="fld">Tipo<div class="chips">${tipos().map(t => `<label class="pick" style="--c:${t.cor};--ink:${ink(t.cor)}"><input type="radio" name="tipo" value="${t.id}" ${b.tipo === t.id ? 'checked' : ''} required><span>${esc(t.nome)}</span></label>`).join('')}</div></div>
    <div class="fld">Tamanho<div class="chips">${tams().reverse().map(z => `<label class="pick"><input type="radio" name="tam" value="${z.id}" ${b.tam === z.id ? 'checked' : ''} required><span>${esc(z.sigla)} · ${z.min} min</span></label>`).join('')}</div>
      <small class="muted">Não cabe no maior? Então são dois blocos.</small></div>
    <label class="fld">Módulo<select name="modulo">${S.modulos.filter(x => x.obra === m.obra).sort((a, c) => a.ordem - c.ordem).map(x => `<option value="${x.id}" ${x.id === b.modulo ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}</select></label>
    ${opts.length ? `<div class="fld">Encaixa depois de<div class="deps">${opts.map(x => `<label><input type="checkbox" name="deps" value="${x.id}" ${b.deps.includes(x.id) ? 'checked' : ''}><span>${esc(x.acao)} <small class="muted">→ ${esc(x.saida)}</small></span></label>`).join('')}</div></div>` : ''}
    <label class="fld">Entrada: o que precisa existir antes<input name="entrada" value="${esc(b.entrada)}" placeholder="Em branco: usa a saída dos blocos anteriores" maxlength="200"></label>
    <label class="fld">Saída: o que existe depois<input name="saida" value="${esc(b.saida)}" placeholder="Ficha com 5 citações" required maxlength="200"></label>
    <div class="acts"><button class="btn pri">Salvar</button>${novo ? '' : `<button type="button" class="btn danger" data-act="delBloco" data-id="${id}">Excluir</button>`}</div></form>`);
}
function sheetObra(plantaId) {
  sheet(`<form data-form="obra"><div class="shead"><b>Nova obra</b><span class="grow"></span><button type="button" class="ib" data-act="fechar" aria-label="Fechar">✕</button></div>
    <label class="fld">Nome do projeto<input name="nome" placeholder="Trabalho de Civil" required autofocus maxlength="80"></label>
    <label class="fld">Prazo da entrega final<input type="date" name="prazo" min="${today()}"></label>
    <label class="fld">Desmontar com a planta<select name="planta"><option value="">Em branco (monto os blocos à mão)</option>${S.plantas.map(p => `<option value="${p.id}" ${p.id === plantaId ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select></label>
    <p class="note" id="fit"></p><div class="acts"><button class="btn pri">Criar obra</button></div></form>`);
  fitNote();
}
// antes de começar: o total da planta cabe na capacidade até o prazo?
function fitNote() {
  const f = $('#sheet form[data-form=obra]'); if (!f) return;
  const p = byId(S.plantas, f.planta.value), el = $('#fit');
  if (!p) { el.hidden = true; return; }
  const flat = Data.flat(p), tot = flat.reduce((n, b) => n + tamDe(b.tam).min, 0), prazo = f.prazo.value;
  let s = `${plural(flat.length, 'bloco', 'blocos')} e cerca de ${fmtMin(tot)} de trabalho.`;
  if (prazo) { const cap =(() => { let d = 0; for (let x = today(); x <= prazo && d < 3660; x = addDays(x, 1)) if (cfg().dias[parse(x).getDay()]) d++; return d * capDia(); })(); s += tot <= cap ? ` Cabe até o prazo (há ${fmtMin(cap)} de capacidade).` : ` <b>Não cabe até o prazo</b>: há só ${fmtMin(cap)} de capacidade.`; }
  el.hidden = false; el.innerHTML = s;
}

/* ---------- regras ---------- */
function agendar(id, dia) {
  const b = byId(S.blocos, id); if (!b) return false;
  const st = estado(b), z = tamDe(b.tam);
  if (st === 'caixa') return toast('Este bloco ainda está na caixa: falta uma entrada.'), false;
  if (st === 'encaixado') return false;
  const cap = cfg().cap[b.tam] || 0, n = S.blocos.filter(x => x.dia === dia && x.tam === b.tam && x.id !== id).length;
  if (n >= cap) return toast(`Sem espaço ${z.sigla} em ${fmtDia(dia).toLowerCase()}: ${cap ? `os ${cap} já estão ocupados` : 'a capacidade é zero'}.`), false;
  b.dia = dia; Data.put('blocos', b); return true;
}
function quebrar(id) {
  const b = byId(S.blocos, id), nid = uid(), base = b.acao.replace(/ \(parte \d+\)$/, '');
  S.blocos.filter(x => x.deps.includes(id)).forEach(x => { x.deps = x.deps.map(d => d === id ? nid : d); Data.put('blocos', x, true); });
  blocosDe(b.obra).filter(x => x.ordem > b.ordem).forEach(x => { x.ordem++; Data.put('blocos', x, true); });
  Data.put('blocos', Object.assign({}, b, { id: nid, acao: base + ' (parte 2)', deps: [id], entrada: b.saida, dia: '', inicio: 0, feito: 0, ordem: b.ordem + 1, quebraDe: id, quebradoEm: Date.now() }), true);
  b.acao = base + ' (parte 1)'; Data.put('blocos', b);
  return nid;
}
function delBloco(id, quiet) {
  const b = byId(S.blocos, id); if (!b) return;
  // quem encaixava depois dele passa a encaixar depois das entradas dele
  S.blocos.filter(x => x.deps.includes(id)).forEach(x => { x.deps = [...new Set(x.deps.filter(d => d !== id).concat(b.deps))]; Data.put('blocos', x, true); });
  Data.del('blocos', id, quiet);
}

const A = {
  tab(el) { U.tab = el.dataset.tab; if (U.tab !== 'obras') U.obra = null; draw(); scrollTo(0, 0); },
  dia(el) { const n = +el.dataset.n; U.dia = n ? addDays(U.dia, n) : today(); draw(); },
  sem(el) { U.sem = Math.min(0, U.sem + +el.dataset.n); draw(); },
  fechar() { closeSheet(); },
  bloco(el) { sheetBloco(el.dataset.id); },
  agendar(el) { if (agendar(el.dataset.id, U.dia)) { closeSheet(); draw(); } },
  tirar(el) { const b = byId(S.blocos, el.dataset.id); b.dia = ''; Data.put('blocos', b); closeSheet(); draw(); },
  iniciar(el) { const b = byId(S.blocos, el.dataset.id); b.inicio = Date.now(); if (!b.dia || b.dia < today()) agendar(b.id, today()); Data.put('blocos', b); draw(); sheetBloco(b.id); },
  pausar(el) { const b = byId(S.blocos, el.dataset.id); b.inicio = 0; Data.put('blocos', b); draw(); sheetBloco(b.id); },
  inspecionar(el) { sheetInspecao(el.dataset.id); },
  encaixar(el) {
    const b = byId(S.blocos, el.dataset.id), antes = new Set(S.blocos.filter(x => estado(x) === 'caixa').map(x => x.id));
    b.feito = Date.now(); if (!b.dia) b.dia = today(); Data.put('blocos', b);
    const lib = S.blocos.filter(x => antes.has(x.id) && estado(x) === 'liberado').length;
    closeSheet(); draw(); toast('Encaixado.' + (lib ? ` ${plural(lib, 'bloco foi liberado', 'blocos foram liberados')}.` : ''));
  },
  desfazer(el) { const b = byId(S.blocos, el.dataset.id); b.feito = 0; b.inicio = 0; Data.put('blocos', b); draw(); sheetBloco(b.id); },
  quebrar(el) { quebrar(el.dataset.id); draw(); sheetEditar(el.dataset.id); toast('Quebrado em dois. Ajuste o tamanho e a saída de cada parte.'); },
  editar(el) { sheetEditar(el.dataset.id); },
  novoBloco(el) { sheetEditar(null, el.dataset.mod); },
  delBloco(el) { if (confirm('Excluir este bloco?')) { delBloco(el.dataset.id); closeSheet(); draw(); } },
  novaObra(el) { sheetObra(el.dataset.planta || ''); },
  abrirObra(el) { U.tab = 'obras'; U.obra = el.dataset.id || null; draw(); scrollTo(0, 0); },
  delObra(el) {
    const o = byId(S.obras, el.dataset.id);
    if (!confirm(`Excluir a obra “${o.nome}” e todos os blocos dela?`)) return;
    S.blocos.filter(b => b.obra === o.id).forEach(b => Data.del('blocos', b.id, true));
    S.modulos.filter(m => m.obra === o.id).forEach(m => Data.del('modulos', m.id, true));
    Data.del('obras', o.id); U.obra = null; draw();
  },
  salvarPlanta(el) { const o = byId(S.obras, el.dataset.id), n = prompt('Nome da planta:', o.nome); if (n && n.trim()) { Data.toPlanta(o.id, n.trim().slice(0, 80)); toast('Planta salva. Ela está em Plantas.'); } },
  delPlanta(el) { if (confirm('Excluir esta planta? As obras já criadas com ela continuam.')) { Data.del('plantas', el.dataset.id); draw(); } },
  novoMod(el) { const n = S.modulos.filter(m => m.obra === el.dataset.id).length; Data.put('modulos', { obra: el.dataset.id, nome: 'Módulo ' + (n + 1), ordem: n ? Math.max(...S.modulos.filter(m => m.obra === el.dataset.id).map(m => m.ordem)) + 1 : 0 }); draw(); },
  delMod(el) {
    const bs = S.blocos.filter(b => b.modulo === el.dataset.id);
    if (bs.length && !confirm(`Excluir o módulo e ${plural(bs.length, 'bloco', 'blocos')}?`)) return;
    bs.forEach(b => delBloco(b.id, true)); Data.del('modulos', el.dataset.id); draw();
  },
  novoTipo() { Data.put('tipos', { nome: 'Novo tipo', cor: '#F28C28', desc: '', ordem: Math.max(-1, ...S.tipos.map(t => t.ordem)) + 1 }); draw(); },
  novoTam() { const id = uid(); Data.put('tamanhos', { id, sigla: 'N', nome: 'Novo', min: 30, ordem: 0 }, true); const c = cfg(); c.cap[id] = 1; Data.put('ajustes', c); draw(); },
  delReg(el) {
    const s = el.dataset.store, n = S.blocos.filter(b => (s === 'tipos' ? b.tipo : b.tam) === el.dataset.id && !b.feito).length;
    if (S[s].length < 2) return toast('Precisa existir pelo menos um.');
    if (n && !confirm(`${plural(n, 'bloco usa', 'blocos usam')} esta peça e vão precisar de outra. Excluir mesmo assim?`)) return;
    Data.del(s, el.dataset.id); draw();
  },
  tema(el) { S.set.tema = el.dataset.v; DB.saveSet(); draw(); },
  exportar() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(Sync.payload())], { type: 'application/json' })); a.download = `blocos-${today()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  },
  importar() { $('#filepick').click(); },
  async install() { if (!inst) return; inst.prompt(); await inst.userChoice.catch(() => {}); inst = null; draw(); },
  syncUse(el) { busy(el, () => Sync.config(el.dataset.path)); },
  syncPick(el) { toast('Escolha a pasta na janela que abriu.'); busy(el, () => Sync.config('choose')); },
  syncOff(el) { busy(el, () => Sync.config('off')); },
  gConnect(el) {
    const v = $('[data-s=gClient]').value.trim();
    if (!/\.apps\.googleusercontent\.com$/.test(v)) return toast('Cole o ID do cliente OAuth (termina em .apps.googleusercontent.com).');
    S.set.gClient = v; DB.saveSet(); busy(el, () => Sync.gOn() ? Sync.run() : Sync.connect());
  },
  gOff() { Sync.disconnect(); draw(); },
};
async function busy(el, f) { el.disabled = true; try { await f(); } catch (e) { toast(e.message || 'Não deu certo.'); } draw(); }

const FORMS = {
  bloco(f) {
    const id = f.dataset.id, d = new FormData(f), deps = d.getAll('deps'), b = id ? byId(S.blocos, id) : { obra: f.dataset.obra, dia: '', inicio: 0, feito: 0, quebraDe: '', quebradoEm: 0 };
    const mudou = b.modulo !== d.get('modulo');
    Object.assign(b, { acao: d.get('acao').trim(), tipo: d.get('tipo'), tam: d.get('tam'), modulo: d.get('modulo'), deps, saida: d.get('saida').trim() });
    b.entrada = d.get('entrada').trim() || deps.map(x => byId(S.blocos, x).saida).filter(Boolean).join(' + ') || 'Nada: pode começar já';
    if (!id || mudou) b.ordem = Math.max(-1, ...blocosDe(b.obra).filter(x => x.id !== id).map(x => x.ordem)) + 1;
    Data.put('blocos', b); closeSheet(); draw();
  },
  obra(f) {
    const o = Data.fromPlanta(byId(S.plantas, f.planta.value), f.nome.value.trim(), f.prazo.value);
    if (!f.planta.value) S.modulos.push({ id: uid(), obra: o.id, nome: 'Módulo 1', ordem: 0, mod: Date.now() });
    Data.put('obras', o); U.tab = 'obras'; U.obra = o.id; closeSheet(); draw(); scrollTo(0, 0);
  },
};

/* ---------- eventos ---------- */
document.addEventListener('click', e => {
  if (e.target.id === 'scrim') return closeSheet();
  const el = e.target.closest('[data-act]');
  if (!el || !A[el.dataset.act] || (e.target !== el && e.target.closest('input,select,a,label'))) return;
  A[el.dataset.act](el, e);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeSheet();
  if (e.key === 'Enter' && e.target.matches('[role=button]')) e.target.click();
  if (e.key === 'Enter' && e.target.matches('input[data-f]')) e.target.blur();
});
document.addEventListener('submit', e => { e.preventDefault(); const f = e.target.dataset.form; if (FORMS[f]) FORMS[f](e.target); });
document.addEventListener('input', e => { if (e.target.closest('form[data-form=obra]')) fitNote(); });
// campos editados no lugar: gravam ao sair do campo
document.addEventListener('change', e => {
  const el = e.target, d = el.dataset;
  if (d.f) {
    const r = byId(S[d.store], d.id); if (!r) return;
    let v = el.value.trim();
    if (d.f === 'min') v = Math.max(5, Math.min(480, Math.round(+v) || 5));
    else if (!v && d.f !== 'prazo' && d.f !== 'desc') { el.value = r[d.f]; return; }
    r[d.f] = v; Data.put(d.store, r);
    if ('redraw' in d) draw();
  } else if (d.cap) { const c = cfg(); c.cap[d.cap] = Math.max(0, Math.min(20, Math.floor(+el.value) || 0)); Data.put('ajustes', c); }
  else if (d.dia) { const c = cfg(); c.dias[+d.dia] = el.checked; Data.put('ajustes', c); }
  else if (d.s) { S.set[d.s] = el.value.trim(); DB.saveSet(); }
  else if (el.id === 'filepick' && el.files[0]) {
    el.files[0].text().then(t => { const j = JSON.parse(t); if (j.app !== 'blocos') throw 0; Sync.merge(j); DB.changed(); draw(); toast('Backup importado e mesclado.'); }).catch(() => toast('Este arquivo não é um backup do Blocos.'));
    el.value = '';
  }
});
// arrastar da bancada para o dia (e de volta)
document.addEventListener('dragstart', e => { const b = e.target.closest && e.target.closest('.brick'); if (!b) return; e.dataTransfer.setData('text/plain', b.dataset.id); e.dataTransfer.effectAllowed = 'move'; document.body.classList.add('drag'); });
document.addEventListener('dragend', () => { document.body.classList.remove('drag'); document.querySelectorAll('.over').forEach(x => x.classList.remove('over')); });
document.addEventListener('dragover', e => { const z = e.target.closest('[data-drop]'); if (!z) return; e.preventDefault(); z.classList.add('over'); });
document.addEventListener('dragleave', e => { const z = e.target.closest('[data-drop]'); if (z && !z.contains(e.relatedTarget)) z.classList.remove('over'); });
document.addEventListener('drop', e => {
  const z = e.target.closest('[data-drop]'); if (!z) return;
  e.preventDefault();
  const b = byId(S.blocos, e.dataTransfer.getData('text/plain')); if (!b) return;
  if (z.dataset.drop === 'dia') agendar(b.id, U.dia); else if (b.dia) { b.dia = ''; Data.put('blocos', b); }
  draw();
});
addEventListener('beforeinstallprompt', e => { e.preventDefault(); inst = e; if (U.tab === 'ajustes') draw(); });

const App = {
  // a sincronização trouxe novidades: redesenha, sem atrapalhar quem está digitando
  synced(changed) { if (changed && !document.body.classList.contains('sheet') && !(document.activeElement && document.activeElement.matches('input,select'))) draw(); else drawStatus(); },
};

DB.load();
draw();
Sync.init();
try { if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) {}

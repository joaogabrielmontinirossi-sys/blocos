'use strict';
/* Blocos — núcleo: regras do método, Montar (bancada + dia), Obras, Plantas, Ajustes, cartões e eventos. */

const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
const today = () => ymd(new Date());
const fmtMin = m => { m = Math.round(m); const h = Math.floor(m / 60), r = m % 60; return h ? h + 'h' + (r ? pad(r) : '') : r + ' min'; };
const fmtData = (s, o) => parse(s).toLocaleDateString('pt-BR', o || { weekday: 'long', day: 'numeric', month: 'long' });
const fmtDia = s => { const t = today(); return s === t ? 'Hoje' : s === addDays(t, 1) ? 'Amanhã' : s === addDays(t, -1) ? 'Ontem' : fmtData(s, { weekday: 'short', day: 'numeric', month: 'short' }); };
const fmtQuando = ts => new Date(ts).toLocaleString('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const plural = (n, um, varios) => n + ' ' + (n === 1 ? um : varios);
const norma = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
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
const obraDe = b => byId(S.obras, b.obra);
const ativo = b => { const o = obraDe(b); return !!o && !o.arquivada; };
const naMesa = b => { const o = obraDe(b); return !!o && !o.arquivada && !o.pausada; };
const prazoDe = b => b.prazo || (obraDe(b) || {}).prazo || '';
const vagas = (dia, tam, exc) => (cfg().cap[tam] || 0) - S.blocos.filter(x => x.dia === dia && x.tam === tam && x.id !== exc && ativo(x)).length;
// tempo real medido; uma sessão esquecida aberta conta no máximo três vezes o tamanho
const gastoDe = b => b.gasto + (b.inicio && !b.feito ? Math.min(Date.now() - b.inicio, tamDe(b.tam).min * 180000) : 0);

const ROT = { caixa: 'Na caixa', liberado: 'Liberado', travado: 'Travado', montando: 'Montando', encaixado: 'Encaixado' };
const faltam = b => b.deps.map(d => byId(S.blocos, d)).filter(x => x && !x.feito);
const estado = b => b.feito ? 'encaixado' : b.trava ? 'travado' : b.inicio ? 'montando' : faltam(b).length ? 'caixa' : 'liberado';

const U = { tab: 'montar', dia: today(), obra: null, sem: 0, ov: 'lista', dv: 'tam', bf: { obra: '', leve: false, ord: 'cor' }, kq: '', kobra: '', kmodo: 'estado', arq: false, col: new Set(), verso: false };
let inst = null, toastT = null, ultimaAba = '';

function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 3400); }
function recusa(id, msg) { toast(msg); FX.no(); document.querySelectorAll(`[data-id="${id}"]`).forEach(el => FX.play(el, 'shake')); return false; }
async function copiar(txt, ok) { try { if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ text: txt }); else { await navigator.clipboard.writeText(txt); toast(ok || 'Copiado.'); } } catch (e) { if (e && e.name !== 'AbortError') toast('Não consegui copiar.'); } }
function baixar(nome, obj) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(obj)], { type: 'application/json' })); a.download = nome; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }

/* ---------- peças ---------- */
function brick(b, o = {}) {
  const t = tipoDe(b.tipo), z = tamDe(b.tam), st = estado(b), obra = obraDe(b), late = !b.feito && b.dia && b.dia < today();
  const sub = o.fluxo ? `${esc(b.entrada)} → ${esc(b.saida)}` : `${esc(obra ? obra.nome : '')} · ${esc(t.nome)}`;
  const ok = b.pinos.filter(p => p.ok).length, pz = !b.feito && b.prazo ? (b.prazo < today() ? 'venceu' : fmtDia(b.prazo).toLowerCase()) : '';
  const marcas = (b.chave ? '<i title="Bloco-chave">★</i>' : '') + (b.fixo ? '<i title="Fixado">◆</i>' : '') + (b.repete ? '<i title="Rotina">↻</i>' : '') + (b.pinos.length ? `<i title="Checklist">${ok}/${b.pinos.length}</i>` : '') + (b.energia ? `<i title="${ENERGIA[b.energia]}">${'▮'.repeat(b.energia)}</i>` : '') + (pz ? `<i title="Prazo do bloco">${pz}</i>` : '');
  return `<div class="brick st-${st}${o.crit ? ' crit' : ''}${b.chave ? ' chave' : ''}" role="button" tabindex="0" draggable="${st !== 'encaixado'}" data-act="bloco" data-id="${b.id}" style="--c:${t.cor};--ink:${ink(t.cor)};--h:${36 + z.min / 5}px">
    <span class="sz" title="${esc(z.nome)}: ${z.min} min">${esc(z.sigla)}</span>
    <span class="tx"><b>${esc(b.acao)}</b><small>${sub}</small></span>
    ${marcas ? `<span class="mk">${marcas}</span>` : ''}
    ${o.estado || st === 'montando' || st === 'encaixado' || st === 'travado' || late ? `<span class="pill">${late && st !== 'travado' ? 'Atrasado' : ROT[st]}</span>` : ''}
  </div>`;
}
function pile(obra) {
  const bs = blocosDe(obra.id), done = bs.filter(b => b.feito).sort((a, b) => a.feito - b.feito), rest = bs.filter(b => !b.feito);
  const pc = (b, g) => { const t = tipoDe(b.tipo); return `<i class="${g ? 'ghost' : ''}${FX.novo === b.id ? ' novo' : ''}" style="--c:${t.cor};--w:${Math.max(14, tamDe(b.tam).min / 15 * 12)}px" title="${esc(b.acao)}"></i>`; };
  return `<div class="pile">${done.map(b => pc(b)).join('')}${rest.map(b => pc(b, 1)).join('')}</div>`;
}
const diasUteis = prazo => { let d = 0; for (let x = today(); x <= prazo && d < 3660; x = addDays(x, 1)) if (cfg().dias[parse(x).getDay()]) d++; return d; };
// progresso real: blocos e minutos entregues, e se o que falta cabe na capacidade até o prazo
function conta(obra) {
  const bs = blocosDe(obra.id), done = bs.filter(b => b.feito), rest = somaMin(bs) - somaMin(done);
  let cabe = null;
  if (obra.prazo && rest > 0) { const dias = diasUteis(obra.prazo); cabe = { dias, cap: dias * capDia(), ok: rest <= dias * capDia() }; }
  return { n: bs.length, feitos: done.length, total: somaMin(bs), rest, cabe };
}
function selo(c, prazo) {
  if (!prazo) return '';
  if (!c.rest) return `<span class="selo ok">Entregue</span>`;
  if (prazo < today()) return `<span class="selo bad">Prazo vencido</span>`;
  return c.cabe.ok ? `<span class="selo ok">Cabe até ${fmtData(prazo, { day: 'numeric', month: 'short' })}</span>`
    : `<span class="selo bad">Não cabe: faltam ${fmtMin(c.rest)}, cabem ${fmtMin(c.cabe.cap)}</span>`;
}
const contagem = prazo => { if (!prazo) return ''; const n = Math.round((parse(prazo) - parse(today())) / 864e5); return n < 0 ? `venceu há ${plural(-n, 'dia', 'dias')}` : n === 0 ? 'vence hoje' : `faltam ${plural(n, 'dia', 'dias')}`; };

/* ---------- Montar: bancada + dia ---------- */
const ordPrio = (a, b) => (b.fixo - a.fixo) || (b.chave - a.chave) || ((prazoDe(a) || '9') < (prazoDe(b) || '9') ? -1 : (prazoDe(a) || '9') > (prazoDe(b) || '9') ? 1 : tamDe(b.tam).min - tamDe(a.tam).min);
function bancada() {
  const t = today();
  return S.blocos.filter(b => naMesa(b) && ['liberado', 'montando'].includes(estado(b)) && (!b.dia || (b.dia < t && b.dia !== U.dia)));
}
function vMontar() {
  const d = U.dia, t = today(), f = U.bf, todos = bancada();
  const obrasB = [...new Set(todos.map(b => b.obra))].map(id => byId(S.obras, id));
  if (f.obra && !obrasB.some(o => o.id === f.obra)) f.obra = '';
  const livres = todos.filter(b => (!f.obra || b.obra === f.obra) && (!f.leve || b.energia === 1)).sort(ordPrio);
  const doDia = S.blocos.filter(b => b.dia === d && ativo(b)), usado = somaMin(doDia), pend = doDia.filter(b => !b.feito);
  const grupos = f.ord === 'cor' ? tipos().concat(SEM_TIPO).map(tp => ({ nome: tp.nome, cor: tp.cor, l: livres.filter(b => tipoDe(b.tipo).id === tp.id) }))
    : f.ord === 'obra' ? obrasB.map(o => ({ nome: o.nome, l: livres.filter(b => b.obra === o.id) }))
    : [{ nome: f.ord === 'tam' ? 'Do maior para o menor' : 'Por prioridade e prazo', l: f.ord === 'tam' ? livres.slice().sort((a, b) => tamDe(b.tam).min - tamDe(a.tam).min) : livres }];
  const naCaixa = S.blocos.filter(b => naMesa(b) && estado(b) === 'caixa').length, folga = !cfg().dias[parse(d).getDay()];
  const cores = tipos().concat(SEM_TIPO).map(tp => ({ tp, m: somaMin(doDia.filter(b => tipoDe(b.tipo).id === tp.id)) })).filter(x => x.m);
  const porTam = () => tams().map(z => {
    const l = doDia.filter(b => b.tam === z.id), cap = cfg().cap[z.id] || 0;
    if (!cap && !l.length) return '';
    return `<h4>${esc(z.sigla)} · ${z.min} min <span class="muted">${l.length}/${cap}</span></h4><div class="slots">${l.map(b => brick(b)).join('')}${Array.from({ length: Math.max(0, cap - l.length) }, () => `<div class="slot" style="--h:${36 + z.min / 5}px">espaço ${esc(z.sigla)}</div>`).join('')}</div>`;
  }).join('') + doDia.filter(b => !byId(S.tamanhos, b.tam)).map(b => brick(b)).join('');
  const porCor = () => (cores.map(x => `<h4><i class="dot" style="background:${x.tp.cor}"></i>${esc(x.tp.nome)} <span class="muted">${fmtMin(x.m)}</span></h4>${doDia.filter(b => tipoDe(b.tipo).id === x.tp.id).map(b => brick(b)).join('')}`).join('') || '<p class="empty">Dia vazio.</p>')
    + `<p class="muted sm hint">Vagas: ${tams().map(z => `${esc(z.sigla)} ${Math.max(0, vagas(d, z.id))}`).join(' · ')}</p>`;
  return `<div class="cols">
    <section class="panel" id="dia" data-drop="dia">
      <div class="phead"><button class="ib" data-act="dia" data-n="-1" aria-label="Dia anterior">‹</button>
        <div class="grow"><h2>${fmtDia(d)}</h2><p class="muted">${fmtData(d)}${folga ? ' · dia de folga' : ''}</p></div>
        ${d !== t ? `<button class="btn sm" data-act="dia" data-n="0">Hoje</button>` : ''}
        <button class="ib" data-act="dia" data-n="1" aria-label="Próximo dia">›</button></div>
      <div class="meter multi">${cores.map(x => `<i style="width:${capDia() ? x.m / Math.max(capDia(), usado) * 100 : 0}%;background:${x.tp.cor}" title="${esc(x.tp.nome)}: ${fmtMin(x.m)}"></i>`).join('')}</div>
      <p class="muted sm">${fmtMin(usado)} de ${fmtMin(capDia())} ocupados${cores.length > 1 ? ' · ' + cores.map(x => `${esc(x.tp.nome)} ${fmtMin(x.m)}`).join(', ') : ''}</p>
      ${!doDia.length && todos.length && d >= t ? `<div class="note banner">O dia está vazio e há ${plural(todos.length, 'bloco liberado', 'blocos liberados')}. <button class="btn sm pri" data-act="sugerir">Sugerir meu dia</button></div>` : ''}
      <div class="row tight"><button class="btn sm" data-act="sugerir" title="Preenche as vagas com os blocos mais urgentes">Sugerir</button>
        ${d === t ? `<button class="btn sm" data-act="agora">O que faço agora?</button>` : ''}
        ${pend.length ? `<button class="btn sm" data-act="empurrar">Empurrar pendentes</button><button class="btn sm" data-act="limparDia">Limpar</button>` : ''}
        ${d === t && doDia.length ? `<button class="btn sm" data-act="fecharDia">Fechar o dia</button>` : ''}
        <span class="grow"></span><div class="seg"><button data-act="dv" data-v="tam" class="${U.dv === 'tam' ? 'on' : ''}">Vagas</button><button data-act="dv" data-v="cor" class="${U.dv === 'cor' ? 'on' : ''}">Cores</button></div></div>
      ${U.dv === 'tam' ? porTam() : porCor()}
    </section>
    <section class="panel" id="bancada" data-drop="bancada">
      <div class="phead"><div class="grow"><h2>Bancada</h2><p class="muted">${plural(todos.length, 'bloco liberado', 'blocos liberados')}${naCaixa ? ` · ${naCaixa} na caixa` : ''}</p></div></div>
      <form data-form="captura" class="cap"><input name="q" placeholder="Captura rápida: Ligar para o cartório #comunicar @P" aria-label="Captura rápida de bloco avulso" autocomplete="off" maxlength="160"><button class="btn pri" aria-label="Capturar">＋</button></form>
      <div class="tools">${obrasB.length > 1 ? `<select data-bf="obra" aria-label="Filtrar por obra"><option value="">Todas as obras</option>${obrasB.map(o => `<option value="${o.id}" ${f.obra === o.id ? 'selected' : ''}>${esc(o.nome)}</option>`).join('')}</select>` : ''}
        <select data-bf="ord" aria-label="Ordenar a bancada">${[['cor', 'Agrupar por cor'], ['obra', 'Agrupar por obra'], ['prazo', 'Por prioridade e prazo'], ['tam', 'Por tamanho']].map(([v, n]) => `<option value="${v}" ${f.ord === v ? 'selected' : ''}>${n}</option>`).join('')}</select>
        <label class="tog"><input type="checkbox" data-bf="leve" ${f.leve ? 'checked' : ''}><span>Pouca energia</span></label></div>
      ${livres.length ? grupos.filter(g => g.l.length).map(g => `<h4>${g.cor ? `<i class="dot" style="background:${g.cor}"></i>` : ''}${esc(g.nome)} <span class="muted">${g.l.length}</span></h4>${g.l.map(b => brick(b)).join('')}`).join('')
        : `<p class="empty">${todos.length ? 'Nenhum bloco passa neste filtro.' : S.blocos.some(b => !b.feito && naMesa(b)) ? 'Nada na bancada: os blocos liberados já estão no dia.' : 'Nenhum bloco para montar. Desmonte um projeto em <b>Obras</b> ou capture um bloco avulso acima.'}</p>`}
      <p class="muted sm hint">Arraste um bloco para o dia (no celular, segure-o por um instante), ou toque nele. Só aparecem os blocos cujas entradas já existem.</p>
    </section>
  </div>`;
}

/* ---------- Obras ---------- */
function vObras() {
  const o = U.obra && byId(S.obras, U.obra);
  if (o) return vObra(o);
  U.obra = null;
  const arq = S.obras.filter(x => x.arquivada).length, l = S.obras.filter(x => !!x.arquivada === U.arq).sort((a, b) => (a.prazo || '9') < (b.prazo || '9') ? -1 : 1);
  return `<div class="phead top"><div class="grow"><h2>${U.arq ? 'Obras arquivadas' : 'Obras'}</h2><p class="muted">Cada projeto é uma pilha que cresce a cada bloco encaixado.</p></div>
      ${arq || U.arq ? `<button class="btn sm" data-act="verArq">${U.arq ? 'Ver ativas' : `Arquivadas (${arq})`}</button>` : ''}<button class="btn pri" data-act="novaObra">Nova obra</button></div>
  <div class="grid">${l.map(ob => { const c = conta(ob); return `<article class="card${ob.pausada ? ' pausada' : ''}" data-act="abrirObra" data-id="${ob.id}" role="button" tabindex="0">
      ${pile(ob)}<h3>${ob.icone ? esc(ob.icone) + ' ' : ''}${esc(ob.nome)}</h3>
      <p class="muted sm">${c.feitos} de ${plural(c.n, 'bloco', 'blocos')} · ${fmtMin(c.total - c.rest)} de ${fmtMin(c.total)}${ob.prazo && c.rest ? ' · ' + contagem(ob.prazo) : ''}</p>${selo(c, ob.prazo)}${ob.pausada ? ' <span class="selo">Pausada</span>' : ''}</article>`; }).join('') || `<p class="empty">${U.arq ? 'Nenhuma obra arquivada.' : 'Nenhuma obra ainda. Comece por <b>Nova obra</b> e use uma planta pronta.'}</p>`}</div>`;
}
function vObra(o) {
  const c = conta(o), mods = S.modulos.filter(m => m.obra === o.id).sort((a, b) => a.ordem - b.ordem);
  const pCap = c.rest ? previsao(c.rest, capDia()) : '', ritmo = mediaReal(), pReal = c.rest && ritmo > 1 ? previsao(c.rest, ritmo) : '';
  const lista = () => mods.map((m, i) => { const bs = S.blocos.filter(b => b.modulo === m.id).sort((a, b) => a.ordem - b.ordem), ok = bs.filter(b => b.feito).length, fech = U.col.has(m.id); return `<section class="panel mod${bs.length && ok === bs.length ? ' pronto' : ''}" data-fx="${m.id}">
      <div class="phead"><button class="ib sm" data-act="recolher" data-id="${m.id}" aria-label="${fech ? 'Abrir' : 'Recolher'} módulo">${fech ? '▸' : '▾'}</button><input class="title sm" data-store="modulos" data-id="${m.id}" data-f="nome" value="${esc(m.nome)}" aria-label="Nome do módulo">
        <span class="muted sm">${ok}/${bs.length}${bs.length && ok === bs.length ? ' · entregue' : ''}</span>
        <button class="ib sm" data-act="moverMod" data-id="${m.id}" data-n="-1" aria-label="Subir módulo" ${i ? '' : 'disabled'}>↑</button><button class="ib sm" data-act="moverMod" data-id="${m.id}" data-n="1" aria-label="Descer módulo" ${i < mods.length - 1 ? '' : 'disabled'}>↓</button>
        <button class="ib sm" data-act="delMod" data-id="${m.id}" aria-label="Excluir módulo">✕</button></div>
      <div class="meter"><i style="width:${bs.length ? ok / bs.length * 100 : 0}%"></i></div>
      ${fech ? '' : `${bs.map(b => brick(b, { fluxo: 1, estado: 1 })).join('')}
      <form data-form="captura" data-mod="${m.id}" class="cap"><input name="q" placeholder="Novo bloco rápido neste módulo…" aria-label="Novo bloco rápido" autocomplete="off" maxlength="160"><button class="btn" aria-label="Adicionar">＋</button><button type="button" class="btn" data-act="novoBloco" data-mod="${m.id}">Detalhado</button></form>`}</section>`; }).join('') + `<button class="btn" data-act="novoMod" data-id="${o.id}">＋ Módulo</button>`;
  return `<div class="phead top"><button class="ib" data-act="abrirObra" data-id="" aria-label="Voltar">‹</button>
      <input class="title ico" data-store="obras" data-id="${o.id}" data-f="icone" data-redraw value="${esc(o.icone)}" maxlength="4" placeholder="🧱" aria-label="Ícone da obra">
      <div class="grow"><input class="title" data-store="obras" data-id="${o.id}" data-f="nome" value="${esc(o.nome)}" aria-label="Nome da obra"></div>
      <details class="menu"><summary class="btn sm">Ações</summary><div>
        <button data-act="pausarObra" data-id="${o.id}">${o.pausada ? 'Retomar a obra' : 'Pausar a obra'}</button><button data-act="arquivar" data-id="${o.id}">${o.arquivada ? 'Desarquivar' : 'Arquivar'}</button>
        <button data-act="duplicarObra" data-id="${o.id}">Duplicar</button><button data-act="salvarPlanta" data-id="${o.id}">Salvar como planta</button>
        <button data-act="importarTexto" data-id="${o.id}">Desmontar por texto</button><button data-act="exportarObra" data-id="${o.id}">Copiar como texto</button>
        <button class="danger" data-act="delObra" data-id="${o.id}">Excluir</button></div></details></div>
    <div class="panel obrahead">${pile(o)}<div><p><b>${c.feitos} de ${plural(c.n, 'bloco', 'blocos')}</b> · ${fmtMin(c.total - c.rest)} de ${fmtMin(c.total)}</p>
      <label class="inl">Prazo <input type="date" data-store="obras" data-id="${o.id}" data-f="prazo" data-redraw value="${o.prazo}"></label> ${selo(c, o.prazo)} ${o.prazo && c.rest ? `<span class="muted sm">${contagem(o.prazo)}</span>` : ''}
      <label class="fld sm0">Entrega final<input data-store="obras" data-id="${o.id}" data-f="entrega" value="${esc(o.entrega)}" placeholder="O que existe quando a obra termina" maxlength="200"></label>
      ${pCap ? `<p class="muted sm prev">Com a capacidade cheia, termina ${fmtDia(pCap).toLowerCase()}.${pReal ? ` No seu ritmo real das últimas duas semanas (${fmtMin(ritmo)} por dia), ${fmtDia(pReal).toLowerCase()}.` : ''}</p>` : ''}
      ${o.pausada ? '<p class="muted sm">Obra pausada: os blocos dela não aparecem na bancada.</p>' : ''}</div></div>
    <div class="tools"><div class="seg">${[['lista', 'Módulos'], ['kanban', 'Kanban'], ['manual', 'Manual de montagem']].map(([v, n]) => `<button data-act="ov" data-v="${v}" class="${U.ov === v ? 'on' : ''}">${n}</button>`).join('')}</div></div>
    ${U.ov === 'kanban' ? kboard('modulo', blocosDe(o.id)) : U.ov === 'manual' ? vManual(o) : lista()}`;
}

/* ---------- Plantas ---------- */
function vPlantas() {
  return `<div class="phead top"><div class="grow"><h2>Plantas</h2><p class="muted">Projetos que se repetem viram modelos. Abra uma obra e use <b>Ações › Salvar como planta</b> para criar a sua.</p></div><button class="btn sm" data-act="importar">Importar planta</button></div>
  <div class="grid">${S.plantas.map(p => { const f = Data.flat(p); return `<article class="card planta">
    <input class="title sm" data-store="plantas" data-id="${p.id}" data-f="nome" value="${esc(p.nome)}" aria-label="Nome da planta">
    <p class="muted sm">${plural(f.length, 'bloco', 'blocos')} · cerca de ${fmtMin(somaMin(f))}</p>
    ${p.modulos.map(m => `<div class="pm"><b>${esc(m.nome)}</b><div class="chips">${m.blocos.map(b => { const t = tipoDe(b.tipo); return `<span class="chip" style="--c:${t.cor};--ink:${ink(t.cor)}">${esc(b.acao)} (${b.vezes > 1 ? b.vezes + '× ' : ''}${esc(tamDe(b.tam).sigla)})</span>`; }).join('<span class="arr">→</span>')}</div></div>`).join('')}
    <div class="row"><button class="btn pri sm" data-act="novaObra" data-planta="${p.id}">Usar esta planta</button><button class="btn sm" data-act="duplicarPlanta" data-id="${p.id}">Duplicar</button><button class="btn sm" data-act="exportarPlanta" data-id="${p.id}">Exportar</button><button class="btn sm danger" data-act="delPlanta" data-id="${p.id}">Excluir</button></div></article>`; }).join('') || `<p class="empty">Nenhuma planta salva.</p>`}</div>`;
}

/* ---------- Ajustes ---------- */
const PALETAS = { 'Clássica': ['#2D7DD2', '#2FA05A', '#E8B81F', '#8B5CF6', '#E0483C', '#C9CED8'], 'Pastel': ['#9CC5F2', '#A8DDB5', '#F6E09A', '#CDB9F5', '#F4A9A2', '#DDE1E8'], 'Alto contraste': ['#0B4FA8', '#0E6B33', '#FFD400', '#5B21B6', '#B3140A', '#111827'], 'Terra': ['#3E7C8C', '#6E8B3D', '#D9A441', '#8C5E7A', '#B5533C', '#BFB5A2'] };
const RITMOS = { 'Padrão 15 · 45 · 90': [15, 45, 90], 'Pomodoro 25 · 50 · 100': [25, 50, 100], 'Curto 10 · 30 · 60': [10, 30, 60] };
function vAjustes() {
  const c = cfg(), s = S.set, gOn = Sync.gOn(), sem = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  const canInst = !Sync.avail && !matchMedia('(display-mode: standalone)').matches;
  const chk = (k, n) => `<label class="tog"><input type="checkbox" data-s="${k}" ${s[k] ? 'checked' : ''}><span>${n}</span></label>`;
  return `<div class="phead top"><div class="grow"><h2>Ajustes</h2><p class="muted">As peças são suas: mude cores, nomes, tamanhos e a capacidade do dia.</p></div><button class="btn sm" data-act="ajuda">Manual e atalhos</button></div>
  <div class="cols">
  <section class="panel"><h3>Tipos de bloco</h3>
    ${tipos().map(t => `<div class="rowf"><input type="color" data-store="tipos" data-id="${t.id}" data-f="cor" value="${t.cor}" aria-label="Cor"><input data-store="tipos" data-id="${t.id}" data-f="nome" value="${esc(t.nome)}" aria-label="Nome" class="w1"><input data-store="tipos" data-id="${t.id}" data-f="desc" value="${esc(t.desc)}" aria-label="Verbos deste tipo" class="w2" placeholder="verbos: ler, buscar…"><button class="ib sm" data-act="delReg" data-store="tipos" data-id="${t.id}" aria-label="Excluir tipo">✕</button></div>`).join('')}
    <button class="btn sm add" data-act="novoTipo">＋ Tipo</button>
    <p class="muted sm hint">Os verbos servem para adivinhar o tipo quando você escreve a ação.</p>
    <h4>Paletas prontas</h4><div class="chips">${Object.entries(PALETAS).map(([n, p]) => `<button class="btn sm pal" data-act="paleta" data-v="${n}">${p.map(x => `<i style="background:${x}"></i>`).join('')}${n}</button>`).join('')}</div></section>
  <section class="panel"><h3>Tamanhos e capacidade</h3><p class="muted sm">O maior tamanho é o teto: o que passar dele vira dois ou mais blocos.</p>
    ${tams().map(z => `<div class="rowf"><input data-store="tamanhos" data-id="${z.id}" data-f="sigla" value="${esc(z.sigla)}" maxlength="3" class="w0" aria-label="Sigla"><input data-store="tamanhos" data-id="${z.id}" data-f="nome" value="${esc(z.nome)}" class="w1" aria-label="Nome"><label class="inl"><input type="number" min="5" max="480" step="5" data-store="tamanhos" data-id="${z.id}" data-f="min" value="${z.min}" class="w0"> min</label><label class="inl">cabem <input type="number" min="0" max="20" data-cap="${z.id}" value="${c.cap[z.id] || 0}" class="w0"> por dia</label><button class="ib sm" data-act="delReg" data-store="tamanhos" data-id="${z.id}" aria-label="Excluir tamanho">✕</button></div>`).join('')}
    <button class="btn sm add" data-act="novoTam">＋ Tamanho</button>
    <h4>Ritmos prontos</h4><div class="chips">${Object.keys(RITMOS).map(n => `<button class="btn sm" data-act="ritmo" data-v="${n}">${n}</button>`).join('')}</div>
    <h4>Dias de trabalho</h4><div class="chips">${sem.map((n, i) => `<label class="tog"><input type="checkbox" data-dia="${i}" ${c.dias[i] ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div>
    <h4>Limites</h4><div class="rowf"><label class="inl">No máximo <input type="number" min="0" max="20" data-cfg="wip" value="${c.wip}" class="w0"> blocos montando ao mesmo tempo (0 = sem limite)</label></div>
    <div class="rowf"><label class="inl">Meta de <input type="number" min="0" max="500" data-cfg="meta" value="${c.meta}" class="w0"> blocos encaixados por semana</label></div></section>
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
    <h4>Aparência</h4><div class="chips">${[['auto', 'Automática'], ['claro', 'Clara'], ['escuro', 'Escura']].map(([v, n]) => `<button class="btn sm ${s.tema === v ? 'pri' : ''}" data-act="set" data-k="tema" data-v="${v}">${n}</button>`).join('')}</div>
    <h4>Estilo das peças</h4><div class="chips">${[['pinos', 'Com pinos'], ['redondo', 'Pinos redondos'], ['liso', 'Lisas'], ['contorno', 'Só contorno']].map(([v, n]) => `<button class="btn sm ${s.estilo === v ? 'pri' : ''}" data-act="set" data-k="estilo" data-v="${v}">${n}</button>`).join('')}</div>
    <h4>Sensações</h4><div class="chips">${chk('anim', 'Animações')}${chk('som', 'Sons')}${chk('vibra', 'Vibração')}${chk('denso', 'Peças compactas')}${'Notification' in window ? chk('notif', 'Avisar quando o tempo acabar') : ''}</div>
    <h4>Backup</h4><div class="row"><button class="btn sm" data-act="exportar">Exportar backup</button><button class="btn sm" data-act="importar">Importar backup</button></div>
    ${canInst ? `<h4>Aplicativo</h4><p class="muted sm">${inst ? 'Instale o Blocos para abrir em tela cheia, com ícone próprio e sem internet.' : 'No celular: menu do navegador › “Adicionar à tela inicial”. No Windows há também o Blocos.exe em <a href="https://github.com/joaogabrielmontinirossi-sys/blocos/releases/latest" target="_blank" rel="noopener">Releases</a>.'}</p>${inst ? `<button class="btn sm" data-act="install">Instalar o aplicativo</button>` : ''}` : ''}</section>
  </div>`;
}

/* ---------- desenho ---------- */
const TABS = [['montar', 'Montar', vMontar], ['kanban', 'Kanban', vKanban], ['obras', 'Obras', vObras], ['plantas', 'Plantas', vPlantas], ['muro', 'Muro', vMuro], ['diag', 'Diagnóstico', vDiag], ['ajustes', 'Ajustes', vAjustes]];
function draw() {
  const s = S.set, b = document.body, y = scrollY;
  document.documentElement.dataset.theme = s.tema === 'claro' ? 'light' : s.tema === 'escuro' ? 'dark' : '';
  b.dataset.estilo = s.estilo; b.classList.toggle('denso', !!s.denso); b.classList.toggle('noanim', !FX.on());
  $('#tabs').innerHTML = TABS.map(([id, n]) => `<button data-act="tab" data-tab="${id}" class="${U.tab === id ? 'on' : ''}">${n}</button>`).join('');
  const main = $('#main');
  main.innerHTML = TABS.find(t => t[0] === U.tab)[2]();
  if (ultimaAba !== U.tab + (U.obra || '')) { ultimaAba = U.tab + (U.obra || ''); FX.play(main, 'tab'); } else scrollTo(0, y);
  const m = S.blocos.find(x => x.inicio && !x.feito && !x.trava);
  document.title = m ? `▶ ${m.acao} · Blocos` : 'Blocos';
  FX.flush(); drawStatus();
}
function drawStatus() { const el = $('#sync'), err = Sync.error || Sync.g.error; el.textContent = Sync.status(); el.classList.toggle('bad', !!(Sync.any() && err)); el.title = err || ''; }

/* ---------- folhas: cartão do bloco e formulários ---------- */
function sheet(html, cls) { const el = $('#sheet'); el.className = cls || ''; el.innerHTML = html; document.body.classList.add('sheet'); const f = $('#sheet [autofocus]'); if (f) f.focus(); }
function closeSheet() { document.body.classList.remove('sheet'); $('#sheet').innerHTML = ''; U.verso = false; }

// O cartão do bloco tem frente (o contrato: entrada, saída, ações) e verso (notas, checklist, história).
function sheetBloco(id) {
  const b = byId(S.blocos, id); if (!b) return;
  const st = estado(b), t = tipoDe(b.tipo), z = tamDe(b.tam), o = obraDe(b), m = byId(S.modulos, b.modulo), f = faltam(b);
  const noDia = b.dia && (b.dia >= today() || b.dia === U.dia), gasto = gastoDe(b) / 60000, ok = b.pinos.filter(p => p.ok).length;
  const libera = S.blocos.filter(x => !x.feito && x.deps.includes(id));
  const frente = `<h2>${b.chave ? '★ ' : ''}${esc(b.acao)}</h2><p class="muted">${esc(o ? o.nome : '')}${m ? ' › ' + esc(m.nome) : ''}${b.dia ? ' · ' + fmtDia(b.dia) : ''}</p>
    <dl class="io"><dt>Entrada</dt><dd>${esc(b.entrada)}</dd><dt>Saída</dt><dd>${esc(b.saida)}</dd>
      ${b.prazo ? `<dt>Prazo</dt><dd>${fmtData(b.prazo, { day: 'numeric', month: 'short' })} · ${contagem(b.prazo)}</dd>` : ''}
      ${b.energia ? `<dt>Energia</dt><dd>${ENERGIA[b.energia]}</dd>` : ''}
      ${gasto >= 1 ? `<dt>Tempo</dt><dd>${fmtMin(gasto)} de ${fmtMin(z.min)} estimados${z.min ? ` (${Math.round(gasto / z.min * 100)}%)` : ''}</dd>` : ''}
      ${b.repete ? `<dt>Rotina</dt><dd>Volta ${b.repete === 'dia' ? 'no dia seguinte' : 'na semana seguinte'} ao ser encaixado</dd>` : ''}
      ${b.link ? `<dt>Link</dt><dd><a href="${esc(/^https?:\/\//i.test(b.link) ? b.link : 'https://' + b.link)}" target="_blank" rel="noopener">${esc(b.link)}</a></dd>` : ''}</dl>
    ${b.tags ? `<div class="chips">${b.tags.split(',').map(x => x.trim()).filter(Boolean).map(x => `<span class="tag">#${esc(x)}</span>`).join('')}</div>` : ''}
    ${st === 'caixa' ? `<p class="note">Na caixa: ${f.length === 1 ? 'falta encaixar' : 'faltam encaixar'} ${f.map(x => `<b>${esc(x.acao)}</b>`).join(', ')}.</p>` : ''}
    ${st === 'travado' ? `<p class="note">Travado: <b>${esc(b.trava)}</b></p>` : ''}
    ${libera.length && st !== 'encaixado' ? `<p class="muted sm">Ao encaixar, libera: ${libera.map(x => esc(x.acao)).join(', ')}.</p>` : ''}
    <div class="acts">
      ${st === 'liberado' ? `<button class="btn pri" data-act="iniciar" data-id="${id}">Começar a montar</button><button class="btn" data-act="foco" data-id="${id}">Modo foco</button>${noDia ? `<button class="btn" data-act="tirar" data-id="${id}">Devolver à bancada</button>` : `<button class="btn" data-act="agendar" data-id="${id}">Pôr em ${fmtDia(U.dia).toLowerCase()}</button>`}` : ''}
      ${st === 'montando' ? `<button class="btn pri" data-act="inspecionar" data-id="${id}">Inspecionar e encaixar</button><button class="btn" data-act="foco" data-id="${id}">Modo foco</button><button class="btn" data-act="pausar" data-id="${id}">Pausar</button>` : ''}
      ${st === 'travado' ? `<button class="btn pri" data-act="destravar" data-id="${id}">Destravar</button>` : ''}
      ${st === 'encaixado' ? `<button class="btn" data-act="desfazer" data-id="${id}">Desfazer o encaixe</button>` : ''}
      <button class="btn" data-act="editar" data-id="${id}">Editar</button>
    </div>
    <details class="mais"><summary>Mais ações</summary><div class="acts">
      ${st !== 'encaixado' ? `<button class="btn sm" data-act="quebrar" data-id="${id}">Quebrar em partes</button><button class="btn sm" data-act="fundir" data-id="${id}">Fundir com o seguinte</button>${st !== 'travado' ? `<button class="btn sm" data-act="travar" data-id="${id}">Travar</button>` : ''}` : ''}
      <button class="btn sm" data-act="flag" data-k="chave" data-id="${id}">${b.chave ? 'Tirar a estrela' : 'Marcar como bloco-chave'}</button><button class="btn sm" data-act="flag" data-k="fixo" data-id="${id}">${b.fixo ? 'Desafixar' : 'Fixar no topo'}</button>
      <button class="btn sm" data-act="duplicar" data-id="${id}">Duplicar</button><button class="btn sm" data-act="mover" data-n="-1" data-id="${id}">Subir</button><button class="btn sm" data-act="mover" data-n="1" data-id="${id}">Descer</button>
      <button class="btn sm" data-act="compartilhar" data-id="${id}">Compartilhar</button><button class="btn sm danger" data-act="delBloco" data-id="${id}">Excluir</button></div></details>`;
  const verso = `<h3>Notas</h3><textarea data-store="blocos" data-id="${id}" data-f="notas" rows="4" placeholder="Anotações deste bloco…" aria-label="Notas">${esc(b.notas)}</textarea>
    <h3>Checklist <span class="muted">${ok}/${b.pinos.length}</span></h3>
    <div class="pinos">${b.pinos.map((p, i) => `<label><input type="checkbox" data-pino="${i}" data-id="${id}" ${p.ok ? 'checked' : ''}><span>${esc(p.t)}</span><button type="button" class="ib sm" data-act="delPino" data-id="${id}" data-i="${i}" aria-label="Remover item">✕</button></label>`).join('')}</div>
    <form data-form="pino" data-id="${id}" class="cap"><input name="t" placeholder="Novo item do checklist" maxlength="200" aria-label="Novo item"><button class="btn">＋</button></form>
    <h3>História</h3><ul class="hist">${b.criado ? `<li>Criado em ${fmtQuando(b.criado)}</li>` : ''}${b.quebradoEm ? `<li>Nasceu de uma quebra em ${fmtQuando(b.quebradoEm)}</li>` : ''}${b.inicio && !b.feito ? `<li>Montando desde ${fmtQuando(b.inicio)}</li>` : ''}${gasto >= 1 ? `<li>${fmtMin(gasto)} de trabalho medido</li>` : ''}${b.feito ? `<li>Encaixado em ${fmtQuando(b.feito)}</li>` : ''}</ul>`;
  sheet(`<div class="shead"><span class="chip" style="--c:${t.cor};--ink:${ink(t.cor)}">${esc(t.nome)} · ${esc(z.sigla)} ${z.min} min</span><span class="pill st-${st}">${ROT[st]}</span>
      <button class="btn sm" data-act="virar" data-id="${id}">${U.verso ? 'Ver a frente' : `Verso${b.notas || b.pinos.length ? ' •' : ''}`}</button><button class="ib" data-act="fechar" aria-label="Fechar">✕</button></div>
    <div class="cartao" style="--c:${t.cor}"><div class="face">${U.verso ? verso : frente}</div></div>`, 'card');
}
function sheetInspecao(id) {
  const b = byId(S.blocos, id), falta = b.pinos.filter(p => !p.ok).length;
  sheet(`<div class="shead"><b>Inspeção</b><span class="grow"></span><button class="ib" data-act="fechar" aria-label="Fechar">✕</button></div>
    <h2>A saída existe de fato?</h2><p class="muted">${esc(b.acao)}</p><div class="saida">${esc(b.saida)}</div>
    ${falta ? `<p class="note">${plural(falta, 'item do checklist ainda está aberto', 'itens do checklist ainda estão abertos')}.</p>` : ''}
    <div class="acts"><button class="btn pri" data-act="encaixar" data-id="${id}">Sim, existe: encaixar</button><button class="btn" data-act="${Foco.id === id ? 'fechar' : 'bloco'}" data-id="${id}">Ainda não</button></div>`);
}
// quem depende (direta ou indiretamente) de um bloco não pode virar entrada dele
function depende(a, alvo, seen = new Set()) { if (a.id === alvo) return true; if (seen.has(a.id)) return false; seen.add(a.id); return a.deps.some(d => { const x = byId(S.blocos, d); return x && depende(x, alvo, seen); }); }
// o verbo da ação aponta o tipo: compara o começo da primeira palavra com os verbos de cada tipo
function adivinha(acao) {
  const v = norma(acao).split(/\s+/)[0] || '';
  if (v.length < 3) return '';
  const t = tipos().find(tp => norma(tp.desc + ' ' + tp.nome).split(/[^a-z]+/).some(w => w.length >= 3 && w.slice(0, 4) === v.slice(0, 4)));
  return t ? t.id : '';
}
function sheetEditar(id, modId) {
  const novo = !id, m = byId(S.modulos, novo ? modId : byId(S.blocos, id).modulo);
  const irmaos = blocosDe(m.obra), ult = irmaos.filter(x => x.modulo === m.id).pop() || irmaos.filter(x => (byId(S.modulos, x.modulo) || {}).ordem < m.ordem).pop();
  const b = novo ? { acao: '', tipo: '', tam: (tams().slice(-1)[0] || {}).id || '', entrada: '', saida: '', deps: ult ? [ult.id] : [], modulo: m.id, prazo: '', energia: 0, tags: '', link: '', repete: '' } : byId(S.blocos, id);
  const opts = irmaos.filter(x => x.id !== id && (novo || !depende(x, id)));
  sheet(`<form data-form="bloco" data-id="${id || ''}" data-obra="${m.obra}">
    <div class="shead"><b>${novo ? 'Novo bloco' : 'Editar bloco'}</b><span class="grow"></span><button type="button" class="ib" data-act="fechar" aria-label="Fechar">✕</button></div>
    <label class="fld">Ação: um verbo e um entregável<input name="acao" value="${esc(b.acao)}" placeholder="Fichar o artigo do Tartuce" required autofocus maxlength="120"></label>
    <div class="fld">Tipo${novo ? ' <small class="muted">(adivinhado pelo verbo; troque se quiser)</small>' : ''}<div class="chips">${tipos().map(t => `<label class="pick" style="--c:${t.cor};--ink:${ink(t.cor)}"><input type="radio" name="tipo" value="${t.id}" ${b.tipo === t.id ? 'checked' : ''} required><span>${esc(t.nome)}</span></label>`).join('')}</div></div>
    <div class="fld">Tamanho<div class="chips">${tams().reverse().map(z => `<label class="pick"><input type="radio" name="tam" value="${z.id}" ${b.tam === z.id ? 'checked' : ''} required><span>${esc(z.sigla)} · ${z.min} min</span></label>`).join('')}</div>
      <small class="muted">Não cabe no maior? Então são dois blocos.</small></div>
    <label class="fld">Módulo<select name="modulo">${S.modulos.filter(x => x.obra === m.obra).sort((a, c) => a.ordem - c.ordem).map(x => `<option value="${x.id}" ${x.id === b.modulo ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}</select></label>
    ${opts.length ? `<div class="fld">Encaixa depois de<div class="deps">${opts.map(x => `<label><input type="checkbox" name="deps" value="${x.id}" ${b.deps.includes(x.id) ? 'checked' : ''}><span>${esc(x.acao)} <small class="muted">→ ${esc(x.saida)}</small></span></label>`).join('')}</div></div>` : ''}
    <label class="fld">Entrada: o que precisa existir antes<input name="entrada" value="${esc(b.entrada)}" placeholder="Em branco: usa a saída dos blocos anteriores" maxlength="200"></label>
    <label class="fld">Saída: o que existe depois<input name="saida" value="${esc(b.saida)}" placeholder="Ficha com 5 citações" required maxlength="200"></label>
    <details class="mais"${b.prazo || b.energia || b.tags || b.link || b.repete ? ' open' : ''}><summary>Mais campos do cartão</summary>
      <div class="fld">Energia que o bloco pede<div class="chips">${[0, 1, 2, 3].map(e => `<label class="pick"><input type="radio" name="energia" value="${e}" ${b.energia === e ? 'checked' : ''}><span>${e ? ENERGIA[e].split(' ')[0] : 'Tanto faz'}</span></label>`).join('')}</div></div>
      <label class="fld">Prazo próprio do bloco<input type="date" name="prazo" value="${b.prazo}"></label>
      <label class="fld">Etiquetas, separadas por vírgula<input name="tags" value="${esc(b.tags)}" placeholder="biblioteca, urgente" maxlength="120"></label>
      <label class="fld">Link<input name="link" value="${esc(b.link)}" placeholder="https://…" maxlength="300"></label>
      <label class="fld">Rotina<select name="repete"><option value="">Não se repete</option><option value="dia" ${b.repete === 'dia' ? 'selected' : ''}>Volta no dia seguinte</option><option value="semana" ${b.repete === 'semana' ? 'selected' : ''}>Volta na semana seguinte</option></select></label></details>
    <div class="acts"><button class="btn pri">Salvar</button></div></form>`);
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
  const flat = Data.flat(p), tot = somaMin(flat), prazo = f.prazo.value;
  let s = `${plural(flat.length, 'bloco', 'blocos')} e cerca de ${fmtMin(tot)} de trabalho.`;
  if (prazo) { const cap = diasUteis(prazo) * capDia(); s += tot <= cap ? ` Cabe até o prazo (há ${fmtMin(cap)} de capacidade).` : ` <b>Não cabe até o prazo</b>: há só ${fmtMin(cap)} de capacidade.`; }
  else { const d = previsao(tot, capDia()); if (d) s += ` Com a capacidade cheia, termina ${fmtDia(d).toLowerCase()}.`; }
  el.hidden = false; el.innerHTML = s;
}
function sheetTexto(obraId) {
  sheet(`<form data-form="texto" data-id="${obraId}"><div class="shead"><b>Desmontar por texto</b><span class="grow"></span><button type="button" class="ib" data-act="fechar" aria-label="Fechar">✕</button></div>
    <p class="muted sm">Uma linha por bloco. Linhas começando com <code>#</code> abrem um módulo. Opcional: <code>Ação | tipo | tamanho | saída</code>. Cada bloco encaixa depois do anterior.</p>
    <textarea name="t" rows="10" required autofocus placeholder="# Pesquisa&#10;Definir tema | decidir | P | Tema definido&#10;Buscar 5 fontes | pesquisar | M&#10;# Rascunho&#10;Escrever introdução | produzir | G"></textarea>
    <div class="acts"><button class="btn pri">Criar blocos</button></div></form>`);
}
function sheetFechar() {
  const t = today(), doDia = S.blocos.filter(b => b.dia === t && ativo(b)), ok = doDia.filter(b => b.feito), pend = doDia.filter(b => !b.feito), h = historico();
  sheet(`<div class="shead"><b>Fechar o dia</b><span class="grow"></span><button class="ib" data-act="fechar" aria-label="Fechar">✕</button></div>
    <h2>${ok.length ? `${plural(ok.length, 'bloco encaixado', 'blocos encaixados')} hoje` : 'Nenhum bloco encaixado hoje'}</h2>
    <p class="muted">${fmtMin(somaMin(ok))} de trabalho entregue · ${plural(h.seq, 'dia seguido', 'dias seguidos')}</p>
    <div class="pile">${ok.map(b => `<i style="--c:${tipoDe(b.tipo).cor};--w:${Math.max(14, tamDe(b.tam).min / 15 * 12)}px"></i>`).join('')}</div>
    ${pend.length ? `<p class="note">${plural(pend.length, 'bloco ficou', 'blocos ficaram')} no dia: ${pend.map(b => esc(b.acao)).join(', ')}.</p>
      <div class="acts"><button class="btn pri" data-act="empurrar" data-fechar="1">Empurrar para amanhã</button><button class="btn" data-act="limparDia" data-fechar="1">Devolver à bancada</button></div>` : `<p class="note">Dia limpo: nada ficou para trás.</p>`}`);
}
function sheetAjuda() {
  sheet(`<div class="shead"><b>Manual do método</b><span class="grow"></span><button class="ib" data-act="fechar" aria-label="Fechar">✕</button></div>
    <ol class="sm"><li><b>Desmontar:</b> quebre a obra em módulos e blocos, ou use uma planta.</li><li><b>Encaixar:</b> a saída de um bloco é a entrada do outro; isso define a ordem.</li><li><b>Montar:</b> o dia tem vagas fixas por tamanho. Só entram blocos liberados.</li><li><b>Inspecionar:</b> um bloco só é encaixado quando a saída existe de fato.</li></ol>
    <h3>Captura rápida</h3><p class="muted sm"><code>#tipo</code> escolhe a cor, <code>@P</code> o tamanho, <code>!</code> marca como bloco-chave, <code>&gt; texto</code> define a saída. Outras <code>#palavras</code> viram etiquetas. Sem <code>#tipo</code>, o verbo decide.</p>
    <h3>Atalhos</h3><dl class="io"><dt>1 a 7</dt><dd>Trocar de aba</dd><dt>N</dt><dd>Captura rápida</dd><dt>/</dt><dd>Buscar no Kanban</dd><dt>← →</dt><dd>Dia anterior e seguinte</dd><dt>H</dt><dd>Voltar para hoje</dd><dt>S</dt><dd>Sugerir meu dia</dd><dt>F</dt><dd>Foco no bloco que está montando</dd><dt>?</dt><dd>Este manual</dd><dt>Esc</dt><dd>Fechar</dd></dl>`);
}

/* ---------- regras ---------- */
function agendar(id, dia) {
  const b = byId(S.blocos, id); if (!b) return false;
  const st = estado(b), z = tamDe(b.tam);
  if (st === 'caixa') return recusa(id, 'Este bloco ainda está na caixa: falta uma entrada.');
  if (st === 'travado') return recusa(id, 'Este bloco está travado. Destrave antes de agendar.');
  if (st === 'encaixado') return false;
  const cap = cfg().cap[b.tam] || 0;
  if (vagas(dia, b.tam, id) < 1) return recusa(id, `Sem espaço ${z.sigla} em ${fmtDia(dia).toLowerCase()}: ${cap ? `os ${cap} já estão ocupados` : 'a capacidade é zero'}.`);
  b.dia = dia; Data.put('blocos', b); FX.mark(id, 'pop'); return true;
}
function iniciar(id) {
  const b = byId(S.blocos, id), wip = cfg().wip;
  if (estado(b) !== 'liberado') return recusa(id, 'Só dá para começar um bloco liberado.');
  if (wip && S.blocos.filter(x => ativo(x) && estado(x) === 'montando').length >= wip) return recusa(id, `Limite de ${plural(wip, 'bloco montando', 'blocos montando')} ao mesmo tempo. Encaixe ou pause um antes.`);
  b.inicio = Date.now();
  if ((!b.dia || b.dia < today()) && vagas(today(), b.tam, id) > 0) b.dia = today();
  Data.put('blocos', b); return true;
}
function encaixar(id) {
  const b = byId(S.blocos, id), o = obraDe(b), antes = new Set(S.blocos.filter(x => estado(x) === 'caixa').map(x => x.id));
  b.gasto = gastoDe(b); b.inicio = 0; b.feito = Date.now(); if (!b.dia) b.dia = today();
  Data.put('blocos', b, true);
  if (b.repete) Data.put('blocos', Object.assign({}, b, { id: uid(), feito: 0, gasto: 0, deps: [], criado: Date.now(), dia: addDays(today(), b.repete === 'dia' ? 1 : 7), pinos: b.pinos.map(p => ({ t: p.t, ok: false })), ordem: b.ordem + 0.5 }), true);
  const lib = S.blocos.filter(x => antes.has(x.id) && estado(x) === 'liberado');
  lib.forEach(x => FX.mark(x.id, 'lib'));
  FX.mark(id, 'snap'); FX.novo = id; FX.snap();
  const doMod = S.blocos.filter(x => x.modulo === b.modulo), daObra = blocosDe(b.obra);
  let msg = 'Encaixado.' + (lib.length ? ` ${plural(lib.length, 'bloco foi liberado', 'blocos foram liberados')}.` : '');
  if (daObra.every(x => x.feito) && o && o.id !== 'avulsos') { o.feitaEm = Date.now(); Data.put('obras', o, true); FX.confete(); FX.win(); msg = `Obra entregue: ${o.nome}.`; }
  else if (doMod.length > 1 && doMod.every(x => x.feito)) { FX.mark(b.modulo, 'mod'); FX.win(); msg = `Módulo entregue: ${(byId(S.modulos, b.modulo) || {}).nome || ''}.`; }
  else if (lib.length) setTimeout(FX.free, 160);
  DB.changed(); toast(msg);
}
function quebrar(id, n) {
  const b = byId(S.blocos, id), base = b.acao.replace(/ \(parte \d+\)$/, ''), ids = Array.from({ length: n - 1 }, uid), agora = Date.now();
  S.blocos.filter(x => x.deps.includes(id)).forEach(x => { x.deps = x.deps.map(d => d === id ? ids[n - 2] : d); Data.put('blocos', x, true); });
  blocosDe(b.obra).filter(x => x.ordem > b.ordem).forEach(x => { x.ordem += n - 1; Data.put('blocos', x, true); });
  ids.forEach((nid, i) => { Data.put('blocos', Object.assign({}, b, { id: nid, acao: `${base} (parte ${i + 2})`, deps: [i ? ids[i - 1] : id], entrada: b.saida, dia: '', inicio: 0, feito: 0, gasto: 0, pinos: [], notas: '', ordem: b.ordem + i + 1, quebraDe: id, quebradoEm: agora, criado: agora }), true); FX.mark(nid, 'split'); });
  b.acao = base + ' (parte 1)'; Data.put('blocos', b); FX.mark(id, 'split'); FX.crack();
}
function fundir(id) {
  const b = byId(S.blocos, id), p = S.blocos.find(x => !x.feito && x.deps.length === 1 && x.deps[0] === id);
  if (!p) return recusa(id, 'Não há um bloco seguinte que encaixe só neste.');
  const soma = tamDe(b.tam).min + tamDe(p.tam).min, z = tams().reverse().find(x => x.min >= soma);
  if (!z) return recusa(id, `Juntos dão ${fmtMin(soma)}: passa do maior tamanho. A regra de ouro não deixa.`);
  S.blocos.filter(x => x.deps.includes(p.id)).forEach(x => { x.deps = x.deps.map(d => d === p.id ? id : d); Data.put('blocos', x, true); });
  Object.assign(b, { tam: z.id, saida: p.saida, acao: b.acao.replace(/ \(parte \d+\)$/, ''), pinos: b.pinos.concat(p.pinos), notas: [b.notas, p.notas].filter(Boolean).join('\n') });
  if (b.dia && vagas(b.dia, z.id, id) < 1) b.dia = '';
  Data.del('blocos', p.id, true); Data.put('blocos', b); FX.mark(id, 'snap'); return true;
}
function delBloco(id, quiet) {
  const b = byId(S.blocos, id); if (!b) return;
  // quem encaixava depois dele passa a encaixar depois das entradas dele
  S.blocos.filter(x => x.deps.includes(id)).forEach(x => { x.deps = [...new Set(x.deps.filter(d => d !== id).concat(b.deps))]; Data.put('blocos', x, true); });
  Data.del('blocos', id, quiet);
}
// blocos avulsos moram numa obra fixa, igual em todos os aparelhos
function avulsos() {
  if (!byId(S.obras, 'avulsos')) Data.put('obras', { id: 'avulsos', nome: 'Avulsos', icone: '📥', criada: Date.now() }, true);
  if (!byId(S.modulos, 'avulsos-m')) Data.put('modulos', { id: 'avulsos-m', obra: 'avulsos', nome: 'Caixa de entrada', ordem: 0 }, true);
  const o = byId(S.obras, 'avulsos'); if (o.arquivada || o.pausada) { o.arquivada = o.pausada = false; Data.put('obras', o, true); }
  return 'avulsos-m';
}
function capturar(txt, modId, encadear) {
  let chave = false, tipo = '', tam = '', saida = '';
  const tags = [], i = txt.indexOf('>');
  if (i >= 0) { saida = txt.slice(i + 1).trim(); txt = txt.slice(0, i); }
  txt = txt.replace(/(^|\s)!(?=\s|$)/g, () => { chave = true; return ' '; })
    .replace(/(^|\s)#(\S+)/g, (m, s, w) => { const x = tipos().find(t => norma(t.nome).startsWith(norma(w))); if (x && !tipo) tipo = x.id; else tags.push(w); return ' '; })
    .replace(/(^|\s)@(\S+)/g, (m, s, w) => { const x = S.tamanhos.find(z => norma(z.sigla) === norma(w)); if (x) { tam = x.id; return ' '; } return m; }).replace(/\s+/g, ' ').trim();
  if (!txt) return null;
  const m = byId(S.modulos, modId || avulsos()), irmaos = blocosDe(m.obra), ult = encadear && irmaos.filter(x => x.modulo === m.id).pop();
  return Data.put('blocos', { obra: m.obra, modulo: m.id, acao: txt.slice(0, 120), tipo: tipo || adivinha(txt) || (tipos().slice(-1)[0] || {}).id || '', tam: tam || (tams().slice(-1)[0] || {}).id || '',
    entrada: ult ? ult.saida : 'Nada: pode começar já', saida: saida || 'Feito: ' + txt.slice(0, 100), deps: ult ? [ult.id] : [], chave, tags: tags.join(', '), criado: Date.now(), ordem: Math.max(-1, ...irmaos.map(x => x.ordem)) + 1 }, true);
}
function sugerir() {
  const d = U.dia < today() ? today() : U.dia; let n = 0;
  bancada().filter(b => estado(b) === 'liberado').sort(ordPrio).forEach(b => { if (vagas(d, b.tam, b.id) > 0) { b.dia = d; Data.put('blocos', b, true); FX.mark(b.id, 'pop'); n++; } });
  U.dia = d; if (n) DB.changed();
  toast(n ? `${plural(n, 'bloco entrou', 'blocos entraram')} no dia, pelos mais urgentes.` : 'Não há bloco liberado que caiba nas vagas livres.');
}
const pendentes = () => S.blocos.filter(b => b.dia === U.dia && !b.feito && ativo(b));

const A = {
  tab(el) { U.tab = el.dataset.tab; if (U.tab !== 'obras') U.obra = null; draw(); scrollTo(0, 0); },
  dia(el) { const n = +el.dataset.n; U.dia = n ? addDays(U.dia, n) : today(); draw(); },
  sem(el) { U.sem = Math.min(0, U.sem + +el.dataset.n); draw(); },
  dv(el) { U.dv = el.dataset.v; draw(); },
  ov(el) { U.ov = el.dataset.v; draw(); },
  kmodo(el) { U.kmodo = el.dataset.v; draw(); },
  verArq() { U.arq = !U.arq; draw(); },
  fechar() { closeSheet(); },
  bloco(el) { sheetBloco(el.dataset.id); },
  virar(el) { U.verso = !U.verso; sheetBloco(el.dataset.id); FX.play($('#sheet .cartao'), 'flip'); },
  agendar(el) { if (agendar(el.dataset.id, U.dia)) { closeSheet(); draw(); } },
  tirar(el) { const b = byId(S.blocos, el.dataset.id); b.dia = ''; Data.put('blocos', b); closeSheet(); draw(); },
  iniciar(el) { if (iniciar(el.dataset.id)) { draw(); sheetBloco(el.dataset.id); } },
  foco(el) { Foco.open(el.dataset.id); },
  focoSair() { Foco.close(); draw(); },
  focoPausa() { A.pausar({ dataset: { id: Foco.id } }); closeSheet(); },
  focoMais() { Foco.extra += 300000; Foco.tocou = false; Foco.tick(); },
  pausar(el) { const b = byId(S.blocos, el.dataset.id); b.gasto = gastoDe(b); b.inicio = 0; Data.put('blocos', b); Foco.close(); draw(); sheetBloco(b.id); },
  inspecionar(el) { sheetInspecao(el.dataset.id); },
  encaixar(el) { encaixar(el.dataset.id); Foco.close(); closeSheet(); draw(); },
  desfazer(el) { const b = byId(S.blocos, el.dataset.id); b.feito = 0; b.inicio = 0; Data.put('blocos', b); draw(); sheetBloco(b.id); },
  travar(el) {
    const b = byId(S.blocos, el.dataset.id), m = prompt('O que está travando este bloco? (ex.: esperando resposta do professor)');
    if (!m || !m.trim()) return;
    Object.assign(b, { trava: m.trim().slice(0, 200), gasto: gastoDe(b), inicio: 0, dia: '' }); Data.put('blocos', b); closeSheet(); draw();
  },
  destravar(el) { const b = byId(S.blocos, el.dataset.id); b.trava = ''; Data.put('blocos', b); FX.mark(b.id, 'lib'); FX.free(); draw(); sheetBloco(b.id); },
  flag(el) { const b = byId(S.blocos, el.dataset.id); b[el.dataset.k] = !b[el.dataset.k]; Data.put('blocos', b); draw(); sheetBloco(b.id); },
  quebrar(el) {
    const n = Math.floor(+prompt('Quebrar em quantas partes? (2 a 6)', '2'));
    if (!(n >= 2 && n <= 6)) return;
    quebrar(el.dataset.id, n); closeSheet(); draw(); toast(`Quebrado em ${n} partes. Ajuste o tamanho e a saída de cada uma.`);
  },
  fundir(el) { if (fundir(el.dataset.id)) { draw(); sheetBloco(el.dataset.id); toast('Blocos fundidos em um só.'); } },
  duplicar(el) { const b = byId(S.blocos, el.dataset.id), n = Data.put('blocos', Object.assign({}, b, { id: uid(), acao: b.acao + ' (cópia)', feito: 0, inicio: 0, gasto: 0, dia: '', trava: '', criado: Date.now(), quebraDe: '', quebradoEm: 0, ordem: b.ordem + 0.5, pinos: b.pinos.map(p => ({ t: p.t, ok: false })) })); FX.mark(n.id, 'pop'); closeSheet(); draw(); },
  mover(el) {
    const b = byId(S.blocos, el.dataset.id), l = S.blocos.filter(x => x.modulo === b.modulo).sort((a, c) => a.ordem - c.ordem), i = l.indexOf(b), o = l[i + +el.dataset.n];
    if (!o) return;
    [b.ordem, o.ordem] = [o.ordem, b.ordem]; if (b.ordem === o.ordem) b.ordem += +el.dataset.n / 2;
    Data.put('blocos', o, true); Data.put('blocos', b); FX.mark(b.id, 'pop'); draw();
  },
  compartilhar(el) { const b = byId(S.blocos, el.dataset.id), t = tipoDe(b.tipo), z = tamDe(b.tam); copiar(`🧱 ${b.acao}\n${t.nome} · ${z.sigla} (${z.min} min) · ${ROT[estado(b)]}\nEntrada: ${b.entrada}\nSaída: ${b.saida}${b.pinos.length ? '\n' + b.pinos.map(p => (p.ok ? '[x] ' : '[ ] ') + p.t).join('\n') : ''}${b.notas ? '\n\n' + b.notas : ''}`, 'Cartão copiado.'); },
  delPino(el) { const b = byId(S.blocos, el.dataset.id); b.pinos.splice(+el.dataset.i, 1); Data.put('blocos', b); sheetBloco(b.id); },
  editar(el) { sheetEditar(el.dataset.id); },
  novoBloco(el) { sheetEditar(null, el.dataset.mod); },
  delBloco(el) { if (confirm('Excluir este bloco?')) { delBloco(el.dataset.id); closeSheet(); draw(); } },
  sugerir() { sugerir(); draw(); },
  agora() {
    const t = today(), c = S.blocos.filter(b => naMesa(b) && ['liberado', 'montando'].includes(estado(b)));
    const b = c.find(x => estado(x) === 'montando') || c.filter(x => x.dia === t).sort(ordPrio)[0] || c.sort(ordPrio)[0];
    if (!b) return toast('Nada liberado agora. Veja o que está na caixa ou travado no Kanban.');
    sheetBloco(b.id); toast(estado(b) === 'montando' ? 'Você já está montando este.' : 'Este é o próximo: o mais urgente que está liberado.');
  },
  limparDia(el) { pendentes().forEach(b => { b.dia = ''; b.inicio = 0; Data.put('blocos', b, true); }); DB.changed(); if (el.dataset.fechar) closeSheet(); draw(); },
  empurrar(el) {
    const d = addDays(U.dia < today() ? addDays(today(), -1) : U.dia, 1); let n = 0, v = 0;
    pendentes().sort(ordPrio).forEach(b => { if (vagas(d, b.tam, b.id) > 0) { b.dia = d; n++; } else { b.dia = ''; v++; } Data.put('blocos', b, true); });
    DB.changed(); if (el.dataset.fechar) closeSheet(); draw();
    toast(`${plural(n, 'bloco foi', 'blocos foram')} para ${fmtDia(d).toLowerCase()}${v ? `; ${plural(v, 'voltou', 'voltaram')} à bancada por falta de vaga` : ''}.`);
  },
  fecharDia() { sheetFechar(); },
  ajuda() { sheetAjuda(); },
  relatorio() { copiar(relatorio(), 'Relatório copiado.'); },
  novaObra(el) { sheetObra(el.dataset.planta || ''); },
  abrirObra(el) { U.tab = 'obras'; U.obra = el.dataset.id || null; U.ov = 'lista'; draw(); scrollTo(0, 0); },
  recolher(el) { U.col.has(el.dataset.id) ? U.col.delete(el.dataset.id) : U.col.add(el.dataset.id); draw(); },
  pausarObra(el) { const o = byId(S.obras, el.dataset.id); o.pausada = !o.pausada; Data.put('obras', o); draw(); toast(o.pausada ? 'Obra pausada: os blocos dela saem da bancada.' : 'Obra retomada.'); },
  arquivar(el) { const o = byId(S.obras, el.dataset.id); o.arquivada = !o.arquivada; Data.put('obras', o); U.obra = null; U.arq = false; draw(); toast(o.arquivada ? 'Obra arquivada.' : 'Obra de volta às ativas.'); },
  duplicarObra(el) { const o = byId(S.obras, el.dataset.id), p = Data.toPlanta(o.id, '_'), n = Data.fromPlanta(p, o.nome + ' (cópia)', o.prazo); Data.del('plantas', p.id, true); delete DB._tomb['plantas:' + p.id]; Object.assign(n, { icone: o.icone, entrega: o.entrega }); Data.put('obras', n); U.obra = n.id; draw(); toast('Obra duplicada, com todos os blocos de volta ao começo.'); },
  exportarObra(el) {
    const o = byId(S.obras, el.dataset.id), c = conta(o);
    copiar([`# ${o.nome}`, `${c.feitos} de ${c.n} blocos · ${fmtMin(c.total - c.rest)} de ${fmtMin(c.total)}${o.prazo ? ' · prazo ' + fmtData(o.prazo, { day: 'numeric', month: 'short', year: 'numeric' }) : ''}`, '',
      ...S.modulos.filter(m => m.obra === o.id).sort((a, b) => a.ordem - b.ordem).flatMap(m => [`## ${m.nome}`, ...S.blocos.filter(b => b.modulo === m.id).sort((a, b) => a.ordem - b.ordem).map(b => `- [${b.feito ? 'x' : ' '}] ${b.acao} (${tipoDe(b.tipo).nome}, ${tamDe(b.tam).sigla}) → ${b.saida}`), ''])].join('\n'), 'Obra copiada como texto.');
  },
  importarTexto(el) { sheetTexto(el.dataset.id); },
  delObra(el) {
    const o = byId(S.obras, el.dataset.id);
    if (!confirm(`Excluir a obra “${o.nome}” e todos os blocos dela?`)) return;
    S.blocos.filter(b => b.obra === o.id).forEach(b => Data.del('blocos', b.id, true));
    S.modulos.filter(m => m.obra === o.id).forEach(m => Data.del('modulos', m.id, true));
    Data.del('obras', o.id); U.obra = null; draw();
  },
  salvarPlanta(el) { const o = byId(S.obras, el.dataset.id), n = prompt('Nome da planta:', o.nome); if (n && n.trim()) { Data.toPlanta(o.id, n.trim().slice(0, 80)); toast('Planta salva. Ela está em Plantas.'); } },
  delPlanta(el) { if (confirm('Excluir esta planta? As obras já criadas com ela continuam.')) { Data.del('plantas', el.dataset.id); draw(); } },
  duplicarPlanta(el) { const p = byId(S.plantas, el.dataset.id); Data.put('plantas', { nome: p.nome + ' (cópia)', modulos: JSON.parse(JSON.stringify(p.modulos)) }); draw(); },
  exportarPlanta(el) { const p = byId(S.plantas, el.dataset.id); baixar(`planta-${norma(p.nome).replace(/[^a-z0-9]+/g, '-')}.json`, { app: 'blocos-planta', v: 1, nome: p.nome, modulos: p.modulos }); },
  novoMod(el) { const l = S.modulos.filter(m => m.obra === el.dataset.id); Data.put('modulos', { obra: el.dataset.id, nome: 'Módulo ' + (l.length + 1), ordem: Math.max(-1, ...l.map(m => m.ordem)) + 1 }); draw(); },
  moverMod(el) {
    const m = byId(S.modulos, el.dataset.id), l = S.modulos.filter(x => x.obra === m.obra).sort((a, b) => a.ordem - b.ordem), o = l[l.indexOf(m) + +el.dataset.n];
    if (!o) return;
    [m.ordem, o.ordem] = [o.ordem, m.ordem]; if (m.ordem === o.ordem) m.ordem += +el.dataset.n / 2;
    Data.put('modulos', o, true); Data.put('modulos', m); draw();
  },
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
  paleta(el) { const p = PALETAS[el.dataset.v]; tipos().forEach((t, i) => { t.cor = p[i % p.length]; Data.put('tipos', t, true); }); DB.changed(); draw(); },
  ritmo(el) { const r = RITMOS[el.dataset.v]; tams().reverse().slice(0, 3).forEach((z, i) => { z.min = r[i]; Data.put('tamanhos', z, true); }); DB.changed(); draw(); toast('Tamanhos ajustados. Os blocos existentes passam a valer o novo tempo.'); },
  set(el) { S.set[el.dataset.k] = el.dataset.v; DB.saveSet(); draw(); },
  exportar() { baixar(`blocos-${today()}.json`, Sync.payload()); },
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
    const id = f.dataset.id, d = new FormData(f), deps = d.getAll('deps'), b = id ? byId(S.blocos, id) : { obra: f.dataset.obra, criado: Date.now() };
    const mudou = b.modulo !== d.get('modulo');
    Object.assign(b, { acao: d.get('acao').trim(), tipo: d.get('tipo'), tam: d.get('tam'), modulo: d.get('modulo'), deps, saida: d.get('saida').trim(), energia: +d.get('energia') || 0, prazo: d.get('prazo'), tags: d.get('tags').trim(), link: d.get('link').trim(), repete: d.get('repete') });
    b.entrada = d.get('entrada').trim() || deps.map(x => byId(S.blocos, x).saida).filter(Boolean).join(' + ') || 'Nada: pode começar já';
    if (!id || mudou) b.ordem = Math.max(-1, ...blocosDe(b.obra).filter(x => x.id !== id).map(x => x.ordem)) + 1;
    if (b.dia && vagas(b.dia, b.tam, b.id) < 1) b.dia = '';
    Data.put('blocos', b); FX.mark(b.id, 'pop'); closeSheet(); draw();
  },
  obra(f) {
    const o = Data.fromPlanta(byId(S.plantas, f.planta.value), f.nome.value.trim(), f.prazo.value);
    if (!f.planta.value) Data.put('modulos', { obra: o.id, nome: 'Módulo 1', ordem: 0 }, true);
    Data.put('obras', o); U.tab = 'obras'; U.obra = o.id; U.ov = 'lista'; closeSheet(); draw(); scrollTo(0, 0);
  },
  captura(f) {
    const b = capturar(f.q.value, f.dataset.mod, !!f.dataset.mod);
    if (!b) return;
    DB.changed(); FX.mark(b.id, 'pop'); draw();
    const i = f.dataset.mod ? $(`form[data-mod="${f.dataset.mod}"] input`) : $('#bancada .cap input'); if (i) i.focus();
    if (!f.dataset.mod) toast(`Capturado em Avulsos como ${tipoDe(b.tipo).nome} ${tamDe(b.tam).sigla}.`);
  },
  pino(f) { const b = byId(S.blocos, f.dataset.id), t = f.t.value.trim(); if (!t) return; b.pinos.push({ t, ok: false }); Data.put('blocos', b); sheetBloco(b.id); const i = $('#sheet form[data-form=pino] input'); if (i) i.focus(); },
  texto(f) {
    const obra = f.dataset.id; let mod = S.modulos.filter(m => m.obra === obra).sort((a, b) => a.ordem - b.ordem).pop(), n = 0;
    f.t.value.split('\n').map(l => l.trim()).filter(Boolean).forEach(l => {
      if (l[0] === '#') { mod = Data.put('modulos', { obra, nome: l.replace(/^#+\s*/, '').slice(0, 80) || 'Módulo', ordem: Math.max(-1, ...S.modulos.filter(m => m.obra === obra).map(m => m.ordem)) + 1 }, true); return; }
      if (!mod) mod = Data.put('modulos', { obra, nome: 'Módulo 1', ordem: 0 }, true);
      const [acao, tp, tm, saida] = l.replace(/^[-*]\s*(\[.\]\s*)?/, '').split('|').map(x => x.trim());
      if (capturar(acao + (tp ? ' #' + tp : '') + (tm ? ' @' + tm : '') + (saida ? ' > ' + saida : ''), mod.id, true)) n++;
    });
    DB.changed(); closeSheet(); U.ov = 'lista'; draw(); toast(`${plural(n, 'bloco criado', 'blocos criados')}, encaixados em sequência.`);
  },
};

/* ---------- eventos ---------- */
document.addEventListener('click', e => {
  if (e.target.id === 'scrim') return closeSheet();
  const menu = $('details.menu[open]'); if (menu && !menu.contains(e.target)) menu.open = false;
  const el = e.target.closest('[data-act]');
  if (!el || !A[el.dataset.act] || (e.target !== el && e.target.closest('input,select,textarea,a,label'))) return;
  A[el.dataset.act](el, e);
});
document.addEventListener('keydown', e => {
  const campo = e.target.matches('input,select,textarea');
  if (e.key === 'Escape') { if (document.body.classList.contains('sheet')) closeSheet(); else if (Foco.id) A.focoSair(); else if (campo) e.target.blur(); return; }
  if (e.key === 'Enter' && e.target.matches('[role=button]')) return e.target.click();
  if (e.key === 'Enter' && e.target.matches('input[data-f]')) return e.target.blur();
  if (campo || e.ctrlKey || e.metaKey || e.altKey || document.body.classList.contains('sheet') || Foco.id) return;
  const k = e.key.toLowerCase(), n = +e.key;
  if (n >= 1 && n <= TABS.length) A.tab({ dataset: { tab: TABS[n - 1][0] } });
  else if (k === 'n') { e.preventDefault(); if (U.tab !== 'montar') A.tab({ dataset: { tab: 'montar' } }); $('#bancada .cap input').focus(); }
  else if (k === '/') { e.preventDefault(); if (U.tab !== 'kanban') A.tab({ dataset: { tab: 'kanban' } }); $('[data-u=kq]').focus(); }
  else if (k === '?') sheetAjuda();
  else if (k === 'f') { const m = S.blocos.find(x => ativo(x) && estado(x) === 'montando'); m ? Foco.open(m.id) : toast('Nenhum bloco em montagem para focar.'); }
  else if (U.tab === 'montar' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) A.dia({ dataset: { n: e.key === 'ArrowLeft' ? -1 : 1 } });
  else if (U.tab === 'montar' && k === 'h') A.dia({ dataset: { n: 0 } });
  else if (U.tab === 'montar' && k === 's') A.sugerir();
});
document.addEventListener('submit', e => { e.preventDefault(); const f = e.target.dataset.form; if (FORMS[f]) FORMS[f](e.target); });
document.addEventListener('input', e => {
  const el = e.target;
  if (el.closest('form[data-form=obra]')) fitNote();
  else if (el.dataset.u === 'kq') { U.kq = el.value; $('#kb').innerHTML = kboard(U.kmodo, kfiltrados()); }
  else if (el.name === 'acao' && !el.form.dataset.id && !el.form.dataset.tocou) { const t = adivinha(el.value), r = t && el.form.querySelector(`input[name=tipo][value="${t}"]`); if (r) r.checked = true; }
});
// campos editados no lugar: gravam ao sair do campo
document.addEventListener('change', e => {
  const el = e.target, d = el.dataset;
  if (el.name === 'tipo' && el.form) el.form.dataset.tocou = 1;
  if (d.f) {
    const r = byId(S[d.store], d.id); if (!r) return;
    let v = el.value.trim();
    if (d.f === 'min') v = Math.max(5, Math.min(480, Math.round(+v) || 5));
    else if (!v && ['nome', 'sigla', 'acao'].includes(d.f)) { el.value = r[d.f]; return; }
    r[d.f] = v; Data.put(d.store, r);
    if ('redraw' in d) draw();
  } else if (d.pino) { const b = byId(S.blocos, d.id); b.pinos[+d.pino].ok = el.checked; Data.put('blocos', b); if (!Foco.id) sheetBloco(b.id); }
  else if (d.cap) { const c = cfg(); c.cap[d.cap] = Math.max(0, Math.min(20, Math.floor(+el.value) || 0)); Data.put('ajustes', c); }
  else if (d.cfg) { const c = cfg(); c[d.cfg] = Math.max(0, Math.floor(+el.value) || 0); Data.put('ajustes', c); }
  else if (d.dia) { const c = cfg(); c.dias[+d.dia] = el.checked; Data.put('ajustes', c); }
  else if (d.bf) { U.bf[d.bf] = el.type === 'checkbox' ? el.checked : el.value; draw(); }
  else if (d.u) { U[d.u] = el.value; draw(); }
  else if (d.s) {
    S.set[d.s] = el.type === 'checkbox' ? el.checked : el.value.trim(); DB.saveSet();
    if (d.s === 'notif' && el.checked && Notification.permission !== 'granted') Notification.requestPermission().then(p => { if (p !== 'granted') { S.set.notif = false; DB.saveSet(); draw(); toast('O navegador não liberou os avisos.'); } });
    if (d.s === 'som' && el.checked) FX.snap();
    if (el.type === 'checkbox') draw();
  } else if (el.id === 'filepick' && el.files[0]) {
    el.files[0].text().then(t => {
      const j = JSON.parse(t);
      if (j.app === 'blocos-planta') { Data.put('plantas', { nome: String(j.nome || 'Planta importada'), modulos: j.modulos }); U.tab = 'plantas'; draw(); return toast('Planta importada.'); }
      if (j.app !== 'blocos') throw 0;
      Sync.merge(j); DB.changed(); draw(); toast('Backup importado e mesclado.');
    }).catch(() => toast('Este arquivo não é um backup nem uma planta do Blocos.'));
    el.value = '';
  }
});
// arrastar: da bancada para o dia (e de volta) e entre as colunas do Kanban
document.addEventListener('dragstart', e => { const b = e.target.closest && e.target.closest('.brick'); if (!b) return; e.dataTransfer.setData('text/plain', b.dataset.id); e.dataTransfer.effectAllowed = 'move'; document.body.classList.add('drag'); b.classList.add('pego'); });
document.addEventListener('dragend', () => { document.body.classList.remove('drag'); document.querySelectorAll('.over,.pego').forEach(x => x.classList.remove('over', 'pego')); });
document.addEventListener('dragover', e => { const z = e.target.closest('[data-drop]'); if (!z) return; e.preventDefault(); z.classList.add('over'); });
document.addEventListener('dragleave', e => { const z = e.target.closest('[data-drop]'); if (z && !z.contains(e.relatedTarget)) z.classList.remove('over'); });
// soltar um bloco numa área: vale para o mouse (drop) e para o dedo (toque.js)
function soltar(id, z) {
  const b = byId(S.blocos, id); if (!b) return;
  if (z.dataset.drop === 'k') kdrop(b.id, z.dataset.col, z.dataset.modo);
  else if (z.dataset.drop === 'dia') agendar(b.id, U.dia);
  else if (b.dia) { b.dia = ''; Data.put('blocos', b); }
  draw();
}
document.addEventListener('drop', e => {
  const z = e.target.closest('[data-drop]'); if (!z) return;
  e.preventDefault(); soltar(e.dataTransfer.getData('text/plain'), z);
});
addEventListener('beforeinstallprompt', e => { e.preventDefault(); inst = e; if (U.tab === 'ajustes') draw(); });

const App = {
  // a sincronização trouxe novidades: redesenha, sem atrapalhar quem está digitando
  synced(changed) { if (changed && !document.body.classList.contains('sheet') && !(document.activeElement && document.activeElement.matches('input,select,textarea'))) draw(); else drawStatus(); },
};

DB.load();
draw();
Sync.init();
try { if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) {}

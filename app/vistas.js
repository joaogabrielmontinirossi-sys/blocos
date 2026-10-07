'use strict';
/* Blocos — visões: Kanban de blocos, manual de montagem, Muro (constância e conquistas) e Diagnóstico. */

const somaMin = l => l.reduce((n, b) => n + tamDe(b.tam).min, 0);
const ENERGIA = ['Sem energia definida', 'Pouca energia', 'Energia média', 'Muita energia'];

/* ---------- Kanban ---------- */
const KMODOS = [['estado', 'Estado'], ['tipo', 'Cor'], ['tam', 'Tamanho'], ['obra', 'Obra'], ['dia', 'Semana'], ['energia', 'Energia']];
function kcols(modo, l) {
  const abertos = l.filter(b => !b.feito), col = (id, nome, bs, cor, extra) => ({ id, nome, l: bs, cor, extra: extra || '' });
  if (modo === 'estado') {
    const por = e => l.filter(b => estado(b) === e), wip = cfg().wip, mont = por('montando');
    return [col('caixa', 'Na caixa', por('caixa')), col('liberado', 'Liberado', por('liberado'))]
      .concat(por('travado').length ? [col('travado', 'Travado', por('travado'))] : [])
      .concat([col('montando', 'Montando', mont, '', wip ? `<span class="${mont.length >= wip ? 'bad' : ''}">limite ${wip}</span>` : ''),
        col('encaixado', 'Encaixado', por('encaixado').sort((a, b) => b.feito - a.feito).slice(0, 20))]);
  }
  if (modo === 'tipo') return tipos().concat(abertos.some(b => !byId(S.tipos, b.tipo)) ? [SEM_TIPO] : []).map(t => col(t.id, t.nome, abertos.filter(b => tipoDe(b.tipo).id === t.id), t.cor));
  if (modo === 'tam') return tams().reverse().map(z => col(z.id, `${z.sigla} · ${z.min} min`, abertos.filter(b => b.tam === z.id)));
  if (modo === 'obra') return S.obras.filter(o => !o.arquivada).map(o => col(o.id, (o.icone ? o.icone + ' ' : '') + o.nome, abertos.filter(b => b.obra === o.id)));
  if (modo === 'energia') return [1, 2, 3, 0].map(e => col(String(e), ENERGIA[e], abertos.filter(b => b.energia === e)));
  if (modo === 'modulo') return S.modulos.filter(m => m.obra === U.obra).sort((a, b) => a.ordem - b.ordem).map(m => col(m.id, m.nome, l.filter(b => b.modulo === m.id).sort((a, b) => a.ordem - b.ordem)));
  // semana: hoje e os seis dias seguintes, com a carga de cada dia
  const t = today(), dias = Array.from({ length: 7 }, (_, i) => addDays(t, i));
  return [col('sem', 'Sem dia', abertos.filter(b => !b.dia || b.dia < t))].concat(dias.map(d => {
    const bs = l.filter(b => b.dia === d), uso = somaMin(bs);
    return col(d, fmtDia(d), bs, '', `<span class="${uso > capDia() ? 'bad' : ''}">${fmtMin(uso)}/${fmtMin(capDia())}</span>`);
  }));
}
function kboard(modo, l) {
  return `<div class="kb">${kcols(modo, l).map(c => `<section class="kcol" data-drop="k" data-col="${esc(c.id)}" data-modo="${modo}">
    <header>${c.cor ? `<i class="dot" style="background:${c.cor}"></i>` : ''}<b>${esc(c.nome)}</b><span class="muted">${c.l.length} · ${fmtMin(somaMin(c.l))}</span>${c.extra}</header>
    ${c.l.map(b => brick(b, { fluxo: modo === 'modulo' })).join('') || '<p class="kvazio">solte um bloco aqui</p>'}</section>`).join('')}</div>`;
}
function kfiltrados() {
  const q = norma(U.kq);
  return S.blocos.filter(b => ativo(b) && (!U.kobra || b.obra === U.kobra) && (!q || norma([b.acao, b.tags, b.entrada, b.saida, b.notas, tipoDe(b.tipo).nome].join(' ')).includes(q)));
}
function vKanban() {
  return `<div class="phead top"><div class="grow"><h2>Kanban de blocos</h2><p class="muted">O mesmo conjunto de peças, visto de seis jeitos. Arrastar entre colunas muda o bloco de verdade.</p></div></div>
    <div class="tools"><input type="search" data-u="kq" value="${esc(U.kq)}" placeholder="Buscar bloco, etiqueta, saída…" aria-label="Buscar blocos">
      <select data-u="kobra" aria-label="Filtrar por obra"><option value="">Todas as obras</option>${S.obras.filter(o => !o.arquivada).map(o => `<option value="${o.id}" ${U.kobra === o.id ? 'selected' : ''}>${esc(o.nome)}</option>`).join('')}</select>
      <div class="seg">${KMODOS.map(([id, n]) => `<button data-act="kmodo" data-v="${id}" class="${U.kmodo === id ? 'on' : ''}">${n}</button>`).join('')}</div></div>
    <div id="kb">${kboard(U.kmodo, kfiltrados())}</div>`;
}
// soltar numa coluna: cada agrupamento muda um aspecto diferente do bloco
function kdrop(id, col, modo) {
  const b = byId(S.blocos, id), st = estado(b);
  if (modo === 'estado') {
    if (col === st) return;
    if (col === 'montando') { if (st === 'travado') { b.trava = ''; Data.put('blocos', b); } iniciar(id); }
    else if (col === 'encaixado') { if (st === 'caixa') return recusa(id, 'Este bloco ainda está na caixa: falta uma entrada.'); sheetInspecao(id); }
    else if (col === 'travado') A.travar({ dataset: { id } });
    else if (col === 'caixa') recusa(id, 'Um bloco só volta para a caixa quando falta uma entrada dele.');
    else { if (b.feito) b.feito = 0; if (b.inicio) { b.gasto = gastoDe(b); b.inicio = 0; } b.trava = ''; Data.put('blocos', b); }
  } else if (modo === 'tipo') { b.tipo = col; Data.put('blocos', b); }
  else if (modo === 'tam') { b.tam = col; if (b.dia && vagas(b.dia, col, id) < 1) b.dia = ''; Data.put('blocos', b); }
  else if (modo === 'energia') { b.energia = +col; Data.put('blocos', b); }
  else if (modo === 'dia') { if (col === 'sem') { b.dia = ''; Data.put('blocos', b); } else agendar(id, col); }
  else if (modo === 'modulo') { if (b.modulo !== col) { b.modulo = col; b.ordem = Math.max(-1, ...blocosDe(b.obra).map(x => x.ordem)) + 1; Data.put('blocos', b); } }
  else if (modo === 'obra' && b.obra !== col) {
    // muda de obra: os encaixes ficam para trás, e quem dependia dele passa a depender das entradas dele
    S.blocos.filter(x => x.deps.includes(id)).forEach(x => { x.deps = [...new Set(x.deps.filter(d => d !== id).concat(b.deps))]; Data.put('blocos', x, true); });
    let m = S.modulos.filter(x => x.obra === col).sort((a, c) => a.ordem - c.ordem)[0];
    if (!m) m = Data.put('modulos', { obra: col, nome: 'Módulo 1', ordem: 0 }, true);
    Object.assign(b, { obra: col, modulo: m.id, deps: [], ordem: Math.max(-1, ...blocosDe(col).map(x => x.ordem)) + 1 }); Data.put('blocos', b);
  }
  FX.mark(id, 'pop');
}

/* ---------- Manual de montagem: passos, caminho crítico e previsão ---------- */
function camadas(obraId) {
  const bs = blocosDe(obraId), prof = new Map();
  const p = (b, seen) => { if (prof.has(b.id)) return prof.get(b.id); if (seen.has(b.id)) return 0; seen.add(b.id); const v = 1 + Math.max(0, ...b.deps.map(d => { const x = byId(bs, d); return x ? p(x, seen) : 0; })); prof.set(b.id, v); return v; };
  bs.forEach(b => p(b, new Set()));
  const out = [];
  bs.forEach(b => (out[prof.get(b.id) - 1] = out[prof.get(b.id) - 1] || []).push(b));
  return out.filter(Boolean);
}
// a cadeia mais longa de trabalho que ainda falta: nada na obra termina antes dela
function critico(obraId) {
  const bs = blocosDe(obraId), memo = new Map();
  const c = (b, seen) => { if (memo.has(b.id)) return memo.get(b.id); if (seen.has(b.id)) return { min: 0, via: null }; seen.add(b.id);
    let best = { min: 0, via: null }; b.deps.forEach(d => { const x = byId(bs, d); if (x) { const r = c(x, seen); if (r.min > best.min) best = { min: r.min, via: x }; } });
    const r = { min: best.min + (b.feito ? 0 : tamDe(b.tam).min), via: best.via }; memo.set(b.id, r); return r; };
  let fim = null; bs.forEach(b => { const r = c(b, new Set()); if (!fim || r.min > memo.get(fim.id).min) fim = b; });
  const ids = new Set(); let min = 0;
  if (fim) { min = memo.get(fim.id).min; for (let x = fim; x; x = memo.get(x.id).via) if (!x.feito) ids.add(x.id); }
  return { ids, min };
}
const mediaReal = () => { const a = Date.now() - 14 * 864e5; return somaMin(S.blocos.filter(b => b.feito >= a)) / 14; };
// em que dia o trabalho que falta termina, enchendo `porDia` minutos em cada dia de trabalho
function previsao(rest, porDia) {
  if (rest <= 0 || porDia <= 0) return '';
  let d = today();
  for (let i = 0; i < 1500; i++, d = addDays(d, 1)) if (cfg().dias[parse(d).getDay()]) { rest -= porDia; if (rest <= 0) return d; }
  return '';
}
function vManual(o) {
  const cam = camadas(o.id), cr = critico(o.id);
  return `<p class="note">${cr.min ? `<b>Caminho crítico:</b> ${fmtMin(cr.min)} em ${plural(cr.ids.size, 'bloco', 'blocos')} encadeados (contorno escuro). Mesmo com mais capacidade, a obra não termina antes disso.` : 'Todos os blocos estão encaixados.'}</p>
    ${cam.map((l, i) => `<section class="panel passo"><div class="pnum">${i + 1}</div><div class="grow"><h4>Passo ${i + 1}${l.length > 1 ? ' · podem ser feitos em paralelo' : ''}</h4>${l.map(b => brick(b, { fluxo: 1, estado: 1, crit: cr.ids.has(b.id) })).join('')}</div></section>`).join('')}`;
}

/* ---------- Muro: constância, nível e conquistas ---------- */
const NIVEIS = [[0, 'Aprendiz'], [300, 'Servente'], [900, 'Pedreiro'], [2400, 'Mestre de obras'], [6000, 'Engenheiro'], [12000, 'Arquiteto']];
function historico() {
  const feitos = S.blocos.filter(b => b.feito).sort((a, b) => a.feito - b.feito), dias = {};
  feitos.forEach(b => { const d = ymd(new Date(b.feito)), x = dias[d] || (dias[d] = { n: 0, min: 0, tipos: new Set() }); x.n++; x.min += tamDe(b.tam).min; x.tipos.add(b.tipo); });
  let seq = 0, d = today(); if (!dias[d]) d = addDays(d, -1);
  while (dias[d]) { seq++; d = addDays(d, -1); }
  let maior = 0, run = 0, ant = '';
  Object.keys(dias).sort().forEach(k => { run = ant && addDays(ant, 1) === k ? run + 1 : 1; maior = Math.max(maior, run); ant = k; });
  const recorde = Math.max(0, ...Object.values(dias).map(x => x.n)), xp = somaMin(feitos);
  let nv = 0; NIVEIS.forEach((n, i) => { if (xp >= n[0]) nv = i; });
  return { feitos, dias, seq, maior, recorde, xp, nv };
}
function conquistas(h) {
  const precisos = h.feitos.filter(b => b.gasto && Math.abs(b.gasto / 60000 / (tamDe(b.tam).min || 1) - 1) <= 0.2).length;
  const obrasOk = S.obras.filter(o => { if (o.id === 'avulsos') return false; const bs = blocosDe(o.id); return bs.length && bs.every(b => b.feito); }).length;
  return [
    ['Primeira peça', 'Encaixe o primeiro bloco', h.feitos.length >= 1], ['Dez peças', '10 blocos encaixados', h.feitos.length >= 10],
    ['Cinquenta peças', '50 blocos encaixados', h.feitos.length >= 50], ['Cem peças', '100 blocos encaixados', h.feitos.length >= 100],
    ['Obra entregue', 'Encaixe todos os blocos de uma obra', obrasOk >= 1], ['Construtora', 'Três obras entregues', obrasOk >= 3],
    ['Três em linha', '3 dias seguidos com encaixe', h.maior >= 3], ['Semana cheia', '7 dias seguidos com encaixe', h.maior >= 7], ['Mês de obra', '30 dias seguidos com encaixe', h.maior >= 30],
    ['Dia lotado', 'Entregue num dia toda a sua capacidade', Object.values(h.dias).some(x => capDia() && x.min >= capDia())],
    ['Arco-íris', 'Encaixe blocos de todas as cores no mesmo dia', Object.values(h.dias).some(x => S.tipos.every(t => x.tipos.has(t.id)))],
    ['Bom de régua', '10 blocos com tempo real a até 20% do estimado', precisos >= 10],
    ['Demolidor', 'Quebre 5 blocos grandes demais', S.blocos.filter(b => b.quebradoEm).length >= 5],
    ['Projetista', 'Salve uma planta sua', S.plantas.some(p => p.mod > 0 && !DEF.plantas.some(d => d.id === p.id))],
    ['Sem pontas soltas', 'Conclua um checklist de 5 pinos ou mais', h.feitos.some(b => b.pinos.length >= 5 && b.pinos.every(p => p.ok))],
  ];
}
function vMuro() {
  const h = historico(), cq = conquistas(h), t = parse(today()), ini = addDays(today(), -((t.getDay() + 6) % 7) - 7 * 15);
  const seg = parse(addDays(today(), -((t.getDay() + 6) % 7))).getTime(), semana = h.feitos.filter(b => b.feito >= seg).length, meta = cfg().meta;
  const nv = NIVEIS[h.nv], prox = NIVEIS[h.nv + 1], pct = prox ? (h.xp - nv[0]) / (prox[0] - nv[0]) * 100 : 100, R = 26, C = 2 * Math.PI * R;
  const calor = Array.from({ length: 16 }, (_, w) => `<div>${Array.from({ length: 7 }, (_, i) => { const d = addDays(ini, w * 7 + i), n = d > today() ? -1 : (h.dias[d] || {}).n || 0; return `<i class="h${n < 0 ? 'x' : Math.min(4, n)}" title="${fmtData(d, { day: 'numeric', month: 'short' })}: ${n > 0 ? plural(n, 'bloco', 'blocos') : 'nada'}"></i>`; }).join('')}</div>`).join('');
  const muro = h.feitos.slice(-140);
  return `<div class="phead top"><div class="grow"><h2>Muro</h2><p class="muted">Cada bloco encaixado vira um tijolo. O muro só cresce com saída entregue.</p></div></div>
    <div class="stats s4">
      <div class="panel stat"><b>${h.seq}</b><span>${h.seq === 1 ? 'dia seguido' : 'dias seguidos'} · maior: ${h.maior}</span></div>
      <div class="panel stat"><b>${h.recorde}</b><span>recorde de blocos num dia</span></div>
      <div class="panel stat nivel"><b>${nv[1]}</b><span>${fmtMin(h.xp)} entregues${prox ? ` · faltam ${fmtMin(prox[0] - h.xp)} para ${prox[1]}` : ''}</span><div class="meter"><i style="width:${pct}%"></i></div></div>
      <div class="panel stat anel"><svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true"><circle cx="32" cy="32" r="${R}" fill="none" stroke="var(--soft)" stroke-width="7"/><circle cx="32" cy="32" r="${R}" fill="none" stroke="var(--ok)" stroke-width="7" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - Math.min(1, meta ? semana / meta : 0))}" transform="rotate(-90 32 32)"/></svg><div><b>${semana}${meta ? '/' + meta : ''}</b><span>meta da semana</span></div></div>
    </div>
    <section class="panel"><h3>O muro</h3><div class="muro">${muro.map(b => { const tp = tipoDe(b.tipo); return `<i data-fx="${b.id}" class="${FX.novo === b.id ? 'novo' : ''}" style="--c:${tp.cor};--w:${Math.max(18, tamDe(b.tam).min / 15 * 16)}px" title="${esc(b.acao)}"></i>`; }).join('') || '<p class="empty">O primeiro tijolo aparece quando você encaixar um bloco.</p>'}</div>
      ${h.feitos.length > muro.length ? `<p class="muted sm">Mostrando os últimos ${muro.length} de ${h.feitos.length} tijolos.</p>` : ''}</section>
    <div class="cols" style="margin-top:16px"><section class="panel"><h3>Dezesseis semanas</h3><div class="calor">${calor}</div><p class="muted sm">Cada quadrado é um dia; quanto mais escuro, mais blocos encaixados.</p></section>
      <section class="panel"><h3>Conquistas <span class="muted">${cq.filter(c => c[2]).length}/${cq.length}</span></h3><div class="selos">${cq.map(c => `<div class="cq ${c[2] ? 'ok' : ''}"><i></i><div><b>${c[0]}</b><span>${c[1]}</span></div></div>`).join('')}</div></section></div>`;
}

/* ---------- Diagnóstico semanal ---------- */
function semanaDe(n) { const t = parse(today()); t.setDate(t.getDate() - (t.getDay() + 6) % 7 + 7 * n); const ini = ymd(t); return { ini, fim: addDays(ini, 6), a: t.getTime(), z: parse(addDays(ini, 7)).getTime() }; }
function diagDados() {
  const s = semanaDe(U.sem), p = semanaDe(U.sem - 1), hoje = today();
  const feitos = S.blocos.filter(b => b.feito >= s.a && b.feito < s.z), antes = S.blocos.filter(b => b.feito >= p.a && b.feito < p.z);
  const quebras = S.blocos.filter(b => b.quebradoEm >= s.a && b.quebradoEm < s.z).length;
  const linhas = tipos().concat(SEM_TIPO).map(tp => {
    const ab = S.blocos.filter(b => ativo(b) && tipoDe(b.tipo).id === tp.id && ['liberado', 'montando'].includes(estado(b)));
    const f = feitos.filter(b => tipoDe(b.tipo).id === tp.id), med = f.filter(b => b.gasto > 0);
    return { tp, f, ab: ab.length, at: ab.filter(b => b.dia && b.dia < hoje).length, prec: med.length ? Math.round(med.reduce((n, b) => n + b.gasto / 60000, 0) / somaMin(med) * 100) : 0 };
  }).filter(r => r.tp.id || r.f.length || r.ab);
  return { s, feitos, antes, quebras, linhas, pior: linhas.slice().sort((x, y) => y.at - x.at || y.ab - x.ab)[0] };
}
function vDiag() {
  const { s, feitos, antes, quebras, linhas, pior } = diagDados();
  const maxF = Math.max(1, ...linhas.map(r => r.f.length)), maxA = Math.max(1, ...linhas.map(r => r.ab));
  const bar = (nome, cor, n, max, txt) => `<div class="bar"><span class="bl">${cor ? `<i class="dot" style="background:${cor}"></i>` : ''}${esc(nome)}</span><span class="bt"><i style="width:${n / max * 100}%;background:${cor || 'var(--ink)'}"></i></span><span class="bv">${txt}</span></div>`;
  const delta = feitos.length - antes.length, horas = Array(24).fill(0); feitos.forEach(b => horas[new Date(b.feito).getHours()]++);
  const maxH = Math.max(1, ...horas), pico = horas.indexOf(Math.max(...horas));
  const porTam = tams().map(z => ({ z, n: feitos.filter(b => b.tam === z.id).length })), maxT = Math.max(1, ...porTam.map(x => x.n));
  const risco = S.obras.filter(o => !o.arquivada).map(o => ({ o, c: conta(o) })).filter(x => x.c.rest && x.o.prazo && (x.o.prazo < today() || !x.c.cabe.ok));
  const travados = S.blocos.filter(b => ativo(b) && estado(b) === 'travado'), comPrec = linhas.filter(r => r.prec);
  return `<div class="phead top"><button class="ib" data-act="sem" data-n="-1" aria-label="Semana anterior">‹</button>
      <div class="grow"><h2>Diagnóstico${U.sem ? '' : ' desta semana'}</h2><p class="muted">${fmtData(s.ini, { day: 'numeric', month: 'short' })} a ${fmtData(s.fim, { day: 'numeric', month: 'short' })}</p></div>
      ${U.sem < 0 ? `<button class="ib" data-act="sem" data-n="1" aria-label="Semana seguinte">›</button>` : ''}<button class="btn sm" data-act="relatorio">Copiar relatório</button></div>
    <div class="stats"><div class="panel stat"><b>${feitos.length}</b><span>blocos encaixados · ${delta === 0 ? 'igual à' : (delta > 0 ? '+' : '') + delta + ' que a'} semana anterior</span></div>
      <div class="panel stat"><b>${fmtMin(somaMin(feitos))}</b><span>de trabalho entregue</span></div>
      <div class="panel stat ${quebras > 2 ? 'warn' : ''}"><b>${quebras}</b><span>${quebras === 1 ? 'bloco quebrado' : 'blocos quebrados'}${quebras > 2 ? ': estimativas curtas demais' : ''}</span></div></div>
    <div class="cols"><section class="panel"><h3>Concluídos por tipo</h3>${linhas.map(r => bar(r.tp.nome, r.tp.cor, r.f.length, maxF, r.f.length ? `${r.f.length} · ${fmtMin(somaMin(r.f))}` : '0')).join('')}</section>
      <section class="panel"><h3>O que está acumulando agora</h3>${linhas.map(r => bar(r.tp.nome, r.tp.cor, r.ab, maxA, r.ab + (r.at ? ` · ${r.at} atras.` : ''))).join('')}
        <p class="note">${pior && pior.ab ? (pior.at ? `<b>${esc(pior.tp.nome)}</b> é a cor que mais atrasa: ${plural(pior.at, 'bloco passou', 'blocos passaram')} do dia marcado. O seu gargalo está em ${esc(pior.tp.desc || pior.tp.nome.toLowerCase())}.` : `<b>${esc(pior.tp.nome)}</b> é a cor com mais blocos liberados à espera (${pior.ab}). Nenhum está atrasado.`) : 'Nada acumulado: tudo o que estava liberado foi encaixado.'}</p></section>
      <section class="panel"><h3>Régua: tempo real sobre o estimado</h3>${comPrec.length ? comPrec.map(r => bar(r.tp.nome, r.tp.cor, Math.min(200, r.prec), 200, r.prec + '%')).join('') + `<p class="muted sm hint">100% é a estimativa exata. Acima disso, os blocos dessa cor pedem um tamanho maior.</p>` : `<p class="empty">Sem medições nesta semana. O cronômetro corre enquanto o bloco está em “Montando”.</p>`}</section>
      <section class="panel"><h3>Hora do encaixe</h3><div class="horas">${horas.map((n, i) => `<i style="height:${n / maxH * 100}%" title="${i}h: ${n}"></i>`).join('')}</div><div class="hx"><span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span></div>
        <p class="muted sm hint">${feitos.length ? `Você mais encaixa por volta das ${pico}h.` : 'Sem encaixes nesta semana.'}</p></section>
      <section class="panel"><h3>Por tamanho</h3>${porTam.map(x => bar(`${x.z.sigla} · ${x.z.min} min`, '', x.n, maxT, String(x.n))).join('')}</section>
      <section class="panel"><h3>Atenção</h3>
        ${risco.length ? risco.map(x => `<p class="linha" data-act="abrirObra" data-id="${x.o.id}" role="button" tabindex="0"><b>${esc(x.o.nome)}</b> ${selo(x.c, x.o.prazo)}</p>`).join('') : '<p class="muted sm">Nenhuma obra em risco de prazo.</p>'}
        ${travados.length ? `<h4>Travados</h4>${travados.map(b => `<p class="linha" data-act="bloco" data-id="${b.id}" role="button" tabindex="0"><b>${esc(b.acao)}</b> <span class="muted">${esc(b.trava)}</span></p>`).join('')}` : ''}</section></div>`;
}
function relatorio() {
  const { s, feitos, quebras, linhas, pior } = diagDados();
  return [`Blocos · semana de ${fmtData(s.ini, { day: 'numeric', month: 'short' })} a ${fmtData(s.fim, { day: 'numeric', month: 'short' })}`,
    `${plural(feitos.length, 'bloco encaixado', 'blocos encaixados')}, ${fmtMin(somaMin(feitos))} de trabalho entregue, ${plural(quebras, 'bloco quebrado', 'blocos quebrados')}.`, '',
    ...linhas.map(r => `${r.tp.nome}: ${r.f.length} concluídos, ${r.ab} à espera${r.at ? `, ${r.at} atrasados` : ''}${r.prec ? `, régua ${r.prec}%` : ''}`), '',
    pior && pior.ab ? `Cor que mais acumula: ${pior.tp.nome}.` : 'Nada acumulado.'].join('\n');
}

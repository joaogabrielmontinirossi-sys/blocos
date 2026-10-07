'use strict';
/* Blocos — dados. Tudo fica no aparelho (localStorage) em listas de registros { id, mod }.
   `mod` é a data da última alteração e decide quem vence na sincronização; as exclusões ficam em `tomb`. */

const KEY = 'blocos-v1';
const byId = (l, id) => l.find(r => r.id === id);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const debounce = (f, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms); }; };

const S = { set: { gClient: '', gWas: false, tema: 'auto' } };

const DEF = {
  tipos: [
    { id: 'pesquisar', nome: 'Pesquisar', cor: '#2D7DD2', desc: 'buscar, ler, fichar' },
    { id: 'produzir', nome: 'Produzir', cor: '#2FA05A', desc: 'escrever, criar, programar' },
    { id: 'revisar', nome: 'Revisar', cor: '#E8B81F', desc: 'conferir, corrigir, formatar' },
    { id: 'comunicar', nome: 'Comunicar', cor: '#8B5CF6', desc: 'e-mail, mensagem, reunião' },
    { id: 'decidir', nome: 'Decidir', cor: '#E0483C', desc: 'escolher entre opções, definir rumo' },
    { id: 'operar', nome: 'Operar', cor: '#C9CED8', desc: 'tarefas mecânicas: imprimir, enviar, protocolar' },
  ],
  tamanhos: [
    { id: 'p', sigla: 'P', nome: 'Pequeno', min: 15 },
    { id: 'm', sigla: 'M', nome: 'Médio', min: 45 },
    { id: 'g', sigla: 'G', nome: 'Grande', min: 90 },
  ],
  ajustes: [{ id: 'cfg', cap: { g: 2, m: 3, p: 4 }, dias: [true, true, true, true, true, true, true] }],
  plantas: [{
    id: 'academico', nome: 'Trabalho acadêmico', modulos: [
      { nome: 'Pesquisa', blocos: [
        { acao: 'Definir tema', tipo: 'decidir', tam: 'p', entrada: 'Enunciado do trabalho', saida: 'Tema definido' },
        { acao: 'Buscar 5 fontes', tipo: 'pesquisar', tam: 'm', saida: '5 fontes salvas' },
        { acao: 'Fichar fontes', tipo: 'pesquisar', tam: 'm', saida: 'Ficha com citações', vezes: 3 }] },
      { nome: 'Estrutura', blocos: [
        { acao: 'Montar sumário', tipo: 'decidir', tam: 'm', saida: 'Sumário' },
        { acao: 'Validar com professor', tipo: 'comunicar', tam: 'p', saida: 'Sumário aprovado' }] },
      { nome: 'Rascunho', blocos: [
        { acao: 'Escrever introdução', tipo: 'produzir', tam: 'g', saida: 'Introdução escrita' },
        { acao: 'Escrever desenvolvimento', tipo: 'produzir', tam: 'g', saida: 'Parte do desenvolvimento escrita', vezes: 3 },
        { acao: 'Escrever conclusão', tipo: 'produzir', tam: 'm', saida: 'Rascunho completo' }] },
      { nome: 'Acabamento', blocos: [
        { acao: 'Revisar texto', tipo: 'revisar', tam: 'g', saida: 'Texto revisado' },
        { acao: 'Formatar ABNT', tipo: 'revisar', tam: 'm', saida: 'Arquivo formatado' },
        { acao: 'Enviar', tipo: 'operar', tam: 'p', saida: 'Trabalho entregue' }] },
    ],
  }],
};

// Formato de cada registro; o que vem de fora (sincronização, backup) passa por aqui antes de entrar.
const SHAPE = {
  tipos: { nome: 's', cor: 'c', desc: 's', ordem: 'n' },
  tamanhos: { sigla: 's', nome: 's', min: 'n', ordem: 'n' },
  obras: { nome: 's', prazo: 'd', criada: 'n' },
  modulos: { obra: 's', nome: 's', ordem: 'n' },
  blocos: { obra: 's', modulo: 's', acao: 's', tipo: 's', tam: 's', entrada: 's', saida: 's', deps: 'a', dia: 'd', inicio: 'n', feito: 'n', ordem: 'n', quebraDe: 's', quebradoEm: 'n' },
  plantas: { nome: 's' },
  ajustes: {},
};
function norm(store, r) {
  const o = { id: String(r.id), mod: Number(r.mod) || 0 };
  for (const [k, t] of Object.entries(SHAPE[store])) {
    const v = r[k];
    o[k] = t === 's' ? String(v == null ? '' : v).slice(0, 500)
      : t === 'n' ? Number(v) || 0
      : t === 'c' ? (/^#[0-9a-f]{6}$/i.test(v) ? v : '#9AA3AF')
      : t === 'd' ? (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '')
      : Array.isArray(v) ? v.map(String) : [];
  }
  if (store === 'plantas') o.modulos = (Array.isArray(r.modulos) ? r.modulos : []).map(m => ({
    nome: String(m && m.nome || ''),
    blocos: (m && Array.isArray(m.blocos) ? m.blocos : []).map(b => {
      const d = { acao: String(b.acao || ''), tipo: String(b.tipo || ''), tam: String(b.tam || ''), entrada: String(b.entrada || ''), saida: String(b.saida || '') };
      if (b.vezes > 1) d.vezes = Math.min(20, Math.floor(b.vezes));
      if (Array.isArray(b.deps)) d.deps = b.deps.map(Number).filter(n => n >= 0);
      return d;
    }),
  }));
  if (store === 'ajustes') {
    o.cap = {};
    for (const [k, v] of Object.entries(r.cap && typeof r.cap === 'object' ? r.cap : {})) o.cap[k] = Math.max(0, Math.min(20, Math.floor(Number(v) || 0)));
    o.dias = Array.from({ length: 7 }, (_, i) => !Array.isArray(r.dias) || r.dias[i] !== false);
  }
  if (r.seed) o.seed = true;
  return o;
}

const DB = {
  SYNCED: Object.keys(SHAPE),
  onChange: null,
  _tomb: {},
  tomb: () => DB._tomb,

  load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
    DB.SYNCED.forEach(s => S[s] = (d && Array.isArray(d[s]) ? d[s] : []).filter(r => r && r.id).map(r => norm(s, r)));
    DB._tomb = (d && d.tomb && typeof d.tomb === 'object') ? d.tomb : {};
    try { Object.assign(S.set, JSON.parse(localStorage.getItem(KEY + '-set') || '{}')); } catch (e) {}
    // padrões de fábrica: entram com mod 0, então qualquer edição (ou exclusão) feita por você vence
    for (const s of Object.keys(DEF)) DEF[s].forEach((r, i) => { if (!byId(S[s], r.id) && !DB._tomb[s + ':' + r.id]) S[s].push(norm(s, Object.assign({ ordem: i }, r))); });
    if (!d) Data.fromPlanta(byId(S.plantas, 'academico'), 'Trabalho de Civil (exemplo)', '', true);
    DB.persist();
  },
  persist() {
    const d = { tomb: DB._tomb };
    DB.SYNCED.forEach(s => d[s] = S[s]);
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {}
  },
  saveSet() { try { localStorage.setItem(KEY + '-set', JSON.stringify(S.set)); } catch (e) {} },
  saveTomb() { DB.persist(); },
  changed() { DB.persist(); if (DB.onChange) DB.onChange(); },
};

const Data = {
  // gravações feitas por você: carimbam a data e, na primeira, adotam os exemplos como dados de verdade
  put(store, rec, quiet) {
    if (!rec.id) rec.id = uid();
    rec.mod = Date.now();
    Data.adopt();
    if (!byId(S[store], rec.id)) S[store].push(rec);
    if (!quiet) DB.changed();
    return rec;
  },
  del(store, id, quiet) {
    const i = S[store].findIndex(r => r.id === id);
    if (i < 0) return;
    Data.adopt();
    S[store].splice(i, 1);
    DB._tomb[store + ':' + id] = Date.now();
    if (!quiet) DB.changed();
  },
  adopt() { DB.SYNCED.forEach(s => S[s].forEach(r => { delete r.seed; })); },
  // gravações vindas da sincronização: não mexem em `mod`
  raw(store, rec) { const i = S[store].findIndex(r => r.id === rec.id); if (i < 0) S[store].push(rec); else S[store][i] = rec; },
  rawDel(store, id) { const i = S[store].findIndex(r => r.id === id); if (i >= 0) S[store].splice(i, 1); },

  // Planta → lista plana de blocos, com os encaixes (índices) resolvidos. Sem encaixes declarados, a sequência é linear.
  flat(planta) {
    const out = [];
    (planta.modulos || []).forEach((m, mi) => m.blocos.forEach(b => {
      const n = b.vezes > 1 ? b.vezes : 1;
      for (let i = 0; i < n; i++) out.push({ mi, acao: n > 1 ? `${b.acao} (${i + 1}/${n})` : b.acao, tipo: b.tipo, tam: b.tam, entrada: b.entrada, saida: b.saida, deps: b.deps || (out.length ? [out.length - 1] : []) });
    }));
    return out;
  },
  fromPlanta(planta, nome, prazo, seed) {
    const now = Date.now(), tag = seed ? { seed: true } : {};
    const obra = Object.assign({ id: uid(), nome, prazo: prazo || '', criada: now, mod: now }, tag);
    S.obras.push(obra);
    if (!planta) return obra;
    const mods = (planta.modulos || []).map((m, i) => { const r = Object.assign({ id: uid(), obra: obra.id, nome: m.nome, ordem: i, mod: now }, tag); S.modulos.push(r); return r; });
    const flat = Data.flat(planta), ids = flat.map(() => uid());
    flat.forEach((b, i) => {
      const deps = b.deps.filter(d => d < flat.length && d !== i);
      S.blocos.push(Object.assign({
        id: ids[i], obra: obra.id, modulo: mods[b.mi].id, acao: b.acao, tipo: b.tipo, tam: b.tam,
        entrada: b.entrada || deps.map(d => flat[d].saida).filter(Boolean).join(' + ') || 'Nada: pode começar já',
        saida: b.saida, deps: deps.map(d => ids[d]), dia: '', inicio: 0, feito: 0, ordem: i, quebraDe: '', quebradoEm: 0, mod: now,
      }, tag));
    });
    return obra;
  },
  toPlanta(obraId, nome) {
    const mods = S.modulos.filter(m => m.obra === obraId).sort((a, b) => a.ordem - b.ordem);
    const flat = [];
    const modulos = mods.map(m => ({ nome: m.nome, blocos: S.blocos.filter(b => b.modulo === m.id).sort((a, b) => a.ordem - b.ordem).map(b => { const d = { acao: b.acao, tipo: b.tipo, tam: b.tam, entrada: b.entrada, saida: b.saida, _id: b.id, _deps: b.deps }; flat.push(d); return d; }) }));
    flat.forEach(d => { d.deps = d._deps.map(id => flat.findIndex(x => x._id === id)).filter(i => i >= 0); });
    flat.forEach(d => { delete d._id; delete d._deps; });
    return Data.put('plantas', { nome, modulos });
  },
};

// Gera o workflow "Forms -> BotConversa" do n8n (versão publicada em 16/09/2026).
// Uso: node n8n/gerar-workflow.js  ->  n8n/forms-botconversa.json (importável no n8n)
// A chave da API NÃO fica aqui: cole no bloco "CONFIGURAR AQUI" depois de importar.
const fs = require('fs');
const path = require('path');

const PLANILHA = 'https://docs.google.com/spreadsheets/d/1RbgcZyB-w60Ozhc0QKawFozTK9989Kdo0XQCq4qea7A/edit#gid=1776806115';
const FLUXO_VISITANTES = 9004500;
const TELEFONE_AVISO = '5541995126655';
const BASE = 'https://backend.botconversa.com.br/api/v1/webhook';

const normaliza = `// Recebe a linha nova do Forms + as configurações do bloco anterior
// e devolve telefone limpo, nome separado, chave e fluxo.
// Acha as colunas pelo começo do texto da pergunta, então tanto faz
// "Nome Completo?" ou "Digite o telefone com DDD...".
return $input.all().map((item, i) => {
  const row = item.json;
  // "Como conheceu a Igreja?" também fala em "nome", por isso o nome é pelo começo
  const coluna = (acha) => {
    const chave = Object.keys(row).find(k => acha(k.trim().toLowerCase()));
    return chave ? row[chave] : '';
  };

  // Telefone -> só números, sem zero na frente, com DDI 55
  let phone = String(coluna(k => k.includes('telefone')) ?? '').replace(/[^0-9]/g, '');
  phone = phone.replace(/^0+/, '');
  if (phone.length === 10 || phone.length === 11) phone = '55' + phone;

  // Nome -> primeiro nome + sobrenome
  const nomeCompleto = String(coluna(k => k.startsWith('nome')) || 'Lead').trim().replace(/ +/g, ' ');
  const partes = nomeCompleto.split(' ');
  const first_name = partes.shift() || 'Lead';
  const last_name = partes.join(' ');

  return {
    json: {
      phone, first_name, last_name,
      api_key: String(row.api_key ?? '').trim(),
      flow_id: Number(row.flow_id),
    },
    pairedItem: { item: i },
  };
});`;

const montaAviso = `// Monta a mensagem de aviso com tudo o que a pessoa respondeu no Forms.
// Rótulos curtos para as perguntas conhecidas; pergunta nova entra com o texto dela.
const ROTULOS = [
  ['carimbo', '📅 *Data/hora:*'],
  ['nome', '👤 *Nome:*'],
  ['telefone', '📱 *Telefone:*'],
  ['idade', '🎂 *Idade:*'],
  ['oração', '🙏 *Pedido de oração:*'],
  ['conheceu', '⛪ *Como conheceu:*'],
];
const IGNORAR = ['api_key', 'flow_id', 'aviso_telefone', 'row_number'];

return $input.all().map((item, i) => {
  const row = item.json;
  const linhas = [];
  let whats = '';
  for (const k of Object.keys(row)) {
    if (IGNORAR.includes(k)) continue;
    const valor = String(row[k] ?? '').trim();
    if (!valor) continue;
    const chave = k.toLowerCase();
    const rotulo = (ROTULOS.find(([p]) => p === 'nome' ? chave.startsWith(p) : chave.includes(p)) || [])[1] || ('▫️ *' + k.replace(/\\?$/, '') + ':*');
    linhas.push(rotulo + ' ' + valor);
    if (chave.includes('telefone')) {
      let n = valor.replace(/[^0-9]/g, '').replace(/^0+/, '');
      if (n.length === 10 || n.length === 11) n = '55' + n;
      whats = 'https://wa.me/' + n;
    }
  }
  const texto = ['🔔 *Novo cadastro de visitante*', '', ...linhas]
    .concat(whats ? ['', '💬 Falar com a pessoa: ' + whats] : [])
    .join('\\n');
  return {
    json: { texto, aviso_telefone: String(row.aviso_telefone ?? '').replace(/[^0-9]/g, ''), api_key: String(row.api_key ?? '').trim() },
    pairedItem: { item: i },
  };
});`;

const headers = (expr) => ({ parameters: [
  { name: 'API-KEY', value: expr },
  { name: 'Content-Type', value: 'application/json' },
] });

const http = (id, name, position, url, keyExpr, jsonBody) => ({
  parameters: { method: 'POST', url, sendHeaders: true, headerParameters: headers(keyExpr), sendBody: true, specifyBody: 'json', jsonBody, options: {} },
  id, name, type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position,
  // erro com o visitante não pode impedir o aviso (e vice-versa)
  onError: 'continueRegularOutput',
});

const wf = {
  name: 'Forms -> BotConversa',
  nodes: [
    {
      parameters: {
        pollTimes: { item: [{ mode: 'everyMinute' }] },
        documentId: { __rl: true, value: PLANILHA, mode: 'url' },
        sheetName: { __rl: true, value: 1776806115, mode: 'list', cachedResultName: 'Respostas ao formulário 1', cachedResultUrl: PLANILHA },
        event: 'rowAdded',
        options: {},
      },
      id: 'a1b2c3d4-0001-4000-8000-000000000001', name: 'Forms - Nova resposta',
      type: 'n8n-nodes-base.googleSheetsTrigger', typeVersion: 1, position: [0, 0],
    },
    {
      parameters: {
        assignments: { assignments: [
          { id: 'a1b2c3d4-1001-4000-8000-000000000001', name: 'api_key', value: 'COLE_AQUI_A_CHAVE_DA_API_DO_BOTCONVERSA', type: 'string' },
          { id: 'a1b2c3d4-1001-4000-8000-000000000002', name: 'flow_id', value: FLUXO_VISITANTES, type: 'number' },
          { id: 'a1b2c3d4-1001-4000-8000-000000000003', name: 'aviso_telefone', value: TELEFONE_AVISO, type: 'string' },
        ] },
        includeOtherFields: true,
        options: {},
      },
      id: 'a1b2c3d4-0002-4000-8000-000000000002', name: 'CONFIGURAR AQUI (chave e fluxo)',
      type: 'n8n-nodes-base.set', typeVersion: 3.4, position: [240, 0],
    },
    { parameters: { jsCode: normaliza }, id: 'a1b2c3d4-0003-4000-8000-000000000003', name: 'Normaliza telefone/nome', type: 'n8n-nodes-base.code', typeVersion: 2, position: [480, 0] },
    // o BotConversa exige last_name preenchido (vazio = 400 "may not be blank", ausente = 400 "is required")
    http('a1b2c3d4-0004-4000-8000-000000000004', 'BotConversa - Cria assinante', [720, 0],
      `${BASE}/subscriber/`, '={{ $json.api_key }}',
      '={{ JSON.stringify({ phone: $json.phone, first_name: $json.first_name, last_name: $json.last_name || "-" }) }}'),
    http('a1b2c3d4-0005-4000-8000-000000000005', 'BotConversa - Dispara fluxo', [960, 0],
      `=${BASE}/subscriber/{{ $json.id }}/send_flow/`, "={{ $('Normaliza telefone/nome').item.json.api_key }}",
      "={\n  \"flow\": {{ $('Normaliza telefone/nome').item.json.flow_id }}\n}"),
    { parameters: { jsCode: montaAviso }, id: 'a1b2c3d4-0006-4000-8000-000000000006', name: 'Monta aviso', type: 'n8n-nodes-base.code', typeVersion: 2, position: [480, 240] },
    http('a1b2c3d4-0007-4000-8000-000000000007', 'BotConversa - Contato do aviso', [720, 240],
      `${BASE}/subscriber/`, '={{ $json.api_key }}',
      '={\n  "phone": {{ JSON.stringify($json.aviso_telefone) }},\n  "first_name": "Avisos",\n  "last_name": "Cadastro Visitantes"\n}'),
    http('a1b2c3d4-0008-4000-8000-000000000008', 'BotConversa - Envia aviso', [960, 240],
      `=${BASE}/subscriber/{{ $json.id }}/send_message/`, "={{ $('Monta aviso').item.json.api_key }}",
      "={\n  \"type\": \"text\",\n  \"value\": {{ JSON.stringify($('Monta aviso').item.json.texto) }}\n}"),
  ],
  connections: {
    'Forms - Nova resposta': { main: [[{ node: 'CONFIGURAR AQUI (chave e fluxo)', type: 'main', index: 0 }]] },
    'CONFIGURAR AQUI (chave e fluxo)': { main: [[
      { node: 'Normaliza telefone/nome', type: 'main', index: 0 },
      { node: 'Monta aviso', type: 'main', index: 0 },
    ]] },
    'Normaliza telefone/nome': { main: [[{ node: 'BotConversa - Cria assinante', type: 'main', index: 0 }]] },
    'BotConversa - Cria assinante': { main: [[{ node: 'BotConversa - Dispara fluxo', type: 'main', index: 0 }]] },
    'Monta aviso': { main: [[{ node: 'BotConversa - Contato do aviso', type: 'main', index: 0 }]] },
    'BotConversa - Contato do aviso': { main: [[{ node: 'BotConversa - Envia aviso', type: 'main', index: 0 }]] },
  },
  pinData: {},
  settings: { executionOrder: 'v1' },
};

fs.writeFileSync(path.join(__dirname, 'forms-botconversa.json'), JSON.stringify(wf, null, 2));
console.log('ok: n8n/forms-botconversa.json');

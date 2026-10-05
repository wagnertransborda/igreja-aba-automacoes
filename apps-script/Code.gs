/**
 * Igreja ABA Curitiba — Forms → BotConversa (substitui o n8n, que é pago).
 *
 * Roda de graça no Google Apps Script da conta abafinanceiro2023 (dona dos Forms).
 * A cada resposta de um dos formulários abaixo:
 *   1. cria (ou acha) a pessoa no BotConversa e dispara o fluxo dela;
 *   2. manda o aviso "Novo cadastro" pro número da secretaria.
 *
 * Como instalar (uma vez só):
 *   - Configurações do projeto (engrenagem) → Propriedades do script →
 *     adicionar BOTCONVERSA_API_KEY = chave da seção "API" do BotConversa
 *     (Configurações → Integrações → API; NÃO é a do Zapier nem a do Webhook).
 *   - Rodar a função `instalar` e autorizar.
 * Formulário novo = só acrescentar uma linha em FORMULARIOS e rodar `instalar` de novo.
 */

const AVISO_TELEFONE = '5541995126655'; // conversa "Avisos Cadastro Visitantes"
const BASE = 'https://backend.botconversa.com.br/api/v1/webhook';
const UAZAPI = 'https://transborda.uazapi.com'; // só pro grupo da intercessão

// A chave de identificação é o código do link público (/forms/d/e/<código>/viewform).
const FORMULARIOS = [
  {
    codigo: '1FAIpQLSfSkYTS_DRcRhGOwQDJDBgbDMEzx2WEJ-sww4qWV4lJijqeqQ',
    nome: 'Visitantes',
    fluxo: 9004500, // INTEGRAÇÃO FORMS VISITANTES
    titulo: '🔔 *Novo cadastro de visitante*',
    planilha: 'PLANILHA_VISITANTES', // propriedade do script com o link da planilha de respostas
  },
  {
    codigo: '1FAIpQLSf8TSgFn-3uhwZBI6WT0_ZeNdnJT2NoCe0bBCCyuyuILw85UA',
    nome: 'Novo convertido',
    fluxo: 9260130, // NOVO CONVERTIDO
    titulo: '🔔 *Novo cadastro de NOVO CONVERTIDO*',
  },
  {
    codigo: '1FAIpQLSc9xV79aVGfFik6-mSqYWDt2c1379v2ADAwTULwOQIl34aCPQ',
    nome: 'Pedido de oração',
    fluxo: 9283466, // PEDIDO DE ORAÇÃO
    titulo: '🙏 *Novo PEDIDO DE ORAÇÃO*',
    grupo: true, // também posta no grupo da intercessão (ver enviarProGrupo)
  },
];

// Rótulos curtos para as perguntas conhecidas; pergunta nova entra com o próprio texto.
const ROTULOS = [
  ['nome', '👤 *Nome:*'],
  ['telefone', '📱 *Telefone:*'],
  ['idade', '🎂 *Idade:*'],
  ['oração', '🙏 *Pedido de oração:*'],
  ['conheceu', '⛪ *Como conheceu:*'],
  ['visita', '🏠 *Visita pastoral:*'],
];

/** Liga o gatilho "ao enviar resposta" em cada formulário da lista. Pode rodar de novo sem duplicar. */
function instalar() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'aoResponder')
    .forEach(t => ScriptApp.deleteTrigger(t));

  const faltando = FORMULARIOS.map(f => f.nome);
  const arquivos = DriveApp.getFilesByType(MimeType.GOOGLE_FORMS);
  while (arquivos.hasNext()) {
    const arquivo = arquivos.next();
    let form;
    try { form = FormApp.openById(arquivo.getId()); } catch (e) { continue; }
    const cfg = configDe(form);
    if (!cfg) continue;
    ScriptApp.newTrigger('aoResponder').forForm(form).onFormSubmit().create();
    faltando.splice(faltando.indexOf(cfg.nome), 1);
    console.log('Gatilho ligado: ' + cfg.nome + ' → fluxo ' + cfg.fluxo);
  }
  if (faltando.length) throw new Error('Formulário não encontrado nesta conta: ' + faltando.join(', '));
  if (!chave()) throw new Error('Falta a propriedade BOTCONVERSA_API_KEY (Configurações do projeto → Propriedades do script).');
}

/** Gatilho: roda a cada resposta enviada. */
function aoResponder(e) {
  const cfg = configDe(e.source);
  if (!cfg) return;

  const respostas = e.response.getItemResponses().map(r => ({
    pergunta: r.getItem().getTitle(),
    resposta: [].concat(r.getResponse()).join(', ').trim(),
  }));
  const acha = (teste) => (respostas.find(r => teste(r.pergunta.trim().toLowerCase())) || {}).resposta || '';

  // "Como conheceu" também tem "nome", por isso o nome é pelo começo da pergunta
  const nomeCompleto = acha(k => k.startsWith('nome')).replace(/ +/g, ' ') || 'Lead';
  const partes = nomeCompleto.split(' ');
  const primeiro = partes.shift() || 'Lead';
  const sobrenome = partes.join(' ') || '-'; // BotConversa recusa sobrenome vazio (400)
  const telefone = normalizaTelefone(acha(k => k.includes('telefone')));

  // 1) pessoa → fluxo (erro aqui não impede o aviso)
  try {
    const pessoa = post('/subscriber/', { phone: telefone, first_name: primeiro, last_name: sobrenome });
    post('/subscriber/' + pessoa.id + '/send_flow/', { flow: cfg.fluxo });
    console.log(cfg.nome + ': fluxo ' + cfg.fluxo + ' disparado para ' + telefone + ' (id ' + pessoa.id + ')');
  } catch (err) {
    console.error(cfg.nome + ': falhou pessoa/fluxo para ' + telefone + ' — ' + err.message);
  }

  // 2) aviso pra secretaria/intercessão (mesmo número: 41 99512-6655)
  try {
    const linhas = [
      '📅 *Data/hora:* ' + Utilities.formatDate(e.response.getTimestamp(), 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm:ss'),
    ];
    respostas.filter(r => r.resposta).forEach(r => {
      const k = r.pergunta.toLowerCase();
      const rotulo = (ROTULOS.find(([p]) => p === 'nome' ? k.trim().startsWith(p) : k.includes(p)) || [])[1]
        || ('▫️ *' + r.pergunta.replace(/\?$/, '') + ':*');
      linhas.push(rotulo + ' ' + r.resposta);
    });
    // O link da planilha fica em propriedade do script: este repositório é público e a planilha tem dado de visitante.
    const planilha = cfg.planilha ? (PropertiesService.getScriptProperties().getProperty(cfg.planilha) || '').trim() : '';
    const rodape = ['💬 Falar com a pessoa: https://wa.me/' + telefone];
    if (planilha) rodape.push('📊 Planilha com todos os cadastros: ' + planilha);
    const texto = [cfg.titulo, '', ...linhas, '', ...rodape].join('\n');
    try {
      const aviso = post('/subscriber/', { phone: AVISO_TELEFONE, first_name: 'Avisos', last_name: 'Cadastro Visitantes' });
      post('/subscriber/' + aviso.id + '/send_message/', { type: 'text', value: texto });
    } catch (err) {
      console.error(cfg.nome + ': falhou o aviso — ' + err.message);
    }
    // 3) grupo (só quem tem grupo: true) — erro aqui não desfaz nada do que já saiu
    if (cfg.grupo) enviarProGrupo(cfg.nome, texto);
  } catch (err) {
    console.error(cfg.nome + ': falhou montar o aviso — ' + err.message);
  }
}

/**
 * Posta no grupo de WhatsApp da intercessão. O BotConversa não fala com grupo, então
 * quem posta é um número da igreja que ESTÁ no grupo, conectado na UAZAPI da Transborda.
 * Propriedades do script: UAZAPI_TOKEN (token da instância) e GRUPO_ORACAO_JID (…@g.us).
 * Sem as duas, não faz nada — o resto do cadastro segue normal.
 */
function enviarProGrupo(nome, texto) {
  const props = PropertiesService.getScriptProperties();
  const token = (props.getProperty('UAZAPI_TOKEN') || '').trim();
  const grupo = (props.getProperty('GRUPO_ORACAO_JID') || '').trim();
  if (!token || !grupo) {
    console.log(nome + ': grupo ainda não configurado (UAZAPI_TOKEN / GRUPO_ORACAO_JID) — pulei.');
    return;
  }
  try {
    const r = UrlFetchApp.fetch(UAZAPI + '/send/text', {
      method: 'post',
      contentType: 'application/json',
      headers: { token: token },
      payload: JSON.stringify({ number: grupo, text: texto }),
      muteHttpExceptions: true,
    });
    const status = r.getResponseCode();
    if (status >= 300) throw new Error('HTTP ' + status + ': ' + r.getContentText().slice(0, 300));
    console.log(nome + ': postado no grupo ' + grupo);
  } catch (err) {
    console.error(nome + ': falhou o grupo — ' + err.message);
  }
}

const CONVITE_GRUPO_ORACAO = 'Jzu0aoxIHAoJOSGAITWZQF'; // chat.whatsapp.com/<este código>

/**
 * Rodar UMA vez depois de colar UAZAPI_TOKEN nas propriedades: confere se o número está
 * conectado, acha o grupo pelo link de convite (só lê, não entra) e grava GRUPO_ORACAO_JID.
 */
function configurarGrupo() {
  const props = PropertiesService.getScriptProperties();
  const token = (props.getProperty('UAZAPI_TOKEN') || '').trim();
  if (!token) throw new Error('Falta a propriedade UAZAPI_TOKEN.');

  const st = JSON.parse(UrlFetchApp.fetch(UAZAPI + '/instance/status', { headers: { token: token }, muteHttpExceptions: true }).getContentText() || '{}');
  const inst = st.instance || st;
  console.log('Número conectado: ' + (inst.owner || '?') + ' | status: ' + inst.status);

  const r = UrlFetchApp.fetch(UAZAPI + '/group/inviteInfo', {
    method: 'post', contentType: 'application/json', headers: { token: token },
    payload: JSON.stringify({ invitecode: CONVITE_GRUPO_ORACAO }), muteHttpExceptions: true,
  });
  const g = (JSON.parse(r.getContentText() || '{}').group) || {};
  const jid = String(g.JID || g.jid || '');
  if (!jid.endsWith('@g.us')) throw new Error('Não achei o grupo pelo convite (HTTP ' + r.getResponseCode() + '): ' + r.getContentText().slice(0, 200));

  // o número precisa ESTAR no grupo — a UAZAPI aceita envio pra grupo alheio e a mensagem some
  const lista = JSON.parse(UrlFetchApp.fetch(UAZAPI + '/group/list', { headers: { token: token }, muteHttpExceptions: true }).getContentText() || '[]');
  const grupos = Array.isArray(lista) ? lista : (lista.groups || []);
  const dentro = grupos.some(x => String(x.JID || x.jid || x.id) === jid);

  props.setProperty('GRUPO_ORACAO_JID', jid);
  console.log('Grupo: ' + (g.Name || g.name) + ' (' + jid + ') | o número está dentro: ' + (dentro ? 'SIM' : 'NÃO — adicionar o número ao grupo antes do teste'));
}

/** Manda pro grupo um pedido de TESTE (dados do cadastro de teste do Valdir, 25/09). */
function testarGrupo() {
  const texto = [
    '🧪 *TESTE — pode ignorar*',
    '',
    '🙏 *Novo PEDIDO DE ORAÇÃO*',
    '',
    '📅 *Data/hora:* 25/09/2026 09:24:58',
    '👤 *Nome:* Valdir Alves',
    '📱 *Telefone:* 41999187786',
    '🙏 *Pedido de oração:* N',
    '🎂 *Idade:* 62',
    '⛪ *Como conheceu:* Amigo',
  ].join('\n');
  enviarProGrupo('Teste', texto);
}

function configDe(form) {
  const url = form.getPublishedUrl();
  return FORMULARIOS.find(f => url.indexOf(f.codigo) !== -1) || null;
}

function normalizaTelefone(valor) {
  let n = String(valor || '').replace(/[^0-9]/g, '').replace(/^0+/, '');
  if (n.length === 10 || n.length === 11) n = '55' + n;
  return n;
}

function chave() {
  return (PropertiesService.getScriptProperties().getProperty('BOTCONVERSA_API_KEY') || '').trim();
}

function post(caminho, corpo) {
  const r = UrlFetchApp.fetch(BASE + caminho, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'API-KEY': chave() },
    payload: JSON.stringify(corpo),
    muteHttpExceptions: true,
  });
  const status = r.getResponseCode();
  const texto = r.getContentText();
  if (status >= 300) throw new Error('HTTP ' + status + ' em ' + caminho + ': ' + texto.slice(0, 300));
  try { return JSON.parse(texto); } catch (e) { return {}; } // send_flow responde vazio quando dá certo
}

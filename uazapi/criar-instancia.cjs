// Cria (ou reaproveita) a instância UAZAPI "IGREJA-ABA-ORACAO" e gera o QR pra conectar o
// 41 99512-6655. Só serve pra POSTAR no grupo da intercessão — sem webhook, não lê conversa.
//
// Rodar pelo Wagner (a chave de admin vem da Vercel e nunca vai pra arquivo nem pra tela):
//   cd C:\Users\user\transborda-saas
//   vercel env run -e production -- node ../igreja-aba-automacoes/uazapi/criar-instancia.cjs
//
// Resultado: QR na Área de Trabalho (abre sozinho) e o TOKEN da instância copiado pra área de
// transferência — é só colar (Ctrl+V) na propriedade UAZAPI_TOKEN do Apps Script.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const BASE = process.env.UAZAPI_BASE_URL || 'https://transborda.uazapi.com';
const ADMIN = process.env.UAZAPI_ADMIN_TOKEN;
const NOME = 'IGREJA-ABA-ORACAO';

async function uaz(method, caminho, headers, body) {
  const r = await fetch(BASE + caminho, {
    method,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await r.text();
  let json = null;
  try { json = JSON.parse(txt); } catch {}
  return { status: r.status, json, txt };
}

(async () => {
  if (!ADMIN) throw new Error('UAZAPI_ADMIN_TOKEN não veio da Vercel (rodou com "vercel env run -e production"?).');

  // reaproveita se já existir (rodar de novo não cria duplicata)
  const todas = await uaz('GET', '/instance/all', { admintoken: ADMIN });
  const lista = Array.isArray(todas.json) ? todas.json : (todas.json?.instances || []);
  let inst = lista.find((i) => i.name === NOME);
  let token = inst?.token;
  if (token) {
    console.log(`Instância ${NOME} já existe (status: ${inst.status}) — reaproveitando.`);
  } else {
    const cri = await uaz('POST', '/instance/init', { admintoken: ADMIN }, { name: NOME });
    token = (cri.json?.instance ?? cri.json)?.token ?? cri.json?.token;
    if (!token) throw new Error(`Não criou a instância (HTTP ${cri.status}): ${cri.txt.slice(0, 200)}`);
    console.log(`Instância ${NOME} criada.`);
  }

  const st = await uaz('GET', '/instance/status', { token });
  const estado = String((st.json?.instance ?? st.json)?.status || '').toLowerCase();
  if (estado === 'connected') {
    console.log('Já está CONECTADA em ' + (st.json?.instance ?? st.json)?.owner + ' — não precisa de QR.');
  } else {
    const con = await uaz('POST', '/instance/connect', { token });
    const qr = (con.json?.instance ?? con.json)?.qrcode;
    if (!qr) throw new Error(`QR não veio (HTTP ${con.status}): ${con.txt.slice(0, 200)}`);
    const arquivo = path.join(os.homedir(), 'Desktop', 'QR CONECTAR 41 99512-6655 (UAZAPI).png');
    fs.writeFileSync(arquivo, Buffer.from(qr.replace(/^data:image\/png;base64,/, ''), 'base64'));
    console.log('QR salvo e aberto: ' + arquivo);
    console.log('No celular do 41 99512-6655: WhatsApp → Aparelhos conectados → Conectar um aparelho → ler o QR.');
    console.log('⏱  O QR vence em ~1 minuto. Venceu? É só rodar o comando de novo.');
    try { execSync(`start "" "${arquivo}"`, { shell: 'cmd.exe' }); } catch {}
  }

  // token → área de transferência (não aparece na tela)
  try {
    execSync('clip', { input: token });
    console.log('✅ Token da instância COPIADO. Cole (Ctrl+V) no Apps Script → Configurações do projeto → Propriedades → UAZAPI_TOKEN.');
  } catch {
    console.log('Não consegui copiar o token automaticamente.');
  }
})().catch((e) => { console.error('❌ ' + e.message); process.exit(1); });

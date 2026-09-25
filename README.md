# Igreja ABA Curitiba — automações e artes

Captação de **visitantes** e acolhimento de **novos convertidos** pelo WhatsApp da igreja
(BotConversa), alimentados por Google Forms via n8n. Estado em **16/09/2026**.

## Visão geral

```
Google Forms ─► planilha de respostas ─► n8n (a cada 1 min)
                                           ├─► BotConversa: cria/acha o contato ─► manda pro fluxo
                                           └─► BotConversa: mensagem de AVISO no número principal
```

| Peça | Onde | Observação |
|---|---|---|
| Forms de visitantes | [link público](https://docs.google.com/forms/d/e/1FAIpQLSfSkYTS_DRcRhGOwQDJDBgbDMEzx2WEJ-sww4qWV4lJijqeqQ/viewform) | conta **abafinanceiro2023@gmail.com** |
| Planilha de respostas | "Formulário visitantes" › aba "Respostas ao formulário 1" | mesma conta |
| n8n | `transborda.app.n8n.cloud` › workflow **Forms -> BotConversa** (`nW1pGpBhJacQkjAp`) | ⚠️ **trial de 14 dias** (acaba ~30/09) |
| BotConversa | Companhia **197700**, WhatsApp (41) 9 9512-6655 | plano PRO (API só existe no PRO) |
| Fluxo visitantes | `INTEGRAÇÃO FORMS VISITANTES` (**9004500**) | 1h → boas-vindas + folder PDF → 24h → vídeo |
| Fluxo novo convertido | `NOVO CONVERTIDO` (**9260130**) | 1h → carta PDF → 23h → vídeo do pastor → 1 dia → Ação |

## n8n

`n8n/forms-botconversa.json` é o workflow publicado, **sem a chave da API**. Para reimportar:

1. `npm run workflow` (regenera o JSON a partir de `n8n/gerar-workflow.js`)
2. n8n › Import from file › escolher o JSON
3. Bloco **Forms - Nova resposta**: `Sign in with Google` com a conta dona da planilha
4. Bloco **CONFIGURAR AQUI**: colar `api_key` (BotConversa › Configurações › Integrações › seção **API**, não a do Zapier/Webhook)
5. Salvar **e clicar em Publish** — neste n8n salvar não publica

Campos do bloco CONFIGURAR AQUI: `api_key`, `flow_id` (fluxo que o visitante recebe), `aviso_telefone` (quem recebe o aviso de cadastro).

### Regras aprendidas (não repetir)

- **Automação desligada no contato bloqueia o fluxo**, inclusive quando o fluxo é disparado pela API. Por isso o aviso de cadastro sai pelo n8n (`send_message`), não por bloco dentro do fluxo.
- **`last_name` é obrigatório** no `POST /subscriber/`: vazio → 400 "may not be blank"; ausente → 400 "is required". Quem digita só o primeiro nome vai com `"-"`.
- Os 4 blocos HTTP usam `onError: continueRegularOutput`: erro com o visitante não impede o aviso.
- As colunas do Forms são achadas pelo texto da pergunta: o nome pela pergunta que **começa com "nome"** ("Como conheceu… citar nome" também contém "nome"), o telefone pela que **contém "telefone"**. Renomear essas duas perguntas quebra a integração.
- O BotConversa grava celular do PR sem o 9º dígito (`+554199187785`) — é normal.
- Construtor do BotConversa: **clicar** no ponto de saída de um bloco cria ligação fantasma (já gerou loop). Ligar só arrastando e conferir depois de recarregar a página.
- Reprocessar um cadastro que falhou: `POST /rest/executions/{id}/retry {"loadWorkflow": true}` (reenvia o aviso também).

## Artes

| Arquivo | Fonte |
|---|---|
| `entregas/folder-visitantes-21x15.pdf` | `artes/folder-visitantes/folder.html` — 21×15 cm, 2 páginas, sem sangria; Instagram e WhatsApp clicáveis (`wa.me/5541995126655?text=Estou vindo pelo link de visitante`) |
| `entregas/carta-boas-vindas-familia-aba.pdf` | `artes/carta-novo-convertido/carta.html` — A4, texto fiel à carta impressa |
| `entregas/qrcode-forms-visitantes*.{pdf,png}` | QR do Forms de visitantes |

`npm install && npm run artes` regera PDFs e QR. Logos, espiral "Frutificar" e foto foram extraídos do PDF original do folder (`artes/assets/*.js`: imagens CMYK com predictor PNG; a foto JPEG CMYK vem invertida).
Paleta tirada do Instagram @igrejaabacuritiba: preto `#070b0b`, petróleo `#0c3533`/`#134a46`, sálvia `#a9c9bd`; Montserrat + Cormorant Garamond itálico.

## Pendências (retomar aqui)

1. **Entrada do NOVO CONVERTIDO** — ✅ 25/09: Forms "Novo convertido" (`1FAIpQLSf8TSg…`, conta abafinanceiro2023) + QR em `artes/QR NOVO CONVERTIDO.png`. Falta só o 1º teste real pelo QR.
2. **Ação das 48h** do NOVO CONVERTIDO: escolher o membro em "Atribuir e abrir atendimento" e em "Notificar membro da equipe" e marcar "Notificar por WhatsApp" quando a pessoa se cadastrar no BotConversa.
3. **Avisar 9 pessoas** a cada visitante: aguardando lista (nome + WhatsApp) e se é aviso para todos ou rodízio.
4. ✅ **n8n aposentado (25/09)** — os dois Forms agora rodam no **Apps Script** `apps-script/Code.gs` (projeto "Igreja ABA - Forms para BotConversa", conta abafinanceiro2023, chave na propriedade `BOTCONVERSA_API_KEY`, 2 gatilhos "Ao enviar"). Grátis, sem prazo. Workflows do n8n Cloud DESLIGADOS (trial acaba ~30/09). Formulário novo = linha nova em `FORMULARIOS` + rodar `instalar`. ⚠️ Rodar `instalar` numa janela só com a conta abafinanceiro2023 (com várias contas logadas o Executar trava).
5. Sangria 3 mm no folder se a gráfica pedir.

## Pedido de oração (25/09/2026)
- Forms `1FAIpQLSc9xV79…` (conta abafinanceiro2023) + QR em `artes/QR PEDIDO DE ORACAO.png`.
- Fluxo BotConversa **PEDIDO DE ORAÇÃO** id `9283466` (resposta imediata de acolhimento + Isaías 59:1).
- Apps Script: entrada nova em `FORMULARIOS` (`grupo: true`) → aviso "🙏 Novo PEDIDO DE ORAÇÃO" no 41 99512-6655 (secretaria = intercessão) **e** post no grupo da intercessão.
- **Grupo:** o BotConversa não tem API de grupo (conferido no swagger). Quem posta é um número da igreja QUE ESTÁ NO GRUPO, conectado como instância na **UAZAPI da Transborda** (`POST /send/text {number: <jid>@g.us, text}`, header `token`). Propriedades do script: `UAZAPI_TOKEN` e `GRUPO_ORACAO_JID`. Sem elas o script só pula o grupo.
- Link do grupo: `https://chat.whatsapp.com/Jzu0aoxIHAoJOSGAITWZQF` → id via `POST /group/inviteInfo {invitecode}` (só lê, não entra).
- ✅ 25/09 NO AR: instância UAZAPI **"Igreja Aba"** (554195126655, o MESMO número do BotConversa — lá ele é "aparelho conectado", então os dois convivem; UAZAPI sem webhook, só posta). Grupo **"INTERCESSÃO ONLINE GERANDO INTERCESSORES!"** = `120363206368539980@g.us` (número está dentro). Teste postado no grupo 12:23. 3 gatilhos ativos (Visitantes, Novo convertido, Pedido de oração).
- Truques do editor: o seletor de função não obedece clique automatizado → pôr um atalho `function AGORA_x(){x()}` no TOPO do arquivo (o editor escolhe a 1ª função) e apagar depois. A chave de admin da UAZAPI é protegida na Vercel (nem `vercel env run` entrega) → instância se cria no painel da UAZAPI.

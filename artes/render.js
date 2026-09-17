// Gera os PDFs das artes a partir dos HTMLs.
// Uso: node artes/render.js  ->  entregas/*.pdf
// Precisa do Chrome instalado (puppeteer-core usa o Chrome da máquina).
const path = require('path');
const url = require('url');
const QRCode = require('qrcode');
const puppeteer = require('puppeteer-core');

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ENTREGAS = path.join(__dirname, '..', 'entregas');
const FORMS_VISITANTES = 'https://docs.google.com/forms/d/e/1FAIpQLSfSkYTS_DRcRhGOwQDJDBgbDMEzx2WEJ-sww4qWV4lJijqeqQ/viewform';

async function htmlParaPdf(browser, arquivo, saida, formato) {
  const page = await browser.newPage();
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
  await page.goto(url.pathToFileURL(path.join(__dirname, arquivo)).href, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  // painel estourando = texto cortado na impressão
  const estouro = await page.evaluate(() => [...document.querySelectorAll('.painel, .conecte-conteudo, .folha, .corpo')]
    .filter(e => e.scrollHeight > e.clientHeight + 1 && !e.classList.contains('boas-vindas')).map(e => e.className));
  if (estouro.length) console.warn('⚠️ estourando em', arquivo, estouro);
  await page.pdf({ path: path.join(ENTREGAS, saida), printBackground: true, preferCSSPageSize: true, ...formato });
  await page.close();
  console.log('ok:', saida);
}

(async () => {
  await QRCode.toFile(path.join(ENTREGAS, 'qrcode-forms-visitantes.png'), FORMS_VISITANTES, { width: 1200, margin: 2, errorCorrectionLevel: 'M' });
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--allow-file-access-from-files'] });
  await htmlParaPdf(browser, 'folder-visitantes/folder.html', 'folder-visitantes-21x15.pdf', { width: '210mm', height: '150mm' });
  await htmlParaPdf(browser, 'carta-novo-convertido/carta.html', 'carta-boas-vindas-familia-aba.pdf', { format: 'A4' });
  await browser.close();
})();

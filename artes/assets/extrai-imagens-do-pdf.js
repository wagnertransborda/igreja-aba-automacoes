const fs = require('fs');
const buf = fs.readFileSync('C:/Users/user/Downloads/VISITANTES FOLDER 21Lx15A.pdf');
const s = buf.toString('latin1');
const re = /(\d+) 0 obj\s*<<((?:(?!endobj).)*?)>>\s*stream\r?\n/gs;
let m, n = 0;
while ((m = re.exec(s))) {
  const dict = m[2];
  if (!/\/Subtype\s*\/Image/.test(dict)) continue;
  const start = m.index + m[0].length;
  const lenM = dict.match(/\/Length (\d+)(?! 0 R)/);
  const end = lenM ? start + +lenM[1] : s.indexOf('endstream', start);
  const w = dict.match(/\/Width (\d+)/)?.[1], h = dict.match(/\/Height (\d+)/)?.[1];
  const filt = dict.match(/\/Filter\s*(\/\w+|\[[^\]]*\])/)?.[1];
  const cs = dict.match(/\/ColorSpace\s*(\/\w+|\d+ 0 R|\[[^\]]*\])/)?.[1];
  const bpc = dict.match(/\/BitsPerComponent (\d+)/)?.[1];
  const smask = dict.match(/\/SMask (\d+) 0 R/)?.[1];
  const data = buf.subarray(start, end);
  const ext = /DCT/.test(filt) ? 'jpg' : 'bin';
  fs.writeFileSync(`img${m[1]}.${ext}`, data);
  console.log(m[1], w + 'x' + h, filt, cs, 'bpc', bpc, 'smask', smask, data.length);
  n++;
}
console.log('total', n);

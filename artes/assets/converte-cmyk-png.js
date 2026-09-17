const fs = require('fs'), zlib = require('zlib'), {PNG} = require('../node_modules/pngjs');
function unfilter(d, w, h, bpp) {
  const out = Buffer.alloc(w*h*bpp), rl = w*bpp;
  for (let y = 0; y < h; y++) {
    const ft = d[y*(rl+1)], src = y*(rl+1)+1, o = y*rl;
    for (let x = 0; x < rl; x++) {
      const raw = d[src+x], a = x>=bpp ? out[o+x-bpp] : 0, b = y ? out[o-rl+x] : 0, c = (y && x>=bpp) ? out[o-rl+x-bpp] : 0;
      let v;
      switch (ft) { case 0: v=raw; break; case 1: v=raw+a; break; case 2: v=raw+b; break; case 3: v=raw+((a+b)>>1); break;
        case 4: { const p=a+b-c, pa=Math.abs(p-a), pb=Math.abs(p-b), pc=Math.abs(p-c); v = raw + (pa<=pb&&pa<=pc ? a : pb<=pc ? b : c); break; } }
      out[o+x] = v & 255;
    }
  }
  return out;
}
const s = fs.readFileSync('C:/Users/user/Downloads/VISITANTES FOLDER 21Lx15A.pdf').toString('latin1');
const pred = id => { const i = s.indexOf('\n'+id+' 0 obj'); return /Predictor 1[0-5]/.test(s.slice(i, i+400)); };
const load = (id, w, h, bpp) => { let d = zlib.inflateSync(fs.readFileSync(`img${id}.bin`)); return pred(id) ? unfilter(d, w, h, bpp) : d; };
const info = { 22:[337,187,23], 27:[2480,1748], 29:[2480,1748], 72:[268,268], 73:[756,756,74], 79:[1861,2078,80], 77:[4000,2455] };
for (const [id, [w,h,sm]] of Object.entries(info)) {
  const d = load(id, w, h, 4);
  const a = sm ? load(sm, w, h, 1) : null;
  const png = new PNG({ width: w, height: h });
  for (let i = 0; i < w*h; i++) {
    const C=d[i*4]/255, M=d[i*4+1]/255, Y=d[i*4+2]/255, K=d[i*4+3]/255;
    png.data[i*4] = 255*(1-C)*(1-K); png.data[i*4+1] = 255*(1-M)*(1-K); png.data[i*4+2] = 255*(1-Y)*(1-K);
    png.data[i*4+3] = a ? a[i] : 255;
  }
  fs.writeFileSync(`out${id}.png`, PNG.sync.write(png));
  console.log('ok', id);
}

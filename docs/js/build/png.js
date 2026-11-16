// Чтение PNG без canvas: пиксели выходят точно такими, какими лежат в файле.
const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const CHANNELS = { 2: 3, 6: 4 }; // RGB и RGBA по 8 бит: так сохраняет картинки сам сайт

async function inflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

function unfilter(raw, width, height, channels) {
  const stride = width * channels;
  const out = new Uint8Array(stride * height);
  for (let y = 0; y < height; y += 1) {
    const type = raw[y * (stride + 1)];
    const line = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x += 1) {
      const left = x >= channels ? out[y * stride + x - channels] : 0;
      const up = y > 0 ? out[(y - 1) * stride + x] : 0;
      const corner = x >= channels && y > 0 ? out[(y - 1) * stride + x - channels] : 0;
      const add = [0, left, up, (left + up) >> 1, paeth(left, up, corner)][type];
      if (add === undefined) throw new Error('Повреждённый PNG');
      out[y * stride + x] = (raw[line + x] + add) & 255;
    }
  }
  return out;
}

/** { width, height, rgba } или ошибка, если это не простой 8-битный PNG. */
export async function decodePng(bytes) {
  if (!SIGNATURE.every((b, i) => bytes[i] === b)) throw new Error('Файл не похож на PNG');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 8;
  let head = null;
  const idat = [];
  while (pos + 8 <= bytes.length) {
    const length = view.getUint32(pos);
    const type = String.fromCharCode(...bytes.subarray(pos + 4, pos + 8));
    const body = bytes.subarray(pos + 8, pos + 8 + length);
    if (type === 'IHDR') {
      head = { width: view.getUint32(pos + 8), height: view.getUint32(pos + 12), depth: body[8], color: body[9], interlace: body[12] };
    } else if (type === 'IDAT') {
      idat.push(body);
    } else if (type === 'IEND') {
      break;
    }
    pos += 12 + length;
  }
  const channels = head && CHANNELS[head.color];
  if (!head || head.depth !== 8 || !channels || head.interlace !== 0) throw new Error('Этот вид PNG не поддерживается');
  const packed = new Uint8Array(idat.reduce((sum, part) => sum + part.length, 0));
  idat.reduce((at, part) => { packed.set(part, at); return at + part.length; }, 0);
  const pixels = unfilter(await inflate(packed), head.width, head.height, channels);
  if (channels === 4) return { width: head.width, height: head.height, rgba: pixels };
  const rgba = new Uint8Array(head.width * head.height * 4);
  for (let i = 0, o = 0; i < pixels.length; i += 3, o += 4) {
    rgba[o] = pixels[i];
    rgba[o + 1] = pixels[i + 1];
    rgba[o + 2] = pixels[i + 2];
    rgba[o + 3] = 255;
  }
  return { width: head.width, height: head.height, rgba };
}

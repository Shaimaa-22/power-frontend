import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateImage, MAX_IMAGE_BYTES } from '../src/lib/images.js';
const load = name => readFileSync(new URL('./fixtures/' + name, import.meta.url));
const validate = (bytes, mime) => validateImage(new File([bytes], 'irrelevant-extension.txt', { type:mime }));

for (const [kind, mime, names] of [
  ['JPEG','image/jpeg',['valid.jpg','progressive.jpg']],
  ['PNG','image/png',['valid.png']],
  ['WebP','image/webp',['valid.webp','lossless.webp','animated.webp']],
  ['GIF','image/gif',['valid.gif','animated.gif']],
  ['AVIF','image/avif',['valid.avif']],
]) {
  test(`${kind}: real encoded fixtures pass, every truncated prefix and trailing garbage fail`, async () => {
    for (const name of names) {
      const bytes = load(name);
      assert.equal(await validate(bytes,mime),null,name);
      for (let cut = 0; cut < bytes.length; cut++) {
        assert.notEqual(await validate(bytes.subarray(0,cut),mime),null,`${name} truncated at ${cut}`);
      }
      assert.notEqual(await validate(Buffer.concat([bytes,Buffer.from('<html>')]),mime),null,name + ' trailing garbage');
    }
  });
}

test('JPEG: three-byte exploit, SOI/EOI only, bad segment length and missing scan are rejected', async () => {
  for (const bytes of [Buffer.from([255,216,255]),Buffer.from([255,216,255,217])]) {
    assert.notEqual(await validate(bytes,'image/jpeg'),null);
  }
  const length = load('valid.jpg'); length.writeUInt16BE(65535,4);
  assert.notEqual(await validate(length,'image/jpeg'),null);
  const source=load('valid.jpg'), scan=source.indexOf(Buffer.from([255,218]));
  assert.ok(scan>0);
  assert.notEqual(await validate(Buffer.concat([source.subarray(0,scan),Buffer.from([255,217])]),'image/jpeg'),null);
});

test('PNG: bad CRC, forged length and missing image data rejected', async () => {
  const crc=load('valid.png');crc[crc.length-1]^=1;
  assert.notEqual(await validate(crc,'image/png'),null);
  const length=load('valid.png');length.writeUInt32BE(0xffffffff,8);
  assert.notEqual(await validate(length,'image/png'),null);
  const source=load('valid.png');
  assert.notEqual(await validate(Buffer.concat([source.subarray(0,33),source.subarray(-12)]),'image/png'),null);
});

test('WebP: wrong RIFF length, invalid bitstream header and empty container rejected', async () => {
  const size=load('valid.webp');size.writeUInt32LE(size.length,4);
  assert.notEqual(await validate(size,'image/webp'),null);
  const magic=load('valid.webp');const vp8=magic.indexOf(Buffer.from('VP8 '));magic[vp8+11]=0;
  assert.notEqual(await validate(magic,'image/webp'),null);
  const empty=load('valid.webp').subarray(0,12);empty.writeUInt32LE(4,4);
  assert.notEqual(await validate(empty,'image/webp'),null);
});

test('GIF: bad LZW code size, missing frame and overflowing sub-block rejected', async () => {
  const code=load('valid.gif');
  let p=13 + ((code[10]&128)?3*(1<<((code[10]&7)+1)):0);
  assert.equal(code[p],0x2c);
  const descriptor=p; p+=10;
  if(code[descriptor+9]&128)p+=3*(1<<((code[descriptor+9]&7)+1));
  code[p]=1;
  assert.notEqual(await validate(code,'image/gif'),null);
  const empty=Buffer.concat([code.subarray(0,descriptor),Buffer.from([0x3b])]);
  assert.notEqual(await validate(empty,'image/gif'),null);
  const overflow=load('valid.gif');overflow[p+1]=255;
  assert.notEqual(await validate(overflow,'image/gif'),null);
});

test('AVIF: brand-only, invalid box size, wrong brand, missing metadata and missing media rejected', async () => {
  const source=load('valid.avif'), ftypEnd=source.readUInt32BE(0);
  assert.notEqual(await validate(source.subarray(0,ftypEnd),'image/avif'),null);
  const overflow=Buffer.from(source);overflow.writeUInt32BE(0xffffffff,0);
  assert.notEqual(await validate(overflow,'image/avif'),null);
  const wrong=Buffer.from(source);for(let p=8;p<ftypEnd;p+=4)wrong.write('zzzz',p);
  assert.notEqual(await validate(wrong,'image/avif'),null);
  for(const omit of ['meta','mdat']) {
    const parts=[];for(let p=0;p<source.length;){const n=source.readUInt32BE(p);if(source.toString('ascii',p+4,p+8)!==omit)parts.push(source.subarray(p,p+n));p+=n;}
    assert.notEqual(await validate(Buffer.concat(parts),'image/avif'),null,omit);
  }
});

test('SVG/HTML, cross-format MIME spoofing, unsupported MIME and oversize rejected before reading', async () => {
  assert.notEqual(await validate(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),'image/svg+xml'),null);
  assert.notEqual(await validate(Buffer.from('<html>not an image</html>'),'image/jpeg'),null);
  const formats=[['valid.jpg','image/jpeg'],['valid.png','image/png'],['valid.gif','image/gif'],['valid.webp','image/webp'],['valid.avif','image/avif']];
  for(const [name,mime]of formats)for(const [,other]of formats)if(mime!==other)assert.notEqual(await validate(load(name),other),null,`${mime} as ${other}`);
  assert.notEqual(await validate(load('valid.png'),'application/octet-stream'),null);
  assert.notEqual(await validateImage({type:'image/png',size:MAX_IMAGE_BYTES+1,arrayBuffer(){throw new Error('Oversize body must not be read');}}),null);
});

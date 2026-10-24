// Giả lập Higgsfield + Claude để chạy thử động cơ n8n
const http = require('http');
const fs = require('fs');
const path = require('path');
const MEDIA = path.join(__dirname, 'media');
const LOG = path.join(__dirname, 'mock.log');
const store = {};
const reqs = {};
let n = 0;
const mode = { claudeDat: true, failNext: null };
const log = (o) => fs.appendFileSync(LOG, JSON.stringify(o) + '\n');

http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const buf = Buffer.concat(chunks);
    const u = req.url;
    const send = (code, obj, type = 'application/json') => {
      res.writeHead(code, { 'Content-Type': type });
      res.end(typeof obj === 'string' || Buffer.isBuffer(obj) ? obj : JSON.stringify(obj));
    };
    let body = null;
    try { body = JSON.parse(buf.toString()); } catch (e) { /* binary */ }
    const entry = { m: req.method, u, h: { auth: req.headers.authorization, key: req.headers['x-api-key'], idem: req.headers['idempotency-key'], ver: req.headers['anthropic-version'], beta: req.headers['anthropic-beta'], ct: req.headers['content-type'], tag: req.headers['x-amz-tagging'] }, len: buf.length };
    if (u === '/__mode') { Object.assign(mode, body); return send(200, mode); }
    if (u === '/files/generate-upload-url') {
      if (req.headers.authorization !== 'Key testid:testsecret') { log({ ...entry, r: 401 }); return send(401, { detail: 'bad key' }); }
      const id = ++n;
      log({ ...entry, body });
      return send(200, { public_url: `http://127.0.0.1:9999/pub/${id}`, upload_url: `http://127.0.0.1:9999/put/${id}?sig=x`, content_type: body.content_type, upload_headers: { 'Content-Type': body.content_type, 'x-amz-tagging': 'retention=temporary' } });
    }
    // ---- giả lập fal ----
    if (u.startsWith('/storage/upload/initiate')) {
      if (req.headers.authorization !== 'Key testid:testsecret') { log({ ...entry, r: 401 }); return send(401, { detail: 'Invalid key' }); }
      const id = ++n;
      log({ ...entry, body });
      return send(200, { upload_url: `http://127.0.0.1:9999/put/${id}?sig=x`, file_url: `http://127.0.0.1:9999/pub/${id}` });
    }
    if (req.method === 'POST' && u.startsWith('/fal-ai/')) {
      log({ ...entry, body });
      if (req.headers.authorization !== 'Key testid:testsecret') return send(401, { detail: 'Invalid key' });
      if (mode.failNext === 'submit') { mode.failNext = null; return send(422, { detail: [{ msg: 'bad input' }] }); }
      const id = 'F' + (++n);
      const app = u.split('/').slice(1, 3).join('/');
      reqs[id] = { kind: u.includes('nano-banana') ? 'img' : 'vid', polls: 0, body, fal: true };
      const base = `http://127.0.0.1:9999/${app}/requests/${id}`;
      return send(200, { request_id: id, status_url: base + '/status', response_url: base, cancel_url: base + '/cancel' });
    }
    const fm = u.match(/^\/fal-ai\/[^/]+\/requests\/(\w+)(\/status)?$/);
    if (fm) {
      const r = reqs[fm[1]];
      log(entry);
      if (req.headers.authorization !== 'Key testid:testsecret') return send(401, { detail: 'Invalid key' });
      if (!r) return send(404, { status: 'NOT_FOUND' });
      if (fm[2]) {
        r.polls++;
        if (r.polls < 2) return send(202, { status: 'IN_PROGRESS', request_id: fm[1] });
        if (mode.failNext === 'gen') { mode.failNext = null; r.err = 'Content flagged'; }
        return send(200, r.err ? { status: 'COMPLETED', request_id: fm[1], error: r.err, error_type: 'content_policy_violation' } : { status: 'COMPLETED', request_id: fm[1] });
      }
      if (r.err) return send(422, { detail: r.err });
      if (r.kind === 'img') return send(200, { images: [{ url: 'http://127.0.0.1:9999/out/img.png', content_type: 'image/png' }], description: '' });
      return send(200, { video: { url: 'http://127.0.0.1:9999/out/vid.mp4', content_type: 'video/mp4' } });
    }
    if (u.startsWith('/put/')) { store[u.split('/')[2].split('?')[0]] = buf; log(entry); return send(200, ''); }
    if (u === '/alibaba/qwen-image-3/edit' || u === '/kling-video/motion-control/std') {
      log({ ...entry, body });
      if (mode.failNext === 'submit') { mode.failNext = null; return send(422, { detail: 'invalid image' }); }
      const id = 'R' + (++n);
      reqs[id] = { kind: u.includes('qwen') ? 'img' : 'vid', polls: 0, body };
      return send(200, { status: 'queued', request_id: id, status_url: `http://127.0.0.1:9999/requests/${id}/status`, cancel_url: 'x' });
    }
    const m = u.match(/^\/requests\/(\w+)\/status$/);
    if (m) {
      const r = reqs[m[1]];
      log(entry);
      if (!r) return send(404, { detail: 'not found' });
      r.polls++;
      if (r.polls < 2) return send(200, { status: 'in_progress', request_id: m[1] });
      if (r.kind === 'img') return send(200, { status: 'completed', request_id: m[1], images: [{ url: 'http://127.0.0.1:9999/out/img.png' }] });
      return send(200, { status: 'completed', request_id: m[1], video: { url: 'http://127.0.0.1:9999/out/vid.mp4' } });
    }
    if (u === '/out/img.png') return send(200, fs.readFileSync(path.join(MEDIA, 'img.png')), 'image/png');
    if (u === '/out/vid.mp4') return send(200, fs.readFileSync(path.join(MEDIA, 'vid.mp4')), 'video/mp4');
    if (u === '/v1/messages') {
      const imgs = body.messages[0].content.filter((c) => c.type === 'image').length;
      const labels = body.messages[0].content.filter((c) => c.type === 'text').map((c) => c.text.slice(0, 60));
      log({ ...entry, model: body.model, fallbacks: body.fallbacks, imgs, labels, schema: Object.keys(body.output_config.format.schema.properties) });
      if (req.headers['x-api-key'] !== 'sk-ant-test') return send(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } });
      const isReport = 'tom_tat' in body.output_config.format.schema.properties;
      const out = isReport
        ? { tom_tat: 'Báo cáo thử: mọi thứ ổn.', van_de: [{ muc_do: 'Thấp', mo_ta: 'Thử', de_xuat: 'Không cần làm gì' }] }
        : { dat: mode.claudeDat, diem: mode.claudeDat ? 8 : 4, khop_trang_phuc: mode.claudeDat, loi: mode.claudeDat ? [] : ['Sai màu áo'], nhan_xet: 'Chấm thử' };
      return send(200, { id: 'msg', type: 'message', role: 'assistant', stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: JSON.stringify(out) }] });
    }
    log({ ...entry, r: 404 });
    send(404, { detail: 'no route' });
  });
}).listen(9999, '127.0.0.1', () => console.log('mock on 9999'));

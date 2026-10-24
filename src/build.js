// Sinh các file workflow n8n từ các khối code trong ./code
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const OUT = process.argv[2] || path.join(__dirname, 'out');
const CODE = path.join(__dirname, 'code');
const COMMON = fs.readFileSync(path.join(CODE, '_common.js'), 'utf8');
const code = (f, common = true) => {
  let src = (common ? COMMON + '\n' : '') + fs.readFileSync(path.join(CODE, f), 'utf8');
  // Chế độ thử nghiệm: trỏ API về máy giả lập
  if (process.env.TEST) src = src.replace('https://api.higgsfield.ai/', 'http://127.0.0.1:9999/').replace('https://api.anthropic.com/v1/messages', 'http://127.0.0.1:9999/v1/messages')
    .replace('https://queue.fal.run/', 'http://127.0.0.1:9999/').replace('https://rest.fal.ai/', 'http://127.0.0.1:9999/');
  return src;
};
const uuid = (s) => {
  const h = crypto.createHash('md5').update(s).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

const HF = { httpHeaderAuth: { id: 'hfApiCred0000001', name: 'Video API' } };
const CL = { httpHeaderAuth: { id: 'claudeApiCred001', name: 'Claude API' } };

class WF {
  constructor(id, name) { this.id = id; this.name = name; this.nodes = []; this.connections = {}; }
  add(name, type, typeVersion, parameters, position, extra = {}) {
    this.nodes.push(Object.assign({ id: uuid(this.id + name), name, type, typeVersion, position, parameters }, extra));
    return name;
  }
  link(from, to, out = 0) {
    const c = (this.connections[from] = this.connections[from] || { main: [] });
    while (c.main.length <= out) c.main.push([]);
    c.main[out].push({ node: to, type: 'main', index: 0 });
  }
  chain(...names) { for (let i = 0; i < names.length - 1; i++) this.link(names[i], names[i + 1]); }
  toJSON() {
    return {
      id: this.id, name: this.name, nodes: this.nodes, connections: this.connections, active: false,
      settings: { executionOrder: 'v1', timezone: 'Asia/Ho_Chi_Minh', saveDataSuccessExecution: 'all', saveDataErrorExecution: 'all' },
      pinData: {}, tags: [],
    };
  }
}

// ---------- khối dựng sẵn ----------
const tbl = (name) => ({ __rl: true, mode: 'name', value: name });
const codeNode = (wf, name, file, pos, extra) => wf.add(name, 'n8n-nodes-base.code', 2, { jsCode: code(file) }, pos, extra);
const dtGetAll = (wf, name, table, pos) => wf.add(name, 'n8n-nodes-base.dataTable', 1.1,
  { resource: 'row', operation: 'get', dataTableId: tbl(table), returnAll: true }, pos, { executeOnce: true, alwaysOutputData: true });
const dtUpdate = (wf, name, table, pos) => wf.add(name, 'n8n-nodes-base.dataTable', 1.1, {
  resource: 'row', operation: 'update', dataTableId: tbl(table), matchType: 'allConditions',
  filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: '={{ $json.id }}' }] },
  columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: [], schema: [] }, options: {},
}, pos);
const dtInsert = (wf, name, table, pos) => wf.add(name, 'n8n-nodes-base.dataTable', 1.1, {
  resource: 'row', operation: 'insert', dataTableId: tbl(table),
  columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: [], schema: [] }, options: {},
}, pos);
const exec = (wf, name, command, pos, extra = {}) => wf.add(name, 'n8n-nodes-base.executeCommand', 1,
  { executeOnce: false, command }, pos, Object.assign({ onError: 'continueRegularOutput', alwaysOutputData: true }, extra));
const sw = (wf, name, n, outputExpr, pos) => wf.add(name, 'n8n-nodes-base.switch', 3.4,
  { mode: 'expression', numberOutputs: n, output: outputExpr, looseTypeValidation: false, options: {} }, pos);
const http = (wf, name, p, pos, cred) => wf.add(name, 'n8n-nodes-base.httpRequest', 4.2, Object.assign({
  method: 'GET', url: '', authentication: cred ? 'genericCredentialType' : 'none',
  ...(cred ? { genericAuthType: 'httpHeaderAuth' } : {}),
  options: { timeout: 120000 },
}, p), pos, Object.assign({ onError: 'continueRegularOutput' }, cred ? { credentials: cred } : {}));

// Bộ "Ghi bảng": nhận lệnh {tbl, op, data} và ghi vào đúng bảng
function dbWriter(wf, x, y) {
  const routes = [['mau_do', 'update'], ['hang_doi', 'update'], ['kho_nhay', 'update'], ['hang_doi', 'insert'], ['kho_nhay', 'insert']];
  const map = JSON.stringify(Object.fromEntries(routes.map((r, i) => [r.join(':'), i])));
  const s = sw(wf, 'Ghi bảng', routes.length, `={{ (${map})[$json.tbl + ':' + $json.op] }}`, [x, y]);
  routes.forEach(([t, op], i) => {
    const strip = wf.add(`Dữ liệu ${op} ${t}`, 'n8n-nodes-base.code', 2, { jsCode: code('strip.js', false) }, [x + 240, y - 320 + i * 160]);
    const name = (op === 'update' ? 'Cập nhật ' : 'Thêm vào ') + t;
    (op === 'update' ? dtUpdate : dtInsert)(wf, name, t, [x + 480, y - 320 + i * 160]);
    wf.link(s, strip, i);
    wf.link(strip, name);
  });
  return s;
}

// =====================================================================
// 0. Cài đặt (chạy 1 lần)
// =====================================================================
function setup() {
  const wf = new WF('VideoAI00CaiDat1', '0. Cài đặt (chạy 1 lần)');
  wf.add('Bấm để cài đặt', 'n8n-nodes-base.manualTrigger', 1, {}, [0, 300]);
  // file CaiDat gọi địa chỉ này để tự tạo bảng, không cần bấm tay
  wf.add('Gọi từ file cài đặt', 'n8n-nodes-base.webhook', 2, { httpMethod: 'GET', path: 'cai-dat', responseMode: 'responseNode', options: {} }, [0, 500], { webhookId: uuid('cai-dat') });
  const S = 'string', N = 'number';
  const tables = {
    cau_hinh: [['khoa', S], ['gia_tri', S], ['giai_thich', S]],
    mau_do: [['ma_sp', S], ['ten_sp', S], ['phong_cach', S], ['trang_thai', S], ['so_video_ok', N], ['so_video_tao', N],
      ['ai_nhan_xet_anh', S], ['ghi_chu_loi', S], ['link_aff', S], ['hoa_hong', N], ['anh_sp', S], ['anh_mac_do', S],
      ['thu_muc_video', S], ['so_lan_ghep', N], ['status_url', S], ['gui_luc', S], ['so_loi', N]],
    kho_nhay: [['ten_file', S], ['bai_hat', S], ['phong_cach', S], ['trang_thai', S], ['so_lan_dung', N], ['so_lan_loi', N],
      ['ghi_chu', S], ['duong_dan', S]],
    hang_doi: [['job_id', S], ['ma_sp', S], ['bai_hat', S], ['trang_thai', S], ['video', S], ['ai_nhan_xet', S], ['duyet', S],
      ['ly_do_hong', S], ['dang_fb', S], ['dang_tiktok', S], ['nhan_ai', S], ['ghi_chu_loi', S], ['gui_luc', S], ['xong_luc', S],
      ['anh_mac_do', S], ['clip', S], ['clip_path', S], ['status_url', S], ['so_loi', N], ['da_tinh_loi', S]],
    bao_cao: [['ngay', S], ['tom_tat', S], ['van_de', S], ['so_lieu', S]],
  };
  let prev = 'Bấm để cài đặt';
  Object.entries(tables).forEach(([t, cols], i) => {
    const n = wf.add(`Tạo bảng ${t}`, 'n8n-nodes-base.dataTable', 1.1, {
      resource: 'table', operation: 'create', tableName: t,
      columns: { column: cols.map(([name, type]) => ({ name, type })) }, options: { createIfNotExists: true },
    }, [240 + i * 200, 300], { executeOnce: true });
    wf.link(prev, n);
    if (i === 0) wf.link('Gọi từ file cài đặt', n);
    prev = n;
  });
  const mk = exec(wf, 'Tạo thư mục', 'mkdir -p /files/00_NguoiMau /files/01_SanPham /files/02_AnhMacDo /files/03_KhoNhay /files/04_KetQua /files/tmp && ls /files', [1240, 300], { executeOnce: true, onError: 'stopWorkflow' });
  wf.link(prev, mk);
  // báo cho file cài đặt: bảng + thư mục đã xong (kể cả khi cấu hình đã có sẵn)
  const ok = wf.add('Báo đã cài xong', 'n8n-nodes-base.respondToWebhook', 1.1, { respondWith: 'text', responseBody: 'OK', options: {} }, [1460, 500]);
  wf.link(mk, ok);
  const c = codeNode(wf, 'Cấu hình mặc định', 'cau_hinh_mac_dinh.js', [1460, 300]);
  wf.link(mk, c);
  const ne = wf.add('Khóa chưa có', 'n8n-nodes-base.dataTable', 1.1, {
    resource: 'row', operation: 'rowNotExists', dataTableId: tbl('cau_hinh'), matchType: 'allConditions',
    filters: { conditions: [{ keyName: 'khoa', condition: 'eq', keyValue: '={{ $json.khoa }}' }] },
  }, [1680, 300]);
  wf.link(c, ne);
  const ins = dtInsert(wf, 'Thêm cấu hình', 'cau_hinh', [1900, 300]);
  wf.link(ne, ins);
  return wf;
}

// =====================================================================
// 1. Form thêm mẫu đồ
// =====================================================================
function form() {
  const wf = new WF('VideoAI01FormMau', '1. Form - Thêm mẫu đồ');
  wf.add('Form thêm mẫu đồ', 'n8n-nodes-base.formTrigger', 2.5, {
    formTitle: 'Thêm mẫu đồ', formDescription: 'Mỗi lần gửi là một mẫu. Tool sẽ tự ghép đồ vào người mẫu chính và làm video.',
    formFields: { values: [
      { fieldLabel: 'Mã SP', fieldType: 'text', requiredField: true, placeholder: 'vd SP001' },
      { fieldLabel: 'Tên SP', fieldType: 'text' },
      { fieldLabel: 'Phong cách', fieldType: 'dropdown', requiredField: true,
        fieldOptions: { values: ['basic', 'cute', 'sexy', 'streetwear', 'thanh-lich'].map((option) => ({ option })) } },
      { fieldLabel: 'Link affiliate', fieldType: 'text' },
      { fieldLabel: 'Hoa hồng %', fieldType: 'number' },
      { fieldLabel: 'Ảnh sản phẩm', fieldType: 'file', requiredField: true, multipleFiles: false, acceptFileTypes: '.jpg,.jpeg,.png,.webp' },
    ] },
    responseMode: 'lastNode', options: { appendAttribution: false, buttonLabel: 'Thêm mẫu', path: 'them-mau-do' },
  }, [0, 300], { webhookId: uuid('form-mau-do') });
  const c = codeNode(wf, 'Chuẩn bị lưu ảnh', 'form_mau_do.js', [240, 300]);
  const w = wf.add('Lưu ảnh sản phẩm', 'n8n-nodes-base.readWriteFile', 1.1,
    { operation: 'write', fileName: '={{ $json.path }}', dataPropertyName: 'data', options: {} }, [480, 300]);
  const d = codeNode(wf, 'Dòng mẫu đồ', 'form_dong.js', [720, 300]);
  const up = wf.add('Lưu vào bảng mẫu đồ', 'n8n-nodes-base.dataTable', 1.1, {
    resource: 'row', operation: 'upsert', dataTableId: tbl('mau_do'), matchType: 'allConditions',
    filters: { conditions: [{ keyName: 'ma_sp', condition: 'eq', keyValue: '={{ $json.ma_sp }}' }] },
    columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: [], schema: [] }, options: {},
  }, [960, 300]);
  const done = wf.add('Báo đã thêm', 'n8n-nodes-base.set', 3.4, {
    mode: 'manual', includeOtherFields: false,
    assignments: { assignments: [{ id: uuid('msg'), name: 'Kết quả', value: "=Đã thêm mẫu {{ $json.ma_sp }}. Tool sẽ xử lý trong vòng 10 phút.", type: 'string' }] },
    options: {},
  }, [1200, 300]);
  wf.chain('Form thêm mẫu đồ', c, w, d, up, done);
  return wf;
}

// =====================================================================
// 2. Động cơ: chạy 10 phút một lần
// =====================================================================
function engine() {
  const wf = new WF('VideoAI02DongCo1', '2. Động cơ (10 phút/lần)');
  wf.add('Mỗi 10 phút', 'n8n-nodes-base.scheduleTrigger', 1.2, { rule: { interval: [{ field: 'minutes', minutesInterval: 10 }] } }, [0, 400]);
  const q1 = exec(wf, 'Quét kho nhảy', 'ls -1 /files/03_KhoNhay', [200, 400], { executeOnce: true });
  const q2 = exec(wf, 'Quét người mẫu', 'ls -1 /files/00_NguoiMau', [400, 400], { executeOnce: true });
  const g1 = dtGetAll(wf, 'Đọc cấu hình', 'cau_hinh', [600, 400]);
  const g2 = dtGetAll(wf, 'Đọc mẫu đồ', 'mau_do', [800, 400]);
  const g3 = dtGetAll(wf, 'Đọc kho nhảy', 'kho_nhay', [1000, 400]);
  const g4 = dtGetAll(wf, 'Đọc hàng đợi', 'hang_doi', [1200, 400]);
  const plan = codeNode(wf, 'Kế hoạch', 'ke_hoach.js', [1400, 400], { executeOnce: false });
  const route = sw(wf, 'Phân việc', 4, '={{ $json.r }}', [1600, 400]);
  wf.chain('Mỗi 10 phút', q1, q2, g1, g2, g3, g4, plan, route);

  const W = dbWriter(wf, 4200, 0);
  wf.link(route, W, 0);

  // r = 1: đẩy file lên Higgsfield rồi gửi tạo
  const u1 = http(wf, 'HF xin link upload', {
    method: 'POST', url: '={{ $json.up_url }}',
    sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.up_body) }}',
  }, [1900, 400], HF);
  const u2 = wf.add('Đọc file cần đẩy', 'n8n-nodes-base.readWriteFile', 1.1,
    { operation: 'read', fileSelector: "={{ $('Phân việc').item.json.path }}", options: {} }, [2100, 400], { onError: 'continueRegularOutput' });
  const u3 = http(wf, 'HF đẩy file', {
    method: 'PUT', url: "={{ $('HF xin link upload').item.json.upload_url }}",
    sendHeaders: true, specifyHeaders: 'json',
    jsonHeaders: "={{ JSON.stringify($('HF xin link upload').item.json.upload_headers || { 'Content-Type': $('Phân việc').item.json.mime }) }}",
    sendBody: true, contentType: 'binaryData', inputDataFieldName: 'data',
    options: { timeout: 300000, response: { response: { responseFormat: 'text' } } },
  }, [2300, 400]);
  const u4 = codeNode(wf, 'Gom link upload', 'gom_upload.js', [2500, 400]);
  const u5 = sw(wf, 'Tách gửi', 2, '={{ $json.r }}', [2700, 400]);
  const u6 = http(wf, 'HF gửi tạo', {
    method: 'POST', url: '={{ $json.url }}',
    sendHeaders: true, specifyHeaders: 'keypair', headerParameters: { parameters: [{ name: 'Idempotency-Key', value: '={{ $json.sub.key }}' }] },
    sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.body) }}',
  }, [2900, 500], HF);
  const u7 = codeNode(wf, 'Kết quả gửi', 'ket_qua_gui.js', [3100, 500]);
  wf.link(route, u1, 1);
  wf.chain(u1, u2, u3, u4, u5);
  wf.link(u5, W, 0);
  wf.link(u5, u6, 1);
  wf.chain(u6, u7, W);

  // r = 2: hỏi trạng thái, tải kết quả về máy
  const p1 = http(wf, 'HF hỏi trạng thái', { method: 'GET', url: '={{ $json.status_url }}' }, [1700, 800], HF);
  // fal: xong thì lấy kết quả ở link riêng; Higgsfield: kết quả nằm sẵn trong trạng thái
  const p1b = http(wf, 'Lấy kết quả', {
    method: 'GET',
    url: "={{ $('Phân việc').item.json.fal && String($json.status || '').toUpperCase() === 'COMPLETED' ? $('Phân việc').item.json.status_url.replace(/\\/status$/, '') : $('Phân việc').item.json.status_url }}",
  }, [1900, 800], HF);
  const p2 = codeNode(wf, 'Xử lý trạng thái', 'xu_ly_trang_thai.js', [2100, 800]);
  const p3 = sw(wf, 'Tách tải', 2, '={{ $json.r }}', [2300, 800]);
  const p4 = exec(wf, 'Tạo thư mục kết quả', '=mkdir -p "{{ $json.dir }}"', [2500, 900]);
  const p5 = http(wf, 'Tải kết quả', {
    method: 'GET', url: "={{ $('Tách tải').item.json.url }}",
    options: { timeout: 300000, response: { response: { responseFormat: 'file' } } },
  }, [2700, 900]);
  const p6 = wf.add('Lưu kết quả vào máy', 'n8n-nodes-base.readWriteFile', 1.1,
    { operation: 'write', fileName: "={{ $('Tách tải').item.json.path }}", dataPropertyName: 'data', options: {} }, [2900, 900], { onError: 'continueRegularOutput' });
  const p7 = codeNode(wf, 'Sau khi tải', 'sau_khi_tai.js', [3100, 900]);
  wf.link(route, p1, 2);
  wf.chain(p1, p1b, p2, p3);
  wf.link(p3, W, 0);
  wf.link(p3, p4, 1);
  wf.chain(p4, p5, p6, p7, W);

  // r = 3: chuẩn bị ảnh, Claude chấm
  const c1 = exec(wf, 'Chuẩn bị ảnh cho Claude', '={{ $json.cmd }}', [1900, 1200]);
  const c2 = codeNode(wf, 'Kiểm tra chuẩn bị', 'kiem_chuan_bi.js', [2100, 1200]);
  const c3 = sw(wf, 'Tách QC', 2, '={{ $json.r }}', [2300, 1200]);
  const c4 = wf.add('Đọc ảnh đã chuẩn bị', 'n8n-nodes-base.readWriteFile', 1.1,
    { operation: 'read', fileSelector: '={{ $json.task.dir }}/*.jpg', options: {} }, [2500, 1300], { onError: 'continueRegularOutput' });
  const c5 = codeNode(wf, 'Gói yêu cầu Claude', 'goi_claude.js', [2700, 1300]);
  const c6 = http(wf, 'Claude chấm', {
    method: 'POST', url: '={{ $json.url }}',
    sendHeaders: true, specifyHeaders: 'json', jsonHeaders: '={{ JSON.stringify($json.headers) }}',
    sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.body) }}',
    options: { timeout: 300000 },
  }, [2900, 1300], CL);
  const c7 = codeNode(wf, 'Kết quả chấm', 'ket_qua_cham.js', [3100, 1300]);
  wf.link(route, c1, 3);
  wf.chain(c1, c2, c3);
  wf.link(c3, W, 0);
  wf.link(c3, c4, 1);
  wf.chain(c4, c5, c6, c7, W);
  return wf;
}

// =====================================================================
// 3. Báo cáo buổi sáng
// =====================================================================
function report() {
  const wf = new WF('VideoAI03BaoCao1', '3. Báo cáo buổi sáng (8h)');
  wf.add('8h sáng mỗi ngày', 'n8n-nodes-base.scheduleTrigger', 1.2, { rule: { interval: [{ field: 'days', triggerAtHour: 8 }] } }, [0, 300]);
  const g1 = dtGetAll(wf, 'Đọc cấu hình', 'cau_hinh', [200, 300]);
  const g2 = dtGetAll(wf, 'Đọc mẫu đồ', 'mau_do', [400, 300]);
  const g3 = dtGetAll(wf, 'Đọc kho nhảy', 'kho_nhay', [600, 300]);
  const g4 = dtGetAll(wf, 'Đọc hàng đợi', 'hang_doi', [800, 300]);
  const b = codeNode(wf, 'Lập báo cáo', 'bao_cao.js', [1000, 300], { executeOnce: true });
  const h = http(wf, 'Claude viết báo cáo', {
    method: 'POST', url: '={{ $json.url }}',
    sendHeaders: true, specifyHeaders: 'json', jsonHeaders: '={{ JSON.stringify($json.headers) }}',
    sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.body) }}',
    options: { timeout: 300000 },
  }, [1200, 300], CL);
  const w = codeNode(wf, 'Nội dung báo cáo', 'bao_cao_ghi.js', [1400, 300]);
  const ins = dtInsert(wf, 'Lưu báo cáo', 'bao_cao', [1600, 300]);
  wf.chain('8h sáng mỗi ngày', g1, g2, g3, g4, b, h, w, ins);
  return wf;
}

// Chế độ thử nghiệm: thêm cổng webhook để gọi từ ngoài
if (process.env.TEST) {
  const orig = WF.prototype.toJSON;
  WF.prototype.toJSON = function () {
    const trig = this.nodes.find((n) => /manualTrigger|scheduleTrigger/.test(n.type));
    if (trig && !this.nodes.find((n) => n.name === 'Webhook test')) {
      this.add('Webhook test', 'n8n-nodes-base.webhook', 2, { httpMethod: 'GET', path: 'test-' + this.id, responseMode: 'lastNode', options: {} }, [trig.position[0], trig.position[1] - 200], { webhookId: uuid('wh' + this.id) });
      (this.connections[trig.name].main[0] || []).forEach((c) => this.link('Webhook test', c.node));
    }
    return orig.call(this);
  };
}
fs.mkdirSync(OUT, { recursive: true });
const files = { '0-cai-dat.json': setup(), '1-form-them-mau.json': form(), '2-dong-co.json': engine(), '3-bao-cao.json': report() };
if (process.env.TEST) {
  const wf = new WF('VideoAI09Dump001', '9. Dump (thử nghiệm)');
  wf.add('Webhook dump', 'n8n-nodes-base.webhook', 2, { httpMethod: 'GET', path: 'dump', responseMode: 'lastNode', options: {} }, [0, 0], { webhookId: uuid('dump') });
  const names = ['cau_hinh', 'mau_do', 'kho_nhay', 'hang_doi', 'bao_cao'].map((t, i) => dtGetAll(wf, 'Đọc ' + t, t, [200 + i * 200, 0]));
  wf.add('Gộp', 'n8n-nodes-base.code', 2, { jsCode: "const o={};" + JSON.stringify(['cau_hinh', 'mau_do', 'kho_nhay', 'hang_doi', 'bao_cao']) + ".forEach(t=>{o[t]=$('Đọc '+t).all().map(i=>i.json).filter(r=>r.id!==undefined)});return [{json:o}];" }, [1300, 0], { executeOnce: true });
  wf.chain('Webhook dump', ...names, 'Gộp');
  files['9-dump.json'] = wf;
  const pw = new WF('VideoAI09Patch01', '9. Patch (thử nghiệm)');
  pw.add('Webhook patch', 'n8n-nodes-base.webhook', 2, { httpMethod: 'GET', path: 'patch', responseMode: 'lastNode', options: {} }, [0, 0], { webhookId: uuid('patch') });
  pw.add('Lệnh', 'n8n-nodes-base.code', 2, { jsCode: "const q=$input.first().json.query;const v=isNaN(Number(q.v))||q.v===''?q.v:Number(q.v);return [{json:{tbl:q.t,op:'update',data:{id:Number(q.id),[q.k]:v}}}];" }, [200, 0]);
  pw.link('Webhook patch', 'Lệnh');
  pw.link('Lệnh', dbWriter(pw, 400, 0));
  files['9-patch.json'] = pw;
}
for (const [f, wf] of Object.entries(files)) fs.writeFileSync(path.join(OUT, f), JSON.stringify(wf.toJSON(), null, 2));
console.log('built', Object.keys(files).join(', '), '->', OUT);

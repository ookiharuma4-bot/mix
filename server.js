// ミックス匿名掲示板のローカルサーバー
// 依存パッケージ不要（Node.js標準機能のみ）。データは同じフォルダの db.json に保存されます。
//
// 使い方: このフォルダで `node server.js` を実行し、表示されたアドレスにアクセスしてください。
 
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const url = require('url');
 
const PORT = process.env.PORT || 8787;
const DB_FILE = path.join(__dirname, 'db.json');
const PUBLIC_DIR = __dirname;
 
function loadDb(){
  try{
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  }catch(e){
    return {};
  }
}
 
function saveDb(db){
  fs.writeFileSync(DB_FILE, JSON.stringify(db), 'utf8');
}
 
function sendJson(res, status, obj){
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(body);
}
 
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};
 
function serveStatic(req, res, pathname){
  let rel = pathname === '/' ? 'index.html' : pathname;
  let filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if(!filePath.startsWith(PUBLIC_DIR)){
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.readFile(filePath, (err, data) => {
    if(err){ res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}
 
function getLocalIps(){
  const ifaces = os.networkInterfaces();
  const ips = [];
  Object.keys(ifaces).forEach(name => {
    (ifaces[name] || []).forEach(iface => {
      if(iface.family === 'IPv4' && !iface.internal){ ips.push(iface.address); }
    });
  });
  return ips;
}
 
const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;
 
  if(req.method === 'OPTIONS'){
    sendJson(res, 204, {});
    return;
  }
 
  if(pathname === '/api/storage/list' && req.method === 'GET'){
    const prefix = parsed.query.prefix || '';
    const db = loadDb();
    const keys = Object.keys(db).filter(k => k.startsWith(prefix));
    sendJson(res, 200, { keys, prefix: prefix || undefined, shared: true });
    return;
  }
 
  if(pathname === '/api/storage' && req.method === 'GET'){
    const key = parsed.query.key;
    if(!key){ sendJson(res, 400, { error: 'key required' }); return; }
    const db = loadDb();
    if(!(key in db)){ sendJson(res, 404, { error: 'not found' }); return; }
    sendJson(res, 200, { key, value: db[key], shared: true });
    return;
  }
 
  if(pathname === '/api/storage' && req.method === 'POST'){
    let body = '';
    let tooLarge = false;
    req.on('data', chunk => {
      body += chunk;
      if(body.length > 15 * 1024 * 1024){ tooLarge = true; req.destroy(); }
    });
    req.on('end', () => {
      if(tooLarge){ sendJson(res, 413, { error: 'payload too large' }); return; }
      try{
        const parsedBody = JSON.parse(body);
        const key = parsedBody.key;
        const value = parsedBody.value;
        if(!key){ sendJson(res, 400, { error: 'key required' }); return; }
        const db = loadDb();
        db[key] = value;
        saveDb(db);
        sendJson(res, 200, { key, value, shared: true });
      }catch(e){
        sendJson(res, 400, { error: 'invalid body' });
      }
    });
    return;
  }
 
  if(pathname === '/api/storage' && req.method === 'DELETE'){
    const key = parsed.query.key;
    if(!key){ sendJson(res, 400, { error: 'key required' }); return; }
    const db = loadDb();
    const existed = key in db;
    delete db[key];
    saveDb(db);
    sendJson(res, 200, { key, deleted: existed, shared: true });
    return;
  }
 
  serveStatic(req, res, pathname);
});
 
server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('=================================================');
  console.log('  ミックス サーバーが起動しました');
  console.log('=================================================');
  console.log('  このパソコンで開く場合:');
  console.log('    http://localhost:' + PORT);
  console.log('');
  console.log('  同じWi-Fi内のスマホから開く場合（いずれかのIP）:');
  getLocalIps().forEach(ip => console.log('    http://' + ip + ':' + PORT));
  console.log('');
  console.log('  データは同じフォルダの db.json に保存されます。');
  console.log('  終了するには Ctrl+C を押してください。');
  console.log('=================================================');
});

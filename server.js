const express=require('express'),http=require('http'),fs=require('fs'),path=require('path'),multer=require('multer'),crypto=require('crypto');
const {Server}=require('socket.io');
const PORT=process.env.PORT||3000, DATA=path.join(__dirname,'data','markers.json'), UP=path.join(__dirname,'uploads');
fs.mkdirSync(UP,{recursive:true});fs.mkdirSync(path.dirname(DATA),{recursive:true});
let markers=fs.existsSync(DATA)?JSON.parse(fs.readFileSync(DATA)):[];
const save=()=>fs.writeFileSync(DATA,JSON.stringify(markers,null,1));
const app=express(),server=http.createServer(app),io=new Server(server);
app.use(express.json());app.use(express.static(path.join(__dirname,'public')));app.use('/uploads',express.static(UP));
const upload=multer({storage:multer.diskStorage({destination:UP,filename:(q,f,cb)=>cb(null,Date.now()+'-'+crypto.randomBytes(4).toString('hex')+path.extname(f.originalname||'.jpg').toLowerCase())}),
 limits:{files:5,fileSize:15*1024*1024},fileFilter:(q,f,cb)=>cb(null,/^image\//.test(f.mimetype))});
const active=()=>markers.filter(m=>m.status==='open'||m.status==='enroute');
app.get('/api/markers',(q,r)=>r.json(active()));
app.post('/api/markers',upload.array('photos',5),(q,r)=>{
 const lat=+q.body.lat,lng=+q.body.lng; if(!isFinite(lat)||!isFinite(lng))return r.status(400).json({error:'bad location'});
 const m={id:crypto.randomUUID(),lat,lng,notes:(q.body.notes||'').slice(0,1000),scout:(q.body.scout||'Scout').slice(0,50),
  photos:(q.files||[]).map(f=>'/uploads/'+f.filename),status:'open',enrouteBy:null,createdAt:Date.now()};
 markers.push(m);save();io.emit('marker:new',m);r.json(m);});
app.post('/api/markers/:id/enroute',(q,r)=>{
 const m=markers.find(x=>x.id===q.params.id);if(!m||!['open','enroute'].includes(m.status))return r.status(404).json({error:'Marker no longer active'});
 const d=(q.body.driver||'').slice(0,50);
 if(m.status==='enroute'&&m.enrouteBy!==d)return r.status(409).json({error:`A driver is already in route (${m.enrouteBy})`});
 m.status='enroute';m.enrouteBy=d;m.enrouteAt=Date.now();save();io.emit('marker:update',m);r.json(m);});
app.post('/api/markers/:id/release',(q,r)=>{
 const m=markers.find(x=>x.id===q.params.id);if(!m||m.status!=='enroute'||m.enrouteBy!==q.body.driver)return r.status(400).json({error:'Not your claim'});
 m.status='open';m.enrouteBy=null;save();io.emit('marker:update',m);r.json(m);});
app.post('/api/markers/:id/close',(q,r)=>{
 const m=markers.find(x=>x.id===q.params.id);if(!m||!['open','enroute'].includes(m.status))return r.status(404).json({error:'Marker no longer active'});
 const st=q.body.reason==='gone'?'gone':'taken',d=q.body.driver||'';
 if(m.status==='enroute'&&m.enrouteBy!==d)return r.status(409).json({error:`A driver is already in route (${m.enrouteBy})`});
 m.status=st;m.closedBy=d;m.closedAt=Date.now();save();io.emit('marker:remove',{id:m.id,status:st,by:d});r.json({ok:true});});
app.use((e,q,r,n)=>r.status(400).json({error:e.message}));
server.listen(PORT,'0.0.0.0',()=>console.log('Tow Scout on http://localhost:'+PORT));

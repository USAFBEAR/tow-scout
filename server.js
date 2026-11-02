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
const EV=path.join(__dirname,'data','events.json');
let events=fs.existsSync(EV)?JSON.parse(fs.readFileSync(EV)):[];
const logE=(type,o={})=>{events.push({t:Date.now(),type,...o});fs.writeFileSync(EV,JSON.stringify(events));io.emit('stats:changed')};
const ACTIVE=['open','enroute','hooked'];
const active=()=>markers.filter(m=>ACTIVE.includes(m.status));
const find=(q,r)=>{const m=markers.find(x=>x.id===q.params.id);if(!m||!ACTIVE.includes(m.status)){r.status(404).json({error:'Marker no longer active'});return null}return m};
const mine=(m,d,r)=>{if(m.status!=='open'&&m.enrouteBy&&m.enrouteBy!==d){r.status(409).json({error:`Claimed by ${m.enrouteBy}`});return false}return true};
app.get('/api/markers',(q,r)=>r.json(active()));
app.post('/api/markers',upload.array('photos',5),(q,r)=>{
 const lat=+q.body.lat,lng=+q.body.lng; if(!isFinite(lat)||!isFinite(lng))return r.status(400).json({error:'bad location'});
 const m={id:crypto.randomUUID(),lat,lng,notes:(q.body.notes||'').slice(0,1000),scout:(q.body.scout||'Scout').slice(0,50),
  photos:(q.files||[]).map(f=>'/uploads/'+f.filename),status:'open',enrouteBy:null,createdAt:Date.now()};
 markers.push(m);save();io.emit('marker:new',m);logE('create',{id:m.id,scout:m.scout});r.json(m);});
app.post('/api/markers/:id/enroute',(q,r)=>{const m=find(q,r);if(!m)return;const d=(q.body.driver||'').slice(0,50);if(!mine(m,d,r))return;
 if(m.status==='open'){m.status='enroute';m.enrouteBy=d;m.assignedDriver=d;m.enrouteAt=m.claimedAt=Date.now();
  if(!m.firstClaimedAt){m.firstClaimedAt=m.claimedAt;m.grabMs=m.claimedAt-m.createdAt}save();logE('claim',{id:m.id,driver:d})}
 io.emit('marker:update',m);r.json(m);});
app.post('/api/markers/:id/release',(q,r)=>{const m=find(q,r);if(!m)return;const d=q.body.driver;
 if(m.status==='open'||m.enrouteBy!==d)return r.status(400).json({error:'Not your claim'});
 m.status='open';m.enrouteBy=null;m.hookedAt=null;save();logE('release',{id:m.id,driver:d});io.emit('marker:update',m);r.json(m);});
app.post('/api/markers/:id/hooked',(q,r)=>{const m=find(q,r);if(!m)return;const d=(q.body.driver||'').slice(0,50);if(!mine(m,d,r))return;
 const now=Date.now();if(m.status==='open'){m.enrouteBy=d;m.assignedDriver=d;m.claimedAt=m.enrouteAt=now;if(!m.firstClaimedAt){m.firstClaimedAt=now;m.grabMs=now-m.createdAt}}
 m.status='hooked';m.hookedAt=now;save();logE('hook',{id:m.id,driver:d});io.emit('marker:update',m);r.json(m);});
app.post('/api/markers/:id/close',(q,r)=>{const m=find(q,r);if(!m)return;const d=(q.body.driver||'').slice(0,50);if(!mine(m,d,r))return;
 let st={gone:'lost',lost:'lost',wot:'wot',taken:'secured',secured:'secured',dropped:'dropped'}[q.body.reason];if(!st)return r.status(400).json({error:'bad reason'});const now=Date.now();
 if(st==='secured'||st==='dropped'){m[st+'At']=now;if(!m.hookedAt)m.hookedAt=now;if(!m.claimedAt){m.claimedAt=now;m.firstClaimedAt=m.firstClaimedAt||now;m.grabMs=m.grabMs??now-m.createdAt}}
 m.status=st;m.closeReason=st;m.closedBy=d;m.assignedDriver=m.assignedDriver||d;m.closedAt=now;m.markToCloseMs=now-m.createdAt;
 if(m.claimedAt)m.claimToCloseMs=now-m.claimedAt;save();logE('close',{id:m.id,driver:d,reason:st});
 io.emit('marker:remove',{id:m.id,status:st,by:d});r.json({ok:true});});
// presence for idle metric
const online={};
let sessions=[];const SE=path.join(__dirname,'data','sessions.json');try{sessions=JSON.parse(fs.readFileSync(SE))}catch{}
const now0=Date.now();sessions.forEach(x=>{if(!x.end){x.end=now0;x.note='server restart'}});
const saveS=()=>{fs.writeFileSync(SE,JSON.stringify(sessions.slice(-5000)));io.emit('stats:changed')};
// close driver presence left open by a previous run
{const o={};for(const e of events){if(e.type==='online')o[e.driver]=1;if(e.type==='offline')delete o[e.driver]}for(const d in o)events.push({t:now0,type:'offline',driver:d})}
function bye(s){if(s.sess){s.sess.end=Date.now();s.sess=null;saveS()}if(s.drv){if(--online[s.drv]===0)logE('offline',{driver:s.drv});s.drv=null}}
io.on('connection',s=>{s.on('hello',u=>{if(!u||!u.name)return;const name=String(u.name).slice(0,50),role=['scout','driver','manager'].includes(u.role)?u.role:'?';
  if(s.sess&&s.sess.name===name&&s.sess.role===role)return;bye(s);
  s.sess={id:crypto.randomUUID(),name,role,start:Date.now(),end:null};sessions.push(s.sess);saveS();
  if(role==='driver'){s.drv=name;online[name]=(online[name]||0)+1;if(online[name]===1)logE('online',{driver:name})}});
 s.on('disconnect',()=>bye(s))});
const avg=a=>a.length?Math.round(a.reduce((x,y)=>x+y,0)/a.length):null,med=a=>{if(!a.length)return null;a=[...a].sort((x,y)=>x-y);return a[a.length>>1]};
function stats(){
 const sc={},dr={};const D=n=>dr[n]??=({name:n,secured:0,dropped:0,hooked:0,enroute:0,lost:0,wot:0,idleMs:0,engagedMs:0,onlineMs:0,idleSpells:0,longestIdleMs:0});
 for(const m of markers){const s=sc[m.scout]??=({name:m.scout,marks:0,open:0,towed:0,dropped:0,lost:0,wot:0,grab:[],lostMark:[],lostClaim:[]});s.marks++;
  if(m.grabMs!=null)s.grab.push(m.grabMs);
  if(ACTIVE.includes(m.status))s.open++;
  if(m.status==='secured'||m.status==='taken')s.towed++;if(m.status==='dropped')s.dropped++;
  if(m.status==='lost'||m.status==='gone'){s.lost++;s.lostMark.push(m.markToCloseMs??(m.closedAt-m.createdAt));if(m.claimToCloseMs!=null)s.lostClaim.push(m.claimToCloseMs)}
  if(m.status==='wot')s.wot++;
  const d=m.assignedDriver||m.enrouteBy||m.closedBy;if(d){const x=D(d);
   if(m.status==='secured'||m.status==='taken')x.secured++;else if(['dropped','hooked','enroute','lost','wot'].includes(m.status))x[m.status]++;else if(m.status==='gone')x.lost++}}
 // replay events
 const st={},on={},eng={};let last=null,idleNow={},idleStart={};
 const tick=t=>{if(last!=null){const dt=t-last,openN=Object.values(st).filter(v=>v==='open').length;
   for(const d in on)if(on[d]){const x=D(d);x.onlineMs+=dt;if(eng[d]>0)x.engagedMs+=dt;else if(openN>0)x.idleMs+=dt}}last=t;
  const openN=Object.values(st).filter(v=>v==='open').length;for(const d in on){const i=on[d]&&!(eng[d]>0)&&openN>0;if(i&&!idleNow[d]){D(d).idleSpells++;idleStart[d]=t}if(!i&&idleNow[d]){const x=D(d);x.longestIdleMs=Math.max(x.longestIdleMs,t-idleStart[d])}idleNow[d]=i}};
 const own={};
 for(const e of events){tick(e.t);
  if(e.type==='create')st[e.id]='open';
  else if(e.type==='claim'){st[e.id]='claimed';own[e.id]=e.driver;eng[e.driver]=(eng[e.driver]||0)+1}
  else if(e.type==='hook'){if(st[e.id]!=='claimed'){eng[e.driver]=(eng[e.driver]||0)+1;own[e.id]=e.driver}st[e.id]='claimed'}
  else if(e.type==='release'||e.type==='close'){if(st[e.id]==='claimed'&&own[e.id])eng[own[e.id]]--;if(e.type==='release')st[e.id]='open';else delete st[e.id];delete own[e.id]}
  else if(e.type==='online')on[e.driver]=true;else if(e.type==='offline')on[e.driver]=false;tick(e.t)}
 tick(Date.now());for(const d in idleNow)if(idleNow[d]){const x=D(d);x.longestIdleMs=Math.max(x.longestIdleMs,Date.now()-idleStart[d])}
 return {now:Date.now(),open:active().length,
  scouts:Object.values(sc).map(s=>({name:s.name,marks:s.marks,open:s.open,towed:s.towed,dropped:s.dropped,lost:s.lost,wot:s.wot,grabbed:s.grab.length,avgGrabMs:avg(s.grab),medGrabMs:med(s.grab),avgLostMarkMs:avg(s.lostMark),avgLostClaimMs:avg(s.lostClaim)})),
  drivers:Object.values(dr).map(d=>({...d,online:!!online[d.name],longestIdleMs:d.longestIdleMs>60000?d.longestIdleMs:null,idleNow:!!idleNow[d.name]&&online[d.name]>0})),
  lost:markers.filter(m=>m.status==='lost'||m.status==='gone').slice(-50).reverse().map(m=>({scout:m.scout,driver:m.closedBy,createdAt:m.createdAt,markToCloseMs:m.markToCloseMs??(m.closedAt-m.createdAt),claimToCloseMs:m.claimToCloseMs??null,grabMs:m.grabMs??null,notes:m.notes}))}}
app.get('/api/marks',(q,r)=>r.json([...markers].sort((a,b)=>b.createdAt-a.createdAt)));
app.get('/api/sessions',(q,r)=>r.json([...sessions].reverse().slice(0,2000)));
app.get('/api/stats',(q,r)=>r.json(stats()));
app.use((e,q,r,n)=>r.status(400).json({error:e.message}));
server.listen(PORT,'0.0.0.0',()=>console.log('Tow Scout on http://localhost:'+PORT));

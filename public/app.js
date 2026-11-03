const allM={};const DEF=[29.4477,-82.6423];let user=JSON.parse(localStorage.getItem('ts_user')||'null');
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';');
const map=L.map('map').setView(DEF,14);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
const icon=c=>L.divIcon({className:'',html:`<div style="width:22px;height:22px;border-radius:50%;background:${c};border:3px solid #fff;box-shadow:0 0 6px #000"></div>`,iconSize:[22,22],iconAnchor:[11,11]});
const markers={},layers={};let prov=null,notifs=JSON.parse(localStorage.getItem('ts_notifs')||'[]');
const gmaps=m=>`https://www.google.com/maps?q=${m.lat},${m.lng}`;
function toast(t,cls='',onclick){const d=document.createElement('div');d.className='toast '+cls;d.textContent=t;d.onclick=()=>{onclick&&onclick();d.remove()};$('#toasts').append(d);setTimeout(()=>d.remove(),onclick?12000:4000)}
function setUser(u){user=u;localStorage.setItem('ts_user',JSON.stringify(u));document.body.className=u.role;
 $('#who').innerHTML=`${esc(u.name)}<span class="tag ${u.role}">${{scout:'Scout',driver:'Tow Driver',manager:'Manager',dispatch:'Dispatch'}[u.role]}</span>`;
 $('#bell').classList.toggle('hidden',u.role!=='driver');$('#gng').classList.toggle('hidden',u.role!=='driver');$('#disp').classList.toggle('hidden',u.role!=='dispatch');$('#legend').classList.toggle('hidden',!['dispatch','manager'].includes(u.role));setTimeout(()=>{if(u.role!=='dispatch')clearDrv();if(u.role==='dispatch')map.setView(map.getCenter(),11);startLoc();try{sock.emit('hello',u)}catch{}},0);$('#hint').classList.toggle('hidden',u.role!=='scout');
 $('#ltitle').textContent=u.role==='scout'?'My open marks':u.role==='driver'?'Available & my tows':'Open spots';$('#hint').textContent='Tap the map where the vehicle is parked';$('#login').classList.add('hidden');$('#mgr').classList.toggle('hidden',u.role!=='manager');$('#main').classList.toggle('hidden',u.role==='manager');if(u.role==='manager')setTimeout(loadStats,0);else setTimeout(()=>map.invalidateSize(),50);try{sock.emit('hello',u)}catch{}renderAll();renderNotifs()}
document.querySelectorAll('#login [data-role]').forEach(b=>b.onclick=()=>{const n=$('#name').value.trim();if(!n)return $('#name').focus();setUser({name:n,role:b.dataset.role})});
$('#switch').onclick=()=>{$('#name').value=user?.name||'';$('#login').classList.remove('hidden')};
if(user)setUser(user);else $('#login').classList.remove('hidden');
navigator.geolocation?.getCurrentPosition(p=>{map.setView([p.coords.latitude,p.coords.longitude],15);L.circleMarker([p.coords.latitude,p.coords.longitude],{radius:6,color:'#56ccf2'}).addTo(map).bindTooltip('You')},()=>{},{timeout:8000});
function popup(m){const g=m.photos.map(p=>`<img src="${p}" onclick="lb('${p}')">`).join('');
 let a='';const info=`${m.source==='dispatch'?'<small>📞 Dispatch</small><br>':m.source==='grabgo'?'<small>🪝 Grab&amp;Go</small><br>':''}${m.address?'<small>'+esc(m.address)+'</small><br>':''}${m.contactName||m.contactPhone?`<small>👤 ${esc(m.contactName)} ${m.contactPhone?`<a href="tel:${esc(m.contactPhone)}">${esc(m.contactPhone)}</a>`:''}</small><br>`:''}`;if(user?.role==='driver'){const me=m.enrouteBy===user.name;
  if(m.status==='open')a=`<button class="driver" onclick="act('${m.id}','enroute')">🚚 In route</button><button onclick="act('${m.id}','hooked')">🪝 Hooked</button>`;
  else if(me&&m.status==='enroute')a=`<button onclick="act('${m.id}','hooked')">🪝 Hooked</button><button onclick="act('${m.id}','release')">Release</button>`;
  else if(me&&m.status==='hooked')a=`<button class="ok" onclick="act('${m.id}','secured')">🏁 Secured (yard)</button><button class="drop" onclick="act('${m.id}','dropped')">💵 Dropped (paid/legal)</button><button onclick="act('${m.id}','release')">Release</button>`;
  if(m.status==='open'||me){if(m.status!=='hooked')a+=`<br><button class="danger" onclick="act('${m.id}','lost')">❌ Lost (not there)</button><button class="wot" onclick="act('${m.id}','wot')">⚖️ WOT (legal)</button>`}
  else a=`<small>Claimed by another driver</small>`}
 return `<div class="pop"><b>${lbl(m)}</b><br><small>By ${esc(m.scout)} · ${new Date(m.createdAt).toLocaleString()}</small>
 ${info}${m.notes?`<p>${esc(m.notes)}</p>`:''}<div class="gallery">${g}</div><p><a href="${gmaps(m)}" target="_blank" rel="noopener">📍 Open in Google Maps</a></p>${a}</div>`}
const who=m=>user?.role==='dispatch'?': '+esc(m.enrouteBy):m.enrouteBy===user?.name&&user?.role==='driver'?' (you)':'';
const lbl=m=>m.status==='enroute'?'🟡 In route'+who(m):m.status==='hooked'?'🟣 Hooked'+who(m):'🔴 Open';
const vis=m=>user?.role==='scout'?m.scout===user.name&&m.source!=='grabgo':user?.role==='driver'?!m.enrouteBy||m.enrouteBy===user.name:true;
function renderMarker(m){allM[m.id]=m;if(!vis(m)){if(layers[m.id]||markers[m.id])hideM(m.id);return}markers[m.id]=m;const c={enroute:'#f2c94c',hooked:'#9b51e0'}[m.status]||'#e74c3c';
 if(layers[m.id]){layers[m.id].setIcon(icon(c));layers[m.id].setPopupContent(popup(m))}else layers[m.id]=L.marker([m.lat,m.lng],{icon:icon(c)}).addTo(map).bindPopup(popup(m),{maxWidth:280});renderList()}
function hideM(id){if(layers[id]){map.removeLayer(layers[id]);delete layers[id]}delete markers[id];renderList()}
function removeMarker(id){delete allM[id];if(layers[id]){map.removeLayer(layers[id]);delete layers[id]}delete markers[id];renderList()}
function renderAll(){Object.values(allM).forEach(renderMarker);renderList()}
function renderList(){const a=Object.values(markers).sort((x,y)=>y.createdAt-x.createdAt);$('#count').textContent=a.length;
 $('#list').innerHTML=a.map(m=>`<div class="item ${m.status}" onclick="focusM('${m.id}')"><b>${lbl(m)}</b> ${m.photos.length?'📷'+m.photos.length:''}<br>${esc(m.notes||'No notes')}<br><small>${esc(m.scout)} · ${new Date(m.createdAt).toLocaleTimeString()}</small></div>`).join('')||'<small>No open spots</small>'}
window.focusM=id=>{const m=markers[id];if(!m)return toast('That spot was already cleared','info');map.setView([m.lat,m.lng],17);layers[id].openPopup()};
window.lb=src=>{$('#lightbox img').src=src;$('#lightbox').classList.remove('hidden')};$('#lightbox').onclick=()=>$('#lightbox').classList.add('hidden');
window.act=async(id,a)=>{const url=['secured','dropped','lost','wot'].includes(a)?`/api/markers/${id}/close`:`/api/markers/${id}/${a}`;
 const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({driver:user.name,reason:a})});const j=await r.json();
 if(!r.ok)return alert(j.error);if(a==='enroute')toast('You are in route. Others will see this spot is claimed.','info')};
// scout placing
map.on('click',e=>{if(user?.role==='dispatch')return setDisp(e.latlng);if(user?.role!=='scout')return;if(prov)map.removeLayer(prov);prov=L.marker(e.latlng,{icon:icon('#2d9cdb'),draggable:true}).addTo(map);openForm()});
let files=[];function openForm(){files=[];$('#notes').value='';$('#photos').value='';$('#previews').innerHTML='';showLoc();$('#form').classList.remove('hidden')}
function showLoc(){const p=prov.getLatLng();$('#loc').textContent=`📍 ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`}
$('#photos').onchange=e=>{for(const f of e.target.files){if(files.length>=5){alert('Max 5 photos');break}files.push(f)}e.target.value='';
 $('#previews').innerHTML='';files.forEach((f,i)=>{const im=document.createElement('img');im.src=URL.createObjectURL(f);im.title='Tap to remove';im.onclick=()=>{files.splice(i,1);$('#photos').onchange({target:{files:[],value:''}})};$('#previews').append(im)})};
$('#cancel').onclick=()=>{$('#form').classList.add('hidden');if(prov){map.removeLayer(prov);prov=null}};
$('#submit').onclick=async()=>{const p=prov.getLatLng(),fd=new FormData();fd.append('lat',p.lat);fd.append('lng',p.lng);fd.append('notes',$('#notes').value);fd.append('scout',user.name);files.forEach(f=>fd.append('photos',f));
 $('#submit').disabled=true;$('#submit').textContent='Sending…';
 try{const r=await fetch('/api/markers',{method:'POST',body:fd});const j=await r.json();if(!r.ok)throw new Error(j.error);
  $('#form').classList.add('hidden');map.removeLayer(prov);prov=null;toast('Sent to all drivers ✅','info')}catch(e){alert('Failed: '+e.message)}
 $('#submit').disabled=false;$('#submit').textContent='Send to drivers'};
// notifications (drivers only)
function saveN(){localStorage.setItem('ts_notifs',JSON.stringify(notifs.slice(0,100)));renderNotifs()}
function renderNotifs(){const u=notifs.filter(n=>!n.read).length;$('#badge').textContent=u;$('#badge').style.display=u?'':'none';
 $('#nlist').innerHTML=notifs.map(n=>`<div class="nitem ${n.read?'':'unread'}" onclick="openN('${n.id}')">🚩 ${esc(n.text)}<br><small>${new Date(n.t).toLocaleString()}</small></div>`).join('')||'<small>No alerts</small>'}
window.openN=id=>{const n=notifs.find(x=>x.id===id);if(n){n.read=true;saveN()}$('#notifs').classList.add('hidden');focusM(id)};
$('#bell').onclick=()=>$('#notifs').classList.remove('hidden');$('#nclose').onclick=()=>$('#notifs').classList.add('hidden');$('#nclear').onclick=()=>{notifs=[];saveN()};
function alertDriver(m){const text=`New vehicle by ${m.scout}${m.notes?': '+m.notes.slice(0,60):''}${m.photos.length?' 📷'+m.photos.length:''}`;
 notifs.unshift({id:m.id,text,t:Date.now(),read:false});saveN();toast('🚨 '+text+' — tap to view','',()=>openN(m.id));
 try{navigator.vibrate?.([200,100,200]);const c=new AudioContext(),o=c.createOscillator();o.connect(c.destination);o.frequency.value=880;o.start();o.stop(c.currentTime+.3)}catch{}
 if('Notification'in window&&Notification.permission==='granted'&&document.hidden){const x=new Notification('Tow Scout: new vehicle',{body:text});x.onclick=()=>{window.focus();openN(m.id)}}}
document.addEventListener('click',()=>{if(user?.role==='driver'&&'Notification'in window&&Notification.permission==='default')Notification.requestPermission()},{once:true});
// sync
const sock=io();
sock.on('connect',async()=>{if(user)sock.emit('hello',user);const a=await (await fetch('/api/markers')).json();Object.keys(allM).forEach(id=>{if(!a.find(m=>m.id===id))removeMarker(id)});a.forEach(renderMarker)});
sock.on('marker:new',m=>{renderMarker(m);if(user?.role==='driver')alertDriver(m)});
sock.on('marker:update',m=>{renderMarker(m);if(layers[m.id]?.isPopupOpen())layers[m.id].setPopupContent(popup(m))});
sock.on('marker:remove',({id,status,by})=>{const was=markers[id];removeMarker(id);if(was&&(user?.role==='dispatch'||(user?.role==='driver'&&by===user.name)))toast(`Spot ${{secured:'secured to yard',dropped:'dropped (paid/legal)',lost:'lost (not there)',wot:'WOT (legal)'}[status]||status}${user.role==='dispatch'?' by '+by:''}`,'info')});

// manager
const fm=ms=>{if(ms==null)return '—';const s=Math.round(ms/1000);if(s<60)return s+'s';const m=Math.round(s/60);if(m<60)return m+'m';return (m/60).toFixed(1)+'h'};
let stT;sock.on('stats:changed',()=>{if(user?.role==='manager'){clearTimeout(stT);stT=setTimeout(()=>{const t=document.querySelector('#mtabs .on')?.dataset.t;if(t==='stats')loadStats();if(t==='sess')loadSess();if(t==='marks'&&$('#mdetail').classList.contains('hidden'))loadMarks()},500)}});
setInterval(()=>{if(user?.role==='manager')loadStats()},30000);
async function loadStats(){const s=await (await fetch('/api/stats')).json();
 const d=s.drivers.sort((a,b)=>b.secured-a.secured),c=s.scouts.sort((a,b)=>b.marks-a.marks);
 $('#mgrbody').innerHTML=`<p><small>Open marks now: ${s.open} · updated ${new Date(s.now).toLocaleTimeString()}</small></p>
 <h3>🚚 Drivers</h3>${d.map(x=>`<div class="sc"><b>${esc(x.name)}</b> ${x.online?'🟢':'⚪'}<div class="g">
 <span>Tows secured<b>${x.secured}</b></span><span>Dropped (paid/legal)<b>${x.dropped}</b></span><span>Hooked now<b>${x.hooked}</b></span><span>In route<b>${x.enroute}</b></span><span>Lost<b>${x.lost}</b></span><span>WOT<b>${x.wot}</b></span>
 <span class="${x.longestIdleMs?'warn':''}">Longest idle w/ mark available (&gt;1m)<b>${fm(x.longestIdleMs)}</b></span><span>Idle now<b>${x.idleNow?'⚠️ yes':'no'}</b></span><span>Engaged<b>${fm(x.engagedMs)}</b></span><span>Online<b>${fm(x.onlineMs)}</b></span></div></div>`).join('')||'<small>No driver activity yet</small>'}
 <h3>🔭 Scouts</h3>${c.map(x=>`<div class="sc"><b>${esc(x.name)}</b><div class="g">
 <span>Marks<b>${x.marks}</b></span><span>Secured (towed)<b>${x.towed}</b></span><span>Dropped<b>${x.dropped}</b></span><span>Lost<b>${x.lost}</b></span><span>WOT<b>${x.wot}</b></span><span>Open<b>${x.open}</b></span>
 <span>Tow rate<b>${x.marks?Math.round(100*x.towed/x.marks)+'%':'—'}</b></span><span>Avg grab<b>${fm(x.avgGrabMs)}</b></span><span>Median grab<b>${fm(x.medGrabMs)}</b></span>
 <span>Lost: mark→lost<b>${fm(x.avgLostMarkMs)}</b></span><span>Lost: claim→lost<b>${fm(x.avgLostClaimMs)}</b></span></div></div>`).join('')||'<small>No marks yet</small>'}
 <h3>❌ Recent lost marks</h3>${s.lost.map(l=>`<div class="sc"><small>${new Date(l.createdAt).toLocaleString()} · scout ${esc(l.scout)} · driver ${esc(l.driver)}</small><br>Mark→lost <b>${fm(l.markToCloseMs)}</b> · grab <b>${fm(l.grabMs)}</b> · claim→lost <b>${fm(l.claimToCloseMs)}</b>${l.notes?'<br><small>'+esc(l.notes)+'</small>':''}</div>`).join('')||'<small>None</small>'}`}
$('#mgrref').onclick=()=>mtab(document.querySelector('#mtabs .on')?.dataset.t||'stats');

// manager tabs: marks timeline + sessions
const tm=t=>t?new Date(t).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}):'—',dt=t=>new Date(t).toLocaleDateString();
const OUT={secured:'🏁 SECURED',dropped:'💵 DROPPED',lost:'❌ LOST',wot:'⚖️ WOT',taken:'🏁 SECURED',gone:'❌ LOST',open:'🔴 Open',enroute:'🟡 In route',hooked:'🟣 Hooked'};
let allMarks=[];window.mtab=async t=>{document.querySelectorAll('#mtabs button').forEach(b=>b.classList.toggle('on',b.dataset.t===t));
 ['mgrbody','mmarks','msess','mdetail'].forEach(i=>$('#'+i).classList.toggle('hidden',i!==({stats:'mgrbody',marks:'mmarks',sess:'msess'}[t])));
 if(t==='stats')loadStats();if(t==='marks')loadMarks();if(t==='sess')loadSess()};
async function loadMarks(){allMarks=await (await fetch('/api/marks')).json();let day='';
 $('#mmarks').innerHTML=allMarks.map(m=>{const d=dt(m.createdAt),h=d!==day?`<h3>${day=d}</h3>`:'';
  return h+`<div class="sc" onclick="mdet('${m.id}')"><b>${OUT[m.status]||m.status}</b> · ${tm(m.createdAt)} · ${esc(m.scout)}${m.assignedDriver?' → '+esc(m.assignedDriver):''} ${m.photos.length?'📷'+m.photos.length:''}<br><small>${m.grabMs!=null?'WTF '+fm(m.grabMs):'not grabbed'}${m.notes?' · '+esc(m.notes.slice(0,50)):''}</small></div>`}).join('')||'<small>No marks yet</small>'}
window.mdet=id=>{const m=allMarks.find(x=>x.id===id);if(!m)return;const end=m.securedAt||m.droppedAt||m.closedAt;
 const row=(k,v)=>v?`<tr><td>${k}</td><td>${v}</td></tr>`:'';
 $('#mdetail').innerHTML=`<button onclick="mtab('marks')">← All marks</button><h3>${OUT[m.status]||m.status}</h3><table class="tl">
 ${row('Marked',tm(m.createdAt)+' '+dt(m.createdAt)+' by '+esc(m.scout)+' <small>('+({dispatch:'Dispatch',grabgo:'Grab&amp;Go self-spot'}[m.source]||'Scout')+')</small>')}
 ${row('Address',esc(m.address))}${row('Contact',esc(m.contactName))}${row('Phone',m.contactPhone&&`<a href="tel:${esc(m.contactPhone)}">${esc(m.contactPhone)}</a>`)}
 ${row('Grabbed',m.firstClaimedAt&&`${tm(m.firstClaimedAt)} — <b>${fm(m.grabMs)} WTF</b> by ${esc(m.assignedDriver)}`)}
 ${row('In route',m.enrouteAt&&m.enrouteAt!==m.firstClaimedAt?tm(m.enrouteAt):'')}
 ${row('Picked up / Hooked',m.hookedAt&&`${tm(m.hookedAt)}${m.firstClaimedAt?' ('+fm(m.hookedAt-m.firstClaimedAt)+' after grab)':''}`)}
 ${row(OUT[m.closeReason]||'',m.closedAt&&`${tm(end)} by ${esc(m.closedBy)} (${fm(m.closedAt-m.createdAt)} after mark)`)}
 </table>${m.notes?`<p>${esc(m.notes)}</p>`:''}<div class="gallery">${m.photos.map(p=>`<img src="${p}" onclick="lb('${p}')">`).join('')}</div>
 <p><a href="${gmaps(m)}" target="_blank" rel="noopener">📍 Location</a></p>`;
 $('#mmarks').classList.add('hidden');$('#mdetail').classList.remove('hidden');$('#mgr').scrollTop=0};
async function loadSess(){const a=await (await fetch('/api/sessions')).json(),by={};
 a.forEach(x=>{const k=dt(x.start);(by[k]??={})[x.role+'|'+x.name]??=[];by[k][x.role+'|'+x.name].push(x)});
 $('#msess').innerHTML=Object.entries(by).map(([d,ppl])=>`<h3>${d}</h3>`+Object.entries(ppl).map(([k,l])=>{const [r,n]=k.split('|'),tot=l.reduce((s,x)=>s+((x.end||Date.now())-x.start),0);
  return `<div class="sc"><b>${esc(n)}</b><span class="tag ${r}">${r}</span> · ${l.length} login${l.length>1?'s':''} · ${fm(tot)} total${r==='driver'&&l.length>3?' ⚠️':''}
  <table class="tl">${l.map(x=>`<tr><td>${tm(x.start)}</td><td>→ ${x.end?tm(x.end):'🟢 online'}</td><td>${fm((x.end||Date.now())-x.start)}${x.note?' <small>('+x.note+')</small>':''}</td></tr>`).join('')}</table></div>`}).join('')).join('')||'<small>No sessions yet</small>'}

// presence legend (dispatch/manager only) + driver locations on dispatch map
const drvL={};function clearDrv(){for(const k in drvL){map.removeLayer(drvL[k]);delete drvL[k]}}
const truck=n=>L.divIcon({className:'',html:`<div class="truck">🚚<span>${esc(n)}</span></div>`,iconSize:[30,30],iconAnchor:[15,15]});
sock.on('presence',p=>{if(!['dispatch','manager'].includes(user?.role))return;
 $('#legend').innerHTML=`🔭 ${p.scouts} scout${p.scouts==1?'':'s'} · 🚚 ${p.drivers} driver${p.drivers==1?'':'s'} online`;
 if(user.role!=='dispatch')return;const seen={};
 p.locs.forEach(l=>{seen[l.name]=1;const tip=`${esc(l.name)} · ${new Date(l.t).toLocaleTimeString()}`;
  if(drvL[l.name])drvL[l.name].setLatLng([l.lat,l.lng]).setTooltipContent(tip);else drvL[l.name]=L.marker([l.lat,l.lng],{icon:truck(l.name),zIndexOffset:1000}).addTo(map).bindTooltip(tip)});
 for(const k in drvL)if(!seen[k]){map.removeLayer(drvL[k]);delete drvL[k]}});
// driver shares GPS while logged in
let watchId=null,lastPos=null,lastSent=0;
function startLoc(){if(user?.role!=='driver'){if(watchId!=null){navigator.geolocation.clearWatch(watchId);watchId=null}return}
 if(watchId!=null||!navigator.geolocation)return;
 watchId=navigator.geolocation.watchPosition(p=>{lastPos={lat:p.coords.latitude,lng:p.coords.longitude,acc:p.coords.accuracy};
  if(Date.now()-lastSent>8000){lastSent=Date.now();sock.emit('loc',lastPos)}},e=>toast('Location sharing is off — Dispatch cannot see you. Allow location for this site.','info'),{enableHighAccuracy:true,maximumAge:10000,timeout:20000})}
sock.on('connect',()=>{if(lastPos&&user?.role==='driver')sock.emit('loc',lastPos)});
startLoc();
// Grab&Go
$('#gng').onclick=()=>{const go=async pos=>{const notes=prompt('Grab&Go — hooked at your current location.\nNotes (plate, make, color) optional:','');if(notes===null)return;
  const fd=new FormData();fd.append('lat',pos.lat);fd.append('lng',pos.lng);fd.append('notes',notes);fd.append('scout',user.name);fd.append('source','grabgo');
  const r=await fetch('/api/markers',{method:'POST',body:fd}),j=await r.json();if(!r.ok)return alert(j.error);
  toast('Grab&Go logged as Hooked. Mark Secured or Dropped when done.','info');setTimeout(()=>focusM(j.id),300)};
 if(lastPos&&Date.now()-lastSent<60000)return go(lastPos);
 navigator.geolocation?navigator.geolocation.getCurrentPosition(p=>go({lat:p.coords.latitude,lng:p.coords.longitude}),()=>{const c=map.getCenter();if(confirm('No GPS fix. Use the map center instead?'))go({lat:c.lat,lng:c.lng})},{enableHighAccuracy:true,timeout:15000}):go(map.getCenter())};
// Dispatch form
let dpin=null;function setDisp(ll,label){if(dpin)dpin.setLatLng(ll);else dpin=L.marker(ll,{icon:icon('#2d9cdb'),draggable:true}).addTo(map).on('dragend',()=>setDisp(dpin.getLatLng()));
 if(label!==undefined)$('#daddr').value=label;$('#dloc').textContent=`📍 ${(+ll.lat).toFixed(5)}, ${(+ll.lng).toFixed(5)} (drag pin to adjust)`}
$('#dfind').onclick=async()=>{const q=$('#daddr').value.trim();if(!q)return $('#daddr').focus();$('#dres').innerHTML='<small>Searching…</small>';
 try{const r=await fetch('/api/geocode?q='+encodeURIComponent(q)),j=await r.json();if(!r.ok)throw new Error(j.error);
  if(!j.length){$('#dres').innerHTML='<small class="err">No match. Add city/state, or tap the map.</small>';return}
  window._geo=j;$('#dres').innerHTML=j.map((g,i)=>`<div class="nitem" onclick="pickG(${i})">${esc(g.label)}</div>`).join('');if(j.length===1)pickG(0)}
 catch(e){$('#dres').innerHTML=`<small class="err">${esc(e.message)}</small>`}};
$('#daddr').onkeydown=e=>{if(e.key==='Enter')$('#dfind').onclick()};
window.pickG=i=>{const g=_geo[i];setDisp({lat:g.lat,lng:g.lng},g.label);map.setView([g.lat,g.lng],15);$('#dres').innerHTML=''};
$('#dsend').onclick=async()=>{if(!dpin)return alert('Find an address or tap the map first');const p=dpin.getLatLng(),fd=new FormData();
 [['lat',p.lat],['lng',p.lng],['address',$('#daddr').value],['contactName',$('#dname').value],['contactPhone',$('#dphone').value],['notes',$('#dnotes').value],['scout',user.name],['source','dispatch']].forEach(([k,v])=>fd.append(k,v));
 $('#dsend').disabled=true;try{const r=await fetch('/api/markers',{method:'POST',body:fd}),j=await r.json();if(!r.ok)throw new Error(j.error);
  ['daddr','dname','dphone','dnotes'].forEach(i=>$('#'+i).value='');map.removeLayer(dpin);dpin=null;$('#dloc').textContent='Find an address or tap the map.';toast('Sent to all drivers ✅','info');map.setView([p.lat,p.lng],11)}
 catch(e){alert('Failed: '+e.message)}$('#dsend').disabled=false};

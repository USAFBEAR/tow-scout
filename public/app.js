const DEF=[29.4477,-82.6423];let user=JSON.parse(localStorage.getItem('ts_user')||'null');
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';');
const map=L.map('map').setView(DEF,14);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
const icon=c=>L.divIcon({className:'',html:`<div style="width:22px;height:22px;border-radius:50%;background:${c};border:3px solid #fff;box-shadow:0 0 6px #000"></div>`,iconSize:[22,22],iconAnchor:[11,11]});
const markers={},layers={};let prov=null,notifs=JSON.parse(localStorage.getItem('ts_notifs')||'[]');
const gmaps=m=>`https://www.google.com/maps?q=${m.lat},${m.lng}`;
function toast(t,cls='',onclick){const d=document.createElement('div');d.className='toast '+cls;d.textContent=t;d.onclick=()=>{onclick&&onclick();d.remove()};$('#toasts').append(d);setTimeout(()=>d.remove(),onclick?12000:4000)}
function setUser(u){user=u;localStorage.setItem('ts_user',JSON.stringify(u));document.body.className=u.role;
 $('#who').innerHTML=`${esc(u.name)}<span class="tag ${u.role}">${u.role==='scout'?'Scout':'Tow Driver'}</span>`;
 $('#bell').classList.toggle('hidden',u.role!=='driver');$('#hint').classList.toggle('hidden',u.role!=='scout');
 $('#hint').textContent='Tap the map where the vehicle is parked';$('#login').classList.add('hidden');renderAll();renderNotifs()}
document.querySelectorAll('#login [data-role]').forEach(b=>b.onclick=()=>{const n=$('#name').value.trim();if(!n)return $('#name').focus();setUser({name:n,role:b.dataset.role})});
$('#switch').onclick=()=>{$('#name').value=user?.name||'';$('#login').classList.remove('hidden')};
if(user)setUser(user);else $('#login').classList.remove('hidden');
navigator.geolocation?.getCurrentPosition(p=>{map.setView([p.coords.latitude,p.coords.longitude],15);L.circleMarker([p.coords.latitude,p.coords.longitude],{radius:6,color:'#56ccf2'}).addTo(map).bindTooltip('You')},()=>{},{timeout:8000});
function popup(m){const g=m.photos.map(p=>`<img src="${p}" onclick="lb('${p}')">`).join('');
 let a='';if(user?.role==='driver'){
  if(m.status==='open')a=`<button class="driver" onclick="act('${m.id}','enroute')">🚚 I'm in route</button>`;
  else if(m.enrouteBy===user.name)a=`<button onclick="act('${m.id}','release')">Release</button>`;
  else a=`<button class="driver" onclick="act('${m.id}','enroute')">🚚 I'm in route</button>`;
  a+=`<br><button class="ok" onclick="act('${m.id}','taken')">✅ Taken</button><button class="danger" onclick="act('${m.id}','gone')">❌ No longer there</button>`}
 return `<div class="pop"><b>${m.status==='enroute'?'🟡 In route: '+esc(m.enrouteBy):'🔴 Open'}</b><br><small>By ${esc(m.scout)} · ${new Date(m.createdAt).toLocaleString()}</small>
 ${m.notes?`<p>${esc(m.notes)}</p>`:''}<div class="gallery">${g}</div><p><a href="${gmaps(m)}" target="_blank" rel="noopener">📍 Open in Google Maps</a></p>${a}</div>`}
function renderMarker(m){markers[m.id]=m;const c=m.status==='enroute'?'#f2c94c':'#e74c3c';
 if(layers[m.id]){layers[m.id].setIcon(icon(c));layers[m.id].setPopupContent(popup(m))}else layers[m.id]=L.marker([m.lat,m.lng],{icon:icon(c)}).addTo(map).bindPopup(popup(m),{maxWidth:280});renderList()}
function removeMarker(id){if(layers[id]){map.removeLayer(layers[id]);delete layers[id]}delete markers[id];renderList()}
function renderAll(){Object.values(markers).forEach(renderMarker);renderList()}
function renderList(){const a=Object.values(markers).sort((x,y)=>y.createdAt-x.createdAt);$('#count').textContent=a.length;
 $('#list').innerHTML=a.map(m=>`<div class="item ${m.status}" onclick="focusM('${m.id}')"><b>${m.status==='enroute'?'🟡 In route ('+esc(m.enrouteBy)+')':'🔴 Open'}</b> ${m.photos.length?'📷'+m.photos.length:''}<br>${esc(m.notes||'No notes')}<br><small>${esc(m.scout)} · ${new Date(m.createdAt).toLocaleTimeString()}</small></div>`).join('')||'<small>No open spots</small>'}
window.focusM=id=>{const m=markers[id];if(!m)return toast('That spot was already cleared','info');map.setView([m.lat,m.lng],17);layers[id].openPopup()};
window.lb=src=>{$('#lightbox img').src=src;$('#lightbox').classList.remove('hidden')};$('#lightbox').onclick=()=>$('#lightbox').classList.add('hidden');
window.act=async(id,a)=>{const url=a==='taken'||a==='gone'?`/api/markers/${id}/close`:`/api/markers/${id}/${a}`;
 const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({driver:user.name,reason:a})});const j=await r.json();
 if(!r.ok)return alert(j.error);if(a==='enroute')toast('You are in route. Others will see this spot is claimed.','info')};
// scout placing
map.on('click',e=>{if(user?.role!=='scout')return;if(prov)map.removeLayer(prov);prov=L.marker(e.latlng,{icon:icon('#2d9cdb'),draggable:true}).addTo(map);openForm()});
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
sock.on('connect',async()=>{const a=await (await fetch('/api/markers')).json();Object.keys(markers).forEach(id=>{if(!a.find(m=>m.id===id))removeMarker(id)});a.forEach(renderMarker)});
sock.on('marker:new',m=>{renderMarker(m);if(user?.role==='driver')alertDriver(m)});
sock.on('marker:update',m=>{renderMarker(m);if(layers[m.id]?.isPopupOpen())layers[m.id].setPopupContent(popup(m))});
sock.on('marker:remove',({id,status,by})=>{const was=markers[id];removeMarker(id);if(was)toast(`Spot ${status==='taken'?'taken':'cleared (no longer there)'} by ${by}`,'info')});

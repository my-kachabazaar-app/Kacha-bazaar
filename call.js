/* In-app voice calls between rider and customer (WebRTC). Signalling goes through Firestore, so no phone numbers are shared. */
(function(){
var ICE=[{urls:"stun:stun.l.google.com:19302"},{urls:"stun:stun1.l.google.com:19302"}];
/* For calls on every mobile network, add a TURN server here, e.g. {urls:"turn:YOUR_TURN_HOST:443",username:"...",credential:"..."} */
var S={db:null,uid:"",role:"",name:"",pc:null,stream:null,id:"",unsubs:[],cand:[],pend:[],mine:[],t0:0,timer:null,ringT:null,ac:null,ui:null,wait:null};
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function ring(on){clearInterval(S.ringT);S.ringT=null;if(!on)return;
var go=function(){try{S.ac=S.ac||new (window.AudioContext||window.webkitAudioContext)();S.ac.resume&&S.ac.resume();var t=S.ac.currentTime;
[0,.7].forEach(function(d){var o=S.ac.createOscillator(),g=S.ac.createGain();o.type="square";g.gain.value=.28;for(var i=0;i<10;i++)o.frequency.setValueAtTime(i%2?1318:988,t+d+i*.05);o.connect(g);g.connect(S.ac.destination);o.start(t+d);o.stop(t+d+.5)});
navigator.vibrate&&navigator.vibrate([400,200,400])}catch(e){}};go();S.ringT=setInterval(go,2600)}
function ui(name,status,btns){
if(!S.ui){S.ui=document.createElement("div");S.ui.id="kbcall";S.ui.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;background:linear-gradient(160deg,#0b5d2a,#12a150 60%,#f59e0b);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:80px 24px 70px;font-family:system-ui,sans-serif;text-align:center;animation:kbcIn .3s";
var st=document.createElement("style");st.textContent="@keyframes kbcIn{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}@keyframes kbcP{0%{box-shadow:0 0 0 0 #fff8}70%{box-shadow:0 0 0 34px #fff0}100%{box-shadow:0 0 0 0 #fff0}}";document.head.appendChild(st);
document.body.appendChild(S.ui);var a=document.createElement("audio");a.id="kbaud";a.autoplay=true;a.setAttribute("playsinline","");document.body.appendChild(a)}
S.ui.innerHTML='<div><div style="width:130px;height:130px;border-radius:50%;background:#ffffff33;margin:0 auto 22px;display:flex;align-items:center;justify-content:center;font-size:62px;animation:kbcP 1.6s infinite">👤</div><div style="font-size:30px;font-weight:800">'+esc(name)+'</div><div id="kbst" style="margin-top:10px;font-size:18px;opacity:.9">'+status+'</div></div><div style="display:flex;gap:34px;align-items:center;justify-content:center">'+btns+'</div>'}
var BTN=function(ic,label,fn,bg){return '<button onclick="'+fn+'" style="border:0;background:'+bg+';color:#fff;width:78px;height:78px;border-radius:50%;font-size:32px;box-shadow:0 8px 20px #0004">'+ic+'<div style="font-size:12px;margin-top:2px">'+label+'</div></button>'};
function pcNew(){
var pc=new RTCPeerConnection({iceServers:ICE});S.pc=pc;
pc.ontrack=function(e){var a=document.getElementById("kbaud");if(a){a.srcObject=e.streams[0];a.play&&a.play().catch(function(){})}};
pc.onicecandidate=function(e){if(!e.candidate)return;var d={from:S.role,c:JSON.stringify(e.candidate)};if(S.ready)push(d);else S.pend.push(d)};
pc.onconnectionstatechange=function(){if(pc.connectionState==="connected")connected();if(pc.connectionState==="failed")finish("Call failed")};
S.stream.getTracks().forEach(function(t){pc.addTrack(t,S.stream)})}
function push(d){S.db.collection("calls").doc(S.id).collection("ice").add(d).then(function(r){S.mine.push(r)}).catch(function(){})}
function watchIce(){S.unsubs.push(S.db.collection("calls").doc(S.id).collection("ice").onSnapshot(function(s){s.docChanges().forEach(function(c){if(c.type!=="added")return;var d=c.doc.data();if(d.from===S.role)return;var cand=JSON.parse(d.c);if(S.pc&&S.pc.remoteDescription)S.pc.addIceCandidate(cand).catch(function(){});else S.cand.push(cand)})}))}
function flush(){S.cand.forEach(function(c){S.pc.addIceCandidate(c).catch(function(){})});S.cand=[]}
function connected(){if(S.t0)return;ring(false);S.t0=Date.now();var f=function(){var s=Math.floor((Date.now()-S.t0)/1000),e=document.getElementById("kbst");if(e)e.textContent="Connected · "+String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0")};f();S.timer=setInterval(f,1000)}
function active(name){ui(name,S.t0?"Connected":"Connecting…",BTN("🎙️","Mute","KBCALL.mute()","#ffffff33")+BTN("📞","End","KBCALL.end()","#e53935"))}
async function mic(){try{return await navigator.mediaDevices.getUserMedia({audio:true})}catch(e){alert("Please allow the microphone to make calls.");return null}}
function finish(msg){ring(false);clearTimeout(S.wait);clearInterval(S.timer);S.unsubs.forEach(function(u){u()});
try{S.pc&&S.pc.close()}catch(e){}try{S.stream&&S.stream.getTracks().forEach(function(t){t.stop()})}catch(e){}
var id=S.id,mine=S.mine.slice();S.pc=null;S.stream=null;S.unsubs=[];S.cand=[];S.pend=[];S.mine=[];S.id="";S.t0=0;S.ready=false;
if(S.ui){S.ui.remove();S.ui=null;var a=document.getElementById("kbaud");a&&a.remove()}
if(msg&&window.toast)try{toast(msg)}catch(e){}
if(id)setTimeout(function(){mine.forEach(function(r){r.delete().catch(function(){})});S.db.collection("calls").doc(id).delete().catch(function(){})},4000)}
function watchDoc(role,name){S.unsubs.push(S.db.collection("calls").doc(S.id).onSnapshot(function(d){if(!d.exists)return;var c=d.data();
if(role==="caller"&&c.answer&&S.pc&&!S.pc.remoteDescription){S.pc.setRemoteDescription(c.answer).then(flush).catch(function(){});ring(false);active(name)}
if(c.state==="ended"||c.state==="declined"||c.state==="missed")finish(c.state==="declined"?"Call declined":"Call ended")}))}
window.KBCALL={
init:function(db,uid,role,name){S.db=db;S.uid=uid;S.role=role;S.name=name;
db.collection("calls").where("calleeUid","==",uid).where("state","==","ringing").onSnapshot(function(s){s.docChanges().forEach(function(c){if(c.type==="removed")return;var d=c.doc.data();if(S.id||Date.now()-d.at>45000)return;KBCALL.incoming(c.doc.id,d)})},function(){})},
start:async function(orderId,calleeUid,calleeName){
if(!S.db)return alert("Please log in first.");if(S.id)return;
if(!window.RTCPeerConnection||!navigator.mediaDevices)return alert("Calls are not supported on this device.");
S.stream=await mic();if(!S.stream)return;
S.id=S.db.collection("calls").doc().id;S.ready=false;S.pend=[];pcNew();
ui(calleeName||"Calling…","Calling…",BTN("📞","Cancel","KBCALL.end()","#e53935"));ring(true);
try{var off=await S.pc.createOffer();await S.pc.setLocalDescription(off);
await S.db.collection("calls").doc(S.id).set({orderId:orderId,callerUid:S.uid,calleeUid:calleeUid,callerName:S.name,caller:S.role,state:"ringing",offer:{type:off.type,sdp:off.sdp},answer:null,at:Date.now()});
S.ready=true;S.pend.forEach(push);S.pend=[];watchIce();watchDoc("caller",calleeName);
S.wait=setTimeout(function(){if(!S.t0){S.db.collection("calls").doc(S.id).update({state:"missed"}).catch(function(){});finish("No answer")}},45000)}
catch(e){finish("Could not start the call");alert(e.message)}},
incoming:function(id,c){S.id=id;S.incoming=c;ui(c.callerName||"Incoming call","Incoming call…",BTN("📞","Decline","KBCALL.decline()","#e53935")+BTN("📞","Accept","KBCALL.accept()","#1faa6b"));ring(true);watchDoc("callee",c.callerName)},
accept:async function(){ring(false);var c=S.incoming;S.stream=await mic();if(!S.stream){KBCALL.decline();return}
S.ready=true;pcNew();watchIce();
try{await S.pc.setRemoteDescription(c.offer);flush();var ans=await S.pc.createAnswer();await S.pc.setLocalDescription(ans);
await S.db.collection("calls").doc(S.id).update({state:"active",answer:{type:ans.type,sdp:ans.sdp}});active(c.callerName)}
catch(e){finish("Could not connect");alert(e.message)}},
decline:function(){var id=S.id;S.db.collection("calls").doc(id).update({state:"declined"}).catch(function(){});finish("")},
end:function(){var id=S.id;if(id)S.db.collection("calls").doc(id).update({state:"ended"}).catch(function(){});finish("Call ended")},
mute:function(){var t=S.stream&&S.stream.getAudioTracks()[0];if(t){t.enabled=!t.enabled;var b=document.querySelector("#kbcall button");if(b)b.style.opacity=t.enabled?1:.5}}
};
})();

#!/bin/bash
# Usage: bash deploy-notifications.sh [region]   (default region: asia-south1)
set -e
REGION="${1:-asia-south1}"
PROJECT="kacha-bazaar-7fda3"
mkdir -p kb-notify/functions
cd kb-notify
read -p "Cloudinary cloud name: " CN
read -p "Cloudinary API key: " CK
read -s -p "Cloudinary API secret (hidden): " CS; echo
printf 'CLOUD_NAME=%s\nCLOUD_KEY=%s\nCLOUD_SECRET=%s\n' "$CN" "$CK" "$CS" > functions/.env
cat > firebase.json <<'EOF'
{"functions":[{"source":"functions","codebase":"default"}]}
EOF
cat > functions/package.json <<'EOF'
{"name":"functions","engines":{"node":"20"},"main":"index.js","dependencies":{"firebase-admin":"^12.0.0","firebase-functions":"^5.0.0"}}
EOF
cat > functions/index.js <<'EOF'
const {onDocumentCreated,onDocumentUpdated,onDocumentDeleted}=require("firebase-functions/v2/firestore");
const crypto=require("crypto");
const admin=require("firebase-admin");
admin.initializeApp();
const db=admin.firestore(),R="__REGION__";
async function send(q,title,body,ch){
  const s=await q.get();const tokens=s.docs.map(d=>d.id);if(!tokens.length)return;
  for(let i=0;i<tokens.length;i+=500){
    const t=tokens.slice(i,i+500);
    const r=await admin.messaging().sendEachForMulticast({tokens:t,notification:{title,body},android:{priority:"high",notification:{channelId:ch||"orders",sound:ch==="kb_order"?"kb_order":"default"}}});
    const bad=[];
    r.responses.forEach((x,j)=>{const c=(x.error&&x.error.code)||"";if(!x.success&&/not-registered|invalid-argument|invalid-registration/.test(c))bad.push(t[j])});
    await Promise.all(bad.map(k=>db.collection("tokens").doc(k).delete()));
  }
}
const toUser=(uid,t,b,ch)=>uid?send(db.collection("tokens").where("uid","==",uid),t,b,ch):null;
const toRole=(role,t,b)=>send(db.collection("tokens").where("role","==",role),t,b);

// ---- Cloudinary clean-up: when a photo/file is deleted or replaced in the database, delete it from Cloudinary too ----
const urlsOf=o=>{const out=[];(function w(v){if(typeof v==="string"){if(v.startsWith("https://res.cloudinary.com/"))out.push(v)}else if(Array.isArray(v))v.forEach(w);else if(v&&typeof v==="object")Object.values(v).forEach(w)})(o);return out};
async function destroy(u){
  const m=u.match(/\/(image|video|raw)\/(upload|authenticated|private)\/(?:s--[^/]+--\/)?v\d+\/(.+)$/);if(!m)return;
  const pid=m[1]==="raw"?m[3]:m[3].replace(/\.[^./]+$/,""),ts=Math.floor(Date.now()/1000);
  const sig=crypto.createHash("sha1").update(`invalidate=true&public_id=${pid}&timestamp=${ts}&type=${m[2]}${process.env.CLOUD_SECRET}`).digest("hex");
  const body=new URLSearchParams({public_id:pid,timestamp:String(ts),type:m[2],invalidate:"true",api_key:process.env.CLOUD_KEY,signature:sig});
  const r=await fetch(`https://api.cloudinary.com/v1_1/${process.env.CLOUD_NAME}/${m[1]}/destroy`,{method:"POST",body});
  console.log("cloudinary destroy",pid,r.status);
}
const sweep=(b,a)=>{const keep=new Set(a?urlsOf(a):[]);return Promise.all(urlsOf(b).filter(u=>!keep.has(u)).map(destroy))};
for(const [name,path] of [["products","products/{id}"],["categories","categories/{id}"],["riderMedia","riderMedia/{id}"],["files","files/{id}"],["kyc","users/{u}/kyc/{t}"],["settings","settings/{id}"],["users","users/{id}"]]){
  exports["cldDel_"+name]=onDocumentDeleted({document:path,region:R},e=>sweep(e.data.data(),null));
  exports["cldUpd_"+name]=onDocumentUpdated({document:path,region:R},e=>sweep(e.data.before.data(),e.data.after.data()));
}
exports.callCreated=onDocumentCreated({document:"calls/{id}",region:R},e=>{const c=e.data.data();return toUser(c.calleeUid,"📞 Incoming call",`${c.callerName||"Someone"} is calling you`,"kb_order")});
exports.depositCreated=onDocumentCreated({document:"deposits/{id}",region:R},e=>{const d=e.data.data();return d.status==="pending"?toRole("admin","Deposit request 💵",`${d.riderName||"Rider"} · ₹${d.amount}`):null});
exports.depositUpdated=onDocumentUpdated({document:"deposits/{id}",region:R},e=>{const b=e.data.before.data(),a=e.data.after.data();
  if(b.status==="pending"&&a.status==="done")return toUser(a.riderId,"Deposit received ✅",`₹${a.amount} received by the store manager`);
  if(b.status==="pending"&&a.status==="rejected")return toUser(a.riderId,"Deposit not accepted ❌",`Your ₹${a.amount} deposit was rejected. Please contact the store manager.`);
  return null});
exports.orderCreated=onDocumentCreated({document:"orders/{id}",region:R},e=>{const o=e.data.data();
  return Promise.all([toRole("admin","New order 🛒",`${o.name} · ₹${o.total} · ${o.pay==="upi"?"UPI":"COD"}`),toUser(o.uid,"Order placed ✅","We have received your order. Waiting for store confirmation.")])});
exports.orderUpdated=onDocumentUpdated({document:"orders/{id}",region:R},e=>{
  const b=e.data.before.data(),a=e.data.after.data(),j=[];
  if(!b.riderId&&a.riderId){j.push(toUser(a.riderId,"New order assigned 🛵",`${a.name} · ${a.addr}`,"kb_order"));j.push(toUser(a.uid,"Order confirmed ✅",a.eta?`Arriving in about ${a.eta} mins`:"Your order has been confirmed"))}
  else if(a.eta&&(a.eta!==b.eta||a.etaAt!==b.etaAt))j.push(toUser(a.uid,"Delivery time updated ⏱",`Now arriving in about ${a.eta} mins`));
  if(b.status!==a.status){
    const m={accepted:["Rider on the way 🛵","Your rider is heading to the store"],collected:["Out for delivery 📦","Your order has been picked up"],arrived:["Rider arrived 📍","Your rider has reached your location"],delivered:["Order delivered ✅","Thank you for ordering with us!"],cancelled:["Order cancelled","Your order was cancelled. Contact support if you need help."]}[a.status];
    if(m)j.push(toUser(a.uid,m[0],m[1]));
    if(a.status==="cancelled")j.push(toRole("admin","Order cancelled ❌",`${a.name} · ${a.cancelReason||""}`));
    if(a.status==="delivered")j.push(toRole("admin","Order delivered ✅",`${a.name} · ₹${a.total}`));
  }
  return Promise.all(j)});
exports.ticketCreated=onDocumentCreated({document:"tickets/{id}",region:R},e=>{const t=e.data.data();return toRole("admin","New support ticket 🎫",`${t.riderName||"Rider"}: ${t.subject}`)});
exports.ticketUpdated=onDocumentUpdated({document:"tickets/{id}",region:R},e=>{
  const b=e.data.before.data(),a=e.data.after.data();if(a.msgs.length<=b.msgs.length)return null;
  const m=a.msgs[a.msgs.length-1];
  return m.from==="admin"?toUser(a.riderId,"Reply from store manager 💬",String(m.text).slice(0,100)):toRole("admin","Ticket reply 💬",`${a.riderName}: ${String(m.text).slice(0,100)}`)});
exports.riderApproved=onDocumentUpdated({document:"users/{id}",region:R},e=>{
  const b=e.data.before.data(),a=e.data.after.data();
  return !b.approved&&a.approved?toUser(e.params.id,"Account approved 🎉",`Your rider ID is ${a.riderCode||""}. You can go online now.`):null});
exports.broadcast=onDocumentCreated({document:"broadcasts/{id}",region:R},e=>{
  const b=e.data.data(),col=db.collection("tokens");
  return send(b.to==="all"?col:col.where("role","==",b.to),b.title,b.body)});
EOF
sed -i "s/__REGION__/$REGION/" functions/index.js
(cd functions && npm install)
npx -y firebase-tools@latest login --no-localhost
npx -y firebase-tools@latest deploy --only functions --project "$PROJECT"
echo "Done. Notifications are now live."

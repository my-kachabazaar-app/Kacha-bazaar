(function(){
var esc=function(s){return String(s==null?"":s).replace(/[&<>]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;"}[c]})};
function banner(t,b){var d=document.createElement("div");d.style.cssText="position:fixed;top:12px;left:12px;right:12px;background:#1d1b26;color:#fff;padding:12px 16px;border-radius:14px;z-index:9999;box-shadow:0 6px 20px #0005;font:14px system-ui,sans-serif";d.innerHTML="<b>"+esc(t)+"</b><div>"+esc(b)+"</div>";document.body.appendChild(d);setTimeout(function(){d.remove()},4500)}
window.kbPush=async function(db,uid,role){
try{
var C=window.Capacitor;
if(!C||!C.isNativePlatform||!C.isNativePlatform())return;
var P=C.Plugins&&C.Plugins.PushNotifications;if(!P)return;
var p=await P.checkPermissions();
if(p.receive!=="granted")p=await P.requestPermissions();
if(p.receive!=="granted")return;
try{await P.createChannel({id:"orders",name:"Orders & updates",description:"Order, delivery and support updates",importance:5,visibility:1,sound:"default",vibration:true})}catch(e){}
await P.removeAllListeners();
P.addListener("registration",function(t){db.collection("tokens").doc(t.value).set({uid:uid,role:role,at:Date.now()}).catch(function(e){console.log(e)})});
P.addListener("registrationError",function(e){console.log("push error",e)});
P.addListener("pushNotificationReceived",function(n){try{navigator.vibrate&&navigator.vibrate([200,100,200])}catch(e){}banner(n.title,n.body)});
await P.register();
}catch(e){console.log("push setup failed",e)}
};
})();

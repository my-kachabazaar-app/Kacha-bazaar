/* Phone OTP helper: native Firebase phone auth (no captcha) when the native plugin is present, web reCAPTCHA otherwise. */
(function(){
var vr=null;
var hasNative=function(){return !!(window.Capacitor&&Capacitor.Plugins&&Capacitor.Plugins.FirebaseAuthentication&&Capacitor.isNativePlatform&&Capacitor.isNativePlatform())};
function web(ph,link){if(!vr){var d=document.getElementById("rcap");if(!d){d=document.createElement("div");d.id="rcap";document.body.appendChild(d)}vr=new firebase.auth.RecaptchaVerifier("rcap",{size:"invisible"})}
var a=firebase.auth(),p=link?a.currentUser.linkWithPhoneNumber("+91"+ph,vr):a.signInWithPhoneNumber("+91"+ph,vr);return p.catch(function(e){try{vr.clear()}catch(x){}vr=null;throw e})}
function nativeStart(ph,link){var FA=Capacitor.Plugins.FirebaseAuthentication;return new Promise(function(res,rej){var hs=[],done=false;function clean(){hs.forEach(function(h){try{h.remove()}catch(e){}})}
FA.addListener("phoneCodeSent",function(e){if(done)return;done=true;clean();res({confirm:function(code){var cred=firebase.auth.PhoneAuthProvider.credential(e.verificationId,code),a=firebase.auth();return link?a.currentUser.linkWithCredential(cred):a.signInWithCredential(cred)}})}).then(function(h){hs.push(h)});
FA.addListener("phoneVerificationFailed",function(e){if(done)return;done=true;clean();rej(new Error(e.message||"Verification failed"))}).then(function(h){hs.push(h)});
FA.signInWithPhoneNumber({phoneNumber:"+91"+ph}).catch(function(e){if(done)return;done=true;clean();rej(e)})})}
window.KBOTP={start:function(ph,link){if(hasNative())return nativeStart(ph,link).catch(function(){return web(ph,link)});return web(ph,link)}};
})();

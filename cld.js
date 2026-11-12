(function(){
window.CLD={cloud:"fxxphwlv",preset:"kb_public",privatePreset:"kb_private"};
function busy(on){var d=document.getElementById("cldbusy");
if(on){if(!d){d=document.createElement("div");d.id="cldbusy";d.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:#0006;z-index:9998;display:flex;align-items:center;justify-content:center;color:#fff;font:600 18px system-ui,sans-serif";d.textContent="Uploading…";document.body.appendChild(d)}d.style.display="flex"}
else if(d)d.style.display="none"}
window.cldUpload=async function(file,priv){
var fd=new FormData();fd.append("file",file);fd.append("upload_preset",priv?CLD.privatePreset:CLD.preset);
var r=await fetch("https://api.cloudinary.com/v1_1/"+CLD.cloud+"/auto/upload",{method:"POST",body:fd});
var j=await r.json();if(!r.ok)throw new Error((j.error&&j.error.message)||"Upload failed");return j.secure_url};
window.cldBusy=busy;
window.pickImg=function(max,cb,priv){
var f=document.createElement("input");f.type="file";f.accept="image/*";
f.onchange=function(){var file=f.files[0];if(!file)return;var r=new FileReader();
r.onload=function(){var im=new Image();
im.onload=function(){var k=Math.min(1,max/Math.max(im.width,im.height)),c=document.createElement("canvas"),x=c.getContext("2d");
c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);x.fillStyle="#fff";x.fillRect(0,0,c.width,c.height);x.drawImage(im,0,0,c.width,c.height);
busy(true);c.toBlob(async function(b){try{cb(await window.cldUpload(b,priv))}catch(e){alert("Upload failed: "+e.message)}busy(false)},"image/jpeg",.82)};
im.src=r.result};r.readAsDataURL(file)};f.click()};
})();

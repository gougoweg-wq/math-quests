import * as THREE from 'three';
import {RGBELoader} from 'three/addons/loaders/RGBELoader.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

const $=id=>document.getElementById(id);
const ROUNDS=[[8,5],[9,4],[7,5],[6,7],[9,6],[18,4],[27,5],[36,7],[45,8],[59,3]];
const PAINT=[0xd40612,0xffb400,0x0a4dff,0xff5a00,0x12c24a,0xf2f4f8,0x8a12e0,0xff1f8f,0x00b8d9,0x15171c];
let R=0,busy=true,miss=0,stars=0,sound=!/[?&]mute/.test(location.search),ac,speed=0,boost=0,worldX=0;

// ---------- renderer
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
document.body.prepend(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0x05060f);scene.fog=new THREE.Fog(0x05060f,26,85);
const cam=new THREE.PerspectiveCamera(38,innerWidth/innerHeight,.1,200);
const rt=new THREE.WebGLRenderTarget(innerWidth,innerHeight,{type:THREE.HalfFloatType,samples:4});
const composer=new EffectComposer(renderer,rt);composer.addPass(new RenderPass(scene,cam));
const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.28,.5,.92);composer.addPass(bloom);composer.addPass(new OutputPass());
let camK=1;
function fit(){const a=innerWidth/innerHeight;camK=Math.max(1,1.72/a);cam.aspect=a;cam.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight)}
fit();addEventListener('resize',fit);

const mgr=new THREE.LoadingManager();
new RGBELoader(mgr).load('assets/city.hdr',t=>{t.mapping=THREE.EquirectangularReflectionMapping;const p=new THREE.PMREMGenerator(renderer);scene.environment=p.fromEquirectangular(t).texture;scene.environmentIntensity=1;t.dispose();p.dispose()});
const key=new THREE.DirectionalLight(0xdfeaff,3.2);key.position.set(-3,10,9);scene.add(key);const top=new THREE.DirectionalLight(0xffffff,1.6);top.position.set(4,12,-2);scene.add(top);
const rimL=new THREE.PointLight(0xff2bd6,60,30);rimL.position.set(-7,3,3);scene.add(rimL);
const rimR=new THREE.PointLight(0x27e4ff,60,30);rimR.position.set(7,3,3);scene.add(rimR);

// ---------- wet road: the mirrored car shows through a semi-transparent floor
const road=new THREE.Mesh(new THREE.PlaneGeometry(240,60),new THREE.MeshStandardMaterial({color:0x05060b,roughness:.22,metalness:.3,envMapIntensity:.12,transparent:true,opacity:.8}));
road.rotation.x=-Math.PI/2;road.renderOrder=1;scene.add(road);
const NEON=[0x27e4ff,0xff2bd6];
const strips=[];
for(const [z,c] of [[-3.9,NEON[0]],[3.5,NEON[1]]]){
 const s=new THREE.Mesh(new THREE.BoxGeometry(240,.07,.09),new THREE.MeshBasicMaterial({color:new THREE.Color(c).multiplyScalar(1.5)}));s.position.set(0,.05,z);scene.add(s);
 const glow=new THREE.Mesh(new THREE.PlaneGeometry(240,1.5),new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:.06,blending:THREE.AdditiveBlending,depthWrite:false}));glow.rotation.x=-Math.PI/2;glow.position.set(0,.02,z);glow.renderOrder=2;scene.add(glow)}

// things that fly past during a launch
const movers=[];const span=96;
const dashG=new THREE.BoxGeometry(2.8,.01,.1),dashM=new THREE.MeshBasicMaterial({color:0xc8d4ff});
for(let i=0;i<14;i++){const d=new THREE.Mesh(dashG,dashM);d.position.set(i*7,.03,1.3);scene.add(d);movers.push({o:d,x:i*7,p:1})}
function gate(x){const g=new THREE.Group(),c=new THREE.Color(NEON[Math.round(x/24)&1]).multiplyScalar(1.5),m=new THREE.MeshBasicMaterial({color:c}),dark=new THREE.MeshStandardMaterial({color:0x11141f,metalness:.8,roughness:.4});
 const a=new THREE.Mesh(new THREE.BoxGeometry(.5,9.6,.5),dark),b=a.clone(),t=new THREE.Mesh(new THREE.BoxGeometry(.5,.5,17),dark);a.position.set(0,4.8,-8.5);b.position.set(0,4.8,8.5);t.position.y=9.5;
 const l=new THREE.Mesh(new THREE.BoxGeometry(.12,.12,16.4),m);l.position.set(-.3,9.2,0);const s1=new THREE.Mesh(new THREE.BoxGeometry(.1,8.6,.1),m),s2=s1.clone();s1.position.set(-.3,4.5,-8.2);s2.position.set(-.3,4.5,8.2);g.add(a,b,t,l,s1,s2);return g}
for(let i=0;i<4;i++){const g=gate(i*24);g.position.set(i*24-36,0,0);scene.add(g);movers.push({o:g,x:i*24-36,p:1})}
// skyline with lit windows
const wc=document.createElement('canvas');wc.width=128;wc.height=256;const w2=wc.getContext('2d');w2.fillStyle='#070914';w2.fillRect(0,0,128,256);
for(let y=4;y<252;y+=12)for(let x=4;x<124;x+=12)if(Math.random()<.16){w2.fillStyle=['#ffd27a','#7fe9ff','#ff8adf','#ffffff'][Math.random()*4|0];w2.fillRect(x,y,7,8)}
const wt=new THREE.CanvasTexture(wc);wt.colorSpace=THREE.SRGBColorSpace;wt.magFilter=THREE.NearestFilter;
for(let i=0;i<18;i++){const h=24+Math.random()*40,w=7+Math.random()*7,t=wt.clone();t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(Math.ceil(w/2.4),Math.ceil(h/5));t.needsUpdate=true;
 const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,6),new THREE.MeshBasicMaterial({map:t,color:0x5a6070}));b.position.set(i*7.5-65,h/2,-40-Math.random()*18);scene.add(b);movers.push({o:b,x:i*7.5-65,p:.28,w:135})}
// speed streaks
const streaks=[];for(let i=0;i<46;i++){const m=new THREE.Mesh(new THREE.BoxGeometry(1,.025,.025),new THREE.MeshBasicMaterial({color:new THREE.Color(NEON[i%2]).multiplyScalar(3),transparent:true,opacity:0}));m.position.set(Math.random()*80-40,.4+Math.random()*7,-6+Math.random()*12);scene.add(m);streaks.push(m)}

// ---------- car
const paint=new THREE.MeshPhysicalMaterial({color:PAINT[0],metalness:.55,roughness:.3,clearcoat:1,clearcoatRoughness:.03,envMapIntensity:2.6});
const detail=new THREE.MeshStandardMaterial({color:0xe6e8ee,metalness:1,roughness:.28});
const glass=new THREE.MeshPhysicalMaterial({color:0x101218,metalness:.2,roughness:0,transparent:true,opacity:.55,clearcoat:1});
const car=new THREE.Group();car.position.set(0,0,-.2);car.scale.setScalar(1.4);scene.add(car);const IDLE=Math.PI/2-.5,RUN=Math.PI/2;
const wheels=[];let flames=[];
const draco=new DRACOLoader(mgr);draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/');
const gl=new GLTFLoader(mgr);gl.setDRACOLoader(draco);
const ao=new THREE.TextureLoader(mgr).load('assets/ferrari_ao.png');
gl.load('assets/ferrari.glb',g=>{
 const skin=m=>{const n=x=>m.getObjectByName(x);n('body').material=paint;['rim_fl','rim_fr','rim_rr','rim_rl','trim'].forEach(x=>n(x).material=detail);n('glass').material=glass;['wheel_fl','wheel_fr','wheel_rl','wheel_rr'].forEach(x=>wheels.push(n(x)))};
 const m=g.scene;skin(m);car.add(m);
 const mirror=m.clone(true);skin(mirror);mirror.scale.y=-1;car.add(mirror);
 const sh=new THREE.Mesh(new THREE.PlaneGeometry(.655*4,1.3*4),new THREE.MeshBasicMaterial({map:ao,blending:THREE.MultiplyBlending,toneMapped:false,transparent:true,premultipliedAlpha:true}));sh.rotation.x=-Math.PI/2;sh.position.y=.02;sh.renderOrder=3;car.add(sh);
 const lamp=(x,y,z,c,r)=>{const s=new THREE.Mesh(new THREE.SphereGeometry(r,12,10),new THREE.MeshBasicMaterial({color:new THREE.Color(c).multiplyScalar(1.6)}));s.position.set(x,y,z);car.add(s)};
 for(const x of [-.62,.62]){lamp(x,.72,2.08,0xdff1ff,.07);lamp(x,.86,-2.2,0xff1a1a,.075)}
 for(const x of [-.25,.25]){const f=new THREE.Mesh(new THREE.ConeGeometry(.14,1.5,16,1,true),new THREE.MeshBasicMaterial({color:new THREE.Color(0x4fb8ff).multiplyScalar(1.6),transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));f.rotation.x=Math.PI/2+Math.PI;f.position.set(x,.42,-2.95);f.visible=false;car.add(f);flames.push(f)}
});
car.rotation.y=IDLE;
mgr.onLoad=()=>{const b=$('act');b.disabled=false;b.textContent='START'};

// ---------- ten-frame nitro tank
const cellG=new RoundedBoxGeometry(1,.62,.3,4,.12);
const OFF=0x10182c,GOLD=new THREE.Color(0xffa600).multiplyScalar(1.05),BLUE=new THREE.Color(0x12c8ff).multiplyScalar(1.05);
const tank=new THREE.Group();tank.position.set(0,5.05,-4);scene.add(tank);
const frame=new THREE.Mesh(new RoundedBoxGeometry(6.2,1.95,.2,3,.12),new THREE.MeshStandardMaterial({color:0x0a0e1c,metalness:.7,roughness:.3}));frame.position.z=-.18;tank.add(frame);
const edge=new THREE.Mesh(new RoundedBoxGeometry(6.32,2.07,.1,3,.12),new THREE.MeshBasicMaterial({color:new THREE.Color(0x27e4ff).multiplyScalar(1.6)}));edge.position.z=-.3;tank.add(edge);
const cells=[];const cellPos=i=>new THREE.Vector3(-2.36+(i%5)*1.18,i<5?.42:-.42,0);
for(let i=0;i<10;i++){const c=new THREE.Mesh(cellG,new THREE.MeshBasicMaterial({color:OFF}));c.position.copy(cellPos(i));tank.add(c);cells.push(c)}
const setCell=(i,c)=>cells[i].material.color.set(c);
const slotWorld=i=>cellPos(i).add(tank.position);

// ---------- tweens, sound
const tw=[];const ease=t=>t<.5?2*t*t:1-(-2*t+2)**2/2;
const tween=(d,fn,wait=0)=>new Promise(res=>tw.push({t:-wait,d,fn,res}));
const hop=(m,to,wait=0,h=1.6)=>new Promise(r=>{const f=m.position.clone();tween(.4,k=>{m.position.lerpVectors(f,to,k);m.position.y+=Math.sin(k*Math.PI)*h},wait).then(r)});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function beep(f,d=.1,v=.05,type='triangle',at=0){if(!sound)return;ac||=new (window.AudioContext||window.webkitAudioContext)();const o=ac.createOscillator(),g=ac.createGain(),t=ac.currentTime+at;o.type=type;o.frequency.value=f;g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.001,t+d);o.connect(g).connect(ac.destination);o.start(t);o.stop(t+d)}
function rev(){if(!sound)return;ac||=new (window.AudioContext||window.webkitAudioContext)();const o=ac.createOscillator(),g=ac.createGain(),t=ac.currentTime;o.type='sawtooth';o.frequency.setValueAtTime(70,t);o.frequency.exponentialRampToValueAtTime(420,t+1.5);o.frequency.exponentialRampToValueAtTime(900,t+2.2);g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(.06,t+.3);g.gain.exponentialRampToValueAtTime(.001,t+2.5);o.connect(g).connect(ac.destination);o.start(t);o.stop(t+2.5)}

// ---------- round
const bottleG=new THREE.CapsuleGeometry(.26,.5,6,16);
const bottleM=new THREE.MeshBasicMaterial({color:BLUE});
let row=[],gaps=[],bars=[],pallets=[];
const say=t=>$('say').textContent=t;
const rowX=(i,n)=>(i-(n-1)/2)*1.15;
const home=(i,n)=>new THREE.Vector3(rowX(i,n),.55,6.3);
function clear(){[...row,...gaps,...bars,...pallets].forEach(o=>o.parent&&o.parent.remove(o));row=[];gaps=[];bars=[];pallets=[];cells.forEach((c,i)=>setCell(i,OFF))}
function pallet(i,instant){
 const g=new THREE.Group();g.position.set(-5.4,3.2+i*.74,-4);
 for(let k=0;k<10;k++){const b=new THREE.Mesh(new RoundedBoxGeometry(.3,.26,.14,2,.05),new THREE.MeshBasicMaterial({color:GOLD}));b.position.set(-.68+(k%5)*.34,k<5?.15:-.15,0);g.add(b)}
 scene.add(g);pallets.push(g);if(!instant){g.scale.setScalar(.01);tween(.35,k=>g.scale.setScalar(.01+.99*k))}}
async function driveIn(){car.rotation.y=RUN;car.position.x=-30;speed=46;await tween(1.1,k=>{car.position.x=-30*(1-k);speed=46*(1-k);car.rotation.y=RUN+(IDLE-RUN)*k});speed=0}
async function start(){
 clear();busy=true;miss=0;$('next').hidden=true;
 const [a,b]=ROUNDS[R],tens=Math.floor(a/10),ones=a%10;
 paint.color.set(PAINT[R%PAINT.length]);
 $('eq').innerHTML=`${a} + <i>${b}</i>`;say('Here comes your car!');
 for(let i=0;i<tens;i++)pallet(i,true);
 for(let i=0;i<ones;i++)setCell(i,GOLD);
 for(let i=0;i<b;i++){const m=new THREE.Mesh(bottleG,bottleM);m.position.copy(home(i,b));scene.add(m);row.push(m)}
 await driveIn();
 for(let k=1;k<b;k++){
  const x=(rowX(k-1,b)+rowX(k,b))/2;
  const hit=new THREE.Mesh(new THREE.BoxGeometry(1.1,3,4),new THREE.MeshBasicMaterial({visible:false}));hit.position.set(x,1,6.3);hit.userData.k=k;scene.add(hit);gaps.push(hit);
  const bar=new THREE.Mesh(new THREE.BoxGeometry(.07,1.15,.07),new THREE.MeshBasicMaterial({color:new THREE.Color(0xffffff).multiplyScalar(1.2)}));bar.position.set(x,.6,6.3);scene.add(bar);bars.push(bar)}
 say('How many to fill the tank? Tap a gap!');busy=false}

async function launch(){
 rev();say('NITRO!');
 const sx=car.position.x;
 await tween(.8,k=>{speed=2*k;car.rotation.y=IDLE+(RUN-IDLE)*k;car.position.y=Math.sin(k*40)*.012});car.position.y=0;   // burnout on the spot
 flames.forEach(f=>f.visible=true);boost=1;
 await tween(1.3,k=>{speed=2+58*k;car.position.x=sx+k*k*2.2});
 await tween(.55,k=>{speed=60;car.position.x=sx+2.2+k*30});
 flames.forEach(f=>f.visible=false);boost=0;speed=0}
async function cut(k){
 if(busy)return;busy=true;beep(620,.08);
 const [a,b]=ROUNDS[R],ones=a%10,need=10-ones,take=row.slice(0,k);
 await Promise.all(take.map((m,i)=>{const fits=i<need,to=fits?slotWorld(ones+i):new THREE.Vector3(-2.4+(i-need)*1.1,5.5,-2.9);
  return hop(m,to,i*.11).then(()=>{beep(440+i*50,.07);if(fits){m.visible=false;setCell(ones+i,BLUE)}})}));
 if(k===need){
  bars.forEach(o=>o.parent.remove(o));gaps.forEach(o=>o.parent.remove(o));bars=[];gaps=[];
  const whole=a+need,rest=row.slice(k);beep(880,.15);beep(1100,.25,.05,'triangle',.12);
  say('Tank full! Ten!');$('eq').innerHTML=`${a} + <i>${need}</i> + <b>${rest.length}</b>`;
  await pause(800);$('eq').innerHTML=`<b>${whole}</b> + <b>${rest.length}</b>`;
  await launch();
  pallet(Math.floor(a/10));cells.forEach((c,i)=>setCell(i,OFF));
  await driveIn();
  await Promise.all(rest.map((m,i)=>hop(m,slotWorld(i),i*.13).then(()=>{beep(500+i*60,.07);m.visible=false;setCell(i,BLUE)})));
  const s=miss===0?1:0;stars+=s;$('stars').textContent='★ '+stars;
  say('Say the answer out loud!');$('next').textContent='SHOW ME';$('next').hidden=false;
  $('next').onclick=()=>{$('eq').innerHTML=`${a} + <i>${b}</i> = <b>${a+b}</b>`;beep(660,.12);beep(880,.2,.05,'triangle',.12);
   say(s?'Perfect cut!':'You did it!');$('next').textContent=R<ROUNDS.length-1?'NEXT CAR':'FINISH';$('next').onclick=()=>{R++;if(R<ROUNDS.length)start();else finish()}};
 }else{
  miss++;beep(170,.3,.06,'sawtooth');
  say(k<need?'Not full yet! Count the empty places.':'Too many! They do not fit.');
  edge.material.color.set(0xff2020);await pause(550);edge.material.color.set(new THREE.Color(0x27e4ff).multiplyScalar(1.6));
  for(let i=ones;i<10;i++)setCell(i,OFF);
  await Promise.all(take.map((m,i)=>{m.visible=true;return hop(m,home(i,b),i*.05)}));
  if(miss>1)hint();else say('Try again! Tap a gap.');
  busy=false}}
function hint(){const ones=ROUNDS[R][0]%10;say(`${ones} and how many make 10? Look at the empty places.`);
 const c=new THREE.Color(0xffffff).multiplyScalar(1.2);tween(1.6,k=>{for(let i=ones;i<10;i++)cells[i].material.color.lerpColors(c,new THREE.Color(OFF),k)})}
function finish(){clear();$('ov').hidden=false;$('box').innerHTML=`<h1>CHAMPION!</h1><p>★ ${stars} of ${ROUNDS.length} perfect cuts</p><button id="act" type="button">RACE AGAIN</button>`;$('act').onclick=()=>{R=0;stars=0;$('stars').textContent='★ 0';$('ov').hidden=true;start()}}

// ---------- input
const ray=new THREE.Raycaster(),v=new THREE.Vector2();
renderer.domElement.addEventListener('pointerdown',e=>{if(busy)return;v.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);ray.setFromCamera(v,cam);const h=ray.intersectObjects(gaps)[0];if(h)cut(h.object.userData.k)});
$('snd').textContent=sound?'Sound on':'Sound off';$('snd').onclick=()=>{sound=!sound;$('snd').textContent=sound?'Sound on':'Sound off'};
$('act').onclick=()=>{$('ov').hidden=true;$('stars').textContent='★ 0';start()};

// ---------- loop
const clock=new THREE.Clock();let frames=0,fpsT=0,lowered=false;
renderer.setAnimationLoop(()=>{const d=Math.min(clock.getDelta(),.05),now=performance.now()/1000;
 for(let i=tw.length-1;i>=0;i--){const x=tw[i];x.t+=d;if(x.t<0)continue;const k=Math.min(x.t/x.d,1);x.fn(ease(k));if(k>=1){tw.splice(i,1);x.res()}}
 worldX+=speed*d;
 for(const m of movers){const w=m.w||span;m.o.position.x=((m.x-worldX*m.p)%w+w*1.5)%w-w*.5}
 wheels.forEach(w=>w.rotation.x-=speed*d/.33);
 for(const s of streaks){s.material.opacity=boost?.9:Math.min(speed/40,.5);s.scale.x=1+speed*.32;s.position.x-=speed*d*1.6;if(s.position.x<-46)s.position.x=46}
 flames.forEach((f,i)=>{f.scale.set(1,.8+Math.random()*.7,1)});
 bloom.strength+=((boost?.7:.28)-bloom.strength)*.08;
 const fov=38+Math.min(speed,60)*.26;if(Math.abs(fov-cam.fov)>.02){cam.fov+=(fov-cam.fov)*.1;cam.updateProjectionMatrix()}
 const sh=boost?.06:speed>1?.012:0;
 cam.position.set(Math.sin(now*.22)*.35*camK+Math.sin(now*61)*sh,3.6*camK+Math.sin(now*73)*sh,14.5*camK);cam.lookAt(0,2.05,0);
 bars.forEach(b=>b.scale.y=.75+.25*Math.sin(now*5));
 composer.render();
 // tablets: drop resolution once if it cannot hold the frame rate
 if(!lowered){frames++;fpsT+=d;if(fpsT>3){if(frames/fpsT<28){renderer.setPixelRatio(1);composer.setPixelRatio(1);lowered=true}frames=0;fpsT=0}}
});
window.__game={get R(){return R},get busy(){return busy},gaps:()=>gaps.map(g=>g.userData.k),cut,get stars(){return stars},eq:()=>$('eq').textContent};

import * as THREE from 'three';
import {RGBELoader} from 'three/addons/loaders/RGBELoader.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

const $=id=>document.getElementById(id);
const ROUNDS=[[8,5],[9,4],[7,5],[6,7],[9,6],[18,4],[27,5],[36,7],[45,8],[59,3]];
let R=0,busy=true,miss=0,stars=0,sound=!/[?&]mute/.test(location.search),ac;

// ---------- scene
const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.setSize(innerWidth,innerHeight);
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0xbfe6ff);scene.fog=new THREE.Fog(0xbfe6ff,34,70);
const cam=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.1,120);
function fit(){const a=innerWidth/innerHeight,k=Math.max(1,1.55/a);cam.aspect=a;cam.position.set(0,11.5*k,15.5*k);cam.lookAt(0,0,.6);cam.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)}
fit();addEventListener('resize',fit);
new RGBELoader().load('../hoops/assets/gym.hdr',t=>{t.mapping=THREE.EquirectangularReflectionMapping;const p=new THREE.PMREMGenerator(renderer);scene.environment=p.fromEquirectangular(t).texture;scene.environmentIntensity=.7;t.dispose();p.dispose()});
scene.add(new THREE.HemisphereLight(0xffffff,0x9fc27a,1.1));
const sun=new THREE.DirectionalLight(0xfff2d8,2.6);sun.position.set(-8,16,9);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-20,right:20,top:16,bottom:-16,far:50});sun.shadow.bias=-.0004;scene.add(sun);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(120,80),new THREE.MeshStandardMaterial({color:0x8fcf6a,roughness:.95}));
ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
const road=new THREE.Mesh(new THREE.PlaneGeometry(120,5.2),new THREE.MeshStandardMaterial({color:0x59626e,roughness:.85}));
road.rotation.x=-Math.PI/2;road.position.set(0,.01,0);road.receiveShadow=true;scene.add(road);
for(let x=-40;x<40;x+=5){const d=new THREE.Mesh(new THREE.PlaneGeometry(2.4,.16),new THREE.MeshBasicMaterial({color:0xf4e9b0}));d.rotation.x=-Math.PI/2;d.position.set(x,.02,2.3);scene.add(d)}
const belt=new THREE.Mesh(new RoundedBoxGeometry(17,.34,2.2,3,.12),new THREE.MeshStandardMaterial({color:0x2d3640,roughness:.55}));
belt.position.set(0,.17,5.1);belt.castShadow=belt.receiveShadow=true;scene.add(belt);

const P=(color,o={})=>new THREE.MeshPhysicalMaterial({color,roughness:.34,clearcoat:.8,clearcoatRoughness:.22,...o});
const M={gold:P(0xffb91f),blue:P(0x1f8bff),red:P(0xe63d2e),tray:P(0x3a4656,{roughness:.6,clearcoat:.2}),tyre:new THREE.MeshStandardMaterial({color:0x1b1e22,roughness:.8}),hub:P(0xdfe6ee,{metalness:.7}),glass:P(0x9fdcff,{roughness:.08,metalness:.2}),slot:new THREE.MeshStandardMaterial({color:0x55657a,roughness:.7})};
const blockG=new RoundedBoxGeometry(.9,.9,.9,4,.14);
const block=m=>{const b=new THREE.Mesh(blockG,m);b.castShadow=true;b.receiveShadow=true;return b};

const SLOT=i=>new THREE.Vector3(-3.9+(i%5)*1.05,1.72,i<5?-.56:.56);   // ten frame in the bed, top row first
function makeTruck(){
 const g=new THREE.Group();
 const bed=new THREE.Mesh(new RoundedBoxGeometry(5.7,.36,2.5,3,.1),M.tray);bed.position.set(-1.8,1.08,0);bed.castShadow=true;g.add(bed);
 for(let i=0;i<10;i++){const p=SLOT(i),s=new THREE.Mesh(new RoundedBoxGeometry(.96,.06,.96,2,.03),M.slot);s.position.set(p.x,1.27,p.z);g.add(s)}
 const cab=new THREE.Mesh(new RoundedBoxGeometry(2.2,2,2.5,4,.3),M.red);cab.position.set(2.2,1.9,0);cab.castShadow=true;g.add(cab);
 const nose=new THREE.Mesh(new RoundedBoxGeometry(1.1,1.1,2.4,4,.25),M.red);nose.position.set(3.7,1.45,0);nose.castShadow=true;g.add(nose);
 const win=new THREE.Mesh(new RoundedBoxGeometry(1.5,.8,2.56,3,.1),M.glass);win.position.set(2.4,2.3,0);g.add(win);
 for(const x of [-3.2,-.8,3]) for(const z of [-1.2,1.2]){
  const w=new THREE.Mesh(new THREE.CylinderGeometry(.68,.68,.5,32),M.tyre);w.rotation.x=Math.PI/2;w.position.set(x,.68,z);w.castShadow=true;g.add(w);
  const h=new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,.54,20),M.hub);h.rotation.x=Math.PI/2;h.position.set(x,.68,z);g.add(h);(g.userData.w||=[]).push(w)}
 g.position.y=0;scene.add(g);return g}

// ---------- tweens
const tw=[];const ease=t=>t<.5?2*t*t:1-(-2*t+2)**2/2;
const tween=(d,fn,wait=0)=>new Promise(res=>tw.push({t:-wait,d,fn,res}));
const hop=(m,to,wait=0,h=2.4)=>{const f=m.position.clone();return tween(.42,k=>{m.position.lerpVectors(f,to,k);m.position.y+=Math.sin(k*Math.PI)*h},wait)};
const roll=(g,x,d)=>{const f=g.position.x;return tween(d,k=>{g.position.x=f+(x-f)*k;g.userData.w.forEach(w=>w.rotation.y=g.position.x*-1.4)})};

// ---------- sound
function beep(f,d=.1,v=.05,type='triangle',at=0){if(!sound)return;ac||=new (window.AudioContext||window.webkitAudioContext)();const o=ac.createOscillator(),g=ac.createGain(),t=ac.currentTime+at;o.type=type;o.frequency.value=f;g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.001,t+d);o.connect(g).connect(ac.destination);o.start(t);o.stop(t+d)}
const honk=()=>{beep(330,.22,.07,'square');beep(415,.3,.07,'square',.26)};

// ---------- round
let truck,gold=[],row=[],gaps=[],pallets=[],bars=[];
const say=t=>$('say').textContent=t;
const rowX=(i,n)=>(i-(n-1)/2)*1.32;
function clear(){[...gold,...row,...gaps,...bars,...pallets].forEach(o=>{o.parent&&o.parent.remove(o)});gold=[];row=[];gaps=[];bars=[];pallets=[]}
function pallet(i,instant){
 const g=new THREE.Group();g.position.set(-8+i*3.1,0,-5);
 const base=new THREE.Mesh(new RoundedBoxGeometry(2.6,.16,1.3,2,.05),M.tray);base.position.y=.08;base.castShadow=true;g.add(base);
 for(let k=0;k<10;k++){const b=block(M.gold);b.scale.setScalar(.48);b.position.set(-1+(k%5)*.5,.42,k<5?-.26:.26);g.add(b)}
 scene.add(g);pallets.push(g);if(!instant){g.scale.setScalar(.01);tween(.3,k=>g.scale.setScalar(.01+.99*k))}}
async function start(){
 clear();busy=true;miss=0;$('next').hidden=true;
 const [a,b]=ROUNDS[R],tens=Math.floor(a/10),ones=a%10;
 $('eq').innerHTML=`${a} + <i>${b}</i>`;say('Here comes the truck!');
 for(let i=0;i<tens;i++)pallet(i,true);
 if(truck)scene.remove(truck);truck=makeTruck();truck.position.x=-24;
 for(let i=0;i<ones;i++){const m=block(M.gold);m.position.copy(SLOT(i));truck.add(m);gold.push(m)}
 for(let i=0;i<b;i++){const m=block(M.blue);m.position.set(rowX(i,b),.8,5.1);scene.add(m);row.push(m)}
 await roll(truck,1,1.1);
 // gaps: tap one to cut the row there
 for(let k=1;k<b;k++){
  const x=(rowX(k-1,b)+rowX(k,b))/2;
  const hit=new THREE.Mesh(new THREE.BoxGeometry(1.25,2.4,3.4),new THREE.MeshBasicMaterial({visible:false}));hit.position.set(x,1,5.1);hit.userData.k=k;scene.add(hit);gaps.push(hit);
  const bar=new THREE.Mesh(new THREE.BoxGeometry(.12,.05,2),new THREE.MeshBasicMaterial({color:0xffffff}));bar.position.set(x,.37,5.1);scene.add(bar);bars.push(bar)}
 say('How many to fill the truck? Tap a gap to cut!');busy=false}

async function cut(k){
 if(busy)return;busy=true;beep(620,.08);
 const [a,b]=ROUNDS[R],ones=a%10,need=10-ones;
 const take=row.slice(0,k);
 await Promise.all(take.map((m,i)=>{const w=new THREE.Vector3();
  if(i<need)w.copy(SLOT(ones+i)).add(truck.position);else w.set(-3+i*.9,3.2,0);return hop(m,w,i*.12).then(()=>beep(440+i*50,.07))}));
 if(k===need){
  take.forEach(m=>truck.attach(m));honk();say('Full! Ten in the truck!');
  bars.forEach(o=>o.parent.remove(o));gaps.forEach(o=>o.parent.remove(o));bars=[];gaps=[];
  const whole=a+need,rest=row.slice(k);
  $('eq').innerHTML=`${a} + <i>${need}</i> + <b>${rest.length}</b>`;
  await new Promise(r=>setTimeout(r,900));
  $('eq').innerHTML=`<b>${whole}</b> + <b>${rest.length}</b>`;
  const old=truck;await roll(old,26,1);scene.remove(old);
  pallet(Math.floor(a/10));
  truck=makeTruck();truck.position.x=-24;await roll(truck,1,.9);
  await Promise.all(rest.map((m,i)=>{const w=SLOT(i).add(truck.position);return hop(m,w,i*.14).then(()=>beep(500+i*60,.07))}));
  rest.forEach(m=>truck.attach(m));
  const s=miss===0?1:0;stars+=s;$('stars').textContent='★ '+stars;
  say('Say the answer out loud!');$('next').textContent='Show me';$('next').hidden=false;
  $('next').onclick=()=>{$('eq').innerHTML=`${a} + <i>${b}</i> = <b>${a+b}</b>`;beep(660,.12);beep(880,.2,.05,'triangle',.12);
   say(s?'Perfect cut!':'You did it!');$('next').textContent=R<ROUNDS.length-1?'Next truck':'Finish';$('next').onclick=()=>{R++;if(R<ROUNDS.length)start();else finish()}};
 }else{
  miss++;beep(170,.3,.06,'sawtooth');
  say(k<need?'Not full yet! Count the empty places.':'Too many! They do not fit.');
  const f=truck.position.x;await tween(.45,t=>truck.position.x=f+Math.sin(t*Math.PI*6)*.09);truck.position.x=f;
  await Promise.all(take.map((m,i)=>hop(m,new THREE.Vector3(rowX(i,b),.8,5.1),i*.05)));
  if(miss>1)hint();else say('Try again! Tap a gap.');
  busy=false}}
function hint(){const [a]=ROUNDS[R],ones=a%10;say(`${ones} and how many make 10? Look at the empty places.`);for(let i=ones;i<10;i++){const p=SLOT(i).add(truck.position);const r=new THREE.Mesh(new THREE.BoxGeometry(.9,.1,.9),new THREE.MeshBasicMaterial({color:0xffe066,transparent:true}));r.position.copy(p);r.position.y=1.32;scene.add(r);tween(1.6,k=>r.material.opacity=1-k).then(()=>scene.remove(r))}}
function finish(){clear();$('ov').hidden=false;$('box').innerHTML=`<h1>Great driving!</h1><p>★ ${stars} of ${ROUNDS.length} perfect cuts</p><button id="act" type="button">Play again</button>`;$('act').onclick=()=>{R=0;stars=0;$('stars').textContent='★ 0';$('ov').hidden=true;start()}}

// ---------- input
const ray=new THREE.Raycaster(),v=new THREE.Vector2();
renderer.domElement.addEventListener('pointerdown',e=>{if(busy)return;v.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);ray.setFromCamera(v,cam);const h=ray.intersectObjects(gaps)[0];if(h)cut(h.object.userData.k)});
$('snd').textContent=sound?'Sound on':'Sound off';$('snd').onclick=()=>{sound=!sound;$('snd').textContent=sound?'Sound on':'Sound off'};
$('act').onclick=()=>{$('ov').hidden=true;$('stars').textContent='★ 0';start()};

const clock=new THREE.Clock();
renderer.setAnimationLoop(()=>{const d=Math.min(clock.getDelta(),.05);
 for(let i=tw.length-1;i>=0;i--){const x=tw[i];x.t+=d;if(x.t<0)continue;const k=Math.min(x.t/x.d,1);x.fn(ease(k));if(k>=1){tw.splice(i,1);x.res()}}
 const p=.6+.4*Math.sin(performance.now()/260);bars.forEach(b=>b.scale.y=1+p*3);
 renderer.render(scene,cam)});
window.__game={get R(){return R},get busy(){return busy},gaps:()=>gaps.map(g=>g.userData.k),cut,get stars(){return stars},eq:()=>$('eq').textContent};

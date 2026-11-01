import * as THREE from 'three';
import {RGBELoader} from 'three/addons/loaders/RGBELoader.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

const $=id=>document.getElementById(id);
// k: w вода, h выпаривание, s соль, m второй раствор 10%; x: ответ для проверки
const ROUNDS=[
 {k:'w',m:200,p:15,t:10,x:100,fake:[15,10,.15]},
 {k:'w',m:100,p:20,t:10,x:100,fake:[10,.2,200]},
 {k:'w',m:150,p:20,t:12,x:100,fake:[20,12,.2]},
 {k:'h',m:300,p:6,t:10,x:120,fake:[6,10,.06]},
 {k:'s',m:240,p:5,t:20,x:45,fake:[5,20,.05]},
 {k:'m',m:100,p:30,t:15,x:300,fake:[15,10,.3]},
 {k:'w',m:120,p:15,t:9,x:80,fake:[15,9,.15]}];
const MAX=520,TOL=.2,RATE={w:30,h:22,s:12,m:42},LABEL={w:'Держи: ВОДА',h:'Держи: НАГРЕВ',s:'Держи: СОЛЬ',m:'Держи: РАСТВОР 10%'};
let R=0,x=0,on=false,done=false,points=0,tries=0,fill=[],burst=0;
const S=r=>r.m*r.p/100,T=r=>r.t/100;
const mass=()=>{const r=ROUNDS[R];return r.k=='h'?r.m-x:r.m+x};
const salt=()=>{const r=ROUNDS[R];return S(r)+(r.k=='s'?x:r.k=='m'?.1*x:0)};
const conc=()=>100*salt()/mass();

// ---------- сцена
const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
document.body.prepend(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0x04070a);
const cam=new THREE.PerspectiveCamera(36,innerWidth/innerHeight,.1,80);
const composer=new EffectComposer(renderer,new THREE.WebGLRenderTarget(innerWidth,innerHeight,{type:THREE.HalfFloatType,samples:4}));
composer.addPass(new RenderPass(scene,cam));
const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.3,.5,.9);composer.addPass(bloom);composer.addPass(new OutputPass());
function fit(){const a=innerWidth/innerHeight,k=Math.max(1,1.3/a);cam.aspect=a;cam.position.set(0,6.4*k,21*k);cam.lookAt(0,3.7,0);cam.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight)}
fit();addEventListener('resize',fit);
const mgr=new THREE.LoadingManager();mgr.onLoad=()=>{$('act').disabled=false;$('act').textContent='Начать'};
new RGBELoader(mgr).load('../nitro/assets/city.hdr',t=>{t.mapping=THREE.EquirectangularReflectionMapping;const p=new THREE.PMREMGenerator(renderer);scene.environment=p.fromEquirectangular(t).texture;scene.environmentIntensity=1.5;t.dispose();p.dispose()});
const key=new THREE.SpotLight(0xdffff2,260,34,.5,.7);key.position.set(-3,13,8);key.target.position.set(0,2,0);scene.add(key,key.target);
const glowL=new THREE.PointLight(0x3dffb0,70,18);glowL.position.set(-8,5,-3);scene.add(glowL);
const glowR=new THREE.PointLight(0x2f8dff,70,18);glowR.position.set(8,5,-3);scene.add(glowR);

// зеркальный стол
const mirror=new Reflector(new THREE.PlaneGeometry(60,16),{textureWidth:1024,textureHeight:512,color:0x5a6468,clipBias:.003});mirror.rotation.x=-Math.PI/2;scene.add(mirror);
const edge=new THREE.Mesh(new THREE.BoxGeometry(60,.05,.05),new THREE.MeshBasicMaterial({color:new THREE.Color(0x3dffb0).multiplyScalar(1.3)}));edge.position.set(0,.02,7.9);scene.add(edge);
// стена с таблицей элементов
const wc=document.createElement('canvas');wc.width=1024;wc.height=512;const w=wc.getContext('2d');w.fillStyle='#071016';w.fillRect(0,0,1024,512);w.font='bold 26px Arial';w.textAlign='center';
const EL='H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba'.split(' ');
EL.forEach((e,i)=>{const cx=38+(i%14)*68,cy=52+Math.floor(i/14)*68,c=['#16463a','#143a55','#3a2a55'][i%3];w.fillStyle=c;w.fillRect(cx-30,cy-30,60,60);w.fillStyle=e=='Na'||e=='Cl'?'#ffe28a':'#7fd8b8';w.fillText(e,cx,cy+9)});
const wall=new THREE.Mesh(new THREE.PlaneGeometry(40,20),new THREE.MeshBasicMaterial({map:Object.assign(new THREE.CanvasTexture(wc),{colorSpace:THREE.SRGBColorSpace}),color:0x8a9aa0}));wall.position.set(0,9,-9);scene.add(wall);
// стеллаж с колбами
const shelfM=new THREE.MeshStandardMaterial({color:0x2a3338,metalness:.9,roughness:.3});
const flaskPts=[[0,0],[.55,0],[.62,.1],[.2,1.1],[.18,1.5]].map(p=>new THREE.Vector2(...p));
const flaskG=new THREE.LatheGeometry(flaskPts,32),liquidG=new THREE.LatheGeometry([[0,.04],[.5,.04],[.56,.12],[.3,.6],[0,.6]].map(p=>new THREE.Vector2(...p)),32);
const gl=new THREE.MeshPhysicalMaterial({color:0xdfeff5,roughness:.05,transparent:true,opacity:.22,depthWrite:false,side:THREE.DoubleSide});
for(const sx of [-1,1])for(const y of [3.1,6.1]){
 const s=new THREE.Mesh(new RoundedBoxGeometry(7,.14,1.4,2,.05),shelfM);s.position.set(sx*9.4,y,-4.5);scene.add(s);
 for(let i=0;i<5;i++){const c=[0xff2bd6,0x3dffb0,0xffc02e,0x2f8dff,0xff5a3d][(i+(y>4?2:0)+(sx>0?1:0))%5],g=new THREE.Group();g.position.set(sx*9.4-2.7+i*1.35,y+.07,-4.5);
  const l=new THREE.Mesh(liquidG,new THREE.MeshBasicMaterial({color:new THREE.Color(c).multiplyScalar(1.15)}));g.add(l,new THREE.Mesh(flaskG,gl));scene.add(g)}}
// весы с нагревателем
const plate=new THREE.Mesh(new THREE.CylinderGeometry(2.6,2.75,.34,64),new THREE.MeshStandardMaterial({color:0xcfd8dc,metalness:1,roughness:.22}));plate.position.y=.17;scene.add(plate);
const coilM=new THREE.MeshBasicMaterial({color:0x331108});const coil=new THREE.Mesh(new THREE.TorusGeometry(2.2,.07,10,64),coilM);coil.rotation.x=Math.PI/2;coil.position.y=.37;scene.add(coil);
// стакан и деления
const RAD=2,HT=6.4,yOf=m=>.42+m/MAX*(HT-.9);
const glass=new THREE.Mesh(new THREE.LatheGeometry([[0,.38],[RAD-.06,.38],[RAD,.46],[RAD,HT],[RAD+.07,HT+.06]].map(p=>new THREE.Vector2(...p)),72),new THREE.MeshPhysicalMaterial({color:0xdfeff5,roughness:.03,clearcoat:1,transparent:true,opacity:.2,depthWrite:false,side:THREE.DoubleSide,envMapIntensity:2.6}));glass.renderOrder=3;scene.add(glass);
const c=document.createElement('canvas');c.width=512;c.height=1024;const g=c.getContext('2d');g.fillStyle='#fff';g.font='bold 40px Arial';
for(let m=0;m<=500;m+=50){const y=1024-((m/MAX)*(HT-.9)+.42)/HT*1024;g.fillRect(40,y,m%100?44:78,m%100?4:6);if(m%100==0&&m)g.fillText(m,134,y+14)}
const lab=new THREE.Mesh(new THREE.CylinderGeometry(RAD+.02,RAD+.02,HT,72,1,true,-.9,1.8),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false}));lab.position.y=HT/2;lab.renderOrder=4;scene.add(lab);
// жидкость с волнами
const liqM=new THREE.MeshPhysicalMaterial({color:0x18a0ff,roughness:.05,transparent:true,opacity:.84,clearcoat:1,envMapIntensity:1.4});
const liq=new THREE.Mesh(new THREE.CylinderGeometry(RAD-.08,RAD-.08,1,72,1,true),liqM);liq.renderOrder=1;scene.add(liq);
const surfG=new THREE.CircleGeometry(RAD-.08,72,0,Math.PI*2);const ringG=new THREE.RingGeometry(.001,RAD-.08,72,10);
const surf=new THREE.Mesh(ringG,new THREE.MeshPhysicalMaterial({color:0x9fe3ff,roughness:.04,transparent:true,opacity:.72,clearcoat:1,side:THREE.DoubleSide}));surf.rotation.x=-Math.PI/2;surf.renderOrder=2;scene.add(surf);
const base0=ringG.attributes.position.array.slice();
const glowIn=new THREE.PointLight(0x37b6ff,0,9);scene.add(glowIn);
// кран и бутыль
const steel=new THREE.MeshStandardMaterial({color:0xdfe7ea,metalness:1,roughness:.18});
const arm=new THREE.Mesh(new THREE.CylinderGeometry(.14,.14,4.6,24),steel);arm.rotation.z=Math.PI/2;arm.position.set(-1.9,8.5,0);const nozzle=new THREE.Mesh(new THREE.CylinderGeometry(.14,.2,.7,24),steel);nozzle.position.set(.4,8.2,0);const stand=new THREE.Mesh(new THREE.CylinderGeometry(.16,.22,8.6,24),steel);stand.position.set(-4.1,4.3,0);scene.add(arm,nozzle,stand);
const stream=new THREE.Mesh(new THREE.CylinderGeometry(.09,.06,1,16),new THREE.MeshPhysicalMaterial({color:0xbfeaff,roughness:.05,transparent:true,opacity:.78}));stream.visible=false;scene.add(stream);
const grains=[];for(let i=0;i<46;i++){const s=new THREE.Mesh(new THREE.BoxGeometry(.05,.05,.05),new THREE.MeshBasicMaterial({color:0xffffff}));s.visible=false;s.position.set(.4,8-Math.random()*5,0);scene.add(s);grains.push(s)}
const bubbles=[];for(let i=0;i<34;i++){const b=new THREE.Mesh(new THREE.SphereGeometry(.05+Math.random()*.06,10,8),new THREE.MeshBasicMaterial({color:0xd8f4ff,transparent:true,opacity:.55}));b.visible=false;scene.add(b);bubbles.push(b)}
// пар
const sc=document.createElement('canvas');sc.width=sc.height=64;const sg=sc.getContext('2d'),gr=sg.createRadialGradient(32,32,2,32,32,32);gr.addColorStop(0,'#ffffffaa');gr.addColorStop(1,'#ffffff00');sg.fillStyle=gr;sg.fillRect(0,0,64,64);
const steam=[];const sm=new THREE.SpriteMaterial({map:new THREE.CanvasTexture(sc),transparent:true,depthWrite:false,opacity:.5});for(let i=0;i<24;i++){const s=new THREE.Sprite(sm);s.visible=false;scene.add(s);steam.push(s)}
// кристаллы при точном попадании
const crystals=[];const cM=new THREE.MeshPhysicalMaterial({color:0xbff7ff,emissive:0x3dffb0,emissiveIntensity:.6,roughness:.1,metalness:.1});
for(let i=0;i<16;i++){const m=new THREE.Mesh(new THREE.OctahedronGeometry(.28+Math.random()*.34,0),cM);const a=i*2.4,r=.25+(i%5)*.3;m.position.set(Math.cos(a)*r,.72,Math.sin(a)*r);m.rotation.set(i,i*2,i*3);m.scale.setScalar(.001);scene.add(m);crystals.push(m)}
const sparks=[];for(let i=0;i<60;i++){const s=new THREE.Mesh(new THREE.SphereGeometry(.04,6,6),new THREE.MeshBasicMaterial({color:new THREE.Color(0x3dffb0).multiplyScalar(2)}));s.visible=false;scene.add(s);sparks.push({s,v:new THREE.Vector3()})}

function show(){const m=mass(),y=yOf(m);liq.scale.y=y-.44;liq.position.y=.44+(y-.44)/2;surf.position.y=y;glowIn.position.y=y-.8;
 const k=Math.min(conc()/30,1),r=ROUNDS[R];const col=new THREE.Color().setHSL(.56-.42*k,.95,.52-.12*k);liqM.color.copy(col);surf.material.color.copy(col).lerp(new THREE.Color(0xffffff),.45);
 $('mass').textContent=Math.round(m)}
function setCrystals(v){crystals.forEach((m,i)=>m.scale.setScalar(.001+v*(.6+(i%4)*.25)))}

// ---------- уравнение из карточек
const SLOTS={w:r=>[['s'],['m','+ x'],['t']],h:r=>[['s'],['m','− x'],['t']],s:r=>[['s','+ x'],['m','+ x'],['t']],m:r=>[['s','+','k','· x'],['m','+ x'],['t']]};
function answers(r){const a={s:S(r),m:r.m,t:T(r)};if(r.k=='m')a.k=.1;return a}
function drawEq(){const r=ROUNDS[R],sl=SLOTS[r.k](r),box=$('eq');box.innerHTML='';
 const cell=id=>{const e=document.createElement('span');e.className='slot'+(fill[id]!=null?' on':'');e.textContent=fill[id]??'?';e.onclick=()=>{fill[id]=null;drawEq();drawTiles()};return e};
 const part=arr=>{const sp=document.createElement('span');arr.forEach(a=>{if('smtk'.includes(a))sp.append(cell(a));else sp.append(a)});return sp};
 const fr=document.createElement('span');fr.className='fr';fr.append(part(sl[0]),part(sl[1]));box.append(fr,' = ',cell('t'))}
let pool=[];
function drawTiles(){const box=$('tiles');box.innerHTML='';const used=Object.values(fill).filter(v=>v!=null);const left=[...used];
 pool.forEach(v=>{const b=document.createElement('button');b.type='button';b.textContent=v;const i=left.indexOf(v);if(i>=0){left.splice(i,1);b.disabled=true}b.onclick=()=>place(v);box.append(b)})}
function place(v){const r=ROUNDS[R],a=answers(r),id=Object.keys(a).find(k=>fill[k]==null);if(!id)return;fill[id]=v;drawEq();drawTiles();
 if(Object.keys(a).every(k=>fill[k]!=null)){const bad=Object.keys(a).filter(k=>fill[k]!==a[k]);
  if(!bad.length){$('form').hidden=true;$('controls').hidden=false;$('pour').textContent=LABEL[r.k]}
  else{tries++;bad.forEach(k=>fill[k]=null);drawEq();drawTiles();[...$('eq').querySelectorAll('.slot:not(.on)')].forEach(e=>e.classList.add('bad'))}}}
function start(){const r=ROUNDS[R];x=0;done=false;tries=0;burst=0;setCrystals(0);$('res').hidden=true;$('controls').hidden=true;$('form').hidden=false;
 $('num').textContent=`ПРОБА ${R+1} ИЗ ${ROUNDS.length}`;$('pts').textContent=points+' очк.';
 const T0={w:`В стакане <b>${r.m} г</b> раствора, соли <b>${r.p}%</b>. Сколько воды долить, чтобы стало <b>${r.t}%</b>?`,h:`В стакане <b>${r.m} г</b> раствора, соли <b>${r.p}%</b>. Сколько воды выпарить, чтобы стало <b>${r.t}%</b>?`,s:`В стакане <b>${r.m} г</b> раствора, соли <b>${r.p}%</b>. Сколько соли досыпать, чтобы стало <b>${r.t}%</b>?`,m:`В стакане <b>${r.m} г</b> раствора, соли <b>${r.p}%</b>. Сколько раствора <b>10%</b> влить, чтобы стало <b>${r.t}%</b>?`};
 $('txt').innerHTML=T0[r.k];fill={};const a=answers(r);pool=[...new Set([...Object.values(a),...r.fake])].sort((p,q)=>p-q);drawEq();drawTiles();show()}
function test(){if(done)return;const r=ROUNDS[R],cn=conc(),ok=Math.abs(cn-r.t)<=TOL;$('res').hidden=false;
 const off=Math.max(-1,Math.min(1,(cn-r.t)/(r.t*.5)));$('n').style.left='50%';requestAnimationFrame(()=>$('n').style.left=(50+off*46)+'%');
 $('rt').textContent=ok?'ТОЧНО!':(cn>r.t?'Слишком крепкий':'Слишком слабый');$('rt').style.color=ok?'#3dffb0':'#ff8b6b';
 $('rd').textContent=`Анализ: ${cn.toFixed(1)}%, нужно ${r.t}%.`;
 if(ok){done=true;const p=Math.max(40,100-tries*20-Math.round(Math.abs(x-r.x)*2));points+=p;$('pts').textContent=points+' очк.';burst=1;
  sparks.forEach(o=>{o.s.visible=true;o.s.position.set(Math.random()*2-1,surf.position.y,Math.random()*2-1);o.v.set(Math.random()*6-3,3+Math.random()*7,Math.random()*6-3)});
  $('rd').textContent+=` +${p} очков`;$('rb').textContent=R<ROUNDS.length-1?'Следующая проба':'Итог';$('rb').onclick=()=>{R++;if(R<ROUNDS.length)start();else finish()}}
 else{tries++;const more=(r.k=='w'||r.k=='h'||r.k=='m')?cn>r.t&&r.k!='h'||(r.k=='h'&&cn<r.t):cn<r.t;
  $('rb').textContent=more?'Продолжить':'Начать заново';$('rb').onclick=()=>{$('res').hidden=true;if(!more){x=0;show()}}}}
function finish(){const max=ROUNDS.length*100,k=points/max,rank=k>.9?'Профессор':k>.7?'Старший химик':k>.5?'Химик':'Лаборант';$('ov').hidden=false;$('box').innerHTML=`<h1>${rank}</h1><p>${points} очков из ${max}</p><button id="act" type="button">Ещё раз</button>`;$('act').onclick=()=>{R=0;points=0;$('ov').hidden=true;start()}}

const b=$('pour'),go=e=>{e.preventDefault();if(!done)on=true},stop=()=>on=false;
b.addEventListener('pointerdown',go);b.addEventListener('pointerup',stop);b.addEventListener('pointerleave',stop);b.addEventListener('pointercancel',stop);
$('test').onclick=test;$('again').onclick=()=>{if(done)return;x=0;$('res').hidden=true;show()};
$('act').onclick=()=>{$('ov').hidden=true;start()};

const clock=new THREE.Clock();
renderer.setAnimationLoop(()=>{const d=Math.min(clock.getDelta(),.05),now=performance.now()/1000,r=ROUNDS[R];
 if(on&&!done){const lim=r.k=='h'?r.m-S(r)-20:MAX-r.m;if(x<lim){x+=RATE[r.k]*d;show()}}
 const top=surf.position.y,flow=on&&(r.k=='w'||r.k=='m'),amp=on?.05:.012;
 stream.visible=flow;if(flow){const h=7.9-top;stream.scale.set(.9+Math.sin(now*40)*.12,h,.9+Math.sin(now*40)*.12);stream.position.set(.4,top+h/2,0);stream.material.color.set(r.k=='m'?0xffc27a:0xbfeaff)}
 grains.forEach(s=>{s.visible=on&&r.k=='s';if(s.visible){s.position.y-=d*7;s.position.x=.4+Math.sin(s.id*3)*.16;if(s.position.y<top)s.position.y=7.9}});
 const heat=on&&r.k=='h';coilM.color.lerp(new THREE.Color(heat?0xff5a18:0x331108),.1);
 steam.forEach((s,i)=>{if(heat&&!s.visible&&Math.random()<.08){s.visible=true;s.position.set((i%5-2)*.5,top,(i%3-1)*.5);s.scale.setScalar(.6)}else if(s.visible){s.position.y+=d*2.4;s.scale.addScalar(d*1.6);if(s.position.y>top+6)s.visible=false}});
 bubbles.forEach((q,i)=>{if((on||heat)&&!q.visible){if(Math.random()<.12){q.visible=true;q.position.set(Math.sin(i)*1.3,Math.max(.6,top-2.4*Math.random()),Math.cos(i*2)*1.3)}}else if(q.visible){q.position.y+=d*1.8;if(q.position.y>top)q.visible=false}});
 const p=ringG.attributes.position;for(let i=0;i<p.count;i++){const X=base0[i*3],Y=base0[i*3+1],dist=Math.hypot(X-.4,Y);p.setZ(i,Math.sin(dist*6-now*(on?13:2.4))*amp*Math.max(0,1-dist/5))}p.needsUpdate=true;
 if(burst>0&&burst<1.2){burst+=d*.5;setCrystals(Math.min(burst-1+.4,.6)+.4)}
 if(done){cM.emissiveIntensity=.6+Math.sin(now*4)*.4;glowIn.intensity+=(90-glowIn.intensity)*.06}else glowIn.intensity+=(0-glowIn.intensity)*.1;
 sparks.forEach(o=>{if(o.s.visible){o.v.y-=9*d;o.s.position.addScaledVector(o.v,d);if(o.s.position.y<.05)o.s.visible=false}});
 bloom.strength+=((done?.6:.3)-bloom.strength)*.06;
 cam.position.x=Math.sin(now*.2)*.5;cam.lookAt(0,3.7,0);
 composer.render()});
window.__game={get R(){return R},conc,set(v){x=v;show()},test,res:()=>$('rt').textContent,pts:()=>points,place,ans:()=>{const a=answers(ROUNDS[R]);return Object.values(a)},pour:()=>$('controls').hidden};

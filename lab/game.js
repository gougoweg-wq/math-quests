import * as THREE from 'three';
import {RGBELoader} from 'three/addons/loaders/RGBELoader.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

const $=id=>document.getElementById(id);
// m: раствор, г; p: соли, %; t: нужно, %; add: что доливаем
const ROUNDS=[{m:200,p:15,t:10,add:'w'},{m:100,p:20,t:10,add:'w'},{m:150,p:20,t:12,add:'w'},{m:300,p:10,t:6,add:'w'},{m:80,p:25,t:20,add:'w'},{m:120,p:15,t:9,add:'w'},{m:240,p:5,t:20,add:'s'}];
const MAX=520,TOL=.2;
let R=0,water=0,salt=0,pouring=null,done=false,score=0,tries=0;

const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
document.body.prepend(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0x05090d);
const cam=new THREE.PerspectiveCamera(36,innerWidth/innerHeight,.1,60);
function fit(){const a=innerWidth/innerHeight,k=Math.max(1,1.25/a);cam.aspect=a;cam.position.set(0,6.6*k,20*k);cam.lookAt(0,3.9,0);cam.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)}
fit();addEventListener('resize',fit);
const mgr=new THREE.LoadingManager();mgr.onLoad=()=>{$('act').disabled=false;$('act').textContent='Начать'};
new RGBELoader(mgr).load('../nitro/assets/city.hdr',t=>{t.mapping=THREE.EquirectangularReflectionMapping;const p=new THREE.PMREMGenerator(renderer);scene.environment=p.fromEquirectangular(t).texture;scene.environmentIntensity=1.6;t.dispose();p.dispose()});
const key=new THREE.SpotLight(0xdffff2,220,30,.5,.6);key.position.set(-3,12,6);key.target.position.set(0,2,0);scene.add(key,key.target);
const back=new THREE.PointLight(0x3dffb0,40,16);back.position.set(0,5,-5);scene.add(back);

const bench=new THREE.Mesh(new RoundedBoxGeometry(22,.5,9,4,.08),new THREE.MeshPhysicalMaterial({color:0x10171c,metalness:.6,roughness:.22,clearcoat:1}));bench.position.y=-.25;scene.add(bench);
const wall=new THREE.Mesh(new THREE.PlaneGeometry(50,24),new THREE.MeshStandardMaterial({color:0x0b1317,metalness:.5,roughness:.5}));wall.position.set(0,8,-5);scene.add(wall);
for(const x of [-9,9]){const l=new THREE.Mesh(new THREE.BoxGeometry(.1,16,.1),new THREE.MeshBasicMaterial({color:0x7dffd0}));l.position.set(x,8,-4.8);scene.add(l)}

// весы
const plate=new THREE.Mesh(new THREE.CylinderGeometry(2.5,2.6,.3,64),new THREE.MeshStandardMaterial({color:0xcfd8dc,metalness:1,roughness:.25}));plate.position.y=.15;scene.add(plate);
// стакан с делениями
const RAD=2,HT=6.4;
const pts=[[RAD-.06,.34],[RAD,.42],[RAD,HT],[RAD+.06,HT+.06]].map(p=>new THREE.Vector2(...p));
const glass=new THREE.Mesh(new THREE.LatheGeometry(pts,72),new THREE.MeshPhysicalMaterial({color:0xdfeff5,metalness:0,roughness:.04,clearcoat:1,transparent:true,opacity:.2,depthWrite:false,side:THREE.DoubleSide,envMapIntensity:2.4}));scene.add(glass);
const base=new THREE.Mesh(new THREE.CylinderGeometry(RAD,RAD,.1,72),new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:.05,transparent:true,opacity:.3}));base.position.y=.36;scene.add(base);
const yOf=m=>.4+m/MAX*(HT-.9);
const c=document.createElement('canvas');c.width=512;c.height=1024;const g=c.getContext('2d');g.clearRect(0,0,512,1024);g.fillStyle='#ffffffd0';g.font='bold 40px Arial';
for(let m=0;m<=500;m+=50){const y=1024-(m/MAX)*1024*(HT-.9)/HT-1024*.4/HT;g.fillRect(40,y,m%100?44:78,m%100?4:6);if(m%100==0&&m)g.fillText(m,134,y+14)}
const lab=new THREE.Mesh(new THREE.CylinderGeometry(RAD+.02,RAD+.02,HT,72,1,true,-.9,1.8),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false}));lab.position.y=HT/2;scene.add(lab);
// жидкость
const liqM=new THREE.MeshPhysicalMaterial({color:0x18a0ff,roughness:.06,metalness:0,transparent:true,opacity:.82,clearcoat:1,envMapIntensity:1.4});
const liq=new THREE.Mesh(new THREE.CylinderGeometry(RAD-.08,RAD-.08,1,72),liqM);scene.add(liq);
const topD=new THREE.Mesh(new THREE.CircleGeometry(RAD-.08,72),new THREE.MeshPhysicalMaterial({color:0x8fdcff,roughness:.05,transparent:true,opacity:.6}));topD.rotation.x=-Math.PI/2;scene.add(topD);
// кран и струя
const steel=new THREE.MeshStandardMaterial({color:0xdfe7ea,metalness:1,roughness:.2});
const arm=new THREE.Mesh(new THREE.CylinderGeometry(.14,.14,4.6,24),steel);arm.rotation.z=Math.PI/2;arm.position.set(-1.8,8.3,0);scene.add(arm);
const nozzle=new THREE.Mesh(new THREE.CylinderGeometry(.14,.18,.7,24),steel);nozzle.position.set(.4,8,0);scene.add(nozzle);
const stand=new THREE.Mesh(new THREE.CylinderGeometry(.16,.2,8.4,24),steel);stand.position.set(-4,4.2,0);scene.add(stand);
const stream=new THREE.Mesh(new THREE.CylinderGeometry(.09,.06,1,16),new THREE.MeshPhysicalMaterial({color:0xbfeaff,roughness:.05,transparent:true,opacity:.75}));stream.visible=false;scene.add(stream);
const grains=[];for(let i=0;i<40;i++){const s=new THREE.Mesh(new THREE.BoxGeometry(.05,.05,.05),new THREE.MeshStandardMaterial({color:0xffffff}));s.visible=false;s.position.set(.4,8-Math.random()*5,0);scene.add(s);grains.push(s)}
const bubbles=[];for(let i=0;i<26;i++){const b=new THREE.Mesh(new THREE.SphereGeometry(.05+Math.random()*.05,10,8),new THREE.MeshPhysicalMaterial({color:0xffffff,transparent:true,opacity:.5,roughness:0}));b.visible=false;scene.add(b);bubbles.push(b)}

const conc=()=>{const r=ROUNDS[R],s=r.m*r.p/100+salt;return 100*s/(r.m+water+salt)};
function show(){const r=ROUNDS[R],m=r.m+water+salt,y=yOf(m);liq.scale.y=y-.42;liq.position.y=.42+(y-.42)/2;topD.position.y=y;
 const k=Math.min(conc()/25,1);liqM.color.setRGB(.05+.28*(1-k),.5+.28*(1-k),1);$('mass').textContent=Math.round(m)}
function start(){const r=ROUNDS[R];water=0;salt=0;done=false;tries=0;$('res').hidden=true;$('hint').hidden=true;
 $('num').textContent=`ПРОБА ${R+1} ИЗ ${ROUNDS.length}`;
 $('txt').innerHTML=r.add=='w'?`В стакане <b>${r.m} г</b> раствора, соли <b>${r.p}%</b>.<br>Долей воды, чтобы соли стало <b>${r.t}%</b>.`:`★ В стакане <b>${r.m} г</b> раствора, соли <b>${r.p}%</b>.<br>Досыпь соли, чтобы стало <b>${r.t}%</b>.`;
 $('pour').hidden=r.add!='w';$('salt').hidden=r.add!='s';show()}
function hint(){const r=ROUNDS[R],s=r.m*r.p/100;$('hint').hidden=false;$('hint').textContent=r.add=='w'?`Соли ${s} г, она не меняется. ${s} / (${r.m} + x) = ${r.t/100}`:`(${s} + x) / (${r.m} + x) = ${r.t/100}. Соль добавляется и сверху, и снизу.`}
function test(){if(done)return;const r=ROUNDS[R],cn=conc(),ok=Math.abs(cn-r.t)<=TOL;$('res').hidden=false;
 const added=water+salt;$('rt').textContent=ok?'ТОЧНО!':(cn>r.t?'Слишком крепкий':'Слишком слабый');$('rt').style.color=ok?'#3dffb0':'#ff8b6b';
 $('rd').textContent=`Концентрация ${cn.toFixed(1)}%, нужно ${r.t}%. Добавлено ${Math.round(added)} г.`;
 if(ok){done=true;if(tries==0)score++;$('rb').textContent=R<ROUNDS.length-1?'Следующая проба':'Готово';$('rb').onclick=()=>{R++;if(R<ROUNDS.length)start();else finish()}}
 else{tries++;const more=r.add=='w'?cn>r.t:cn<r.t;$('rb').textContent=more?'Добавить ещё':'Начать заново';$('rb').onclick=()=>{$('res').hidden=true;hint();if(!more){water=0;salt=0;show()}}}}
function finish(){$('ov').hidden=false;$('box').innerHTML=`<h1>ГОТОВО</h1><p>С первой попытки: ${score} из ${ROUNDS.length}</p><button id="act" type="button">Ещё раз</button>`;$('act').onclick=()=>{R=0;score=0;$('ov').hidden=true;start()}}

const hold=(b,k)=>{const on=e=>{e.preventDefault();if(!done)pouring=k},off=()=>pouring=null;b.addEventListener('pointerdown',on);b.addEventListener('pointerup',off);b.addEventListener('pointerleave',off);b.addEventListener('pointercancel',off)};
hold($('pour'),'w');hold($('salt'),'s');
$('test').onclick=test;$('again').onclick=()=>{if(done)return;water=0;salt=0;$('res').hidden=true;show()};
$('act').onclick=()=>{$('ov').hidden=true;start()};

const clock=new THREE.Clock();
renderer.setAnimationLoop(()=>{const d=Math.min(clock.getDelta(),.05),now=performance.now()/1000;
 if(pouring){const r=ROUNDS[R],rate=pouring=='w'?30:12;if(r.m+water+salt<MAX){if(pouring=='w')water+=rate*d;else salt+=rate*d;show()}}
 const top=topD.position.y;stream.visible=pouring=='w';if(stream.visible){const h=7.7-top;stream.scale.y=h;stream.position.set(.4,top+h/2,0);stream.scale.x=stream.scale.z=.9+Math.sin(now*40)*.12}
 grains.forEach(s=>{s.visible=pouring=='s';if(s.visible){s.position.y-=d*7;s.position.x=.4+Math.sin(s.id)*.14;if(s.position.y<top)s.position.y=7.7}});
 bubbles.forEach((b,i)=>{if(pouring&&!b.visible){if(Math.random()<.12){b.visible=true;b.position.set(.4+Math.sin(i)*1,Math.max(.6,top-1.6*Math.random()),Math.cos(i*2)*1)}}else if(b.visible){b.position.y+=d*1.6;if(b.position.y>top)b.visible=false}});
 topD.position.x=Math.sin(now*30)*(pouring?.012:0);
 renderer.render(scene,cam)});
window.__game={get R(){return R},conc,set(w,s){water=w;salt=s;show()},test,eq:()=>$('txt').textContent,res:()=>$('rt').textContent};

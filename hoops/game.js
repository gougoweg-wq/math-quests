import * as THREE from 'three';
import {RGBELoader} from 'three/addons/loaders/RGBELoader.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

const $=id=>document.getElementById(id);
const SPOTS={2:[0,3.6],3:[-4.4,4.6],4:[4.4,4.6],5:[0,8],10:[5.6,11.2]};
const BAND={2:.3,3:.25,4:.22,5:.17,10:.1};
const PTS=[2,3,4,5,10],MAXB=12,HOOP=new THREE.Vector3(0,3.05,0);
// type: spot = the spot is fixed, balls = the balls are fixed, free = player chooses both
const ROUNDS=[
 {q:1,spot:2,target:8},{q:1,spot:5,target:15},{q:1,spot:10,target:40},
 {q:2,balls:5,target:15},{q:2,balls:4,target:12},{q:2,balls:4,target:20},
 {q:3,spot:3,target:18},{q:3,spot:4,target:20},{q:3,spot:5,target:35},
 {q:4,target:20},{q:4,target:12},{q:4,target:30}];

let R=0,spot=2,balls=1,score=0,left=0,fails=0,phase='load',total=0,shots=0,stars=0,muted=true;
const mistakes=[];

// ---------- scene
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.setSize(innerWidth,innerHeight);
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0x060810);scene.fog=new THREE.Fog(0x060810,32,70);
const cam=new THREE.PerspectiveCamera(52,innerWidth/innerHeight,.1,120);
const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,cam));
const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.32,.6,.92);composer.addPass(bloom);composer.addPass(new OutputPass());

const load=$('load').firstChild;
const mgr=new THREE.LoadingManager();mgr.onProgress=(u,a,b)=>load.style.width=a/b*100+'%';
const tl=new THREE.TextureLoader(mgr);
const tex=(f,srgb)=>{const t=tl.load(f);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(5,3);t.anisotropy=8;if(srgb)t.colorSpace=THREE.SRGBColorSpace;return t};
new RGBELoader(mgr).load('assets/gym.hdr',t=>{t.mapping=THREE.EquirectangularReflectionMapping;const p=new THREE.PMREMGenerator(renderer);scene.environment=p.fromEquirectangular(t).texture;scene.environmentIntensity=.55;t.dispose();p.dispose()});

const floor=new THREE.Mesh(new THREE.PlaneGeometry(34,24),new THREE.MeshStandardMaterial({map:tex('assets/floor_diff.jpg',1),normalMap:tex('assets/floor_nor.jpg'),roughnessMap:tex('assets/floor_rough.jpg'),roughness:.55,metalness:.05,color:0xffc690}));
floor.rotation.x=-Math.PI/2;floor.position.z=8;floor.receiveShadow=true;scene.add(floor);

function canvasTex(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),c);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t}
const lines=canvasTex(2040,1440,g=>{const s=60,X=x=>1020+x*s,Z=z=>(z+4)*s;g.strokeStyle='#fff';g.lineWidth=7;
 g.fillStyle='#b5301eaa';g.fillRect(X(-2.45),Z(-.9),4.9*s,6.7*s);g.strokeRect(X(-2.45),Z(-.9),4.9*s,6.7*s);
 g.beginPath();g.arc(X(0),Z(5.8),1.8*s,0,Math.PI*2);g.stroke();
 g.beginPath();g.moveTo(X(-6.6),Z(-.9));g.lineTo(X(-6.6),Z(1.6));g.arc(X(0),Z(0),7*s,Math.PI-.363,.363,true);g.lineTo(X(6.6),Z(-.9));g.stroke();
 g.strokeRect(X(-15),Z(-.9),30*s,24.5*s);g.beginPath();g.moveTo(X(-15),Z(13));g.lineTo(X(15),Z(13));g.stroke();g.beginPath();g.arc(X(0),Z(13),1.8*s,0,Math.PI*2);g.stroke()});
const lm=new THREE.Mesh(new THREE.PlaneGeometry(34,24),new THREE.MeshStandardMaterial({map:lines,transparent:true,roughness:.5,polygonOffset:true,polygonOffsetFactor:-2}));
lm.rotation.x=-Math.PI/2;lm.position.set(0,.006,8);lm.receiveShadow=true;scene.add(lm);

// spot discs
const discs={};
for(const p of PTS){const t=canvasTex(256,256,g=>{g.fillStyle='#ffcf33';g.beginPath();g.arc(128,128,122,0,7);g.fill();g.fillStyle='#0b1020';g.beginPath();g.arc(128,128,102,0,7);g.fill();g.fillStyle='#ffcf33';g.font='400 118px Anton,Impact,sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(p,128,136)});
 const m=new THREE.Mesh(new THREE.CircleGeometry(.85,48),new THREE.MeshStandardMaterial({map:t,transparent:true,emissive:0xffffff,emissiveMap:t,emissiveIntensity:.42,polygonOffset:true,polygonOffsetFactor:-4}));
 m.rotation.x=-Math.PI/2;m.position.set(SPOTS[p][0],.014,SPOTS[p][1]);m.userData.p=p;scene.add(m);discs[p]=m}

// hoop
const hoop=new THREE.Group();scene.add(hoop);
const steel=new THREE.MeshStandardMaterial({color:0x202634,metalness:.85,roughness:.32});
const post=new THREE.Mesh(new THREE.CylinderGeometry(.13,.17,4.2,20),steel);post.position.set(0,2.1,-2.1);post.castShadow=true;hoop.add(post);
const arm=new THREE.Mesh(new THREE.BoxGeometry(.16,.16,1.65),steel);arm.position.set(0,3.8,-1.3);arm.castShadow=true;hoop.add(arm);
const base=new THREE.Mesh(new THREE.BoxGeometry(1.5,.32,1.8),new THREE.MeshStandardMaterial({color:0xff5a12,roughness:.4}));base.position.set(0,.16,-2.2);base.castShadow=true;hoop.add(base);
const board=new THREE.Mesh(new THREE.BoxGeometry(1.83,1.07,.05),new THREE.MeshPhysicalMaterial({color:0xcfe6ff,metalness:0,roughness:.05,transmission:.75,thickness:.05,transparent:true,opacity:.65}));board.position.set(0,3.5,-.48);hoop.add(board);
const frame=(w,h,x,y,z)=>{const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,.07),new THREE.MeshStandardMaterial({color:0xffffff,emissive:0xffffff,emissiveIntensity:.25}));b.position.set(x,y,z);hoop.add(b)};
frame(1.87,.05,0,4.05,-.47);frame(1.87,.05,0,2.96,-.47);frame(.05,1.1,-.93,3.5,-.47);frame(.05,1.1,.93,3.5,-.47);
frame(.6,.04,0,3.48,-.44);frame(.6,.04,0,3.06,-.44);frame(.04,.45,-.3,3.27,-.44);frame(.04,.45,.3,3.27,-.44);
const rim=new THREE.Mesh(new THREE.TorusGeometry(.23,.018,14,48),new THREE.MeshStandardMaterial({color:0xff4d0a,metalness:.55,roughness:.3,emissive:0x661800}));rim.rotation.x=Math.PI/2;rim.position.copy(HOOP);rim.castShadow=true;hoop.add(rim);
const brace=new THREE.Mesh(new THREE.BoxGeometry(.05,.03,.26),rim.material);brace.position.set(0,3.05,-.36);hoop.add(brace);
const netG=new THREE.BufferGeometry(),netP=[];const S=14,L=5;
const ringR=l=>.225-.105*l/L;for(let i=0;i<S;i++)for(let l=0;l<L;l++){const a=i/S*6.283+l*.22,b=(i+1)/S*6.283+(l+1)*.22,c=(i-1)/S*6.283+(l+1)*.22,y0=-l*.085,y1=-(l+1)*.085,r0=ringR(l),r1=ringR(l+1);netP.push(Math.cos(a)*r0,y0,Math.sin(a)*r0,Math.cos(b)*r1,y1,Math.sin(b)*r1,Math.cos(a)*r0,y0,Math.sin(a)*r0,Math.cos(c)*r1,y1,Math.sin(c)*r1)}
netG.setAttribute('position',new THREE.Float32BufferAttribute(netP,3));
const net=new THREE.LineSegments(netG,new THREE.LineBasicMaterial({color:0xf5f7ff,transparent:true,opacity:.92}));net.position.copy(HOOP);hoop.add(net);

// arena
const wall=new THREE.MeshStandardMaterial({color:0x101a33,roughness:.8});
const add=(g,m,x,y,z,sh)=>{const o=new THREE.Mesh(g,m);o.position.set(x,y,z);if(sh)o.receiveShadow=true;scene.add(o);return o};
add(new THREE.BoxGeometry(60,20,.5),wall,0,10,-9);add(new THREE.BoxGeometry(60,20,.5),wall,0,10,34);
add(new THREE.BoxGeometry(.5,20,50),wall,-24,10,10);add(new THREE.BoxGeometry(.5,20,50),wall,24,10,10);
add(new THREE.BoxGeometry(60,.5,50),new THREE.MeshStandardMaterial({color:0x05070d}),0,18,10);
const lampMat=new THREE.MeshBasicMaterial({color:0xfff4dc});lampMat.color.multiplyScalar(2.6);
for(const x of [-9,0,9])for(const z of [0,8,16])add(new THREE.BoxGeometry(3.6,.14,1.1),lampMat,x,17.5,z);
// stands and crowd
const standMat=new THREE.MeshStandardMaterial({color:0x162444,roughness:.7});
const crowd=[],kits=[0xff6a1a,0x2d7dff,0xf2f4fa,0xffcf33,0x23c26a,0xd8324f,0x1a2240];
const addRow=(sx,sz,w,row,along)=>{const h=.7+row*.62,o=7.4+row*.88;const px=along?0:sx*(16+row*.88),pz=along?sz*0+(-5-0)+0:sz;
 if(along){const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,.9),standMat);b.position.set(0,h/2,31-(-row*0)-(4-row)*.9-1);scene.add(b);for(let x=-w/2+.5;x<w/2;x+=.68)crowd.push([x+Math.random()*.1,h+.42,b.position.z])}
 else{const b=new THREE.Mesh(new THREE.BoxGeometry(.9,h,w),standMat);b.position.set(px,h/2,pz);b.receiveShadow=true;scene.add(b);for(let z=pz-w/2+.5;z<pz+w/2;z+=.68)crowd.push([px,h+.42,z+Math.random()*.1])}};
for(let r=0;r<7;r++){addRow(-1,9,27,r);addRow(1,9,27,r)}
const pers=new THREE.InstancedMesh(new THREE.CapsuleGeometry(.21,.42,4,10),new THREE.MeshStandardMaterial({roughness:.75}),crowd.length);
const heads=new THREE.InstancedMesh(new THREE.SphereGeometry(.16,14,12),new THREE.MeshStandardMaterial({roughness:.6}),crowd.length);
const M=new THREE.Matrix4(),C=new THREE.Color();const skin=[0xf0c8a0,0xc48e62,0x8c5a38,0x5e3c28];
crowd.forEach((p,i)=>{if(Math.random()<.14)p[1]=-9;M.makeTranslation(...p);pers.setMatrixAt(i,M);M.makeTranslation(p[0],p[1]+.46,p[2]);heads.setMatrixAt(i,M);pers.setColorAt(i,C.setHex(kits[i*7%kits.length]));heads.setColorAt(i,C.setHex(skin[i*3%4]));p[3]=Math.random()*6.28});
pers.frustumCulled=heads.frustumCulled=false;scene.add(pers,heads);
// boards around the court
const ad=canvasTex(1024,128,g=>{g.fillStyle='#0d1730';g.fillRect(0,0,1024,128);g.font='400 76px Anton,Impact,sans-serif';g.textBaseline='middle';for(let i=0;i<4;i++){g.fillStyle=i%2?'#ffcf33':'#ff7a1a';g.fillText(i%2?'3 × 6 = 18':'HOOP MATHS',20+i*256,68)}});
for(const x of [-14.9,14.9]){const b=add(new THREE.BoxGeometry(.1,1,26),new THREE.MeshStandardMaterial({color:0x0d1730,emissive:0xffffff,emissiveMap:ad,emissiveIntensity:.8,map:ad}),x,.5,9);ad.wrapS=THREE.RepeatWrapping;b.castShadow=true}
// wall scoreboard
const sbCanvas=document.createElement('canvas');sbCanvas.width=1024;sbCanvas.height=420;const sbg=sbCanvas.getContext('2d');const sbTex=new THREE.CanvasTexture(sbCanvas);sbTex.colorSpace=THREE.SRGBColorSpace;
const sb=new THREE.Mesh(new THREE.PlaneGeometry(9,3.7),new THREE.MeshBasicMaterial({map:sbTex}));sb.position.set(0,9.6,-8.7);scene.add(sb);
function drawBoard(){const g=sbg;g.fillStyle='#02040a';g.fillRect(0,0,1024,420);g.strokeStyle='#ff7a1a';g.lineWidth=10;g.strokeRect(8,8,1008,404);g.textAlign='center';g.textBaseline='middle';g.font='400 58px Anton,Impact,sans-serif';g.fillStyle='#9fb0cf';g.fillText('TARGET',256,88);g.fillText('SCORE',768,88);g.font='400 230px Anton,Impact,sans-serif';g.fillStyle='#ffcf33';g.fillText(ROUNDS[R]?ROUNDS[R].target:0,256,262);g.fillStyle=score>(ROUNDS[R]?.target??0)?'#ff5a5a':'#ff3d2e';g.fillText(score,768,262);sbTex.needsUpdate=true}
// lights
const key=new THREE.SpotLight(0xfff1dc,2200,60,.72,.45,1.6);key.position.set(0,16,7);key.target.position.set(0,0,5);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.bias=-.0004;scene.add(key,key.target);
const s2=new THREE.SpotLight(0xdce8ff,900,40,.5,.6,1.6);s2.position.set(0,14,-3);s2.target.position.copy(HOOP);scene.add(s2,s2.target);
scene.add(new THREE.HemisphereLight(0x8aa0d0,0x301c10,.45));

// ball
const ballTex=canvasTex(1024,512,g=>{g.fillStyle='#e0601a';g.fillRect(0,0,1024,512);for(let i=0;i<9000;i++){g.fillStyle=`rgba(${Math.random()<.5?'90,30,0':'255,170,110'},.2)`;g.fillRect(Math.random()*1024,Math.random()*512,2,2)}g.strokeStyle='#1c0e06';g.lineWidth=11;g.beginPath();g.moveTo(0,256);g.lineTo(1024,256);g.moveTo(256,0);g.lineTo(256,512);g.moveTo(768,0);g.lineTo(768,512);g.stroke();for(const x of [0,512,1024]){g.beginPath();g.ellipse(x,256,180,300,0,0,7);g.stroke()}});
const ball=new THREE.Mesh(new THREE.SphereGeometry(.122,40,28),new THREE.MeshStandardMaterial({map:ballTex,bumpMap:ballTex,bumpScale:.4,roughness:.62}));ball.castShadow=true;ball.visible=false;scene.add(ball);

// confetti
const conf=new THREE.InstancedMesh(new THREE.PlaneGeometry(.1,.16),new THREE.MeshStandardMaterial({side:THREE.DoubleSide}),260);conf.visible=false;conf.frustumCulled=false;scene.add(conf);
const bits=[...Array(260)].map((_,i)=>{conf.setColorAt(i,C.setHex(kits[i%6]));return{}});let confT=0;
const blast=()=>{bits.forEach(b=>{b.x=(Math.random()-.5)*14;b.y=11+Math.random()*7;b.z=Math.random()*14-2;b.v=1.2+Math.random()*1.8;b.s=Math.random()*6});conf.visible=true;confT=6};

// ---------- sound (off by default, the toggle is on screen)
let ac;const tone=(f,d=.12,t=0,type='sine',v=.12)=>{if(muted)return;try{ac=ac||new (window.AudioContext||window.webkitAudioContext)();ac.resume();const o=ac.createOscillator(),g=ac.createGain(),s=ac.currentTime+t;o.type=type;o.frequency.value=f;g.gain.setValueAtTime(v,s);g.gain.exponentialRampToValueAtTime(.001,s+d);o.connect(g).connect(ac.destination);o.start(s);o.stop(s+d)}catch(e){}};
const swish=()=>{tone(900,.22,0,'triangle',.08);tone(1400,.16,.03,'sine',.05);[523,659,784].forEach((f,i)=>tone(f,.12,.1+i*.07))};
const clank=()=>{tone(210,.18,0,'square',.1);tone(140,.22,.05,'square',.08)};
const buzzer=()=>tone(110,.7,0,'sawtooth',.14);
$('mute').onclick=e=>{muted=!muted;e.currentTarget.textContent=muted?'Sound off':'Sound on'};

// ---------- flow
const round=()=>ROUNDS[R],toast=(t,c)=>{const e=$('toast');e.textContent=t;e.style.color=c||'#fff';e.style.opacity=1;clearTimeout(e._t);e._t=setTimeout(()=>e.style.opacity=0,820)};
function setSpots(){const r=round(),box=$('spots');box.replaceChildren();PTS.forEach(p=>{const b=document.createElement('button');b.type='button';b.className='sp'+(p===spot?' on':'');b.innerHTML=`${p}<small>POINTS</small>`;b.disabled=r.spot!=null&&r.spot!==p;b.onclick=()=>{if(phase==='plan'){spot=p;render()}};box.append(b)})}
function render(){const r=round();$('tgt').textContent=r.target;$('sc').textContent=score;$('bl').textContent=phase==='plan'?balls:left;
 $('quarter').innerHTML=`QUARTER ${r.q}<span>${'★'.repeat(stars)}</span>`;
 $('mission').textContent=phase==='plan'?(r.spot?`Each shot is ${r.spot} points. How many balls for exactly ${r.target}?`:r.balls?`You have ${r.balls} balls. Which spot gives exactly ${r.target}?`:`Score exactly ${r.target}. You choose the spot and the balls.`):`${spot} points each · shoot all ${balls}`;
 setSpots();const b=$('balls');b.replaceChildren(...Array.from({length:balls},()=>Object.assign(document.createElement('i'),{className:'bl'})));$('n').textContent=balls;
 $('minus').disabled=r.balls!=null||balls<=1;$('plus').disabled=r.balls!=null||balls>=MAXB;
 for(const p of PTS){const on=p===spot,dis=r.spot!=null&&r.spot!==p;discs[p].material.opacity=dis?.25:1;discs[p].scale.setScalar(on?1.28:1);discs[p].material.emissiveIntensity=on?1.1:.42}
 drawBoard()}
function startRound(){const r=round();phase='plan';score=0;spot=r.spot??2;balls=r.balls??1;$('count').replaceChildren();$('plan').hidden=false;$('meter').hidden=true;$('tip').hidden=true;$('ov').hidden=true;ball.visible=false;fails=0;camTo='plan';render()}
function replan(){phase='plan';score=0;$('count').replaceChildren();$('plan').hidden=false;$('meter').hidden=true;$('tip').hidden=true;$('ov').hidden=true;ball.visible=false;camTo='plan';render()}
function play(){if(phase!=='plan')return;phase='aim';left=balls;score=0;$('plan').hidden=true;$('tip').hidden=false;$('meter').hidden=false;setBand();camTo='shot';hold=false;power=0;placeBall();render()}
let bandLo=.5,bandHi=.7;
function setBand(){const w=BAND[spot],c=.62;bandLo=c-w/2;bandHi=c+w/2;const b=$('band');b.style.bottom=bandLo*100+'%';b.style.height=w*100+'%'}
const shotDir=new THREE.Vector3();
function placeBall(){const s=SPOTS[spot];shotDir.set(s[0],0,s[1]).normalize();ball.position.set(s[0]-shotDir.x*.3+shotDir.z*.26,1.42,s[1]-shotDir.z*.3-shotDir.x*.26);ball.visible=true;ball.rotation.set(0,0,0);phase='aim'}
function addCount(v,cls){const i=document.createElement('i');i.textContent=v;if(cls)i.className=cls;$('count').append(i)}

let hold=false,power=0,dirUp=1,ballSt=null;
function release(){if(phase!=='aim'||!hold)return;hold=false;shots++;const made=power>=bandLo&&power<=bandHi,short=power<bandLo;throwBall(made,short)}
function throwBall(made,short){phase='flight';$('tip').hidden=true;const start=ball.position.clone();let end=HOOP.clone();const off=new THREE.Vector3(shotDir.x,0,shotDir.z);
 if(!made){if(short)end=HOOP.clone().add(off.clone().multiplyScalar(.27)).setY(3.08);else end=new THREE.Vector3(off.z*.42,3.62,-.42)}
 const dist=start.distanceTo(end),T=.72+dist*.05,peak=Math.max(end.y,start.y)+1+dist*.22;ballSt={start,end,T,peak,t:0,made,short}}
function afterShot(made){
 if(made){score+=spot;left--;total+=spot;addCount(score,score>round().target?'b':'');swish();cheer=1.4;net.scale.y=1.5;if(score===round().target&&left===0)toast('EXACT!','#7cf0a8');else if(score>round().target)toast(`${score}: TOO MANY!`,'#ff8b8b');else toast(`+${spot}`,'#ffcf33')}
 else{addCount('miss','w');$('count').lastChild.style.fontSize='18px';clank();toast('MISS, TRY AGAIN','#ffb48a')}
 render();
 if(made&&score>round().target){endRound();return}
 if(left===0){endRound();return}
 setTimeout(()=>{if(phase==='flight'||phase==='free'){power=0;placeBall()}},made?600:900)}
function endRound(){phase='result';setTimeout(showResult,950)}
function showResult(){const r=round(),t=r.target,ok=score===t,box=$('box');$('meter').hidden=true;ball.visible=false;
 if(ok){const st=fails===0?3:fails===1?2:1;stars+=st;blast();
  box.innerHTML=`<h1>Exactly ${t}!</h1><div id="stars">${'★'.repeat(st)}</div><div class="eq">${spot} × ${balls} = ${t}</div><div class="eq g">${t} ÷ ${spot} = ${balls}</div><p>${r.spot==null&&r.balls==null?`${balls} shots from the ${spot} spot.`:'Well played, coach.'}</p><button id="act" type="button">${R+1<ROUNDS.length?'NEXT PLAY':'FINAL WHISTLE'}</button>`;
  $('act').onclick=()=>{R++;R<ROUNDS.length?startRound():finish()}}
 else{fails++;buzzer();mistakes.push(`${t}: ${spot} × ${balls}`);const over=score>t,got=spot*balls;
  box.innerHTML=`<h1>${over?'Too many!':'Not enough!'}</h1><div class="eq">${spot} × ${balls} = ${got}</div><p>You needed ${t}. Count in ${spot}s: ${[...Array(Math.min(balls,10))].map((_,i)=>(i+1)*spot).join(', ')}</p><button id="act" type="button">PLAN AGAIN</button>`;
  $('act').onclick=replan}
 $('ov').hidden=false}
function finish(){const box=$('box');blast();box.innerHTML=`<h1>Full time!</h1><div id="stars">${stars} ★</div><p>Points scored: ${total}. Shots taken: ${shots}.</p><p>${mistakes.length?'Practise: '+[...new Set(mistakes)].slice(0,6).join(' · '):'No wrong plans. Perfect game!'}</p><button id="act" type="button">PLAY AGAIN</button>`;$('act').onclick=()=>{R=0;stars=0;total=0;shots=0;mistakes.length=0;startRound()};$('ov').hidden=false}

// input
const down=e=>{if(e.target.closest&&e.target.closest('button'))return;if(phase==='aim'){hold=true;power=0;dirUp=1}else if(phase==='plan')pick(e)};
const ray=new THREE.Raycaster(),ndc=new THREE.Vector2();
function pick(e){if(round().spot!=null)return;ndc.set(e.clientX/innerWidth*2-1,-(e.clientY/innerHeight)*2+1);ray.setFromCamera(ndc,cam);const h=ray.intersectObjects(Object.values(discs))[0];if(h){spot=h.object.userData.p;render()}}
renderer.domElement.addEventListener('pointerdown',down);addEventListener('pointerup',release);
addEventListener('keydown',e=>{if(e.code==='Space'&&!e.repeat&&phase==='aim'){hold=true;power=0;dirUp=1;e.preventDefault()}});addEventListener('keyup',e=>{if(e.code==='Space')release()});
$('minus').onclick=()=>{if(balls>1){balls--;render()}};$('plus').onclick=()=>{if(balls<MAXB){balls++;render()}};$('go').onclick=play;

// camera
let camTo='plan';const camP=new THREE.Vector3(0,8.5,19),look=new THREE.Vector3(0,1.5,5),wantP=new THREE.Vector3(),wantL=new THREE.Vector3();
cam.position.copy(camP);
addEventListener('resize',()=>{cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight)});

// loop
const clock=new THREE.Clock();let cheer=0,t0=0;const tmp=new THREE.Vector3();
function step(dt){t0+=dt;
 if(hold&&phase==='aim'){power+=dirUp*dt*.8;if(power>=1){power=1;dirUp=-1}if(power<=0){power=0;dirUp=1}}
 if(!$('meter').hidden)$('pin').style.bottom=`calc(${power*100}% - 3px)`;
 if(ballSt){const s=ballSt;s.t+=dt/s.T;const u=Math.min(s.t,1),a=s.start,b=s.end;tmp.lerpVectors(a,b,u);const base=a.y+(b.y-a.y)*u;tmp.y=base+(s.peak-Math.max(a.y,b.y))*4*u*(1-u)+(1-u)*u*(b.y-a.y)*.0;ball.position.copy(tmp);ball.rotation.x-=dt*9;
  if(u>=1){const made=s.made,sh=s.short;ballSt=null;vel.set(made?0:(sh?shotDir.x*1.6:shotDir.x*.8+(Math.random()-.5)),made?-5.5:1.8,made?0:(sh?shotDir.z*2.2:shotDir.z*2.4));phase='free';freeT=0;afterShot(made)}}
 else if(ball.visible&&phase!=='aim'&&phase!=='plan'&&!ballSt){freeT+=dt;vel.y-=9.8*dt;ball.position.addScaledVector(vel,dt);ball.rotation.x-=vel.length()*dt*2;if(ball.position.y<.122){ball.position.y=.122;vel.y=Math.abs(vel.y)*.62;vel.x*=.8;vel.z*=.8}}
 net.scale.y+=(1-net.scale.y)*Math.min(1,dt*9);
 cheer=Math.max(0,cheer-dt);
 if(camTo==='plan'){wantP.set(0,8.8,19.5);wantL.set(0,1.1,5.2)}else{const s=SPOTS[spot],d=tmp.set(s[0],0,s[1]).normalize();wantP.set(s[0]+d.x*1.9,1.95,s[1]+d.z*1.9);wantL.set(0,2.75,0)}
 const k=Math.min(1,dt*3.2);camP.lerp(wantP,k);look.lerp(wantL,k);cam.position.copy(camP);cam.lookAt(look);
 if(cheer>0||t0<.05){crowd.forEach((p,i)=>{if(p[1]<0)return;const j=Math.abs(Math.sin(t0*9+p[3]))*.16*Math.min(cheer,1);M.makeTranslation(p[0],p[1]+j,p[2]);pers.setMatrixAt(i,M);M.makeTranslation(p[0],p[1]+.46+j,p[2]);heads.setMatrixAt(i,M)});pers.instanceMatrix.needsUpdate=heads.instanceMatrix.needsUpdate=true}
 if(confT>0){confT-=dt;const o=new THREE.Object3D();bits.forEach((b,i)=>{b.y-=b.v*dt;b.s+=dt*5;o.position.set(b.x+Math.sin(b.s)*.3,b.y,b.z);o.rotation.set(b.s,b.s*.7,0);o.updateMatrix();conf.setMatrixAt(i,o.matrix)});conf.instanceMatrix.needsUpdate=true;if(confT<=0)conf.visible=false}}
const vel=new THREE.Vector3();let freeT=0;
renderer.setAnimationLoop(()=>{step(Math.min(clock.getDelta(),.05));composer.render()});

mgr.onLoad=()=>{const box=$('box');$('hud').hidden=false;box.innerHTML=`<h1>Hoop Maths</h1><p>You are the coach and the shooter.</p><p>Pick the spot and the balls, then score <b>exactly</b> the target.</p><button id="act" type="button">TIP OFF</button>`;$('act').onclick=()=>{R=0;startRound()};drawBoard()};
window.__h={get s(){return{R,spot,balls,score,left,phase,fails,stars}},set(p,b){spot=p;balls=b;render()},play,shoot(pw){power=pw;hold=true;release()},next(){$('act')?.click()},cam,ROUNDS};

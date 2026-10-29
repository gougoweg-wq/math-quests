// Общий движок мини-квестов: config.levels[i].gen() -> {q, a, hint, visual?, kind}
(function(){
const C=window.QUEST;const $=id=>document.getElementById(id);
const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
let lv=0,ti=0,task=null,input='',busy=false,muted=false,score=0,streak=0,wrongs=0,cur=null,lockUntil=0;
const log=C.levels.map(()=>[]);
document.title=C.title;
document.body.insertAdjacentHTML('afterbegin',`<canvas id="fx"></canvas><div class="wrap">
<header><div class="logo">${C.icon} ${C.title}</div><div class="hud"><button class="ib" id="mute" type="button" aria-label="Выключить звук">🔊</button><div class="pill" id="scoreP">${C.coin} <span id="score">0</span></div></div></header>
<nav class="levels" id="levels" aria-label="Уровни"></nav>
<section class="stage" id="stage" aria-hidden="true"></section>
<section class="card"><div class="prog" id="prog"></div><div class="tag" id="tag"></div><div class="q" id="q"></div><div class="vis" id="vis"></div>
<div class="row"><div class="screen empty" id="screen">?</div></div><div class="msg" id="msg"></div><div class="hint" id="hint" hidden></div>
<div class="pad" id="pad"></div><div class="row"><button class="btn sec" id="hintBtn" type="button">Подсказка</button></div><p class="small">Можно печатать с клавиатуры, Enter — ответ.</p></section>
<details><summary>Для учителя</summary><div id="report"></div></details></div>
<div class="overlay" id="start"><div class="modal"><div class="big">${C.icon}</div><h2>${C.title}</h2><p>${C.intro}</p><button class="btn" id="play" type="button">${C.playLabel||'Начать'}</button></div></div>`);

let ac=null;function audio(){try{if(!ac)ac=new (window.AudioContext||window.webkitAudioContext)();if(ac.state!=='running')ac.resume()}catch(e){}}
addEventListener('pointerdown',audio);addEventListener('keydown',audio);
function tone(f,d,v=.15,delay=0,type='triangle'){if(!ac||muted)return;const t=ac.currentTime+delay;const o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.setValueAtTime(f,t);g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.001,t+d);o.connect(g).connect(ac.destination);o.start(t);o.stop(t+d)}
const sOk=()=>{tone(660,.1);tone(990,.18,.15,.08)},sBad=()=>tone(180,.25,.1,0,'sawtooth'),sWin=()=>[523,659,784,1047].forEach((f,i)=>tone(f,.3,.14,i*.12));

const fx=$('fx'),ctx=fx.getContext('2d');let parts=[],on=false;
function size(){fx.width=innerWidth*devicePixelRatio;fx.height=innerHeight*devicePixelRatio}
function burst(x,y,n){const P=C.particles;for(let i=0;i<n;i++){const a=Math.random()*6.28,s=2+Math.random()*6;parts.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-3,l:1,r:3+Math.random()*5,c:P[i%P.length]})}if(!on)loop()}
function loop(){on=true;const d=devicePixelRatio;ctx.clearRect(0,0,fx.width,fx.height);parts=parts.filter(p=>p.l>0);parts.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=.2;p.l-=.018;ctx.globalAlpha=Math.max(0,p.l);ctx.fillStyle=p.c;ctx.beginPath();ctx.arc(p.x*d,p.y*d,p.r*d,0,7);ctx.fill()});ctx.globalAlpha=1;if(parts.length)requestAnimationFrame(loop);else on=false}

function newTask(){task=C.levels[lv].gen();input='';wrongs=0;cur={kind:task.kind||C.levels[lv].name,q:task.q,a:task.a,first:true,hint:false};
  const p=$('prog');p.replaceChildren();for(let i=0;i<C.levels[lv].n;i++)p.append(el('i',i<ti?'on':i===ti?'cur':''));
  $('tag').textContent=C.levels[lv].name+' · '+(ti+1)+' из '+C.levels[lv].n;$('q').textContent=task.q;$('q').classList.toggle('long',task.q.length>28);
  const v=$('vis');v.replaceChildren();if(task.visual){v.hidden=false;task.visual(v)}else v.hidden=true;
  $('msg').textContent='';$('hint').hidden=true;$('hint').textContent=task.hint;$('hintBtn').disabled=false;draw()}
function draw(){const s=$('screen');s.textContent=input?input.replace('-','−'):'?';s.classList.toggle('empty',!input)}
function press(k){if(busy)return;if(performance.now()<lockUntil){const m=$('msg');m.className='msg bad';m.textContent=C.lockMsg||'Подожди…';return}
  if(k==='del')input=input.slice(0,-1);else if(k==='go'){submit();return}else if(k==='neg')input=input.startsWith('-')?input.slice(1):'-'+input;else if(input.replace('-','').length<5)input=(input==='0'?'':input)+k;draw()}
function submit(){if(!input||input==='-'||busy)return;const v=+input,m=$('msg');
  if(v===task.a){busy=true;streak++;const gain=1+(C.streakBonus&&streak>=3?1:0);score+=gain;$('score').textContent=score;sOk();m.className='msg ok';
    m.textContent=(streak>=3&&C.streakBonus?C.streakBonus+' ':'')+C.praise[Math.floor(Math.random()*C.praise.length)];
    const r=$('screen').getBoundingClientRect();burst(r.left+r.width/2,r.top,30);C.onCorrect&&C.onCorrect($('stage'),score,streak);
    setTimeout(()=>{busy=false;log[lv].push(cur);report();ti++;if(ti>=C.levels[lv].n)done();else newTask()},900)}
  else{cur.first=false;wrongs++;streak=0;sBad();m.className='msg bad';m.textContent=C.wrongMsg||'Не то, попробуй ещё';input='';draw();
    const s=$('screen');s.classList.remove('bad');void s.offsetWidth;s.classList.add('bad');
    if(C.lockMs){lockUntil=performance.now()+C.lockMs;C.onLock&&C.onLock($('stage'))}C.onWrong&&C.onWrong($('stage'));if(wrongs>=2)showHint()}}
function showHint(){cur.hint=true;$('hint').hidden=false;$('hintBtn').disabled=true}
function done(){sWin();for(let i=0;i<5;i++)setTimeout(()=>burst(innerWidth*(.2+Math.random()*.6),innerHeight*.3,30),i*140);
  const ov=el('div','overlay');const m=el('div','modal');const f=log[lv].filter(x=>x.first).length;
  m.append(el('div','big',C.winIcon),el('h2',null,C.winTitle),el('p',null,'С первого раза: '+f+' из '+log[lv].length+'. Всего '+C.coin+' '+score+'.'));
  const last=lv===C.levels.length-1;const b=el('button','btn',last?'Сыграть ещё':'Дальше: '+C.levels[lv+1].name);b.type='button';b.onclick=()=>{ov.remove();go(last?lv:lv+1)};m.append(b);
  if(!last){const b2=el('button','btn sec','Ещё раз');b2.type='button';b2.onclick=()=>{ov.remove();go(lv)};m.append(b2)}ov.append(m);document.body.append(ov);b.focus()}
function go(n){document.querySelectorAll('.overlay').forEach(o=>o.remove());lv=n;ti=0;log[lv]=[];streak=0;C.onLevel&&C.onLevel($('stage'),lv);drawLevels();newTask()}
function drawLevels(){const nav=$('levels');nav.replaceChildren();C.levels.forEach((L,i)=>{const b=el('button','lv',(i+1)+'. '+L.name);b.type='button';b.setAttribute('aria-current',String(i===lv));b.onclick=()=>go(i);nav.append(b)})}
function report(){const box=$('report');box.replaceChildren();const all=log.flat();const kinds=[...new Set(all.map(x=>x.kind))];
  const tb=el('table');const h=el('tr');['Тема','С первого раза','Подсказка','Вывод'].forEach(x=>h.append(el('th',null,x)));tb.append(h);
  kinds.forEach(k=>{const l=all.filter(x=>x.kind===k),f=l.filter(x=>x.first).length,r=f/l.length;const tr=el('tr');tr.append(el('td',null,k),el('td',null,f+' из '+l.length),el('td',null,String(l.filter(x=>x.hint).length)),el('td',r>=.8?'ok':r>=.5?'mid':'badc',r>=.8?'уверенно':r>=.5?'почти':'тренировать'));tb.append(tr)});box.append(tb);
  const miss=all.filter(x=>!x.first).map(x=>x.q+' → '+x.a);if(miss.length)box.append(el('p','small','Ошибки: '+miss.join('; ')))}
const pad=$('pad');(C.negative?['7','8','9','4','5','6','1','2','3','neg','0','del','go']:['7','8','9','4','5','6','1','2','3','del','0','go']).forEach(k=>{const b=el('button','key'+(k==='go'?' go':''),k==='del'?'⌫':k==='go'?(C.goLabel||'Ответ'):k==='neg'?'±':k);b.type='button';b.dataset.k=k;b.onclick=()=>press(k);pad.append(b)});
addEventListener('keydown',e=>{if(document.querySelector('.overlay'))return;let k=null;if(/^[0-9]$/.test(e.key))k=e.key;else if(e.key==='Backspace')k='del';else if(e.key==='Enter')k='go';else if(e.key==='-'&&C.negative)k='neg';if(k){e.preventDefault();press(k)}});
$('hintBtn').onclick=showHint;
$('mute').onclick=()=>{muted=!muted;$('mute').textContent=muted?'🔇':'🔊';$('mute').setAttribute('aria-label',muted?'Включить звук':'Выключить звук')};
addEventListener('resize',size);size();drawLevels();C.onLevel&&C.onLevel($('stage'),0);
$('play').onclick=()=>{audio();$('start').remove();go(0)};
})();

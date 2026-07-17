import type { GeneratedFile } from "@/lib/types";

const BASE_CSS = `:root{
  --bg:#0b0f19;--panel:#131a2a;--panel-2:#1b2438;--border:#243049;
  --text:#e6ebf5;--muted:#9aa7c2;--brand:#6d8bff;--brand-2:#8f6dff;
  --accent:#31d0aa;--danger:#ff6d7d;--radius:14px;--shadow:0 10px 40px rgba(0,0,0,.35);
}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%}
body{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  background:var(--bg);color:var(--text);line-height:1.55;
  display:flex;align-items:center;justify-content:center;padding:24px}
.app{width:100%;max-width:720px}
.card{background:linear-gradient(180deg,var(--panel),var(--panel-2));
  border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow);padding:28px}
h1{font-size:1.6rem;letter-spacing:-.02em;margin-bottom:4px}
.sub{color:var(--muted);margin-bottom:22px;font-size:.95rem}
button{cursor:pointer;font:inherit;border:none;border-radius:10px;padding:11px 16px;
  color:#fff;background:linear-gradient(180deg,var(--brand),var(--brand-2));
  font-weight:600;transition:transform .08s ease,filter .2s ease}
button:hover{filter:brightness(1.08)}button:active{transform:translateY(1px)}
button.ghost{background:transparent;border:1px solid var(--border);color:var(--muted)}
input,select,textarea{font:inherit;color:var(--text);background:#0e1526;border:1px solid var(--border);
  border-radius:10px;padding:11px 14px;width:100%;outline:none}
input:focus,textarea:focus{border-color:var(--brand)}
::placeholder{color:#5c6a87}
.row{display:flex;gap:10px}
.badge{display:inline-block;font-size:.72rem;color:var(--accent);background:rgba(49,208,170,.1);
  border:1px solid rgba(49,208,170,.25);padding:3px 9px;border-radius:999px;margin-bottom:14px}
`;

function wrap(
  title: string,
  bodyHtml: string,
  extraCss: string,
  js: string
): GeneratedFile[] {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}</title>
<link rel="stylesheet" href="styles.css"/>
</head>
<body>
<div class="app">
${bodyHtml}
</div>
<script src="app.js"></script>
</body>
</html>`;
  return [
    { path: "index.html", content: html, language: "html" },
    { path: "styles.css", content: BASE_CSS + "\n" + extraCss, language: "css" },
    { path: "app.js", content: js, language: "javascript" },
  ];
}

/* ---------------- TODO ---------------- */
function todoApp(): GeneratedFile[] {
  const body = `<div class="card">
  <span class="badge">localStorage · ES2024</span>
  <h1>Tasks</h1>
  <p class="sub">A fast, persistent to-do app.</p>
  <form id="f" class="row" style="margin-bottom:16px">
    <input id="t" placeholder="What needs doing?" autocomplete="off"/>
    <button type="submit">Add</button>
  </form>
  <div class="row" style="margin-bottom:12px">
    <button class="ghost filt" data-f="all">All</button>
    <button class="ghost filt" data-f="active">Active</button>
    <button class="ghost filt" data-f="done">Done</button>
    <span style="flex:1"></span>
    <button class="ghost" id="clear">Clear done</button>
  </div>
  <ul id="list"></ul>
  <p class="sub" id="count" style="margin-top:14px"></p>
</div>`;
  const css = `ul{list-style:none}
li{display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid var(--border);
  border-radius:10px;margin-bottom:8px;background:#0e1526}
li.done span{text-decoration:line-through;color:var(--muted)}
li .txt{flex:1}
li .x{background:transparent;color:var(--danger);padding:4px 8px}
.chk{width:20px;height:20px;border:2px solid var(--brand);border-radius:6px;cursor:pointer;flex:none}
.chk.on{background:var(--brand)}
.filt.active{color:var(--brand);border-color:var(--brand)}`;
  const js = `const KEY='forge.todos';
let todos=JSON.parse(localStorage.getItem(KEY)||'[]');
let filter='all';
const list=document.getElementById('list');
const save=()=>localStorage.setItem(KEY,JSON.stringify(todos));
function render(){
  const shown=todos.filter(t=>filter==='all'||(filter==='active'&&!t.done)||(filter==='done'&&t.done));
  list.innerHTML=shown.map(t=>\`<li class="\${t.done?'done':''}" data-id="\${t.id}">
    <div class="chk \${t.done?'on':''}"></div>
    <span class="txt">\${t.text.replace(/</g,'&lt;')}</span>
    <button class="x">✕</button></li>\`).join('')||'<p class="sub">Nothing here yet.</p>';
  const left=todos.filter(t=>!t.done).length;
  document.getElementById('count').textContent=\`\${left} item\${left!==1?'s':''} left · \${todos.length} total\`;
}
document.getElementById('f').addEventListener('submit',e=>{
  e.preventDefault();const i=document.getElementById('t');const v=i.value.trim();
  if(!v)return;todos.unshift({id:Date.now(),text:v,done:false});i.value='';save();render();
});
list.addEventListener('click',e=>{
  const li=e.target.closest('li');if(!li)return;const id=+li.dataset.id;
  if(e.target.classList.contains('x')){todos=todos.filter(t=>t.id!==id);}
  else if(e.target.classList.contains('chk')){const t=todos.find(t=>t.id===id);t.done=!t.done;}
  save();render();
});
document.querySelectorAll('.filt').forEach(b=>b.addEventListener('click',()=>{
  filter=b.dataset.f;document.querySelectorAll('.filt').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');render();
}));
document.getElementById('clear').addEventListener('click',()=>{todos=todos.filter(t=>!t.done);save();render();});
document.querySelector('.filt').classList.add('active');
render();`;
  return wrap("Tasks — built by Forge", body, css, js);
}

/* ---------------- CALCULATOR ---------------- */
function calculatorApp(): GeneratedFile[] {
  const body = `<div class="card" style="max-width:360px;margin:auto">
  <span class="badge">Vanilla JS</span>
  <h1>Calculator</h1>
  <p class="sub">Keyboard supported.</p>
  <div id="scr" class="scr">0</div>
  <div class="grid">
    <button class="ghost k" data-k="AC">AC</button>
    <button class="ghost k" data-k="±">±</button>
    <button class="ghost k" data-k="%">%</button>
    <button class="op k" data-k="/">÷</button>
    <button class="ghost k" data-k="7">7</button>
    <button class="ghost k" data-k="8">8</button>
    <button class="ghost k" data-k="9">9</button>
    <button class="op k" data-k="*">×</button>
    <button class="ghost k" data-k="4">4</button>
    <button class="ghost k" data-k="5">5</button>
    <button class="ghost k" data-k="6">6</button>
    <button class="op k" data-k="-">−</button>
    <button class="ghost k" data-k="1">1</button>
    <button class="ghost k" data-k="2">2</button>
    <button class="ghost k" data-k="3">3</button>
    <button class="op k" data-k="+">+</button>
    <button class="ghost k zero" data-k="0">0</button>
    <button class="ghost k" data-k=".">.</button>
    <button class="k" data-k="=">=</button>
  </div>
</div>`;
  const css = `.scr{background:#0e1526;border:1px solid var(--border);border-radius:12px;
  padding:20px;text-align:right;font-size:2.4rem;font-variant-numeric:tabular-nums;
  margin-bottom:14px;overflow:hidden}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.grid button{padding:18px 0;font-size:1.1rem}
.op{background:linear-gradient(180deg,var(--accent),#1fae8f)}
.zero{grid-column:span 2}`;
  const js = `let cur='0',prev=null,op=null,fresh=true;
const scr=document.getElementById('scr');
const show=()=>scr.textContent=cur;
function input(k){
  if(k>='0'&&k<='9'){cur=fresh?k:(cur==='0'?k:cur+k);fresh=false;}
  else if(k==='.'){if(fresh){cur='0.';fresh=false;}else if(!cur.includes('.'))cur+='.';}
  else if(k==='AC'){cur='0';prev=null;op=null;fresh=true;}
  else if(k==='±'){cur=String(parseFloat(cur)*-1);}
  else if(k==='%'){cur=String(parseFloat(cur)/100);}
  else if(k==='+'||k==='-'||k==='*'||k==='/'){
    if(op&&!fresh)compute();prev=parseFloat(cur);op=k;fresh=true;}
  else if(k==='='){compute();op=null;fresh=true;}
  show();
}
function compute(){
  if(op===null||prev===null)return;const c=parseFloat(cur);let r=0;
  if(op==='+')r=prev+c;if(op==='-')r=prev-c;if(op==='*')r=prev*c;
  if(op==='/')r=c===0?NaN:prev/c;
  cur=Number.isNaN(r)?'Error':String(Math.round(r*1e10)/1e10);prev=r;
}
document.querySelectorAll('.k').forEach(b=>b.addEventListener('click',()=>input(b.dataset.k)));
window.addEventListener('keydown',e=>{
  const m={Enter:'=','=':'=',Escape:'AC',Backspace:'AC'};
  if(e.key>='0'&&e.key<='9'||['+','-','*','/','.','%'].includes(e.key))input(e.key);
  else if(m[e.key])input(m[e.key]);
});
show();`;
  return wrap("Calculator — built by Forge", body, css, js);
}

/* ---------------- POMODORO TIMER ---------------- */
function timerApp(): GeneratedFile[] {
  const body = `<div class="card" style="max-width:420px;margin:auto;text-align:center">
  <span class="badge">requestAnimationFrame</span>
  <h1>Focus Timer</h1>
  <p class="sub">Pomodoro-style work sessions.</p>
  <div class="ring"><svg viewBox="0 0 200 200"><circle class="track" cx="100" cy="100" r="88"/>
    <circle id="prog" class="prog" cx="100" cy="100" r="88"/></svg>
    <div id="time">25:00</div></div>
  <div class="row" style="justify-content:center;margin:18px 0">
    <button id="start">Start</button>
    <button class="ghost" id="reset">Reset</button>
  </div>
  <div class="row" style="justify-content:center">
    <button class="ghost mode active" data-m="25">Work 25</button>
    <button class="ghost mode" data-m="5">Break 5</button>
    <button class="ghost mode" data-m="15">Long 15</button>
  </div>
</div>`;
  const css = `.ring{position:relative;width:220px;height:220px;margin:8px auto}
svg{transform:rotate(-90deg);width:100%;height:100%}
.track{fill:none;stroke:#0e1526;stroke-width:14}
.prog{fill:none;stroke:url(#g);stroke:var(--brand);stroke-width:14;stroke-linecap:round;
  stroke-dasharray:552;stroke-dashoffset:0;transition:stroke-dashoffset .3s linear}
#time{position:absolute;inset:0;display:grid;place-items:center;font-size:2.6rem;font-variant-numeric:tabular-nums}
.mode.active{color:var(--brand);border-color:var(--brand)}`;
  const js = `let total=25*60,left=total,running=false,tick=null;
const C=2*Math.PI*88;
const prog=document.getElementById('prog');
const label=document.getElementById('time');
prog.style.strokeDasharray=C;
function draw(){
  const m=String(Math.floor(left/60)).padStart(2,'0');
  const s=String(left%60).padStart(2,'0');
  label.textContent=m+':'+s;
  prog.style.strokeDashoffset=C*(1-left/total);
}
function start(){
  if(running){clearInterval(tick);running=false;document.getElementById('start').textContent='Start';return;}
  running=true;document.getElementById('start').textContent='Pause';
  tick=setInterval(()=>{
    left--;draw();
    if(left<=0){clearInterval(tick);running=false;document.getElementById('start').textContent='Start';
      try{new Audio('data:audio/wav;base64,UklGRl9vAAA...').play()}catch(e){}
      alert('Session complete!');}
  },1000);
}
document.getElementById('start').addEventListener('click',start);
document.getElementById('reset').addEventListener('click',()=>{clearInterval(tick);running=false;left=total;document.getElementById('start').textContent='Start';draw();});
document.querySelectorAll('.mode').forEach(b=>b.addEventListener('click',()=>{
  clearInterval(tick);running=false;document.getElementById('start').textContent='Start';
  total=left=+b.dataset.m*60;
  document.querySelectorAll('.mode').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');draw();
}));
draw();`;
  return wrap("Focus Timer — built by Forge", body, css, js);
}

/* ---------------- LANDING PAGE ---------------- */
function landingApp(topic: string): GeneratedFile[] {
  const name = topic || "Nova";
  const body = `<div style="max-width:960px;margin:auto">
  <nav class="nav">
    <div class="logo">◆ ${name}</div>
    <div class="links"><a href="#features">Features</a><a href="#pricing">Pricing</a>
    <button>Get started</button></div>
  </nav>
  <header class="hero">
    <span class="badge">New · 2026</span>
    <h1>Build ${name} faster than ever</h1>
    <p class="sub">A beautiful, responsive landing page with modern gradients, container queries and smooth scroll.</p>
    <div class="row" style="justify-content:center">
      <button>Start free</button><button class="ghost">Live demo</button>
    </div>
  </header>
  <section id="features" class="feat">
    <div class="fcard"><div class="ico">⚡</div><h3>Fast</h3><p>Edge-rendered and instant.</p></div>
    <div class="fcard"><div class="ico">🎨</div><h3>Beautiful</h3><p>Polished modern design system.</p></div>
    <div class="fcard"><div class="ico">🔒</div><h3>Secure</h3><p>Passkeys & best practices.</p></div>
  </section>
  <footer class="foot">© 2026 ${name}. Built by Forge.</footer>
</div>`;
  const css = `body{align-items:flex-start}
.app{max-width:100%}
.nav{display:flex;justify-content:space-between;align-items:center;padding:8px 0 32px}
.logo{font-weight:800;font-size:1.2rem}
.links{display:flex;gap:20px;align-items:center}
.links a{color:var(--muted);text-decoration:none}.links a:hover{color:var(--text)}
.hero{text-align:center;padding:60px 0}
.hero h1{font-size:clamp(2rem,6vw,3.6rem);line-height:1.05;margin:10px 0;
  background:linear-gradient(90deg,var(--text),var(--brand));-webkit-background-clip:text;background-clip:text;color:transparent}
.hero .sub{max-width:520px;margin:0 auto 24px}
.feat{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;padding:20px 0}
.fcard{background:var(--panel);border:1px solid var(--border);border-radius:var(--radius);padding:26px}
.ico{font-size:1.8rem;margin-bottom:10px}
.fcard h3{margin-bottom:6px}.fcard p{color:var(--muted)}
.foot{text-align:center;color:var(--muted);padding:40px 0}
html{scroll-behavior:smooth}`;
  const js = `document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{
  e.preventDefault();document.querySelector(a.getAttribute('href'))?.scrollIntoView({behavior:'smooth'});
}));
document.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{
  b.animate([{transform:'scale(1)'},{transform:'scale(.94)'},{transform:'scale(1)'}],{duration:180});
}));`;
  return wrap(name + " — Landing", body, css, js);
}

/* ---------------- NOTES ---------------- */
function notesApp(): GeneratedFile[] {
  const body = `<div class="card" style="max-width:640px;margin:auto">
  <span class="badge">Autosave · localStorage</span>
  <h1>Quick Notes</h1>
  <p class="sub">Everything saves automatically as you type.</p>
  <div class="row" style="margin-bottom:12px">
    <input id="title" placeholder="Note title"/>
    <button id="new">New</button>
  </div>
  <textarea id="body" rows="8" placeholder="Start writing…"></textarea>
  <div id="list" class="notes"></div>
</div>`;
  const css = `textarea{resize:vertical;margin-bottom:14px}
.notes{display:grid;gap:8px}
.note{display:flex;gap:10px;align-items:center;padding:12px 14px;background:#0e1526;
  border:1px solid var(--border);border-radius:10px;cursor:pointer}
.note.active{border-color:var(--brand)}
.note .nt{flex:1;font-weight:600}
.note small{color:var(--muted)}
.note .x{background:transparent;color:var(--danger);padding:4px 8px}`;
  const js = `const KEY='forge.notes';
let notes=JSON.parse(localStorage.getItem(KEY)||'[]');
let active=null;
const T=document.getElementById('title'),B=document.getElementById('body'),L=document.getElementById('list');
const save=()=>localStorage.setItem(KEY,JSON.stringify(notes));
function render(){
  L.innerHTML=notes.map(n=>\`<div class="note \${n.id===active?'active':''}" data-id="\${n.id}">
    <div class="nt">\${(n.title||'Untitled').replace(/</g,'&lt;')}</div>
    <small>\${new Date(n.at).toLocaleDateString()}</small>
    <button class="x">✕</button></div>\`).join('')||'<p class="sub">No notes yet.</p>';
}
function load(n){active=n.id;T.value=n.title;B.value=n.body;render();}
function current(){return notes.find(n=>n.id===active);}
function persist(){const n=current();if(!n)return;n.title=T.value;n.body=B.value;n.at=Date.now();save();render();}
T.addEventListener('input',persist);B.addEventListener('input',persist);
document.getElementById('new').addEventListener('click',()=>{
  const n={id:Date.now(),title:'',body:'',at:Date.now()};notes.unshift(n);load(n);save();T.focus();
});
L.addEventListener('click',e=>{
  const el=e.target.closest('.note');if(!el)return;const id=+el.dataset.id;
  if(e.target.classList.contains('x')){notes=notes.filter(n=>n.id!==id);if(active===id){active=null;T.value='';B.value='';}save();render();return;}
  load(notes.find(n=>n.id===id));
});
if(notes[0])load(notes[0]);else render();`;
  return wrap("Quick Notes — built by Forge", body, css, js);
}

/* ---------------- QUIZ ---------------- */
function quizApp(): GeneratedFile[] {
  const body = `<div class="card" style="max-width:560px;margin:auto">
  <span class="badge">Interactive</span>
  <h1>2026 Web Quiz</h1>
  <p class="sub" id="progress"></p>
  <div id="q" class="q"></div>
  <div id="opts" class="opts"></div>
  <div id="end" class="end" hidden></div>
</div>`;
  const css = `.q{font-size:1.25rem;font-weight:600;margin:8px 0 18px}
.opts{display:grid;gap:10px}
.opt{text-align:left;background:#0e1526;border:1px solid var(--border);color:var(--text)}
.opt:hover{border-color:var(--brand)}
.opt.correct{background:rgba(49,208,170,.15);border-color:var(--accent)}
.opt.wrong{background:rgba(255,109,125,.15);border-color:var(--danger)}
.end{text-align:center;font-size:1.3rem;padding:20px 0}`;
  const js = `const quiz=[
  {q:'Which CSS framework shipped a CSS-first config in v4?',a:['Bootstrap','Tailwind CSS','Bulma','Foundation'],c:1},
  {q:'Which React 19 hook reads a promise or context?',a:['useAsync','use','useResource','useAwait'],c:1},
  {q:'What does MCP stand for in 2026 AI tooling?',a:['Model Control Panel','Model Context Protocol','Managed Cloud Platform','Multi Core Processing'],c:1},
  {q:'Which Next.js feature streams static + dynamic together?',a:['ISR','PPR (Partial Prerendering)','SSG','CSR'],c:1},
  {q:'Which JS API brings date/time done right?',a:['Moment','Temporal','Chronos','Instant'],c:1}
];
let i=0,score=0;
const qEl=document.getElementById('q'),optsEl=document.getElementById('opts'),
  prog=document.getElementById('progress'),end=document.getElementById('end');
function render(){
  const item=quiz[i];prog.textContent=\`Question \${i+1} of \${quiz.length} · Score \${score}\`;
  qEl.textContent=item.q;
  optsEl.innerHTML=item.a.map((o,ix)=>\`<button class="opt" data-i="\${ix}">\${o}</button>\`).join('');
}
optsEl.addEventListener('click',e=>{
  const b=e.target.closest('.opt');if(!b)return;
  const pick=+b.dataset.i,item=quiz[i];
  optsEl.querySelectorAll('.opt').forEach(x=>x.disabled=true);
  optsEl.children[item.c].classList.add('correct');
  if(pick===item.c)score++;else b.classList.add('wrong');
  setTimeout(()=>{i++;if(i<quiz.length){render();}else finish();},900);
});
function finish(){
  qEl.hidden=optsEl.hidden=true;prog.hidden=true;end.hidden=false;
  end.innerHTML=\`🎉 You scored <b>\${score}/\${quiz.length}</b><br><button id="again" style="margin-top:14px">Play again</button>\`;
  document.getElementById('again').onclick=()=>{i=0;score=0;qEl.hidden=optsEl.hidden=false;prog.hidden=false;end.hidden=true;render();};
}
render();`;
  return wrap("Quiz — built by Forge", body, css, js);
}

/* ---------------- WEATHER (live API) ---------------- */
function weatherApp(): GeneratedFile[] {
  const body = `<div class="card" style="max-width:460px;margin:auto;text-align:center">
  <span class="badge">Open-Meteo API · fetch</span>
  <h1>Weather</h1>
  <form id="f" class="row" style="margin:14px 0">
    <input id="city" placeholder="Search a city…" value="Tokyo"/>
    <button>Go</button>
  </form>
  <div id="out"></div>
</div>`;
  const css = `.big{font-size:3.4rem;font-weight:700;margin:6px 0}
.place{color:var(--muted)}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:16px}
.stat{background:#0e1526;border:1px solid var(--border);border-radius:10px;padding:14px}
.stat b{display:block;font-size:1.2rem}.stat small{color:var(--muted)}`;
  const js = `const out=document.getElementById('out');
async function go(city){
  out.innerHTML='<p class="sub">Loading…</p>';
  try{
    const g=await fetch('https://geocoding-api.open-meteo.com/v1/search?count=1&name='+encodeURIComponent(city)).then(r=>r.json());
    if(!g.results?.length){out.innerHTML='<p class="sub">City not found.</p>';return;}
    const {latitude,longitude,name,country}=g.results[0];
    const w=await fetch(\`https://api.open-meteo.com/v1/forecast?latitude=\${latitude}&longitude=\${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code\`).then(r=>r.json());
    const c=w.current;
    out.innerHTML=\`<div class="place">\${name}, \${country}</div>
      <div class="big">\${Math.round(c.temperature_2m)}°C</div>
      <div class="grid3">
        <div class="stat"><b>\${c.relative_humidity_2m}%</b><small>Humidity</small></div>
        <div class="stat"><b>\${Math.round(c.wind_speed_10m)}</b><small>km/h wind</small></div>
        <div class="stat"><b>\${c.weather_code}</b><small>Code</small></div>
      </div>\`;
  }catch(e){out.innerHTML='<p class="sub">Failed to load. Check your connection.</p>';}
}
document.getElementById('f').addEventListener('submit',e=>{e.preventDefault();go(document.getElementById('city').value.trim());});
go('Tokyo');`;
  return wrap("Weather — built by Forge", body, css, js);
}

/* ---------------- CRYPTO TRADING DASHBOARD ---------------- */
function tradingApp(): GeneratedFile[] {
  const body = `<div style="max-width:900px;margin:auto;width:100%">
  <div class="topbar">
    <div class="logo">◆ SignalDesk</div>
    <div id="clock" class="clock"></div>
  </div>
  <div class="hero card">
    <div>
      <span class="badge">Binance live · free WebSocket</span>
      <h1 id="sym">BTC / USDT</h1>
      <div id="price" class="price">—</div>
      <div id="chg" class="chg"></div>
    </div>
    <div id="verdict" class="verdict hold">HOLD</div>
  </div>
  <div class="controls">
    <select id="coin">
      <option value="BTCUSDT">BTC/USDT</option>
      <option value="ETHUSDT">ETH/USDT</option>
      <option value="SOLUSDT">SOL/USDT</option>
      <option value="BNBUSDT">BNB/USDT</option>
      <option value="XRPUSDT">XRP/USDT</option>
    </select>
    <div class="tf" id="tf">
      <button data-i="15m">15m</button>
      <button data-i="1h" class="on">1h</button>
      <button data-i="4h">4h</button>
      <button data-i="1d">1d</button>
    </div>
  </div>
  <div class="card"><canvas id="chart" height="200"></canvas></div>
  <div id="stats" class="stats"></div>
  <p class="sub" style="text-align:center;margin-top:16px">Educational technicals — not financial advice.</p>
</div>`;
  const css = `body{align-items:flex-start;padding:20px}.app{max-width:100%}
.topbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
.logo{font-weight:800;font-size:1.1rem}.clock{color:var(--muted);font-variant-numeric:tabular-nums}
.hero{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
.price{font-size:2.6rem;font-weight:800;font-variant-numeric:tabular-nums}
.chg{font-size:.95rem}.chg.up{color:#34d399}.chg.down{color:#fb7185}
.verdict{padding:16px 24px;border-radius:14px;font-size:1.6rem;font-weight:800;text-align:center;border:1px solid}
.verdict.buy{color:#34d399;background:rgba(52,211,153,.12);border-color:rgba(52,211,153,.3)}
.verdict.sell{color:#fb7185;background:rgba(251,113,133,.12);border-color:rgba(251,113,133,.3)}
.verdict.hold{color:#fbbf24;background:rgba(251,191,36,.12);border-color:rgba(251,191,36,.3)}
.controls{display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap}
.controls select{max-width:180px}
.tf{display:flex;gap:4px;border:1px solid var(--border);border-radius:10px;padding:4px}
.tf button{background:transparent;color:var(--muted);padding:8px 14px}
.tf button.on{background:var(--brand);color:#fff}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-top:14px}
.stat{background:#0e1526;border:1px solid var(--border);border-radius:10px;padding:14px;text-align:center}
.stat b{display:block;font-size:1.15rem;font-variant-numeric:tabular-nums}.stat small{color:var(--muted)}
canvas{width:100%}`;
  const js = `let symbol='BTCUSDT',interval='1h',ws=null;
const $=id=>document.getElementById(id);
function ema(v,p){const k=2/(p+1);let e=v.slice(0,p).reduce((a,b)=>a+b,0)/p;const o=Array(p-1).fill(null);o.push(e);for(let i=p;i<v.length;i++){e=v[i]*k+e*(1-k);o.push(e);}return o;}
function rsi(v,p=14){const o=Array(v.length).fill(null);if(v.length<=p)return o;let g=0,l=0;for(let i=1;i<=p;i++){const d=v[i]-v[i-1];d>=0?g+=d:l-=d;}let ag=g/p,al=l/p;o[p]=al===0?100:100-100/(1+ag/al);for(let i=p+1;i<v.length;i++){const d=v[i]-v[i-1];ag=(ag*(p-1)+(d>0?d:0))/p;al=(al*(p-1)+(d<0?-d:0))/p;o[p]=al===0?100:100-100/(1+ag/al);o[i]=al===0?100:100-100/(1+ag/al);}return o;}
async function load(){
  const r=await fetch(\`https://data-api.binance.vision/api/v3/klines?symbol=\${symbol}&interval=\${interval}&limit=200\`).then(r=>r.json());
  const closes=r.map(k=>parseFloat(k[4]));
  draw(closes);
  const rs=rsi(closes),e50=ema(closes,50),e200=ema(closes,200);
  const price=closes[closes.length-1],R=rs[rs.length-1],E50=e50[e50.length-1],E200=e200[e200.length-1];
  let score=0;
  if(R<30)score+=25;else if(R>70)score-=25;
  if(E50&&E200){if(E50>E200&&price>E50)score+=30;else if(E50<E200&&price<E50)score-=30;}
  if(E50&&price>E50)score+=15;else if(E50)score-=15;
  const v=score>=25?'buy':score<=-25?'sell':'hold';
  const el=$('verdict');el.className='verdict '+v;el.textContent=v.toUpperCase();
  $('stats').innerHTML=[['RSI',R?.toFixed(1)],['EMA50',E50?.toFixed(2)],['EMA200',E200?.toFixed(2)],['Score',score]]
    .map(([k,val])=>\`<div class="stat"><b>\${val??'—'}</b><small>\${k}</small></div>\`).join('');
}
function draw(v){
  const c=$('chart'),ctx=c.getContext('2d');const w=c.width=c.offsetWidth*2,h=c.height=400;ctx.scale(1,1);
  const max=Math.max(...v),min=Math.min(...v),rng=max-min||1;
  ctx.clearRect(0,0,w,h);ctx.beginPath();ctx.lineWidth=3;ctx.strokeStyle='#6d8bff';
  v.forEach((p,i)=>{const x=i/(v.length-1)*w,y=h-((p-min)/rng)*(h-40)-20;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});
  ctx.stroke();
  const g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,'rgba(109,139,255,.25)');g.addColorStop(1,'rgba(109,139,255,0)');
  ctx.lineTo(w,h);ctx.lineTo(0,h);ctx.closePath();ctx.fillStyle=g;ctx.fill();
}
function connect(){
  ws&&ws.close();
  ws=new WebSocket(\`wss://stream.binance.com:9443/ws/\${symbol.toLowerCase()}@ticker\`);
  ws.onmessage=e=>{const d=JSON.parse(e.data);
    $('price').textContent='$'+parseFloat(d.c).toLocaleString(undefined,{maximumFractionDigits:4});
    const p=parseFloat(d.P);const chg=$('chg');chg.textContent=(p>=0?'▲ +':'▼ ')+p.toFixed(2)+'% (24h)';
    chg.className='chg '+(p>=0?'up':'down');};
}
$('coin').addEventListener('change',e=>{symbol=e.target.value;$('sym').textContent=symbol.replace('USDT',' / USDT');connect();load();});
$('tf').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;interval=b.dataset.i;
  document.querySelectorAll('.tf button').forEach(x=>x.classList.remove('on'));b.classList.add('on');load();});
setInterval(()=>{$('clock').textContent=new Date().toLocaleTimeString();},1000);
connect();load();setInterval(load,30000);`;
  return wrap("SignalDesk — Crypto Dashboard", body, css, js);
}

type Template = {
  match: RegExp;
  build: (topic: string) => GeneratedFile[];
  label: string;
};

const TEMPLATES: Template[] = [
  { match: /\b(todo|to-do|task|checklist)\b/i, build: () => todoApp(), label: "To-do app" },
  { match: /\b(calc|calculator|arithmetic)\b/i, build: () => calculatorApp(), label: "Calculator" },
  { match: /\b(pomodoro|timer|countdown|focus)\b/i, build: () => timerApp(), label: "Focus timer" },
  { match: /\b(note|notepad|journal|memo)\b/i, build: () => notesApp(), label: "Notes app" },
  { match: /\b(quiz|trivia|question)\b/i, build: () => quizApp(), label: "Quiz app" },
  { match: /\b(weather|forecast|temperature)\b/i, build: () => weatherApp(), label: "Weather app" },
  {
    match: /\b(trading|crypto|signal|binance|exchange|bitcoin|price tracker|ticker|portfolio)\b/i,
    build: () => tradingApp(),
    label: "Crypto trading dashboard",
  },
  {
    match: /\b(landing|marketing|startup|homepage|saas|product page)\b/i,
    build: (t) => landingApp(t),
    label: "Landing page",
  },
];

export function detectTemplate(prompt: string): {
  files: GeneratedFile[];
  label: string;
} {
  for (const t of TEMPLATES) {
    if (t.match.test(prompt)) {
      const topicMatch = prompt.match(/(?:for|called|named)\s+([A-Z][\w]+)/);
      return { files: t.build(topicMatch?.[1] ?? ""), label: t.label };
    }
  }
  // default: a polished interactive starter
  return { files: landingApp(""), label: "Web app starter" };
}

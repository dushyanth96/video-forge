// miniapp.js — Telegram Mini App (“pro-app style” UI) for video-forge.
// The Worker serves it at /app. Uses the Telegram Web App SDK (auth via initData +
// native theme). Shows channel panels/tables and lets you trigger actions and upload
// photos/videos/text. The client JS does NOT use template-literals (to avoid clashing
// with the outer template-literal).
export const APP_HTML = `<!doctype html>
<html lang='en'><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>The Data Lens — Control</title>
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<style>
  :root{
    /* Base synced with the Telegram THEME (native: adapts to the user's light/dark). */
    --bg:var(--tg-theme-bg-color,#0b0f17); --card:var(--tg-theme-secondary-bg-color,#141b26);
    --txt:var(--tg-theme-text-color,#eaf1ff); --hint:var(--tg-theme-hint-color,#8aa0c0);
    --btn:var(--tg-theme-button-color,#22a0e0); --btntx:var(--tg-theme-button-text-color,#fff);
    --link:var(--tg-theme-link-color,#4fc3f7);
    --line:rgba(130,140,158,.20); --soft:rgba(130,140,158,.10);
    --cy:#22d3ee; --gr:#34d399; --am:#f59e0b; --rd:#f87171;
    /* BRAND ACCENT (per channel; set on body[data-ch]). Neutral by default. */
    --acc:#34d399; --acc2:#6ee7b7; --glow:rgba(52,211,153,.16); --accfg:#04140d;
    --r:17px; --shadow:0 12px 30px rgba(0,0,0,.30);
  }
  body[data-ch="auto2"]{--acc:#10b981;--acc2:#2dd4bf;--glow:rgba(16,185,129,.20);--accfg:#04140d}
  body[data-ch="data-lens"]{--acc:#a3e635;--acc2:#4ade80;--glow:rgba(163,230,53,.18);--accfg:#0f1a00}
  body[data-ch="bilibili"]{--acc:#22a0e0;--acc2:#38bdf8;--glow:rgba(34,160,224,.18);--accfg:#04140d}
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  body{margin:0;background:
      radial-gradient(120% 42% at 50% -60px, var(--glow), transparent 62%),
      var(--bg);
    color:var(--txt);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,system-ui,sans-serif;font-size:15px;line-height:1.45;    padding-bottom:calc(88px + env(safe-area-inset-bottom));transition:background .3s}
  header{padding:14px 14px 10px;position:sticky;top:0;background:var(--bg);z-index:6;border-bottom:1px solid var(--line)}
  .hdrow{display:flex;align-items:center;justify-content:space-between;gap:11px}
  .hd-l{display:flex;align-items:center;gap:11px;min-width:0}
  .logo{width:44px;height:44px;border-radius:14px;flex-shrink:0;display:flex;align-items:center;justify-content:center;
    background:linear-gradient(140deg,var(--acc),var(--acc2));box-shadow:0 8px 20px var(--glow);transition:background .3s,box-shadow .3s}
  .logo svg{width:27px;height:27px;display:block}
  header h1{font-size:17px;margin:0;font-weight:800;letter-spacing:.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  header .sub{color:var(--hint);font-size:12px;margin-top:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .icon{background:var(--card);border:1px solid var(--line);color:var(--txt);min-width:38px;height:38px;border-radius:12px;font-size:18px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:transform .12s}
  .icon:active{transform:scale(.9) rotate(-35deg)}
  .wrap{padding:0 14px}
  .card{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:14px;margin:11px 0;box-shadow:var(--shadow)}
  .row{display:flex;gap:10px}
  .kpi{flex:1;text-align:center}
  .kpi .n{font-size:27px;font-weight:850;line-height:1;letter-spacing:-.5px}
  .kpi .l{font-size:10.5px;color:var(--hint);margin-top:5px;text-transform:uppercase;letter-spacing:.5px;font-weight:700}
  h2{font-size:11px;color:var(--hint);text-transform:uppercase;letter-spacing:.7px;font-weight:800;margin:18px 4px 8px}
  .bar{height:9px;background:var(--soft);border-radius:999px;overflow:hidden;margin-top:7px}
  .bar > i{display:block;height:100%;background:linear-gradient(90deg,var(--acc),var(--acc2));border-radius:999px;box-shadow:0 0 14px var(--glow)}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th{color:var(--hint);text-align:left;font-weight:600;padding:6px 6px;font-size:11px;text-transform:uppercase}
  td{padding:8px 6px;border-top:1px solid var(--line);vertical-align:top}
  .num{font-variant-numeric:tabular-nums;font-feature-settings:"tnum"}
  .tag{font-size:10px;padding:2px 7px;border-radius:20px;font-weight:700}
  .tag.pub{background:rgba(52,211,153,.18);color:var(--gr)} .tag.priv{background:rgba(245,158,11,.18);color:var(--am)}
  a{color:var(--link);text-decoration:none}
  .btn{display:block;width:100%;background:linear-gradient(135deg,var(--acc),var(--acc2));color:var(--accfg);border:0;border-radius:14px;padding:13px;font-size:15px;font-weight:800;margin:8px 0;cursor:pointer;transition:transform .09s;box-shadow:0 8px 20px var(--glow)}
  .btn:active{transform:scale(.98)}
  .btn.ghost{background:transparent;color:var(--txt);border:1px solid var(--line);box-shadow:none}
  .btn.mini{display:inline-block;width:auto;padding:7px 13px;font-size:12px;margin:0;border-radius:11px;box-shadow:none}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  input[type=text],textarea{width:100%;background:var(--bg);color:var(--txt);border:1px solid var(--line);border-radius:11px;padding:11px;font-size:15px;font-family:inherit}
  textarea{min-height:80px;resize:vertical}
  .file{display:flex;align-items:center;gap:10px;background:var(--bg);border:1px dashed var(--line);border-radius:12px;padding:14px;justify-content:center;color:var(--hint);cursor:pointer;margin:8px 0}
  .nav{position:fixed;bottom:0;left:0;right:0;display:flex;background:var(--card);border-top:1px solid var(--line);padding:7px 8px calc(11px + env(safe-area-inset-bottom));z-index:7;box-shadow:0 -8px 24px rgba(0,0,0,.22)}
  .nav button{flex:1;background:none;border:0;color:var(--hint);font-size:10.5px;font-weight:700;padding:6px 2px;cursor:pointer;border-radius:13px;margin:0 2px;transition:transform .1s,color .15s}
  .nav button:active{transform:scale(.9)}
  .nav button .ic{font-size:20px;display:block;margin-bottom:2px}
  .nav button.on{color:var(--accfg);background:linear-gradient(135deg,var(--acc),var(--acc2));box-shadow:0 6px 16px var(--glow)}
  .chsel{display:flex;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:4px;gap:3px;margin-top:11px;overflow-x:auto;scrollbar-width:none}
  .chsel::-webkit-scrollbar{display:none}
  .chsel button{flex:1;background:none;border:0;color:var(--hint);font-size:12px;font-weight:700;padding:8px 12px;border-radius:10px;cursor:pointer;white-space:nowrap;transition:transform .08s}
  .chsel button:active{transform:scale(.97)}
  .chsel button.on{background:linear-gradient(135deg,var(--acc),var(--acc2));color:var(--accfg);box-shadow:0 4px 12px var(--glow)}
  .gauge{font-size:34px;font-weight:900;line-height:1}
  .hide{display:none}
  .muted{color:var(--hint);font-size:13px}
  #toast{position:fixed;bottom:calc(88px + env(safe-area-inset-bottom));left:14px;right:14px;background:var(--card);color:var(--txt);border:1px solid var(--line);border-radius:14px;padding:13px 16px;text-align:center;font-weight:600;transform:translateY(160%);opacity:0;transition:transform .3s cubic-bezier(.2,.9,.3,1),opacity .3s;z-index:20;box-shadow:0 14px 34px rgba(0,0,0,.4)}
  #toast.show{transform:none;opacity:1}
  .chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
  .chip{font-size:12px;padding:6px 11px;border-radius:20px;border:1px solid var(--line);cursor:pointer}
  .chip.on{background:var(--acc);color:var(--accfg);border-color:var(--acc);font-weight:700}
  .live{display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--acc);margin-right:2px;animation:pulse 1.4s infinite}
  @keyframes pulse{0%{box-shadow:0 0 0 0 var(--glow)}70%{box-shadow:0 0 0 8px transparent}100%{box-shadow:0 0 0 0 transparent}}
  .ytcard{border:1px solid var(--line);border-radius:14px;overflow:hidden;background:var(--card);margin:6px 0 10px;box-shadow:var(--shadow)}
  .ytthumb{aspect-ratio:16/9;background:linear-gradient(135deg,#0e7490,#1e293b);display:flex;align-items:center;justify-content:center}
  .ytbig{font-weight:900;font-size:26px;color:#fff;text-shadow:0 2px 10px rgba(0,0,0,.6);text-align:center;padding:0 14px;letter-spacing:.5px;line-height:1.1}
  .yttitle{font-weight:700;font-size:14px;line-height:1.3;margin-bottom:2px}
  .score{font-size:30px;font-weight:800;line-height:1}
  .fadein{animation:fadein .26s ease}
  @keyframes fadein{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
  .sk-l{height:13px;border-radius:8px;background:var(--soft);margin:7px 0;position:relative;overflow:hidden}
  .sk-l::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,var(--soft),transparent);animation:shimmer 1.3s infinite}
  .sk-l.s{height:11px;width:55%}
  @keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
  /* Bento de KPIs (mosaico) + hero de meta */
  .bento{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:11px 0}
  .bento .kpi{background:var(--card);border:1px solid var(--line);border-radius:15px;padding:12px 13px;text-align:left;box-shadow:var(--shadow);transition:transform .12s cubic-bezier(.2,.9,.3,1)}
  .bento .kpi:active{transform:scale(.97)}
  .bento .kpi .n{font-size:23px}
  .bento .kpi .l{margin-top:4px;letter-spacing:.4px}
  .card.hero{background:linear-gradient(150deg,var(--glow),transparent 62%),var(--card);border-color:var(--line)}
  .hero-h{font-weight:850;font-size:18px;letter-spacing:-.2px}
  /* Video card (Produce/Review): thumbnail + meta + status */
  .vcard{display:flex;gap:11px;padding:10px;align-items:flex-start}
  .vthumb{width:108px;flex-shrink:0;border-radius:11px;overflow:hidden;background:var(--soft);aspect-ratio:16/9;position:relative}
  .vthumb img{width:100%;height:100%;object-fit:cover;display:block}
  .vmeta{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
  .vtitle{font-weight:700;font-size:13px;line-height:1.28;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .vsub{font-size:12px}
  .vstatus{font-size:12px;color:var(--hint);display:flex;align-items:center;gap:6px;flex-wrap:wrap}
  @media (prefers-reduced-motion: reduce){*{animation-duration:.001ms!important;transition-duration:.001ms!important}}
</style></head>
<body>
<header>
  <div class="hdrow">
    <div class="hd-l">
      <span class="logo" id="logoBox"></span>
      <div style="min-width:0">
        <h1 id="chTitle">The Data Lens</h1>
        <div class="sub" id="hd">Control center</div>
      </div>
    </div>
    <button class="icon" id="btnRefresh" aria-label="Refresh">⟳</button>
  </div>
  <div class="chsel" id="chSel">
    <button data-ch="home" class="on">🏠 Summary</button>
    <button data-ch="data-lens">The Data Lens</button>
    <button data-ch="auto2">Auto #2</button>
    <button data-ch="bilibili">🅱️ Bilibili</button>
  </div>
</header>
<div class="wrap">
  <div id="tabHelp" class="muted" style="font-size:12px;margin:2px 2px 8px"></div>
  <div id="globalStatus"></div>
  <div id="s-home"></div>
  <div id="s-produce" class="hide"></div>
  <div id="s-agenda" class="hide"></div>
  <div id="s-analytics" class="hide"></div>
  <div id="s-brain" class="hide"></div>
  <div id="s-more" class="hide"></div>
</div>
<div id="toast"></div>
<div class="nav">
  <button data-t="home" class="on"><span class="ic">🏠</span>Home</button>
  <button id="navProducir" data-t="produce"><span class="ic">🎬</span>Videos</button>
  <button data-t="agenda"><span class="ic">📅</span>Calendar</button>
  <button data-t="analytics"><span class="ic">📈</span>Analytics</button>
  <button data-t="brain"><span class="ic">🧠</span>Brain</button>
  <button data-t="more"><span class="ic">⚙️</span>More</button>
</div>
<script>
  var tg = window.Telegram && window.Telegram.WebApp;
  if (tg) { tg.ready(); tg.expand(); try{ tg.disableVerticalSwipes && tg.disableVerticalSwipes(); }catch(e){} }
  // Brand logos per channel (SVG, not emoji). Applied in applyChannelTheme().
  var LOGOS = {
    "auto2":'<svg viewBox="0 0 44 44" fill="none"><path d="M22 22 C22 11 10 11 10 22 C10 33 22 33 22 22 C22 11 34 11 34 22 C34 33 22 33 22 22Z" stroke="#04140d" stroke-width="4.5" stroke-linecap="round"/></svg>',
    "data-lens":'<svg viewBox="0 0 44 44" fill="none"><circle cx="22" cy="22" r="15" stroke="#0f1a00" stroke-width="3.5"/><rect x="16" y="21" width="3.4" height="7" rx="1.4" fill="#0f1a00"/><rect x="20.4" y="17" width="3.4" height="11" rx="1.4" fill="#0f1a00"/><rect x="24.8" y="13.5" width="3.4" height="14.5" rx="1.4" fill="#0f1a00"/></svg>',
    "home":'<svg viewBox="0 0 44 44" fill="none"><rect x="10" y="20" width="8" height="14" rx="2" fill="#04140d"/><rect x="18" y="13" width="8" height="21" rx="2" fill="#04140d"/><rect x="26" y="16" width="8" height="18" rx="2" fill="#04140d"/></svg>',
    "bilibili":'<svg viewBox="0 0 44 44" fill="none"><rect x="9" y="14" width="26" height="18" rx="5" stroke="#04140d" stroke-width="3"/><path d="M15 10 L19 14 M29 10 L25 14" stroke="#04140d" stroke-width="3" stroke-linecap="round"/></svg>',
  };
  // Applies the channel's BRAND ACCENT (color + logo). Data Lens is auto mode; the base follows the Telegram theme.
  function applyChannelTheme(ch){
    try{ document.body.setAttribute("data-ch", ch||"home"); }catch(e){}
    var lb=document.getElementById("logoBox"); if(lb) lb.innerHTML = LOGOS[ch] || LOGOS.home;
  }
  var INIT = tg ? tg.initData : "";
  var ST = {};
  // Monitor mode: everything is automatic (the Brain produces/schedules/publishes on its own). The app does NOT show
  // produce/approve/publish/schedule buttons; it stays as a dashboard. "My Clips" (manual upload) is kept.
  var MONITOR = true;
  // NATIVE Telegram navigation: haptics, back button, and header color per theme.
  function h(t){ try{ var H=tg&&tg.HapticFeedback; if(!H)return; if(t==="sel")H.selectionChanged(); else if(t==="ok")H.notificationOccurred("success"); else if(t==="err")H.notificationOccurred("error"); else H.impactOccurred(t||"light"); }catch(e){} }
  try{ tg&&tg.setHeaderColor&&tg.setHeaderColor("bg_color"); }catch(e){}
  // Shows Back when NOT in the root view (The Data Lens home and no short in focus).
  function backBtnSync(){ try{ if(!tg||!tg.BackButton)return; if(curChannel!=="home"||curTab!=="home"||shortsTargetVid) tg.BackButton.show(); else tg.BackButton.hide(); }catch(e){} }
  try{ tg&&tg.BackButton&&tg.BackButton.onClick(function(){ h("light");
    if(shortsTargetVid){ shortsTargetVid=""; render(); backBtnSync(); return; }
    if(curTab!=="home"){ tab("home"); return; }
    if(curChannel!=="home"){ setChannel("home"); }
  }); }catch(e){}
  function el(id){return document.getElementById(id);}
  function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
  function toast(m){var t=el("toast");t.textContent=m;t.classList.add("show");setTimeout(function(){t.classList.remove("show");},2600);}
  function api(path, opts){opts=opts||{};opts.headers=opts.headers||{};opts.headers["X-Init-Data"]=INIT;return fetch(path,opts);}
  function num(n){n=+n||0;return n>=1000?(n/1000).toFixed(n>=100000?0:1)+"k":String(n);}
  function durTxt(sec){ if(sec==null) return "—"; sec=+sec; if(sec>=60){var m=Math.floor(sec/60),s=sec%60;return m+":"+("0"+s).slice(-2);} return sec+"s"; }

  var curTab="home", curChannel="home";
  var vSort="views";
  var lastInsights="";
  var localSched={}; // video_id -> "schedule"|"public": optimistic marker when scheduling/publishing (immediate feedback even if the channel report is slow to refresh)
  var shortsTargetVid=""; // video the user wants to generate shorts from (the one they tapped ＋Do), not always "the last one"
  var WATCH={}; // wf(.yml) -> watching a long process launched from the app (G-V1). See startWatch().
  var TABHELP={
    home:"🏠 What needs your attention now + the channel pulse.",
    produce:"🎬 Videos in progress: what the brain is producing and scheduling, and their status. All automatic.",
    agenda:"📅 Your publishing calendar (best US hours) and what's scheduled.",
    analytics:"📈 Channel analysis: how promising, claims, metrics, capacity and your videos.",
    brain:"🧠 The brain inside: how it distributes effort (decision engine) and how close each channel is to monetizing (60-day War Room).",
    more:"⚙️ Create (photo/recipe/voice), channel voice, tools health and storage."
  };
    // Shows the requested tab button's help text (short hint) on the panel.
  function setVSort(s){ vSort=s; render(); }
  // Weekly charts: show the most recent (scroll to end). Robust: waits for the layout
  // with double requestAnimationFrame (SVG takes time to measure its real width) + fallback if it's slow.
  function scrollWkEnd(){
    var f=function(){ try{ document.querySelectorAll("#s-analitica .wksc").forEach(function(dv){ dv.scrollLeft=dv.scrollWidth; }); }catch(e){} };
    try{ requestAnimationFrame(function(){ requestAnimationFrame(f); }); }catch(e){ f(); }
    setTimeout(f, 300);
  }
  function tab(name){
    curTab=name;
    ["home","produce","agenda","analytics","brain","more"].forEach(function(t){el("s-"+t).classList.toggle("hide",t!==name);});
    if(name==="brain") loadBrain(false);
    document.querySelectorAll(".nav button").forEach(function(b){b.classList.toggle("on",b.getAttribute("data-t")===name);});
    setHelp(name);
    var sec=el("s-"+name); if(sec){ sec.classList.remove("fadein"); void sec.offsetWidth; sec.classList.add("fadein"); }
    if(name==="analytics") scrollWkEnd();
    h("sel"); backBtnSync();
  }
  function setChannel(ch){ curChannel=ch; applyChannelTheme(ch); document.querySelectorAll(".chsel button").forEach(function(b){b.classList.toggle("on",b.getAttribute("data-ch")===ch);}); h("sel"); render(); if(curTab==="analytics") scrollWkEnd(); backBtnSync(); }
  document.querySelectorAll(".nav button").forEach(function(b){b.onclick=function(){tab(b.getAttribute("data-t"));};});
  document.querySelectorAll(".chsel button").forEach(function(b){b.onclick=function(){setChannel(b.getAttribute("data-ch"));};});
  (function(){ var rb=el("btnRefresh"); if(rb) rb.onclick=function(){ h("light"); toast("Updating…"); load(); }; })();

  function pct(a,b){return Math.min(100,Math.round((( +a||0)/(b||1))*100));}
  // Classifies a run by channel: Auto (Oddly Loop) vs The Data Lens.
  var AUTO_WF=/^(produce_oddly|publish_oddly|report_auto2|build_asmr_library|niche_radar)\.yml$/;
  function isAutoRun(r){ return AUTO_WF.test(r.wf||"") || /Oddly|compilaci|ASMR|autom[aá]tic/i.test(r.name||""); }
  function activeFor(ch){ var a=ST.active||[]; return ch==="auto2"?a.filter(isAutoRun):a.filter(function(r){return !isAutoRun(r);}); }
  function statusHtml(ch){
    var a=ch?activeFor(ch):(ST.active||[]);
    if(!a.length) return '<div class="card muted">✅ Nothing running right now.</div>';
    return a.map(function(r){
      return '<div class="card"><div style="font-weight:700"><span class="live"></span> '+esc(r.name)+'</div>'
        +'<div class="muted" style="font-size:12px;margin:4px 0">'+esc(r.step||r.status)+(r.eta?' · ~'+r.eta+' min':'')+'</div>'
        +'<div class="bar"><i style="width:'+(r.pct||3)+'%"></i></div></div>';
    }).join("");
  }
  function toolsHealthHtml(){
    // Health of the free tools/APIs the factory uses daily.
    var t=ST.tools_health; if(!t||!(t.tools||[]).length) return "";
    var rows=(t.tools||[]).map(function(x){
      return '<div style="display:flex;justify-content:space-between;gap:8px;border-top:1px solid rgba(255,255,255,.06);padding:5px 0">'
        +'<div style="font-size:12px">'+(x.ok?"✅":(x.critical?"🔴":"🟡"))+' '+esc(x.name)+'</div>'
        +'<div class="muted" style="font-size:11px;text-align:right">'+esc(x.detail||"")+'</div></div>';
    }).join("");
    var head=(t.down>0)?('⚠️ '+t.ok+'/'+t.total+' OK'):('✅ All OK ('+t.ok+'/'+t.total+')');
    return '<h2>🧰 Daily tools</h2>'
      +'<div class="card"><div style="font-weight:700;font-size:13px;margin-bottom:2px">'+head+'</div>'+rows
      +(t.at?'<div class="muted" style="font-size:10px;margin-top:6px">Validado: '+esc(String(t.at).slice(0,16).replace("T"," "))+'</div>':'')
      +'</div>';
  }
  function errorLearnHtml(){
    // Error loop: identified + AI-analyzed + recurring patterns. Learns day by day.
    var e=ST.error_learnings; if(!e||(!(e.incidents||[]).length && !(e.patterns||[]).length)) return "";
    var catColor={transitorio:"var(--hint)",config:"var(--am)",codigo:"#f87171",datos:"var(--am)"};
    var inc=(e.incidents||[]).map(function(i){
      var col=catColor[i.category]||"var(--hint)";
      return '<div style="border-top:1px solid rgba(255,255,255,.06);padding:6px 0">'
        +'<div style="font-size:12px"><b>'+esc(i.workflow||i.name||"")+'</b> <span style="color:'+col+';font-size:10px">['+esc(i.category||"?")+']</span></div>'
        +'<div class="muted" style="font-size:11px">'+esc(i.cause||"")+'</div>'
        +(i.fix?'<div style="font-size:11px;color:var(--cy)">→ '+esc(i.fix)+'</div>':'')
        +(i.url?'<a href="'+esc(i.url)+'" target="_blank" style="font-size:10px">↗ log</a>':'')+'</div>';
    }).join("");
    var pat=(e.patterns||[]).map(function(p){return '<span class="chip" style="font-size:11px">🔁 '+esc(p.key)+' x'+p.count+'</span>';}).join(" ");
    return '<h2>🛠️ Error learnings</h2>'
      +'<div class="card"><div class="muted" style="font-size:11px">The system identifies, analyzes, and learns from every error. Transient ones retry on their own; recurring ones surface as patterns to fix at the root.</div>'
      +(pat?'<div style="margin:8px 0">'+pat+'</div>':'')
      +(inc||'<div class="muted" style="font-size:12px;margin-top:6px">No errors logged. 🎉</div>')
      +(e.at?'<div class="muted" style="font-size:10px;margin-top:6px">Last analysis: '+esc(String(e.at).slice(0,16).replace("T"," "))+'</div>':'')
      +'</div>';
  }
  function problemsHtml(){
    var p=ST.problems||[];
    if(!p.length) return "";
    return '<h2>⚠️ Problems ('+p.length+')</h2>'
      +'<div class="muted" style="font-size:11px;margin:0 2px 6px">Errors from the last 24 h. 📋 View error shows the detail; 🔁 Retry re-runs it; ↗ opens the full log on GitHub.</div>'
      +p.map(function(x){
      return '<div class="card" style="border:1px solid rgba(245,158,11,.45)">'
        +'<div style="font-weight:700;color:var(--am)">⚠️ '+esc(x.name)+'</div>'
        +'<div class="muted" style="margin:4px 0">Failed at: '+esc(x.step||"?")+'</div>'
        +'<div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn mini" onclick="retry(\\''+esc(x.workflow)+'\\')">🔁 Retry</button>'
        +'<button class="btn mini ghost" onclick="showError('+(x.run_id||0)+')">📋 View the error</button>'
        +(x.url?'<a class="btn mini ghost" href="'+esc(x.url)+'" target="_blank">↗ Full log</a>':'')+'</div>'
        +'<div id="err'+(x.run_id||0)+'" style="margin-top:6px"></div></div>';
    }).join("");
  }
  function showError(run){
    var o=el("err"+run); if(!o) return;      o.innerHTML='<div class="muted" style="font-size:12px">Loading the error…</div>';
    api("/api/error-detail?run="+run).then(function(r){return r.json();}).then(function(j){
      o.innerHTML='<div class="card" style="background:var(--bg);padding:8px"><div style="color:var(--am);font-weight:700;font-size:12px;margin-bottom:4px">'+esc(j.step||"")+'</div>'
        +'<div style="font-family:monospace;font-size:10.5px;white-space:pre-wrap;max-height:220px;overflow:auto">'+esc(j.detail||j.error||"no detail")+'</div></div>';
    }).catch(function(){o.innerHTML='<div class="muted">Could not load the error.</div>';});
  }

  function scoreColor(s){ return s>=7.5?"#34d399":(s>=6?"#f59e0b":"#f87171"); }
  function nextStepHtml(){
    var p=ST.production||{}, sst=ST.shorts_status||{};
    if(!p.done) return ""; // still in video review/publish: send the production card
    var prop=ST.shorts_proposal||[];
    var uplPend=prop.filter(function(s){return s.state==="uploaded" && s.privacy!=="public" && !s.publish_at;}); // shorts made that still need to be published/scheduled
    var anyUploaded=prop.some(function(s){return s.state==="uploaded";});
    // Video already published → the next step is the Shorts (only if any are missing; the made/scheduled ones stay hidden).
    if(sst.pending) return '<div class="card" style="border:1px solid var(--cy)"><div style="font-weight:700">🎬 Next: approve shorts</div><div class="muted" style="font-size:12px;margin:4px 0">There are '+sst.pending+' suggested short(s) waiting for your approval.</div><button class="btn" onclick="goShorts()">View shorts to approve</button></div>';
    if(sst.approved_pend) return '<div class="card" style="border:1px solid var(--cy)"><div style="font-weight:700">🎬 Next: generate shorts</div><div class="muted" style="font-size:12px;margin:4px 0">'+sst.approved_pend+' approved(s), ready to generate.</div><button class="btn" onclick="goShorts()">Go to Shorts</button></div>';
    if(uplPend.length) return '<div class="card"><button class="btn" onclick="goShorts()">🎬 Publish/schedule shorts ('+uplPend.length+')</button></div>';
    if(sst.can_suggest) return '<div class="card" style="border:1px solid var(--cy)"><div style="font-weight:700">🎬 Next: generate shorts</div><div class="muted" style="font-size:12px;margin:4px 0">The video is published and still has no shorts. Generate them (more reach → more people to the video).</div><button class="btn" onclick="goShorts()">Go to Shorts</button></div>';
    return '';
  }
  function voicePickerHtml(){
    var vp=ST.voices_pick; if(!vp||!vp.options||!vp.options.length) return "";
    return '<h2>🎙️ Channel voice</h2><div class="card">'
      +'<div class="muted" style="font-size:12px;margin-bottom:8px">Listen and choose the voice for the next videos. The current one is marked.</div>'
      +vp.options.map(function(o){
        var cur=o.id===vp.current;
        return '<div style="margin:6px 0;padding:8px;border-radius:10px;background:'+(cur?"rgba(34,211,238,.12)":"transparent")+'">'
          +'<div style="display:flex;align-items:center;gap:8px"><div style="flex:1;font-weight:600">'+esc(o.label)+(cur?' <span style="color:var(--cy);font-size:12px">· actual</span>':'')+'</div>'
          +(cur?'':'<button class="btn mini" onclick="pickVoice(\\''+o.id+'\\')">Usar</button>')+'</div>'
          +'<audio controls preload="none" style="width:100%;height:34px;margin-top:5px"><source src="'+esc(location.origin+o.sample_url)+'" type="audio/mpeg"></audio>'
          +'</div>';
      }).join("")
      +'</div>';
  }
  function r2Html(){
    var r=ST.r2; if(!r) return "";
    var warn=r.pct>=80;
    return '<h2>💾 Storage '+(warn?'<span style="color:var(--am)">⚠️</span>':'')+'</h2><div class="card">'
      +'<div class="muted">'+r.used_gb+' GB of '+r.limit_gb+' GB (free) · '+num(r.count)+' files</div>'
      +'<div class="bar"><i style="width:'+Math.max(2,r.pct)+'%;background:'+(warn?"#f87171":"var(--cy)")+'"></i></div>'
      +(warn
        ?'<div style="color:var(--am);font-weight:700;margin-top:8px">⚠️ R2 at '+r.pct+'%. Need to free up space to keep it free (delete old renders/audio).</div>'
        :'<div class="muted" style="font-size:11px;margin-top:6px">At '+r.pct+'% of the free limit. Checked every ~30 min.</div>')
      +'</div>';
  }
  function analyticsHtml(){
    var a=ST.analytics, tot=ST.totals||{};
    var h='<h2>📊 Analytics de YouTube <span class="live"></span></h2>';
    if(!ST.analytics_ok){
      return h+'<div class="card muted">No Analytics data yet. If you already reauthorized the permission, YouTube takes ~1-2 days to process the first data. If it is still empty after 2 days, reauthorize the OAuth with the scope <b>yt-analytics.readonly</b>. Then you will see views, watch minutes, and live growth.</div>';
    }
    // VALUES = FULL channel (not 28 days): subscribers, total views, watch minutes, videos.
    h+='<div class="card"><div class="muted" style="font-size:12px;margin-bottom:8px">Your full channel</div><div class="row">'
      +'<div class="kpi"><div class="n">'+num(tot.subs||0)+'</div><div class="l">Subscribers</div></div>'
      +'<div class="kpi"><div class="n">'+num(tot.views||0)+'</div><div class="l">Views</div></div>'
      +'<div class="kpi"><div class="n">'+num(tot.watch_min||0)+'</div><div class="l">Min vistos</div></div>'
      +'<div class="kpi"><div class="n">'+num(tot.videos||0)+'</div><div class="l">Videos</div></div>'
      +'</div>';
    // CHART = last 7 days, with numeric Y-AXIS (vertical) to read the scale.
    var daily=((a&&a.daily)||[]).slice(-7);
    if(daily.length){
      var mx=Math.max.apply(null, daily.map(function(x){return x.views||0;}).concat([1]));
      var CH=90; // height of the bar area in px
      // Eje Y: 3 marcas (max, mitad, 0)
      var yl=[mx, Math.round(mx/2), 0].map(function(v){
        return '<div style="flex:1;display:flex;align-items:flex-start;justify-content:flex-end;font-size:10px;color:var(--hint);line-height:1">'+num(v)+'</div>';
      }).join("");
      var bars=daily.map(function(x){
        var v=x.views||0, hh=Math.max(2, Math.round((v/mx)*CH));
        var dd=x.d?String(x.d).slice(5).replace("-","/"):"";
        return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:3px">'
          +'<div style="font-size:10px;color:var(--txt);font-weight:600">'+num(v)+'</div>'
          +'<div title="'+esc(x.d)+': '+v+' views" style="width:70%;height:'+hh+'px;background:var(--cy);border-radius:3px 3px 0 0"></div>'
          +'<div style="font-size:9px;color:var(--hint)">'+esc(dd)+'</div></div>';
      }).join("");
      h+='<div style="margin-top:12px"><div class="muted" style="font-size:11px;margin-bottom:6px">Views per day — last 7 days</div>'
        +'<div style="display:flex;gap:6px">'
        +'<div style="display:flex;flex-direction:column;height:'+CH+'px;width:34px;text-align:right">'+yl+'</div>'
        +'<div style="flex:1;display:flex;gap:4px;align-items:flex-end;border-left:1px solid rgba(255,255,255,.18);border-bottom:1px solid rgba(255,255,255,.18);padding:0 2px 0 6px;min-height:'+(CH+18)+'px">'+bars+'</div>'
        +'</div></div>';
    } else if(ST.analytics_ok){
      h+='<div class="muted" style="font-size:11px;margin-top:10px">No daily history yet. YouTube fills it in 1-2 days after the first public views.</div>';
    }
    h+='</div>';
    h+='<div class="card muted" style="font-size:11px">YouTube Analytics data is ~1-2 days behind.</div>';
    return h;
  }
  function factoryHtml(){
    // Daily capacity (real throughput) + duration experiment (raise duration little by little).
    var f=ST.factory; if(!f) return "";
    var d=f.duration||{}; var ramp=(d.ramp||[]); var step=d.step||0;
    var rampHtml=ramp.map(function(m,i){
      var on=i===step, done=i<step;
      return '<span style="font-size:11px;padding:3px 9px;border-radius:20px;margin:2px 3px 2px 0;display:inline-block;'
        +(on?'background:rgba(34,211,238,.18);color:var(--cy);font-weight:700':done?'background:rgba(52,211,153,.15);color:var(--gr)':'background:rgba(255,255,255,.06);color:var(--hint)')
        +'">'+(done?'✓ ':'')+m+'m</span>';
    }).join("");
    var last=(d.history||[]).slice(-1)[0];
    var h='<h2>🏭 Factory</h2><div class="card">'
      +'<div class="muted" style="font-size:11px;margin-bottom:6px">Publishing capacity (last 7 days).</div>'
      +'<div class="row">'
      +'<div class="kpi"><div class="n">'+(f.pub_7d||0)+'</div><div class="l">Publicados 7d</div></div>'
      +'<div class="kpi"><div class="n">'+(f.per_day!=null?f.per_day:0)+'</div><div class="l">Per day</div></div>'
      +'<div class="kpi"><div class="n">'+(f.pub_7d_long||0)+'</div><div class="l">Largos</div></div>'
      +'<div class="kpi"><div class="n">'+(f.pub_7d_short||0)+'</div><div class="l">Shorts</div></div>'
      +'</div>';
    if(ramp.length){
      h+='<div style="margin-top:12px;border-top:1px solid rgba(255,255,255,.08);padding-top:10px">'
        +'<div class="muted" style="font-size:12px;margin-bottom:5px">Duration experiment — target <b style="color:var(--cy)">'+(d.target_min||ramp[step]||8)+' min</b> (raise little by little with the tests):</div>'
        +'<div>'+rampHtml+'</div>'
        +(last?'<div class="muted" style="font-size:11px;margin-top:7px">Last video: '+(last.actual_min||0)+' min — QA '+(last.qa_passed?'✓':'✗')+' — streak '+(d.streak||0)+'/2 to move up a step</div>':'<div class="muted" style="font-size:11px;margin-top:7px">No measured videos yet.</div>')
        +'</div>';
    }
    h+='</div>';
    return h;
  }
  function pendingThumbsHtml(){
    var vm=ST.video_matrix||[];
    // Only the ones that still need approval; once approved, the card disappears.
    var pend=vm.filter(function(v){return v.thumb_url && !(v.stages||{}).miniatura;});
    if(!pend.length) return "";
    return pend.map(function(v){
      var u=esc(location.origin+v.thumb_url)+"?t="+(ST.updated_at||"");
      var appr=v.thumb_approved;
      return '<div class="card" style="border:1px solid var(--cy)">'
        +'<div style="font-weight:700;margin-bottom:6px">🖼️ Thumbnail — '+(appr?'approved ✓, needs publishing':'to approve')+' · '+esc((v.title||"").slice(0,22))+'</div>'
        +'<a href="'+u+'" target="_blank"><img src="'+u+'" style="width:100%;border-radius:8px;display:block;margin-bottom:8px"></a>'
        +(appr
          ? '<button class="btn" onclick="thumbPublish(\\''+v.video_id+'\\')">🌍 Publicar (put it on YouTube)</button>'
          : '<button class="btn" onclick="thumbApprove(\\''+v.video_id+'\\')">✅ Approve</button>')
        +'<button class="btn ghost" onclick="thumbRow(\\''+v.video_id+'\\')">🔁 Rehacer otra</button></div>';
    }).join("");
  }
  function matrixHtml(){
    // Does the video ALREADY have Shorts? (from the tree, includes SCHEDULED ones) -> don't mark "not Shorts".
    var hasShorts={}; (ST.video_tree||[]).forEach(function(l){ if((l.shorts||[]).length) hasShorts[l.video_id]=true; });
    var shDone=function(v){ return (v.stages||{}).shorts || hasShorts[v.video_id]; };
    // Only videos produced with something pending; the ones already complete ✓ don't appear, and the ones already
    // SCHEDULED ones either (you already see them in 📅 Agenda; don't repeat the note here).
    var vm=(ST.video_matrix||[]).filter(function(v){var s=v.stages||{};return !v.scheduled && !(s.publicado && s.miniatura && shDone(v));});
    if(!(ST.video_matrix||[]).length) return "";
    if(!vm.length) return '<h2>📋 Video control</h2><div class="card muted">✅ All videos are up to date: published, with thumbnail and shorts.</div>';
    var head='<tr><th style="text-align:left">Video</th><th>🌍 Public</th><th>🖼️ Thumbnail</th><th>🎬 Shorts</th></tr>';
    var rows=vm.map(function(v){
      var s=v.stages||{}, vid=v.video_id;
      function cell(key,act){
        if(s[key]) return '<td style="text-align:center;color:#34d399;font-size:16px">✓</td>';
        return '<td style="text-align:center"><span style="cursor:pointer;color:var(--cy);font-weight:800" onclick="'+act+'">＋ Do</span></td>';
      }
      // Public: ✓ if live, 🕒 Scheduled if it has future time, ＋ Do if missing.
      var pubCell;
      if(v.public){ pubCell='<td style="text-align:center;color:#34d399;font-size:16px">✓</td>'; }
      else if(v.scheduled){ pubCell='<td style="text-align:center"><span style="color:var(--cy);font-size:11px;font-weight:700">🕒 Scheduled</span></td>'; }
      else { pubCell='<td style="text-align:center"><span style="cursor:pointer;color:var(--cy);font-weight:800" onclick="publishRow(\\''+vid+'\\')">＋ Do</span></td>'; }
      // Thumbnail: only STATUS in the table; the big image and button appear ABOVE.
      var miniCell;
      if(s.miniatura){
        miniCell='<td style="text-align:center"><span style="color:#34d399;font-size:15px">✓</span> <span style="cursor:pointer;color:var(--hint)" onclick="thumbRow(\\''+vid+'\\')">🔁</span></td>';
      } else if(v.thumb_url){
        miniCell='<td style="text-align:center"><span style="cursor:pointer;color:var(--am);font-size:11px;font-weight:700" onclick="window.scrollTo(0,0)">⏳ approve ↑</span></td>';
      } else {
        miniCell='<td style="text-align:center"><span style="cursor:pointer;color:var(--cy);font-weight:800" onclick="thumbRow(\\''+vid+'\\')">＋ Do</span></td>';
      }
      // Shorts: ✓ if it already has (even if SCHEDULED). If not, ＋Do (only if the video is already public).
      var shortsCell;
      if(shDone(v)){ shortsCell='<td style="text-align:center;color:#34d399;font-size:16px">✓</td>'; }
      else if(v.public){ shortsCell='<td style="text-align:center"><span style="cursor:pointer;color:var(--cy);font-weight:800" onclick="goShorts(\\''+vid+'\\')">＋ Do</span></td>'; }
      else { shortsCell='<td style="text-align:center"><span style="color:var(--hint);font-size:11px">⏳ to publish</span></td>'; }
      return '<tr><td>'+(vid?'<a href="https://youtu.be/'+vid+'" target="_blank">'+esc((v.title||"").slice(0,20))+'</a>':esc((v.title||"").slice(0,20)))+'</td>'
        +pubCell
        +miniCell
        +shortsCell
        +'</tr>';
    }).join("");
    return '<h2>📋 Video control</h2>'
      +'<div class="muted" style="font-size:12px;margin:0 2px 6px">What each video is missing. <b>＋ Do</b> to complete it. You <b>see the thumbnail here</b> and give it ✅ Approve (or 🔁 redo) before putting it on. It doesn't change what's already published.</div>'
      +'<div class="card" style="padding:8px"><table style="font-size:13px">'+head+rows+'</table></div>';
  }
  function currentStage(){
    var a=ST.active||[], p=ST.production||{}, sst=ST.shorts_status||{};
    var isA=function(re){return a.some(function(r){return re.test(r.name||"");});};
    if(isA(/Producir|guion/i)) return 1;
    if(isA(/Voiceover|voz/i)) return 2;
    if(isA(/Render|fase/i)) return 3;
    if(p.seo && !p.approved && !p.done) return 4;
    if(p.approved && !p.done) return 5;
    if(p.done && (sst.pending||sst.approved_pend||(sst.uploaded&&!sst.all_done)||sst.can_suggest)) return 6;
    return 0;
  }
  function flowStepsHtml(){
    var st=currentStage(); if(!st) return "";
    var steps=["Script","Voice","Render","Approve","Publish","Shorts"];
    var cells=steps.map(function(lbl,i){
      var n=i+1; var col = n<st?"var(--gr)":(n===st?"var(--cy)":"var(--hint)");
      return '<div style="flex:1;text-align:center;font-size:10px;font-weight:'+(n===st?"700":"400")+';color:'+col+'">'+(n<st?"✓ ":(n===st?"● ":""))+esc(lbl)+'</div>';
    }).join("");
    return '<div class="card" style="padding:10px"><div style="font-weight:700;font-size:13px;margin-bottom:6px">📍 We're on step '+st+' of 6</div><div style="display:flex;gap:4px">'+cells+'</div></div>';
  }
  // Score to show: use min_score if valid; if 0 (some phase without score saved due to a
  // persistence failure), take the minimum of the phases that DO have a score. Avoids showing a false 0.
  function calScore(q){
    if(!q) return 0;
    if(+q.min_score>0) return +q.min_score;
    var v=(q.phases||[]).map(function(f){return +f.score||0;}).filter(function(s){return s>0;});
    if(!v.length) return 0;
    return Math.round(Math.min.apply(null,v)*10)/10;
  }
  function phaseBars(q){
    return (q.phases||[]).filter(function(f){return +f.score>0;}).map(function(f){
      return '<div style="flex:1;text-align:center"><div class="bar" style="height:8px"><i style="width:'+Math.round((f.score/10)*100)+'%;background:'+scoreColor(f.score)+'"></i></div><div class="muted" style="font-size:10px;margin-top:3px">'+esc(f.phase)+'·'+f.score+'</div></div>';
    }).join("");
  }
  function productionHtml(){
    var p=ST.production||{}, q=p.quality, seo=p.seo;
    if(p.done) return ""; // video already published: the SEO step finished, don't show its score
    // Video RENDERED waiting for approval -> view / approve / regenerate, all in the app.
    if(p.render_pending){
      var q2=p.quality||{}, ms=calScore(q2);
      var qa=p.render_qa||{};
      var hr='<h2>🎬 Video ready — review and approve</h2>';
      var mmss=qa.duration?(' · '+Math.floor(qa.duration/60)+':'+('0'+(qa.duration%60)).slice(-2)):'';
      if(qa.warning){
        hr+='<div class="card" style="border:1px solid rgba(245,158,11,.5)"><b style="color:var(--am)">⚠️ '+esc(qa.warning)+'</b><div class="muted" style="font-size:12px;margin-top:4px">Review it: approve it if it works for you or regenerate it.</div></div>';
      } else {
        hr+='<div class="muted" style="font-size:12px;margin:2px">✅ Full video (duration'+mmss+'). Watch it and decide.</div>';
      }
      if(p.watch_url) hr+='<a class="btn" href="'+esc(location.origin+p.watch_url)+'" target="_blank">▶️ Watch the video</a>';
      // FULL SCORE (score + phases) BEFORE approving/regenerating, next to the video.
      if(ms>0){
        var phr=phaseBars(q2);
        hr+='<div class="card"><div style="display:flex;align-items:center;gap:12px">'
          +'<div class="score" style="color:'+scoreColor(ms)+'">'+ms+'<span style="font-size:13px;color:var(--hint)">/10</span></div>'
          +'<div><div style="font-weight:700">IA score of the video</div><div class="muted" style="font-size:12px">'+(ms>=7.5?"✅ Passed the minimum (7.5)":"⚠️ Below 7.5 — you can regenerate before uploading it")+'</div></div></div>'
          +(phr?'<div style="display:flex;gap:8px;margin-top:12px">'+phr+'</div>':'')
          +'<div class="muted" style="font-size:11px;margin-top:8px">Watch it, review the per-phase score and decide: approve it or regenerate it.</div></div>';
      } else {
        hr+='<div class="card muted" style="font-size:12px">⏳ The IA score is still being calculated… reload in a few seconds.</div>';
      }
      hr+='<button class="btn" onclick="approveRender()">✅ Approve (upload and prepare the SEO)</button>'
        +'<button class="btn ghost" onclick="regenRender()">🔁 Regenerate the video</button>';
      return hr;
    }
    if(!q && !seo) return "";
    var h='<h2>🎬 Video in production</h2>';
    if(q){
      var ms=calScore(q);
      var ph=phaseBars(q);
      h+='<div class="card"><div style="display:flex;align-items:center;gap:12px">'
        +'<div class="score" style="color:'+scoreColor(ms)+'">'+ms+'<span style="font-size:13px;color:var(--hint)">/10</span></div>'
        +'<div><div style="font-weight:700">IA score of the video</div><div class="muted" style="font-size:12px">'+(ms>=7.5?"✅ Passed the minimum (7.5)":"⚠️ Below 7.5 — worth regenerating")+'</div></div></div>'
        +(ph?'<div style="display:flex;gap:8px;margin-top:12px">'+ph+'</div>':'')+'</div>';
    }
    if(seo){
      var val=seo.validation||{};
      h+='<div class="card"><div style="font-weight:700;margin-bottom:8px">📦 SEO to publish'+(val.nota_global!=null?' · <span style="color:'+scoreColor(val.nota_global)+'">'+val.nota_global+'/10</span>':'')+'</div>'
        +'<div class="muted" style="font-size:11px">TITLE</div><div style="font-weight:600;margin-bottom:8px">'+esc(seo.title||"—")+'</div>'
        +'<div class="muted" style="font-size:11px">DESCRIPTION</div><div style="font-size:13px;white-space:pre-wrap;max-height:130px;overflow:auto;margin-bottom:8px">'+esc((seo.description||"—").slice(0,600))+'</div>'
        +'<div class="muted" style="font-size:11px">TAGS</div><div style="margin-bottom:4px">'+((seo.tags||[]).map(function(t){return '<span class="chip" style="font-size:11px">'+esc(t)+'</span>';}).join(" ")||"—")+'</div>'
        +((val.problemas&&val.problemas.length)?'<div class="muted" style="font-size:12px;color:var(--am);margin-top:6px">⚠️ '+esc(val.problemas.join("; "))+'</div>':'')
        +'</div>';
      var thumbInner = p.thumb_url
        ? '<img src="'+esc(location.origin+p.thumb_url)+'" style="width:100%;display:block" alt="thumbnail">'
        : '<div class="ytthumb"><span class="ytbig">'+esc(seo.thumbnail_text||"THE DATA LENS")+'</span></div>';
      h+='<div class="muted" style="font-size:11px;margin:2px 2px 0">Preview'+(p.thumb_url?" (real thumbnail)":" (how it would look)")+':</div>'
        +'<div class="ytcard">'+thumbInner
        +'<div style="padding:9px"><div class="yttitle">'+esc(seo.title||"—")+'</div><div class="muted" style="font-size:12px">The Data Lens · '+(p.video_id?"privado":"—")+'</div></div></div>';
    }
    if(p.watch_url){ h+='<a class="btn ghost" href="'+esc(location.origin+p.watch_url)+'" target="_blank">▶️ Watch the video</a>'; }
    if(seo){
      h+='<div class="card"><div class="muted" style="font-size:12px;margin-bottom:6px">Comments to improve the SEO (optional):</div>'
        +'<textarea id="seoNotes" placeholder="e.g.: more direct title, less clickbait, mention the figure"></textarea>'
        +'<button class="btn ghost" onclick="regenSeo()">🔁 Regenerate SEO</button>';
      if(p.approved){
        h+='<div style="text-align:center;font-weight:700;color:var(--am);padding:8px;margin:8px 0;background:rgba(245,158,11,.12);border-radius:12px">✅ Approved · needs scheduling</div>'
          +'<button class="btn" onclick="scheduleVideo()">📅 Schedule at best hour</button>'
          +'<div class="muted" style="font-size:11px;margin:4px 0 8px">Auto-scheduling didn't find a free hour or failed. Tap here to retry. You'll see it in 📅 Agenda.</div>'
          +'<button class="btn ghost" onclick="publishVideo()">🌍 Publish now</button>';
      } else {
        h+='<button class="btn" onclick="approveSeo()">✅ Approve and schedule (best hour)</button>'
          +'<div class="muted" style="font-size:11px;margin-top:4px">One tap: approve the SEO and it <b>schedules itself</b> at the next best hour (US). You'll see it in 📅 Agenda. YouTube publishes it on its own at that time.</div>';
      }
      h+='</div>';
    }
    return h;
  }

  function craftHtml(){
    // Auto-improvement: what the system learned from the last video and applies to the next one.
    var c=ST.craft; if(!c||(!c.footage && !c.hook && !c.score)) return "";
    var f=c.fixes||{};
    var fx=[];
    if(f.brightness) fx.push("luz "+(f.brightness>0?"+":"")+f.brightness);
    if(f.saturation) fx.push("saturation "+(f.saturation>0?"+":"")+f.saturation);
    if(f.contrast) fx.push("contraste "+(f.contrast>0?"+":"")+f.contrast);
    if(f.pace==="faster") fx.push("faster cuts");
    return '<h2>🔧 Auto-improvement (each video learns from the previous one)</h2>'
      +'<div class="card"><div class="muted" style="font-size:11px;margin-bottom:4px">This is applied automatically to the NEXT render.</div>'
      +(c.score?'<div style="font-size:12px">Last render score: <b>'+c.score+'/10</b></div>':'')
      +(c.hook?'<div style="font-size:12px">🪝 Gancho: '+esc(c.hook)+'</div>':'')
      +(c.footage?'<div style="font-size:12px">🎬 Footage a mejorar: '+esc(c.footage)+'</div>':'')
      +(fx.length?'<div style="font-size:12px;color:var(--cy)">🎨 Learned settings: '+esc(fx.join(" · "))+'</div>':'')
      +'</div>';
  }
  function learningsHtml(){
    // What we learned from what's already uploaded (metrics + trends) and applies to the NEXT video.
    var l=ST.learnings; if(!l||!l.brief) return "";
    var srcTxt={"metricas-reales":"according to the REAL performance of your videos","sin-videos-publicos":"no own data yet: trends + best practices","sin-oauth":"best practices (missing metrics permission)","error-fallback":"best practices"}[l.source]||"";
    var top=(l.top||[]).slice(0,3).map(function(v){return '<div class="muted" style="font-size:11px">• '+esc((v.title||"").slice(0,42))+' — '+num(v.views||0)+' views'+(v.watch?' · '+num(v.watch)+' min':'')+'</div>';}).join("");
    return '<h2>📈 What we're improving</h2>'
      +'<div class="card"><div class="muted" style="font-size:11px;margin-bottom:6px">Applied to the next script '+esc(srcTxt)+'.</div>'
      +'<div style="font-size:13px;white-space:pre-wrap;max-height:180px;overflow:auto">'+esc(l.brief)+'</div>'
      +(top?'<div style="margin-top:8px;border-top:1px solid rgba(255,255,255,.08);padding-top:6px"><div class="muted" style="font-size:11px;font-weight:700">What performs most:</div>'+top+'</div>':'')
      +(l.at?'<div class="muted" style="font-size:10px;margin-top:6px">Analizado: '+esc(String(l.at).slice(0,16).replace("T"," "))+'</div>':'')
      +'</div>';
  }
  function fmtSlot(iso){
    try{
      var d=new Date(iso);
      var et=d.toLocaleString("en-US",{timeZone:"America/New_York",weekday:"short",day:"numeric",month:"short",hour:"numeric",minute:"2-digit",hour12:true});
      var lo=d.toLocaleString("en-US",{timeZone:"America/Bogota",hour:"numeric",minute:"2-digit",hour12:true});
      return et+" ET · tu "+lo;
    }catch(e){return iso;}
  }
  // Queue horizon: how many days ahead we're scheduled. The brain schedules the DAY
  // BEFORE (buffer ~1 day) to learn fast; if there are several days, it's old backlog draining.
  function queueHorizonHtml(arr){
    var now=Date.now();
    var times=(arr||[]).map(function(v){return Date.parse(v.publish_at);}).filter(function(n){return !isNaN(n)&&n>now;});
    if(!times.length) return "";
    var last=Math.max.apply(null,times);
    var days=Math.round((last-now)/864e5*10)/10;
    var ok=days<=2; // ~1-2 days = healthy (the brain acts in time)
    var fecha=new Date(last).toLocaleDateString([],{weekday:'short',day:'numeric',month:'short'});
    return '<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px">'       +'<div><b>🗓️ '+times.length+' scheduled</b><div class="muted num" style="font-size:11px;margin-top:2px">publish until '+esc(fecha)+' · ~'+days+' days</div></div>'       +'<span class="tag '+(ok?'pub':'priv')+'">'+(ok?'on pace ~1 day':'draining')+'</span></div>'
      +'<div class="muted" style="font-size:11px;margin-top:8px">🧠 The brain schedules ~<b>1 day ahead</b> (buffer ~1 day) to learn fast. If you see several days, it is old backlog draining — the queue cap keeps it from stretching again.</div></div>';
  }
  function scheduledHtml(){
    // SCHEDULED videos (with a future time). When they publish, YouTube moves them to public and they disappear.
    var s=ST.scheduled||[]; if(!s.length) return "";
    var rows=s.map(function(v){
      return '<div style="border-top:1px solid rgba(255,255,255,.06);padding:6px 0">'
        +'<div style="font-size:12px">'+(v.type==="short"?"🎬 ":"📹 ")+(v.video_id?'<a href="https://youtu.be/'+v.video_id+'" target="_blank">'+esc((v.title||"").slice(0,34))+'</a>':esc(v.title||""))+'</div>'
        +'<div style="font-size:11px;color:var(--cy)">🕒 '+esc(fmtSlot(v.publish_at))+'</div></div>';
    }).join("");
    return '<h2>📅 Scheduled ('+s.length+')</h2>'
      +'<div class="card"><div class="muted" style="font-size:11px;margin-bottom:4px">They publish on their own at the best time (US). When they publish, they disappear from here.</div>'+rows+'</div>';
  }
  function pendingReviewHtml(){
    // PRIVATE ones to review: The Data Lens uploads as private (so you can review). Here they show with
    // Program/S Publish actions (same as Oddly), so the agenda doesn't stay blank.
    var all=ST.all_videos||[]; var sid={}; (ST.scheduled||[]).forEach(function(s){sid[s.video_id]=1;});
    var pend=all.filter(function(v){ if(!v.video_id||v.privacy==="public")return false; if(v.publish_at)return false; var loc=localSched[v.video_id]; if(loc==="schedule"||loc==="public")return false; return !sid[v.video_id]; });
    if(!pend.length) return "";
    var rows=pend.slice(0,20).map(function(v){
      return '<div style="border-top:1px solid rgba(255,255,255,.06);padding:8px 0">'
        +'<div style="font-size:12px">'+(v.type==="short"?"🎬 ":"📹 ")+(v.video_id?'<a href="https://youtu.be/'+v.video_id+'" target="_blank">'+esc((v.title||"Video").slice(0,34))+'</a>':esc((v.title||"").slice(0,34)))+' <span class="muted" style="font-size:10px">(privado)</span></div>'
        +'<div style="margin-top:6px"><button class="btn mini" onclick="dlPublish(\\''+v.video_id+'\\',\\'schedule\\')">📅 Schedule (best hour)</button> <button class="btn mini ghost" onclick="dlPublish(\\''+v.video_id+'\\',\\'public\\')">🌍 Publish now</button></div>'
        +'</div>';
    }).join("");
    return '<h2>👀 Private to review ('+pend.length+')</h2>'
      +'<div class="card"><div class="muted" style="font-size:12px;margin-bottom:6px">The Data Lens uploads as <b>private</b> so you can review them. Tap <b>Schedule</b> (best US hour) to go to the calendar, or <b>Publish now</b> to make it public right away.</div>'+rows+'</div>';
  }
  function categoryScoreHtml(){
    // A/B/C experiment: views/day by category (from the Brain). The leader is the one to scale.
    var dl=(ST.brain&&ST.brain.data_lens)||{}, bd=dl.byDir||{};
    var LBL={guerras_imperios:"⚔️ Empires/Wars",inventos_ideas:"💡 Inventions/Ideas",personajes_momentos:"👤 Characters/Moments"};
    var rows=Object.keys(bd).map(function(k){var d=bd[k]||{};return {k:k,vpd:d.n?d.vpd/d.n:0,n:d.n||0};}).sort(function(a,b){return b.vpd-a.vpd;});
    var body=rows.length?rows.map(function(r,i){return '<tr><td>'+(i===0&&r.vpd>0?"🏆 ":"")+esc(LBL[r.k]||r.k)+'</td><td style="text-align:right">'+r.vpd.toFixed(1)+'</td><td style="text-align:right">'+r.n+'</td></tr>';}).join(""):'<tr><td colspan="3" class="muted">No data yet — publish shorts and wait ~1 week (Analytics runs 2-3 days behind).</td></tr>';
    return '<h2>🧪 Experiment by category</h2><div class="card"><div class="muted" style="font-size:12px;margin-bottom:6px">Views/day by category. The leader is the one to scale.</div>'
      +'<table style="font-size:13px;width:100%"><tr><th style="text-align:left">Category</th><th style="text-align:right">views/day</th><th style="text-align:right"># pub.</th></tr>'+body+'</table>'
      +(dl.msg?'<div class="muted" style="font-size:12px;margin-top:8px">🧠 '+esc(dl.msg)+'</div>':'')+'</div>';
  }
  function calendarHtml(){
    // DAY-BY-DAY calendar: each day with its 2 slots (best US hours), full or free. Goal 2/day.
    var cal=ST.calendar||[];
    var h='<h2>📅 Publishing calendar</h2>'
      +'<div class="card muted" style="font-size:12px">Each day has 2 slots in the best hours (US). When the brain <b>produces</b> a video, it schedules itself in the next free slot. <b>Goal: 2/day.</b></div>';
    if(!cal.length) return h+'<div class="card muted">Nothing scheduled yet. Approve a video (Control) or a short (Shorts) and it appears here.</div>';
    cal.forEach(function(d){
      var filled=d.slots.filter(function(s){return s.filled;}).length;
      var slots=d.slots.map(function(s){
        if(s.filled){
          return '<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-top:1px solid rgba(255,255,255,.06)">'
            +'<div style="font-size:12px">'+(s.type==="short"?"🎬":"📹")+' '+esc((s.title||"Video").slice(0,32))+(s.off_slot?' <span class="muted" style="font-size:10px">(hora manual)</span>':'')+'</div>'
            +'<div style="font-size:11px;color:var(--acc);white-space:nowrap">'+esc(s.time)+'</div></div>';
        }
        return '<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-top:1px dashed rgba(255,255,255,.10)">'
          +'<div style="font-size:12px;color:var(--hint)">— Libre —</div>'
          +'<div style="font-size:11px;color:var(--hint);white-space:nowrap">'+esc(s.time)+'</div></div>';
      }).join("");
      var badge=filled>=2?'<span style="color:var(--gr)">✔ '+filled+'</span>':'<span style="color:var(--am)">'+filled+'/2</span>';
      h+='<div class="card" style="padding:10px 12px"><div style="display:flex;justify-content:space-between;font-weight:700;font-size:13px;text-transform:capitalize"><span>'+esc(d.label)+'</span>'+badge+'</div>'+slots+'</div>';
    });
    return h;
  }
  function bestTimesHtml(){
    // Best times to PUBLISH (US audience, data/money channel, faceless).
    // Upload ~2-3h BEFORE the afternoon/night peak so the algorithm indexes it in time.
    // Runs in the browser -> real ET time (with daylight saving) via timezone.
    var now=new Date();
    var etNow=new Date(now.toLocaleString("en-US",{timeZone:"America/New_York"}));
    var dow=etNow.getDay(); // 0 Sun .. 6 Sat
    var hr=etNow.getHours()+etNow.getMinutes()/60;
    // Optimal window per day: [start, end, label] in ET
    var WIN={0:[9,11,"9–11 AM"],1:[15,18,"3–6 PM"],2:[12,15,"12–3 PM"],3:[12,15,"12–3 PM"],4:[12,15,"12–3 PM"],5:[12,15,"12–3 PM"],6:[9,11,"9–11 AM"]};
    var DAYS=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    var BEST={4:1,5:1,6:1,0:1}; // best days for this niche: Thu, Fri, Sat, Sun
    // ET vs your time (Bogotá) right now (handles DST only).
    var diff=new Date(now.toLocaleString("en-US",{timeZone:"America/New_York"})).getHours()-new Date(now.toLocaleString("en-US",{timeZone:"America/Bogota"})).getHours();
    function loc(h){var x=((h-diff)%24+24)%24;var ap=x>=12?"PM":"AM";var hh=x%12;if(hh===0)hh=12;return hh+" "+ap;}
    var w=WIN[dow], rec, recLoc;
    if(hr<w[1]){
      var when=hr<w[0]?"today":"now (window open)";
      rec="📌 Publish <b>"+when+"</b> · "+DAYS[dow]+" "+w[2]+" ET"+(BEST[dow]?" ★":"");
      recLoc="your time: "+loc(w[0])+"–"+loc(w[1]);
    } else {
      var nd=(dow+1)%7, w2=WIN[nd];
      rec="📌 Next good time: <b>"+DAYS[nd]+" "+w2[2]+" ET</b>"+(BEST[nd]?" ★":"");
      recLoc="your time: "+loc(w2[0])+"–"+loc(w2[1]);
    }
    // Compact weekly table
    var rows=[0,1,2,3,4,5,6].map(function(d){
      var ww=WIN[d];
      return '<tr'+(d===dow?' style="background:rgba(34,211,238,.12)"':'')+'><td>'+DAYS[d]+(BEST[d]?' ★':'')+'</td><td style="text-align:right">'+ww[2]+' ET</td><td style="text-align:right;color:var(--hint)">'+loc(ww[0])+'–'+loc(ww[1])+'</td></tr>';
    }).join("");
    return '<h2>⏰ Best times to publish</h2>'
      +'<div class="card"><div style="font-weight:700;font-size:14px">'+rec+'</div>'
      +'<div class="muted" style="font-size:12px;margin-top:2px">'+recLoc+'</div>'
      +'<table style="font-size:12px;margin-top:10px;width:100%"><tr><th style="text-align:left">Day</th><th style="text-align:right">US time (ET)</th><th style="text-align:right">Your time</th></tr>'+rows+'</table>'
      +'<div class="muted" style="font-size:11px;margin-top:8px">★ = best days. Upload ~2-3h before the night peak so the algorithm can push it. '
      +(ST.analytics_ok?'Once the channel has more data, I fine-tune this to the real time your audience connects.':'Once I have audience data, I tailor this to your real audience.')+'</div></div>';
  }

  function auto2KpisHtml(){
    var a=ST.auto2;
    if(!a) return '<div class="card" style="text-align:center;padding:22px"><div style="font-size:34px">🏭</div>'
      +'<div style="font-weight:800;font-size:17px;margin-top:6px">Oddly Loop — no data yet</div>'
      +'<div class="muted" style="font-size:13px;margin-top:6px">Legal ASMR/satisfying compilations, automated. Once there is a video, you will see its views and minutes.</div></div>';
    return '<div class="muted" style="font-size:11px;margin:6px 4px 0">'+esc(a.name||"Oddly Loop")+' · '+esc(a.handle||"@oddlyloophq")+'</div>'
      +'<div class="bento">'
      +'<div class="kpi"><div class="n">'+num(a.subs||0)+'</div><div class="l">Subs</div></div>'
      +'<div class="kpi"><div class="n">'+num(a.total_views||0)+'</div><div class="l">Views</div></div>'
      +'<div class="kpi"><div class="n">'+(a.videos||0)+'</div><div class="l">Videos</div></div>'
      +'<div class="kpi"><div class="n">'+num(a.watch_min||0)+'</div><div class="l">Watch min</div></div>'
      +'</div>';
  }
  // What performs best (by views/day) to replicate that content type + winning category.
  function auto2TopHtml(){
    var a=ST.auto2||{}; var top=a.top||[]; var nr=a.niche_ranking||[];
    if(!top.length && !nr.length) return '<h2>🔥 What performs best</h2><div class="card muted" style="font-size:12px">No view data yet. Once videos accumulate views, you will see which category and which videos pull most — to replicate.</div>';
    var h='<h2>🔥 What performs best (to replicate)</h2>';
    if(nr.length){
      h+='<div class="card"><div class="muted" style="font-size:12px;margin-bottom:6px">Category by views/day — produce more of the top one 👑:</div>'
        +nr.slice(0,4).map(function(r,i){return '<div style="display:flex;justify-content:space-between;border-top:1px solid rgba(255,255,255,.06);padding:5px 0"><div style="font-size:12px">'+(i===0?'👑 ':'')+'<b>'+esc(r.label)+'</b></div><div class="muted" style="font-size:11px;white-space:nowrap">'+r.avg_vpd+'/day · '+r.videos+' vid</div></div>';}).join("")+'</div>';
    }
    if(top.length){
      h+='<div class="card"><div class="muted" style="font-size:12px;margin-bottom:6px">🏆 Top 3 (views/day):</div>'
        +top.slice(0,3).map(function(v,i){return '<div style="display:flex;justify-content:space-between;gap:8px;border-top:1px solid rgba(255,255,255,.06);padding:5px 0"><div style="font-size:12px">'+["🥇","🥈","🥉"][i]+' '+(v.video_id?'<a href="https://youtu.be/'+v.video_id+'" target="_blank">'+esc((v.title||"").slice(0,26))+'</a>':esc(v.title||""))+(v.niche_label?' <span class="muted">('+esc(v.niche_label)+')</span>':'')+'</div><div style="font-size:11px;color:var(--acc);white-space:nowrap">'+num(v.views)+' · '+(v.vpd||0)+'/day</div></div>';}).join("")+'</div>';
    }
    var zero=((a.list)||[]).filter(function(v){return v.privacy==="public"&&(v.views||0)===0;}).length;
    var pubN=((a.list)||[]).filter(function(v){return v.privacy==="public";}).length;
    if(pubN) h+='<div class="card muted" style="font-size:12px">👁️ Not even one view: <b>'+zero+'</b> of '+pubN+' publics.'+(zero?' Review title/thumbnail/time of those.':' ')+'</div>';
    var bh=a.best_hours;
    if(bh&&bh.hours&&bh.hours.length) h+='<div class="card muted" style="font-size:12px">🕐 <b>Best hours (from your data):</b> '+bh.hours.map(function(x){return x+':00';}).join(", ")+' ET · scheduling there. (Based on '+bh.based_on+' videos.)</div>';
    else h+='<div class="card muted" style="font-size:12px">🕐 Publishing hours: for now the ones with the best result from research (US afternoon/night peak). They self-tune once there is channel data.</div>';
    return h;
  }
  // The Data Lens: top videos (views/day) + best hours from data. Empty if there is no signal yet.
  function dataLensTopHtml(){
    var top=ST.top||[]; var bh=ST.best_hours; var h='';
    if(top.length){
      h+='<h2>🔥 What performs best (to replicate)</h2><div class="card"><div class="muted" style="font-size:12px;margin-bottom:6px">🏆 Top 3 (views/day):</div>'
        +top.slice(0,3).map(function(v,i){return '<div style="display:flex;justify-content:space-between;gap:8px;border-top:1px solid rgba(255,255,255,.06);padding:5px 0"><div style="font-size:12px">'+["🥇","🥈","🥉"][i]+' '+(v.video_id?'<a href="https://youtu.be/'+v.video_id+'" target="_blank">'+esc((v.title||"").slice(0,28))+'</a>':esc(v.title||""))+'</div><div style="font-size:11px;color:var(--acc);white-space:nowrap">'+num(v.views)+' · '+(v.vpd||0)+'/day</div></div>';}).join("")+'</div>';
    }
    // Public videos with not even one view (from the whole tree: longs + shorts).
    var all=[]; (ST.video_tree||[]).forEach(function(l){ all.push(l); (l.shorts||[]).forEach(function(s){all.push(s);}); }); (ST.video_tree_ungrouped||[]).forEach(function(s){all.push(s);});
    var pubN=all.filter(function(v){return v.privacy==="public";}).length;
    var zero=all.filter(function(v){return v.privacy==="public"&&(v.views||0)===0;}).length;
    if(pubN) h+='<div class="card muted" style="font-size:12px">👁️ Not even one view: <b>'+zero+'</b> of '+pubN+' publics.'+(zero?' Review title/thumbnail/time of those.':'')+'</div>';
    if(bh&&bh.hours&&bh.hours.length) h+='<div class="card muted" style="font-size:12px">🕐 <b>Best hours (from your data):</b> '+bh.hours.map(function(x){return x+':00';}).join(", ")+' ET · scheduling there. (Based on '+bh.based_on+' videos.)</div>';
    return h;
  }
  function auto2VideosHtml(withActions){
    var list=(ST.auto2&&ST.auto2.list)||[];
    if(!list.length) return '<h2>Videos de Oddly Loop</h2><div class="card muted" style="font-size:12px">No videos yet. Produce a compilation above 👆</div>';
    // The DONE ones (public or scheduled) stay HIDDEN; we only show what's left to REVIEW.
    // "scheduled" = has publish_at (past or future): already scheduled, not pending review even if its time passed.
    list=list.filter(function(v){ var pv=v.privacy==="public"; var loc=localSched[v.video_id]; return !pv && !v.publish_at && loc!=="schedule" && loc!=="public" && !v.pending_sched; });
    if(!list.length) return '<h2>Videos de Oddly Loop</h2><div class="card muted" style="font-size:12px">✅ All caught up. The public and scheduled ones are done (you see them in 📅 Agenda). What the brain produces appears here while it schedules itself.</div>';
    return '<h2>⏳ En marcha ('+list.length+')</h2>'+list.map(function(v){
      var pv=v.privacy==="public";
      var loc=localSched[v.video_id]||""; // optimistic marker for this session
      var schedAt=v.publish_at||""; var future=schedAt&&(new Date(schedAt)>new Date());
      // Video status: published / scheduled / publishing / in review.
      var estado, act='';
      if(pv){ estado='<span class="tag pub">public</span>'; }
      else if(loc==="public"){ estado='<span class="tag priv">🌍 publicando…</span>'; }
      else if(loc==="schedule"||future){
        estado='<span class="tag priv">📅 scheduled'+(future?' · '+esc(fmtSlot(schedAt)):' (best hour)')+'</span>';
        // Already scheduled, but ALWAYS with actions: reschedule (to another free slot) or publish now.
        if(withActions&&v.video_id) act='<div style="margin-top:8px"><button class="btn mini ghost" onclick="oddlyPublish(\\''+v.video_id+'\\',\\'schedule\\')">🔁 Reschedule</button> <button class="btn mini ghost" onclick="oddlyPublish(\\''+v.video_id+'\\',\\'public\\')">🌍 Publish now</button></div>';
      }
      else { estado='<span class="tag priv">🔎 in review</span>';
        if(withActions&&v.video_id) act='<div style="margin-top:8px"><button class="btn mini" onclick="oddlyPublish(\\''+v.video_id+'\\',\\'schedule\\')">📅 Schedule (best hour)</button> <button class="btn mini ghost" onclick="oddlyPublish(\\''+v.video_id+'\\',\\'public\\')">🌍 Publish now</button></div>';
      }
      var tline=(v.manual?'✋ <b>Subido a mano</b>'+(/#short/i.test(v.title||'')?' · 📱 Short':''):((v.niche_label||/#short/i.test(v.title||''))?(/#short/i.test(v.title||'')?'📱 <b>Short</b>':'🎬 <b>'+esc(v.niche_label)+'</b>'):''));
      var titleTxt=(v.title||"").slice(0,60);
      return '<div class="card vcard">'
        +'<div class="vthumb">'+(v.video_id?'<img loading="lazy" src="https://i.ytimg.com/vi/'+v.video_id+'/mqdefault.jpg" alt="">':'')+'</div>'
        +'<div class="vmeta">'
        +'<div class="vtitle">'+(v.video_id?'<a href="https://youtu.be/'+v.video_id+'" target="_blank">'+esc(titleTxt)+'</a>':esc(titleTxt))+'</div>'
        +(tline?'<div class="vsub">'+tline+'</div>':'')
        +'<div class="vstatus">'+estado+' <span class="muted num">· '+num(v.views||0)+' vistas</span></div>'
        +act
        +'</div></div>';
    }).join("");
  }
  function auto2ProduceCard(){
    // ALL categories EQUALLY: each one with its Short and its Video (natural variant of the niche).
    var niches=[["satisfying","Satisfying / ASMR","puro"],["narrativas","Narratives","voiced"],["ciencia_humor","Science + humor","voiced"],["naturaleza_relax","Nature / relax","pure"]];
    var h='<h2>🏭 Produce</h2><div class="muted" style="font-size:12px;margin:0 2px 8px">All 4 categories, equally. Stays PRIVATE to review.</div>';
    h+=niches.map(function(n){
      return '<div class="card"><div style="font-weight:700;font-size:13px;margin-bottom:6px">🎬 '+esc(n[1])+' <span class="muted" style="font-weight:400;font-size:11px">('+(n[2]==="puro"?"no voice":"with voice")+')</span></div>'
        +'<div class="chips">'
        +'<span class="chip" onclick="produceOddly(\\''+n[0]+'\\',\\'short\\',\\''+n[2]+'\\')">📱 Short</span>'
        +'<span class="chip ghost" onclick="produceOddly(\\''+n[0]+'\\',\\'video\\',\\''+n[2]+'\\')">🎬 Video largo</span>'
        +'</div></div>';
    }).join("");
    h+='<div class="card"><div style="font-weight:700;font-size:13px;margin-bottom:2px">😹 Funny clips (fails · real audio)</div>'
      +'<div class="muted" style="font-size:12px;margin-bottom:8px">Take a LEGAL funny video (Archive.org CC) and turn it into a Short with its original audio. Stays PRIVATE to review below.</div>'
      +'<div class="chips">'
      +["funny fails","funny animals","epic fail","bloopers","skate fails","funny cats"].map(function(t){return '<span class="chip" onclick="dispatchTopic(\\'clip_archive_cc.yml\\',\\''+t+'\\',\\'Funny clip: '+t+'\\')">😹 '+t+'</span>';}).join("")
      +'</div></div>';
    h+='<div class="card"><div style="font-weight:700;font-size:13px;margin-bottom:2px">🎧 Sound library</div>'
      +'<div class="muted" style="font-size:12px;margin-bottom:8px">The best CC0 sounds curated by category (beds + accents / stingers), in the cloud. Needs the Freesound API key.</div>'
      +'<button class="btn ghost" onclick="dispatch(\\'build_asmr_library.yml\\',\\'Build / refresh sound library\\')">🎧 Build / refresh library</button></div>';
    return h;
  }
  function auto2RefreshBtn(){
    var a=ST.auto2;
    return '<button class="btn ghost" onclick="dispatch(\\'report_auto2.yml\\',\\'Refresh Oddly Loop\\')">🔄 Refresh channel</button>'
      +(a&&a.at?'<div class="muted" style="font-size:10px;text-align:center">Updated '+esc(String(a.at).slice(0,16).replace("T"," "))+'</div>':'');
  }
  // Auto channel agenda: next to publish (scheduled), pending scheduling review, and auto health.
  function bilibiliCardHtml(){
    var b=ST.bilibili; if(!b) return '';
    var pend=(b.pending||[]), log=(b.log||[]);
    var h='<div class="card" style="border:1px solid #fb7299">'
      +'<div style="display:flex;justify-content:space-between;align-items:center">'
        +'<div style="font-weight:800;font-size:14px">🅱️ Bilibili · '+esc(b.channel||"Oddly")+'</div>'
        +'<a href="https://member.bilibili.com/platform/upload/manuscript/" target="_blank" style="font-size:11px;color:#fb7299;text-decoration:none">open ›</a>'
      +'</div>'
      +'<div class="muted" style="font-size:12px;margin:4px 0 8px">Auto repost (noon). <b>'+num(b.posted_total||0)+'</b> posted · <b>'+pend.length+'</b> in queue.</div>';
    if(pend.length){ h+='<div style="font-size:12px;margin-bottom:2px">🕒 <b>In queue:</b></div>'
      +pend.slice(0,4).map(function(v){ return '<div style="font-size:12px;border-top:1px solid rgba(255,255,255,.06);padding:4px 0">• '+esc((v.title||'').slice(0,44))+'</div>'; }).join(''); }
    if(log.length){ h+='<div style="font-size:12px;margin:8px 0 2px">📜 <b>Last reposted:</b></div>'
      +log.slice(0,5).map(function(v){ return '<div style="font-size:12px;border-top:1px solid rgba(255,255,255,.06);padding:4px 0">'+(v.ok?'✅':'⚠️')+' '+esc((v.title||'').slice(0,42))+'</div>'; }).join(''); }
    if(!pend.length && !log.length) h+='<div class="muted" style="font-size:12px">No reposts yet. When a Short is produced, it reposts itself at noon.</div>';
    return h+'</div>';
  }
  function auto2AgendaHtml(){
    var list=(ST.auto2&&ST.auto2.list)||[];
    var now=new Date();
    // "scheduling" = already scheduled (future publish_at), or session optimistic marker, or durable server marker (pending_sched).
    var isFuture=function(v){ return (v.publish_at&&(new Date(v.publish_at)>now))||localSched[v.video_id]==="schedule"||!!v.pending_sched; };
    var prog=list.filter(isFuture).sort(function(a,b){ return (a.publish_at||"9")<(b.publish_at||"9")?-1:1; });
    var pendingReview=list.filter(function(v){ return v.privacy!=="public" && !isFuture(v) && localSched[v.video_id]!=="public"; });
    var pubCount=list.filter(function(v){ return v.privacy==="public"; }).length;
    // Day-by-day calendar (like The Data Lens): what is scheduled each day, with its time (your zone).
    function dayKey(s){var d=new Date(s);return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);}
    function fmtTime(s){return new Date(s).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});}
    function dayLabel(k){var t=dayKey(new Date().toISOString()),m=dayKey(new Date(Date.now()+864e5).toISOString());var d=new Date(k+'T12:00:00');var p=d.toLocaleDateString([],{weekday:'short',day:'numeric',month:'short'});return k===t?'Today · '+p:(k===m?'Tomorrow · '+p:p);}
    var byDay={};
    prog.forEach(function(v){ var k=v.publish_at?dayKey(v.publish_at):'—'; (byDay[k]=byDay[k]||[]).push(v); });
    var days=Object.keys(byDay).sort();
    var h=queueHorizonHtml(prog)
      +'<h2>📅 Oddly Loop calendar</h2>'
      +'<div class="card muted" style="font-size:12px">What is <b>scheduled each day</b> (your time). The private ones pending review appear further below.<br><span style="color:#c084fc;font-weight:700">🟣 purple = your manual clips</span> · blue = auto.</div>';
    if(days.length){
      h+=days.map(function(k){
        var items=byDay[k].sort(function(a,b){ return (a.publish_at||'')<(b.publish_at||'')?-1:1; });
        var rows=items.map(function(v){
          var isShort=/#short/i.test(v.title||'');
          var isProg=!v.publish_at&&(v.pending_sched||localSched[v.video_id]==="schedule"); // in progress, no confirmed time yet
          var t=v.publish_at?fmtTime(v.publish_at):(isProg?'Scheduling…':'best hour');
          var man=v.manual; var col=man?'#c084fc':'var(--acc)';
          return '<div style="padding:6px 0;border-top:1px solid rgba(255,255,255,.06)'+(man?';border-left:3px solid #c084fc;padding-left:6px':'')+'">'
            +'<div style="display:flex;justify-content:space-between;gap:8px">'
              +'<div style="font-size:12px">'+(man?'🟣':(isShort?'📱':'🎬'))+' '+(v.video_id?'<a href="https://youtu.be/'+v.video_id+'" target="_blank">'+esc((v.title||'').slice(0,30))+'</a>':esc((v.title||'').slice(0,30)))+(man?' <span style="color:#c084fc;font-size:10px;font-weight:700">yours</span>':'')+(v.niche_label?' <span class="muted" style="font-size:10px">('+esc(v.niche_label)+')</span>':'')+'</div>'
              +'<div style="font-size:11px;color:'+col+';white-space:nowrap">🕒 '+esc(t)+'</div>'
            +'</div>'
            +(v.video_id?'<div style="margin-top:4px"><button class="btn mini ghost" style="padding:2px 8px;font-size:10px" onclick="oddlyManual(\\''+v.video_id+'\\')">'+(man?'⚪ remove «mine»':'🟣 mark as mine')+'</button></div>':'')
          +'</div>';
        }).join('');
        return '<div class="card" style="padding:10px 12px"><div style="display:flex;justify-content:space-between;font-weight:700;font-size:13px;text-transform:capitalize"><span>'+esc(dayLabel(k))+'</span><span style="color:var(--cy)">'+items.length+'</span></div>'+rows+'</div>';
      }).join('');
    } else {
      h+='<div class="card muted" style="font-size:12px">Nothing scheduled yet. The brain produces and schedules on its own; each video appears here on its day.</div>';
    }
    // Pending review (to schedule)
    if(enRev.length){
      h+='<div class="card" style="border:1px solid var(--cy)"><div style="font-weight:800;font-size:14px;margin-bottom:4px">⏳ In progress — scheduling ('+enRev.length+')</div>'
        +'<div class="muted" style="font-size:12px;margin-bottom:8px">Private, waiting for you to review and set their time.</div>'
        +enRev.slice(0,6).map(function(v){ return '<div style="font-size:12px;border-top:1px solid rgba(255,255,255,.06);padding:5px 0">• '+esc((v.title||"").slice(0,40))+(v.niche_label?' <span class="muted">('+esc(v.niche_label)+')</span>':'')+'</div>'; }).join("")
        +'<button class="btn" style="margin-top:8px" onclick="tab(\\'producir\\')">Go to schedule</button></div>';
    }
    // Daily cadence by category (cron)
    h+='<div class="card"><div style="font-weight:800;font-size:14px;margin-bottom:4px">⚙️ Daily cadence (automatic)</div>'
      +'<div class="muted" style="font-size:12px;margin-bottom:8px">🚀 <b>Shorts Blitz:</b> 2 Shorts per category (8/day) + 1 long/day, each at its best free slot (cap 2/hour). Fast path to monetize (10M Shorts views/90d).<br>🎬 Satisfying/ASMR · 🎬 Narratives · 🎬 Science+humor · 🎬 Nature. <br>Adjustable in cadence.json. Published so far today: '+pubCount+'.</div>'
      +'<button class="btn ghost" onclick="dispatch(\\'daily_oddly.yml\\',\\'Launch today\\'s cadence\\')">▶️ Launch today\\'s batch now</button></div>';
    return h+bestTimesHtml();
  }
  function nicheRadarHtml(){
    var nr=ST.niche_radar;
    var h='<h2>📡 Niche radar</h2>';
    if(!nr) return h+'<div class="card muted" style="font-size:12px">Not configured yet. It activates with the auto channel.</div>';
    h+='<div class="card"><div style="font-size:13px;font-weight:600;margin-bottom:6px">'+esc(nr.recommendation||"")+'</div>';
    var rk=nr.ranking||[];
    if(rk.length){
      h+=rk.map(function(r){return '<div style="display:flex;justify-content:space-between;gap:8px;border-top:1px solid var(--line);padding:5px 0"><div style="font-size:12px"><b>#'+r.rank+'</b> '+esc(r.label)+'</div><div class="muted" style="font-size:11px;white-space:nowrap">'+num(r.avg_views)+'/video · '+r.videos+' vid</div></div>';}).join("");
    } else {
      h+='<div class="muted" style="font-size:11px;margin-bottom:2px">Test portfolio (candidates):</div>';
      h+=(nr.portfolio||[]).map(function(p){return '<div style="border-top:1px solid var(--line);padding:5px 0"><div style="font-size:12px">🎯 '+esc(p.label)+'</div>'+(p.note?'<div class="muted" style="font-size:11px">'+esc(p.note)+'</div>':'')+'</div>';}).join("");
    }
    h+=(nr.updated_at?'<div class="muted" style="font-size:10px;margin-top:6px">Updated: '+esc(String(nr.updated_at).slice(0,16).replace("T"," "))+'</div>':'')
      +'<button class="btn ghost" style="margin-top:8px" onclick="dispatch(\\'niche_radar.yml\\',\\'Niche radar\\')">🔄 Refresh radar</button></div>';
    return h;
  }
  function nextActionHtml(){
    var p=ST.production||{}, sst=ST.shorts_status||{}, prob=(ST.problems||[]).length, active=ST.active&&ST.active.length;
    function card(t,d,btn,act){ return '<div class="card" style="border:1px solid var(--cy)"><div style="font-weight:800;font-size:15px">'+t+'</div><div class="muted" style="font-size:13px;margin:4px 0 8px">'+esc(d)+'</div><button class="btn" onclick="'+act+'">'+btn+'</button></div>'; }
    if(p.render_pending) return card("🎬 Video ready to review","A rendered video is waiting for your approval.","Review it","tab(\\'producir\\')");
    if(p.seo && !p.approved && !p.done) return card("📦 SEO to approve","The video is uploaded; approve the SEO to schedule it at the best time.","Go approve","tab(\\'producir\\')");
    if(p.approved && !p.done) return card("📅 Needs scheduling","Approved; only needs a time set.","Schedule","tab(\\'producir\\')");
    if(sst.pending) return card("✂️ Shorts to approve",sst.pending+" suggested short(s) are waiting for your OK.","View shorts","tab(\\'producir\\')");
    if(prob) return card("⚠️ "+prob+" problem(s)","Something failed. Review and retry.","Go to More","tab(\\'mas\\')");
    if(active) return "";
    var next=(ST.upcoming||[])[0];
    if(next) return card("▶️ Produce the next one","#"+(next.n||"")+" · "+(next.topic||""),"Produce","tab(\\'producir\\')");
    return '<div class="card muted">✅ All caught up. Nothing needs your attention right now.</div>';
  }
  function goalHtml(g){
    if(!g||!g.reqs) return "";
    var S={done:["var(--gr)","🎉 Goal achieved!"],ontrack:["var(--gr)","🟢 On track"],measuring:["var(--cy)","📈 Measuring the pace…"],behind:["var(--am)","🟡 Falling behind"]}[g.status]||["var(--cy)",""];
    function fN(n){n=+n||0;if(n>=1e6)return (n/1e6).toFixed(n>=1e7?0:1)+"M";if(n>=1e3)return (n/1e3).toFixed(n>=1e5?0:1)+"k";return String(Math.round(n));}
    function fP(n){if(n==null)return "—";n=+n||0;if(n>=1e3)return fN(n);if(n>=10)return String(Math.round(n));return String(Math.round(n*10)/10);}
    var rows=g.reqs.map(function(r){
      var bc=(r.done||r.on_track===true)?"var(--gr)":(r.on_track===false?"var(--am)":"var(--cy)");
      var pace=r.done?'✅ completed'
        :(r.on_track===null?'need '+fP(r.per_day_needed)+'/day (still measuring the pace)'
          :(r.on_track?'🟢 going '+fP(r.per_day_actual)+'/day · need '+fP(r.per_day_needed)
            :'🟡 going '+fP(r.per_day_actual)+'/day · need '+fP(r.per_day_needed)+(r.proj_date?' · at this pace you hit it '+r.proj_date:'')));
      return '<div style="margin-top:8px"><div style="display:flex;justify-content:space-between;font-size:12px"><span>'+esc(r.label)+'</span><span class="muted">'+fN(r.cur)+' / '+fN(r.target)+'</span></div>'
        +'<div class="bar"><i style="width:'+r.pct+'%;background:'+bc+'"></i></div>'
        +'<div class="muted" style="font-size:11px;margin-top:2px">'+pace+'</div></div>';
    }).join("");
    return '<h2>🎯 Monetization goal</h2><div class="card hero">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px"><div class="hero-h" style="color:'+S[0]+'">'+S[1]+'</div><div class="muted" style="font-size:12px"><b>'+g.days_left+'</b> days left · '+esc(g.deadline)+'</div></div>'
      +rows
      +'<div class="muted" style="font-size:10px;margin-top:8px">'+(g.path==="shorts"?"Shorts route: 1,000 subs + 10M views (90 days).":"Standard route: 1,000 subs + 4,000 hours (12 months).")+' Pace is measured with the last 7 days.</div></div>';
  }
  function promiseMiniHtml(){
    var a=ST.analysis; if(!a) return "";
    var col=a.promise>=66?"var(--gr)":a.promise>=40?"var(--cy)":"var(--am)";
    return '<div class="card" onclick="tab(\\'analitica\\')" style="cursor:pointer;display:flex;align-items:center;gap:14px">'
      +'<div style="text-align:center"><div class="gauge" style="color:'+col+'">'+a.promise+'</div><div class="muted" style="font-size:10px">/100</div></div>'
      +'<div style="flex:1"><div style="font-weight:700">'+esc(a.label||"")+'</div><div class="muted" style="font-size:12px">How promising the channel looks. Tap for the full analysis.</div></div>'
      +'<div style="color:var(--hint);font-size:20px">›</div></div>';
  }
  function healthLineHtml(){
    var t=ST.tools_health||{}, prob=(ST.problems||[]).length, pieces=[];
    if(t.tools&&t.tools.length) pieces.push(t.down>0?('🧰 '+t.ok+'/'+t.total+' tools'):'🧰 tools OK');
    pieces.push(prob?('⚠️ '+prob+' issue(s)'):'✅ no issues');
    var pr=(ST.analysis&&ST.analysis.problems)||[];
    if(pr.length) pieces.push('🚩 '+pr.length+' claim(s)');
    return '<div class="card muted" style="font-size:12px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px"><span>'+pieces.join(' · ')+'</span><span onclick="tab(\\'mas\\')" style="color:var(--cy);cursor:pointer">details ›</span></div>';
  }
  function monetizationHtml(){
    var mon=ST.monetization||{};
    return '<h2>Monetization (YPP)</h2><div class="card">'
      +'<div class="muted">Subscribers '+(mon.subs||0)+' / 1000</div><div class="bar"><i style="width:'+pct(mon.subs,1000)+'%"></i></div>'
      +'<div class="muted" style="margin-top:10px">Hours '+(mon.watch_hours!=null?mon.watch_hours:"—")+' / 4000</div><div class="bar"><i style="width:'+pct(mon.watch_hours,4000)+'%"></i></div>'
      +'<div style="margin-top:12px" class="'+(mon.elegible?"":"muted")+'">'+(mon.elegible?"✅ Eligible to monetize":"❌ Not eligible yet")+'</div>'
      +'<div class="muted" style="font-size:10px;margin-top:6px">⏱️ Watch hours/minutes come from YouTube Analytics, which is ~2-3 days behind (normal, not an error). <b>Views</b> are nearly up to date.</div></div>';
  }
  function analysisHtml(){
    var a=ST.analysis; if(!a) return "";
    var col=a.promise>=66?"var(--gr)":a.promise>=40?"var(--cy)":"var(--am)";
    var f=a.factors||{};
    function barRow(lbl,val,max){ var pp=Math.round((val/(max||1))*100); return '<div style="display:flex;align-items:center;gap:8px;margin:4px 0"><div class="muted" style="font-size:11px;width:96px">'+lbl+'</div><div class="bar" style="flex:1"><i style="width:'+pp+'%"></i></div><div class="muted" style="font-size:11px;width:40px;text-align:right">'+val+'/'+max+'</div></div>'; }
    var h='<h2>🔬 Channel analysis</h2><div class="card">'
      +'<div style="display:flex;align-items:center;gap:14px">'
      +'<div style="text-align:center"><div class="gauge" style="color:'+col+'">'+a.promise+'</div><div class="muted" style="font-size:10px">/100</div></div>'
      +'<div><div style="font-weight:700">'+esc(a.label||"")+'</div><div class="muted" style="font-size:12px">How promising the channel looks: growth, retention, cadence, and monetization progress.</div></div></div>'
      +'<div style="margin-top:10px;border-top:1px solid rgba(255,255,255,.08);padding-top:8px">'
      +barRow("Growth",f.crecimiento||0,35)+barRow("Retention",f.retencion||0,30)+barRow("Cadence",f.cadencia||0,20)+barRow("Monetization",f.ypp||0,15)
      +'</div>'
      +'<div class="muted" style="font-size:11px;margin-top:6px">7d trend: '+((a.trend_pct||0)>=0?"+":"")+(a.trend_pct||0)+'% · retention ~'+(a.retention_pct||0)+'% · '+(a.recent_14d||0)+' videos in 14 days</div>'
      +(a.ai&&a.ai.assessment?'<div style="margin-top:8px;border-top:1px solid rgba(255,255,255,.08);padding-top:8px;font-size:13px;white-space:pre-wrap">'+esc(a.ai.assessment)+'</div>':'')
      +'</div>';
    var pr=a.problems||[];
    h+='<div class="card"'+(pr.length?' style="border:1px solid rgba(248,113,113,.45)"':'')+'>'
      +'<div style="font-weight:700;font-size:13px">'+(pr.length?('🚩 Claims/problems ('+pr.length+')'):'✅ No claims detected')+'</div>';
    if(pr.length) h+=pr.map(function(v){return '<div style="border-top:1px solid rgba(255,255,255,.06);padding:5px 0;font-size:12px">'+(v.video_id?'<a href="https://youtu.be/'+v.video_id+'" target="_blank">'+esc((v.title||"").slice(0,30))+'</a>':esc(v.title||""))+' — <span style="color:#f87171">'+esc(v.reason||"")+'</span></div>';}).join("");
    h+='<div class="muted" style="font-size:10px;margin-top:6px">From the YouTube API (upload rejects/status). Full Content ID claims are only visible in Studio.</div></div>';
    return h;
  }
  // BRAIN 2.0: what the system LEARNED on its own (weekly strategy: what wins, what to do more, what to explore).
  function learnHtml(){
    var s=ST.strategy; if(!s) return "";
    var L=s.learning||{}, ov=L.overall||null, pc=s.per_channel||{};
    if(!ov && !Object.keys(pc).length) return "";
    var CH={oddly:"Oddly Loop",datalens:"The Data Lens"};
    function bar(p){ p=Math.max(0,Math.min(100,Math.round(p||0)));
      var col=p<30?'var(--am)':p<60?'var(--cy)':'var(--gr)';
      return '<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px"><span class="muted">Learning progress</span><span style="font-weight:700">'+p+'% · '+esc((ov&&ov.label)||"")+'</span></div>'
        +'<div style="height:11px;background:rgba(255,255,255,.1);border-radius:6px;overflow:hidden"><div style="height:100%;width:'+p+'%;background:'+col+';transition:width .5s"></div></div>';
    }
    var rows=Object.keys(pc).map(function(k){
      var d=pc[k]||{}, lc=(L.per_channel&&L.per_channel[k])||null;
      return '<div style="border-top:1px solid rgba(255,255,255,.06);padding:6px 0">'
        +'<div style="display:flex;justify-content:space-between"><span style="font-weight:700;font-size:13px">'+esc(CH[k]||k)+'</span>'+(lc?'<span class="muted" style="font-size:11px">'+lc.mature+'/'+lc.target+' · '+lc.score+'%</span>':'')+'</div>'
        +(d.focus?'<div style="font-size:12px">🏆 more of: <b>'+esc(d.focus)+'</b></div>':'')
        +(d.best_hour?'<div class="muted" style="font-size:11px">⏰ best hour: '+esc(d.best_hour)+'</div>':'')
        +(d.explore?'<div class="muted" style="font-size:11px">🧪 try: '+esc(d.explore)+'</div>':'')
        +'</div>';
    }).join("");
    var when=s.at?String(s.at).slice(0,10):"";
    return '<div class="card"><div style="display:flex;justify-content:space-between;align-items:center"><b>🧠 Brain learning</b>'+(when?'<span class="muted" style="font-size:11px">'+esc(when)+'</span>':'')+'</div>'
      +(ov?'<div style="margin:8px 0 4px">'+bar(ov.score)+'</div><div class="muted" style="font-size:10px;margin-bottom:4px">'+ov.mature+' mature videos · '+ov.maturity_pct+'% data · '+ov.signal_pct+'% signal</div>':'')
      +(s.summary?'<div class="muted" style="font-size:12px;margin:4px 0">'+esc(s.summary)+'</div>':'')
      +(s.web_trends&&Object.keys(s.web_trends).length?'<div style="margin:6px 0"><div class="muted" style="font-size:11px;font-weight:700">🌐 Web trends (looked up by the brain):</div>'+Object.keys(s.web_trends).map(function(k){return '<div class="muted" style="font-size:11px;margin-top:2px"><b>'+esc(CH[k]||k)+':</b> '+esc(String(s.web_trends[k]).slice(0,220))+'…</div>';}).join('')+'</div>':'')
      +rows
      +'<div class="muted" style="font-size:10px;margin-top:6px">Upload more mature videos and a clear winner. It learns every Monday.</div></div>';
  }

  // MAIN WINDOW: both channels at a glance (brain verdict + KPIs + enter).
  function resumenHtml(){
    var b=ST.brain||{}, od=b.oddly||{}, dl=b.data_lens||{}, a2=ST.auto2||{}, pa=ST.pending_approve||{};
    function kpi(n,l){return '<div class="kpi"><div class="n">'+num(n||0)+'</div><div class="l">'+l+'</div></div>';}
    function chCard(title,handle,verdict,msg,kpis,goCh,pend){
      var pl = pend>0
        ? '<div class="card" style="background:rgba(34,211,238,.14);border:1px solid var(--cy);padding:8px;margin:2px 0 8px"><b style="color:var(--cy)">⏳ '+pend+' video(s) en marcha</b></div>'
        : '<div class="muted" style="font-size:11px;margin:2px 0 8px">✓ all automatic</div>';
      return '<div class="card"'+(pend>0?' style="border:1px solid var(--cy)"':'')+'>'
        +'<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">'
        +'<div><div style="font-weight:800;font-size:15px">'+title+'</div><div class="muted" style="font-size:11px">'+handle+'</div></div>'
        +'<div style="font-size:13px;font-weight:700;white-space:nowrap">'+esc(verdict||"—")+'</div></div>'
        +'<div class="row" style="margin:8px 0">'+kpis+'</div>'
        +pl
        +(msg?'<div class="muted" style="font-size:12px;margin-bottom:8px">'+esc(msg)+'</div>':'')
        +'<button class="btn'+(pend>0?'':' ghost')+'" onclick="setChannel(\\''+goCh+'\\')">'+'Entrar a '+title+' →'+'</button></div>';
    }
    var kO=kpi(a2.subs||od.subs,"Subs")+kpi(a2.total_views||od.views,"Views")+kpi(a2.videos||od.videos,"Videos");
    var dlSubs=(ST.channel_stats&&ST.channel_stats.subs)||dl.subs||0;
    var dlViews=(ST.totals&&ST.totals.views)||(ST.channel_stats&&ST.channel_stats.total_views)||0;
    var dlVids=dl.videos||(ST.totals&&ST.totals.videos)||0;
    var kD=kpi(dlSubs,"Subs")+kpi(dlViews,"Views")+kpi(dlVids,"Videos");
    var totPend=(pa.total!=null?pa.total:((pa.oddly||0)+(pa.data_lens||0)));
    var topBanner=totPend>0?'<div class="card" style="background:rgba(34,211,238,.14);border:1px solid var(--cy)"><div style="font-weight:800;font-size:15px;color:var(--cy)">⏳ '+totPend+' video(s) in progress</div><div class="muted" style="font-size:12px">They schedule and publish themselves; you do not have to do anything.</div></div>':'';
    var when=b.at?'<div class="muted" style="font-size:11px;margin:-2px 2px 8px">🧠 Brain diagnosis: '+esc(String(b.at).slice(5,16).replace("T"," "))+'</div>':'<div class="muted" style="font-size:11px;margin:-2px 2px 8px">🧠 The brain runs every day at 8am and warns you by chat.</div>';
    var alert=dl.restructure?'<div class="card" style="border:1px solid var(--am)"><div style="font-weight:800;color:var(--am)">⚠️ The Data Lens: restructure</div><div class="muted" style="font-size:12px;margin-top:2px">Tried the addresses and none took off. Tell Claude: «restructure Data Lens».</div></div>':'';
    return '<h2>🧠 Summary — both channels</h2>'+when+topBanner+alert
      +chCard("Oddly Loop","@oddlyloophq",od.verdict,od.msg,kO,"auto2",pa.oddly||0)
      +goalHtml(a2.monet_goal)
      +chCard("The Data Lens","@TheDataLensHQ",dl.verdict,dl.msg,kD,"data-lens",pa.data_lens||0)
      +goalHtml(ST.monet_goal)
      +learnHtml();
  }
  // ===== WEEKLY SUMMARY (charts) ===== (📈 Analytics). Reads ST.weekly (weekly_stats.json).
  function fmtWk(iso){ var p=(iso||"").split("-"); return p.length===3?(p[2]+"/"+p[1]):iso; }
  // Mini SVG bar chart. rows=[{label,value,partial}]. Each bar carries its VALUE on top
  // and its DATE below, in readable size; if they don't fit, the container scrolls horizontally.
  function svgBars(rows, color){
    // PRO bars (dataviz method): <=24px, rounding only top/square base, hairline grid with
    // clean ticks, SELECTIVE labels (max + current; the rest via tooltip), emphasis on the
    // last full week (full accent) and earlier ones faded. Text in tokens, never the series color.
    var n=rows.length; if(!n) return "";
    var slot=44, W=Math.max(300, n*slot), H=164, padB=24, padT=18, padL=36, padR=6;
    var max=Math.max.apply(null, rows.map(function(r){return r.value||0;}).concat([1]));
    var bw=(W-padL-padR)/n, barW=Math.min(24, Math.max(2, bw*0.62)), plotH=H-padT-padB;
    function nice(v){ var p=Math.pow(10,Math.floor(Math.log(v||1)/Math.LN10)); var m=v/p; var r=m<=1?1:m<=2?2:m<=2.5?2.5:m<=5?5:10; return r*p; }
    var top=nice(max); if(top<max) top=max;
    var yOf=function(v){ return H-padB-Math.round((v/top)*plotH); };
    var grid=[top/2, top].map(function(t){ var yy=yOf(t);
      return '<line x1="'+padL+'" y1="'+yy+'" x2="'+(W-padR)+'" y2="'+yy+'" stroke="var(--line,rgba(130,140,158,.2))" stroke-width="1"/>'
        +'<text x="'+(padL-6)+'" y="'+(yy+4)+'" font-size="10" fill="var(--hint,#8a8a8a)" text-anchor="end">'+num(t)+'</text>'; }).join("");
    var base='<line x1="'+padL+'" y1="'+(H-padB)+'" x2="'+(W-padR)+'" y2="'+(H-padB)+'" stroke="var(--line,rgba(130,140,158,.2))" stroke-width="1"/>';
    var maxIdx=0; rows.forEach(function(r,i){ if((r.value||0)>(rows[maxIdx].value||0)) maxIdx=i; });
    var lastIdx=n-1, emphIdx=-1; for(var k=n-1;k>=0;k--){ if(!rows[k].partial){ emphIdx=k; break; } }
    var bars=rows.map(function(r,i){
      var val=r.value||0, yy=yOf(val), h=Math.max(2,(H-padB)-yy); yy=(H-padB)-h;
      var x=padL+i*bw+(bw-barW)/2, cx=x+barW/2, rr=Math.min(4, barW/2);
      var d='M'+x.toFixed(1)+' '+(H-padB)+' V'+(yy+rr).toFixed(1)+' Q'+x.toFixed(1)+' '+yy.toFixed(1)+' '+(x+rr).toFixed(1)+' '+yy.toFixed(1)+' H'+(x+barW-rr).toFixed(1)+' Q'+(x+barW).toFixed(1)+' '+yy.toFixed(1)+' '+(x+barW).toFixed(1)+' '+(yy+rr).toFixed(1)+' V'+(H-padB)+' Z';
      var op=r.partial?0.55:(i===emphIdx?1:0.5);
      var lbl=(val>0&&(i===lastIdx||i===maxIdx||i===emphIdx))?'<text x="'+cx.toFixed(1)+'" y="'+(yy-5).toFixed(1)+'" font-size="11" fill="var(--fg,#e6e8ee)" text-anchor="middle" font-weight="700">'+num(val)+'</text>':"";
      var dl='<text x="'+cx.toFixed(1)+'" y="'+(H-8)+'" font-size="10" fill="var(--hint,#8a8a8a)" text-anchor="middle">'+esc(r.label)+'</text>'
        +(r.partial?'<text x="'+cx.toFixed(1)+'" y="'+(H-1)+'" font-size="7" fill="var(--am,#f59e0b)" text-anchor="middle">parcial</text>':"");
      return '<path d="'+d+'" fill="'+(r.partial?"url(#hb)":color)+'" opacity="'+op+'"><title>'+esc(r.label)+': '+num(val)+(r.partial?" (parcial)":"")+'</title></path>'+lbl+dl;
    }).join("");
    return '<div class="wksc" style="overflow-x:auto;-webkit-overflow-scrolling:touch">'
      +'<svg viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'" style="display:block;max-width:none">'
      +'<defs><pattern id="hb" width="4" height="4" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="0" y2="4" stroke="'+color+'" stroke-width="2"/></pattern></defs>'
      +grid+base+bars+'</svg></div>';
  }
  function weeklyHtml(chKey){
    var W=ST.weekly&&ST.weekly.channels&&ST.weekly.channels[chKey];
    if(!W||!(W.weeks&&W.weeks.length)) return '<h2>📈 Weekly summary</h2><div class="card muted" style="font-size:12px">Still generating the history (it fills on its own each day). Come back tomorrow.</div>';
    var weeks=W.weeks; // FROM DAY 1
    var d=new Date(); var b=(d.getUTCDay()+6)%7; d.setUTCDate(d.getUTCDate()-b); var curW=d.toISOString().slice(0,10);
    function isPar(w){ return w.week===curW||(w.days||7)<7; }
    // Series: views/week, likes/week, TOTAL subscribers accumulated (sum of net subs since day 1)
    var cum=0;
    var viewRows=weeks.map(function(w){return {label:fmtWk(w.week),value:w.views||0,partial:isPar(w)};});
    var likeRows=weeks.map(function(w){return {label:fmtWk(w.week),value:w.likes||0,partial:isPar(w)};});
    var subRows=weeks.map(function(w){cum+=(w.subs_net||0);return {label:fmtWk(w.week),value:cum,partial:isPar(w)};});
    function delta(rows){ if(rows.length<2) return ""; var a=rows[rows.length-2].value, c=rows[rows.length-1].value, df=c-a, pc=a?Math.round(df/a*100):0, col=df>=0?"#22c55e":"var(--am,#f59e0b)"; return ' <span style="color:'+col+';font-size:11px;white-space:nowrap">'+(df>=0?"▲":"▼")+(pc>=0?"+":"")+pc+'%</span>'; }
    function chart(title, rows, color){
      return '<div class="card" style="padding:10px 8px">'
        +'<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px"><div style="font-size:13px;font-weight:700">'+title+'</div><div class="muted" style="font-size:11px;white-space:nowrap">last: '+num(rows[rows.length-1].value)+delta(rows)+'</div></div>'
        +svgBars(rows,color)+'</div>';
    }
    return '<h2>📈 Weekly summary (from day 1)</h2>'
      +'<div class="muted" style="font-size:12px;margin:0 2px 8px">'+esc(W.name||chKey)+' · Monday to Sunday · '+weeks.length+' weeks (views per week, not cumulative)</div>'
      +chart("👁 Views per week", viewRows, "var(--acc)")
      +(W.has_engagement?chart("❤ Likes per week", likeRows, "#f43f5e"):"")
      +chart("👥 Subscribers (total)", subRows, "#22c55e")
      +'<div class="muted" style="font-size:10px;margin:2px 2px 10px">⏳ The last bar (striped) is partial: YouTube Analytics takes 2-3 days. ISO weeks (Monday to Sunday). Tap a bar to see its value.</div>';
  }
  function render(){
    var ch = ST.channel||{}, cs = ST.channel_stats||{}, mon = ST.monetization||{};
    var up = ST.upcoming||[];
    var liveTag = (activeFor(curChannel).length) ? " · 🟢 en vivo" : "";
    el("chTitle").textContent = curChannel==="auto2" ? "Auto #2" : "The Data Lens";
    // Data Lens is automatic: the "Produce" tab is called "Review" (you review/publish what comes out on its own).
    var _np=el("navProducir"); if(_np) _np.innerHTML = '<span class="ic">🎬</span>Videos';
    el("hd").textContent = (curChannel==="auto2"?"auto channel":"@TheDataLensHQ")+" · updated "+ (ST.updated_at? String(ST.updated_at).slice(5,16).replace("T"," "):"—") + liveTag;      setHelp(curTab);
    // "I'll notify when done" banner (G-V1): visible on ALL tabs while there's a watched process.
    var wb=watchBannerHtml();
    el("globalStatus").innerHTML = wb + ((activeFor("data-lens").length) ? ('<h2>⚡ In progress now</h2>'+statusHtml("data-lens")) : "");

    // MAIN WINDOW: summary of BOTH channels. From here you enter each one.
    if(curChannel==="home"){
      el("chTitle").textContent="Summary";
      el("hd").textContent="Both channels · upd. "+(ST.updated_at?String(ST.updated_at).slice(5,16).replace("T"," "):"—")+liveTag;
      el("globalStatus").innerHTML=wb;
      el("s-home").innerHTML=resumenHtml();
      var _hint='<div class="card muted" style="font-size:13px">👆 Choose <b>Oddly Loop</b> or <b>The Data Lens</b> above to see this section\'s detail.</div>';
      el("s-produce").innerHTML=_hint; el("s-agenda").innerHTML=_hint; el("s-analytics").innerHTML=_hint; el("s-more").innerHTML=_hint;
      return;
    }

    // BILIBILI (multi-platform distribution) — SEPARATE from the YouTube channels, to not interfere.
    if(curChannel==="bilibili"){
      el("chTitle").textContent="Bilibili";
      el("hd").textContent="Multi-platform distribution · updated "+(ST.updated_at?String(ST.updated_at).slice(5,16).replace("T"," "):"—");
      el("globalStatus").innerHTML=wb;
      var _bcard = bilibiliCardHtml() || '<div class="card muted" style="font-size:13px">No Bilibili data yet. When a Short is produced, it reposts itself at noon and will appear here.</div>';
      el("s-inicio").innerHTML='<h2>🅱️ Bilibili</h2><div class="card muted" style="font-size:12px">Auto repost of Oddly Shorts to Bilibili (channel <b>Oddly_Loop</b>). Independent from YouTube — it runs on its own.</div>'+_bcard;
      var _bh='<div class="card muted" style="font-size:13px">Bilibili reposts itself at noon. The detail is in <b>Home</b>.</div>';
      el("s-produce").innerHTML=_bh; el("s-agenda").innerHTML=_bh; el("s-analytics").innerHTML=_bh;
      el("s-more").innerHTML='<div class="card"><div style="font-weight:700;font-size:13px;margin-bottom:4px">🔑 Bilibili cookie</div><div class="muted" style="font-size:12px">The watchdog checks daily that the session is still alive. If it warns that it <b>expired</b>, pull a new cookie from the browser (SESSDATA, bili_jct, DedeUserID, DedeUserID__ckMd5) and update the <b>BILIBILI_COOKIE</b> secret in GitHub.</div></div>';
      return;
    }

    // AUTOMATIC CHANNEL #2 (Oddly Loop): each flow with its own content.
    if(curChannel==="auto2"){
      var producingA=activeFor("auto2").length>0;
      var statusA=producingA?('<h2>⚡ Producing in Oddly Loop</h2>'+statusHtml("auto2")):'';
      // Alert if there are private videos to review (from this channel).
      // "To review" = private ones that are NOT scheduled (scheduled ones already show in Agenda) -> the
      // counter matches the Produce list (before it said 23 but showed nothing).
      var nowR=new Date();
      var privA=((ST.auto2&&ST.auto2.list)||[]).filter(function(v){ var future=v.publish_at&&(new Date(v.publish_at)>nowR); var loc=localSched[v.video_id]; return v.privacy!=="public" && !future && loc!=="schedule" && loc!=="public" && !v.pending_sched; }).length;
      var pendA=privA?('<div class="card" style="border:1px solid var(--cy)"><div style="font-weight:800;font-size:15px">⏳ '+privA+' video(s) in progress</div><div class="muted" style="font-size:13px;margin:4px 0 8px">From Oddly Loop, private. Review them and publish/schedule in Produce.</div><button class="btn" onclick="tab(\\'producir\\')">Go review</button></div>'):'';
      // HOME: pulse (KPIs + status + pending + produce + radar)
      el("s-inicio").innerHTML = auto2KpisHtml() + goalHtml(ST.auto2 && ST.auto2.monet_goal) + statusA + pendA + auto2TopHtml() + (MONITOR?'':auto2ProduceCard()) + nicheRadarHtml();
      // PRODUCE: their videos WITH actions (publish/schedule) + produce + note
      el("s-producir").innerHTML = statusA + auto2VideosHtml(!MONITOR) + (MONITOR?'':auto2ProduceCard())
        + (MONITOR?'<div class="card muted" style="font-size:12px">🤖 <b>Automatic:</b> the Brain produces, schedules and publishes on its own. Here you only watch the status. Below you can upload your own video if you want.</div>':'')
        + '<div class="card"><div style="font-weight:800;margin-bottom:4px">🎬 My Clips (upload yours)</div>'
        + '<div class="muted" style="font-size:12px;margin-bottom:6px">Upload an AI-generated video: I set title, description and #, schedule it at the best free hour and add it to the <b>My Clips</b> playlist.</div>'      +'<label class="file" for="fClip">🎬 Choose video (max ~100MB)</label><input id="fClip" type="file" accept="video/*" class="hide">'
        + '<input id="clipCap" type="text" placeholder="Optional: what it is about (helps the title)"></div>'
        + '<div class="card muted" style="font-size:12px">Oddly Loop is <b>full-auto</b>: when we turn on the cron, it produces and schedules 3/day on its own. Here you review/publish theirs and fire off manual ones.</div>';
      var _fc=el("fClip"); if(_fc) _fc.onchange=function(e){uploadClip(e.target.files[0]);};
      // AGENDA: next to publish (scheduled) + in review + automatic status + best hours
      el("s-agenda").innerHTML = auto2AgendaHtml();
      // ANALYTICS: KPIs + top 3 + not-views + Radar (without listing every video)
      el("s-analitica").innerHTML = weeklyHtml("oddly") + auto2KpisHtml() + goalHtml(ST.auto2 && ST.auto2.monet_goal) + auto2TopHtml() + nicheRadarHtml();
      // MORE: info + refresh
      el("s-mas").innerHTML = '<h2>⚙️ Automatic channel</h2><div class="card muted" style="font-size:12px">Oddly Loop · @oddlyloophq · legal ASMR/satisfying compilations, automated. Only licensed sources (compliance gateway).</div>'
        + '<div class="card"><div style="font-weight:700;font-size:13px;margin-bottom:2px">🎨 Channel brand</div><div class="muted" style="font-size:12px;margin-bottom:8px">Applies the banner, description and tags via API. I'll send you the avatar by Telegram so you can upload it in Studio (the API doesn't allow it).</div><button class="btn ghost" onclick="dispatch(\\'set_oddly_branding.yml\\',\\'Apply channel brand\\')">🎨 Apply channel brand</button></div>'
        + auto2RefreshBtn();
      el("globalStatus").innerHTML=wb; // preserve the "I'll notify when done" banner (G-V1) also in Oddly Loop
      return;
    }

    // ===== HOME ===== what needs your attention + channel pulse.
    // Prominent card: Shorts/videos PRIVATE to review (private, not scheduled) -> to Agenda.
    var _dlSid={}; (ST.scheduled||[]).forEach(function(s){_dlSid[s.video_id]=1;});
    var _dlPriv=(ST.all_videos||[]).filter(function(v){ if(!v.video_id||v.privacy==="public")return false; var loc=localSched[v.video_id]; if(loc==="schedule"||loc==="public")return false; return !_dlSid[v.video_id]; });
    var _dlPend=_dlPriv.length?('<div class="card" style="border:1px solid var(--cy)"><div style="font-weight:800;font-size:15px">👀 '+_dlPriv.length+' to review</div><div class="muted" style="font-size:13px;margin:4px 0 8px">The Data Lens privates — publish or schedule them.</div><button class="btn" onclick="tab(\\'producir\\')">Go review</button></div>'):';
    el("s-inicio").innerHTML =
      (MONITOR?'':_dlPend)
      +(MONITOR?'':nextActionHtml())
      +'<div class="card"><div class="row">'
      +'<div class="kpi"><div class="n">'+num(cs.subs)+'</div><div class="l">Subs</div></div>'
      +'<div class="kpi"><div class="n">'+num(cs.total_views)+'</div><div class="l">Views</div></div>'
      +'<div class="kpi"><div class="n">'+(ST.long_count||0)+'</div><div class="l">Longs</div></div>'
      +'<div class="kpi"><div class="n">'+(ST.shorts_count||0)+'</div><div class="l">Shorts</div></div>'
      +'</div></div>'
      +goalHtml(ST.monet_goal)
      +promiseMiniHtml()
      +healthLineHtml();

    // ===== PRODUCE ===== production + results + what's happening with each video + Shorts.
    var next = up[0], rest = up.slice(1);
    var producing = (ST.active||[]).some(function(r){return /Producir|guion|Render VIDEO|Voiceover/i.test(r.name||"");});
    var prows = rest.map(function(u){return '<tr><td>#'+(u.n||"")+'</td><td>'+esc(u.topic||"")+'<div class="muted" style="font-size:11px">'+esc(u.why||"")+'</div></td><td style="text-align:right;white-space:nowrap">'+esc(u.target_date||"")+'</td></tr>';}).join("");
    var prop = ST.shorts_proposal||[]; var sst = ST.shorts_status||{};
    var pend=prop.filter(function(s){return s.state==="pending";});
    var appr=prop.filter(function(s){return s.state==="approved";});
    var upl=prop.filter(function(s){return s.state==="uploaded";});
    // Shorts ALREADY SCHEDULED: out of the listing (they show in 📅 Agenda). We only show the missing ones.
    var uplSched=upl.filter(function(s){return s.publish_at && s.privacy!=="public";});
    var uplShow=upl.filter(function(s){return !(s.publish_at && s.privacy!=="public");});
    var skip=prop.filter(function(s){return s.state==="skipped";});
    var shb=""; var vid=sst.latest_video_id;
    if((ST.shorts_pending_count||0)>0){ shb+='<div class="card" style="border:1px solid var(--cy)"><div style="font-weight:700;font-size:13px">🎬 '+ST.shorts_pending_count+' public video(s) without shorts</div><div class="muted" style="font-size:12px;margin-top:2px">Complete them one by one with ＋ Do in 📋 Video control (above).</div></div>'; }
    if(pend.length){
      shb+='<h2>🤖 Suggestions to approve ('+pend.length+')</h2>';
      shb+=pend.map(function(s){
        var moment = (vid && s.start!=null) ? 'https://youtu.be/'+vid+'?t='+s.start : null;
        var mmss = (s.start!=null) ? (Math.floor(s.start/60)+':'+('0'+(s.start%60)).slice(-2)) : '';
        return '<div class="card"><div style="font-weight:700">'+esc(s.title)+(s.dur?' · '+s.dur+'s':'')+'</div>'
          +(mmss?'<div class="muted" style="font-size:11px">⏱️ from the '+mmss+' of the video</div>':'')
          +(s.hook?'<div class="muted" style="font-size:12px;margin:3px 0">🪝 '+esc(s.hook)+'</div>':'')
          +(s.caption?'<div style="font-size:13px;margin:3px 0">'+esc(s.caption)+'</div>':'')
          +((s.hashtags&&s.hashtags.length)?'<div class="muted" style="font-size:11px">'+esc(s.hashtags.join(" "))+'</div>':'')
          +'<div style="margin-top:8px">'
          +(moment?'<a class="btn mini ghost" href="'+moment+'" target="_blank">▶️ Watch the moment</a> ':'')
          +'<button class="btn mini" onclick="shortApprove('+s.n+',1)">✅ Approve</button> '
          +'<button class="btn mini ghost" onclick="shortApprove('+s.n+',0)">❌ Skip</button></div></div>';
      }).join("");
      shb+='<div class="card"><div class="muted" style="font-size:12px;margin-bottom:6px">Not convinced? Leave a comment and the AI redoes them:</div>'
        +'<textarea id="shNotes" placeholder="e.g.: shorter shorts, start with the number, use the minute 3 moment"></textarea>'
        +'<button class="btn ghost" onclick="regenShorts()">🔁 Regenerate suggestions with my comments</button></div>';
    }
    if(appr.length){
      shb+='<h2>✅ Approved ('+appr.length+') — ready to generate</h2><div class="card">'
        +appr.map(function(s){return '<div style="margin:2px 0">• '+esc(s.title)+'</div>';}).join("")
        +'<button class="btn" onclick="dispatch(\\'shorts_final.yml\\',\\'Generate the approved shorts\\')">🎬 Generate the approved ones</button></div>';
    }
    if(uplSched.length) shb+='<div class="muted" style="font-size:12px;margin:6px 2px">📅 '+uplSched.length+' short(s) already scheduled — in the Agenda.</div>';
    if(uplShow.length){
      var parentPub = sst.parent_public;
      shb+='<h2>🎬 Shorts (to publish/schedule)</h2>';
      if(!parentPub){
        shb+='<div class="card" style="border:1px solid rgba(245,158,11,.45)"><div style="font-weight:700;color:var(--am)">⏳ Waiting for the video to be published</div>'
          +'<div class="muted" style="font-size:12px;margin-top:4px">These shorts are from <b>'+esc(sst.parent_title||"a video")+'</b>, which is still private/scheduled. They will be published when the video is public (shorts bring people to the video — without a public video they aren't useful).</div></div>';
      }
      shb+='<div class="card"><table><tr><th>Short</th><th>Status</th><th style="text-align:right">Action</th></tr>'
        +uplShow.map(function(s){var pv=s.privacy==="public";
          var cell;
          if(pv){ cell=num(s.views)+' views'; }
          else if(s.publish_at){ cell='<span style="font-size:10px;color:var(--cy)">🕒 '+esc(fmtSlot(s.publish_at))+'</span>'; }
          else if(parentPub){ cell='<button class="btn mini" onclick="scheduleShort(\\''+s.video_id+'\\')">📅 Schedule</button>'; }
          else { cell='<span class="muted" style="font-size:11px">⏳ after the video</span>'; }
          return '<tr><td>'+(s.video_id?'<a href="https://youtu.be/'+s.video_id+'" target="_blank">'+esc(s.title)+'</a>':esc(s.title))+'</td>'
          +'<td><span class="tag '+(pv?"pub":"priv")+'">'+(s.publish_at&&!pv?"scheduled":esc(s.privacy||"?"))+'</span></td>'
          +'<td style="text-align:right">'+cell+'</td></tr>';
        }).join("")+'</table></div>';
    }
    if(skip.length) shb+='<div class="muted" style="font-size:12px;margin:6px 2px">Saltados: '+skip.length+'.</div>';
    if(shortsTargetVid){
      // Juan tapped ＋Do on to SPECIFIC video -> we generate the Shorts of THAT video.
      shb+='<div class="card" style="border:1px solid var(--cy)"><div style="font-weight:700;font-size:13px;margin-bottom:4px">🎬 Generate shorts from:</div>'
        +'<div style="font-size:13px;margin-bottom:2px">'+esc(vidTitle(shortsTargetVid).slice(0,44))+'</div>'
        +'<div class="muted" style="font-size:12px;margin:4px 0 8px">The AI analyzes THIS video: how many shorts, from what moments and how long, and proposes them for you to approve.</div>'
        +'<button class="btn" onclick="suggestShorts()">🤖 Suggest shorts from this video</button> '
        +'<button class="btn ghost mini" onclick="clearShortsTarget()">Cancel</button></div>';
    } else if(sst.can_suggest){
      shb+='<div class="card" style="border:1px solid var(--cy)"><div style="font-weight:700;font-size:13px;margin-bottom:4px">🎬 Generate this video's shorts</div>'
        +'<div class="muted" style="font-size:12px;margin-bottom:8px">The last public video still has no shorts. The AI analyzes the video: how many shorts, from what moments and how long, and proposes them for you to approve.</div>'
        +'<button class="btn" onclick="suggestShorts()">🤖 Suggest shorts from the last video</button></div>';
    } else if((sst.all_done || uplSched.length) && !uplShow.length){
      shb+='<div class="card muted">✓ The shorts of this video are already done'+(uplSched.length?' and scheduled':'')+'. When you publish a new one, here you can suggest yours.</div>';
    }
    if(!shb) shb='<div class="card muted">No shorts yet. Publish a video and tap Sugerir.</div>';

    // STORY channel (auto Shorts): review/publish what comes out on its own + force a batch.
    el("s-producir").innerHTML=
      (MONITOR?'':pendingReviewHtml())
      +'<div class="card"><div style="font-weight:800;margin-bottom:4px">🤖 The Data Lens (automatic)</div>'
      +'<div class="muted" style="font-size:12px">The Brain produces, schedules and publishes the Shorts on its own (DATA SHOCK format, 3/day). You don't have to approve or schedule anything — just unpublish on YouTube if something you don't like.</div></div>';

    // ===== AGENDA =====
    el("s-agenda").innerHTML = queueHorizonHtml(ST.scheduled)+calendarHtml()+scheduledHtml()+bestTimesHtml();

    // ===== ANALYTICS ===== full channel + analysis + factory + your videos.
    var tree=ST.video_tree||[], ung=ST.video_tree_ungrouped||[];
    var aok=ST.analytics_ok, gV=0, gW=0, rowsHtml="", li=0;
    function vcell(v,isPub){ return '<td style="text-align:right">'+(isPub?num(v.views):"🔒")+'</td>'
      +'<td style="text-align:right">'+(aok?num(v.watch_min||0):"—")+'</td>'; }
    function man(v){ return v.manual?' <span style="color:var(--am);font-size:10px;white-space:nowrap">✋ manual</span>':''; }
    function cat(v){ return (v.niche_label&&!/#short/i.test(v.title||''))?' <span style="color:var(--cy);font-size:10px;white-space:nowrap">🎬 '+esc(v.niche_label)+'</span>':''; }
    function link(v){ return (v.video_id?'<a href="https://youtu.be/'+v.video_id+'" target="_blank">'+esc((v.title||"").slice(0,30))+'</a>':esc(v.title||""))+cat(v)+man(v); }
    tree.forEach(function(l){ li++;
      var pv=l.privacy==="public"; gV+=l.views||0; gW+=l.watch_min||0;
      rowsHtml+='<tr style="font-weight:700;border-top:1px solid rgba(255,255,255,.10)"><td>📹 <span class="muted" style="font-weight:400">#'+li+'</span> '+link(l)+'</td>'+vcell(l,pv)+'</tr>';
      (l.shorts||[]).forEach(function(s){ var sp=s.privacy==="public"; gV+=s.views||0; gW+=s.watch_min||0;
        rowsHtml+='<tr><td style="padding-left:24px">↳ 🎬 '+link(s)+'</td>'+vcell(s,sp)+'</tr>';
      });
    });
    if(ung.length){
      rowsHtml+='<tr style="font-weight:700;border-top:1px solid rgba(255,255,255,.10)"><td>🎬 Shorts sueltos</td><td></td><td></td></tr>';
      ung.forEach(function(s){ var sp=s.privacy==="public"; gV+=s.views||0; gW+=s.watch_min||0;
        rowsHtml+='<tr><td style="padding-left:24px">↳ '+link(s)+'</td>'+vcell(s,sp)+'</tr>';
      });
    }
    var totalRow='<tr style="font-weight:900;border-top:2px solid rgba(255,255,255,.28)"><td>Total</td><td style="text-align:right">'+num(gV)+'</td><td style="text-align:right">'+(aok?num(gW):"—")+'</td></tr>';
    var videosCard='<h2>Tus videos</h2>'
      +'<div class="card" style="padding:8px"><table style="font-size:13px;width:100%"><tr><th style="text-align:left">Video</th><th style="text-align:right">Views</th><th style="text-align:right">Watch min</th></tr>'
      +(rowsHtml||'<tr><td colspan="3" class="muted">No videos yet.</td></tr>')+(rowsHtml?totalRow:'')+'</table></div>'
      +(aok?'':'<div class="muted" style="font-size:11px">⚠️ "Watch minutes" need the YouTube Analytics permission (re-authorize the OAuth with the yt-analytics scope).</div>')
      +'<button class="btn" onclick="showInsights()">🧠 Analyze what to replicate (AI)</button>'
      +'<div id="insightsOut">'+lastInsights+'</div>'
      +'<div class="muted" style="font-size:11px;text-align:center">📹 long · ↳🎬 their shorts · 🔒 private</div>';
    el("s-analitica").innerHTML=
      weeklyHtml("data_lens")
      +categoryScoreHtml()
      +goalHtml(ST.monet_goal)
      +analyticsHtml()
      +dataLensTopHtml()
      +videosCard
      +analysisHtml()
      +factoryHtml()
      +monetizationHtml();

    // ===== MORE ===== create content + system (voice, tools, problems, errors, storage).
    el("s-mas").innerHTML=
      '<h2>Create content</h2>'
      +'<div class="card">'
      +'<label class="file" for="fPhoto">🖼️ Choose photo to retouch</label><input id="fPhoto" type="file" accept="image/*" class="hide">'
      +'<input id="pPrompt" type="text" placeholder="Optional: what to change (e.g.: white background, more light)"></div>'
      +'<div class="card">'
      +'<label class="file" for="fRecipe">🍳 Choose photos/videos from the recipe</label><input id="fRecipe" type="file" accept="image/*,video/*" multiple class="hide">'
      +'<div id="recCount" class="muted"></div>'
      +'<textarea id="rText" placeholder="Recipe text (ingredients and steps)"></textarea>'
      +'<button class="btn" onclick="buildRecipe()">🍳 Build the reel</button></div>'
      +'<div class="card"><label class="file" for="fVoice">🎤 Upload voice note</label><input id="fVoice" type="file" accept="audio/*" class="hide">'
      +'<input id="vName" type="text" placeholder="Voice name (e.g.: wife)"></div>'
      +voicePickerHtml()
      +toolsHealthHtml()
      +problemsHtml()
      +errorLearnHtml()
      +r2Html()
      +'<button class="btn ghost" onclick="dispatch(\\'channel_report.yml\\',\\'Report + analysis\\')">🔄 Refresh metrics + analysis</button>';

    el("fPhoto").onchange=function(e){uploadPhoto(e.target.files[0]);};
    el("fRecipe").onchange=function(e){recFiles=Array.prototype.slice.call(e.target.files);el("recCount").textContent=recFiles.length+" file(s) chosen.";};
    el("fVoice").onchange=function(e){uploadVoice(e.target.files[0]);};
  }

  var recFiles=[];

  // ── "Invisible process" notice (G-V1) ───────────────────────────────────────────────
  // Radar Bot warns when a long process finishes; here we replicate that pattern so the app
  // Do NOT rely only on the workflow's own message (notify_telegram.sh, which may never fire).
  // SIGNAL used (the most robust available in /api/state): we watch by WORKFLOW (.yml), because
  //  · ACTIVE runs (ST.active) expose their wf but NOT their run_id, and
  //  · FAILURES (ST.problems) expose run_id + workflow.
  // Criterion: (1) after the dispatch, we wait for a run of that wf to appear in ST.active (started);
  //           (2) when there is NO LONGER any active of that wf => finished well;
  //           (3) if a NEW failure (run_id that wasn't there before) of that wf appears in ST.problems => failed.
  // Known ambiguity: if two actions use the same wf (e.g. thumbnail_only), we watch only one
  // time per wf (the 2nd doesn't re-start); it's intentional and enough for "I'll notify when done".
  function notifyDone(m){ try{ if(tg&&tg.showAlert){ tg.showAlert(m); return; } }catch(e){} toast(m); }
  function watchProblemIds(wf){ var s={}; (ST.problems||[]).forEach(function(x){ if(x.workflow===wf&&x.run_id) s[x.run_id]=1; }); return s; }
  function activeHasWf(wf){ return (ST.active||[]).some(function(r){ return (r.wf||"")===wf; }); }
  function watchBannerHtml(){
    var ks=Object.keys(WATCH); if(!ks.length) return "";
    return ks.map(function(wf){
      var w=WATCH[wf];
      return '<div class="card" style="border:1px solid var(--cy)"><div style="font-weight:700"><span class="live"></span> ⚙️ '+esc(w.label)+'</div>'
        +'<div class="muted" style="font-size:12px;margin-top:3px">In progress… I'll notify when done. You can keep using the app.</div></div>';
    }).join("");
  }
  function startWatch(wf,label,doneMsg,failMsg,onFail){
    if(!wf||WATCH[wf]) return; // already watching that workflow
    WATCH[wf]={label:label||"The process",tries:0,sawActive:false,base:watchProblemIds(wf),done:doneMsg||(label+" done."),fail:failMsg||(label+" failed."),onFail:onFail};
    render();
    var iv=setInterval(function(){
      var w=WATCH[wf]; if(!w){ clearInterval(iv); return; }
      w.tries++;
      api("/api/state").then(function(r){return r.json();}).then(function(j){
        if(j&&!j.error){ ST=j; }
        w=WATCH[wf]; if(!w){ clearInterval(iv); return; }
        // (3) NEW failure of this wf? (run_id that didn't exist when it started)
        var newFail=(ST.problems||[]).some(function(x){ return x.workflow===wf && x.run_id && !w.base[x.run_id]; });
        if(newFail){ clearInterval(iv); delete WATCH[wf]; h("err"); if(w.onFail){try{w.onFail();}catch(e){}} render(); notifyDone("❌ "+w.fail); return; }
        var on=activeHasWf(wf);
        if(on){ w.sawActive=true; }                 // (1) already started
        else if(w.sawActive){ clearInterval(iv); delete WATCH[wf]; h("ok"); render(); notifyDone("✅ "+w.done); return; } // (2) finished
        if(w.tries>=12){ clearInterval(iv); delete WATCH[wf]; render(); notifyDone("⏳ "+w.label+" is taking a while. Tap ⟳ Refresh in a moment to see the result."); return; }
        render();
      }).catch(function(){ var w2=WATCH[wf]; if(w2&&w2.tries>=12){ clearInterval(iv); delete WATCH[wf]; render(); } });
    },15000); // ~15s, max 12 tries = 3 min
  }

  function dispatch(workflow, label){
    if(tg&&tg.HapticFeedback)tg.HapticFeedback.impactOccurred("light");
    api("/api/dispatch",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({workflow:workflow})})
      .then(function(r){return r.json();}).then(function(j){toast(j.ok?("✅ "+label+" — in progress, watch ⚡ above for progress"):("❌ "+(j.error||"could not")));if(j.ok){setTimeout(load,3000);startWatch(workflow,label,label+" done — review it in the app.",label+" failed.");}})
      .catch(function(){toast("❌ Network error");});
  }
  function dispatchTopic(workflow, topic, label){
    if(tg&&tg.HapticFeedback)tg.HapticFeedback.impactOccurred("light");
    api("/api/dispatch",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({workflow:workflow,inputs:{topic:topic}})})
      .then(function(r){return r.json();}).then(function(j){toast(j.ok?("✅ "+label+" — in progress, watch ⚡ above"):("❌ "+(j.error||"could not")));if(j.ok){setTimeout(load,3000);startWatch(workflow,label,label+" ready — review it in the app.",label+" failed.");}})
      .catch(function(){toast("❌ Network error");});
  }
  function retry(wf){
    // produce_video is retried by producing the next topic (needs topic).
    if(wf==="produce_video.yml"){ var u=(ST.upcoming||[])[0]; if(u){produceVideo(u.n);return;} toast("Open 'Next video' to produce."); return; }
    // The rest is retried directly. (set_privacy is harmless without inputs: empty default + save.)
    if(!wf){ toast("❌ I don't know which workflow to retry."); return; }
    api("/api/dispatch",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({workflow:wf})})
      .then(function(r){return r.json();}).then(function(j){toast(j.ok?"🔁 Retrying… watch ⚡ above":"❌ "+(j.error||"could not"));setTimeout(load,2000);if(j.ok)startWatch(wf,"Retry","The retry finished well — review it in the app.","The retry failed again. Check ⚙️ More ▸ Problems.");})
      .catch(function(){toast("❌ Network error");});
  }
  function produceVideo(n){
    var u=(ST.upcoming||[]).find(function(x){return x.n===n;})||{};
    if(tg&&tg.HapticFeedback)tg.HapticFeedback.impactOccurred("medium");
    api("/api/dispatch",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({workflow:"produce_video.yml",inputs:{topic:u.topic||"",n:String(n)}})})
      .then(function(r){return r.json();}).then(function(j){toast(j.ok?("✅ Producing video #"+n+" — I'll notify you on chat"):("❌ "+(j.error||"could not")));setTimeout(load,1500);if(j.ok)startWatch("produce_video.yml","Produce video #"+n,"Video #"+n+" is ready — watch ⚡ above: review it, score it and approve it in Produce.","Video #"+n+" production failed.");});
  }
  function showTrends(){
    var o=el("trendsOut"); o.innerHTML='<div class="card muted">🔎 Analyzing trends…</div>';
    api("/api/trends").then(function(r){return r.json();}).then(function(j){
      o.innerHTML='<h2>🔥 Trends — aligned?</h2><div class="card">'+esc(j.analysis||j.error||"no data").replace(/\\n/g,"<br>")+'</div>';
    }).catch(function(){o.innerHTML='<div class="card muted">Could not analyze trends.</div>';});
  }
  function showInsights(){
    var o=el("insightsOut"); o.innerHTML='<div class="card muted">🧠 Analyzing which videos perform best and what to replicate…</div>';
    api("/api/insights").then(function(r){return r.json();}).then(function(j){
      lastInsights='<h2>🧠 What to replicate</h2><div class="card">'+esc(j.analysis||j.error||"no data").replace(/\\n/g,"<br>")+'</div>';
      var e=el("insightsOut"); if(e) e.innerHTML=lastInsights;
    }).catch(function(){var e=el("insightsOut");if(e) e.innerHTML='<div class="card muted">Could not analyze.</div>'; });
  }
  // ===== Brain (Brain OS Phases 5-6): decision engine + monetization War Room =====
  var BRAIN=null, brainLoading=false;
  function loadBrain(force){
    var host=el("s-brain"); if(!host) return;
    if(BRAIN && !force){ host.innerHTML=brainHtml(BRAIN); return; }
    if(brainLoading) return; brainLoading=true;
    if(!BRAIN){ var sk=''; for(var i=0;i<3;i++){ sk+='<div class="card"><div class="sk-l" style="width:'+(52+i*14)+'%"></div><div class="sk-l s"></div></div>'; } host.innerHTML=sk; }
    api("/api/brain").then(function(r){return r.json();}).then(function(j){ BRAIN=j; brainLoading=false; host.innerHTML=brainHtml(j); })
      .catch(function(){ brainLoading=false; host.innerHTML='<div class="card muted">Unable to load Brain data.</div>'; });
  }
  function bPill(txt,cvar){ return '<span style="display:inline-block;font-size:10px;font-weight:700;padding:2px 7px;border-radius:999px;background:var(--soft);color:var('+cvar+')">'+esc(txt)+'</span>'; }
  function bRisk(r){ return r==="high"?"--rd":(r==="medium"?"--am":"--gr"); }
  function bNum(n){ return Number(n||0).toLocaleString("en"); }
  function bTargetRow(r){
    var col = r.done?"--gr":(r.on_track===false?"--rd":(r.on_track?"--gr":"--am"));
    var proj = r.proj_date?'<span class="muted" style="font-size:10px"> · est. '+esc(r.proj_date)+'</span>':'';
    return '<div style="margin:6px 0">'
      +'<div style="display:flex;justify-content:space-between;font-size:12px;gap:8px"><span><span style="color:var('+col+')">●</span> '+esc(r.label)+'</span>'
      +'<span class="num" style="text-align:right">'+bNum(r.cur)+' / '+bNum(r.target)+' ('+(r.pct||0)+'%)'+proj+'</span></div>'
      +'<div style="height:7px;border-radius:999px;background:var(--soft);margin-top:4px;overflow:hidden"><div style="height:7px;border-radius:999px;width:'+Math.max(2,Math.min(100,r.pct||0))+'%;background:var('+col+')"></div></div></div>';
  }
  function bMonetCard(name, ch){
    if(!ch||!ch.readiness) return '<div class="card muted" style="font-size:12px">'+esc(name)+': no data yet.</div>';
    var rd=ch.readiness, wr=ch.war_room||{};
    var sc = rd.status==="behind"?"--rd":(rd.status==="measuring"?"--am":"--gr");
    var rows = (rd.reqs||[]).map(bTargetRow).join("");
    var focus = (wr.active&&wr.focus_label)?'<div class="card" style="background:var(--bg);padding:8px;margin-top:8px;font-size:12px"><b>🎯 Focus:</b> '+esc(wr.focus_label)+' — '+esc(wr.next_action||"")+'</div>':"";
    return '<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap"><b>'+esc(name)+'</b>'
      +'<span>'+bPill(String(rd.status).toUpperCase(),sc)+' '+bPill(rd.days_left+"d",(rd.days_left<=30?"--rd":"--am"))+' '+bPill("risk "+(wr.risk||"?"),bRisk(wr.risk))+'</span></div>'
      +rows+focus+'</div>';
  }
  function bDecisionCard(d){
    if(!d||!d.candidates||!d.candidates.length) return '<div class="card muted" style="font-size:12px">🎛️ Decision engine: no record yet (it generates on Mondays with the Oddly rebalance).</div>';
    var rows=d.candidates.map(function(c){
      var slots=(d.recommended_allocation&&d.recommended_allocation[c.key])||0;
      return '<tr><td style="text-align:left">'+esc(c.label||c.key)+'</td>'
        +'<td class="num" style="text-align:right">'+(c.expected_value!=null?c.expected_value:"—")+'</td>'
        +'<td class="num" style="text-align:right">'+(c.confidence!=null?Math.round(c.confidence*100)+"%":"—")+'</td>'
        +'<td class="num" style="text-align:right">'+(c.score!=null?c.score:"—")+'</td>'
        +'<td class="num" style="text-align:right"><b>'+slots+'</b></td></tr>';
    }).join("");
    return '<div class="card"><div style="display:flex;justify-content:space-between;align-items:center"><b>🎛️ Decision engine — Oddly</b><span class="muted" style="font-size:11px">'+esc(d.week||"")+'</span></div>'
      +'<div class="muted" style="font-size:11px;margin:2px 0 8px">Allocation by confidence (score = value × certainty), not blind proportional.</div>'
      +'<table style="font-size:12px;width:100%"><tr><th style="text-align:left">Niche</th><th style="text-align:right">Value</th><th style="text-align:right">Certainty</th><th style="text-align:right">Score</th><th style="text-align:right">Slots</th></tr>'+rows+'</table></div>';
  }
  function bQueueCard(q){
    if(!q) return "";
    var last = q.last_publish_at?esc(String(q.last_publish_at).slice(0,16).replace("T"," ")):"—";
    var drenando = (q.produced_today===0 && q.scheduled_ahead>0);
    return '<div class="card" style="font-size:12px"><div style="display:flex;justify-content:space-between;align-items:center;gap:6px"><b>🗓️ Publishing queue (Oddly)</b>'
      +bPill(drenando?"draining":"on pace", drenando?"--am":"--gr")+'</div>'
      +'<div class="muted" style="margin-top:4px"><b>'+(q.scheduled_ahead||0)+'</b> scheduled · publish until <b>'+last+'</b> · buffer ~'+(q.buffer_hours||30)+'h</div>'
      +'<div class="muted" style="margin-top:2px">Today: I produced '+(q.produced_today!=null?q.produced_today:"—")+(q.skipped_today?(" · I skipped "+q.skipped_today+" (queue full)"):"")+". The brain sees results at ~1 day, not ~1 week.</div></div>';
  }
  function brainHtml(j){
    j=j||{};
    var mon=j.monetization||{}; var chs=mon.channels||{};
    var when = mon.at?'<div class="muted" style="font-size:11px;margin:-2px 2px 8px">Updated '+esc(String(mon.at).slice(5,16).replace("T"," "))+'</div>':"";
    var empty = (!mon.channels && !j.decision && !j.queue);      return '<h2>🧠 Brain <span class="live"></span></h2>'+when
      +(empty?'<div class="card muted" style="font-size:12px">The brain hasn't left R2 records yet. They generate daily (dashboard) and on Mondays (decision engine).</div>':"")
      +bQueueCard(j.queue)
      +'<div class="muted" style="font-size:12px;margin:0 2px 8px">📊 60-day War Room — how much is left to monetize?</div>'
      +bMonetCard("The Data Lens", chs["data-lens"])
      +bMonetCard("Oddly Loop", chs["auto2"])
      +bDecisionCard(j.decision)
      +'<button class="btn" style="margin-top:6px" onclick="loadBrain(true)">↻ Refresh</button>';
  }
  function regenSeo(){
    var notes=(el("seoNotes")&&el("seoNotes").value)||"";
    if(tg&&tg.HapticFeedback)tg.HapticFeedback.impactOccurred("light");
    api("/api/dispatch",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({workflow:"seo_regen.yml",inputs:{notes:notes}})})
      .then(function(r){return r.json();}).then(function(j){toast(j.ok?"🔁 Regenerating the SEO — I'll show the new one here and on chat":"❌ "+(j.error||"could not"));setTimeout(load,2500);if(j.ok)startWatch("seo_regen.yml","Regenerate SEO","The new SEO is ready — review it in Produce and approve it or regenerate it again.","SEO regeneration failed.");});
  }
  function approveRender(){
    if(tg&&tg.HapticFeedback)tg.HapticFeedback.impactOccurred("medium");
    api("/api/dispatch",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({workflow:"publish_youtube.yml"})})
      .then(function(r){return r.json();}).then(function(j){toast(j.ok?"✅ Approved. Uploading and preparing the SEO…":"❌ "+(j.error||"could not"));setTimeout(load,2500);if(j.ok)startWatch("publish_youtube.yml","Upload and prepare SEO","Video uploaded and SEO prepared — review the SEO in Produce and approve it to schedule.","YouTube upload failed.");});
  }
  function regenRender(){
    var go=function(){ api("/api/dispatch",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({workflow:"render_phased.yml"})})
      .then(function(r){return r.json();}).then(function(j){toast(j.ok?"🔁 Regenerating the video…":"❌ "+(j.error||"could not"));setTimeout(load,2500);if(j.ok)startWatch("render_phased.yml","Regenerate video","The regenerated video is ready — review it and approve in Produce.","Video re-render failed.");}); };
    if(tg&&tg.showConfirm){ tg.showConfirm("Regenerate the video (it renders again)?",function(ok){if(ok)go();}); } else if(confirm("Regenerate the video?")){ go(); }
  }
  function approveSeo(){
    if(tg&&tg.HapticFeedback)tg.HapticFeedback.impactOccurred("medium");
    api("/api/approve",{method:"POST"}).then(function(r){return r.json();}).then(function(j){
      var msg="❌ could not";
      if(j.ok && j.scheduled) msg="✅ Approved and scheduled"+(j.publish_at?" · "+fmtSlot(j.publish_at):"")+". Watch it in 📅 Agenda.";
      else if(j.ok) msg="✅ Approved. I didn't find a free hour — use 📅 Schedule. ("+(j.schedule_error||"")+")";
      toast(msg);setTimeout(load,900);
    });
  }
  function publishVideo(){
    var p=ST.production||{}; if(!p.video_id){toast("No video uploaded yet");return;}
    var go=function(){ api("/api/dispatch",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({workflow:"set_privacy.yml",inputs:{video_id:p.video_id,privacy:"public"}})})
      .then(function(r){return r.json();}).then(function(j){toast(j.ok?"🌍 Publishing the video as public. When you want, go to Shorts and tap Suggest.":"❌ "+(j.error||"could not"));setTimeout(load,1800);if(j.ok)startWatch("set_privacy.yml","Publish video","The video is now public.","Could not publish the video.");}); };
    if(tg&&tg.showConfirm){ tg.showConfirm("Publish the video as PUBLIC NOW (without waiting for the best hour)?",function(ok){if(ok)go();}); }
    else if(confirm("Publish the video as PUBLIC now?")){ go(); }
  }
  function scheduleVideo(){
    var p=ST.production||{}; if(!p.video_id){toast("No video uploaded yet");return;}
    if(tg&&tg.HapticFeedback)tg.HapticFeedback.impactOccurred("medium");
    api("/api/schedule",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({})})
      .then(function(r){return r.json();}).then(function(j){
        if(j.ok){ toast("📅 Scheduled for "+fmtSlot(j.publish_at)); setTimeout(load,1800); }
        else toast("❌ "+(j.error||"could not schedule"));
      }).catch(function(){toast("❌ Network error");});
  }
  function scheduleShort(id){
    if(!id){toast("No short");return;}
    if(tg&&tg.HapticFeedback)tg.HapticFeedback.impactOccurred("medium");
    api("/api/schedule",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({video_id:id})})
      .then(function(r){return r.json();}).then(function(j){
        if(j.ok){ toast("📅 Short scheduled for "+fmtSlot(j.publish_at)); setTimeout(load,1800); }
        else toast("❌ "+(j.error||"could not schedule"));
      }).catch(function(){toast("❌ Network error");});
  }
  function shortApprove(n, ok){
    if(tg&&tg.HapticFeedback)tg.HapticFeedback.impactOccurred("light");
    api("/api/short",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({n:n,action:ok?"approve":"skip"})})
      .then(function(r){return r.json();}).then(function(j){toast(j.ok?(ok?"✅ Short approved":"❌ Short skipped"):"❌ could not");setTimeout(load,500);});
  }
  function produceOddly(niche,kind,variant){
    kind=kind||"video"; variant=variant||"puro";
    var fmt=(kind==="short")?"9:16":"16:9";
    if(tg&&tg.HapticFeedback)tg.HapticFeedback.impactOccurred("medium");
    api("/api/dispatch",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({workflow:"produce_oddly.yml",inputs:{niche:niche||"satisfying",variant:variant,kind:kind,format:fmt,publish:"no"}})})
      .then(function(r){return r.json();}).then(function(j){
        var pieza=(kind==="short")?"Short 📱":"video";
        var voz=(variant==="puro")?"no voice":"with voice";
        toast(j.ok?("🏭 Producing "+pieza+" ASMR ("+voz+")… "+(kind==="short"?"~8":"~15")+" min, I will alert the chat"):("❌ "+(j.error||"could not")));
        setTimeout(load,3000);
        if(j.ok)startWatch("produce_oddly.yml","Produce "+pieza+" Oddly Loop","The "+pieza+" of Oddly Loop is ready (private) — review it and schedule/publish it in Produce.","Oddly Loop production failed.");})
      .catch(function(){toast("❌ Network error");});
  }
  function oddlyPublish(vid,mode){
    if(!vid){toast("no video");return;}
    mode=mode||"schedule";
    var go=function(){
      if(tg&&tg.HapticFeedback)tg.HapticFeedback.impactOccurred("medium");
      api("/api/oddly-publish",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({video_id:vid,mode:mode})})
      .then(function(r){return r.json();}).then(function(j){
        if(j.ok){ localSched[vid]=mode; render(); toast(mode==="public"?"🌍 Publishing on Oddly Loop… I will alert the chat":"📅 Scheduling at the best hour ✓ I will alert the chat"); setTimeout(load,4000);
          // If the workflow FAILS, clear the durable marker -> the video goes back to "to review" (it does not stay "scheduling" forever).
          var clearMark=function(){ delete localSched[vid]; api("/api/oddly-publish",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({video_id:vid,clear:true})}).then(function(){setTimeout(load,600);}); };
          startWatch("publish_oddly.yml",(mode==="public"?"Publish":"Schedule")+" in Oddly Loop",(mode==="public"?"The Oddly Loop video is now public.":"The Oddly Loop video is scheduled — watch it in 📅 Agenda."),(mode==="public"?"The publish":"The schedule")+" in Oddly Loop failed. Go back to «to review».",clearMark); }
        else toast("❌ "+(j.error||"could not"));
      }).catch(function(){toast("❌ Network error");}); };
    if(mode==="public"&&tg&&tg.showConfirm){ tg.showConfirm("Publish this Oddly Loop video NOW (public)?",function(ok){if(ok)go();}); } else go();
  }
  function oddlyManual(vid){
    // Mark/unmark an Oddly scheduled video as "mine" (purple). Immediate effect: the /API/state
    // re-reads manual_videos.json live, so with load() the color changes on tap (without waiting for the report).
    if(!vid){toast("no video");return;}
    if(tg&&tg.HapticFeedback)tg.HapticFeedback.impactOccurred("light");
    api("/api/oddly-manual",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({video_id:vid})})
      .then(function(r){return r.json();}).then(function(j){ if(j.ok){ toast(j.manual?"🟣 Marked as yours":"Removed from «mine»"); load(); } else toast("❌ "+(j.error||"could not")); }).catch(function(){toast("❌ Network error");});
  }
  window.oddlyManual=oddlyManual;
  function dlPublish(vid,mode){
    // The Data Lens: schedule (best hour, YT_ token) or publish now (set_privacy.yml). Optimistic
    // feedback (localSched) + live notice when done, like on Oddly.
    if(!vid){toast("no video");return;}
    mode=mode||"schedule";
    var go=function(){
      if(tg&&tg.HapticFeedback)tg.HapticFeedback.impactOccurred("medium");
      if(mode==="public"){
        api("/api/dispatch",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({workflow:"set_privacy.yml",inputs:{video_id:vid,privacy:"public"}})})
        .then(function(r){return r.json();}).then(function(j){ if(j.ok){ localSched[vid]="public"; render(); toast("🌍 Publishing in The Data Lens… I'll notify you on chat"); setTimeout(load,4000); startWatch("set_privacy.yml","Publish in The Data Lens","The video is now public in The Data Lens.","Publishing in The Data Lens failed."); } else toast("❌ "+(j.error||"could not")); }).catch(function(){toast("❌ Network error");});
      } else {
        api("/api/schedule",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({video_id:vid})})
        .then(function(r){return r.json();}).then(function(j){ if(j.ok){ localSched[vid]="schedule"; render(); toast("📅 Scheduled for "+fmtSlot(j.publish_at)+" — see 📅 Agenda"); setTimeout(load,4000); } else toast("❌ "+(j.error||"could not schedule")); }).catch(function(){toast("❌ Network error");});
      }
    };
    if(mode==="public"&&tg&&tg.showConfirm){ tg.showConfirm("Publish this The Data Lens video NOW (public)?",function(ok){if(ok)go();}); } else go();
  }
  function goShorts(vid){ if(vid) shortsTargetVid=vid; tab("producir"); render(); var e=el("shortsAnchor"); if(e) setTimeout(function(){e.scrollIntoView({behavior:"smooth",block:"start"});},60); }
  function clearShortsTarget(){ shortsTargetVid=""; render(); }
  function vidTitle(id){ var all=(ST.video_matrix||[]).concat(ST.video_tree||[]); for(var i=0;i<all.length;i++){ if(all[i].video_id===id) return all[i].title||id; } return id; }
  function runShortsPlan(notes){
    var vid=shortsTargetVid||(ST.shorts_status&&ST.shorts_status.latest_video_id)||"";
    var inputs={}; if(vid)inputs.video_id=vid; if(notes)inputs.notes=notes;
    if(tg&&tg.HapticFeedback)tg.HapticFeedback.impactOccurred("medium");
    api("/api/dispatch",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({workflow:"shorts_plan.yml",inputs:inputs})})
      .then(function(r){return r.json();}).then(function(j){ shortsTargetVid=""; toast(j.ok?("🤖 Analyzing the video to suggest shorts…"):("❌ "+(j.error||"could not")));setTimeout(load,2500);if(j.ok)startWatch("shorts_plan.yml","Suggest shorts","There are already shorts suggestions — approve them or skip them in ✂️ Shorts.","The shorts analysis failed.");});
  }
  function suggestShorts(){ runShortsPlan(""); }
  function regenShorts(){ runShortsPlan((el("shNotes")&&el("shNotes").value)||""); }
  function publishRow(vid){
    var go=function(){ api("/api/dispatch",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({workflow:"set_privacy.yml",inputs:{video_id:vid,privacy:"public"}})})
      .then(function(r){return r.json();}).then(function(j){toast(j.ok?"🌍 Publishing the video…":"❌ "+(j.error||"could not"));setTimeout(load,1800);if(j.ok)startWatch("set_privacy.yml","Publish video","The video is now public.","Could not publish the video.");}); };
    if(tg&&tg.showConfirm){ tg.showConfirm("Publish this video as PUBLIC?",function(ok){if(ok)go();}); } else if(confirm("Publish public?")){ go(); }
  }
  function thumbRow(vid){
    if(tg&&tg.HapticFeedback)tg.HapticFeedback.impactOccurred("light");
    api("/api/dispatch",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({workflow:"thumbnail_only.yml",inputs:{video_id:vid,mode:"generate"}})})
      .then(function(r){return r.json();}).then(function(j){toast(j.ok?"🖼️ Generating the thumbnail — in a moment you'll see it here to approve":"❌ "+(j.error||"could not"));setTimeout(load,4000);if(j.ok)startWatch("thumbnail_only.yml","Thumbnail","The thumbnail is ready — look above in Produce and give it ✅ Approve (or 🔁 redo).","The thumbnail failed.");});
  }
  function thumbApprove(vid){
    if(tg&&tg.HapticFeedback)tg.HapticFeedback.impactOccurred("light");
    api("/api/thumb-approve",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({video_id:vid})})
      .then(function(r){return r.json();}).then(function(j){toast(j.ok?"✅ Approved. Now hit 🌍 Publish.":"❌ could not");setTimeout(load,500);});
  }
  function thumbPublish(vid){
    if(tg&&tg.HapticFeedback)tg.HapticFeedback.impactOccurred("medium");
    api("/api/dispatch",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({workflow:"thumbnail_only.yml",inputs:{video_id:vid,mode:"apply"}})})
      .then(function(r){return r.json();}).then(function(j){toast(j.ok?"🌍 Publishing the thumbnail on YouTube…":"❌ "+(j.error||"could not"));setTimeout(load,3000);if(j.ok)startWatch("thumbnail_only.yml","Publish thumbnail","The thumbnail is now set on YouTube.","Could not set the thumbnail on YouTube.");});
  }
  function pickVoice(id){
    if(tg&&tg.HapticFeedback)tg.HapticFeedback.impactOccurred("medium");
    api("/api/voice",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:id})})
      .then(function(r){return r.json();}).then(function(j){toast(j.ok?("✅ Channel voice: "+j.label):"❌ could not");setTimeout(load,600);});
  }
  function pubShort(id){
    api("/api/dispatch",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({workflow:"set_privacy.yml",inputs:{video_id:id,privacy:"public"}})})
      .then(function(r){return r.json();}).then(function(j){toast(j.ok?"✅ Publishing the short":"❌ could not");setTimeout(load,1500);if(j.ok)startWatch("set_privacy.yml","Publish short","The short is now public.","Could not publish the short.");});
  }
  function uploadPhoto(f){ if(!f)return; var fd=new FormData(); fd.append("kind","photo"); fd.append("prompt",el("pPrompt").value||""); fd.append("file",f);
    toast("Uploading photo…"); api("/api/upload",{method:"POST",body:fd}).then(function(r){return r.json();}).then(function(j){toast(j.ok?"✅ Retouching the photo, it'll arrive on chat":"❌ "+(j.error||"failed"));}); }
  function uploadVoice(f){ if(!f)return; var fd=new FormData(); fd.append("kind","voice"); fd.append("name",el("vName").value||"voz"); fd.append("file",f);
    toast("Uploading voice…"); api("/api/upload",{method:"POST",body:fd}).then(function(r){return r.json();}).then(function(j){toast(j.ok?"✅ Voice saved":"❌ "+(j.error||"failed"));}); }
  function uploadClip(f){ if(!f)return;
    if(f.size>100*1024*1024){toast("That clip weighs "+Math.round(f.size/1048576)+"MB. The max for now is ~100MB.");return;}
    var cap=encodeURIComponent((el("clipCap").value||"").slice(0,300));
    toast("Uploading clip… ("+Math.round(f.size/1048576)+"MB)");
    api("/api/upload-clip?caption="+cap,{method:"POST",headers:{"content-type":f.type||"video/mp4"},body:f})
      .then(function(r){return r.json();}).then(function(j){toast(j.ok?"✅ Clip received. The AI builds the SEO, schedules it and notifies you on chat with the link.":"❌ "+(j.error||"failed"));if(el("clipCap"))el("clipCap").value="";}); }
  function buildRecipe(){ if(!recFiles.length){toast("Elige al menos una foto/video");return;}
    var fd=new FormData(); fd.append("kind","recipe"); fd.append("text",el("rText").value||"");
    recFiles.forEach(function(f){fd.append("file",f);});
    toast("Uploading recipe…"); api("/api/upload",{method:"POST",body:fd}).then(function(r){return r.json();}).then(function(j){toast(j.ok?"✅ Building the reel, it'll arrive on chat":"❌ "+(j.error||"failed"));recFiles=[];}); }

  // Auto-refresh: FAST (9s) when something is running = seen live; SLOW (25s) when nothing.
  // Does not refresh on "Create" so what you are typing is not wiped.
  var refTimer=null;
  function isTyping(){ var a=document.activeElement; return a && (a.tagName==="TEXTAREA"||a.tagName==="INPUT"); }
  function scheduleRefresh(){
    clearTimeout(refTimer);
    var ms=(ST.active&&ST.active.length)?9000:25000;
    // Don't refresh if you're typing (don't erase comments/texts halfway).
    refTimer=setTimeout(function(){ if(curTab!=="mas" && !isTyping()) load(); else scheduleRefresh(); }, ms);
  }
  function load(){ api("/api/state").then(function(r){return r.json();}).then(function(j){ if(j.error){ el("hd").textContent = j.error==="no autorizado" ? "No autorizado" : ("⚠️ "+(j.detail||j.error)+" — retrying…"); scheduleRefresh(); return; } ST=j; render(); scheduleRefresh(); }).catch(function(){el("hd").textContent="No connection — retrying…";scheduleRefresh();}); }
  // Skeleton mientras llega the primer /API/state (avoids pantalla vacia to the abrir).
  (function skeletonBoot(){ var s=""; for(var i=0;i<4;i++){ s+='<div class="card"><div class="sk-l" style="width:'+(46+i*10)+'%"></div><div class="sk-l s"></div></div>'; } var e=el("s-inicio"); if(e&&!e.innerHTML) e.innerHTML=s; })();
  applyChannelTheme(curChannel);   // brand accent + initial channel's logo
  load();
</script>
</body></html>`;

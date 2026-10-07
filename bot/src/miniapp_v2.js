// miniapp_v2.js — Video Forge: the LIVE BRAIN (redesign after the Brain OS audit). Served at /app2.
// The app is no longer a monitor of what happened: it shows what the brain is thinking and doing right now, the
// plan for TODAY and TOMORROW (each piece as an auditable decision), the REAL YouTube Partner Program goal per
// window with its honest viability, and its own self-critique (decision ledger with hits and misses).
// Pure monitor: nothing is approved here. The client JS uses NO template-literals and NO inline onclick.
export const APP2_HTML = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Video Forge</title>
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<style>
  :root{
    --bg:var(--tg-theme-bg-color,#0b0f17); --card:var(--tg-theme-secondary-bg-color,#141b26);
    --txt:var(--tg-theme-text-color,#eaf1ff); --hint:var(--tg-theme-hint-color,#8aa0c0);
    --line:rgba(130,140,158,.20); --soft:rgba(130,140,158,.10);
    --gr:#34d399; --am:#f5a524; --rd:#f87171; --bl:#7cc4ff;
    --acc:#10b981; --acc2:#2dd4bf; --glow:rgba(16,185,129,.20); --accfg:#04140d;
    --r:16px; --shadow:0 10px 26px rgba(0,0,0,.28);
  }
  body[data-ch="data-lens"]{--acc:#a3e635;--acc2:#4ade80;--glow:rgba(163,230,53,.18);--accfg:#0f1a00}
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  body{margin:0;background:radial-gradient(120% 40% at 50% -60px,var(--glow),transparent 62%),var(--bg);color:var(--txt);
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,system-ui,sans-serif;font-size:15px;line-height:1.45;
    padding-bottom:calc(88px + env(safe-area-inset-bottom))}
  header{padding:14px 14px 10px;position:sticky;top:0;background:var(--bg);z-index:6;border-bottom:1px solid var(--line)}
  .hdrow{display:flex;align-items:center;justify-content:space-between;gap:11px}
  .hd-l{display:flex;align-items:center;gap:11px;min-width:0}
  .logo{width:42px;height:42px;border-radius:13px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:linear-gradient(140deg,var(--acc),var(--acc2));box-shadow:0 8px 20px var(--glow)}
  .logo svg{width:26px;height:26px;display:block}
  h1{font-size:17px;margin:0;font-weight:800;letter-spacing:.2px}
  .sub{color:var(--hint);font-size:12px;display:flex;align-items:center;gap:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .icon{background:var(--card);border:1px solid var(--line);color:var(--txt);min-width:38px;height:38px;border-radius:12px;font-size:18px;display:flex;align-items:center;justify-content:center;cursor:pointer}
  .icon:active{transform:scale(.92)}
  .seg{display:flex;background:var(--card);border:1px solid var(--line);border-radius:13px;padding:4px;gap:3px;margin-top:10px}
  .seg button{flex:1;background:none;border:0;color:var(--hint);font-size:12.5px;font-weight:700;padding:8px 10px;border-radius:10px;cursor:pointer}
  .seg button.on{background:linear-gradient(135deg,var(--acc),var(--acc2));color:var(--accfg)}
  .wrap{padding:0 14px}
  h2{font-size:11px;color:var(--hint);text-transform:uppercase;letter-spacing:.7px;font-weight:800;margin:20px 2px 8px;display:flex;align-items:center;gap:8px}
  h2 .cnt{background:var(--card);border:1px solid var(--line);color:var(--txt);padding:1px 8px;border-radius:999px;font-size:11px;letter-spacing:0;text-transform:none}
  .card{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:14px;margin:10px 0}
  .card.tap{cursor:pointer}.card.tap:active{transform:scale(.99)}
  .row{display:flex;justify-content:space-between;align-items:center;gap:10px}
  .muted{color:var(--hint);font-size:12.5px}
  .num{font-variant-numeric:tabular-nums}
  .pill{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:800;padding:3px 9px;border-radius:999px;background:var(--soft);color:var(--txt);white-space:nowrap}
  .p-plan{color:var(--bl)} .p-prod{color:var(--am)} .p-prog{color:var(--gr)} .p-pub{background:rgba(52,211,153,.16);color:var(--gr)} .p-late{color:var(--hint)} .p-miss{color:var(--rd)}
  .p-ok{color:var(--gr)} .p-bad{color:var(--rd)} .p-warn{color:var(--am)} .p-none{color:var(--hint)}
  .dot{width:8px;height:8px;border-radius:50%;background:var(--acc);display:inline-block;flex-shrink:0}
  .dot.live{animation:pulse 1.6s infinite}
  @keyframes pulse{0%{box-shadow:0 0 0 0 var(--glow)}70%{box-shadow:0 0 0 9px transparent}100%{box-shadow:0 0 0 0 transparent}}
  .mind{background:linear-gradient(155deg,var(--glow),transparent 60%),var(--card);border-radius:20px;padding:16px;margin:14px 0 6px;border:1px solid var(--line)}
  .mind .t{font-size:20px;font-weight:850;letter-spacing:-.3px;line-height:1.2}
  .mind .meta{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:10px;color:var(--hint);font-size:12.5px}
  .tl{position:relative;margin:6px 0 0;padding-left:18px}
  .tl::before{content:"";position:absolute;left:5px;top:6px;bottom:6px;width:2px;background:var(--line)}
  .tli{position:relative;padding:9px 0 9px 6px;border-bottom:1px solid var(--line)}
  .tli:last-child{border-bottom:0}
  .tli::before{content:"";position:absolute;left:-17px;top:15px;width:10px;height:10px;border-radius:50%;background:var(--bg);border:2px solid var(--hint)}
  .tli.s-produciendo::before{border-color:var(--am);background:var(--am)}
  .tli.s-programado::before,.tli.s-publicado::before{border-color:var(--gr);background:var(--gr)}
  .tli.s-planeado::before{border-color:var(--bl)}
  .tli.s-vencido::before{border-color:var(--rd)}
  .tli .when{font-weight:800;font-size:13px}
  .tli .what{font-size:13.5px;margin-top:2px}
  .tli .idea{font-size:12.5px;color:var(--hint);margin-top:3px}
  .feed .fi{display:flex;gap:10px;padding:9px 0;border-bottom:1px solid var(--line)}
  .feed .fi:last-child{border-bottom:0}
  .feed .ic{width:26px;height:26px;border-radius:8px;background:var(--soft);display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0}
  .feed .tx{font-size:13.5px;line-height:1.4}
  .feed .ts{font-size:11px;color:var(--hint);margin-top:2px}
  .know{display:grid;grid-template-columns:1fr 1fr;gap:9px}
  @media (max-width:360px){.know{grid-template-columns:1fr}}
  .kb{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:11px 12px}
  .kb b{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px}
  .kb ul{margin:0;padding-left:16px;font-size:12.5px;color:var(--txt)}
  .kb li{margin:3px 0}
  .kb.sabe b{color:var(--gr)} .kb.cree b{color:var(--bl)} .kb.desc b{color:var(--am)} .kb.comp b{color:var(--acc2)}
  .banner{border-radius:16px;padding:14px;margin:12px 0;border:1px solid var(--line);background:var(--card)}
  .banner.bad{background:linear-gradient(150deg,rgba(248,113,113,.14),transparent 70%),var(--card);border-color:rgba(248,113,113,.35)}
  .banner.warn{background:linear-gradient(150deg,rgba(245,165,36,.14),transparent 70%),var(--card)}
  .banner.ok{background:linear-gradient(150deg,rgba(52,211,153,.14),transparent 70%),var(--card)}
  .banner .bt{font-weight:850;font-size:16px}
  .req{padding:10px 0;border-top:1px solid var(--line)}
  .req:first-of-type{border-top:0}
  .bar{height:7px;background:var(--soft);border-radius:999px;overflow:hidden;margin-top:7px;position:relative}
  .bar i{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,var(--acc),var(--acc2));border-radius:999px}
  .pace{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}
  .pace div{background:var(--bg);border-radius:10px;padding:7px 9px}
  .pace .k{font-size:10.5px;color:var(--hint);text-transform:uppercase;letter-spacing:.4px;font-weight:700}
  .pace .v{font-weight:800;font-size:14px}
  .daysw{display:flex;gap:6px;margin:12px 0 4px}
  .daysw button{flex:1;background:var(--card);border:1px solid var(--line);color:var(--hint);font-weight:800;font-size:13px;padding:9px;border-radius:12px;cursor:pointer}
  .daysw button.on{color:var(--accfg);background:linear-gradient(135deg,var(--acc),var(--acc2));border-color:transparent}
  .counts{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
  .plan-item{display:grid;grid-template-columns:54px 1fr;gap:10px;align-items:start}
  .plan-item .hh{font-weight:850;font-size:15px;line-height:1.2}
  .plan-item .hh small{display:block;font-size:10.5px;color:var(--hint);font-weight:700}
  .chain{display:flex;flex-direction:column;gap:8px;margin-top:6px}
  .chain div{display:grid;grid-template-columns:92px 1fr;gap:10px;font-size:13.5px}
  .chain .k{font-size:10.5px;text-transform:uppercase;letter-spacing:.5px;color:var(--hint);font-weight:800;padding-top:2px}
  table{width:100%;border-collapse:collapse;font-size:12.5px}
  th{color:var(--hint);text-align:left;font-weight:700;padding:6px 4px;font-size:10.5px;text-transform:uppercase;letter-spacing:.3px}
  td{padding:8px 4px;border-top:1px solid var(--line);vertical-align:top}
  .btn{display:block;width:100%;background:linear-gradient(135deg,var(--acc),var(--acc2));color:var(--accfg);border:0;border-radius:13px;padding:12px;font-size:14px;font-weight:800;margin:8px 0;cursor:pointer}
  .btn.ghost{background:transparent;color:var(--txt);border:1px solid var(--line)}
  .btn.mini{display:inline-block;width:auto;padding:7px 12px;font-size:12px;margin:0}
  input[type=text]{width:100%;background:var(--bg);color:var(--txt);border:1px solid var(--line);border-radius:11px;padding:11px;font-size:15px;font-family:inherit}
  .file{display:flex;align-items:center;gap:10px;background:var(--bg);border:1px dashed var(--line);border-radius:12px;padding:13px;justify-content:center;color:var(--hint);cursor:pointer;margin:8px 0;font-weight:600}
  .vrow{display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--line)}
  .vrow:first-child{border-top:0}
  .vrow img{width:44px;height:78px;object-fit:cover;border-radius:8px;background:var(--soft);flex-shrink:0}
  .vrow .vt{font-size:13px;font-weight:700;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .nav{position:fixed;bottom:0;left:0;right:0;display:flex;background:var(--card);border-top:1px solid var(--line);padding:6px 8px calc(10px + env(safe-area-inset-bottom));z-index:7}
  .nav button{flex:1;background:none;border:0;color:var(--hint);font-size:10.5px;font-weight:700;padding:6px 2px;cursor:pointer;border-radius:12px;margin:0 2px}
  .nav button .ic{font-size:19px;display:block;margin-bottom:1px}
  .nav button.on{color:var(--accfg);background:linear-gradient(135deg,var(--acc),var(--acc2))}
  .hide{display:none}
  .fadein{animation:fadein .22s ease}
  @keyframes fadein{from{opacity:.4;transform:translateY(6px)}to{opacity:1;transform:none}}
  .sk{height:13px;border-radius:8px;background:var(--soft);margin:8px 0}
  #toast{position:fixed;bottom:calc(88px + env(safe-area-inset-bottom));left:14px;right:14px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 15px;text-align:center;font-weight:600;transform:translateY(160%);opacity:0;transition:transform .3s,opacity .3s;z-index:20}
  #toast.show{transform:none;opacity:1}
  #shade{position:fixed;inset:0;background:rgba(0,0,0,.45);opacity:0;pointer-events:none;transition:opacity .25s;z-index:30}
  #shade.on{opacity:1;pointer-events:auto}
  #sheet{position:fixed;left:0;right:0;bottom:0;background:var(--card);border-radius:22px 22px 0 0;border-top:1px solid var(--line);padding:10px 16px calc(18px + env(safe-area-inset-bottom));max-height:84vh;overflow:auto;transform:translateY(105%);transition:transform .3s cubic-bezier(.2,.9,.3,1);z-index:31}
  #sheet.on{transform:none}
  .grip{width:40px;height:4px;border-radius:999px;background:var(--line);margin:0 auto 12px}
  @media (prefers-reduced-motion: reduce){*{animation:none!important;transition:none!important}}
</style></head>
<body data-ch="auto2">
<header>
  <div class="hdrow">
    <div class="hd-l">
      <span class="logo" id="logoBox"></span>
      <div style="min-width:0"><h1 id="chTitle">Oddly Loop</h1><div class="sub" id="hd"><span class="dot live"></span>Connecting to the brain…</div></div>
    </div>
    <button class="icon" id="btnRefresh" aria-label="Refresh">⟳</button>
  </div>
  <div class="seg" id="chSel">
    <button data-ch="auto2" class="on">Oddly Loop</button>
    <button data-ch="data-lens">The Data Lens</button>
  </div>
</header>
<div class="wrap">
  <div id="s-vivo"></div>
  <div id="s-plan" class="hide"></div>
  <div id="s-meta" class="hide"></div>
  <div id="s-mas" class="hide"></div>
</div>
<div id="toast"></div>
<div id="shade"></div><div id="sheet"><div class="grip"></div><div id="sheetBody"></div></div>
<div class="nav">
  <button data-t="vivo" class="on"><span class="ic">🧠</span>Live</button>
  <button data-t="plan"><span class="ic">🗓️</span>Plan</button>
  <button data-t="meta"><span class="ic">🎯</span>Goal</button>
  <button data-t="mas"><span class="ic">⚙️</span>More</button>
</div>
<script>
  var tg=window.Telegram&&window.Telegram.WebApp;
  if(tg){ tg.ready(); tg.expand(); try{ tg.disableVerticalSwipes&&tg.disableVerticalSwipes(); }catch(e){} try{ tg.setHeaderColor&&tg.setHeaderColor("bg_color"); }catch(e){} }
  var INIT=tg?tg.initData:"";
  var ST={}, BR=null, curTab="vivo", curCh="auto2", planDay="tomorrow", refT=null, BUILD="__BUILD__";
  function el(id){return document.getElementById(id);}
  function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
  function num(n){ if(n==null||!isFinite(+n)) return "—"; n=+n; if(Math.abs(n)>=1e6) return (n/1e6).toFixed(Math.abs(n)>=1e7?0:1)+" M"; if(Math.abs(n)>=1e4) return Math.round(n/1e3)+" K"; return Math.round(n).toLocaleString("en"); }
  function api(path,opts){opts=opts||{};opts.headers=opts.headers||{};opts.headers["X-Init-Data"]=INIT;return fetch(path,opts);}
  function h(t){try{var H=tg&&tg.HapticFeedback;if(!H)return;if(t==="sel")H.selectionChanged();else if(t==="ok")H.notificationOccurred("success");else if(t==="err")H.notificationOccurred("error");else H.impactOccurred(t||"light");}catch(e){}}
  function toast(m){var t=el("toast");t.textContent=m;t.classList.add("show");setTimeout(function(){t.classList.remove("show");},2600);}
  function ago(iso){ var t=Date.parse(iso); if(!isFinite(t)) return "—"; var m=Math.round((Date.now()-t)/60000); if(m<1) return "now"; if(m<60) return m+" min ago"; var hh=Math.round(m/60); if(hh<48) return hh+" h ago"; return Math.round(hh/24)+" d ago"; }
  function inTime(iso){ var t=Date.parse(iso); if(!isFinite(t)) return "—"; var m=Math.round((t-Date.now())/60000); if(m<=0) return "now"; if(m<60) return "in "+m+" min"; return "in "+Math.round(m/60)+" h"; }
  function dayName(dateStr){ var d=new Date(dateStr+"T12:00:00Z"); return d.toLocaleDateString("en",{weekday:"long",day:"numeric",month:"short",timeZone:"UTC"}); }

  var CH={ "auto2":{name:"Oddly Loop"}, "data-lens":{name:"The Data Lens"} };
  var LOGOS={
    "auto2":'<svg viewBox="0 0 44 44" fill="none"><path d="M22 22 C22 11 10 11 10 22 C10 33 22 33 22 22 C22 11 34 11 34 22 C34 33 22 33 22 22Z" stroke="#04140d" stroke-width="4.5" stroke-linecap="round"/></svg>',
    "data-lens":'<svg viewBox="0 0 44 44" fill="none"><circle cx="22" cy="22" r="15" stroke="#0f1a00" stroke-width="3.5"/><rect x="16" y="21" width="3.4" height="7" rx="1.4" fill="#0f1a00"/><rect x="20.4" y="17" width="3.4" height="11" rx="1.4" fill="#0f1a00"/><rect x="24.8" y="13.5" width="3.4" height="14.5" rx="1.4" fill="#0f1a00"/></svg>'
  };
  function applyChannelTheme(ch){ document.body.setAttribute("data-ch",ch); el("logoBox").innerHTML=LOGOS[ch]; el("chTitle").textContent=CH[ch].name; }

  var STATUS={
    planeado:["p-plan","Planned"], produciendo:["p-prod","Producing"], programado:["p-prog","Ready · auto-publishes"],
    publicado:["p-pub","Published"], sin_tiempo:["p-late","No time"], vencido:["p-miss","Expired"]
  };
  function stPill(s){ var x=STATUS[s]||["p-none",s]; return '<span class="pill '+x[0]+'">'+(s==="produciendo"?'<span class="dot live" style="width:6px;height:6px;background:var(--am)"></span>':'')+x[1]+'</span>'; }
  var FEAS={ cumplido:["ok","p-ok","Met"], en_camino:["ok","p-ok","On track"], midiendo:["warn","p-warn","Measuring pace"], en_riesgo:["warn","p-warn","At risk"], improbable:["bad","p-bad","Unlikely at current pace"], sin_dato:["warn","p-none","No data"] };
  function feasPill(s){ var x=FEAS[s]||FEAS.sin_dato; return '<span class="pill '+x[1]+'">'+x[2]+'</span>'; }
  var VERD={ ACERTO:["p-ok","Hit"], FALLO:["p-bad","Miss"], INCONCLUSO:["p-warn","Inconclusive"], PENDIENTE:["p-plan","Pending review"] };
  function verdPill(s){ var x=VERD[s]||["p-none",s]; return '<span class="pill '+x[0]+'">'+x[1]+'</span>'; }

  function live(){ return (BR&&BR.live)||null; }
  function ypp(ch){ var m=BR&&BR.monetization&&BR.monetization.channels&&BR.monetization.channels[ch]; return m?m.ypp:null; }
  function skeleton(){ return '<div class="card"><div class="sk" style="width:60%"></div><div class="sk" style="width:85%"></div><div class="sk" style="width:40%"></div></div>'; }

  // ============ LIVE ============
  function mindCard(L){
    var cyc=L?('<span>Last cycle '+ago(L.at)+'</span><span>Next '+inTime(L.next_cycle_at)+'</span>'):'<span>No cycle yet</span>';
    var t=L?(L.producing_now&&L.producing_now.length?"Producing "+L.producing_now.length+" piece"+(L.producing_now.length>1?"s":"")+" for tomorrow":"Tomorrow's plan ready, reviewed every 2 hours"):"Waiting for the brain's first cycle";
    return '<div class="mind"><div class="row" style="justify-content:flex-start;gap:8px"><span class="dot live"></span><span class="muted" style="font-weight:700">Brain active 24/7</span></div><div class="t" style="margin-top:8px">'+esc(t)+'</div><div class="meta">'+cyc+'</div></div>';
  }
  function nowCard(L){
    var p=(L&&L.producing_now)||[];
    if(!p.length) return '<h2>Right now</h2><div class="card muted">Nothing in production this cycle. Pieces are only made with at least 3 hours of margin before their slot.</div>';
    return '<h2>Right now <span class="cnt">'+p.length+'</span></h2><div class="card">'+p.map(function(x,i){
      return '<div class="row" style="align-items:flex-start;'+(i?'border-top:1px solid var(--line);padding-top:10px;margin-top:10px':'')+'"><div style="min-width:0"><b>'+esc(x.niche_label)+'</b><div class="muted">At '+esc(x.slot_et)+' ET · '+(x.idea?esc(x.idea.text):'current niche pattern')+'</div>'+(x.experiment?'<div style="margin-top:5px"><span class="pill p-plan">Experiment · '+esc(x.experiment.arm==="question"?"question":"assertion")+' arm</span></div>':'')+'</div>'+stPill("produciendo")+'</div>';
    }).join("")+'</div>';
  }
  function tomorrowPreview(L){
    if(!L||!L.tomorrow) return "";
    var T=L.tomorrow, s=T.summary||{};
    var items=(T.items||[]).slice(0,5);
    return '<h2>Tomorrow · '+esc(dayName(T.date))+' <span class="cnt">'+(T.items||[]).length+'</span></h2><div class="card tap" data-go="plan"><div class="counts">' +
      (s.programado?stPill("programado")+' <b class="num">'+s.programado+'</b>':'')+(s.produciendo?' '+stPill("produciendo")+' <b class="num">'+s.produciendo+'</b>':'')+(s.planeado?' '+stPill("planeado")+' <b class="num">'+s.planeado+'</b>':'')+
      '</div><div class="tl">'+items.map(function(i){ return '<div class="tli s-'+i.status+'"><div class="row"><span class="when">'+esc(i.slot_et)+' ET</span>'+stPill(i.status)+'</div><div class="what">'+esc(i.niche_label)+(i.experiment?' · <span class="muted">experiment</span>':'')+'</div></div>'; }).join("")+
      '</div><div class="muted" style="margin-top:8px">See the full plan and the why behind each piece ›</div></div>';
  }
  var KIND={ selfReview:"🔍", plan:"🗺️", production:"⚙️", cycle:"⏱️" };
  function feedCard(){
    var j=((BR&&BR.journal)||[]).slice().reverse().slice(0,10);
    if(!j.length) return '<h2>What I thought</h2><div class="card muted">The journal starts with the first cycle.</div>';
    return '<h2>What I thought</h2><div class="card feed">'+j.map(function(x){ return '<div class="fi"><div class="ic">'+(KIND[x.kind]||"•")+'</div><div><div class="tx">'+esc(x.text)+'</div><div class="ts">'+ago(x.at)+'</div></div></div>'; }).join("")+'</div>';
  }
  function knowCard(L){
    var k=L&&L.tomorrow&&L.tomorrow.knowledge; if(!k) return "";
    function box(cls,title,arr,empty){ return '<div class="kb '+cls+'"><b>'+title+'</b>'+(arr&&arr.length?'<ul>'+arr.slice(0,4).map(function(x){return '<li>'+esc(x)+'</li>';}).join("")+'</ul>':'<div class="muted">'+empty+'</div>')+'</div>'; }
    return '<h2>How confidently it decides</h2><div class="know">'+box("sabe","Knows",k.sabe,"Nothing confirmed yet")+box("cree","Believes",k.cree,"No strong beliefs")+box("desc","Unknown",k.desconoce,"—")+box("comp","Testing",k.comprobando,"No active experiment")+'</div>';
  }
  function goalStrip(ch){
    var y=ypp(ch); if(!y) return "";
    var f=FEAS[y.feasibility]||FEAS.sin_dato;
    return '<div class="card tap" data-go="meta"><div class="row"><div><b>Year goal: '+(y.goal_tier==="expanded"?"intermediate tier":"full monetization")+'</b><div class="muted">'+y.days_left+' days left'+(y.goal_tier==="expanded"?' · pace reviewed at 28 days':'')+'</div></div>'+feasPill(y.feasibility)+'</div></div>';
  }
  function vivoDataLens(){
    var D=live()&&live().data_lens;
    if(D&&D.paused){
      var since=String(D.since||"").slice(0,10), rev=String(D.review_at||"").slice(0,10);
      var best=D.best_views_so_far, tgt=D.target_views_7d||500;
      var pct=best!=null?Math.min(100,Math.round(best/tgt*100)):0;
      var st=D.status==="PENDIENTE"?'<span class="pill p-plan">Review on '+esc(rev)+'</span>':verdPill(D.status);
      return '<div class="banner warn"><div class="row"><div class="bt">Paused since '+esc(since)+'</div>'+st+'</div><div class="muted" style="margin-top:6px">Your decision, recorded in the brain. Daily production is off; only '+esc(D.experiment)+' runs.</div></div>'+
        '<h2>Reactivation experiment</h2><div class="card"><div class="row"><b>Best result since the pause</b><span class="muted num">'+(D.inventory_loaded?(best!=null?num(best)+" / "+num(tgt)+" views":"no experiments yet"):"inventory not loaded")+'</span></div><div class="bar"><i style="width:'+Math.max(1,pct)+'%"></i></div>'+
        '<div class="chain" style="margin-top:12px"><div><span class="k">Criterion</span><span>'+esc(D.criterion)+'</span></div><div><span class="k">Review</span><span>'+esc(rev)+'</span></div><div><span class="k">If met</span><span>That format resumes</span></div><div><span class="k">If not</span><span>Closing the channel is evaluated</span></div></div>'+
        (D.verdict_note?'<div class="muted" style="margin-top:8px">'+esc(D.verdict_note)+'</div>':'')+'</div>'+goalStrip("data-lens");
    }
    var y=ypp("data-lens");
    return '<div class="banner warn"><div class="bt">No live plan for this channel</div><div class="muted" style="margin-top:6px">The Data Lens has no traction: 0 subscribers and around 100 views per week after 10 weeks. The brain builds no daily plan here to avoid spending production without signal.</div></div>'+
      '<h2>Decision pending from you</h2><div class="card"><div class="chain">'+
      '<div><span class="k">Decision</span><span>Pause daily production and keep 1 experiment per week</span></div>'+
      '<div><span class="k">Reason</span><span>10 weeks without subscribers; resources pay off more on Oddly</span></div>'+
      '<div><span class="k">Criterion</span><span>If an experiment beats 500 views in 7 days, the winning format resumes</span></div>'+
      '<div><span class="k">Deadline</span><span>21 days</span></div></div></div>'+goalStrip("data-lens");
  }
  function vivoHtml(){
    if(curCh==="data-lens") return vivoDataLens();
    if(!BR) return skeleton()+skeleton();
    var L=live();
    return mindCard(L)+nowCard(L)+tomorrowPreview(L)+goalStrip("auto2")+feedCard()+knowCard(L);
  }

  // ============ PLAN ============
  function planHtml(){
    if(curCh==="data-lens") return '<div class="card muted" style="margin-top:14px">The Data Lens is paused: there is no daily plan. Only 1 experiment per week runs; its progress is under Live.</div>';
    if(!BR) return skeleton();
    var L=live(); if(!L) return '<div class="card muted" style="margin-top:14px">The first plan appears after the brain\'s first cycle (every 2 hours).</div>';
    var P=L[planDay]||{items:[]}, s=P.summary||{};
    var sw='<div class="daysw"><button data-day="today" class="'+(planDay==="today"?"on":"")+'">Today</button><button data-day="tomorrow" class="'+(planDay==="tomorrow"?"on":"")+'">Tomorrow</button></div>';
    var head='<div class="card"><div class="row"><div><b style="text-transform:capitalize">'+esc(dayName(P.date||""))+'</b><div class="muted">'+(P.items||[]).length+' Shorts · '+(P.per_slot||1)+' per slot'+(P.trimmed?' · trimmed '+P.trimmed+' that don\'t fit':'')+'</div></div></div><div class="counts">'+
      ["publicado","programado","produciendo","planeado","sin_tiempo","vencido"].filter(function(k){return s[k];}).map(function(k){return stPill(k)+' <b class="num">'+s[k]+'</b>';}).join(" ")+'</div></div>';
    if(!(P.items||[]).length) return sw+head+'<div class="card muted">No pieces in this day\'s plan.</div>';
    var list=P.items.map(function(i,idx){
      return '<div class="card tap" data-item="'+idx+'"><div class="plan-item"><div class="hh">'+esc(i.slot_et)+'<small>ET</small></div><div style="min-width:0"><div class="row"><b>'+esc(i.niche_label)+'</b>'+stPill(i.status)+'</div>'+
        (i.title?'<div class="muted" style="margin-top:3px">'+esc(i.title)+'</div>':'')+
        (i.idea?'<div class="muted" style="margin-top:3px">💡 '+esc(i.idea.text)+'</div>':'')+
        '<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">'+(i.experiment?'<span class="pill p-plan">Experiment · '+esc(i.experiment.arm==="question"?"question":"assertion")+'</span>':'')+'<span class="pill">Confidence '+esc(i.confidence)+'</span></div></div></div></div>';
    }).join("");
    var expLabel=""; if(P.experiment){ (P.items||[]).forEach(function(i){ if(!expLabel&&i.niche===P.experiment.niche) expLabel=i.niche_label; }); }
    var exp=P.experiment?'<h2>Experiment of the day</h2><div class="card"><b>Hook: question vs assertion</b><div class="muted" style="margin-top:4px">'+esc(P.experiment.hypothesis||"")+'</div><div class="muted" style="margin-top:6px">Only the hook changes, and only in '+esc(expLabel||P.experiment.niche)+'. Everything else stays the same so the result can be attributed.</div></div>':'';
    return sw+head+exp+'<h2>Pieces</h2>'+list;
  }
  function itemSheet(idx){
    var L=live(); if(!L) return; var i=(L[planDay].items||[])[idx]; if(!i) return;
    var r=i.record||{};
    var rows=[["Decision",r.decision],["Reason",r.reason],["Evidence",r.evidence],["Action",r.action],["Metric",r.metric],["Deadline",r.deadline],["Success criterion",r.criterion],["Next",r.next]];
    var html='<div class="row"><b style="font-size:17px">'+esc(i.slot_et)+' ET · '+esc(i.niche_label)+'</b>'+stPill(i.status)+'</div>'+
      (i.video_id?'<div class="muted" style="margin-top:6px">'+esc(i.title||"")+' · <a href="https://youtu.be/'+esc(i.video_id)+'" target="_blank" style="color:var(--acc)">open</a></div>':'')+
      '<h2 style="margin-top:16px">Why this piece</h2><div class="chain">'+rows.map(function(x){return '<div><span class="k">'+x[0]+'</span><span>'+esc(x[1]||"—")+'</span></div>';}).join("")+'</div>'+
      '<button class="btn ghost" data-close="1" style="margin-top:16px">Close</button>';
    openSheet(html);
  }

  // ============ GOAL ============
  function reqRow(r){
    var hasPace=r.status!=="cumplido"&&r.per_day_actual!=null&&r.per_day_needed!=null;
    return '<div class="req"><div class="row"><span style="font-size:13.5px;font-weight:700">'+esc(r.label)+'</span>'+feasPill(r.status)+'</div>'+
      (r.cur==null?'<div class="muted" style="margin-top:4px">The YouTube API did not deliver this data. It is not substituted with totals.</div>':
      '<div class="row" style="margin-top:4px"><span class="num" style="font-weight:800">'+num(r.cur)+' <span class="muted">/ '+num(r.target)+'</span></span><span class="muted num">'+(r.pct!=null?r.pct+" %":"")+'</span></div><div class="bar"><i style="width:'+Math.max(1,Math.min(100,r.pct||0))+'%"></i></div>'+
      (hasPace?'<div class="pace"><div><div class="k">Actual pace'+(r.pace_source==="28d"?' (28 days)':'')+'</div><div class="v num">'+num(r.per_day_actual)+'/day</div></div><div><div class="k">Needed</div><div class="v num">'+num(r.per_day_needed)+'/day</div></div></div>':''))+
      (r.window?'<div class="muted" style="margin-top:5px">Rolling '+r.window+'-day window</div>':'')+'</div>';
  }
  function tierCard(t,title){
    if(!t) return "";
    var best=(t.options||[]).filter(function(o){return o.key===t.best_option;})[0];
    return '<div class="card"><div class="row"><b>'+title+'</b>'+feasPill(t.status)+'</div>'+(t.reqs||[]).map(reqRow).join("")+(best?reqRow(best):"")+
      ((t.options||[]).length>1?'<div class="muted" style="margin-top:8px">Only one option is enough: Shorts views or watch hours without Shorts. The closest one is shown.</div>':'')+'</div>';
  }
  function ledgerCard(){
    var led=(BR&&BR.ledger)||[]; var hr=live()&&live().ledger&&live().ledger.hit_rate;
    var judged=led.filter(function(e){return e.status==="ACERTO"||e.status==="FALLO";});
    var head='<div class="row"><b>Self-critique</b><span class="muted num">'+(hr&&hr.rate!=null?Math.round(hr.rate*100)+"% hit rate over "+hr.judged:"no judged decisions yet")+'</span></div><div class="muted" style="margin-top:4px">Every decision stores its prediction and is judged on its date against its own criterion. Two misses in a row revert the rule.</div>';
    if(!led.length) return '<h2>Decisions</h2><div class="card">'+head+'</div>';
    return '<h2>Decisions <span class="cnt">'+led.length+'</span></h2><div class="card">'+head+led.slice().reverse().slice(0,8).map(function(e){
      return '<div class="req"><div class="row" style="align-items:flex-start"><span style="font-size:13px;font-weight:700">'+esc(e.decision)+'</span>'+verdPill(e.status)+'</div><div class="muted" style="margin-top:3px">'+(e.status==="PENDIENTE"?"Review on "+esc(String(e.review_at||"").slice(0,10))+" · criterion "+esc(e.metric)+" "+esc(e.criterion&&e.criterion.op)+" "+esc(e.criterion&&e.criterion.value):esc(e.verdict_note||""))+'</div></div>';
    }).join("")+'</div>';
  }
  function allocCard(){
    var d=BR&&BR.decision; if(!d||!d.candidates) return "";
    var g=d.scale_gate||{};
    return '<h2>Allocation being executed <span class="cnt">'+esc(d.total||"")+'/day</span></h2><div class="card"><table><tr><th>Niche</th><th class="num" style="text-align:right">Slots</th><th>Why</th></tr>'+
      d.candidates.map(function(c){return '<tr><td><b>'+esc(c.label)+'</b></td><td class="num" style="text-align:right"><b>'+c.slots+'</b></td><td class="muted">'+esc(c.why)+'</td></tr>';}).join("")+'</table>'+
      '<div class="muted" style="margin-top:10px">Scale up: '+(g.status==="permitido"?'<span class="pill p-ok">allowed</span>':g.status==="bloqueado"?'<span class="pill p-bad">blocked</span>':'<span class="pill p-warn">no data</span>')+' '+esc(g.reason||"")+'</div></div>';
  }
  function qualityCard(ch){
    var m=BR&&BR.monetization&&BR.monetization.channels&&BR.monetization.channels[ch]; var q=m&&m.data_quality; if(!q) return "";
    var av=q.availability||{}; var names={shorts_views_90d:"Shorts views 90 days",watch_hours_365d:"Watch hours 365 days",subs:"Subscribers",traffic_28d:"Traffic sources",impressions_28d:"Impressions & CTR"};
    var rows=Object.keys(names).map(function(k){ var ok=av[k]; return '<div class="row" style="padding:5px 0"><span style="font-size:13px">'+names[k]+'</span>'+(ok===true?'<span class="pill p-ok">measured</span>':ok===false?'<span class="pill p-bad">unavailable</span>':'<span class="pill p-none">unmeasured</span>')+'</div>'; }).join("");
    return '<h2>Data quality</h2><div class="card">'+rows+(q.snapshot_at?'<div class="muted" style="margin-top:6px">Measured '+ago(q.snapshot_at)+' · Analytics runs about 3 days behind</div>':'')+'</div>';
  }
  function goalPlanCard(){
    var G=live()&&live().oddly_goal; if(!G) return "";
    var rv=G.review, hx=G.hook_experiments||[];
    var h='<div class="row"><b>Milestone strategy</b><span class="pill p-plan">Decided on '+esc(G.decided_at)+'</span></div>';
    h+='<div class="muted" style="margin-top:6px">Most slots for the leading niche and a different hook pair each week, judged with views at day 7.</div>';
    if(rv) h+='<div class="req"><div class="row" style="align-items:flex-start"><span style="font-size:13px;font-weight:700">Double the Shorts pace in 28 days</span>'+verdPill(rv.status)+'</div><div class="muted num" style="margin-top:3px">From '+num(rv.baseline)+' to '+num(rv.target_pace)+' views per day · reviewed on '+esc(String(rv.review_at).slice(0,10))+'</div></div>';
    hx.slice().reverse().forEach(function(x){
      var v=x.videos||{}, arms=x.arms||[], lb=x.labels||[];
      h+='<div class="req"><div class="row" style="align-items:flex-start"><span style="font-size:13px;font-weight:700">Hooks '+esc(x.week||"")+'</span>'+verdPill(x.status)+'</div><div class="muted num" style="margin-top:3px">'+arms.map(function(a,i){return esc(lb[i]||a)+': '+(v[a]||0)+' videos';}).join(" · ")+(x.winner?' · won '+esc(lb[arms.indexOf(x.winner)]||x.winner):'')+'</div></div>';
    });
    return '<div class="card">'+h+'</div>';
  }
  function metaHtml(){
    if(!BR) return skeleton()+skeleton();
    var y=ypp(curCh);
    if(!y) return '<div class="card muted" style="margin-top:14px">Per-window requirement measurement runs daily at 15:30 UTC.</div>';
    var f=FEAS[y.feasibility]||FEAS.sin_dato;
    var msg={improbable:"At the current pace, it is not reached before "+y.deadline+". "+(y.goal_tier==="expanded"?"Strategy underway: most slots to the leading niche and a different hook pair each week.":"The strategy needs to change, not just produce more."),en_riesgo:"It can be reached, but the current pace leaves no margin.",en_camino:"The current pace gets there before the deadline.",cumplido:"Requirements met: only the YouTube review is left.",sin_dato:"Not enough data to judge viability.",midiendo:"Not enough history yet to measure the pace."}[y.feasibility]||"";
    var out='<div class="banner '+f[0]+'"><div class="row"><div class="bt">'+f[2]+'</div><span class="muted">'+y.days_left+' days left</span></div><div class="muted" style="margin-top:6px">'+esc(msg)+'</div></div>';
    if(y.goal_tier==="expanded") out+=goalPlanCard()+tierCard(y.tiers&&y.tiers.expanded,"Year goal · Intermediate tier")+tierCard(y.tiers&&y.tiers.full,"Long term · Full monetization");
    else out+=tierCard(y.tiers&&y.tiers.expanded,"Intermediate tier")+tierCard(y.tiers&&y.tiers.full,"Full monetization");
    if(curCh==="auto2") out+=allocCard()+ledgerCard();
    out+=qualityCard(curCh);
    out+='<div class="muted" style="margin:10px 2px">Public program thresholds. Confirm them in YouTube Studio for your country.</div>';
    return out;
  }

  // ============ MORE ============
  function videosCard(){
    var list=curCh==="auto2"?((ST.auto2&&ST.auto2.list)||[]):(ST.all_videos||[]);
    var pub=list.filter(function(v){return v.privacy==="public";}).slice(0,8);
    if(!pub.length) return '<h2>Recently published</h2><div class="card muted">No published videos in the loaded inventory.</div>';
    return '<h2>Recently published</h2><div class="card">'+pub.map(function(v){ return '<div class="vrow"><img loading="lazy" alt="" src="https://i.ytimg.com/vi/'+esc(v.video_id)+'/mqdefault.jpg"><div style="min-width:0"><div class="vt">'+esc(v.title||"")+'</div><div class="muted num">'+num(v.views)+' views'+(v.niche_label?' · '+esc(v.niche_label):'')+'</div></div></div>'; }).join("")+'</div>';
  }
  function masHtml(){
    var t=ST.tools_health||{}, prob=(ST.problems||[]).length;
    return videosCard()+
      '<h2>Health</h2><div class="card"><div class="row"><span>Tools</span><span class="pill '+(t.down>0?"p-warn":"p-ok")+'">'+(t.tools&&t.tools.length?(t.ok+"/"+t.total+" OK"):"OK")+'</span></div><div class="row" style="margin-top:8px"><span>Problems</span><span class="pill '+(prob?"p-bad":"p-ok")+'">'+prob+'</span></div></div>'+
      '<h2>Tools</h2><div class="card"><div class="muted" style="margin-bottom:8px">Unpublish a video (becomes private and hidden, reversible).</div><input type="text" id="unpubId" placeholder="YouTube video ID"><div class="row" style="margin-top:8px;gap:8px;justify-content:flex-start"><button class="btn mini ghost" data-unpub="data-lens">Data Lens</button><button class="btn mini ghost" data-unpub="auto2">Oddly</button></div></div>'+
      '<div class="card"><b>My Clips</b><div class="muted" style="margin:3px 0 8px">Upload your clip (max ~100 MB). AI handles the SEO and it goes out on Oddly at its best time.</div><input type="text" id="clipCap" placeholder="Optional title hint (max 300)"><label class="file" for="fClip">🎬 Choose video</label><input id="fClip" type="file" accept="video/*" class="hide"></div>'+
      '<div class="muted" style="text-align:center;margin:12px 0">Video Forge · build '+esc(BUILD)+'</div>';
  }

  // ============ Render / navigation ============
  function headerLine(){
    var hd=el("hd"); if(!hd) return;
    if(ST.error){ hd.innerHTML=esc(ST.error); return; }
    var L=live();
    hd.innerHTML='<span class="dot live"></span>'+(curCh==="auto2"?(L?"Thought "+ago(L.at)+" · next cycle "+inTime(L.next_cycle_at):"Live brain"):"No live plan · decision pending");
  }
  function render(){
    headerLine();
    var map={vivo:vivoHtml,plan:planHtml,meta:metaHtml,mas:masHtml};
    var sec=el("s-"+curTab); if(!sec) return;
    try{ sec.innerHTML=map[curTab](); }catch(e){ sec.innerHTML='<div class="card muted">Could not render this view.</div>'; }
    sec.classList.remove("fadein"); void sec.offsetWidth; sec.classList.add("fadein");
    try{ if(tg&&tg.MainButton){ tg.MainButton.hide(); } }catch(e){}
  }
  function tab(name){
    curTab=name; ["vivo","plan","meta","mas"].forEach(function(t){ el("s-"+t).classList.toggle("hide",t!==name); });
    document.querySelectorAll(".nav button").forEach(function(b){ b.classList.toggle("on",b.getAttribute("data-t")===name); });
    h("sel"); render(); backSync(); window.scrollTo(0,0);
  }
  function setChannel(ch){ curCh=ch; applyChannelTheme(ch); document.querySelectorAll(".seg button").forEach(function(b){ b.classList.toggle("on",b.getAttribute("data-ch")===ch); }); h("sel"); render(); backSync(); }
  var sheetOpen=false;
  var FROM_OS=/[?&]from=os/.test(location.search);
  function backSync(){ try{ if(!tg||!tg.BackButton) return; if(sheetOpen||curTab!=="vivo"||FROM_OS) tg.BackButton.show(); else tg.BackButton.hide(); }catch(e){} }
  try{ tg&&tg.BackButton&&tg.BackButton.onClick(function(){ if(sheetOpen){ closeSheet(); return; } if(curTab!=="vivo"){ tab("vivo"); return; } if(FROM_OS) location.href="/os"; }); }catch(e){}
  backSync();
  function openSheet(html){ el("sheetBody").innerHTML=html; el("shade").classList.add("on"); el("sheet").classList.add("on"); sheetOpen=true; h("light"); backSync(); }
  function closeSheet(){ el("shade").classList.remove("on"); el("sheet").classList.remove("on"); sheetOpen=false; backSync(); }
  document.addEventListener("click",function(ev){
    var t=ev.target.closest("[data-t]"); if(t&&t.closest(".nav")){ tab(t.getAttribute("data-t")); return; }
    var c=ev.target.closest("[data-ch]"); if(c&&c.closest(".seg")){ setChannel(c.getAttribute("data-ch")); return; }
    var g=ev.target.closest("[data-go]"); if(g){ tab(g.getAttribute("data-go")); return; }
    var d=ev.target.closest("[data-day]"); if(d){ planDay=d.getAttribute("data-day"); h("sel"); render(); return; }
    var it=ev.target.closest("[data-item]"); if(it){ itemSheet(+it.getAttribute("data-item")); return; }
    if(ev.target.closest("[data-close]")||ev.target.id==="shade"){ closeSheet(); return; }
    var u=ev.target.closest("[data-unpub]"); if(u){ unpublish(u.getAttribute("data-unpub")); return; }
    if(ev.target.closest("#btnRefresh")){ h("light"); load(true); }
  });
  function uploadClip(f){ if(!f) return;
    if(f.size>100*1024*1024){ h("err"); toast("That clip is "+Math.round(f.size/1048576)+" MB. Max ~100 MB."); return; }
    var cap=encodeURIComponent(((el("clipCap")&&el("clipCap").value)||"").slice(0,300));
    h("medium"); toast("Uploading clip ("+Math.round(f.size/1048576)+" MB)…");
    api("/api/upload-clip?caption="+cap,{method:"POST",headers:{"content-type":f.type||"video/mp4"},body:f})
      .then(function(r){return r.json();}).then(function(j){ if(j.ok){ h("ok"); toast("Clip received. It goes out on its own at its best time."); if(el("clipCap")) el("clipCap").value=""; } else { h("err"); toast(j.error||"Could not upload"); } })
      .catch(function(){ h("err"); toast("No connection: clip not uploaded"); });
  }
  document.addEventListener("change",function(ev){ var t=ev.target; if(t&&t.id==="fClip"){ uploadClip(t.files&&t.files[0]); t.value=""; } });
  function unpublish(ch){
    var id=(el("unpubId")&&el("unpubId").value||"").trim(); if(!/^[\\w-]{6,}$/.test(id)){ toast("Paste a valid video ID"); return; }
    if(tg&&tg.showConfirm){ tg.showConfirm("Unpublish "+id+" on "+CH[ch].name+"? It becomes private and hidden (reversible).",function(ok){ if(ok) doUnpub(ch,id); }); } else if(confirm("Unpublish "+id+"?")) doUnpub(ch,id);
  }
  function doUnpub(ch,id){
    api("/api/dispatch",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({workflow:"youtube_unpublish.yml",inputs:{video_id:id,channel:ch==="auto2"?"oddly":"data-lens"}})})
      .then(function(r){return r.json();}).then(function(j){ if(j.ok){ h("ok"); toast("Unpublishing "+id+". I'll notify you in chat."); } else { h("err"); toast(j.error||"Could not unpublish"); } }).catch(function(){ h("err"); toast("No connection"); });
  }

  // ============ Data ============
  function loadBrain(){ return api("/api/brain").then(function(r){return r.json();}).then(function(j){ if(!j.error){ BR=j; } }).catch(function(){}); }
  function scheduleRefresh(){ clearTimeout(refT); refT=setTimeout(function(){ load(false); },60000); }
  function load(withState){
    var typing=curTab==="mas"&&((el("clipCap")&&el("clipCap").value)||(el("unpubId")&&el("unpubId").value));
    var ps=api("/api/state").then(function(r){return r.json();}).then(function(j){
      if(j.error){ ST.error=(j.error==="no autorizado"?"Not authorized: open the app from the bot":"Error: "+(j.detail||j.error)); return; }
      if(j.build&&BUILD!=="__BUILD__"&&BUILD!=="dev"&&j.build!==BUILD){ try{ location.replace(location.pathname+"?from=os&v="+encodeURIComponent(j.build)); }catch(e){} return; }
      ST=j;
    }).catch(function(){ ST.error="No connection. Retrying in a minute."; });
    Promise.all([ps,loadBrain()]).then(function(){ if(!typing) render(); scheduleRefresh(); });
  }
  (function boot(){ el("s-vivo").innerHTML=skeleton()+skeleton(); })();
  applyChannelTheme(curCh);
  load(true);
</script>
</body></html>`;

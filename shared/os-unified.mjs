// os-unified.mjs — AI OS in ONE BOT (Video Forge hosts everything). The first thing Juan sees is THE BRAIN: what
// it decided, why, what it will do tomorrow, what it is thinking and what awaits him. Navigation with order:
//   Brain · Decisions · Systems · Activity   (fixed bottom bar)
//   Breadcrumb header ("Systems › Radar") + its own back button + Telegram's back button in sync.
//   Systems › <system> shows its status and opens its full panel (/p/<system>), which returns to the brain.
// Data: POST /API/os from the Video Forge bot -> { global, pulses{3}, brain{live, ledger, journal, decision}, clock }.
// Rules: HTML by concatenation (no backticks nor "${" inside strings), ES5 client, data-* events.
import { OS_HEAD, OS_CSS, OS_ICONS, OS_JS, OS_UI_VERSION } from "./os-ui.mjs";
import { OS_SHELL_CSS } from "./os-shell.mjs";

export const OS_UNIFIED_VERSION = "1.1.0";

export const OS_UNIFIED_CSS = `
body[data-sys="os"]{--os-acc:#A594FF;--os-acc-soft:rgba(165,148,255,.14);--os-acc-line:rgba(165,148,255,.35)}
html[data-theme="light"] body[data-sys="os"]{--os-acc:#6E56CF;--os-acc-soft:rgba(110,86,207,.10);--os-acc-line:rgba(110,86,207,.30)}
.os-top{align-items:center}
.os-crumb{display:flex;align-items:center;gap:8px;min-width:0}
.os-back{width:36px;height:36px;border-radius:10px;border:1px solid var(--os-border);background:var(--os-surface);color:var(--os-t1);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0}
.os-back svg{width:18px;height:18px;transform:rotate(180deg)}
.os-here{min-width:0}
.os-path{font-family:var(--os-mono);font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--os-t3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.os-path b{color:var(--os-acc);font-weight:500}
.os-name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.os-vpill{display:inline-flex;align-items:center;gap:6px;font-family:var(--os-mono);font-size:11px;padding:2px 8px;border-radius:999px;border:1px solid var(--os-border);white-space:nowrap}
.os-vpill.ok{color:var(--os-ok)}.os-vpill.bad{color:var(--os-bad)}.os-vpill.wait{color:var(--os-info)}.os-vpill.none{color:var(--os-t3)}
.os-dec{padding:12px 0;border-bottom:1px solid var(--os-hair);cursor:pointer}
.os-dec:active{opacity:.7}
.os-dec .top{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
.os-dec .kind{font-family:var(--os-mono);font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--os-t3)}
.os-dec .t{font-size:14.5px;font-weight:600;line-height:1.3;margin-top:2px;overflow-wrap:anywhere}
.os-dec .w{font-size:13px;color:var(--os-t2);margin-top:3px;overflow-wrap:anywhere}
.os-card{border:1px solid var(--os-border);background:var(--os-surface);border-radius:var(--os-r-card);padding:14px 16px;margin:8px 0;cursor:pointer}
.os-card:active{opacity:.8}
.os-card .h{display:flex;justify-content:space-between;gap:10px;align-items:baseline}
.os-card .t{font-weight:600;font-size:15px}
.os-card .m{font-size:13px;color:var(--os-t2);margin-top:4px;overflow-wrap:anywhere}
.os-bars{display:grid;gap:6px;margin-top:10px}
.os-bars div{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;font-size:13px;align-items:center}
.os-bars i{display:block;height:4px;border-radius:999px;background:var(--os-acc);margin-top:3px}
.os-think{display:grid;grid-template-columns:46px minmax(0,1fr);gap:10px;padding:7px 0;border-bottom:1px solid var(--os-hair);font-size:13.5px;overflow-wrap:anywhere}
.os-think:last-child{border-bottom:0}
.os-think .tm{font-family:var(--os-mono);font-size:11.5px;color:var(--os-t3);padding-top:1px}
.os-openpanel{margin:22px 0 6px}
.os-plan-row{display:grid;grid-template-columns:62px minmax(0,1fr) auto;gap:10px;padding:10px 0;border-bottom:1px solid var(--os-hair);font-size:13.5px;align-items:start}
.os-plan-row .tm{font-family:var(--os-mono);font-size:12px;color:var(--os-t2)}
.os-plan-row .n{font-weight:600}
.os-plan-row .d{font-size:12.5px;color:var(--os-t2);margin-top:2px;overflow-wrap:anywhere}
.os-seg{display:flex;gap:6px;margin:6px 0 4px}
.os-seg button{flex:1;height:34px;border-radius:10px;border:1px solid var(--os-border);background:var(--os-surface);color:var(--os-t2);font:600 13px var(--os-sans);cursor:pointer}
.os-seg button.on{border-color:var(--os-acc-line);color:var(--os-acc);background:var(--os-acc-soft)}
`;

export const OS_UNIFIED_JS = `
(function(){
  var C=window.OS_CFG,OS=window.OS,tg=OS.tg,E=OS.esc;
  var ST=null,ERR=null,LOADING=false,LAST=0,ANIM=true;
  var V={tab:"cerebro",sys:null};
  var SYSN={"video-forge":"Video Forge",viento:"Viento",radar:"Radar"};
  var SYSROLE={"video-forge":"Creates content","viento":"Grows the store","radar":"Improves the repos"};
  var PANEL={"video-forge":["/p/video-forge?from=os","Channels panel"],radar:["/p/radar?from=os","Repos panel"],viento:["/p/viento?from=os","Store panel"]};
  var TABS={cerebro:"Brain",decisiones:"Decisions",sistemas:"Systems",actividad:"Activity"};
  var STATUS_TXT={normal:"In order",attention:"Needs attention",degraded:"No signal",critical:"Critical"};
  var STATE_TXT={idle:"Idle",observing:"Observing",thinking:"Thinking",researching:"Researching",analyzing:"Analyzing",executing:"Executing",waiting:"Waiting",asking:"Asking you",completed:"Done",warning:"With warnings",failed:"Failed",paused:"Paused"};
  var TASK_TXT={QUEUED:"Queued",RUNNING:"Running",THINKING:"Thinking",WAITING:"Waiting",APPROVAL:"Waiting for your OK",COMPLETED:"Done",FAILED:"Failed",CANCELLED:"Cancelled"};
  var TASK_DOT={QUEUED:"idle",RUNNING:"executing",THINKING:"thinking",WAITING:"idle",APPROVAL:"asking",COMPLETED:"completed",FAILED:"failed",CANCELLED:"degraded"};
  var AUT_TXT={AUTO:"Automatic",REVIEW:"To review",APPROVAL:"Needs your approval",CRITICAL:"Critical"};
  var TRUST_TXT={suggested:"suggested",prepared:"prepared",executed:"done",approved:"approved by you"};
  var RISK_TXT={low:"Low",medium:"Medium",high:"High"};
  var LTYPE={niche_allocation:"Slot allocation",cadence_scale:"Production volume",channel_pause:"Channel pause",goal:"Year goal",hook_experiment:"Hook experiment",general:"Decision"};
  var PLAN_ST={planeado:["wait","Planned"],produciendo:["wait","Producing"],programado:["ok","Ready, publishes on its own"],publicado:["ok","Published"],sin_tiempo:["none","No time"],vencido:["bad","Gap"]};
  var OPS={">=":"at least",">":"more than","<=":"at most","<":"less than"};
  var METRIC={shorts_views_per_day_28d:"Shorts views per day (28-day pace)",hook_lift_pct:"Difference between the two hooks at day 7 (%)",top_niche_rel:"Leading niche performance vs the channel (x)",d7_change_pct:"Day-7 views change vs the previous week (%)",dl_best_views_7d:"Best experiment views at 7 days"};
  function nfmt(x){var n=Number(x);return isFinite(n)?n.toLocaleString("en-US"):String(x==null?"—":x);}
  var ACTIVE=["observing","thinking","researching","analyzing","executing","waiting","asking"];

  function plural(n,one,many){return n+" "+(n===1?one:many);}
  function fdate(iso){var d=new Date(iso);if(isNaN(d))return "—";try{return d.toLocaleDateString("en",{day:"numeric",month:"short"});}catch(e){return iso.slice(0,10);}}
  function chipSys(s){return '<span class="os-chip sys" data-c="'+E(s)+'">'+E(SYSN[s]||s)+'</span>';}
  function conf(c){return c&&c.basis?"Confidence "+Math.round(c.value*100)+"% · "+c.basis:"Confidence: not enough data";}
  function G(){return (ST&&ST.global)||{};}
  function B(){return (ST&&ST.brain)||{};}
  function needs(){return G().needs||[];}
  function pulseOf(s){return ST&&ST.pulses&&ST.pulses[s];}
  function ledger(){var l=(B().ledger||[]).slice();l.sort(function(a,b){return Date.parse(b.reviewed_at||b.at)-Date.parse(a.reviewed_at||a.at);});return l;}
  function vpill(e){
    if(e.status==="ACERTO")return '<span class="os-vpill ok">Hit</span>';
    if(e.status==="FALLO")return '<span class="os-vpill bad">Miss</span>';
    if(e.status==="INCONCLUSO")return '<span class="os-vpill none">No data</span>';
    return '<span class="os-vpill wait">Review '+E(fdate(e.review_at))+'</span>';
  }

  // ---------- Header: where am I ----------
  function crumbs(){
    if(V.sys)return ["Systems",SYSN[V.sys]];
    return [TABS[V.tab]];
  }
  function canBack(){return !!(V.sys||V.tab!=="cerebro");}
  function topHtml(){
    var c=crumbs(),path=c.length>1?E(c[0])+' › <b>'+E(c[1])+'</b>':'<b>'+E(c[0])+'</b>';
    var live=B().live,line;
    if(!ST)line=ERR?"No connection":"Connecting…";
    else if(V.sys){var p=pulseOf(V.sys);line=p?(p.stale?"No signal "+OS.ago(p.at):SYSROLE[V.sys]+" · "+OS.ago(p.at)):"No signal";}
    else line=live&&live.at?"Last brain cycle "+OS.ago(live.at):"Brain has no recorded cycle";
    var title=V.sys?SYSN[V.sys]:(V.tab==="cerebro"?"The brain":TABS[V.tab]);
    return '<div class="os-crumb">'+(canBack()?'<button class="os-back" data-act="back" aria-label="Back">'+OS.icon("chev")+'</button>':'<div class="os-mark">'+OS.icon("ask")+'</div>')+
      '<div class="os-here"><div class="os-path">'+path+'</div><div class="os-name">'+E(title)+'</div><div class="os-ai">'+E(line)+'</div></div></div>'+
      '<button class="os-iconbtn" data-act="refresh" aria-label="Refresh">'+OS.icon("refresh")+'</button>';
  }

  // ---------- Piezas ----------
  function needHtml(n){
    return '<div class="os-need tap" data-need="'+E(n.id)+'" data-sev="'+E(n.severity)+'"><div class="h"><div class="t">'+E(n.title)+'</div>'+chipSys(n.system)+'</div>'+(n.why?'<div class="w">'+E(n.why)+'</div>':"")+'<div class="e">'+E(AUT_TXT[n.autonomy]||n.autonomy)+(n.evidence?" · "+E(n.evidence):"")+'</div></div>';
  }
  function decHtml(e){
    return '<div class="os-dec" data-led="'+E(e.id)+'"><div class="top"><div><div class="kind">'+E(LTYPE[e.type]||"Decision")+' · '+E(OS.ago(e.at))+'</div><div class="t">'+E(e.decision)+'</div></div>'+vpill(e)+'</div>'+(e.reason?'<div class="w">'+E(e.reason)+'</div>':"")+'</div>';
  }
  function metricHtml(m){
    var chg=m.change_pct==null?"":'<span class="chg '+(m.change_pct>=0?"up":"down")+'">'+OS.pct(m.change_pct)+'</span>';
    var val=m.value==null?"—":(m.unit==="COP"?"$"+Math.round(m.value).toLocaleString("en-US"):OS.num(m.value));
    return '<div class="os-metric"><div class="k">'+E(m.label)+(m.timeframe?" · "+E(m.timeframe):"")+'</div><div class="v"><span class="val os-num">'+E(val)+'</span>'+chg+'</div>'+(m.context?'<div class="ctx">'+E(m.context)+'</div>':"")+((m.series||[]).length>1?OS.sparkline(m.series,{label:m.label}):"")+(m.interpretation?'<div class="ai">'+E(m.interpretation)+'</div>':"")+'</div>';
  }
  function insightHtml(i){return '<div class="os-insight"><div class="what">'+E(i.what)+'</div>'+(i.why?'<div class="why">'+E(i.why)+'</div>':"")+(i.impact?'<div class="why">'+E(i.impact)+'</div>':"")+(i.action?'<div class="do">'+E(i.action)+'</div>':"")+'<div class="conf">'+E(conf(i.confidence))+'</div></div>';}
  function actHtml(a,showSys){return '<div class="os-act"><div class="tm os-num">'+E(OS.hhmm(a.at))+'</div><div><div>'+E(a.text)+'</div><div class="ag">'+(showSys&&a.system?E(SYSN[a.system]||"")+" · ":"")+E(a.agent||"")+(TRUST_TXT[a.trust]?" · "+E(TRUST_TXT[a.trust]):"")+" · "+E(OS.ago(a.at))+'</div></div></div>';}
  function taskHtml(t){var meta=[t.agent,t.started?OS.ago(t.started):""].filter(function(x){return x;}).join(" · ");return '<div class="os-row'+(t.url?" tap":"")+'"'+(t.url?' data-open="'+E(t.url)+'"':"")+'>'+OS.dot(TASK_DOT[t.status]||"idle")+'<div class="main"><div class="title">'+E(t.name)+'</div><div class="meta">'+E(meta)+'</div></div><div class="end">'+E(TASK_TXT[t.status]||t.status)+'</div></div>';}
  function sysRow(s){var p=pulseOf(s.system)||s;return '<div class="os-row tap" data-sys="'+E(s.system)+'"><span class="os-sysbar" data-c="'+E(s.system)+'"></span>'+OS.dot(s.status)+'<div class="main"><div class="title">'+E(s.name)+'<span class="os-role">'+E(SYSROLE[s.system]||"")+'</span></div><div class="meta">'+E(s.headline)+'</div></div><div class="end">'+(s.needs?'<span class="os-badge" style="position:static;margin:0">'+s.needs+'</span> ':'')+'</div>'+OS.icon("chev","os-chev")+'</div>';}
  function dayItems(d){return (d&&d.items)||[];}
  function daySummary(d){
    var it=dayItems(d);if(!it.length)return "No plan";
    var by={},order=[];it.forEach(function(x){var k=x.niche_label||x.niche;if(!by[k]){by[k]=0;order.push(k);}by[k]++;});
    order.sort(function(a,b){return by[b]-by[a];});
    return plural(it.length,"Short","Shorts")+": "+order.map(function(k){return by[k]+" "+k;}).join(" · ");
  }

  // ---------- Vistas ----------
  function cerebroView(){
    var g=G(),b=B(),live=b.live||{},h="";
    var nd=needs();
    h+='<section class="os-pulse"><div class="os-greet">'+E(OS.greet())+' · Video Forge, Viento y Radar</div>';
    h+='<div class="os-headline">'+E(g.headline||"Loading the brain")+'</div>';
    h+='<div class="os-sub">'+E(live.next_cycle_at?"Thinks every 2 hours. Next cycle at "+OS.hhmm(live.next_cycle_at)+".":"The brain reviews, plans and produces on its own.")+'</div>';
    h+='<div class="os-counts">'+(g.systems||[]).map(function(s){return '<span>'+OS.dot(s.status)+E(s.name)+'</span>';}).join("")+'</div></section>';

    h+='<div class="os-sec"><span>Waiting for you</span>'+(nd.length>3?'<button data-tab="decisiones">See all '+nd.length+'</button>':"")+'</div>';
    h+=nd.length?nd.slice(0,3).map(needHtml).join(""):OS.empty("Nothing is waiting","The brain keeps working on its own. I will tell you when something needs your judgment.");

    var led=ledger();
    var hr=live.ledger&&live.ledger.hit_rate;
    h+='<div class="os-sec"><span>What the brain decided</span>'+(led.length>5?'<button data-tab="decisiones">All</button>':"")+'</div>';
    if(hr&&hr.judged)h+='<div class="os-t2" style="font-size:13px;margin-bottom:4px">Self-critique: hit '+hr.hits+' of '+hr.judged+' already-judged decisions.</div>';
    h+=led.length?'<div>'+led.slice(0,5).map(decHtml).join("")+'</div>':OS.empty("No decisions recorded","When the brain decides something, it appears here with its reason and its review date.");

    h+='<div class="os-sec"><span>What it will publish</span></div>';
    if(live.tomorrow||live.today){
      if(live.today)h+='<div class="os-card" data-plan="today"><div class="h"><div class="t">Today</div><span class="os-t3 os-mono" style="font-size:12px">'+E(live.today.date||"")+'</span></div><div class="m">'+E(daySummary(live.today))+'</div></div>';
      if(live.tomorrow)h+='<div class="os-card" data-plan="tomorrow"><div class="h"><div class="t">Tomorrow</div><span class="os-t3 os-mono" style="font-size:12px">'+E(live.tomorrow.date||"")+'</span></div><div class="m">'+E(daySummary(live.tomorrow))+'</div>'+(live.tomorrow.experiment?'<div class="m">Experiment: '+E((live.tomorrow.experiment.labels||[]).join(" vs ")||live.tomorrow.experiment.id)+'</div>':"")+'</div>';
    } else h+=OS.empty("No plan yet","The brain builds the plan on its next cycle.");

    var og=live.oddly_goal;
    if(og){
      var rv=og.review;
      h+='<div class="os-sec"><span>Year goal</span></div><div class="os-card" data-act="goal"><div class="h"><div class="t">'+E(og.label)+'</div>'+(rv?vpill({status:rv.status,review_at:rv.review_at}):"")+'</div>';
      h+='<div class="m">Strategy decided on '+E(og.decided_at)+': most slots to the leading niche and a couple of different hooks every week.</div>';
      if(rv)h+='<div class="m">Milestone: go from '+OS.num(rv.baseline)+' to '+OS.num(rv.target_pace)+' Shorts views per day before '+E(fdate(rv.review_at))+'.</div>';
      h+='</div>';
    }

    var d=b.decision;
    if(d&&d.candidates&&d.candidates.length){
      var tot=d.total||1,rows=d.candidates.filter(function(c){return c.slots>0;});
      h+='<div class="os-sec"><span>How it allocates production</span></div><div class="os-card" data-act="alloc"><div class="h"><div class="t">'+plural(d.total||0,"daily slot","daily slots")+'</div><span class="os-t3" style="font-size:12px">'+E(OS.ago(d.at))+'</span></div><div class="os-bars">'+rows.map(function(c){return '<div><div>'+E(c.label)+'<i style="width:'+Math.round((c.slots/tot)*100)+'%"></i></div><span class="os-mono os-num">'+c.slots+'</span></div>';}).join("")+'</div></div>';
    }

    var jr=(b.journal||[]).slice(-6).reverse();
    h+='<div class="os-sec"><span>What it is thinking</span><button data-tab="actividad">All</button></div>';
    h+=jr.length?'<div>'+jr.map(function(j){return '<div class="os-think"><div class="tm os-num">'+E(OS.hhmm(j.at))+'</div><div>'+E(j.text)+'</div></div>';}).join("")+'</div>':OS.empty("Empty log","No thoughts recorded yet.");

    h+='<div class="os-sec"><span>Your systems</span><button data-tab="sistemas">View</button></div><div class="os-list">'+(g.systems||[]).map(sysRow).join("")+'</div>';
    if(ST.clock&&ST.clock.at)h+='<div class="os-foot">OS clock: last beat '+E(OS.ago(ST.clock.at))+'</div>';
    return h;
  }

  function decisionesView(){
    var nd=needs(),led=ledger(),h="";
    h+='<section class="os-pulse"><div class="os-greet">Decisions</div><div class="os-headline">'+E(nd.length?plural(nd.length,"decision is waiting","decisions are waiting"):"Nothing is waiting")+'</div><div class="os-sub">Above what needs your judgment. Below what the brain decided on its own, with its reason and when it is reviewed.</div></section>';
    ["video-forge","viento","radar"].forEach(function(s){var own=nd.filter(function(n){return n.system===s;});if(own.length)h+='<div class="os-sec"><span>Waiting in '+E(SYSN[s])+'</span></div>'+own.map(needHtml).join("");});
    h+='<div class="os-sec"><span>Decided by the brain</span></div>';
    h+=led.length?'<div>'+led.slice(0,30).map(decHtml).join("")+'</div>':OS.empty("No decisions recorded","");
    return h;
  }

  function sistemasView(){
    var g=G(),h="";
    h+='<section class="os-pulse"><div class="os-greet">Systems</div><div class="os-headline">'+E(g.headline||"")+'</div><div class="os-sub">Tap a system to see its status and open its full panel.</div></section>';
    h+='<div class="os-list">'+(g.systems||[]).map(sysRow).join("")+'</div>';
    return h;
  }

  function sistemaView(s){
    var p=pulseOf(s),h="";
    h+='<section class="os-pulse"><div class="os-greet">'+E(SYSROLE[s]||"")+'</div><div class="os-headline">'+E(p?p.headline:"No signal from "+SYSN[s])+'</div>'+(p&&p.sub?'<div class="os-sub">'+E(p.sub)+'</div>':"")+'<div class="os-counts"><span>'+OS.dot(p?p.status:"degraded")+E(STATUS_TXT[p?p.status:"degraded"])+'</span></div></section>';
    h+='<button class="os-btn primary block os-openpanel" data-panel="'+E(s)+'">Open '+E(PANEL[s][1].toLowerCase())+'</button>';
    var nd=needs().filter(function(n){return n.system===s;});
    if(nd.length)h+='<div class="os-sec"><span>Waiting here for you</span></div>'+nd.map(needHtml).join("");
    if(!p)return h+OS.empty("No data for this system","Its report has not arrived. It will show up as soon as it publishes its state.");
    if((p.agents||[]).length)h+='<div class="os-sec"><span>Agents</span></div><div class="os-list">'+p.agents.map(function(a){return '<div class="os-row">'+OS.dot(a.state)+'<div class="main"><div class="title">'+E(a.name)+'</div><div class="meta">'+E(a.detail||"")+'</div></div><div class="end">'+E(STATE_TXT[a.state]||a.state)+'</div></div>';}).join("")+'</div>';
    if((p.metrics||[]).length)h+='<div class="os-sec"><span>Metrics</span></div><div class="os-list">'+p.metrics.map(metricHtml).join("")+'</div>';
    if((p.insights||[]).length)h+='<div class="os-sec"><span>What the AI sees</span></div>'+p.insights.map(insightHtml).join("");
    if((p.tasks||[]).length)h+='<div class="os-sec"><span>Tasks</span></div><div class="os-list">'+p.tasks.map(taskHtml).join("")+'</div>';
    if((p.activity||[]).length)h+='<div class="os-sec"><span>Activity</span></div><div>'+p.activity.slice(0,15).map(function(a){return actHtml(a,false);}).join("")+'</div>';
    return h;
  }

  function actividadView(){
    var acts=G().activity||[],jr=(B().journal||[]).slice().reverse(),h="";
    h+='<section class="os-pulse"><div class="os-greet">Activity</div><div class="os-headline">What they did and thought</div><div class="os-sub">Real events from the three systems, most recent first.</div></section>';
    h+='<div class="os-sec"><span>Brain log</span></div>';
    h+=jr.length?'<div>'+jr.slice(0,25).map(function(j){return '<div class="os-think"><div class="tm os-num">'+E(OS.hhmm(j.at))+'</div><div>'+E(j.text)+'<div class="os-t3" style="font-size:12px">'+E(OS.ago(j.at))+'</div></div></div>';}).join("")+'</div>':OS.empty("Empty log","");
    h+='<div class="os-sec"><span>All systems</span></div>';
    h+=acts.length?'<div>'+acts.map(function(a){return actHtml(a,true);}).join("")+'</div>':OS.empty("No activity yet","");
    return h;
  }

  // ---------- Fichas ----------
  function closeBtn(){return '<button class="os-iconbtn os-sheet-close" data-act="close" aria-label="Close">'+OS.icon("x")+'</button>';}
  function needSheet(n){
    var first=(n.actions||[])[0];
    var rows=[["System",SYSN[n.system]],["What",n.title],["Why",n.why],["Evidence",n.evidence],["Impact",n.impact],["Risk",RISK_TXT[n.risk]],["Autonomy",AUT_TXT[n.autonomy]],["Confidence",conf(n.confidence)],["Since",OS.ago(n.created_at)]];
    var btn="";
    if(n.url)btn+='<button class="os-btn primary block" data-open="'+E(n.url)+'">'+E((first&&first.label)||"Open")+'</button>';
    btn+='<button class="os-btn block'+(n.url?"":" primary")+'" data-panel="'+E(n.system)+'">Decide in the '+E(PANEL[n.system][1].toLowerCase())+'</button>';
    OS.openSheet(closeBtn()+'<div class="os-title">'+E(n.title)+'</div>'+OS.chain(rows)+'<div class="os-actions">'+btn+'</div><div class="os-note">The brain shows you the context. Approval happens in the '+E(SYSN[n.system])+' panel.</div>');
  }
  function ledSheet(e){
    var c=e.criterion||{};
    var rows=[["Type",LTYPE[e.type]||"Decision"],["Decision",e.decision],["Why",e.reason],["Evidence",e.evidence],["What it did",e.action],["How it measures",METRIC[e.metric]||e.metric],["Success criterion",c.op?(OPS[c.op]||c.op)+" "+nfmt(c.value):"—"],["Starting point",e.baseline!=null?nfmt(e.baseline):"—"],["Reviewed on",fdate(e.review_at)],["Result",e.status==="PENDIENTE"?"Pending":e.verdict_note||e.status],["If it fails",e.next],["Confidence",e.confidence],["Taken",OS.ago(e.at)]];
    OS.openSheet(closeBtn()+'<div class="os-title">'+E(e.decision)+'</div><div style="margin:-6px 0 12px">'+vpill(e)+'</div>'+OS.chain(rows));
  }
  function planSheet(which){
    var live=B().live||{},d=live[which];if(!d)return;
    var rows=dayItems(d).map(function(it){var st=PLAN_ST[it.status]||["none",it.status];var r=it.record||{};
      return '<div class="os-plan-row"><div class="tm">'+E(it.slot_et||"")+'</div><div><div class="n">'+E(it.niche_label||it.niche)+(it.experiment?' <span class="os-chip acc">hook '+E(it.experiment.arm)+'</span>':'')+'</div><div class="d">'+E(r.reason||"")+'</div>'+(it.idea?'<div class="d">Idea: '+E(it.idea.text)+'</div>':'')+'</div><span class="os-vpill '+st[0]+'">'+E(st[1])+'</span></div>';}).join("");
    OS.openSheet(closeBtn()+'<div class="os-title">'+(which==="today"?"Today's plan":"Tomorrow's plan")+' · '+E(d.date||"")+'</div><div class="os-t2" style="font-size:13px;margin-bottom:8px">'+E(daySummary(d))+'. Hours in ET.</div>'+(rows||OS.empty("No pieces","")));
  }
  function goalSheet(){
    var og=(B().live||{}).oddly_goal;if(!og)return;var rv=og.review||{};
    var hx=(og.hook_experiments||[]).slice().reverse().map(function(x){var v=x.videos||{},arms=x.arms||[],lb=x.labels||[];return '<div class="os-dec"><div class="top"><div><div class="kind">Week '+E(x.week||"")+'</div><div class="t">'+E(lb.join(" vs ")||x.id)+'</div></div>'+vpill(x)+'</div><div class="w">'+arms.map(function(a,i){return E(lb[i]||a)+": "+(v[a]||0)+" videos";}).join(" · ")+(x.winner?" · won "+E(lb[arms.indexOf(x.winner)]||x.winner):"")+'</div></div>';}).join("");
    OS.openSheet(closeBtn()+'<div class="os-title">Year goal · '+E(og.label)+'</div>'+OS.chain([["Decided",og.decided_at],["Strategy","Most slots to the leading niche and a couple of different hooks every week"],["Milestone",rv.target_pace?"Go from "+rv.baseline+" to "+rv.target_pace+" views per day":"—"],["Reviewed on",rv.review_at?fdate(rv.review_at):"—"],["Result",rv.status==="PENDIENTE"?"Pending":(rv.verdict_note||rv.status||"—")]])+'<div class="os-sec"><span>Hook experiments</span></div>'+(hx||OS.empty("No experiments yet","")));
  }
  function allocSheet(){
    var d=B().decision;if(!d)return;
    var rows=(d.candidates||[]).map(function(c){return '<div class="os-dec"><div class="top"><div><div class="t">'+E(c.label)+'</div></div><span class="os-mono os-num">'+c.slots+' slots</span></div><div class="w">'+E(c.why||"")+'</div></div>';}).join("");
    var notes=(d.notes||[]).map(function(n){return '<div class="os-think"><div class="tm">·</div><div>'+E(n)+'</div></div>';}).join("");
    OS.openSheet(closeBtn()+'<div class="os-title">Production allocation</div><div class="os-t2" style="font-size:13px">'+plural(d.total||0,"daily slot","daily slots")+' · decided '+E(OS.ago(d.at))+'</div>'+rows+(notes?'<div class="os-sec"><span>Engine notes</span></div>'+notes:""));
  }

  // ---------- Barra inferior ----------
  function navHtml(){
    var nd=needs().length;
    function b(id,ic,l,badge){var on=V.tab===id;return '<button data-tab="'+id+'" class="'+(on?"on":"")+'" aria-label="'+E(l)+'"'+(on?' aria-current="page"':"")+'>'+OS.icon(ic)+'<span>'+E(l)+'</span>'+(badge?'<span class="os-badge">'+badge+'</span>':"")+'</button>';}
    return b("cerebro","ask","Brain")+b("decisiones","needs","Decisions",nd||"")+b("sistemas","pipeline","Systems")+b("actividad","pulse","Activity");
  }

  function render(){
    document.body.setAttribute("data-sys",V.sys||"os");
    OS.el("top").innerHTML=topHtml();
    OS.el("nav").innerHTML=navHtml();
    var v=OS.el("view");
    if(!ST){v.innerHTML=ERR?'<div class="os-error" style="margin-top:24px"><b>Could not load the brain.</b><div class="os-t2" style="margin-top:4px">'+E(/autoriz/i.test(String(ERR))?"Open it from the bot in Telegram.":String(ERR))+'</div><button class="os-btn sm" style="margin-top:10px" data-act="refresh">Retry</button></div>':'<section class="os-pulse">'+OS.skeleton(6)+'</section>';OS.backSync();return;}
    var body=V.sys?sistemaView(V.sys):V.tab==="decisiones"?decisionesView():V.tab==="sistemas"?sistemasView():V.tab==="actividad"?actividadView():cerebroView();
    if(ERR)body+='<div class="os-error"><b>Could not refresh.</b> Showing the latest that arrived '+E(OS.ago(new Date(LAST).toISOString()))+'.</div>';
    body+='<div class="os-foot">AI OS · one bot · build '+E(C.build)+'</div>';
    v.innerHTML='<div class="'+(ANIM?"os-view":"")+'">'+body+'</div>';
    ANIM=false;
    OS.backSync();
  }
  function go(tab,sys){if(OS.sheetOpen)OS.closeSheet();V.tab=tab;V.sys=sys||null;ANIM=true;OS.haptic("sel");render();window.scrollTo(0,0);}
  function back(){if(OS.sheetOpen){OS.closeSheet();return;}if(V.sys){go("sistemas",null);return;}if(V.tab!=="cerebro"){go("cerebro",null);}}

  function load(manual){
    if(LOADING)return;LOADING=true;
    OS.api(C.api,{method:C.method}).then(function(j){
      LOADING=false;
      if(!j||j.error||!j.global){ERR=(j&&j.error)||"Empty response";if(manual)OS.haptic("err");}
      else{ST=j;ERR=null;LAST=Date.now();      if(manual){OS.haptic("ok");OS.toast("Updated");}}
      render();
    })["catch"](function(){LOADING=false;ERR="No connection";if(manual)OS.haptic("err");render();});
  }

  OS.backSync=function(){try{if(!tg||!tg.BackButton)return;if(OS.sheetOpen||canBack())tg.BackButton.show();else tg.BackButton.hide();}catch(e){}};
  if(tg&&tg.BackButton){try{tg.BackButton.onClick(back);}catch(e){}}

  document.addEventListener("click",function(ev){
    var el=ev.target&&ev.target.closest?ev.target.closest("[data-tab],[data-act],[data-need],[data-open],[data-sys],[data-panel],[data-led],[data-plan]"):null;
    if(!el)return;
    var a=el.getAttribute("data-act"),tab=el.getAttribute("data-tab"),need=el.getAttribute("data-need"),open=el.getAttribute("data-open"),sys=el.getAttribute("data-sys"),panel=el.getAttribute("data-panel"),led=el.getAttribute("data-led"),plan=el.getAttribute("data-plan");
    if(tab){go(tab,null);return;}
    if(a==="back"){back();return;}
    if(a==="close"){OS.closeSheet();return;}
    if(a==="refresh"){load(true);return;}
    if(a==="goal"){goalSheet();return;}
    if(a==="alloc"){allocSheet();return;}
    if(plan){planSheet(plan);return;}
    if(led){var e=(B().ledger||[]).filter(function(x){return x.id===led;})[0];if(e)ledSheet(e);return;}
    if(need){var n=needs().filter(function(x){return x.id===need;})[0];if(n)needSheet(n);return;}
    if(panel&&PANEL[panel]){OS.haptic("light");location.href=PANEL[panel][0];return;}
    if(sys&&SYSN[sys]){go("sistemas",sys);return;}
    if(open){try{if(tg&&tg.openLink)tg.openLink(open);else window.open(open,"_blank");}catch(e2){}return;}
  });
  setInterval(function(){if(document.visibilityState==="visible"&&!OS.sheetOpen)load(false);},30000);
  document.addEventListener("visibilitychange",function(){if(document.visibilityState==="visible"&&Date.now()-LAST>20000)load(false);});
  render();
  load(false);
})();
`;

export function osUnifiedHtml(opts = {}) {
  const cfg = { api: "/api/os", method: "POST", build: String(opts.build || "dev").slice(0, 12), ui: OS_UI_VERSION, unified: OS_UNIFIED_VERSION };
  const safeCfg = JSON.stringify(cfg).replace(/</g, "\\u003c");
  return '<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
    '<title>Brain · AI OS</title>' + OS_HEAD +
    '<script src="https://telegram.org/js/telegram-web-app.js"></script>' +
    '<style>' + OS_CSS + OS_SHELL_CSS + OS_UNIFIED_CSS + '</style></head>' +
    '<body data-sys="os">' + OS_ICONS +
    '<div class="os-wrap"><header class="os-top" id="top"></header><main id="view" aria-live="polite"></main></div>' +
    '<nav class="os-nav" id="nav" aria-label="Sections"></nav>' +
    '<script>window.OS_CFG=' + safeCfg + ';' + OS_JS + OS_UNIFIED_JS + '</script></body></html>';
}

// Top bar injected into the full panels: says where you are and returns to the brain.
export function withOsBar(html, label) {
  const bar = '<div id="os-bar" style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#0A0D12;color:#E7ECF3;font:600 14px -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;border-bottom:1px solid #232C38;position:relative;z-index:9999">' +
    '<a href="/os" style="color:#A594FF;text-decoration:none;white-space:nowrap">&#8249; Brain</a><span style="color:#687588">/</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
    String(label).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])) + '</span></div>';
  // No regular expressions over external HTML (CodeQL: avoids ReDoS with many "<body").
  const src = String(html);
  const i = src.indexOf("<body");
  if (i < 0) return bar + src;
  const j = src.indexOf(">", i);
  if (j < 0) return src + bar;
  return src.slice(0, j + 1) + bar + src.slice(j + 1);
}

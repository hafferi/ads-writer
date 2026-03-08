import { useState, useEffect, useCallback, useRef } from "react";

// ── Design Tokens ─────────────────────────────────────────────────
const LIGHT = {
  blue:"#1400FF", blueDark:"#0E00CC", blueLight:"#4D3BFF", blueSubtle:"#EAE8FF",
  black:"#0A0A0A", white:"#FFFFFF", offWhite:"#F5F5F7",
  gray100:"#F0F0F0", gray200:"#E0E0E0", gray300:"#C8C8C8", gray500:"#8A8A8A", gray700:"#4A4A4A",
  success:"#00A878", error:"#E63946", warning:"#F4A227",
  cardBg:"#FFFFFF", cardBorder:"#E0E0E0", pageBg:"#F5F5F7",
  inputBorder:"#C8C8C8", inputBg:"transparent", inputColor:"#0A0A0A",
  textPrimary:"#0A0A0A", textSecondary:"#8A8A8A", textMuted:"#C8C8C8",
  divider:"#E0E0E0", rowBg:"#F5F5F7", rowBorder:"#E0E0E0",
  topbarBg:"#0A0A0A", topbarBorder:"#1400FF",
  scrollThumb:"#D0D0D0",
};
const DARK = {
  ...LIGHT,
  black:"#F0F0F0", white:"#181820", offWhite:"#12121A",
  gray100:"#2A2A38", gray200:"#333344", gray300:"#44445A", gray500:"#9090A8", gray700:"#C0C0D0",
  cardBg:"#1E1E2C", cardBorder:"#2A2A3C", pageBg:"#12121A",
  inputBorder:"#44445A", inputBg:"transparent", inputColor:"#F0F0F0",
  textPrimary:"#F0F0F0", textSecondary:"#9090A8", textMuted:"#44445A",
  divider:"#2A2A3C", rowBg:"#1A1A28", rowBorder:"#2A2A3C",
  topbarBg:"#0D0D18", topbarBorder:"#1400FF",
  blueSubtle:"#1A1844",
  scrollThumb:"#333344",
};

// ── Constants ─────────────────────────────────────────────────────
const FONT = "'Montserrat', sans-serif";
const LIMITS = {
  rsa:     {headline:30, description:90},
  pmax:    {headline:30, long_headline:90, description:90},
  display: {headline:30, description:90},
  shopping:{headline:150, description:5000},
};
const AD_LABELS = {rsa:"RSA", pmax:"PMAX", display:"DISPLAY", shopping:"SHOPPING"};
const AD_COLORS = (C) => ({rsa:C.blue, pmax:C.blueLight, display:C.warning, shopping:C.success});
const STATUS_META = (C) => ({
  draft:           {label:"Draft",            icon:"✏️", color:C.gray500,  bg:C.gray100,   border:C.gray300,  next:"internal_review", hint:"Being written. Edit copy, then send for internal review."},
  internal_review: {label:"Internal Review",  icon:"👁", color:C.blueLight,bg:C.blueSubtle,border:C.blueLight,next:"pending",         hint:"Awaiting teammate sign-off before the client sees it."},
  pending:         {label:"Sent to Client",   icon:"📤", color:C.warning,  bg:"#FFF8EC",   border:C.warning,  next:null,             hint:"Client has received this and can now approve or request changes."},
  approved:        {label:"Approved",         icon:"✅", color:C.success,  bg:"#E8F8F4",   border:C.success,  next:null,             hint:"Client approved. Ready to go live."},
  changes:         {label:"Revision Requested",icon:"🔁",color:C.error,   bg:"#FEE8EA",   border:C.error,    next:"draft",          hint:"Client requested changes. Edit and re-send."},
});

const USERS = {
  agency:  {id:"agency",  name:"You (Agency)",    role:"agency", email:"you@agency.com",   avatar:"A"},
  teammate:{id:"teammate",name:"Sarah (Teammate)",role:"agency", email:"sarah@agency.com", avatar:"S"},
  client1: {id:"client1", name:"Acme Corp",       role:"client", email:"john@acme.com",    avatar:"C", clientName:"Acme Corp"},
  client2: {id:"client2", name:"BlueSky Ltd",     role:"client", email:"lisa@bluesky.com", avatar:"B", clientName:"BlueSky Ltd"},
};
const DEMO_CLIENTS = [
  {id:"client1", name:"Acme Corp",   email:"john@acme.com",   tone:"professional", cta:"Get a Free Quote", avoid:"cheap, discount",     usp:"UK's #1 CRM with 20 years experience"},
  {id:"client2", name:"BlueSky Ltd", email:"lisa@bluesky.com",tone:"friendly",     cta:"Start Free Trial", avoid:"complex, difficult",   usp:"Simplest project management tool for teams"},
];

const uid = () => Math.random().toString(36).slice(2,9);
const now = () => new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"});
const ts  = () => new Date().toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"});

// ── Storage ───────────────────────────────────────────────────────
const KEYS = {archive:"ppc_jm_v6", clients:"ppc_jm_clients_v6", activity:"ppc_jm_activity_v6", dark:"ppc_jm_dark_v6", projects:"ppc_jm_projects_v6", settings:"ppc_jm_settings_v6", usersMeta:"ppc_jm_users_v6"};
async function load(key, shared=true)           { try { const r=await window.storage.get(key,shared); return r?JSON.parse(r.value):null; } catch { return null; } }
async function persist(key, value, shared=true) { try { await window.storage.set(key,JSON.stringify(value),shared); } catch {} }

// ── CSV ───────────────────────────────────────────────────────────
function toCSV(entries) {
  const rows=[["Date","Client","Product","Ad Type","Status","Field","Text","Chars","Max","OK"]];
  for(const e of entries){
    for(const [type,ad] of Object.entries(e.ads||{})){
      const lim=LIMITS[type]||LIMITS.rsa;
      const push=(f,t,m)=>rows.push([e.date,e.clientName||"",e.product,AD_LABELS[type],e.status||"draft",f,`"${t.replace(/"/g,'""')}"`,t.length,m,t.length>m?"OVER":"OK"]);
      (ad.headlines||[]).forEach(h=>push("Headline",h,lim.headline));
      (ad.long_headlines||[]).forEach(h=>push("Long Headline",h,lim.long_headline||90));
      (ad.descriptions||[]).forEach(d=>push("Description",d,lim.description));
    }
  }
  return rows.map(r=>r.join(",")).join("\n");
}
const dlCSV=(c,n)=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([c],{type:"text/csv"}));a.download=n;a.click();};
const dlTxt=(c,n)=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([c],{type:"text/plain"}));a.download=n;a.click();};

// ── Simulation mode ───────────────────────────────────────────────
// Flip to false before deploying to production
const SIM_MODE = true;

function mockGenerate(product, adTypes, keywords="", usp="") {
  const p   = product || "Your Product";
  const kw  = (keywords ? keywords.split(",")[0].trim() : p);
  // Smart trim — never cut mid-word, adds "…" only if actually truncated
  const tr  = (s, max) => {
    if (s.length <= max) return s;
    const cut = s.slice(0, max).replace(/\s+\S*$/, "");
    return cut.length < s.length ? cut : s.slice(0, max);
  };
  // Fit a prefix + keyword within max chars; falls back to keyword alone
  const fit = (prefix, suffix, max) => {
    const full = `${prefix}${kw}${suffix}`;
    if (full.length <= max) return full;
    // try without suffix
    const noSuf = `${prefix}${kw}`;
    if (noSuf.length <= max) return noSuf;
    // truncate keyword to fit prefix
    const room = max - prefix.length - suffix.length;
    if (room >= 6) return `${prefix}${kw.slice(0, room)}${suffix}`;
    return tr(kw, max);
  };

  const shortP = tr(p, 20); // safe short version of product name
  const uspLine = usp ? tr(usp.split(",")[0].trim(), 30) : `Premium Quality`;
  const mock = {};

  if (adTypes.includes("rsa")) {
    mock.rsa = {
      headlines: [
        // Group 1 — Keyword (5)
        tr(kw, 30),
        fit("Buy ", " Online", 30),
        fit("Shop ", " Now", 30),
        fit("Best ", "", 30),
        fit("", " — Free Delivery", 30),
        // Group 2 — USP (5)
        uspLine,
        "Premium Quality Guaranteed",
        "Fast Delivery Available",
        "Loved by Thousands",
        tr(`${shortP} — Top Rated`, 30),
        // Group 3 — CTA (5)
        tr(`Order ${shortP} Today`, 30),
        "Shop Now — Limited Stock",
        "Get Yours Today",
        "Browse the Full Range",
        tr(`Find Your Perfect ${shortP}`, 30),
      ],
      descriptions: [
        tr(`${p} — crafted with care. Order today and enjoy fast, reliable delivery to your door.`, 90),
        tr(`${p} — the perfect gift or treat. Browse the full range and order online in seconds.`, 90),
        tr(`${p} loved by thousands. Top-rated quality and great value, delivered fast to you.`, 90),
        tr(`${p} — secure checkout, easy returns, and friendly support every step of the way.`, 90),
      ],
    };
  }

  if (adTypes.includes("pmax")) {
    mock.pmax = {
      headlines: [
        tr(`${shortP} — Shop Today`, 30),
        tr(`Discover ${shortP}`, 30),
        tr(`Top-Rated ${shortP}`, 30),
        "Delivered Fast",
        "Find Your Favourite",
      ],
      long_headlines: [
        tr(`${p} — premium quality you can trust, delivered straight to your door.`, 90),
        tr(`Discover the full range of ${p} and find your new favourite today.`, 90),
        tr(`${p} loved by thousands of happy customers. Order online with fast delivery.`, 90),
        tr(`Great ${p} starts here — browse, choose, and get it delivered today.`, 90),
        tr(`From everyday treats to special occasions — ${p} is always the right choice.`, 90),
      ],
      descriptions: [
        tr(`${p} made with quality ingredients and crafted to delight. Order today and enjoy fast delivery.`, 90),
        tr(`Shop the full range of ${p} online. Trusted by thousands and backed by excellent customer reviews.`, 90),
        tr(`Whether it's a treat for yourself or a gift for someone else, ${p} never disappoints.`, 90),
        tr(`${p} available online now. Easy ordering, secure payment, and reliable delivery every time.`, 90),
      ],
    };
  }

  if (adTypes.includes("display")) {
    mock.display = {
      headlines: [
        tr(`Discover ${shortP}`, 30),
        tr(`${shortP} — Try It Today`, 30),
        tr(`You'll Love ${shortP}`, 30),
        tr(`${shortP} — Shop Now`, 30),
        "Treat Yourself Today",
      ],
      descriptions: [
        tr(`${p} is everything you've been looking for. Great quality, fast delivery, and easy returns.`, 90),
        tr(`Thousands of happy customers love ${p}. Try it for yourself and see what the fuss is about.`, 90),
        tr(`Looking for the best ${p}? You've found it. Shop online today with free delivery on orders over £30.`, 90),
        tr(`${p} — the easy choice for quality and value. Order in seconds, delivered to your door.`, 90),
        tr(`Don't settle for less. ${p} delivers on quality every time. Explore the full range now.`, 90),
      ],
    };
  }

  if (adTypes.includes("shopping")) {
    mock.shopping = {
      headlines: [
        tr(`${p} | Free Delivery on Orders Over £30 | Shop Now`, 150),
        tr(`Buy ${p} Online | Top Rated | Fast UK Delivery`, 150),
        tr(`${p} — Official Store | Easy Returns | Secure Checkout`, 150),
      ],
      descriptions: [
        tr(`Shop ${p} direct. Browse the full range and find exactly what you're looking for. Free standard delivery on orders over £30. Simple 30-day returns, no questions asked.`, 5000),
        tr(`${p} trusted by thousands of customers. Order today for fast delivery. Secure checkout, excellent customer support, and a satisfaction guarantee on every order.`, 5000),
      ],
    };
  }

  return mock;
}

// ── Theme context via prop drilling ───────────────────────────────
// C = current colour palette passed as prop throughout

// ── UI Atoms ──────────────────────────────────────────────────────
const Tag = ({C,color,children}) => (
  <span style={{fontSize:9,fontFamily:FONT,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",
    background:`${color}18`,color,border:`1px solid ${color}`,borderRadius:0,padding:"2px 8px"}}>{children}</span>
);

const StatusBadge = ({C,status}) => {
  const m=(STATUS_META(C)[status]||STATUS_META(C).draft);
  return <span style={{fontSize:9,fontFamily:FONT,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",
    background:m.bg,color:m.color,border:`1px solid ${m.border}`,borderRadius:0,padding:"2px 8px"}}>{m.label}</span>;
};

const Btn = ({C,onClick,disabled,variant="primary",children,style={}}) => {
  const v={
    primary: {background:C.blue,   color:"#fff",       border:`2px solid ${C.blue}`},
    outline: {background:"transparent",color:C.blue,   border:`2px solid ${C.blue}`},
    secondary:{background:"transparent",color:C.textPrimary,border:`2px solid ${C.textPrimary}`},
    ghost:   {background:"transparent",color:C.gray500, border:`2px solid ${C.gray300}`},
    success: {background:"transparent",color:C.success, border:`2px solid ${C.success}`},
    danger:  {background:"transparent",color:C.error,   border:`2px solid ${C.error}`},
    warning: {background:"transparent",color:C.warning, border:`2px solid ${C.warning}`},
  };
  const [hov,setHov]=useState(false);
  const base=v[variant]||v.primary;
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{...base,borderRadius:0,padding:"10px 20px",fontSize:11,fontWeight:700,fontFamily:FONT,
        letterSpacing:"0.06em",textTransform:"uppercase",cursor:disabled?"not-allowed":"pointer",
        opacity:disabled?.45:1,transition:"all .12s ease",filter:hov&&!disabled?"brightness(0.88)":"none",...style}}>
      {children}
    </button>
  );
};

const Pill = ({C,active,color,onClick,children}) => (
  <button onClick={onClick} style={{padding:"6px 14px",borderRadius:0,
    border:`1px solid ${active?(color||C.blue):C.gray300}`,
    background:active?(color||C.blue):"transparent",
    color:active?"#fff":C.gray500,
    fontSize:10,fontFamily:FONT,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",cursor:"pointer",transition:"all .12s"}}>
    {children}
  </button>
);

const CopyBtn = ({C,text}) => {
  const [ok,setOk]=useState(false);
  return (
    <button onClick={()=>{navigator.clipboard.writeText(text);setOk(true);setTimeout(()=>setOk(false),1400);}}
      style={{background:"none",border:`1px solid ${ok?C.blue:C.gray300}`,color:ok?C.blue:C.gray500,
        borderRadius:0,padding:"2px 10px",fontSize:9,fontFamily:FONT,fontWeight:700,
        letterSpacing:"0.08em",textTransform:"uppercase",cursor:"pointer",transition:"all .15s",whiteSpace:"nowrap"}}>
      {ok?"✓ COPIED":"COPY"}
    </button>
  );
};

// ── Tooltip ───────────────────────────────────────────────────────
const Tooltip = ({C, text, children}) => {
  const [show, setShow] = useState(false);
  return (
    <span style={{position:"relative",display:"inline-flex",alignItems:"center"}}
      onMouseEnter={()=>setShow(true)} onMouseLeave={()=>setShow(false)}>
      {children}
      {show && (
        <span style={{
          position:"absolute", bottom:"calc(100% + 6px)", left:"50%", transform:"translateX(-50%)",
          background:C.black, color:C.white, fontSize:10, fontFamily:FONT, fontWeight:400,
          lineHeight:1.5, padding:"6px 10px", whiteSpace:"nowrap", zIndex:999,
          borderRadius:0, border:`1px solid ${C.gray300}`, maxWidth:260, textAlign:"center",
          pointerEvents:"none", letterSpacing:"0.02em",
        }}>{text}
          <span style={{position:"absolute",top:"100%",left:"50%",transform:"translateX(-50%)",
            width:0,height:0,borderLeft:"5px solid transparent",borderRight:"5px solid transparent",
            borderTop:`5px solid ${C.black}`}}/>
        </span>
      )}
    </span>
  );
};

const TooltipIcon = ({C, text}) => (
  <Tooltip C={C} text={text}>
    <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",
      width:14,height:14,borderRadius:"50%",border:`1px solid ${C.gray300}`,
      color:C.gray500,fontSize:8,fontFamily:FONT,fontWeight:700,cursor:"default",
      marginLeft:5,lineHeight:1,flexShrink:0}}>?</span>
  </Tooltip>
);

// ── Avatar ────────────────────────────────────────────────────────
const Avatar = ({photo, initial, size=32, color="#1400FF", C}) => (
  <div style={{width:size,height:size,borderRadius:0,overflow:"hidden",flexShrink:0,
    background:photo?"transparent":color,display:"flex",alignItems:"center",justifyContent:"center",
    border:`1px solid ${C?.cardBorder||"#E0E0E0"}`}}>
    {photo
      ? <img src={photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
      : <span style={{fontSize:size*0.38,fontFamily:FONT,fontWeight:800,color:"#fff",lineHeight:1}}>{initial}</span>
    }
  </div>
);

// ── Read image file as data URL ───────────────────────────────────
function readImage(file, cb) {
  const r = new FileReader();
  r.onload = e => cb(e.target.result);
  r.readAsDataURL(file);
}

// ── Pipeline Banner ───────────────────────────────────────────────
const PIPELINE_STEPS = [
  {key:"draft",           label:"Draft",           icon:"✏️"},
  {key:"internal_review", label:"Internal Review", icon:"👁"},
  {key:"pending",         label:"Sent to Client",  icon:"📤"},
  {key:"approved",        label:"Approved",        icon:"✅"},
];
// "Revision Requested" is a branch back, shown separately

const PipelineBanner = ({C, status}) => {
  const meta = STATUS_META(C);
  const isRevision = status === "changes";
  const activeIdx  = PIPELINE_STEPS.findIndex(s => s.key === status);

  return (
    <div style={{marginBottom:16,padding:"12px 16px",background:C.rowBg,border:`1px solid ${C.cardBorder}`}}>
      <div style={{fontSize:9,fontFamily:FONT,fontWeight:700,letterSpacing:"0.15em",color:C.gray500,textTransform:"uppercase",marginBottom:10}}>Approval Pipeline</div>
      <div style={{display:"flex",alignItems:"center",gap:0,flexWrap:"wrap"}}>
        {PIPELINE_STEPS.map((step, i) => {
          const isActive  = step.key === status;
          const isDone    = !isRevision && activeIdx > i;
          const m         = meta[step.key];
          return (
            <Tooltip key={step.key} C={C} text={m.hint}>
              <div style={{display:"flex",alignItems:"center"}}>
                <div style={{
                  display:"flex",alignItems:"center",gap:5,padding:"5px 10px",
                  background: isActive ? m.bg : isDone ? C.gray100 : "transparent",
                  border:`1px solid ${isActive ? m.border : isDone ? C.gray200 : C.gray200}`,
                  cursor:"default",transition:"all .15s",
                }}>
                  <span style={{fontSize:11}}>{step.icon}</span>
                  <span style={{fontSize:9,fontFamily:FONT,fontWeight:isActive?700:400,
                    color:isActive?m.color:isDone?C.gray500:C.gray500,
                    letterSpacing:"0.08em",textTransform:"uppercase",
                    textDecoration:isDone?"line-through":"none"}}>
                    {step.label}
                  </span>
                </div>
                {i < PIPELINE_STEPS.length-1 && (
                  <div style={{width:16,height:1,background:isDone?C.blue:C.gray200,flexShrink:0}}/>
                )}
              </div>
            </Tooltip>
          );
        })}
        {/* Revision branch */}
        {isRevision && (
          <div style={{marginLeft:8,display:"flex",alignItems:"center",gap:5,padding:"5px 10px",
            background:meta.changes.bg,border:`1px solid ${meta.changes.border}`}}>
            <span style={{fontSize:11}}>🔁</span>
            <span style={{fontSize:9,fontFamily:FONT,fontWeight:700,color:meta.changes.color,
              letterSpacing:"0.08em",textTransform:"uppercase"}}>Revision Requested</span>
          </div>
        )}
      </div>
      {/* What to do next hint */}
      <div style={{marginTop:8,fontSize:10,fontFamily:FONT,fontWeight:400,color:C.gray500}}>
        <span style={{fontWeight:700,color:meta[status]?.color||C.gray500}}>Now: </span>
        {meta[status]?.hint || ""}
      </div>
    </div>
  );
};

const CharBar = ({C,value,max}) => {
  const pct=Math.min((value/max)*100,100), over=value>max, warn=value>max*.88;
  return (
    <div style={{display:"flex",alignItems:"center",gap:8,marginTop:4}}>
      <div style={{flex:1,height:2,background:C.gray200,borderRadius:0}}>
        <div style={{height:"100%",width:`${pct}%`,background:over?C.error:warn?C.warning:C.blue,transition:"width .25s"}}/>
      </div>
      <span style={{fontSize:9,fontFamily:FONT,fontWeight:700,color:over?C.error:warn?C.warning:C.gray500,minWidth:40,textAlign:"right",letterSpacing:"0.05em"}}>{value}/{max}</span>
    </div>
  );
};

// ── Inline-editable line item ─────────────────────────────────────
const LineItem = ({C, text, max, onRegen, onEdit, regenLoading}) => {
  const [editing,setEditing]=useState(false);
  const [val,setVal]=useState(text);
  const ref=useRef();
  useEffect(()=>{if(editing&&ref.current) ref.current.focus();},[editing]);
  const commit=()=>{setEditing(false);if(val.trim()!==text) onEdit(val.trim()||text);};
  return (
    <div style={{background:C.rowBg,padding:"10px 12px",marginBottom:4,borderLeft:`2px solid ${C.rowBorder}`}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"flex-start"}}>
        {editing
          ? <input ref={ref} value={val} onChange={e=>setVal(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==="Enter")commit();if(e.key==="Escape"){setVal(text);setEditing(false);}}}
              style={{flex:1,background:"transparent",border:"none",borderBottom:`1px solid ${C.blue}`,color:C.textPrimary,fontSize:13,fontFamily:FONT,fontWeight:400,outline:"none",padding:"2px 0",lineHeight:1.5}}/>
          : <span onClick={()=>setEditing(true)} title="Click to edit"
              style={{color:C.textPrimary,fontSize:13,lineHeight:1.6,flex:1,fontFamily:FONT,fontWeight:400,cursor:"text"}}>{val}</span>
        }
        <div style={{display:"flex",gap:6,flexShrink:0}}>
          <button onClick={()=>setEditing(e=>!e)} title="Edit"
            style={{background:"none",border:`1px solid ${C.gray300}`,color:C.gray500,borderRadius:0,padding:"2px 8px",fontSize:9,fontFamily:FONT,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",cursor:"pointer"}}>
            {editing?"DONE":"EDIT"}
          </button>
          <button onClick={onRegen} disabled={regenLoading} title="Regenerate this line"
            style={{background:"none",border:`1px solid ${regenLoading?C.gray300:C.blue}`,color:regenLoading?C.gray500:C.blue,borderRadius:0,padding:"2px 8px",fontSize:9,fontFamily:FONT,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",cursor:regenLoading?"not-allowed":"pointer",transition:"all .15s"}}>
            {regenLoading?"…":"↺"}
          </button>
          <CopyBtn C={C} text={val}/>
        </div>
      </div>
      <CharBar C={C} value={val.length} max={max}/>
    </div>
  );
};

// ── Ad section with per-line regen ───────────────────────────────
const AdSectionEditable = ({C, label, field, items=[], max, adType, product, apiKey, onUpdate}) => {
  const [regenIdx,setRegenIdx]=useState(null);

  const regenLine = async (idx) => {
    if(!SIM_MODE && !apiKey) return;
    setRegenIdx(idx);
    const lim=LIMITS[adType]||LIMITS.rsa;
    const maxC = field==="descriptions"?lim.description:field==="long_headlines"?lim.long_headline||90:lim.headline;

    // Simulation: pick a random mock line of the right type
    if(SIM_MODE){
      await new Promise(r=>setTimeout(r,400));
      const pool = mockGenerate(product,[adType],product,product);
      const src  = field==="descriptions"
        ? pool[adType]?.descriptions
        : field==="long_headlines"
          ? pool[adType]?.long_headlines
          : pool[adType]?.headlines;
      const candidates=(src||[]).filter((_,i)=>i!==idx);
      const pick=candidates[Math.floor(Math.random()*candidates.length)]||items[idx];
      const updated=[...items]; updated[idx]=pick.slice(0,maxC);
      onUpdate(field,updated);
      setRegenIdx(null);
      return;
    }

    try {
      const res=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:200,messages:[{role:"user",
          content:`Write ONE alternative Google Ads ${field==="descriptions"?"description":"headline"} for "${product}". Max ${maxC} chars. Be specific and compelling. Return ONLY the text, no quotes, no explanation.`}]})
      });
      const data=await res.json();
      const newText=(data.content[0]?.text||"").trim().replace(/^["']|["']$/g,"").slice(0,maxC);
      if(newText){
        const updated=[...items];
        updated[idx]=newText;
        onUpdate(field,updated);
      }
    } catch {}
    setRegenIdx(null);
  };

  const editLine=(idx,val)=>{
    const updated=[...items]; updated[idx]=val; onUpdate(field,updated);
  };

  return (
    <div style={{marginBottom:16}}>
      <div style={{fontSize:9,color:C.gray500,fontFamily:FONT,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",
        marginBottom:8,borderBottom:`1px solid ${C.divider}`,paddingBottom:4,display:"flex",justifyContent:"space-between"}}>
        <span>{label} ({items.length})</span>
        <span style={{color:C.gray500,fontWeight:400,fontSize:8}}>CLICK TEXT TO EDIT · ↺ TO REGENERATE</span>
      </div>
      {items.map((text,i)=>(
        <LineItem key={i} C={C} text={text} max={max}
          regenLoading={regenIdx===i}
          onRegen={()=>regenLine(i)}
          onEdit={(v)=>editLine(i,v)}/>
      ))}
    </div>
  );
};

// ── Read-only ad section (client view / review) ───────────────────
const AdSection = ({C, label, items=[], max}) => (
  <div style={{marginBottom:16}}>
    <div style={{fontSize:9,color:C.gray500,fontFamily:FONT,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",
      marginBottom:8,borderBottom:`1px solid ${C.divider}`,paddingBottom:4}}>{label} ({items.length})</div>
    {items.map((text,i)=>(
      <div key={i} style={{background:C.rowBg,padding:"10px 12px",marginBottom:4,borderLeft:`2px solid ${C.rowBorder}`}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"flex-start"}}>
          <span style={{color:C.textPrimary,fontSize:13,lineHeight:1.6,flex:1,fontFamily:FONT,fontWeight:400}}>{text}</span>
          <CopyBtn C={C} text={text}/>
        </div>
        <CharBar C={C} value={text.length} max={max}/>
      </div>
    ))}
  </div>
);

const ActivityItem = ({C, item}) => (
  <div style={{display:"flex",gap:12,alignItems:"flex-start",padding:"10px 0",borderBottom:`1px solid ${C.divider}`}}>
    <div style={{width:4,height:4,borderRadius:0,background:item.color||C.blue,marginTop:6,flexShrink:0}}/>
    <div style={{flex:1}}>
      <span style={{fontSize:12,color:C.textPrimary,fontFamily:FONT,fontWeight:400}}>{item.msg}</span>
      <div style={{fontSize:10,color:C.gray500,fontFamily:FONT,fontWeight:700,letterSpacing:"0.08em",marginTop:2,textTransform:"uppercase"}}>{item.user} · {item.time}</div>
    </div>
  </div>
);

// ── Dark mode toggle ──────────────────────────────────────────────
const DarkToggle = ({C, dark, onToggle}) => (
  <button onClick={onToggle} title={dark?"Switch to light mode":"Switch to dark mode"}
    style={{background:"none",border:`1px solid ${C.gray300}`,borderRadius:0,padding:"4px 12px",cursor:"pointer",
      display:"flex",alignItems:"center",gap:6,color:C.gray500,fontSize:9,fontFamily:FONT,fontWeight:700,
      letterSpacing:"0.1em",textTransform:"uppercase",transition:"all .2s"}}>
    {dark ? "☀ LIGHT" : "☾ DARK"}
  </button>
);

// ── Campaign Brief modal ──────────────────────────────────────────
const BriefModal = ({C, entry, onClose, onSave}) => {
  const BRIEF_FIELDS = [
    {key:"objective",    label:"Campaign Objective",  placeholder:"e.g. Generate leads for CRM software targeting SMEs"},
    {key:"audience",     label:"Target Audience",      placeholder:"e.g. Marketing managers at companies with 10–50 employees"},
    {key:"usp",          label:"Key USPs",             placeholder:"e.g. 15-min setup, no contract, free migration"},
    {key:"keywords",     label:"Target Keywords",      placeholder:"e.g. CRM software, sales pipeline tool, lead tracker"},
    {key:"competitors",  label:"Competitors",          placeholder:"e.g. Salesforce, HubSpot, Pipedrive"},
    {key:"restrictions", label:"Restrictions / Avoid", placeholder:"e.g. No pricing claims, avoid 'cheap'"},
    {key:"notes",        label:"Additional Notes",     placeholder:"Free-form notes, context, or client requests…"},
  ];
  const [form,setForm]=useState(entry.brief||{});
  const setF=(k,v)=>setForm(f=>({...f,[k]:v}));

  const exportBrief = () => {
    const lines=[
      `CAMPAIGN BRIEF — ${entry.product}`,
      `Client: ${entry.clientName||"—"} | Date: ${entry.date} | Format: ${AD_LABELS[entry.adType]}`,
      `Status: ${entry.status?.toUpperCase()}`,
      "─".repeat(60),
      ...BRIEF_FIELDS.filter(f=>form[f.key]).map(f=>`${f.label.toUpperCase()}\n${form[f.key]}`),
      "─".repeat(60),
      "AD COPY",
      ...Object.entries(entry.ads||{}).flatMap(([type,ad])=>[
        `\n[${AD_LABELS[type]}]`,
        ...(ad.headlines||[]).map((h,i)=>`  H${i+1}: ${h}`),
        ...(ad.long_headlines||[]).map((h,i)=>`  LH${i+1}: ${h}`),
        ...(ad.descriptions||[]).map((d,i)=>`  D${i+1}: ${d}`),
      ]),
    ];
    dlTxt(lines.join("\n"),`brief-${entry.product.replace(/\s+/g,"-").toLowerCase()}-${Date.now()}.txt`);
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:C.cardBg,border:`1px solid ${C.cardBorder}`,borderRadius:0,width:"100%",maxWidth:580,
        maxHeight:"90vh",overflow:"auto",display:"flex",flexDirection:"column"}}>
        {/* Header */}
        <div style={{padding:"20px 24px",borderBottom:`2px solid ${C.blue}`,display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,background:C.cardBg,zIndex:1}}>
          <div>
            <div style={{fontSize:9,fontFamily:FONT,fontWeight:700,letterSpacing:"0.15em",color:C.blue,textTransform:"uppercase",marginBottom:4}}>CAMPAIGN BRIEF</div>
            <div style={{fontSize:16,fontFamily:FONT,fontWeight:800,color:C.textPrimary}}>{entry.product}</div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <Btn C={C} variant="ghost" onClick={exportBrief} style={{fontSize:9,padding:"6px 14px"}}>↓ Export .txt</Btn>
            <button onClick={onClose} style={{background:"none",border:`1px solid ${C.gray300}`,color:C.gray500,
              borderRadius:0,padding:"6px 12px",fontSize:11,fontFamily:FONT,fontWeight:700,cursor:"pointer"}}>✕</button>
          </div>
        </div>
        {/* Body */}
        <div style={{padding:24,flex:1}}>
          {BRIEF_FIELDS.map(f=>(
            <div key={f.key} style={{marginBottom:20}}>
              <label style={{fontSize:10,color:C.gray500,fontFamily:FONT,fontWeight:700,letterSpacing:"0.15em",
                textTransform:"uppercase",marginBottom:4,display:"block"}}>{f.label}</label>
              <textarea value={form[f.key]||""} onChange={e=>setF(f.key,e.target.value)}
                placeholder={f.placeholder}
                style={{width:"100%",background:"transparent",border:"none",borderBottom:`1px solid ${C.inputBorder}`,
                  borderRadius:0,color:C.inputColor,padding:"8px 0",fontSize:13,fontFamily:FONT,
                  outline:"none",resize:"vertical",minHeight:f.key==="notes"?80:44,lineHeight:1.6}}/>
            </div>
          ))}
          {/* Ad copy preview */}
          <div style={{marginTop:8,padding:16,background:C.rowBg,borderLeft:`3px solid ${C.blue}`}}>
            <div style={{fontSize:9,fontFamily:FONT,fontWeight:700,letterSpacing:"0.15em",color:C.blue,textTransform:"uppercase",marginBottom:12}}>Ad Copy Preview</div>
            {Object.entries(entry.ads||{}).map(([type,ad])=>{
              const lim=LIMITS[type]||LIMITS.rsa;
              return (
                <div key={type}>
                  <AdSection C={C} label="Headlines"      items={ad.headlines||[]}      max={lim.headline}/>
                  <AdSection C={C} label="Long Headlines" items={ad.long_headlines||[]} max={lim.long_headline||90}/>
                  <AdSection C={C} label="Descriptions"   items={ad.descriptions||[]}   max={lim.description}/>
                </div>
              );
            })}
          </div>
        </div>
        {/* Footer */}
        <div style={{padding:"16px 24px",borderTop:`1px solid ${C.divider}`,display:"flex",gap:10,justifyContent:"flex-end",background:C.cardBg}}>
          <Btn C={C} variant="ghost" onClick={onClose} style={{fontSize:10,padding:"8px 20px"}}>Cancel</Btn>
          <Btn C={C} onClick={()=>onSave(form)} style={{fontSize:10,padding:"8px 24px"}}>Save Brief</Btn>
        </div>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════
// LOGIN SCREEN
// ══════════════════════════════════════════════════════════════════
const LoginScreen = ({C, onLogin}) => {
  const [email,setEmail]=useState("");
  const [sent,setSent]=useState(false);
  const [error,setError]=useState("");

  const handleSend = () => {
    if(!email.trim()){setError("Enter your email address.");return;}
    const user=Object.values(USERS).find(u=>u.email.toLowerCase()===email.toLowerCase());
    if(!user){setError("Email not found. Use a test account below.");return;}
    setSent(true); setError(""); setTimeout(()=>onLogin(user),1500);
  };

  return (
    <div style={{minHeight:"100vh",background:C.pageBg,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{width:"100%",maxWidth:420}}>
        <div style={{textAlign:"center",marginBottom:40}}>
          <div style={{fontSize:10,fontFamily:FONT,fontWeight:700,letterSpacing:"0.2em",color:C.gray500,textTransform:"uppercase",marginBottom:8}}>JORGE MARTINS · GOOGLE ADS FREELANCER</div>
          <div style={{fontSize:28,fontFamily:FONT,fontWeight:900,color:C.textPrimary,letterSpacing:"-0.03em",lineHeight:1}}>
            Ads Writer<span style={{color:C.blue}}>.</span>
          </div>
          <div style={{fontSize:12,fontFamily:FONT,fontWeight:300,color:C.gray500,marginTop:6}}>Client approval portal & agency workspace</div>
        </div>
        <div style={{background:C.cardBg,border:`1px solid ${C.cardBorder}`,borderRadius:0,padding:24}}>
          {!sent ? (
            <>
              <div style={{borderBottom:`2px solid ${C.blue}`,marginBottom:20,paddingBottom:6}}>
                <div style={{fontSize:11,fontFamily:FONT,fontWeight:700,letterSpacing:"0.15em",color:C.textPrimary,textTransform:"uppercase"}}>Sign In</div>
              </div>
              <label style={{fontSize:10,color:C.gray500,fontFamily:FONT,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:4,display:"block"}}>Email Address</label>
              <input style={{width:"100%",background:"transparent",border:"none",borderBottom:`1px solid ${C.inputBorder}`,borderRadius:0,color:C.inputColor,padding:"10px 0",fontSize:13,fontFamily:FONT,outline:"none"}}
                type="email" placeholder="your@email.com" value={email}
                onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSend()}/>
              {error && <div style={{marginTop:8,padding:"8px 12px",background:"#FEE8EA",borderLeft:`3px solid ${C.error}`,fontSize:11,color:C.error,fontFamily:FONT,fontWeight:600}}>{error}</div>}
              <Btn C={C} onClick={handleSend} style={{width:"100%",marginTop:20,padding:14}}>Send Magic Link →</Btn>
              <div style={{marginTop:24,paddingTop:16,borderTop:`1px solid ${C.divider}`}}>
                <div style={{fontSize:9,fontFamily:FONT,fontWeight:700,letterSpacing:"0.15em",color:C.gray500,textTransform:"uppercase",marginBottom:12}}>Simulation — Test Accounts</div>
                {Object.values(USERS).map(u=>(
                  <div key={u.id} onClick={()=>setEmail(u.email)}
                    style={{display:"flex",gap:10,alignItems:"center",padding:"8px 0",cursor:"pointer",borderBottom:`1px solid ${C.divider}`}}>
                    <div style={{width:28,height:28,borderRadius:0,background:u.role==="client"?C.blueSubtle:C.blue,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:900,color:u.role==="client"?C.blue:"#fff",fontFamily:FONT}}>{u.avatar}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12,color:C.textPrimary,fontFamily:FONT,fontWeight:600}}>{u.name}</div>
                      <div style={{fontSize:10,color:C.gray500,fontFamily:FONT}}>{u.email}</div>
                    </div>
                    <Tag C={C} color={u.role==="client"?C.blueLight:C.blue}>{u.role}</Tag>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{textAlign:"center",padding:"32px 0"}}>
              <div style={{fontSize:32,marginBottom:12}}>✉️</div>
              <div style={{fontSize:14,color:C.success,fontWeight:700,fontFamily:FONT,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.06em"}}>Magic link sent</div>
              <div style={{fontSize:12,color:C.gray500,fontFamily:FONT}}>Signing you in… <span style={{color:C.blue}}>(simulation)</span></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════
// CLIENT VIEW
// ══════════════════════════════════════════════════════════════════
const ClientView = ({C, user, archive, onAction}) => {
  const myAds  = archive.filter(e=>e.clientName===user.clientName && e.status==="pending");
  const pastAds= archive.filter(e=>e.clientName===user.clientName && e.status!=="pending");
  const [feedback,setFeedback]=useState({});
  const [expanded,setExpanded]=useState({});

  return (
    <div style={{maxWidth:680,margin:"0 auto",padding:"40px 24px"}}>
      <div style={{marginBottom:32}}>
        <div style={{fontSize:10,fontFamily:FONT,fontWeight:700,letterSpacing:"0.2em",color:C.blue,textTransform:"uppercase",marginBottom:6}}>CLIENT PORTAL</div>
        <h1 style={{fontSize:28,fontWeight:900,fontFamily:FONT,letterSpacing:"-0.02em",color:C.textPrimary,margin:0}}>Ad Approval</h1>
        <div style={{fontSize:13,color:C.gray500,fontFamily:FONT,fontWeight:300,marginTop:4}}>{user.clientName} · {user.email}</div>
        <div style={{width:40,height:2,background:C.blue,marginTop:12}}/>
      </div>

      {myAds.length===0 && (
        <div style={{background:C.cardBg,border:`1px solid ${C.cardBorder}`,borderRadius:0,padding:"56px 24px",marginBottom:16,textAlign:"center",borderLeft:`3px solid ${C.blue}`}}>
          <div style={{fontSize:20,marginBottom:12}}>✓</div>
          <div style={{fontFamily:FONT,fontWeight:700,fontSize:14,color:C.textPrimary,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6}}>All caught up</div>
          <div style={{fontFamily:FONT,fontWeight:300,fontSize:13,color:C.gray500}}>No ads pending your review right now.</div>
        </div>
      )}

      {myAds.map(entry=>(
        <div key={entry.id} style={{background:C.cardBg,border:`1px solid ${C.cardBorder}`,borderRadius:0,padding:24,marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16,flexWrap:"wrap",gap:8}}>
            <div>
              <div style={{fontSize:16,fontWeight:800,fontFamily:FONT,color:C.textPrimary,letterSpacing:"-0.01em",marginBottom:6}}>{entry.product}</div>
              <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                <Tag C={C} color={AD_COLORS(C)[entry.adType]||C.blue}>{AD_LABELS[entry.adType]}</Tag>
                <span style={{fontSize:10,color:C.gray500,fontFamily:FONT,fontWeight:600,letterSpacing:"0.08em"}}>{entry.date}</span>
              </div>
            </div>
            <StatusBadge C={C} status={entry.status}/>
          </div>
          <div style={{background:C.rowBg,padding:16,marginBottom:16,borderLeft:`3px solid ${C.blue}`}}>
            {Object.entries(entry.ads||{}).map(([type,ad])=>{
              const lim=LIMITS[type]||LIMITS.rsa;
              return (
                <div key={type}>
                  <AdSection C={C} label="Headlines"      items={ad.headlines||[]}      max={lim.headline}/>
                  <AdSection C={C} label="Long Headlines" items={ad.long_headlines||[]} max={lim.long_headline||90}/>
                  <AdSection C={C} label="Descriptions"   items={ad.descriptions||[]}   max={lim.description}/>
                </div>
              );
            })}
          </div>
          <div style={{marginBottom:16}}>
            <label style={{fontSize:10,color:C.gray500,fontFamily:FONT,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:4,display:"block"}}>Feedback (optional)</label>
            <textarea style={{width:"100%",background:"transparent",border:"none",borderBottom:`1px solid ${C.inputBorder}`,borderRadius:0,color:C.inputColor,padding:"8px 0",fontSize:13,fontFamily:FONT,outline:"none",resize:"vertical",minHeight:72}}
              placeholder="Add any notes or change requests…"
              value={feedback[entry.id]||""} onChange={e=>setFeedback(f=>({...f,[entry.id]:e.target.value}))}/>
          </div>
          <div style={{display:"flex",gap:12}}>
            <Btn C={C} variant="success" onClick={()=>onAction(entry.id,"approved",feedback[entry.id]||"")} style={{flex:1}}>✓ Approve Ads</Btn>
            <Btn C={C} variant="danger"  onClick={()=>onAction(entry.id,"changes", feedback[entry.id]||"")} style={{flex:1}}>✕ Request Changes</Btn>
          </div>
        </div>
      ))}

      {pastAds.length>0 && (
        <div>
          <div style={{fontSize:9,fontFamily:FONT,fontWeight:700,letterSpacing:"0.2em",color:C.gray500,textTransform:"uppercase",margin:"32px 0 12px"}}>PREVIOUS ADS</div>
          {pastAds.map(e=>(
            <div key={e.id} style={{background:C.cardBg,border:`1px solid ${C.cardBorder}`,borderRadius:0,padding:16,marginBottom:8,opacity:.75}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}} onClick={()=>setExpanded(x=>({...x,[e.id]:!x[e.id]}))}>
                <div style={{display:"flex",gap:10,alignItems:"center"}}>
                  <span style={{fontSize:13,fontFamily:FONT,fontWeight:600,color:C.textPrimary}}>{e.product}</span>
                  <StatusBadge C={C} status={e.status}/>
                </div>
                <span style={{color:C.gray500,fontSize:11}}>{expanded[e.id]?"▲":"▼"}</span>
              </div>
              {expanded[e.id] && e.feedback && (
                <div style={{marginTop:10,padding:"8px 12px",background:C.rowBg,borderLeft:`2px solid ${C.gray500}`,fontSize:12,color:C.gray700,fontFamily:FONT}}>💬 {e.feedback}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── RSA Live Preview ──────────────────────────────────────────────
const RSAPreview = ({C, headlines=[], descriptions=[], url="www.yourdomain.com"}) => {
  const [combo,setCombo] = useState(0);

  // Google picks 3 headlines and 2 descriptions per impression
  // We cycle through combinations so the user can preview variety
  const kw  = headlines.slice(0,5).filter(Boolean);
  const usp = headlines.slice(5,10).filter(Boolean);
  const cta = headlines.slice(10,15).filter(Boolean);
  const descs = descriptions.filter(Boolean);

  // Build rotation pools — always pick 1 from each group when possible
  const pools = [kw, usp, cta];
  const total = Math.max(...pools.map(p=>p.length), 1);

  const getCombo = (idx) => {
    const h1 = kw[idx % Math.max(kw.length,1)]  || headlines[0] || "";
    const h2 = usp[idx % Math.max(usp.length,1)] || headlines[1] || "";
    const h3 = cta[idx % Math.max(cta.length,1)] || headlines[2] || "";
    const d1 = descs[idx % Math.max(descs.length,1)] || "";
    const d2 = descs[(idx+1) % Math.max(descs.length,1)] || "";
    return {h1,h2,h3,d1,d2};
  };

  const {h1,h2,h3,d1,d2} = getCombo(combo);
  const maxCombos = Math.max(kw.length, usp.length, cta.length, 1);

  const GROUP_LABELS = ["KEYWORD","KEYWORD","KEYWORD","KEYWORD","KEYWORD","USP","USP","USP","USP","USP","CTA","CTA","CTA","CTA","CTA"];
  const GROUP_COLORS = {KEYWORD: C.blue, USP: C.success, CTA: C.warning};

  const headlineOverLimit = [h1,h2,h3].some(h=>h.length>30);
  const descOverLimit     = [d1,d2].some(d=>d.length>90);

  return (
    <div style={{position:"sticky",top:24}}>
      {/* Label */}
      <div style={{fontSize:9,fontFamily:FONT,fontWeight:700,letterSpacing:"0.2em",color:C.blue,textTransform:"uppercase",marginBottom:12}}>— LIVE AD PREVIEW</div>

      {/* Google SERP simulation */}
      <div style={{background:C.white,border:`1px solid ${C.cardBorder}`,borderRadius:0,padding:20,marginBottom:12,fontFamily:"Arial, sans-serif"}}>
        {/* Ad label */}
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
          <span style={{fontSize:11,color:"#186F38",fontFamily:"Arial",fontWeight:700,border:"1px solid #186F38",padding:"1px 5px",borderRadius:3,lineHeight:1.4}}>Ad</span>
          <span style={{fontSize:13,color:"#202124",fontFamily:"Arial"}}>{url}</span>
        </div>
        {/* Headlines */}
        <div style={{fontSize:20,color:"#1a0dab",fontFamily:"Arial",lineHeight:1.3,marginBottom:4,cursor:"pointer"}}>
          {h1||"Headline 1"} {h1&&h2?" | ":""}{h2||"Headline 2"} {h2&&h3?" | ":""}{h3||"Headline 3"}
        </div>
        {/* Descriptions */}
        <div style={{fontSize:13,color:"#4d5156",fontFamily:"Arial",lineHeight:1.58,maxWidth:560}}>
          {d1||"Your first description will appear here once you generate copy."}{" "}
          {d2}
        </div>
      </div>

      {/* Combination navigator */}
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
        <button onClick={()=>setCombo(c=>(c-1+maxCombos)%maxCombos)}
          style={{background:"none",border:`1px solid ${C.gray300}`,color:C.gray500,borderRadius:0,width:28,height:28,cursor:"pointer",fontSize:14,fontFamily:FONT}}>‹</button>
        <span style={{fontSize:9,fontFamily:FONT,fontWeight:700,color:C.gray500,letterSpacing:"0.1em",textTransform:"uppercase",flex:1,textAlign:"center"}}>
          Combination {combo+1} of {maxCombos}
        </span>
        <button onClick={()=>setCombo(c=>(c+1)%maxCombos)}
          style={{background:"none",border:`1px solid ${C.gray300}`,color:C.gray500,borderRadius:0,width:28,height:28,cursor:"pointer",fontSize:14,fontFamily:FONT}}>›</button>
      </div>

      {/* Warnings */}
      {(headlineOverLimit||descOverLimit) && (
        <div style={{padding:"8px 12px",background:"#FEE8EA",borderLeft:`3px solid ${C.error}`,fontSize:11,fontFamily:FONT,color:C.error,marginBottom:12}}>
          ⚠ {headlineOverLimit?"One or more headlines exceed 30 chars. ":""}{descOverLimit?"One or more descriptions exceed 90 chars.":""}
        </div>
      )}

      {/* Headlines grouped */}
      {headlines.length>0 && (
        <div style={{background:C.rowBg,border:`1px solid ${C.cardBorder}`,padding:14}}>
          <div style={{fontSize:9,fontFamily:FONT,fontWeight:700,letterSpacing:"0.15em",color:C.gray500,textTransform:"uppercase",marginBottom:10}}>All 15 Headlines</div>
          {headlines.map((h,i)=>{
            const grp = GROUP_LABELS[i]||"KEYWORD";
            const col = GROUP_COLORS[grp];
            const over = h.length>30;
            const isActive = [h1,h2,h3].includes(h);
            return (
              <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0",borderBottom:`1px solid ${C.divider}`}}>
                <span style={{fontSize:8,fontFamily:FONT,fontWeight:700,letterSpacing:"0.08em",color:col,minWidth:44,textTransform:"uppercase"}}>{grp}</span>
                <span style={{fontSize:11,fontFamily:FONT,color:over?C.error:isActive?C.blue:C.textPrimary,flex:1,fontWeight:isActive?700:400,transition:"color .2s"}}>{h}</span>
                <span style={{fontSize:9,fontFamily:FONT,fontWeight:700,color:over?C.error:C.gray500,minWidth:28,textAlign:"right"}}>{h.length}</span>
                {isActive && <span style={{fontSize:8,color:C.blue,fontWeight:700,fontFamily:FONT,letterSpacing:"0.06em"}}>ON</span>}
              </div>
            );
          })}

          {descriptions.length>0 && (
            <>
              <div style={{fontSize:9,fontFamily:FONT,fontWeight:700,letterSpacing:"0.15em",color:C.gray500,textTransform:"uppercase",margin:"12px 0 8px"}}>Descriptions</div>
              {descriptions.map((d,i)=>{
                const over=d.length>90;
                const isActive=[d1,d2].includes(d);
                return (
                  <div key={i} style={{display:"flex",alignItems:"flex-start",gap:8,padding:"4px 0",borderBottom:`1px solid ${C.divider}`}}>
                    <span style={{fontSize:8,fontFamily:FONT,fontWeight:700,letterSpacing:"0.08em",color:C.blueLight,minWidth:44,textTransform:"uppercase",paddingTop:2}}>DESC</span>
                    <span style={{fontSize:11,fontFamily:FONT,color:over?C.error:isActive?C.blue:C.textPrimary,flex:1,fontWeight:isActive?700:400,lineHeight:1.5}}>{d}</span>
                    <span style={{fontSize:9,fontFamily:FONT,fontWeight:700,color:over?C.error:C.gray500,minWidth:28,textAlign:"right",paddingTop:2}}>{d.length}</span>
                    {isActive && <span style={{fontSize:8,color:C.blue,fontWeight:700,fontFamily:FONT,letterSpacing:"0.06em",paddingTop:2}}>ON</span>}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════
// KANBAN BOARD
// ══════════════════════════════════════════════════════════════════
const KANBAN_COLS = [
  {key:"draft",           label:"Draft",            icon:"✏️"},
  {key:"internal_review", label:"Internal Review",  icon:"👁"},
  {key:"pending",         label:"Sent to Client",   icon:"📤"},
  {key:"approved",        label:"Approved",         icon:"✅"},
  {key:"changes",         label:"Revision Requested",icon:"🔁"},
];

const KanbanCard = ({C, entry, clients, onOpen, onDragStart}) => {
  const meta   = STATUS_META(C)[entry.status]||STATUS_META(C).draft;
  const client = clients.find(c=>c.id===entry.clientId);
  return (
    <div
      draggable
      onDragStart={e=>{e.dataTransfer.setData("entryId",entry.id);onDragStart&&onDragStart(entry.id);}}
      onClick={()=>onOpen(entry)}
      style={{background:C.cardBg,border:`1px solid ${C.cardBorder}`,borderLeft:`3px solid ${meta.border}`,
        padding:"10px 12px",marginBottom:8,cursor:"grab",transition:"box-shadow .15s",userSelect:"none"}}
      onMouseEnter={e=>e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,0.10)"}
      onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}
    >
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:6}}>
        <Tag C={C} color={AD_COLORS(C)[entry.adType]||C.blue} style={{fontSize:7,padding:"1px 5px"}}>{AD_LABELS[entry.adType]}</Tag>
        <span style={{fontSize:9,fontFamily:FONT,color:C.gray500,flexShrink:0}}>{entry.date}</span>
      </div>
      <div style={{fontSize:12,fontFamily:FONT,fontWeight:700,color:C.textPrimary,margin:"6px 0 4px",lineHeight:1.3}}>{entry.product}</div>
      {client && (
        <div style={{display:"flex",alignItems:"center",gap:5}}>
          <Avatar photo={client.photo} initial={client.name[0]} size={16} color={C.blue} C={C}/>
          <span style={{fontSize:10,fontFamily:FONT,color:C.gray500}}>{client.name}</span>
        </div>
      )}
      {entry.projectName && <div style={{fontSize:9,fontFamily:FONT,color:C.blueLight,marginTop:3}}>📁 {entry.projectName}</div>}
      {entry.feedback && <div style={{fontSize:9,fontFamily:FONT,color:C.error,marginTop:4,borderLeft:`2px solid ${C.error}`,paddingLeft:5}}>💬 {entry.feedback.slice(0,50)}{entry.feedback.length>50?"…":""}</div>}
    </div>
  );
};

const KanbanBoard = ({C, archive, clients, onOpenEntry, onMoveEntry}) => {
  const [dragOver,setDragOver] = useState(null);

  const handleDrop = (e, colKey) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("entryId");
    if (id) onMoveEntry(id, colKey);
    setDragOver(null);
  };

  return (
    <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12,alignItems:"start",overflowX:"auto",minWidth:900}}>
      {KANBAN_COLS.map(col=>{
        const meta  = STATUS_META(C)[col.key];
        const cards = archive.filter(e=>(e.status||"draft")===col.key);
        const isOver= dragOver===col.key;
        return (
          <div key={col.key}
            onDragOver={e=>{e.preventDefault();setDragOver(col.key);}}
            onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget))setDragOver(null);}}
            onDrop={e=>handleDrop(e,col.key)}
            style={{background:isOver?meta.bg:C.rowBg,border:`2px solid ${isOver?meta.border:C.cardBorder}`,
              minHeight:200,padding:10,transition:"all .15s"}}
          >
            {/* Column header */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,paddingBottom:8,borderBottom:`2px solid ${meta.border}`}}>
              <div style={{display:"flex",alignItems:"center",gap:5}}>
                <span style={{fontSize:12}}>{col.icon}</span>
                <span style={{fontSize:9,fontFamily:FONT,fontWeight:800,letterSpacing:"0.12em",color:meta.color,textTransform:"uppercase"}}>{col.label}</span>
              </div>
              <span style={{fontSize:9,fontFamily:FONT,fontWeight:700,color:C.gray500,background:C.cardBg,border:`1px solid ${C.cardBorder}`,padding:"1px 6px"}}>{cards.length}</span>
            </div>
            {/* Drop hint */}
            {isOver && <div style={{border:`2px dashed ${meta.border}`,padding:"8px",textAlign:"center",marginBottom:8,fontSize:9,fontFamily:FONT,color:meta.color,fontWeight:700}}>Drop here</div>}
            {/* Cards */}
            {cards.length===0 && !isOver && (
              <div style={{textAlign:"center",padding:"20px 0",fontSize:9,fontFamily:FONT,color:C.gray500,letterSpacing:"0.1em"}}>EMPTY</div>
            )}
            {cards.map(entry=>(
              <KanbanCard key={entry.id} C={C} entry={entry} clients={clients}
                onOpen={onOpenEntry} onDragStart={()=>{}}/>
            ))}
          </div>
        );
      })}
    </div>
  );
};

// ── Save to Project Modal ─────────────────────────────────────────
const SaveToProjectModal = ({C, adType, forceClient, clients, projects, onSave, onClose}) => {
  const [selClient, setSelClient] = useState(forceClient||"");
  const [selProject, setSelProject] = useState("__new__");
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");

  const clientProjects = projects.filter(p => p.clientId === selClient);
  const chosenClient = clients.find(c => c.id === selClient);
  const projectOnly = !adType; // opened from Projects tab just to create a project

  const handleSave = () => {
    let projectId = selProject;
    let projectName = "";
    let newProject = null;

    if (selProject === "__new__") {
      if (!newProjectName.trim()) return;
      projectId = uid();
      projectName = newProjectName.trim();
      newProject = {id: projectId, clientId: selClient||null, clientName: chosenClient?.name||"", name: projectName, desc: newProjectDesc.trim(), created: now()};
    } else if (selProject) {
      projectName = projects.find(p => p.id === selProject)?.name || "";
    }

    onSave(adType, projectId||null, projectName, newProject);
  };

  const INP2={width:"100%",background:"transparent",border:"none",borderBottom:`1px solid ${C.inputBorder}`,
    borderRadius:0,color:C.inputColor,padding:"10px 0",fontSize:13,fontFamily:FONT,outline:"none"};
  const LBL2={fontSize:10,color:C.gray500,fontFamily:FONT,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:4,display:"block"};

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:C.cardBg,border:`1px solid ${C.cardBorder}`,borderRadius:0,width:"100%",maxWidth:460}}>
        {/* Header */}
        <div style={{padding:"18px 24px",borderBottom:`2px solid ${C.blue}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:9,fontFamily:FONT,fontWeight:700,letterSpacing:"0.15em",color:C.blue,textTransform:"uppercase",marginBottom:3}}>{projectOnly?"NEW PROJECT":"SAVE AD COPY"}</div>
            <div style={{fontSize:15,fontFamily:FONT,fontWeight:800,color:C.textPrimary}}>{projectOnly?"Create Project":"Save to Project"}</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:`1px solid ${C.gray300}`,color:C.gray500,borderRadius:0,padding:"5px 10px",fontSize:11,fontFamily:FONT,fontWeight:700,cursor:"pointer"}}>✕</button>
        </div>

        {/* Body */}
        <div style={{padding:24}}>
          {/* Client picker */}
          <div style={{marginBottom:20}}>
            <label style={LBL2}>Client</label>
            <select style={{...INP2,cursor:"pointer"}} value={selClient} onChange={e=>{setSelClient(e.target.value);setSelProject("");}}>
              <option value="">— No client / unassigned —</option>
              {clients.map(c=><option key={c.id} value={c.id} style={{background:C.cardBg,color:C.textPrimary}}>{c.name}</option>)}
            </select>
          </div>

          {/* Project picker */}
          <div style={{marginBottom: selProject==="__new__" ? 0 : 8}}>
            <label style={LBL2}>Project</label>
            <select style={{...INP2,cursor:"pointer"}} value={selProject} onChange={e=>setSelProject(e.target.value)}>
              <option value="">— No project / save to archive —</option>
              {clientProjects.map(p=><option key={p.id} value={p.id} style={{background:C.cardBg,color:C.textPrimary}}>{p.name}</option>)}
              <option value="__new__">＋ Create new project…</option>
            </select>
          </div>

          {/* New project form */}
          {selProject==="__new__" && (
            <div style={{marginTop:20,padding:16,background:C.rowBg,borderLeft:`3px solid ${C.blue}`}}>
              <div style={{fontSize:9,fontFamily:FONT,fontWeight:700,letterSpacing:"0.15em",color:C.blue,textTransform:"uppercase",marginBottom:14}}>New Project</div>
              <div style={{marginBottom:16}}>
                <label style={LBL2}>Project Name *</label>
                <input style={INP2} placeholder="e.g. Christmas Campaign 2025" value={newProjectName} onChange={e=>setNewProjectName(e.target.value)}/>
              </div>
              <div>
                <label style={LBL2}>Description <span style={{fontWeight:400,letterSpacing:0,textTransform:"none",fontSize:10}}>(optional)</span></label>
                <input style={INP2} placeholder="e.g. Q4 brand awareness push for UK market" value={newProjectDesc} onChange={e=>setNewProjectDesc(e.target.value)}/>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{padding:"16px 24px",borderTop:`1px solid ${C.divider}`,display:"flex",gap:10,justifyContent:"flex-end"}}>
          <Btn C={C} variant="ghost" onClick={onClose} style={{fontSize:10,padding:"8px 20px"}}>Cancel</Btn>
          <Btn C={C} onClick={handleSave} style={{fontSize:10,padding:"8px 24px"}}>
            {projectOnly ? "Create Project" : selProject==="__new__" ? "Create Project & Save" : "Save Ad Copy"}
          </Btn>
        </div>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════
// SETTINGS VIEW
// ══════════════════════════════════════════════════════════════════
const DEFAULT_AI_PLATFORMS = [
  {id:"anthropic", name:"Anthropic (Claude)", logo:null, key:"", locked:true},
  {id:"openai",    name:"OpenAI (GPT)",       logo:null, key:""},
  {id:"google",    name:"Google (Gemini)",    logo:null, key:""},
];

const SettingsView = ({C, user, usersMeta, setUsersMeta}) => {
  const [stab, setStab]         = useState("api");
  const [platforms, setPlatforms] = useState([]);
  const [newPlat,  setNewPlat]  = useState({name:"",key:"",logo:null});
  const [addingPlat, setAddingPlat] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [showKey, setShowKey]   = useState({});
  const [saved,   setSaved]     = useState(false);

  // Load settings on mount
  useEffect(()=>{
    load(KEYS.settings,false).then(d=>{
      if(d?.platforms) setPlatforms(d.platforms);
      else setPlatforms(DEFAULT_AI_PLATFORMS);
    });
    // Load user photo
    const meta = usersMeta?.[user.id];
    if(meta?.photo) setProfilePhoto(meta.photo);
  },[user.id]);

  const saveSettings = async(plats) => {
    await persist(KEYS.settings,{platforms:plats},false);
    setSaved(true); setTimeout(()=>setSaved(false),2000);
  };

  const updatePlatKey = (id,val) => {
    const u = platforms.map(p=>p.id===id?{...p,key:val}:p);
    setPlatforms(u); saveSettings(u);
  };

  const updatePlatLogo = (id,logo) => {
    const u = platforms.map(p=>p.id===id?{...p,logo}:p);
    setPlatforms(u); saveSettings(u);
  };

  const deletePlat = (id) => {
    const u = platforms.filter(p=>p.id!==id);
    setPlatforms(u); saveSettings(u);
  };

  const addPlatform = () => {
    if(!newPlat.name.trim()) return;
    const plat = {id:uid(), name:newPlat.name.trim(), key:newPlat.key, logo:newPlat.logo};
    const u = [...platforms, plat];
    setPlatforms(u); saveSettings(u);
    setNewPlat({name:"",key:"",logo:null}); setAddingPlat(false);
  };

  const saveProfilePhoto = async(photo) => {
    setProfilePhoto(photo);
    const updated = {...(usersMeta||{}), [user.id]:{...(usersMeta?.[user.id]||{}), photo}};
    setUsersMeta(updated);
    await persist(KEYS.usersMeta, updated, false);
  };

  const INP={width:"100%",background:"transparent",border:"none",borderBottom:`1px solid ${C.inputBorder}`,
    borderRadius:0,color:C.inputColor,padding:"10px 0",fontSize:13,fontFamily:FONT,outline:"none"};
  const LBL={fontSize:10,color:C.gray500,fontFamily:FONT,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:4,display:"block"};
  const CARD={background:C.cardBg,border:`1px solid ${C.cardBorder}`,padding:24,marginBottom:16};
  const STABS=["api","profile"];

  return (
    <div>
      {/* Sub-tabs */}
      <div style={{display:"flex",gap:4,marginBottom:24,borderBottom:`1px solid ${C.divider}`,paddingBottom:0}}>
        {STABS.map(t=>(
          <button key={t} onClick={()=>setStab(t)} style={{
            padding:"8px 18px",background:"none",border:"none",borderBottom:`2px solid ${stab===t?C.blue:"transparent"}`,
            color:stab===t?C.blue:C.gray500,fontSize:10,fontFamily:FONT,fontWeight:700,letterSpacing:"0.12em",
            textTransform:"uppercase",cursor:"pointer",marginBottom:-1}}>
            {t==="api"?"AI Platforms & API Keys":"My Profile"}
          </button>
        ))}
      </div>

      {/* ── AI PLATFORMS ── */}
      {stab==="api" && (
        <div>
          <div style={{...CARD}}>
            <div style={{borderBottom:`2px solid ${C.blue}`,marginBottom:20,paddingBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:9,fontFamily:FONT,fontWeight:700,letterSpacing:"0.15em",color:C.blue,textTransform:"uppercase",marginBottom:2}}>AI INTEGRATIONS</div>
                <div style={{fontSize:15,fontFamily:FONT,fontWeight:800,color:C.textPrimary}}>AI Platforms & API Keys</div>
              </div>
              {saved&&<span style={{fontSize:10,fontFamily:FONT,fontWeight:700,color:C.success}}>✓ Saved</span>}
            </div>
            <div style={{fontSize:11,fontFamily:FONT,color:C.gray500,marginBottom:20}}>API keys are stored locally in your browser only — never shared or sent to any server.</div>

            {platforms.map(plat=>(
              <div key={plat.id} style={{display:"flex",gap:16,alignItems:"flex-start",padding:"16px 0",borderBottom:`1px solid ${C.divider}`}}>
                {/* Logo */}
                <div style={{flexShrink:0}}>
                  <label style={{cursor:"pointer",display:"block"}}>
                    <div style={{width:48,height:48,background:plat.logo?"transparent":C.rowBg,border:`2px dashed ${plat.logo?C.success:C.gray300}`,
                      display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",position:"relative"}}>
                      {plat.logo
                        ? <img src={plat.logo} alt="" style={{width:"100%",height:"100%",objectFit:"contain"}}/>
                        : <span style={{fontSize:18,color:C.gray500}}>🤖</span>
                      }
                    </div>
                    <input type="file" accept="image/*" style={{display:"none"}}
                      onChange={e=>{const f=e.target.files[0];if(f)readImage(f,img=>updatePlatLogo(plat.id,img));}}/>
                  </label>
                  <div style={{fontSize:8,fontFamily:FONT,color:C.gray500,textAlign:"center",marginTop:2}}>Logo</div>
                </div>

                {/* Name + Key */}
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontFamily:FONT,fontWeight:700,color:C.textPrimary,marginBottom:8}}>{plat.name}</div>
                  <label style={LBL}>API Key</label>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <input
                      type={showKey[plat.id]?"text":"password"}
                      style={{...INP,flex:1,fontFamily:"monospace",fontSize:12}}
                      placeholder="sk-..."
                      value={plat.key}
                      onChange={e=>updatePlatKey(plat.id,e.target.value)}
                    />
                    <button onClick={()=>setShowKey(s=>({...s,[plat.id]:!s[plat.id]}))}
                      style={{background:"none",border:`1px solid ${C.gray300}`,padding:"4px 8px",fontSize:10,fontFamily:FONT,color:C.gray500,cursor:"pointer",flexShrink:0}}>
                      {showKey[plat.id]?"Hide":"Show"}
                    </button>
                    {!plat.locked && (
                      <button onClick={()=>deletePlat(plat.id)}
                        style={{background:"none",border:`1px solid ${C.error}`,padding:"4px 8px",fontSize:10,fontFamily:FONT,color:C.error,cursor:"pointer",flexShrink:0}}>✕</button>
                    )}
                  </div>
                  {plat.id==="anthropic" && (
                    <div style={{fontSize:9,fontFamily:FONT,color:C.blueLight,marginTop:4}}>⚡ This key is used for all ad copy generation in this tool</div>
                  )}
                </div>
              </div>
            ))}

            {/* Add new platform */}
            {addingPlat ? (
              <div style={{marginTop:20,padding:16,background:C.rowBg,borderLeft:`3px solid ${C.blue}`}}>
                <div style={{fontSize:10,fontFamily:FONT,fontWeight:700,letterSpacing:"0.12em",color:C.blue,textTransform:"uppercase",marginBottom:16}}>New AI Platform</div>
                <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                  {/* Logo upload for new */}
                  <label style={{cursor:"pointer",flexShrink:0}}>
                    <div style={{width:48,height:48,background:newPlat.logo?"transparent":C.cardBg,border:`2px dashed ${newPlat.logo?C.success:C.gray300}`,
                      display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>
                      {newPlat.logo ? <img src={newPlat.logo} alt="" style={{width:"100%",height:"100%",objectFit:"contain"}}/> : <span style={{fontSize:20}}>＋</span>}
                    </div>
                    <input type="file" accept="image/*" style={{display:"none"}}
                      onChange={e=>{const f=e.target.files[0];if(f)readImage(f,img=>setNewPlat(p=>({...p,logo:img})));}}/>
                  </label>
                  <div style={{flex:1,display:"flex",flexDirection:"column",gap:12}}>
                    <div>
                      <label style={LBL}>Platform Name *</label>
                      <input style={INP} placeholder="e.g. Mistral AI" value={newPlat.name} onChange={e=>setNewPlat(p=>({...p,name:e.target.value}))}/>
                    </div>
                    <div>
                      <label style={LBL}>API Key</label>
                      <input style={{...INP,fontFamily:"monospace"}} type="password" placeholder="sk-..." value={newPlat.key} onChange={e=>setNewPlat(p=>({...p,key:e.target.value}))}/>
                    </div>
                  </div>
                </div>
                <div style={{display:"flex",gap:8,marginTop:16}}>
                  <Btn C={C} onClick={addPlatform}>Add Platform</Btn>
                  <Btn C={C} variant="ghost" onClick={()=>setAddingPlat(false)}>Cancel</Btn>
                </div>
              </div>
            ) : (
              <Btn C={C} variant="outline" onClick={()=>setAddingPlat(true)} style={{marginTop:16,fontSize:10}}>＋ Add AI Platform</Btn>
            )}
          </div>
        </div>
      )}

      {/* ── MY PROFILE ── */}
      {stab==="profile" && (
        <div style={CARD}>
          <div style={{borderBottom:`2px solid ${C.blue}`,marginBottom:20,paddingBottom:6}}>
            <div style={{fontSize:9,fontFamily:FONT,fontWeight:700,letterSpacing:"0.15em",color:C.blue,textTransform:"uppercase",marginBottom:2}}>ACCOUNT</div>
            <div style={{fontSize:15,fontFamily:FONT,fontWeight:800,color:C.textPrimary}}>My Profile</div>
          </div>
          <div style={{display:"flex",gap:24,alignItems:"flex-start",flexWrap:"wrap"}}>
            {/* Photo */}
            <div style={{flexShrink:0,textAlign:"center"}}>
              <label style={{cursor:"pointer",display:"block"}}>
                <div style={{width:80,height:80,background:profilePhoto?"transparent":C.blue,border:`2px dashed ${profilePhoto?C.success:C.gray300}`,
                  display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",marginBottom:8}}>
                  {profilePhoto
                    ? <img src={profilePhoto} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                    : <span style={{fontSize:28,fontFamily:FONT,fontWeight:800,color:"#fff"}}>{user.avatar}</span>
                  }
                </div>
                <input type="file" accept="image/*" style={{display:"none"}}
                  onChange={e=>{const f=e.target.files[0];if(f)readImage(f,img=>saveProfilePhoto(img));}}/>
                <div style={{fontSize:9,fontFamily:FONT,color:C.blue,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase"}}>Click to upload photo</div>
              </label>
            </div>
            <div style={{flex:1}}>
              <div style={{marginBottom:16}}>
                <label style={LBL}>Full Name</label>
                <div style={{fontSize:16,fontFamily:FONT,fontWeight:700,color:C.textPrimary,padding:"8px 0",borderBottom:`1px solid ${C.divider}`}}>{user.name}</div>
              </div>
              <div style={{marginBottom:16}}>
                <label style={LBL}>Email</label>
                <div style={{fontSize:13,fontFamily:FONT,color:C.textPrimary,padding:"8px 0",borderBottom:`1px solid ${C.divider}`}}>{user.email}</div>
              </div>
              <div>
                <label style={LBL}>Role</label>
                <div style={{fontSize:13,fontFamily:FONT,color:C.textPrimary,padding:"8px 0",borderBottom:`1px solid ${C.divider}`,textTransform:"capitalize"}}>{user.role}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════
// AGENCY VIEW
// ══════════════════════════════════════════════════════════════════
const AgencyView = ({C, user, archive, clients, setArchive, setClients, activity, setActivity, projects, setProjects, usersMeta, setUsersMeta}) => {
  const [tab,setTab]               = useState("generate");
  const [boardView,setBoardView]   = useState(true); // true=kanban, false=list
  const [apiKey,setApiKey]         = useState("");
  const [adTypes,setAdTypes]       = useState(["rsa"]);
  const [selClient,setSelClient]   = useState(null);
  const [selProject,setSelProject] = useState(null); // project id for generate
  const [form,setForm]             = useState({product:"",audience:"",usp:"",keywords:"",tone:"professional",ideas:"",avoid:"",url:""});
  const [briefDoc,setBriefDoc]     = useState(null);
  const [docDragging,setDocDragging] = useState(false);
  const [saveModal,setSaveModal]   = useState(null); // {adType, ads} — open save-to-project dialog
  const [result,setResult]         = useState(null);
  const [savedIds,setSavedIds]     = useState({});
  const [loading,setLoading]       = useState(false);
  const [error,setError]           = useState("");
  const [archFilter,setArchFilter] = useState("all");
  const [statusFilter,setStatusFilter]=useState("all");
  const [reviewEntry,setReviewEntry]=useState(null);
  const [briefEntry,setBriefEntry] = useState(null);
  const [clientForm,setClientForm] = useState({name:"",email:"",tone:"",cta:"",avoid:"",usp:"",photo:""});
  const [editingClient,setEditingClient]=useState(null);
  const [clientSaved,setClientSaved]=useState(false);

  const setF  =(k,v)=>setForm(f=>({...f,[k]:v}));
  const setCF =(k,v)=>setClientForm(f=>({...f,[k]:v}));
  const toggleAd=t=>setAdTypes(p=>p.includes(t)?p.filter(x=>x!==t):[...p,t]);
  const activeClient=clients.find(c=>c.id===selClient);

  const logActivity=useCallback(async(msg,color)=>{
    const item={id:uid(),msg,color:color||C.blue,user:user.name,time:ts()};
    const updated=[item,...(activity||[])].slice(0,50);
    setActivity(updated); await persist(KEYS.activity,updated);
  },[user,activity,setActivity,C]);

  // ── Brief document reader ────────────────────────────────────────
  const readDoc = useCallback((file) => {
    if (!file) return;
    const allowed = ["text/plain","application/pdf","application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!allowed.includes(file.type) && !file.name.match(/\.(txt|pdf|doc|docx)$/i)) {
      setError("Unsupported file type. Please drop a PDF, .txt, or Word document.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      // For PDFs we get binary — extract readable text only (best-effort)
      let content = "";
      if (file.type === "text/plain" || file.name.endsWith(".txt")) {
        content = e.target.result;
      } else {
        // PDF / Word: read as text with garbage filtered out
        const raw = e.target.result;
        // Extract runs of printable ASCII + common unicode
        content = (raw.match(/[\x20-\x7E\n\r\t\u00A0-\uFFFF]{4,}/g) || [])
          .filter(s => s.trim().length > 3 && /[a-zA-Z]{2,}/.test(s))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 8000); // cap at ~8k chars to stay within token budget
      }
      setBriefDoc({ name: file.name, content });
    };
    if (file.type === "text/plain" || file.name.endsWith(".txt")) {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }
  }, []);

  const generate=async()=>{
    if(!form.product.trim()){setError("Please enter a product or service.");return;}
    if(!adTypes.length){setError("Select at least one ad format.");return;}
    if(!SIM_MODE && !apiKey.trim()){setError("Please enter your Anthropic API key.");return;}
    setError(""); setLoading(true); setResult(null); setSavedIds({});

    // ── Simulation path ──────────────────────────────────────────
    if(SIM_MODE){
      await new Promise(r=>setTimeout(r,700));
      setResult(mockGenerate(form.product, adTypes, form.keywords, form.usp));
      await logActivity(`[SIM] Generated ${adTypes.map(t=>AD_LABELS[t]).join("+")} for "${form.product}"${activeClient?` (${activeClient.name})`:""}`);
      setLoading(false);
      return;
    }

    // ── Production path ──────────────────────────────────────────
    const brandCtx = activeClient
      ? `\nClient brand guidelines:\n- Name: ${activeClient.name}\n- Tone: ${activeClient.tone}\n- Preferred CTA: ${activeClient.cta}\n- Words to avoid: ${activeClient.avoid}\n- Brand USP: ${activeClient.usp}` : "";

    const ideasCtx  = form.ideas.trim()  ? `\n\nCreative angles and ideas to draw from:\n${form.ideas}` : "";
    const avoidCtx  = form.avoid.trim()  ? `\n\nThings to NEVER mention or imply:\n${form.avoid}` : "";
    const docCtx    = briefDoc?.content  ? `\n\n--- BRIEF DOCUMENT: ${briefDoc.name} ---\n${briefDoc.content}\n--- END BRIEF ---` : "";

    const typeInstr=adTypes.map(t=>{
      if(t==="rsa")     return `"rsa":{"headlines":["Exactly 15 headlines. H1-5: naturally include the target keyword. H6-10: highlight USP and key benefits. H11-15: strong CTAs. All max 30 chars — count carefully."],"descriptions":["Exactly 4 descriptions, each max 90 chars."]}`;
      if(t==="pmax")    return `"pmax":{"headlines":[5 items max 30 chars],"long_headlines":[5 items max 90 chars],"descriptions":[4 items max 90 chars]}`;
      if(t==="display") return `"display":{"headlines":[5 items max 30 chars],"descriptions":[5 items max 90 chars]}`;
      if(t==="shopping")return `"shopping":{"headlines":[3 items max 150 chars],"descriptions":[2 items max 5000 chars]}`;
      return "";
    }).join(",\n");

    const prompt = `You are an expert Google Ads copywriter. Write compelling, specific ad copy — never generic.

PRODUCT / SERVICE: ${form.product}
TARGET AUDIENCE: ${form.audience || "general"}
UNIQUE SELLING POINTS: ${form.usp || "not specified"}
TARGET KEYWORDS: ${form.keywords || "not specified"}
TONE OF VOICE: ${form.tone}${brandCtx}${ideasCtx}${avoidCtx}${docCtx}

STRICT RULES:
- Every character limit is a hard ceiling. Count every character.
- Be specific to this product. Never use filler phrases like "streamline operations" or "drive results" unless genuinely appropriate.
- Match the tone precisely.
- Respond ONLY with valid JSON, no preamble, no markdown fences.

JSON FORMAT:
{${typeInstr}}`;

    try {
      const res=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:2000,messages:[{role:"user",content:prompt}]})
      });
      const data=await res.json();
      const text=data.content.map(i=>i.text||"").join("").replace(/```json|```/g,"").trim();
      setResult(JSON.parse(text));
      await logActivity(`Generated ${adTypes.map(t=>AD_LABELS[t]).join("+")} for "${form.product}"${activeClient?` (${activeClient.name})`:""}`);
    } catch { setError("Generation failed — check your API key and try again."); }
    setLoading(false);
  };

  const archiveAd=useCallback(async(adType, projectId=null, projectName="")=>{
    const entry={id:uid(),date:now(),product:form.product,clientId:selClient||null,
      clientName:activeClient?.name||"",adType,ads:{[adType]:result[adType]},
      url:form.url||"",projectId:projectId||null,projectName:projectName||"",
      status:"draft",feedback:"",brief:{},createdBy:user.name};
    const updated=[entry,...archive];
    setArchive(updated); setSavedIds(s=>({...s,[adType]:true}));
    await persist(KEYS.archive,updated);
    await logActivity(`Saved ${AD_LABELS[adType]} for "${form.product}"${projectName?` → ${projectName}`:activeClient?` → ${activeClient.name}`:""}`);
  },[form,result,archive,selClient,activeClient,user,logActivity,setArchive]);

  const handleSaveToProject=useCallback(async(adType, projectId, projectName, newProject)=>{
    // If a new project was created, persist it first
    if(newProject){
      const updatedProjects=[newProject,...projects];
      setProjects(updatedProjects);
      await persist(KEYS.projects,updatedProjects);
    }
    await archiveAd(adType, projectId, projectName);
    setSaveModal(null);
  },[archiveAd,projects]);

  // ── Duplicate entry ──────────────────────────────────────────────
  const duplicateEntry=useCallback(async(entry)=>{
    const clone={...entry,id:uid(),date:now(),status:"draft",feedback:"",brief:{},createdBy:user.name,
      product:`${entry.product} (Copy)`,
      ads:JSON.parse(JSON.stringify(entry.ads))};
    const updated=[clone,...archive];
    setArchive(updated); await persist(KEYS.archive,updated);
    await logActivity(`Duplicated "${entry.product}" → editing as draft`);
    setTab("board"); setReviewEntry(clone);
  },[archive,user,logActivity,setArchive]);

  const updateEntry=useCallback(async(id,patch)=>{
    const updated=archive.map(e=>e.id===id?{...e,...patch}:e);
    setArchive(updated); await persist(KEYS.archive,updated);
    if(reviewEntry?.id===id) setReviewEntry(e=>({...e,...patch}));
    if(briefEntry?.id===id)  setBriefEntry(e=>({...e,...patch}));
    if(patch.status) await logActivity(`Status → "${STATUS_META(C)[patch.status]?.label}" for "${archive.find(e=>e.id===id)?.product}"`,STATUS_META(C)[patch.status]?.color);
  },[archive,reviewEntry,briefEntry,logActivity,setArchive,C]);

  const moveEntry=useCallback(async(id,newStatus)=>{
    const entry=archive.find(e=>e.id===id);
    if(!entry||entry.status===newStatus) return;
    await updateEntry(id,{status:newStatus});
    const meta=STATUS_META(C)[newStatus];
    await logActivity(`${meta?.icon||""} "${entry.product}" moved → ${meta?.label||newStatus}`,meta?.color||C.blue);
  },[archive,updateEntry,logActivity,C]);

  // ── Update a single ad field (for inline regen / edit) ───────────
  const updateAdField=useCallback(async(entryId,adType,field,items)=>{
    const updated=archive.map(e=>{
      if(e.id!==entryId) return e;
      return {...e,ads:{...e.ads,[adType]:{...e.ads[adType],[field]:items}}};
    });
    setArchive(updated); await persist(KEYS.archive,updated);
    if(reviewEntry?.id===entryId){
      setReviewEntry(e=>({...e,ads:{...e.ads,[adType]:{...e.ads[adType],[field]:items}}}));
    }
  },[archive,reviewEntry,setArchive]);

  const sendForInternalReview=useCallback(async(entry)=>{
    await updateEntry(entry.id,{status:"internal_review"});
    await logActivity(`👁 "${entry.product}" sent for internal review`,C.blueLight);
  },[updateEntry,logActivity,C]);

  const sendToClient=useCallback(async(entry)=>{
    if(!entry.clientName){setError("Assign a client before sending.");return;}
    await updateEntry(entry.id,{status:"pending"});
    await logActivity(`📤 "${entry.product}" sent to ${entry.clientName} for approval`,C.warning);
  },[updateEntry,logActivity,C,setError]);

  const deleteEntry=useCallback(async(id)=>{
    const updated=archive.filter(e=>e.id!==id);
    setArchive(updated); await persist(KEYS.archive,updated);
    if(reviewEntry?.id===id) setReviewEntry(null);
  },[archive,reviewEntry,setArchive]);

  const saveClient=async()=>{
    if(!clientForm.name.trim()) return;
    let updated;
    if(editingClient){ updated=clients.map(c=>c.id===editingClient?{...clientForm,id:editingClient}:c); }
    else { updated=[...clients,{...clientForm,id:uid()}]; }
    setClients(updated); await persist(KEYS.clients,updated);
    setClientForm({name:"",email:"",tone:"",cta:"",avoid:"",usp:"",photo:""});
    setEditingClient(null); setClientSaved(true);
    setTimeout(()=>setClientSaved(false),2000);
    await logActivity(`Client ${editingClient?"updated":"created"}: ${clientForm.name}`,C.blueLight);
  };

  const filtered=archive
    .filter(e=>archFilter==="all"||e.adType===archFilter)
    .filter(e=>statusFilter==="all"||e.status===statusFilter);

  const TABS=[
    {id:"generate", label:"Generate"},
    {id:"board",    label:`Board${archive.length?` (${archive.length})`:""}`},
    {id:"projects", label:`Projects${projects.length?` (${projects.length})`:""}`},
    {id:"clients",  label:`Clients${clients.length?` (${clients.length})`:""}`},
    {id:"activity", label:"Activity"},
    {id:"settings", label:"⚙ Settings"},
  ];

  const INP={width:"100%",background:"transparent",border:"none",borderBottom:`1px solid ${C.inputBorder}`,
    borderRadius:0,color:C.inputColor,padding:"10px 0",fontSize:13,fontFamily:FONT,outline:"none",boxSizing:"border-box"};
  const LBL={fontSize:10,color:C.gray500,fontFamily:FONT,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:4,display:"block"};
  const CARD={background:C.cardBg,border:`1px solid ${C.cardBorder}`,borderRadius:0,padding:24,marginBottom:16};
  const SD={borderBottom:`2px solid ${C.blue}`,marginBottom:20,paddingBottom:6};

  return (
    <div style={{maxWidth:820,margin:"0 auto",padding:"40px 24px"}}>
      {/* Brief modal */}
      {briefEntry && (
        <BriefModal C={C} entry={briefEntry} onClose={()=>setBriefEntry(null)}
          onSave={async(brief)=>{await updateEntry(briefEntry.id,{brief});setBriefEntry(null);await logActivity(`Brief updated for "${briefEntry.product}"`,C.blueLight);}}/>
      )}

      {/* Save to project modal */}
      {saveModal && (
        <SaveToProjectModal
          C={C}
          adType={saveModal.adType}
          forceClient={saveModal.forceClient||null}
          clients={clients}
          projects={projects}
          onSave={handleSaveToProject}
          onClose={()=>setSaveModal(null)}
        />
      )}

      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:32}}>
        <div>
          <div style={{fontSize:10,fontFamily:FONT,fontWeight:700,letterSpacing:"0.2em",color:C.blue,textTransform:"uppercase",marginBottom:6}}>JORGE MARTINS · GOOGLE ADS FREELANCER</div>
          <h1 style={{fontSize:28,fontWeight:900,fontFamily:FONT,letterSpacing:"-0.02em",color:C.textPrimary,margin:0}}>
            Ads Writer<span style={{color:C.blue}}>.</span>
          </h1>
          <div style={{fontSize:12,fontFamily:FONT,fontWeight:300,color:C.gray500,marginTop:4}}>RSA · PMax · Display · Shopping</div>
          <div style={{width:40,height:2,background:C.blue,marginTop:12}}/>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:12,fontFamily:FONT,fontWeight:700,color:C.textPrimary}}>{user.name}</div>
            <div style={{fontSize:9,fontFamily:FONT,fontWeight:700,letterSpacing:"0.12em",color:C.blue,textTransform:"uppercase"}}>AGENCY</div>
          </div>
          <div style={{width:36,height:36,borderRadius:0,background:C.blue,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:900,color:"#fff",fontFamily:FONT}}>{user.avatar}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:0,marginBottom:32,borderBottom:`1px solid ${C.divider}`}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>{setTab(t.id);setReviewEntry(null);}} style={{
            padding:"10px 20px",background:"none",border:"none",
            borderBottom:`2px solid ${tab===t.id?C.blue:"transparent"}`,
            color:tab===t.id?C.blue:C.gray500,
            fontSize:10,fontWeight:700,fontFamily:FONT,letterSpacing:"0.12em",textTransform:"uppercase",
            cursor:"pointer",transition:"all .15s",marginBottom:-1}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── GENERATE ── */}
      {tab==="generate" && (
        <div>
          <div style={CARD}>
            <div style={SD}><div style={{fontSize:11,fontFamily:FONT,fontWeight:700,letterSpacing:"0.15em",color:C.textPrimary,textTransform:"uppercase"}}>API Configuration</div></div>
            {SIM_MODE ? (
              <div style={{marginBottom:24,padding:"12px 16px",background:C.blueSubtle,borderLeft:`3px solid ${C.blue}`,display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontSize:18}}>🧪</span>
                <div>
                  <div style={{fontSize:11,fontFamily:FONT,fontWeight:700,color:C.blue,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:2}}>Simulation Mode — No API Key Needed</div>
                  <div style={{fontSize:11,fontFamily:FONT,fontWeight:300,color:C.gray500}}>Generation uses realistic mock data. Set <code style={{fontFamily:"monospace",color:C.blue}}>SIM_MODE = false</code> before deploying to enable the real Claude API.</div>
                </div>
              </div>
            ) : (
              <div style={{marginBottom:24}}>
                <label style={LBL}>Anthropic API Key</label>
                <input style={{...INP,fontFamily:"monospace",fontSize:12}} type="password" placeholder="sk-ant-..." value={apiKey} onChange={e=>setApiKey(e.target.value)}/>
                <div style={{fontSize:10,fontFamily:FONT,fontWeight:400,color:C.gray500,marginTop:6}}>Used in-session only · <span style={{color:C.blue,fontWeight:600}}>console.anthropic.com</span></div>
              </div>
            )}

            <div style={SD}><div style={{fontSize:11,fontFamily:FONT,fontWeight:700,letterSpacing:"0.15em",color:C.textPrimary,textTransform:"uppercase"}}>Campaign Setup</div></div>

            <div style={{marginBottom:20}}>
              <label style={LBL}>Client Profile</label>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:8}}>
                <Pill C={C} active={!selClient} color={C.textPrimary} onClick={()=>setSelClient(null)}>No Client</Pill>
                {clients.map(c=><Pill key={c.id} C={C} active={selClient===c.id} color={C.blue} onClick={()=>setSelClient(c.id)}>{c.name}</Pill>)}
              </div>
            </div>

            <div style={{marginBottom:20}}>
              <label style={LBL}>Ad Formats</label>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:8}}>
                {Object.entries(AD_LABELS).map(([t,l])=><Pill key={t} C={C} active={adTypes.includes(t)} color={AD_COLORS(C)[t]} onClick={()=>toggleAd(t)}>{l}</Pill>)}
              </div>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"20px 24px"}}>
              <div style={{gridColumn:"1/-1"}}>
                <label style={LBL}>Product / Service *</label>
                <input style={INP} placeholder="e.g. artisan dark chocolate bars" value={form.product} onChange={e=>setF("product",e.target.value)}/>
              </div>
              <div>
                <label style={{...LBL,display:"flex",alignItems:"center"}}>Target Audience <TooltipIcon C={C} text="Who should see this ad? Be specific — age, role, intent. e.g. 'gift buyers aged 25–45 searching for premium chocolate'"/></label>
                <input style={INP} placeholder="e.g. gift buyers aged 25–45" value={form.audience} onChange={e=>setF("audience",e.target.value)}/>
              </div>
              <div>
                <label style={LBL}>Tone of Voice</label>
                <select style={{...INP,cursor:"pointer"}} value={form.tone} onChange={e=>setF("tone",e.target.value)}>
                  {["Professional","Friendly","Urgent","Authoritative","Playful","Luxury","Conversational"].map(t=><option key={t} value={t.toLowerCase()} style={{background:C.cardBg,color:C.textPrimary}}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{...LBL,display:"flex",alignItems:"center"}}>Unique Selling Points <TooltipIcon C={C} text="What makes this product stand out? Be concrete — 'single-origin Ecuadorian cocoa' beats 'high quality'"/></label>
                <input style={INP} placeholder="e.g. single-origin cocoa, handmade, vegan" value={form.usp} onChange={e=>setF("usp",e.target.value)}/>
              </div>
              <div>
                <label style={{...LBL,display:"flex",alignItems:"center"}}>Target Keywords <TooltipIcon C={C} text="The search terms your audience uses. First keyword is used as the primary RSA keyword group."/></label>
                <input style={INP} placeholder="e.g. artisan chocolate, dark chocolate bars" value={form.keywords} onChange={e=>setF("keywords",e.target.value)}/>
              </div>
              <div style={{gridColumn:"1/-1"}}>
                <label style={LBL}>Display URL</label>
                <input style={INP} placeholder="e.g. www.yoursite.com/chocolate" value={form.url} onChange={e=>setF("url",e.target.value)}/>
                <div style={{fontSize:10,fontFamily:FONT,color:C.gray500,marginTop:4}}>Used in the ad preview simulator — shown as the green URL line in Google Search results</div>
              </div>
            </div>

            {/* ── Creative direction ── */}
            <div style={{marginTop:24,paddingTop:20,borderTop:`1px solid ${C.divider}`}}>
              <div style={{fontSize:10,fontFamily:FONT,fontWeight:700,letterSpacing:"0.15em",color:C.gray500,textTransform:"uppercase",marginBottom:16}}>Creative Direction <span style={{fontWeight:400,letterSpacing:0,textTransform:"none",fontSize:10}}>(optional)</span></div>

              <div style={{marginBottom:20}}>
                <label style={{...LBL,display:"flex",alignItems:"center"}}>Ideas & Angles to Include <TooltipIcon C={C} text="Specific creative hooks for Claude to draw from — sensory details, stories, occasions. The more specific, the better the copy."/></label>
                <textarea
                  style={{...INP,resize:"vertical",minHeight:80,paddingTop:8,lineHeight:1.6}}
                  placeholder={"e.g. mention the snap sound when you break it, the gifting occasion angle, the Ecuadorian origin story, seasonal limited edition"}
                  value={form.ideas}
                  onChange={e=>setF("ideas",e.target.value)}
                />
              </div>

              <div style={{marginBottom:20}}>
                <label style={{...LBL,display:"flex",alignItems:"center"}}>Things to Avoid <TooltipIcon C={C} text="Hard constraints — words, claims, or topics Claude must never use in the generated copy."/></label>
                <textarea
                  style={{...INP,resize:"vertical",minHeight:60,paddingTop:8,lineHeight:1.6}}
                  placeholder={"e.g. don't mention price, avoid health claims, no competitor names, don't use the word 'premium'"}
                  value={form.avoid}
                  onChange={e=>setF("avoid",e.target.value)}
                />
              </div>

              {/* Drop zone */}
              <div>
                <label style={LBL}>Brief Document <span style={{fontWeight:400,letterSpacing:0,textTransform:"none",fontSize:10}}>(PDF, .txt, .doc)</span></label>
                <div
                  onDragOver={e=>{e.preventDefault();setDocDragging(true);}}
                  onDragLeave={()=>setDocDragging(false)}
                  onDrop={e=>{e.preventDefault();setDocDragging(false);const f=e.dataTransfer.files[0];if(f)readDoc(f);}}
                  onClick={()=>document.getElementById("brief-file-input").click()}
                  style={{
                    border:`2px dashed ${docDragging?C.blue:briefDoc?C.success:C.gray300}`,
                    background:docDragging?C.blueSubtle:briefDoc?`${C.success}0A`:C.rowBg,
                    padding:"20px 16px",cursor:"pointer",transition:"all .15s",
                    display:"flex",alignItems:"center",gap:14,
                  }}
                >
                  <span style={{fontSize:22}}>{briefDoc?"📄":"📂"}</span>
                  <div style={{flex:1}}>
                    {briefDoc ? (
                      <>
                        <div style={{fontSize:12,fontFamily:FONT,fontWeight:700,color:C.success}}>{briefDoc.name}</div>
                        <div style={{fontSize:10,fontFamily:FONT,color:C.gray500,marginTop:2}}>{briefDoc.content.length.toLocaleString()} chars extracted · Claude will read this before writing</div>
                      </>
                    ) : (
                      <>
                        <div style={{fontSize:12,fontFamily:FONT,fontWeight:600,color:C.textPrimary}}>Drop a brief document here</div>
                        <div style={{fontSize:10,fontFamily:FONT,color:C.gray500,marginTop:2}}>PDF, .txt, or Word — Claude will use it as context when writing copy</div>
                      </>
                    )}
                  </div>
                  {briefDoc && (
                    <button onClick={e=>{e.stopPropagation();setBriefDoc(null);}}
                      style={{background:"none",border:`1px solid ${C.gray300}`,color:C.gray500,borderRadius:0,padding:"4px 10px",fontSize:9,fontFamily:FONT,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",cursor:"pointer"}}>
                      Remove
                    </button>
                  )}
                </div>
                <input id="brief-file-input" type="file" accept=".pdf,.txt,.doc,.docx"
                  style={{display:"none"}}
                  onChange={e=>{const f=e.target.files[0];if(f)readDoc(f);e.target.value="";}}
                />
                <div style={{fontSize:10,fontFamily:FONT,color:C.gray500,marginTop:4}}>You can also click to browse files</div>
              </div>
            </div>

            {error && <div style={{marginTop:16,padding:"10px 14px",background:"#FEE8EA",borderLeft:`3px solid ${C.error}`,fontSize:11,fontFamily:FONT,fontWeight:600,color:C.error}}>{error}</div>}
            <div style={{marginTop:24}}>
              <Btn C={C} onClick={generate} disabled={loading} style={{width:"100%",padding:14,fontSize:12}}>
                {loading?"Generating…":`Generate ${adTypes.map(t=>AD_LABELS[t]).join(" + ")} →`}
              </Btn>
            </div>
          </div>

          {result && (
            <div>
              <div style={{fontSize:9,fontFamily:FONT,fontWeight:700,letterSpacing:"0.2em",color:C.blue,textTransform:"uppercase",marginBottom:16}}>— GENERATED COPY</div>
              {/* Two-column: copy list left, RSA preview right */}
              <div style={{display:"grid",gridTemplateColumns:result.rsa?"1fr 1fr":"1fr",gap:24,alignItems:"start"}}>
                {/* Left — all format cards */}
                <div>
                  {adTypes.map(type=>result[type]&&(
                    <div key={type} style={CARD}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16,gap:12}}>
                        {/* Left: format tag + group badges stacked */}
                        <div style={{display:"flex",flexDirection:"column",gap:6}}>
                          <Tag C={C} color={AD_COLORS(C)[type]}>{AD_LABELS[type]}</Tag>
                          {type==="rsa" && (
                            <div style={{display:"flex",gap:4}}>
                              <span style={{fontSize:8,fontFamily:FONT,fontWeight:700,color:C.blue,    border:`1px solid ${C.blue}`,    padding:"2px 7px",letterSpacing:"0.08em",textTransform:"uppercase"}}>5 Keyword</span>
                              <span style={{fontSize:8,fontFamily:FONT,fontWeight:700,color:C.success, border:`1px solid ${C.success}`, padding:"2px 7px",letterSpacing:"0.08em",textTransform:"uppercase"}}>5 USP</span>
                              <span style={{fontSize:8,fontFamily:FONT,fontWeight:700,color:C.warning, border:`1px solid ${C.warning}`, padding:"2px 7px",letterSpacing:"0.08em",textTransform:"uppercase"}}>5 CTA</span>
                            </div>
                          )}
                        </div>
                        {/* Right: save button */}
                        {!savedIds[type]
                          ? <Btn C={C} variant="outline" onClick={()=>setSaveModal({adType:type})} style={{fontSize:9,padding:"5px 12px",flexShrink:0}}>＋ Save to Project</Btn>
                          : <span style={{fontSize:10,fontFamily:FONT,fontWeight:700,color:C.success,letterSpacing:"0.08em",flexShrink:0}}>✓ SAVED</span>
                        }
                      </div>

                      {/* RSA: show headlines in colour-coded groups */}
                      {type==="rsa" ? (
                        <>
                          {[
                            {label:"Keyword Headlines",  items:(result.rsa.headlines||[]).slice(0,5),  color:C.blue},
                            {label:"USP Headlines",      items:(result.rsa.headlines||[]).slice(5,10), color:C.success},
                            {label:"CTA Headlines",      items:(result.rsa.headlines||[]).slice(10,15),color:C.warning},
                          ].map(({label,items,color})=>(
                            <div key={label} style={{marginBottom:14}}>
                              <div style={{fontSize:9,fontFamily:FONT,fontWeight:700,letterSpacing:"0.15em",color,textTransform:"uppercase",marginBottom:6,paddingBottom:3,borderBottom:`1px solid ${color}30`}}>
                                {label} ({items.length})
                              </div>
                              {items.map((h,i)=>(
                                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.rowBg,padding:"7px 10px",marginBottom:3,borderLeft:`2px solid ${color}`}}>
                                  <span style={{fontSize:12,fontFamily:FONT,color:C.textPrimary,flex:1}}>{h}</span>
                                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                                    <span style={{fontSize:9,fontFamily:FONT,fontWeight:700,color:h.length>30?C.error:C.gray500}}>{h.length}/30</span>
                                    <CopyBtn C={C} text={h}/>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ))}
                          <AdSection C={C} label="Descriptions" items={result.rsa.descriptions||[]} max={90}/>
                        </>
                      ) : (
                        <>
                          <AdSection C={C} label="Headlines"      items={result[type].headlines||[]}      max={LIMITS[type]?.headline||30}/>
                          <AdSection C={C} label="Long Headlines" items={result[type].long_headlines||[]} max={90}/>
                          <AdSection C={C} label="Descriptions"   items={result[type].descriptions||[]}   max={LIMITS[type]?.description||90}/>
                        </>
                      )}
                    </div>
                  ))}
                </div>

                {/* Right — RSA live preview (only when RSA is in results) */}
                {result.rsa && (
                  <RSAPreview
                    C={C}
                    headlines={result.rsa.headlines||[]}
                    descriptions={result.rsa.descriptions||[]}
                    url={form.url || (activeClient?.email ? activeClient.email.split("@")[1] : "www.yourdomain.com")}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── BOARD ── */}
      {tab==="board" && !reviewEntry && (
        <div>
          {/* Toolbar */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10,marginBottom:16}}>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              <Pill C={C} active={archFilter==="all"} color={C.textPrimary} onClick={()=>setArchFilter("all")}>All Formats</Pill>
              {Object.entries(AD_LABELS).map(([t,l])=><Pill key={t} C={C} active={archFilter===t} color={AD_COLORS(C)[t]} onClick={()=>setArchFilter(t)}>{l}</Pill>)}
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              {archive.length>0 && <Btn C={C} variant="ghost" onClick={()=>dlCSV(toCSV(archive),`archive-${Date.now()}.csv`)} style={{fontSize:9,padding:"6px 12px"}}>↓ CSV</Btn>}
              <div style={{display:"flex",border:`1px solid ${C.cardBorder}`}}>
                <button onClick={()=>setBoardView(true)} style={{padding:"5px 12px",background:boardView?C.blue:"transparent",color:boardView?"#fff":C.gray500,border:"none",cursor:"pointer",fontSize:9,fontFamily:FONT,fontWeight:700}}>▦ Board</button>
                <button onClick={()=>setBoardView(false)} style={{padding:"5px 12px",background:!boardView?C.blue:"transparent",color:!boardView?"#fff":C.gray500,border:"none",cursor:"pointer",fontSize:9,fontFamily:FONT,fontWeight:700}}>≡ List</button>
              </div>
            </div>
          </div>

          {archive.length===0 ? (
            <div style={{...CARD,textAlign:"center",padding:"56px 24px",borderLeft:`3px solid ${C.blue}`}}>
              <span style={{fontSize:11,fontFamily:FONT,color:C.gray500,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase"}}>No ads saved yet. Generate ads and click ＋ Save to Project.</span>
            </div>
          ) : boardView ? (
            /* ─ Kanban ─ */
            <div style={{overflowX:"auto",paddingBottom:16}}>
              <KanbanBoard
                C={C}
                archive={archFilter==="all"?archive:archive.filter(e=>e.adType===archFilter)}
                clients={clients}
                onOpenEntry={e=>{setReviewEntry(e);}}
                onMoveEntry={moveEntry}
              />
            </div>
          ) : (
            /* ─ List ─ */
            <div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14,alignItems:"center"}}>
                {["all","draft","internal_review","pending","approved","changes"].map(s=>(
                  <Pill key={s} C={C} active={statusFilter===s} color={s==="all"?C.textPrimary:STATUS_META(C)[s]?.color} onClick={()=>setStatusFilter(s)}>
                    {s==="all"?"All Status":STATUS_META(C)[s]?.label}
                  </Pill>
                ))}
              </div>
              {filtered.length===0
                ? <div style={{...CARD,textAlign:"center",padding:"40px 24px"}}><span style={{fontSize:11,fontFamily:FONT,color:C.gray500,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase"}}>No ads match current filters.</span></div>
                : filtered.map(entry=>(
                  <div key={entry.id} style={CARD}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                      <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                        <Tag C={C} color={AD_COLORS(C)[entry.adType]||C.blue}>{AD_LABELS[entry.adType]}</Tag>
                        <span style={{fontSize:13,fontFamily:FONT,fontWeight:700,color:C.textPrimary}}>{entry.product}</span>
                        {entry.clientName && <span style={{fontSize:11,fontFamily:FONT,color:C.gray500}}>· {entry.clientName}</span>}
                        <StatusBadge C={C} status={entry.status}/>
                        {entry.brief && Object.values(entry.brief).some(v=>v) &&
                          <span style={{fontSize:9,fontFamily:FONT,fontWeight:700,letterSpacing:"0.1em",color:C.blueLight,textTransform:"uppercase"}}>📋 BRIEF</span>
                        }
                      </div>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                        <span style={{fontSize:10,fontFamily:FONT,color:C.gray500,alignSelf:"center"}}>{entry.date}</span>
                        <Btn C={C} variant="ghost"   onClick={()=>setBriefEntry(entry)}   style={{fontSize:9,padding:"5px 12px"}}>📋 Brief</Btn>
                        <Btn C={C} variant="ghost"   onClick={()=>duplicateEntry(entry)}  style={{fontSize:9,padding:"5px 12px"}}>⧉ Dupe</Btn>
                        <Btn C={C} variant="outline" onClick={()=>setReviewEntry(entry)}  style={{fontSize:9,padding:"5px 12px"}}>Review</Btn>
                        {entry.status==="draft"           && <Btn C={C} variant="secondary" onClick={()=>sendForInternalReview(entry)} style={{fontSize:9,padding:"5px 12px"}}>👁 Internal Review</Btn>}
                        {entry.status==="internal_review" && <Btn C={C} variant="warning"   onClick={()=>sendToClient(entry)}          style={{fontSize:9,padding:"5px 12px"}}>📤 Send to Client</Btn>}
                        {entry.status==="changes"         && <Btn C={C} variant="danger"    onClick={()=>setReviewEntry(entry)}        style={{fontSize:9,padding:"5px 12px"}}>🔁 Edit & Re-send</Btn>}
                        <Btn C={C} variant="danger" onClick={()=>deleteEntry(entry.id)} style={{fontSize:9,padding:"5px 10px"}}>✕</Btn>
                      </div>
                    </div>
                    {entry.feedback && <div style={{marginTop:10,padding:"8px 12px",background:C.rowBg,borderLeft:`2px solid ${C.warning}`,fontSize:11,color:C.gray700,fontFamily:FONT}}>💬 {entry.feedback}</div>}
                  </div>
                ))
              }
            </div>
          )}
        </div>
      )}

      {/* ── REVIEW / EDIT PANEL ── */}
      {tab==="board" && reviewEntry && (
        <div>
          <button onClick={()=>setReviewEntry(null)} style={{background:"none",border:"none",color:C.gray500,fontSize:11,fontFamily:FONT,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",cursor:"pointer",marginBottom:20,padding:0}}>← Back to Board</button>

          {/* Pipeline banner */}
          <PipelineBanner C={C} status={reviewEntry.status||"draft"}/>

          {/* Product name editable */}
          <div style={CARD}>
            <div style={{...SD}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
                <div style={{flex:1}}>
                  <label style={{fontSize:10,color:C.gray500,fontFamily:FONT,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:4,display:"block"}}>Product Name</label>
                  <input style={{background:"transparent",border:"none",borderBottom:`1px solid ${C.inputBorder}`,color:C.textPrimary,fontSize:18,fontWeight:800,fontFamily:FONT,outline:"none",width:"100%",padding:"4px 0"}}
                    value={reviewEntry.product} onChange={e=>setReviewEntry(r=>({...r,product:e.target.value}))}
                    onBlur={()=>updateEntry(reviewEntry.id,{product:reviewEntry.product})}/>
                  <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginTop:8}}>
                    {reviewEntry.clientName && <span style={{fontSize:11,fontFamily:FONT,fontWeight:600,color:C.gray500}}>{reviewEntry.clientName}</span>}
                    <StatusBadge C={C} status={reviewEntry.status}/>
                    <span style={{fontSize:10,fontFamily:FONT,color:C.gray500}}>{reviewEntry.date} · by {reviewEntry.createdBy}</span>
                  </div>
                </div>
                {/* Context-sensitive primary actions */}
                <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"flex-start"}}>
                  <Tooltip C={C} text="Add campaign brief, objectives and audience notes">
                    <Btn C={C} variant="ghost" onClick={()=>setBriefEntry(reviewEntry)} style={{fontSize:9,padding:"7px 14px"}}>📋 Brief</Btn>
                  </Tooltip>
                  <Tooltip C={C} text="Clone this ad set as a new draft">
                    <Btn C={C} variant="ghost" onClick={()=>duplicateEntry(reviewEntry)} style={{fontSize:9,padding:"7px 14px"}}>⧉ Duplicate</Btn>
                  </Tooltip>

                  {/* Step 1 → 2: draft → internal review */}
                  {reviewEntry.status==="draft" && (
                    <Tooltip C={C} text="Mark as ready for a teammate to check internally — client won't see it yet">
                      <Btn C={C} variant="secondary" onClick={()=>sendForInternalReview(reviewEntry)} style={{fontSize:9,padding:"7px 14px"}}>👁 Send for Internal Review</Btn>
                    </Tooltip>
                  )}

                  {/* Step 2 → 3: internal_review → sent to client */}
                  {reviewEntry.status==="internal_review" && (
                    <Tooltip C={C} text="Internally approved — send to the client for their sign-off">
                      <Btn C={C} variant="warning" onClick={()=>sendToClient(reviewEntry)} style={{fontSize:9,padding:"7px 14px"}}>📤 Send to Client</Btn>
                    </Tooltip>
                  )}

                  {/* Internal approve shortcut — bypass client step if needed */}
                  {(reviewEntry.status==="draft"||reviewEntry.status==="internal_review") && (
                    <Tooltip C={C} text="Skip client approval and mark as approved directly (internal use)">
                      <Btn C={C} variant="success" onClick={()=>updateEntry(reviewEntry.id,{status:"approved"})} style={{fontSize:9,padding:"7px 14px"}}>✅ Approve Internally</Btn>
                    </Tooltip>
                  )}

                  {/* Client has requested changes — back to draft */}
                  {reviewEntry.status==="changes" && (
                    <Tooltip C={C} text="Mark as back in draft so the team knows it's being reworked">
                      <Btn C={C} variant="danger" onClick={()=>updateEntry(reviewEntry.id,{status:"draft"})} style={{fontSize:9,padding:"7px 14px"}}>🔁 Back to Draft</Btn>
                    </Tooltip>
                  )}

                  {/* Already sent to client — allow recalling */}
                  {reviewEntry.status==="pending" && (
                    <Tooltip C={C} text="Recall from client and return to internal review">
                      <Btn C={C} variant="ghost" onClick={()=>updateEntry(reviewEntry.id,{status:"internal_review"})} style={{fontSize:9,padding:"7px 14px"}}>↩ Recall</Btn>
                    </Tooltip>
                  )}
                </div>
              </div>
            </div>

            <div style={{padding:"10px 14px",background:C.blueSubtle,borderLeft:`3px solid ${C.blue}`,marginBottom:16,fontSize:11,fontFamily:FONT}}>
              <span style={{fontWeight:700,color:C.blue}}>🔗 Client Approval URL</span><br/>
              <span style={{fontFamily:"monospace",color:C.blueLight,fontSize:11}}>ads.yourdomain.com/approve/{reviewEntry.id}</span>
            </div>

            <label style={{fontSize:10,color:C.gray500,fontFamily:FONT,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:4,display:"block"}}>Agency Notes</label>
            <textarea style={{width:"100%",background:"transparent",border:"none",borderBottom:`1px solid ${C.inputBorder}`,borderRadius:0,color:C.inputColor,padding:"8px 0",fontSize:13,fontFamily:FONT,outline:"none",resize:"vertical",minHeight:72}}
              placeholder="Internal notes or client feedback…"
              value={reviewEntry.feedback||""} onChange={e=>setReviewEntry(r=>({...r,feedback:e.target.value}))}/>
            <Btn C={C} variant="ghost" onClick={()=>updateEntry(reviewEntry.id,{feedback:reviewEntry.feedback})} style={{marginTop:10,fontSize:9,padding:"6px 14px"}}>Save Notes</Btn>
          </div>

          {/* Editable ad copy with per-line regen */}
          {Object.entries(reviewEntry.ads||{}).map(([type,ad])=>{
            const lim=LIMITS[type]||LIMITS.rsa;
            return (
              <div key={type} style={CARD}>
                <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:14}}>
                  <Tag C={C} color={AD_COLORS(C)[type]||C.blue}>{AD_LABELS[type]}</Tag>
                  <span style={{fontSize:9,fontFamily:FONT,fontWeight:700,color:C.gray500,letterSpacing:"0.1em",textTransform:"uppercase"}}>Click any line to edit · ↺ to regenerate individually</span>
                </div>
                {(ad.headlines||[]).length>0 && (
                  <AdSectionEditable C={C} label="Headlines" field="headlines" items={ad.headlines} max={lim.headline}
                    adType={type} product={reviewEntry.product} apiKey={apiKey}
                    onUpdate={(field,items)=>updateAdField(reviewEntry.id,type,field,items)}/>
                )}
                {(ad.long_headlines||[]).length>0 && (
                  <AdSectionEditable C={C} label="Long Headlines" field="long_headlines" items={ad.long_headlines} max={lim.long_headline||90}
                    adType={type} product={reviewEntry.product} apiKey={apiKey}
                    onUpdate={(field,items)=>updateAdField(reviewEntry.id,type,field,items)}/>
                )}
                {(ad.descriptions||[]).length>0 && (
                  <AdSectionEditable C={C} label="Descriptions" field="descriptions" items={ad.descriptions} max={lim.description}
                    adType={type} product={reviewEntry.product} apiKey={apiKey}
                    onUpdate={(field,items)=>updateAdField(reviewEntry.id,type,field,items)}/>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── CLIENTS ── */}
      {tab==="clients" && (
        <div>
          <div style={CARD}>
            <div style={SD}><div style={{fontSize:11,fontFamily:FONT,fontWeight:700,letterSpacing:"0.15em",color:C.textPrimary,textTransform:"uppercase"}}>{editingClient?"Edit Client":"Add Client Profile"}</div></div>
            <div style={{display:"flex",gap:20,alignItems:"flex-start",marginBottom:20}}>
              {/* Client photo upload */}
              <label style={{cursor:"pointer",flexShrink:0,textAlign:"center"}}>
                <div style={{width:64,height:64,background:clientForm.photo?"transparent":C.blue,border:`2px dashed ${clientForm.photo?C.success:C.gray300}`,
                  display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",marginBottom:4}}>
                  {clientForm.photo
                    ? <img src={clientForm.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                    : <span style={{fontSize:22,fontFamily:FONT,fontWeight:800,color:"#fff"}}>{clientForm.name?clientForm.name[0]:"+"}</span>
                  }
                </div>
                <input type="file" accept="image/*" style={{display:"none"}}
                  onChange={e=>{const f=e.target.files[0];if(f)readImage(f,img=>setCF("photo",img));}}/>
                <div style={{fontSize:8,fontFamily:FONT,color:C.gray500,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase"}}>Logo / Photo</div>
              </label>
              {/* Fields */}
              <div style={{flex:1,display:"grid",gridTemplateColumns:"1fr 1fr",gap:"16px 24px"}}>
                {[["name","Name *","Acme Corp"],["email","Email","client@acme.com"],["tone","Tone of Voice","professional, warm"],["cta","Preferred CTA","Get a Free Quote"],["avoid","Words to Avoid","cheap, discount"],["usp","Brand USP","UK's #1 provider…"]].map(([k,l,p])=>(
                  <div key={k}><label style={LBL}>{l}</label><input style={INP} placeholder={p} value={clientForm[k]||""} onChange={e=>setCF(k,e.target.value)}/></div>
                ))}
              </div>
            </div>
            <div style={{display:"flex",gap:12,marginTop:8}}>
              <Btn C={C} onClick={saveClient} style={{minWidth:160}}>{clientSaved?"✓ Saved":editingClient?"Update Client":"Save Client"}</Btn>
              {editingClient && <Btn C={C} variant="ghost" onClick={()=>{setEditingClient(null);setClientForm({name:"",email:"",tone:"",cta:"",avoid:"",usp:"",photo:""});}}>Cancel</Btn>}
            </div>
          </div>
          {clients.length===0
            ? <div style={{...CARD,textAlign:"center",padding:"40px 24px",borderLeft:`3px solid ${C.blue}`}}><span style={{fontSize:11,fontFamily:FONT,color:C.gray500,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase"}}>No clients yet.</span></div>
            : clients.map(c=>(
              <div key={c.id} style={{...CARD,display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
                <div style={{display:"flex",gap:14,alignItems:"center"}}>
                  <Avatar photo={c.photo} initial={c.name[0]} size={40} color={C.blue} C={C}/>
                  <div>
                    <div style={{fontSize:14,fontWeight:700,fontFamily:FONT,color:C.textPrimary,marginBottom:2}}>{c.name}</div>
                    <div style={{fontSize:11,fontFamily:FONT,color:C.gray500,fontWeight:300}}>{c.email}{c.tone&&` · ${c.tone}`} · {archive.filter(e=>e.clientId===c.id).length} ads</div>
                  </div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <Btn C={C} variant="ghost" onClick={()=>{setClientForm(c);setEditingClient(c.id);}} style={{fontSize:9,padding:"5px 12px"}}>Edit</Btn>
                  <Btn C={C} variant="danger" onClick={async()=>{const u=clients.filter(x=>x.id!==c.id);setClients(u);await persist(KEYS.clients,u);}} style={{fontSize:9,padding:"5px 10px"}}>✕</Btn>
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* ── PROJECTS ── */}
      {tab==="projects" && (
        <div>
          {clients.length===0 ? (
            <div style={{...CARD,textAlign:"center",padding:"56px 24px",borderLeft:`3px solid ${C.blue}`}}>
              <div style={{fontSize:11,fontFamily:FONT,color:C.gray500,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase"}}>Add clients first, then create projects to organise their ads.</div>
            </div>
          ) : (
            clients.map(client=>{
              const clientProjs = projects.filter(p=>p.clientId===client.id);
              const unassigned  = archive.filter(e=>e.clientId===client.id && !e.projectId);
              return (
                <div key={client.id} style={{marginBottom:32}}>
                  {/* Client header */}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,paddingBottom:8,borderBottom:`2px solid ${C.blue}`}}>
                    <div>
                      <div style={{fontSize:14,fontFamily:FONT,fontWeight:800,color:C.textPrimary}}>{client.name}</div>
                      <div style={{fontSize:10,fontFamily:FONT,color:C.gray500}}>{clientProjs.length} project{clientProjs.length!==1?"s":""} · {archive.filter(e=>e.clientId===client.id).length} ads total</div>
                    </div>
                    <Btn C={C} variant="outline" style={{fontSize:9,padding:"5px 14px"}}
                      onClick={()=>{setSaveModal({adType:null,forceClient:client.id});}}>
                      ＋ New Project
                    </Btn>
                  </div>

                  {clientProjs.length===0 && unassigned.length===0 && (
                    <div style={{padding:"16px",background:C.rowBg,fontSize:11,fontFamily:FONT,color:C.gray500,textAlign:"center"}}>No projects or saved ads yet for {client.name}.</div>
                  )}

                  {/* Projects */}
                  {clientProjs.map(proj=>{
                    const projAds = archive.filter(e=>e.projectId===proj.id);
                    return (
                      <div key={proj.id} style={{...CARD,marginBottom:12}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                          <div>
                            <div style={{fontSize:13,fontFamily:FONT,fontWeight:700,color:C.textPrimary,marginBottom:2}}>📁 {proj.name}</div>
                            {proj.desc && <div style={{fontSize:11,fontFamily:FONT,color:C.gray500}}>{proj.desc}</div>}
                            <div style={{fontSize:10,fontFamily:FONT,color:C.gray500,marginTop:2}}>Created {proj.created} · {projAds.length} ad{projAds.length!==1?"s":""}</div>
                          </div>
                          <Btn C={C} variant="danger" style={{fontSize:9,padding:"4px 10px"}}
                            onClick={async()=>{
                              const u=projects.filter(p=>p.id!==proj.id);
                              setProjects(u); await persist(KEYS.projects,u);
                            }}>✕</Btn>
                        </div>
                        {projAds.length===0 ? (
                          <div style={{fontSize:11,fontFamily:FONT,color:C.gray500,padding:"10px 0"}}>No ads saved to this project yet.</div>
                        ) : projAds.map(entry=>(
                          <div key={entry.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${C.divider}`,flexWrap:"wrap",gap:6}}>
                            <div style={{display:"flex",gap:8,alignItems:"center"}}>
                              <Tag C={C} color={AD_COLORS(C)[entry.adType]||C.blue}>{AD_LABELS[entry.adType]}</Tag>
                              <span style={{fontSize:12,fontFamily:FONT,fontWeight:600,color:C.textPrimary}}>{entry.product}</span>
                              <StatusBadge C={C} status={entry.status}/>
                            </div>
                            <div style={{display:"flex",gap:6}}>
                              <span style={{fontSize:10,fontFamily:FONT,color:C.gray500}}>{entry.date}</span>
                              <Btn C={C} variant="ghost" onClick={()=>{setTab("archive");setReviewEntry(entry);}} style={{fontSize:9,padding:"3px 10px"}}>Open</Btn>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}

                  {/* Unassigned ads for this client */}
                  {unassigned.length>0 && (
                    <div style={{...CARD,opacity:.8}}>
                      <div style={{fontSize:10,fontFamily:FONT,fontWeight:700,letterSpacing:"0.12em",color:C.gray500,textTransform:"uppercase",marginBottom:10}}>Unassigned Ads ({unassigned.length})</div>
                      {unassigned.map(entry=>(
                        <div key={entry.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${C.divider}`,flexWrap:"wrap",gap:6}}>
                          <div style={{display:"flex",gap:8,alignItems:"center"}}>
                            <Tag C={C} color={AD_COLORS(C)[entry.adType]||C.blue}>{AD_LABELS[entry.adType]}</Tag>
                            <span style={{fontSize:12,fontFamily:FONT,fontWeight:600,color:C.textPrimary}}>{entry.product}</span>
                            <StatusBadge C={C} status={entry.status}/>
                          </div>
                          <Btn C={C} variant="ghost" onClick={()=>{setTab("archive");setReviewEntry(entry);}} style={{fontSize:9,padding:"3px 10px"}}>Open</Btn>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── SETTINGS ── */}
      {tab==="settings" && (
        <SettingsView C={C} user={user} usersMeta={usersMeta} setUsersMeta={setUsersMeta}/>
      )}

      {/* ── ACTIVITY ── */}
      {tab==="activity" && (
        <div style={CARD}>
          <div style={{...SD}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:11,fontFamily:FONT,fontWeight:700,letterSpacing:"0.15em",color:C.textPrimary,textTransform:"uppercase"}}>Activity Log</div>
              <span style={{fontSize:9,fontFamily:FONT,fontWeight:700,letterSpacing:"0.1em",color:C.blue,textTransform:"uppercase"}}>Shared Across Team</span>
            </div>
          </div>
          {(!activity||activity.length===0)
            ? <div style={{textAlign:"center",padding:"40px 0",fontSize:11,fontFamily:FONT,fontWeight:700,color:C.gray500,letterSpacing:"0.1em",textTransform:"uppercase"}}>No activity yet.</div>
            : activity.map(item=><ActivityItem key={item.id} C={C} item={item}/>)
          }
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════
// ROOT
// ══════════════════════════════════════════════════════════════════
export default function App() {
  const [currentUser,setCurrentUser]=useState(null);
  const [archive,setArchive]   =useState([]);
  const [clients,setClients]   =useState(DEMO_CLIENTS);
  const [activity,setActivity] =useState([]);
  const [projects,setProjects] =useState([]);
  const [usersMeta,setUsersMeta]=useState({});
  const [dark,setDark]         =useState(false);
  const [polling,setPolling]   =useState(0);

  const C = dark ? DARK : LIGHT;

  useEffect(()=>{
    load(KEYS.archive).then(d=>d&&setArchive(d));
    load(KEYS.clients).then(d=>{if(d&&d.length) setClients(d);});
    load(KEYS.activity).then(d=>d&&setActivity(d));
    load(KEYS.projects).then(d=>d&&setProjects(d));
    load(KEYS.usersMeta,false).then(d=>d&&setUsersMeta(d));
    load(KEYS.dark,false).then(d=>{ if(d!==null) setDark(!!d); });
  },[]);

  useEffect(()=>{
    if(!currentUser) return;
    const id=setInterval(async()=>{
      const a=await load(KEYS.archive);  if(a) setArchive(a);
      const c=await load(KEYS.clients);  if(c&&c.length) setClients(c);
      const v=await load(KEYS.activity); if(v) setActivity(v);
      const p=await load(KEYS.projects); if(p) setProjects(p);
      setPolling(p=>p+1);
    },4000);
    return ()=>clearInterval(id);
  },[currentUser]);

  const toggleDark=async()=>{
    const next=!dark; setDark(next);
    await persist(KEYS.dark,next,false);
  };

  const handleClientAction=useCallback(async(entryId,status,feedback)=>{
    const updated=archive.map(e=>e.id===entryId?{...e,status,feedback}:e);
    setArchive(updated); await persist(KEYS.archive,updated);
    const entry=archive.find(e=>e.id===entryId);
    const msg=status==="approved"
      ?`✓ "${entry?.product}" approved by ${currentUser.name}`
      :`✕ "${entry?.product}" — changes requested by ${currentUser.name}`;
    const item={id:uid(),msg,color:status==="approved"?C.success:C.error,user:currentUser.name,time:ts()};
    const updatedAct=[item,...(activity||[])].slice(0,50);
    setActivity(updatedAct); await persist(KEYS.activity,updatedAct);
  },[archive,activity,currentUser,C]);

  if(!currentUser) return <LoginScreen C={C} onLogin={setCurrentUser}/>;

  return (
    <div style={{minHeight:"100vh",background:C.pageBg,color:C.textPrimary,fontFamily:FONT,transition:"background .2s,color .2s"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800;900&display=swap');
        * { box-sizing:border-box; }
        input:focus, textarea:focus, select:focus {
          border-bottom-color:${C.blue} !important;
          outline:3px solid ${C.blueSubtle};
          outline-offset:3px;
        }
        button:focus-visible { outline:3px solid ${C.blue}; outline-offset:3px; }
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:${C.pageBg}}
        ::-webkit-scrollbar-thumb{background:${C.scrollThumb}}
        select option { background:${C.cardBg}; color:${C.textPrimary}; }
        input::placeholder, textarea::placeholder { color:${C.gray500}; }
      `}</style>

      {/* Top bar */}
      <div style={{background:C.topbarBg,borderBottom:`2px solid ${C.topbarBorder}`,padding:"8px 24px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontSize:9,fontFamily:FONT,fontWeight:700,letterSpacing:"0.2em",color:"#555",textTransform:"uppercase"}}>
          {SIM_MODE
            ? <span>🧪 <span style={{color:C.blue}}>SIMULATION MODE</span> · mock data · no API key needed · syncing every 4s{polling>0&&<span style={{color:"#333"}}> · #{polling}</span>}</span>
            : <span>PRODUCTION · <span style={{color:C.success}}>LIVE</span> · syncing every 4s{polling>0&&<span style={{color:"#333"}}> · #{polling}</span>}</span>
          }
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <DarkToggle C={C} dark={dark} onToggle={toggleDark}/>
          <span style={{fontSize:9,fontFamily:FONT,fontWeight:700,letterSpacing:"0.15em",color:"#555",textTransform:"uppercase",marginLeft:8,marginRight:4}}>SWITCH USER</span>
          {Object.values(USERS).map(u=>(
            <button key={u.id} onClick={()=>setCurrentUser(u)} style={{
              display:"flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:0,
              border:`1px solid ${currentUser.id===u.id?C.blue:"#333"}`,
              background:currentUser.id===u.id?"rgba(20,0,255,0.2)":"transparent",
              color:currentUser.id===u.id?C.blue:"#666",
              fontSize:9,fontFamily:FONT,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",cursor:"pointer",transition:"all .15s"}}>
              <Avatar photo={usersMeta?.[u.id]?.photo} initial={u.avatar} size={16} color={u.role==="client"?C.blueSubtle:C.blue} C={{cardBorder:"#333"}}/>
              {u.name.split(" ")[0]}
            </button>
          ))}
          <button onClick={()=>setCurrentUser(null)} style={{padding:"4px 10px",border:"1px solid #333",background:"transparent",color:"#666",fontSize:9,fontFamily:FONT,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",cursor:"pointer",borderRadius:0}}>LOGOUT</button>
        </div>
      </div>

      {currentUser.role==="client"
        ? <ClientView C={C} user={currentUser} archive={archive} onAction={handleClientAction}/>
        : <AgencyView C={C} user={currentUser} archive={archive} clients={clients}
            setArchive={setArchive} setClients={setClients} activity={activity} setActivity={setActivity}
            projects={projects} setProjects={setProjects} usersMeta={usersMeta} setUsersMeta={setUsersMeta}/>
      }
    </div>
  );
}

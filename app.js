// ═══════════════════════════════════════════════════════════════
//  CLARITO — app.js
// ═══════════════════════════════════════════════════════════════

const S={get(k){try{const v=localStorage.getItem('clarito_'+k);return v?JSON.parse(v):null}catch{return null}},set(k,v){localStorage.setItem('clarito_'+k,JSON.stringify(v))}};
const PRESET_COLORS=['#ea580c','#c2410c','#a855f7','#ec4899','#f9a8d4','#38bdf8','#22c55e','#ef4444','#3b82f6','#eab308','#14b8a6','#e879b0','#fce7f3'];

let DB={apiKey:'',ocrKey:'helloworld',visionKey:'',groqKey:'',groqStats:{calls:0,firstCall:null,tokensUsed:0},devMode:false,visionStats:{calls:0,firstCall:null},persons:[{id:'p1',name:'Persona 1',color:'#7c6ef5',cards:[]},{id:'p2',name:'Persona 2',color:'#3ecf8e',cards:[]}],tickets:[],expenses:[],settlements:[],knowledge:{products:{},cards:{}},aiQuestions:[],aiConvMessages:[]};

function loadDB(){const saved=S.get('db');if(saved)DB=Object.assign({},DB,saved);DB.ocrKey=S.get('ocrKey')||DB.ocrKey||'helloworld';DB.visionKey=S.get('visionKey')||DB.visionKey||'';DB.groqKey=S.get('groqKey')||DB.groqKey||'';try{const gs=S.get('groqStats');if(gs)DB.groqStats=JSON.parse(gs);}catch{}try{const vs=S.get('visionStats');if(vs)DB.visionStats=JSON.parse(vs);}catch{}DB.devMode=S.get('devMode')||false;if(!DB.knowledge)DB.knowledge={products:{},cards:{}};if(!DB.aiQuestions)DB.aiQuestions=[];if(!DB.aiConvMessages)DB.aiConvMessages=[];DB.persons.forEach(p=>{if(!p.cards)p.cards=[];});try{const settledIds=S.get('settledTicketIds')||[];if(settledIds.length>0){const idSet=new Set(settledIds);DB.tickets.forEach(t=>{if(idSet.has(t.id))t.settled=true;});}}catch(e){}}
function expireOldTickets(){const now=new Date();const cutoff=new Date(now.getFullYear(),now.getMonth()-1,now.getDate()).toISOString().slice(0,10);const before=DB.tickets.length;DB.tickets=DB.tickets.filter(t=>{const d=t.createdAt||t.date;return !d||d>=cutoff;});if(DB.tickets.length<before)saveDB();}
function saveDB(){try{S.set('db',JSON.parse(JSON.stringify(DB)));}catch(e){console.error('saveDB error:',e);}}

const fmt=n=>isNaN(n)||n==null?'0,00 €':Number(n).toFixed(2).replace('.',',')+' €';
const fmtDate=d=>{if(!d)return '';const dt=new Date(d);return isNaN(dt)?d:dt.toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric'});};
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2);
const personById=id=>DB.persons.find(p=>p.id===id);
const personColor=id=>personById(id)?.color||'#888';
const personName=id=>personById(id)?.name||'?';
const normalizeKey=n=>n.toLowerCase().replace(/[^a-záéíóúñ0-9]/g,' ').replace(/\s+/g,' ').trim();

function showToast(msg,dur=2500){document.querySelector('.toast')?.remove();const t=document.createElement('div');t.className='toast';t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),dur);}
function openModal(html){document.getElementById('modal-content').innerHTML=html;document.getElementById('modal-overlay').style.display='flex';}
function closeModal(){document.getElementById('modal-overlay').style.display='none';}
function showOCRLoading(msg){document.getElementById('ocr-loading').style.display='flex';document.getElementById('ocr-status').textContent=msg;}
function setOCRStatus(msg){document.getElementById('ocr-status').textContent=msg;}
function hideOCRLoading(){document.getElementById('ocr-loading').style.display='none';}
function hideSplash(){const s=document.getElementById('splash');s.classList.add('hidden');setTimeout(()=>s.style.display='none',450);}
function positionHalo(){
  const wrap=document.getElementById('splash-logo-wrap');
  const halo=document.querySelector('.splash-halo');
  if(!wrap||!halo) return;
  const r=wrap.getBoundingClientRect();
  halo.style.left=(r.left+r.width/2)+'px';
  halo.style.top=(r.top+r.height/2)+'px';
  halo.style.marginLeft='';halo.style.marginTop='';
}

let currentScreen='home';
function showScreen(name){currentScreen=name;document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));document.getElementById('nav-'+name)?.classList.add('active');document.getElementById('view').scrollTop=0;({home:renderHome,tickets:renderTickets,balance:renderBalance,stats:renderStats,settings:renderSettings})[name]?.();updateAIBadge();}

let setupStep=0,setupPersonCount=2;
function startSetup(){document.getElementById('setup-screen').style.display='flex';setupStep=0;renderSetupStep();}
function renderSetupStep(){
  const el=document.getElementById('setup-content');
  const dots=Array.from({length:4},(_,i)=>`<div class="setup-dot ${i===setupStep?'active':i<setupStep?'done':''}"></div>`).join('');
  let html=`<div class="setup-progress">${dots}</div>`;
  if(setupStep===0){
    html+=`<h2>Bienvenido a Clarito</h2><p>Necesitas dos claves gratuitas para que Clarito funcione.</p>
      <div class="field-row"><label class="field-label">Google Cloud Vision Key <span class="label-hint">(leer tickets)</span></label><input type="password" id="s-visionkey" placeholder="AIzaSy..." value="${DB.visionKey||''}"/></div>
      <p class="setup-link-hint"><a href="https://console.cloud.google.com/apis/credentials" target="_blank" class="link-accent" onclick="window.open(this.href,'_blank');return false">console.cloud.google.com</a> → APIs → Credenciales</p>
      <div class="field-row"><label class="field-label">Groq Key <span class="label-hint">(asistente IA)</span></label><input type="password" id="s-groqkey" placeholder="gsk_..." value="${DB.groqKey||''}"/></div>
      <p class="setup-link-hint"><a href="https://console.groq.com/keys" target="_blank" class="link-accent" onclick="window.open(this.href,'_blank');return false">console.groq.com</a> → API Keys (gratis)</p>
      <button class="btn-primary" onclick="setupNext0()">Continuar →</button>`;
  } else if(setupStep===1){
    html+=`<h2>¿Cuántas personas?</h2><p>¿Cuántas personas comparten gastos en este hogar?</p>
      <div class="person-count-row">${[2,3,4,5].map(n=>`<button onclick="setupPersonCount=${n};document.querySelectorAll('.pc-btn').forEach(b=>b.classList.remove('active'));this.classList.add('active')" class="btn-secondary pc-btn ${setupPersonCount===n?'active':''}">${n} personas</button>`).join('')}</div>
      <button class="btn-primary" onclick="setupNext1()">Continuar →</button>`;
  } else if(setupStep===2){
    while(DB.persons.length<setupPersonCount) DB.persons.push({id:'p'+(DB.persons.length+1),name:'Persona '+(DB.persons.length+1),color:PRESET_COLORS[DB.persons.length%PRESET_COLORS.length],cards:[]});
    DB.persons=DB.persons.slice(0,setupPersonCount);
    html+=`<h2>Nombres y colores</h2><p>Personaliza cada persona del hogar.</p>
      ${DB.persons.map((p,i)=>`<div class="setup-person-card"><div class="field-row"><label class="field-label">Nombre persona ${i+1}</label><input id="s-name-${i}" value="${p.name.startsWith('Persona ')?'':p.name}" placeholder="Nombre..."/></div><div class="field-row"><label class="field-label">Color</label><div class="color-picker-row" id="cp-${i}">${PRESET_COLORS.map(c=>`<div class="color-swatch ${p.color===c?'selected':''}" style="background:${c}" onclick="pickColor(${i},'${c}',this)"></div>`).join('')}</div></div></div>`).join('')}
      <button class="btn-primary setup-continue" onclick="setupNext2()">Continuar →</button>`;
  } else {
    html+=`<h2>¡Todo listo!</h2><p>Clarito configurado para <strong>${DB.persons.length} personas</strong>.</p>
      <div class="setup-summary">${DB.persons.map(p=>`<div class="setup-summary-row"><div class="person-dot" style="background:${p.color}"></div><div class="setup-summary-name">${p.name}</div></div>`).join('')}</div>
      <button class="btn-primary" onclick="finishSetup()">Empezar a usar Clarito</button>`;
  }
  el.innerHTML=html;
}
function pickColor(idx,color,el){DB.persons[idx].color=color;document.querySelectorAll(`#cp-${idx} .color-swatch`).forEach(s=>s.classList.remove('selected'));el.classList.add('selected');}
function setupNext0(){const vk=document.getElementById('s-visionkey').value.trim();const gk=document.getElementById('s-groqkey').value.trim();if(!vk){showToast('Introduce tu Google Vision Key');return;}DB.visionKey=vk;S.set('visionKey',vk);DB.groqKey=gk;S.set('groqKey',gk);setupStep=1;renderSetupStep();}
function setupNext1(){setupStep=2;renderSetupStep();}
function setupNext2(){DB.persons.forEach((p,i)=>{const n=document.getElementById('s-name-'+i)?.value.trim();if(n)p.name=n;});setupStep=3;renderSetupStep();}
function finishSetup(){saveDB();document.getElementById('setup-screen').style.display='none';document.getElementById('app').style.display='flex';showScreen('home');}

function readExifOrientation(file){return new Promise(res=>{const r=new FileReader();r.onload=e=>{try{const v=new DataView(e.target.result);if(v.getUint16(0)!==0xFFD8){res(1);return;}let off=2;while(off<v.byteLength){const marker=v.getUint16(off);off+=2;const len=v.getUint16(off);if(marker===0xFFE1){if(v.getUint32(off+2)===0x45786966){const tiffOff=off+2+6;const le=v.getUint16(tiffOff)===0x4949;const ifdOff=tiffOff+(le?v.getUint32(tiffOff+4,le):v.getUint32(tiffOff+4,false));const entries=le?v.getUint16(ifdOff,le):v.getUint16(ifdOff,false);for(let i=0;i<entries;i++){const tag=v.getUint16(ifdOff+2+i*12,le);if(tag===0x0112){res(v.getUint16(ifdOff+2+i*12+8,le));return;}}}}off+=len;}}catch{}res(1);};r.readAsArrayBuffer(file.slice(0,64*1024));});}
function resizeForOCR(file){return new Promise(async(res,rej)=>{const orient=await readExifOrientation(file).catch(()=>1);const url=URL.createObjectURL(file);const img=new Image();img.onload=()=>{URL.revokeObjectURL(url);const MAX=1600;let sw=img.naturalWidth,sh=img.naturalHeight;const swapped=orient>=5&&orient<=8;let w=swapped?sh:sw,h=swapped?sw:sh;if(w>h){if(w>MAX){h=Math.round(h*MAX/w);w=MAX;}}else{if(h>MAX){w=Math.round(w*MAX/h);h=MAX;}}const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.save();if(orient===2)ctx.transform(-1,0,0,1,w,0);else if(orient===3)ctx.transform(-1,0,0,-1,w,h);else if(orient===4)ctx.transform(1,0,0,-1,0,h);else if(orient===5)ctx.transform(0,1,1,0,0,0);else if(orient===6)ctx.transform(0,1,-1,0,h,0);else if(orient===7)ctx.transform(0,-1,-1,0,h,w);else if(orient===8)ctx.transform(0,-1,1,0,0,w);const dw=swapped?h:w,dh=swapped?w:h;ctx.drawImage(img,0,0,dw,dh);ctx.restore();const id=ctx.getImageData(0,0,w,h);const d=id.data;for(let i=0;i<d.length;i+=4){const g=Math.round(0.299*d[i]+0.587*d[i+1]+0.114*d[i+2]);const v=Math.min(255,Math.max(0,Math.round((g-128)*1.5+128)));d[i]=d[i+1]=d[i+2]=v;}ctx.putImageData(id,0,0);res(c.toDataURL('image/jpeg',0.9).split(',')[1]);};img.onerror=()=>rej(new Error('No se pudo cargar la imagen'));img.src=url;});}

async function googleVisionExtract(b64){const key=DB.visionKey;if(!key)throw new Error('Sin Google Vision API key. Configúrala en Ajustes.');const body={requests:[{image:{content:b64},features:[{type:'DOCUMENT_TEXT_DETECTION',maxResults:1}]}]};const res=await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${key}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.error?.message||'Vision HTTP '+res.status);}const data=await res.json();const text=data.responses?.[0]?.fullTextAnnotation?.text||'';if(!text.trim())throw new Error('No se detectó texto en la imagen');console.log('Vision OCR:',text.slice(0,400));return text;}

// ═══════════════════════════════════════════════════════════════
//  PARSER DE TICKETS
//  Formatos: Mercadona · Carrefour · Alcampo/Auchan · Froiz
//            Lidl columnas/inline · Gadis · Genérico
//
//  FIX Carrefour: cortar antes de sección TAJAS/ESCUENTOS/AL VENTAJAS
// ═══════════════════════════════════════════════════════════════
function parseTicketText(text){
  const rawLines=text.split('\n').map(l=>l.trim());
  const lines=rawLines.filter(l=>l.length>0&&!/[\u{1F300}-\u{1FFFF}\u{2600}-\u{27FF}\u2B50\u26AA\u26AB\u25CF]/u.test(l));

  const PRICE_RX      =/^(\d{1,3}[.,]\d{2})\s*[)€>]?\s*$/;
  const INLINE_RX     =/^(.+?)\s{2,}(\d{1,3}[.,]\d{2})\s*[A-Z]?\s*$/;
  const QTY_OPEN_RX   =/^(\d+)\s*[xX]\s*\($/;
  const QTY_INLINE_RX =/^(\d+|[xX])\s*[xX]?\s*\(\s*(\d{1,3}[.,]\d{2})\s*\)?$/;
  const BARCODE_RX    =/^\d{7,}$/;
  const SEP_RX        =/^[=\-*_.]{3,}$/;
  const DATE_RX       =[/((\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4}))/,/(\d{2})\s+(\d{2})\s+(\d{4})/,/(\d{1,2})\s+(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\w*\s+(\d{2,4})/i];
  const KG_RX         =/\d+[.,]\d+\s*kg|€\/kg|eur\/kg/i;
  const WEIGHT_RX     =/^[\d.,]+\s*(g|kg|ml|l|cl|gr?|lt?)\s*$/i;
  const MULT_RX       =/^[\d.,]+\s*(?:kg\s*)?[xX]\s*[\d.,]+/;
  const UNIT_PRICE_X_RX=/^(\d{1,3}[.,]\d{2})[xX]\s*$/;
  const LIDL_PRICE_RX =/^(\d{1,3}[.,]\d{2})\s*[A-Z]\s*$/;

  // SKIP: nunca son productos — incluye sección resumen Carrefour
  const SKIP_RX=/^(subtotal|iva|base\s*imp|cuota|tipo\s*$|venta\s*$|importe|a\s*pagar|tarjeta|visa|mastercard|maestro|amex|debit|cambio|efectivo|devoluci|entrega|gracias|ticket|n[uú]mero|fecha|hora|caja|operador|factura|simplificada|nif|cif|www\.|https?:|descripci|p\.\s*unit|secc|tel[eé]f|telf|telef|op:|pol\.|s\.a\.|c\.i\.f|bienvenid|hasta\s*pronto|recib|socio|puntos|ahorro|dto\.|descuento\s|premio|bono|cupon|vale|\d+[.,]\d+%|art\.?\s*total|centros\s+comerciales|^lidl$|^aldi$|^idl\)?|ventajas\b|descuentos:|total\s+ventajas|total\s+descuentos|tajas\s+obtenidas|escuentos:|al\s+ventajas|ventajas\s+en\s+esta)/i;
  const PROMO_RX=/^(-[A-ZÁÉÍÓÚÑ]|EL\s+CLUB\b|MI\s+DÍA|LLEGA\b|CLUB\b$)/i;

  function isPrice(l){return PRICE_RX.test(l);}
  function isSkip(l){return SKIP_RX.test(l)||PROMO_RX.test(l)||BARCODE_RX.test(l)||SEP_RX.test(l)||WEIGHT_RX.test(l)||/^\[[\d\s]*\]$/.test(l);}
  function isKgInfo(l){return KG_RX.test(l)&&!PRICE_RX.test(l);}
  function parsePrice(l){return parseFloat(l.replace(/[)€>]/g,'').replace(',','.').trim());}
  function parseLidlPrice(l){const m=l.match(/^(\d{1,3}[.,]\d{2})/);return m?parseFloat(m[1].replace(',','.')):null;}
  function isLidlPrice(l){return LIDL_PRICE_RX.test(l);}

  // Detectar tienda
  const STORES=['mercadona','lidl','aldi','carrefour','dia','eroski','alcampo','consum','hipercor','el corte ingles','supercor','spar','froiz','ahorramas','bonarea','gadis','pontevicus','auchan'];
  let store='';
  for(const l of lines.slice(0,6)){
    const low=l.toLowerCase();
    const found=STORES.find(s=>low.includes(s));
    if(found){store=found.charAt(0).toUpperCase()+found.slice(1);break;}
    if(!store&&l.length>3&&l.length<35&&/^[A-ZÁÉÍÓÚÑ\s]+$/.test(l)&&!isSkip(l)&&!/^(nif|cif|telf|iva|total|base|cuota)/i.test(l)&&l.trim().includes(' ')) store=l;
  }

  // Detectar por CIF
  const isCarrefour=store.toLowerCase().includes('carrefour')||lines.some(l=>QTY_OPEN_RX.test(l)||/A28425270/.test(l));
  if(!store&&isCarrefour) store='Carrefour';
  const isFroiz=store.toLowerCase().includes('froiz')||store.toLowerCase().includes('gadis')||
    lines.some(l=>/distribuciones froiz/i.test(l)||/gadis/i.test(l)||/B15705676/.test(l)||/pontevicus/i.test(l));
  if(!store&&lines.some(l=>/gadis/i.test(l)||/B15705676/.test(l)||/pontevicus/i.test(l))) store='Gadis';
  if(store.toLowerCase().includes('alcampo')||lines.some(l=>/^alcampo/i.test(l.trim()))) store='Auchan';
  const isAlcampo=store==='Auchan'||lines.some(l=>/alcampo/i.test(l)||/auchan/i.test(l));
  if(!store&&lines.some(l=>/A60195278/i.test(l))) store='Lidl';
  if(!store&&lines.some(l=>/A28425270/.test(l))) store='Carrefour';
  if(!store&&lines.some(l=>/A15022510/.test(l))) store='Gadis';
  const isMercadonaDigital=(store.toLowerCase().includes('mercadona')||lines.some(l=>/mercadona/i.test(l)))&&lines.some(l=>/descripci[oó]n/i.test(l))&&lines.some(l=>/p\.\s*unit/i.test(l));

  // Fecha y hora
  let date=null,time=null;
  for(const l of lines){const t=l.trim();const standalone=t.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);if(standalone){time=`${standalone[1].padStart(2,'0')}:${standalone[2]}`;break;}const inline=t.match(/\d{2,4}\s+(\d{1,2}):(\d{2})(?::\d{2})?/)||t.match(/\d{2,4}[\/\-]\s*\d{2,4}\s+(\d{1,2}):(\d{2})/)||t.match(/[-–]\s*(\d{1,2}):(\d{2})(?::\d{2})?$/);if(inline){time=`${inline[1].padStart(2,'0')}:${inline[2]}`;break;}}
  for(const l of lines){if(!date){for(let ri=0;ri<DATE_RX.length;ri++){const m=l.match(DATE_RX[ri]);if(m){try{let d,mo,y;if(ri===0){d=m[2];mo=m[3];y=m[4];}else if(ri===1){d=m[1];mo=m[2];y=m[3];}else{d=String(m[1]).padStart(2,'0');mo='01';y=m[2];}if(y&&y.length===2)y='20'+y;const dt=new Date(`${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`);if(!isNaN(dt))date=dt.toISOString().slice(0,10);}catch{}}}}if(!time){const tm=l.match(/(\d{1,2}):(\d{2}):\d{2}/);if(tm)time=`${tm[1].padStart(2,'0')}:${tm[2]}`;}if(date&&time)break;}

  // Total
  let total=0;
  for(const l of lines){const m=l.match(/imp(?:orte)?[\s./]*(?:eur[\s.]*)?[.:/]\s*(\d{1,4}[.,]\d{2})/i)||l.match(/(\d{1,4}[.,]\d{2})\s*\/\s*eur/i);if(m){const v=parseFloat(m[1].replace(',','.'));if(v>0){total=v;break;}}}
  if(!total){const ART_TOTAL_RX=/^(\*total[\s.:]*$|\*total\s+[\d,.]|art\.?[\s.]*total[\s\w]*)/i;for(let ti=0;ti<lines.length;ti++){const l=lines[ti].trim();const inlineM=l.match(/(?:\*?total|art\.?[\s.]*total)[^0-9]*(\d{1,4}[.,]\d{2})/i);if(inlineM){const v=parseFloat(inlineM[1].replace(',','.'));if(v>0){total=v;break;}}if(!ART_TOTAL_RX.test(l))continue;for(let k=1;k<=3;k++){if(ti+k>=lines.length)break;const nxt=lines[ti+k].trim();const nm=nxt.match(/^(\d{1,4}[.,]\d{2})\s*(?:eur|€)?\.?\s*$/i);if(nm){const v=parseFloat(nm[1].replace(',','.'));if(v>0){total=v;break;}}if(/^[a-záéíóúñ]/i.test(nxt)&&nxt.length>3)break;}if(total)break;}}
  if(!total){for(const l of lines){const m=l.match(/art\.?\s*total\s+a\s+pagar\s*:?\s*(\d{1,4}[.,]\d{2})/i)||l.match(/total\s+a\s+pagar\s*:?\s*(\d{1,4}[.,]\d{2})/i);if(m){const v=parseFloat(m[1].replace(',','.'));if(v>0){total=v;break;}}}}
  if(!total){for(const l of lines){const m=l.match(/(?:entrega:|tarjetas:)[^0-9]*(\d{1,4}[.,]\d{2})/i)||l.match(/^(\d{1,4}[.,]\d{2})\s*eur\.?\s*$/i);if(m){const v=parseFloat(m[1].replace(',','.'));if(v>0){total=v;break;}}}}
  if(!total){for(let ti=0;ti<lines.length;ti++){if(!/^\*total/i.test(lines[ti].trim()))continue;for(let k=1;k<=6;k++){if(ti+k>=lines.length)break;const nxt=lines[ti+k].trim();const nm=nxt.match(/^(\d{1,4}[.,]\d{2})\s*(?:eur)?\.?\s*$/i)||nxt.match(/(?:entrega:|tarjetas:)[^0-9]*(\d{1,4}[.,]\d{2})/i);if(nm){const v=parseFloat(nm[1].replace(',','.'));if(v>0){total=v;break;}}}if(total)break;}}
  if(!total){const allP=lines.map(l=>l.trim().match(/^(\d{1,4}[.,]\d{2})$/)).filter(Boolean).map(m=>parseFloat(m[1].replace(',','.')));const freq={};allP.forEach(p=>{freq[p]=(freq[p]||0)+1;});const repeated=Object.entries(freq).filter(([,c])=>c>=2).map(([p])=>parseFloat(p));if(repeated.length)total=Math.max(...repeated);}

  // Tarjeta
  let last4=null;
  for(const l of lines){const m=l.match(/(?:\d{4,6})?[Xx*•]{4,}\s*(\d{4})\b/)||l.match(/^[Xx\s*•]+(\d{4})\s*(?:\d{2})?\s*$/)||l.match(/tarjeta[^\d]*(\d{4})/i)||l.match(/(?:visa|mastercard|maestro|amex|debit)\s+\d*[Xx*•]+(\d{4})/i);if(m&&m[1]){last4=m[1];break;}}

  // ── Corte de sección de productos ────────────────────────────
  // Incluye TAJAS OBTENIDAS / ESCUENTOS: / AL VENTAJAS (Carrefour resumen)
  const CUT_RX=/^(total[\s.(€$):]*$|art\.?[\s.]*total[\s\w]*|total[\s.]*a[\s.]*p\w+|tipo\s*$|====+|base\s*$|cuota\s*$|entrada\b|salida\b|tajas\s+obtenidas|escuentos:|al\s+ventajas)/i;
  const _lidlPriceRx=/^\d{1,3}[.,]\d{2}\s*[A-Z]\s*$/;
  const isLidlColumnFormat=(()=>{let totIdx=-1;for(let li=0;li<lines.length;li++)if(/^total$/i.test(lines[li].trim())){totIdx=li;break;}if(totIdx<0)return false;const after=lines.slice(totIdx).filter(l=>_lidlPriceRx.test(l.trim())).length;const before=lines.slice(0,totIdx).filter(l=>_lidlPriceRx.test(l.trim())).length;return after>=3&&before===0;})();
  const CUT_RX_ACTIVE=isLidlColumnFormat?/^(art\.?[\s.]*total|total[\s.]*a[\s.]*pagar|tipo\s*$|====+|base\s*$|cuota\s*$)/i:CUT_RX;
  let cutIdx=lines.length;
  for(let ti=0;ti<lines.length;ti++){if(CUT_RX_ACTIVE.test(lines[ti].trim())){cutIdx=ti;break;}}
  // Carrefour: cortar también en "N ART. TOTAL A PAGAR"
  if(isCarrefour){for(let ti=0;ti<cutIdx;ti++){if(/art\.?\s*total\s+a\s+pagar/i.test(lines[ti])||/^(tajas|escuentos|al\s+ventajas)/i.test(lines[ti].trim())){cutIdx=ti;break;}}}

  const _isLidlFormat=lines.some(l=>/^nif\s*a60195278/i.test(l.trim())||/^lidl\s+super/i.test(l.trim()));
  let productLines;
  if(_isLidlFormat&&cutIdx<lines.length){let lastLidlPrice=cutIdx-1;const _lpRx=/^\d{1,3}[.,]\d{2}\s*[A-Z]\s*$/;for(let _li=cutIdx;_li<Math.min(cutIdx+15,lines.length);_li++){if(_lpRx.test(lines[_li].trim()))lastLidlPrice=_li;if(/^(\d{8,}|venta\b|mastercard|visa\s+debit|tarj)/i.test(lines[_li].trim()))break;}productLines=lines.slice(0,lastLidlPrice+1);}
  else productLines=lines.slice(0,cutIdx);

  const products=[];
  if(isAlcampo)               parseAlcampo(lines,products);
  else if(isFroiz)            parseFroiz(lines,products);
  else if(isMercadonaDigital) parseMercadonaDigital(lines,products);
  else if(isCarrefour)        parseCarrefour(productLines,products);
  else                        parseGeneric(productLines,products);

  total=parseFloat(String(total).replace(',','.'));
  return{store,date,time,last4,total,products,errors:[],warnings:[]};

  // ── MERCADONA DIGITAL ─────────────────────────────────────────
  function parseMercadonaDigital(allLines,out){
    let start=0;
    for(let i=0;i<allLines.length;i++){if(/descripci[oó]n/i.test(allLines[i])&&/p\.\s*unit/i.test(allLines[i])){start=i+1;break;}if(/^p\.\s*unit/i.test(allLines[i].trim())){const a=allLines[i+1]?.trim()||'';start=/^imp(orte)?/i.test(a)?i+2:i+1;break;}if(/descripci[oó]n/i.test(allLines[i])&&i+1<allLines.length&&/p\.\s*unit/i.test(allLines[i+1])){const a=allLines[i+2]?.trim()||'';start=/^imp(orte)?/i.test(a)?i+3:i+2;break;}}
    let end_=allLines.length;const afterTP=[];
    for(let i=start;i<allLines.length;i++){if(/^total\s*[\(€)]/i.test(allLines[i].trim())||/^entrada\b/i.test(allLines[i].trim())){end_=i;for(let j=i+1;j<Math.min(i+10,allLines.length);j++){const pt=allLines[j].trim();if(!pt||/^(RR|aut:|noo|util)/i.test(pt))continue;if(/^(importe:|tarj\.?\s*bancaria:|iva\b)/i.test(pt))break;if(/^tarjeta bancaria$/i.test(pt))continue;const pm=pt.match(/^(\d{1,3}[.,]\d{2})$/);if(pm){const v=parseFloat(pm[1].replace(',','.'));if(v>0&&v<100)afterTP.push(v);}}break;}}
    let descIdx=-1,pUnitIdx=-1;for(let _i=0;_i<allLines.length;_i++){if(/^descripci[oó]n$/i.test(allLines[_i].trim()))descIdx=_i;if(/^p\.\s*unit/i.test(allLines[_i].trim())){pUnitIdx=_i;break;}}
    const preEnd=pUnitIdx>=0?pUnitIdx:start;
    const preH=(descIdx>=0&&descIdx<preEnd)?allLines.slice(descIdx+1,preEnd).map(l=>l.trim()).filter(l=>l&&!/^(p\.\s*unit|imp(orte)?)/i.test(l)):[];
    const body=[...preH,...allLines.slice(start,end_).map(l=>l.trim()).filter(l=>l&&!/^(p\.\s*unit|imp(orte)?|importe:)/i.test(l))];
    const QI=/^(\d+)\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ0-9\s\/\-'.%&]+?)\s+(\d{1,3}[.,]\d{2})$/;
    const entries=[],allPrices=[];
    for(const l of body){const t=l.trim();if(/^(entrada|salida)/i.test(t))continue;const im=t.match(QI);if(im){const qty=parseInt(im[1]),name=im[2].trim(),unitP=parseFloat(im[3].replace(',','.'));if(name.length>=3&&qty>=1&&qty<=99){entries.push({name,qty,raw:t,_inlinePrice:unitP});allPrices.push({v:unitP,isInlineUnit:true,skipTotal:parseFloat((unitP*qty).toFixed(2))});continue;}}const pm=t.match(/^(\d{1,4}[.,]\d{2})$/);if(pm){const v=parseFloat(pm[1].replace(',','.'));const last=allPrices[allPrices.length-1];if(last&&last.isInlineUnit&&Math.abs(last.skipTotal-v)<0.02)continue;allPrices.push({v});continue;}const QN=/^(\d+)\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9\s\/\-'.%&C]+)$/;const m=t.match(QN);if(m){entries.push({name:m[2].trim(),qty:parseInt(m[1]),raw:t});continue;}if(/^[A-ZÁÉÍÓÚÑ]/.test(t)&&t.length>=3&&!isPrice(t)&&!/^(op:|factura|tel[eé]f|entrada|salida|parking|descripci[oó]n|p\.\s*unit)/i.test(t)&&!/^[a-záéíóúñ]{2,}\s+[a-z]/i.test(t))entries.push({name:t,qty:1,raw:t});}
    const flatP=allPrices.filter(p=>!p.isInlineUnit).map(p=>p.v);let pi=0;const pending=[];
    for(const e of entries){if(e._inlinePrice!=null){const nm=cleanName(e.name);if(nm.length>=2)out.push(makeProduct(nm,e.raw,e._inlinePrice,e.qty));continue;}if(pi>=flatP.length){pending.push(e);continue;}const unitP=flatP[pi++];if(unitP===0&&e.name.toUpperCase().includes('PARKING'))continue;if(e.qty>1&&pi<flatP.length&&Math.abs(flatP[pi]-unitP*e.qty)<0.02)pi++;const nm=cleanName(e.name);if(nm.length>=2)out.push(makeProduct(nm,e.raw,unitP,e.qty));}
    let api=0;for(const e of pending){if(api>=afterTP.length)break;const nm=cleanName(e.name);if(nm.length>=2)out.push(makeProduct(nm,e.raw,afterTP[api++],e.qty));}
  }

  // ── ALCAMPO ───────────────────────────────────────────────────
  function parseAlcampo(allLines,out){
    const APR=/^,?\d{1,3}[.,]\d{2}\s*[ABC]?\s*$/;
    const APKRX=/^(\d+)\s*[xX]\s*(\d{1,3}[.,]\d{2})$/;
    const APKTRX=/^(\d+)\s*[xX]\s*(\d{2,3})$/;
    const AQRX=/^(\d+)\s*[xX]\s*$/;
    const ASKRX=/^(factura|simplificada|tarjeta\s+bancaria|cambio|num\.|base|cuota|para\s+el|establecimiento|localidad|fecha|numero|tipo\s+de|codigo|importe\s+moneda|verificacion|etiqueta|n\.\s*referencia|entidad|pin|firma|a\s+tu|campa|con\s+\d|consigue|descuento|sellos|puc|arc:|aid|alcampo\s+s\.a|santiago|tot$|€\*|vert$|dama$|rma\s+no|redsys|contactless|visa\s+debit|venta$|moneda$)/i;
    const ANRX=/^([ABC]$|92$|€\*$|tot$|esp$|\d{2}$|\d+\s*[xX]\s*$)/i;
    function iAP(l){return APR.test(l)||/^,\d{2}\s*[ABC]?$/.test(l)||/^\d{2}\s+[ABC]$/.test(l);}
    function pAP(l){const c=l.replace(/[ABC\s]/g,'').replace(',','.');const v=c.startsWith('.')?parseFloat('0'+c):parseFloat(c);if(v>=10&&v<100&&/^\d{2}\s+[ABC]$/.test(l))return v/100;return v;}
    function isOCRGarbage(l){const nonLatin=(l.match(/[^\x00-\x7F\u00C0-\u024F\u20AC€.,\d\s\-\/()]/g)||[]).length;return nonLatin>l.length*0.3;}
    // Extrae nombre de producto si la línea mezcla prefijo espejo + nombre en mayúsculas
    // Ej: "nogal bl SEITAN MANFONG" → "SEITAN MANFONG"
    function extractProductFromMixed(l){
      const m=l.match(/^(?:[a-záéíóúñ\d\s()]+)\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s.'0-9]{2,})$/);
      return (m&&m[1].trim().length>=3)?m[1].trim():null;
    }
    function iAN(l){
      if(!l||l.length<3)return false;
      if(iAP(l)||APKRX.test(l)||AQRX.test(l))return false;
      if(ASKRX.test(l)||ANRX.test(l))return false;
      if(isSkip(l)||SEP_RX.test(l)||BARCODE_RX.test(l))return false;
      if(/^\d+$/.test(l)||/^[,.]\d+$/.test(l))return false;
      if(/calle|avda|plaza|s\.a\.|cif\./i.test(l))return false;
      if(/^\d{1,2}\/\d{2}\/\d{2}/.test(l))return false;
      if(store&&l.toLowerCase().includes(store.toLowerCase()))return false;
      if(/^alcampo\b/i.test(l))return false;
      if(/^\d{4,}/.test(l))return false;
      if(isOCRGarbage(l))return false;
      // Alcampo: los nombres válidos tienen al menos una palabra de 3+ mayúsculas
      if(!/\b[A-ZÁÉÍÓÚÑ]{3,}/.test(l))return false;
      return true;
    }
    let start=0,orphanQty=null,orphanUnitPrice=null;
    for(let i=0;i<allLines.length;i++){const t=allLines[i].trim();const qm=t.match(/^(\d+)\s*[xX]\s*$/);if(qm&&parseInt(qm[1])>1)orphanQty=parseInt(qm[1]);const qmP=t.match(/^(\d+)\s*[xX]\s*(\d{2,3})$/);if(qmP){orphanQty=parseInt(qmP[1]);orphanUnitPrice=parseFloat('0.'+qmP[2]);}if(/factura\s+simplificada/i.test(t)){start=i+1;break;}}
    let end_=allLines.length;
    for(let i=start;i<allLines.length;i++){const t=allLines[i].trim();if(/^(tarjeta\s+bancaria|num\.\s*total|cambio|para\s+el\s+cliente)/i.test(t)){end_=i;break;}if(/^€[\s*]/.test(t)){end_=i;break;}if(/^tot$/i.test(t)){end_=i;break;}}
    const afterTOT=[];
    for(let i=end_;i<Math.min(end_+15,allLines.length);i++){
      const t=allLines[i].trim();
      if(!t)continue;
      // Skip standalone separators/headers without stopping
      if(/^(€[\s*]?$|tarjeta$|€$)/i.test(t))continue;
      // Stop at payment section headers
      if(/^(tarjeta\s+bancaria|num\.\s*total|cambio|para\s+el|venta\b|tot$)/i.test(t))break;
      const dm=t.match(/^(\d{1,3}[.,]\d{2})\s+\w/);if(dm){const p=pAP(dm[1]);if(p>0&&p<30)afterTOT.push(p);continue;}
      if(iAP(t)){const p=pAP(t);if(p>0&&p<30)afterTOT.push(p);}
    }
    let descIdx=-1;for(let i=0;i<allLines.length;i++)if(/^descripci[oó]n$/i.test(allLines[i].trim())){descIdx=i;break;}
    const preH=(descIdx>=0&&descIdx<start)?allLines.slice(descIdx+1,start).map(l=>l.trim()).filter(l=>l):[];
    const body=[...preH,...allLines.slice(start,end_).map(l=>l.trim()).filter(l=>l)];
    const tokens=[];let pendingQty=null;
    for(let _li=0;_li<body.length;_li++){
      const _raw=body[_li];if(!_raw)continue;
      // Limpiar líneas espejo con nombre de producto embebido: "nogal bl SEITAN MANFONG" → "SEITAN MANFONG"
      const l=extractProductFromMixed(_raw)||_raw;
      if(ANRX.test(l)||ASKRX.test(l))continue;
      const qom=l.match(AQRX);if(qom){pendingQty=parseInt(qom[1]);continue;}
      const pm=l.match(APKRX);if(pm){tokens.push({type:'pack',qty:parseInt(pm[1]),unitP:parseFloat(pm[2].replace(',','.'))});continue;}
      const ptm=l.match(APKTRX);if(ptm){tokens.push({type:'pack',qty:parseInt(ptm[1]),unitP:parseFloat('0.'+ptm[2])});continue;}
      if(iAN(l)){tokens.push({type:'name',val:l,qty:pendingQty||1});pendingQty=null;continue;}
      if(iAP(l)){const p=pAP(l);if(p>=0)tokens.push({type:'price',val:p});continue;}
    }
    afterTOT.forEach(p=>tokens.push({type:'price',val:p}));
    const entries=[];let pendingPack=null,j=0;
    while(j<tokens.length){const tk=tokens[j];if(tk.type==='pack'){pendingPack={qty:tk.qty,unitP:tk.unitP};j++;continue;}if(tk.type==='name'){let nameRun=0,k=j;while(k<tokens.length&&tokens[k].type==='name'){nameRun++;k++;}let priceRun=0,m=k;while(m<tokens.length&&tokens[m].type==='price'){priceRun++;m++;}if(nameRun>1&&priceRun>=nameRun){const be=[];for(let n=0;n<nameRun;n++){const nt=tokens[j+n];be.push({name:nt.val,qty:nt.qty,unitP:null,price:tokens[k+n]?.val??null,raw:nt.val});}if(pendingPack){const et=parseFloat((pendingPack.qty*pendingPack.unitP).toFixed(2));const mi=be.findIndex(e=>e.price!=null&&Math.abs(e.price-et)<0.05);const ai=mi>=0?mi:0;be[ai].qty=pendingPack.qty;be[ai].unitP=pendingPack.unitP;pendingPack=null;}be.forEach(e=>entries.push(e));j=k+nameRun;while(j<tokens.length&&tokens[j].type==='price'){const p=tokens[j].val;const me2=entries.slice(-nameRun).find(e=>e.qty>1&&e.price&&Math.abs(e.price*e.qty-p)<0.02);if(me2)j++;else break;}}else if(nameRun>1&&priceRun>0&&priceRun<nameRun){for(let n=0;n<nameRun;n++){const nt=tokens[j+n];const entry={name:nt.val,qty:nt.qty,unitP:null,price:n<priceRun?tokens[k+n].val:null,raw:nt.val};if(pendingPack&&n===0){entry.qty=pendingPack.qty;entry.unitP=pendingPack.unitP;pendingPack=null;}entries.push(entry);}j=k+priceRun;}else{const entry={name:tk.val,qty:tk.qty,unitP:null,price:null,raw:tk.val};if(pendingPack){entry.qty=pendingPack.qty;entry.unitP=pendingPack.unitP;pendingPack=null;}entries.push(entry);j++;if(j<tokens.length&&tokens[j].type==='price'){entry.price=tokens[j].val;j++;if(entry.qty>1&&j<tokens.length&&tokens[j].type==='price'&&Math.abs(tokens[j].val-entry.price*entry.qty)<0.02)j++;}}continue;}if(tk.type==='price'){if(entries.length>0){let stolenIdx=-1,nullIdx=-1;for(let k2=entries.length-1;k2>=Math.max(0,entries.length-8);k2--){const e2=entries[k2];if(e2.price==null&&e2.unitP==null&&nullIdx<0)nullIdx=k2;if(e2.price!=null&&e2.unitP==null&&stolenIdx<0){const isSt=entries.slice(Math.max(0,k2-3),k2+3).some(pe=>pe!==e2&&pe.unitP!=null&&pe.qty>1&&Math.abs(pe.unitP*pe.qty-e2.price)<0.02);if(isSt)stolenIdx=k2;}}if(stolenIdx>=0&&(nullIdx<0||stolenIdx>nullIdx))entries[stolenIdx].price=tk.val;else if(nullIdx>=0)entries[nullIdx].price=tk.val;}j++;continue;}j++;}
    for(let ki=0;ki<entries.length;ki++){if(entries[ki].price==null&&entries[ki].unitP==null){const twin=entries.find((e,ei)=>ei!==ki&&e.name===entries[ki].name&&(e.price!=null||e.unitP!=null));if(twin)entries[ki].price=twin.unitP||twin.price;}}
    for(const e of entries){if(e.price==null&&e.unitP==null)continue;const nm=cleanName(e.name);if(nm.length<2)continue;let unitP,qty=e.qty||1;if(e.unitP!=null){const colP=e.price;if(colP==null||Math.abs(colP-e.unitP)<0.02||Math.abs(colP-e.unitP*qty)<0.02)unitP=e.unitP;else unitP=colP;}else if(qty>1&&e.price!=null)unitP=parseFloat((e.price/qty).toFixed(2));else unitP=e.price||0;out.push(makeProduct(nm,e.raw,unitP,qty));}
    for(let k=0;k<out.length;k++){if(out[k].unitPrice===0||out[k].finalPrice===0){const twin=out.find((p,i)=>i!==k&&p.name===out[k].name&&p.unitPrice>0);if(twin){out[k].unitPrice=twin.unitPrice;out[k].price=twin.unitPrice;out[k].finalPrice=parseFloat((twin.unitPrice*(out[k].qty||1)).toFixed(2));}}}
    if(orphanQty&&orphanQty>1){let bestIdx=-1,bestScore=Infinity;for(let k=0;k<out.length;k++){if(out[k].qty!==1)continue;const ug=Math.round(out[k].finalPrice/orphanQty*100)/100;const diff=Math.abs(ug*orphanQty-out[k].finalPrice);if(diff<0.02&&ug>0&&diff<bestScore){bestScore=diff;bestIdx=k;}}if(bestIdx>=0){const p=out[bestIdx];const unitP=Math.round(p.finalPrice/orphanQty*100)/100;p.qty=orphanQty;p.unitPrice=unitP;p.price=unitP;}}
  }

  // ── FROIZ / GADIS ─────────────────────────────────────────────
  function parseFroiz(allLines,out){
    const FCRX=/^\d{4,}[-.]?\s*\d*$/;
    const FCUTRX=/^(\*?total\b|entrega:|tarjetas:|a\s+devolver|base\s+c\.iva)/i;
    const PDRX=/^\d{1,3}[.,]\d{2}$/;
    function fp(t){const m=t.match(/^(\d{1,3}[.,]\d{2})/);return m?parseFloat(m[1].replace(',','.')):null;}
    function iFP(t){return PDRX.test(t);}
    // Avanzar hEnd más allá de cabecera (NIF/CIF) Y líneas de tienda/fecha/caja
    let hEnd=0;
    for(let i=0;i<allLines.length;i++){
      const l=allLines[i].trim();
      if(/^descripcion\b/i.test(l)){hEnd=i+1;break;}
      if(/^nif\b|^cif\b/i.test(l)) hEnd=i+1;
    }
    // Saltar líneas de cabecera residuales (TIENDA:, CJR:, N.FRA:, fechas, teléfonos)
    while(hEnd<allLines.length){
      const l=allLines[hEnd].trim();
      if(/^(tienda:|cjr:|n\.fra:|n\.oper|fecha|hora|atendid|conserv)/i.test(l)) {hEnd++;continue;}
      if(/^\d{1,2}[\/\-]\d{2}[\/\-]\d{2,4}/.test(l)||/^\d{2}\s+\d{2}\s+\d{4}/.test(l)){hEnd++;continue;}
      if(/^\*{2,}/.test(l)||/^\d{9,}$/.test(l)){hEnd++;continue;}
      break;
    }
    let docEnd=allLines.length;
    for(let i=hEnd;i<allLines.length;i++){if(FCUTRX.test(allLines[i].trim())){docEnd=i;break;}}
    const body=allLines.slice(hEnd,docEnd);
    function iFN(l){
      if(!l||l.length<3)return false;
      if(FCRX.test(l)||iFP(l))return false;
      if(/^\d+$/.test(l)||/^\d+%$/.test(l))return false;
      if(/^\[[\d\s]*\]$/.test(l))return false;
      if(/^importe$/i.test(l))return false;
      if(isSkip(l)||BARCODE_RX.test(l)||SEP_RX.test(l))return false;
      if(/^(nif|cif|factura|simplificada|descripcion|cant|p\.v\.p|tienda:|cjr:|n\.fra:)/i.test(l))return false;
      if(/^\d{1,2}[\/\-]\d{2}[\/\-]\d{2,4}/.test(l))return false;
      return true;
    }
    const names=body.filter(l=>iFN(l.trim()));
    const fni=body.findIndex(l=>iFN(l.trim()));
    const ii=body.findIndex(l=>/^importe$/i.test(l.trim()));
    const iH=ii>=0&&ii<fni;
    const prices=[];
    if(!iH){
      const uP=[],ivP=[];let pC=false,pI=false;
      for(const l of body){
        const t=l.trim();
        if(/^importe$/i.test(t)){pI=true;pC=false;continue;}
        if(FCRX.test(t)){pC=true;continue;}
        if(/^\d+%$/.test(t)||(/^\d+$/.test(t)&&!FCRX.test(t))){pC=false;continue;}
        if(iFP(t)){const p=fp(t);if(p!=null&&p>0&&p<500){if(pC)uP.push(p);else if(pI)ivP.push(p);}pC=false;}
        else pC=false;
      }
      if(uP.length>0){
        // iPad path: codes found, pair unit+iva prices
        for(let k=0;k<uP.length;k++){const unitP=uP[k],ivaP=ivP[k];if(ivaP&&unitP>0){const qty=Math.round(ivaP/unitP);if(qty>1&&qty<=50&&Math.abs(qty*unitP-ivaP)<0.02)prices.push({unitP,qty});else prices.push({unitP,qty:1});}else prices.push({unitP,qty:1});}
      } else {
        // Interleaved path: NAME / PRICE / NAME / PRICE (Gadis sin códigos)
        // Emparejar nombres y precios por posición en el body
        let pi=0;
        const bodyPrices=body.map(l=>iFP(l.trim())?fp(l.trim()):null);
        for(let k=0;k<names.length;k++){
          // Find next price after this name's position in body
          const namePos=body.findIndex((l,bi)=>bi>=pi&&l.trim()===names[k]);
          let priceVal=null;
          for(let bi=namePos+1;bi<body.length;bi++){
            const p=bodyPrices[bi];
            if(p!=null){priceVal=p;pi=bi+1;break;}
            if(iFN(body[bi].trim())) break; // another name → stop
          }
          // Check for total=qty*price pattern (next price after priceVal)
          if(priceVal!=null){
            const nextPriceIdx=body.findIndex((l,bi)=>bi>=pi&&bodyPrices[bi]!=null);
            if(nextPriceIdx>=0){
              const nextP=bodyPrices[nextPriceIdx];
              if(nextP>priceVal&&nextP<500){
                const qty=Math.round(nextP/priceVal);
                if(qty>1&&qty<=50&&Math.abs(qty*priceVal-nextP)<0.02){prices.push({unitP:priceVal,qty});pi=nextPriceIdx+1;continue;}
              }
            }
            prices.push({unitP:priceVal,qty:1});
          } else {
            prices.push(null);
          }
        }
      }
    } else {
      const aP=[];for(const l of body){const t=l.trim();if(/^\d+%$/.test(t))continue;if(iFP(t)){const p=fp(t);if(p!=null&&p>0&&p<500)aP.push(p);}}
      let ai=0;while(ai<aP.length&&prices.length<names.length){const cur=aP[ai],nxt=aP[ai+1];if(nxt!==undefined&&nxt!==cur&&nxt>cur){prices.push({unitP:cur,qty:Math.round(nxt/cur)||1});ai+=2;}else if(nxt!==undefined&&nxt===cur){prices.push({unitP:cur,qty:1});ai+=2;}else{prices.push({unitP:cur,qty:1});ai++;}}
    }
    for(let k=0;k<names.length;k++){
      const rawName=names[k].trim().replace(/\s+\d+[.,]?\d*\s*%\s*$/,'').trim();
      const pe=prices[k];if(!pe)continue;
      const nm=cleanName(rawName).replace(/\s+\d+\s*u\b/gi,'').replace(/\s+\d+[.,]\d+\s*(kg|g|l|ml|cl)\b/gi,'').replace(/\s+\d+\s*(kg|g|l|ml|cl)\b/gi,'').replace(/\bbrik\s+\d+(\s+\d+)?\b/gi,'brik').replace(/\s+\d+\s*$/,'').trim();
      if(nm.length<2)continue;
      out.push(makeProduct(nm,rawName,pe.unitP,pe.qty));
    }
  }

  // ── CARREFOUR ─────────────────────────────────────────────────
  // Cortar en TAJAS OBTENIDAS / ESCUENTOS: / AL VENTAJAS EN ESTA COMPRA
  function parseCarrefour(pLines,out){
    const ACDRX=/^[A-Z0-9]{2,6}$/;
    const NPRX=/^-(\d{1,3}[.,]\d{2})$/;
    const DNRX=/^(descuento|dto\.?|oferta|3x2|2x1|1\s+3x2)/i;
    // Sección de resumen post-total — no son productos
    const CFSUMRX=/^(tajas\s+obtenidas|escuentos:|al\s+ventajas|ventajas\s+en\s+esta|total\s+ventajas|total\s+descuentos|\d+\s+art\.?\s+total)/i;
    function fp(t){return parseFloat(t.replace(/[)€>]/g,'').replace(',','.').trim());}
    let i=0;
    while(i<pLines.length){
      const l=pLines[i].trim();i++;
      if(!l||l.length<2)continue;
      if(CFSUMRX.test(l))break; // ← corte de sección resumen
      if(isSkip(l)||SEP_RX.test(l)||BARCODE_RX.test(l))continue;
      if(/^\d{1,2}[\/:.]\d{2}[\/:.]/.test(l)||/^\d{1,2}:\d{2}$/.test(l))continue;
      if(/^\d{1,3}$/.test(l))continue;
      if(/^[-–]\s*[^\d]/.test(l)&&l.length<=5)continue;
      const negM=l.match(NPRX);
      if(negM){const disc=parseFloat(negM[1].replace(',','.'));if(out.length>0){const prevRaw=pLines[i-2]?.trim()||'';const cae=prevRaw.match(/\b([A-Z0-9]{2,6})$/);const prevL=cae?cae[1]:prevRaw;if(ACDRX.test(prevL)){const tagged=out.slice(-4).filter(p=>p._code===prevL);if(tagged.length>1){const cheapest=tagged.reduce((a,b)=>a.unitPrice<b.unitPrice?a:b);cheapest.discount=(cheapest.discount||0)+disc;cheapest.finalPrice=parseFloat(Math.max(0,cheapest.finalPrice-disc).toFixed(2));continue;}}const last=out[out.length-1];last.discount=(last.discount||0)+disc;last.finalPrice=parseFloat(Math.max(0,last.finalPrice-disc).toFixed(2));}continue;}
      if(DNRX.test(l))continue;
      const qim=l.match(QTY_INLINE_RX);
      if(qim){const unitPrice=parseFloat(qim[2].replace(',','.'));let qty=parseInt(qim[1])||1;if(i<pLines.length&&isPrice(pLines[i].trim())){const tot=fp(pLines[i].trim());const inf=Math.round(tot/unitPrice);if(inf>=1&&inf<=20&&Math.abs(inf*unitPrice-tot)<0.02)qty=inf;i++;}if(out.length>0){const last=out[out.length-1];last.qty=qty;last.unitPrice=unitPrice;last.price=unitPrice;last.finalPrice=parseFloat((unitPrice*qty).toFixed(2));}continue;}
      const qsm=l.match(/^(\d+)\s+[xX]\s*$/);
      if(qsm){const qty=parseInt(qsm[1]);let unitPrice=null;if(i<pLines.length){const np=pLines[i].trim();if(isPrice(np)){unitPrice=fp(np);i++;}}if(i<pLines.length&&isPrice(pLines[i].trim()))i++;if(!unitPrice)continue;if(out.length>0){const last=out[out.length-1];last.qty=qty;last.unitPrice=unitPrice;last.price=unitPrice;last.finalPrice=parseFloat((unitPrice*qty).toFixed(2));}continue;}
      const qom=l.match(QTY_OPEN_RX);
      if(qom){const qty=parseInt(qom[1]);let unitPrice=null;if(i<pLines.length&&isPrice(pLines[i].trim())){unitPrice=fp(pLines[i].trim());i++;}if(i<pLines.length&&isPrice(pLines[i].trim()))i++;if(!unitPrice)continue;if(out.length>0){const last=out[out.length-1];last.qty=qty;last.unitPrice=unitPrice;last.price=unitPrice;last.finalPrice=parseFloat((unitPrice*qty).toFixed(2));}continue;}
      if(isPrice(l)){const pr=fp(l);if(out.length>0){for(let k=out.length-1;k>=Math.max(0,out.length-4);k--){if(!out[k].unitPrice||out[k].unitPrice===0){if(/art.*total|total.*pagar/i.test(out[k].rawName||'')){out.splice(k,1);break;}out[k].unitPrice=pr;out[k].price=pr;out[k].finalPrice=parseFloat((pr*(out[k].qty||1)).toFixed(2));break;}}}continue;}
      if(ACDRX.test(l))continue;
      if(!isKgInfo(l)&&!WEIGHT_RX.test(l)){const nm=cleanName(l);const nextL=(pLines[i]||'').trim();const code=ACDRX.test(nextL)?nextL:null;if(nm.length>=2){const prod=makeProduct(nm,l,0,1);if(code)prod._code=code;out.push(prod);}}
    }
    for(let k=out.length-1;k>=0;k--){if(!out[k].unitPrice||out[k].unitPrice===0)out.splice(k,1);}
  }

  // ── LIDL COLUMNAS ─────────────────────────────────────────────
  function parseLidlColumns(pLines,allLines,out){
    let startNIF=0;const nifIdx=pLines.findIndex(l=>/^nif\b/i.test(l.trim()));if(nifIdx>=0)startNIF=nifIdx+1;
    let totalIdx=pLines.findIndex(l=>/^total$/i.test(l.trim()));if(totalIdx<0)totalIdx=pLines.length;
    const nameLines=pLines.slice(startNIF,totalIdx);const afterTotal=pLines.slice(totalIdx);
    const entries=[];let j=0;
    while(j<nameLines.length){
      const l=nameLines[j].trim();j++;
      if(!l||isSkip(l)||BARCODE_RX.test(l)||SEP_RX.test(l))continue;
      if(/^\d/.test(l))continue;
      if(/^(ooo|eur$|'|")/i.test(l))continue;
      if(/calle|avda|plaza|\d{5}/.test(l))continue;
      if(/s\.a\.u?\.?$|s\.l\.$/i.test(l))continue;
      if(store&&l.toLowerCase().includes(store.toLowerCase()))continue;
      if(/^(lidl|aldi|dia|mercadona|carrefour)$/i.test(l))continue;
      if(/^(\d+\s*u\b|eur\/kg)/i.test(l))continue;
      if(LIDL_PRICE_RX.test(l)||UNIT_PRICE_X_RX.test(l)||isPrice(l))continue;
      // PROMO LIDL PLUS → descuento en el producto anterior
      if(/^promo\s+lidl/i.test(l)){if(entries.length>0)entries[entries.length-1].hasDiscount=true;continue;}
      // Desc. → descuento en el producto anterior (o el siguiente si no hay previo)
      if(/^desc\.?$/i.test(l)){if(entries.length>0)entries[entries.length-1].hasDiscount=true;continue;}
      let kgInfo=null,packUnit=null,packQty=1;
      if(j<nameLines.length&&MULT_RX.test(nameLines[j].trim())){kgInfo=nameLines[j].trim();j++;if(j<nameLines.length&&/^eur\/kg/i.test(nameLines[j].trim()))j++;}
      if(j<nameLines.length&&UNIT_PRICE_X_RX.test(nameLines[j].trim())){const m=nameLines[j].trim().match(/^(\d{1,3}[.,]\d{2})/);packUnit=m?parseFloat(m[1].replace(',','.')):null;j++;if(j<nameLines.length&&/^\d+$/.test(nameLines[j].trim())){packQty=parseInt(nameLines[j].trim());j++;}}
      if(j<nameLines.length&&/^\d{1,3}[.,]\d{2}[xX]$/.test(nameLines[j].trim())){const m=nameLines[j].trim().match(/^(\d{1,3}[.,]\d{2})/);if(m)packUnit=parseFloat(m[1].replace(',','.'));j++;}
      entries.push({raw:l,qty:packQty,unitPrice:packUnit,kgInfo,hasDiscount:false});
    }
    // Recoger precios y descuentos intercalados del bloque post-Total
    // Formato: [2,69 A] [-0,80] [0,15 C] ... — el negativo va al precio inmediatamente anterior
    const pricePairs=[];let inPB=false,curPair=null;
    for(const l of afterTotal){
      const t=l.trim();
      if(LIDL_PRICE_RX.test(t)){
        if(curPair) pricePairs.push(curPair);
        curPair={price:parseLidlPrice(t),discount:0};inPB=true;
      } else if(/^-(\d{1,3}[.,]\d{2})$/.test(t)){
        const disc=parseFloat(t.replace('-','').replace(',','.'));
        if(curPair) curPair.discount+=disc;
      } else if(inPB&&isPrice(t)){
        if(curPair) pricePairs.push(curPair);curPair=null;break;
      }
    }
    if(curPair) pricePairs.push(curPair);
    for(let k=0;k<entries.length;k++){
      const e=entries[k],pp=pricePairs[k];if(!pp)continue;
      const nm=cleanName(e.raw);if(nm.length<2)continue;
      let prod;
      if(e.kgInfo) prod=makeProduct(nm,e.raw,pp.price,1);
      else if(e.unitPrice){const qty=e.qty>1?e.qty:Math.max(1,Math.round(pp.price/e.unitPrice));if(qty>=2&&Math.abs(e.unitPrice*qty-pp.price)<0.02)prod=makeProduct(nm,e.raw,e.unitPrice,qty);else prod=makeProduct(nm,e.raw,pp.price,1);}
      else prod=makeProduct(nm,e.raw,pp.price,1);
      if(pp.discount>0){prod.discount=pp.discount;prod.finalPrice=parseFloat(Math.max(0,prod.finalPrice-pp.discount).toFixed(2));}
      out.push(prod);
    }
  }

  // ── LIDL INLINE ───────────────────────────────────────────────
  function parseLidlInline(pLines,out){
    let startIdx=0;{const ni=pLines.findIndex(l=>/^nif\b/i.test(l.trim()));if(ni>=0)startIdx=ni+1;}
    const lines=pLines.slice(startIdx);
    function iPN(l){if(!l||l.length<2)return false;if(isSkip(l)||BARCODE_RX.test(l)||SEP_RX.test(l))return false;if(/^(nif|cif|eur\/kg|eur$|entrega|recibo|total|inicio|folletos|mi\s+cuenta|lidl\s+plus|ooo|desc\.?$)/i.test(l))return false;if(/calle|avda|plaza|\d{5}/.test(l))return false;if(/s\.a\.u?\.?$|s\.l\.$/i.test(l))return false;if(store&&l.toLowerCase().includes(store.toLowerCase()))return false;if(/^(lidl|aldi|dia|mercadona|carrefour)$/i.test(l))return false;if(/^(82|ooo|'|"|eur$)$/i.test(l))return false;if(LIDL_PRICE_RX.test(l)||isPrice(l)||UNIT_PRICE_X_RX.test(l))return false;if(/^-?\d+$/.test(l)||/^-\d{1,3}[.,]\d{2}$/.test(l))return false;if(isKgInfo(l)||WEIGHT_RX.test(l)||MULT_RX.test(l))return false;if(/^\d+g\s*[\(\d]/i.test(l))return false;if(/[\u{1F300}-\u{1FFFF}\u{2600}-\u{27FF}\u{1F000}-\u{1FFFF}]/u.test(l))return false;if(/^[^\x00-\x7F\u00C0-\u024F]/.test(l))return false;return true;}
    function eQX(l){const m=l.match(/^(.+?)\s+(\d{1,3}[.,]\d{2})[xX]$/);return m?{name:m[1].trim(),unitP:parseFloat(m[2].replace(',','.'))}:null;}
    const entries=[];let ii=0;
    while(ii<lines.length){const l=lines[ii].trim();ii++;const qxm=eQX(l);if(qxm&&ii<lines.length){const nl=lines[ii].trim();const qty=parseInt(nl);if(qty>=1&&qty<=99&&/^\d+$/.test(nl)){entries.push({name:qxm.name,hasDiscount:false,kgInfo:null,inlineUnit:qxm.unitP,inlineQty:qty});ii++;continue;}}if(/^promo\s+lidl/i.test(l)){for(let k=entries.length-1;k>=Math.max(0,entries.length-3);k--){if(!entries[k].hasDiscount){entries[k].hasDiscount=true;break;}}continue;}if(/^desc\.?$/i.test(l)){let mk=false;for(let k=entries.length-1;k>=Math.max(0,entries.length-3);k--){if(!entries[k].hasDiscount){entries[k].hasDiscount=true;mk=true;break;}}if(!mk){for(let jj=ii;jj<Math.min(ii+4,lines.length);jj++){const nxt=lines[jj].trim();if(iPN(nxt)){entries.push({name:nxt,hasDiscount:true,kgInfo:null,pendingIdx:jj+startIdx});ii=jj+1;mk=true;break;}if(LIDL_PRICE_RX.test(nxt)||isPrice(nxt))break;}}continue;}if(!iPN(l))continue;const pI=entries.findIndex(e=>e.pendingIdx===ii-1+startIdx);if(pI>=0)continue;let kgInfo=null;if(ii<lines.length&&MULT_RX.test(lines[ii].trim())){kgInfo=lines[ii].trim();ii++;if(ii<lines.length&&/^eur\/kg/i.test(lines[ii].trim()))ii++;}entries.push({name:l,hasDiscount:false,kgInfo});}
    const posPrices=[];const rawXM=[];for(let li=0;li<lines.length;li++){const t=lines[li].trim();if(LIDL_PRICE_RX.test(t)){const p=parseLidlPrice(t);if(p!=null&&p>0)posPrices.push(p);}else if(/^\d{1,3}[.,]\d{2}[xX]$/.test(t)){rawXM.push({unitP:parseFloat(t.replace(/[xX]/,'').replace(',','.')),lineIdx:li});}}
    const xByE={};for(const xm of rawXM){for(let k=entries.length-1;k>=0;k--){const en=entries[k].name.toUpperCase();const nli=lines.findIndex((l,li)=>li<xm.lineIdx&&l.trim().toUpperCase().includes(en));if(nli>=0){xByE[k]=xm.unitP;break;}}}
    let priceIdx=0;for(let k=0;k<entries.length;k++){const e=entries[k];const nm=cleanName(e.name);if(nm.length<2)continue;if(e.inlineUnit!=null){out.push(makeProduct(nm,e.name,e.inlineUnit,e.inlineQty||1));const eT=parseFloat((e.inlineUnit*(e.inlineQty||1)).toFixed(2));if(posPrices[priceIdx]!=null&&Math.abs(posPrices[priceIdx]-eT)<0.02)priceIdx++;continue;}const price=posPrices[priceIdx];priceIdx++;if(price==null)continue;const unitP=xByE[k];if(unitP){const qty=Math.round(price/unitP);if(qty>=2&&Math.abs(unitP*qty-price)<0.02){out.push(makeProduct(nm,e.name,unitP,qty));continue;}}out.push(makeProduct(nm,e.name,price,1));}
    const discE=entries.map((e,k)=>k).filter(k=>entries[k].hasDiscount);const negAmt=[];for(const l of lines){const t=l.trim();if(/^-(\d{1,3}[.,]\d{2})$/.test(t)){const m=t.match(/^-(\d{1,3}[.,]\d{2})$/);negAmt.push(parseFloat(m[1].replace(',','.')));}}
    const lastDK=discE.length>0?discE[discE.length-1]:-1;negAmt.forEach((disc,jj)=>{const k=jj<discE.length?discE[jj]:lastDK;const prod=k>=0?out[k]:null;if(!prod||!disc)return;prod.discount=(prod.discount||0)+disc;prod.finalPrice=parseFloat(Math.max(0,prod.finalPrice-disc).toFixed(2));});
  }

  // ── GENÉRICO ──────────────────────────────────────────────────
  function parseGeneric(pLines,out){
    if(isLidlColumnFormat){parseLidlColumns(pLines,[...pLines],out);return;}
    const pIFH=pLines.slice(0,Math.ceil(pLines.length/2)).filter(l=>LIDL_PRICE_RX.test(l.trim())).length;
    if(pIFH>0){parseLidlInline(pLines,out);return;}
    let i=0;
    while(i<pLines.length){const trimmed=pLines[i].trim();i++;if(!trimmed||trimmed.length<2)continue;if(isSkip(trimmed)||BARCODE_RX.test(trimmed)||SEP_RX.test(trimmed))continue;if(/^\d{1,2}[\/.:]\d{2}/.test(trimmed))continue;if(MULT_RX.test(trimmed)||UNIT_PRICE_X_RX.test(trimmed))continue;if(isKgInfo(trimmed)||WEIGHT_RX.test(trimmed))continue;if(store&&trimmed.toLowerCase()===store.toLowerCase())continue;if(/^[A-Z.]{2,8}[:.]\s*[A-Z0-9T]{3,}$/i.test(trimmed))continue;
    const lim=trimmed.match(/^(.+?)\s+(\d{1,3}[.,]\d{2})\s*[A-Z]?\s*$/);if(lim){const rn=lim[1].trim();const price=parseFloat(lim[2].replace(',','.'));if(price>0&&price<=500&&rn.length>=2&&!isSkip(rn)&&!/^total$/i.test(rn)&&!(store&&rn.toLowerCase()===store.toLowerCase())){const nm=cleanName(rn);if(nm.length>=2)out.push(makeProduct(nm,rn,price,1));}continue;}
    const im=trimmed.match(INLINE_RX);if(im){const rn=im[1].trim();const price=parseFloat(im[2].replace(',','.'));if(price>0&&price<=500&&rn.length>=2&&!isSkip(rn)&&!/^\d/.test(rn)){const qm=rn.match(/^(\d+)\s+(.+)/);const qty=qm?parseInt(qm[1]):1;const nm=cleanName(qm?qm[2]:rn);if(nm.length>=2)out.push(makeProduct(nm,rn,qty>1?parseFloat((price/qty).toFixed(2)):price,qty));}continue;}
    if(isPrice(trimmed)||isLidlPrice(trimmed))continue;if(/^\d/.test(trimmed))continue;
    const priceLines=[];let j=i;while(j<pLines.length){const next=pLines[j].trim();if(!next){j++;continue;}if(isPrice(next)||isLidlPrice(next)){priceLines.push(parseLidlPrice(next)||parsePrice(next));j++;}else if(isKgInfo(next)||WEIGHT_RX.test(next)||MULT_RX.test(next)){j++;}else if(/^[A-Z.]{2,8}[:.]\s*[A-Z0-9T]{3,}$/i.test(next)){j++;}else break;}
    if(priceLines.length>0){i=j;const price=priceLines[priceLines.length-1];if(isSkip(trimmed)||trimmed.length<2)continue;const qm=trimmed.match(/^(\d+)\s+(.+)/);const qty=qm?parseInt(qm[1]):1;const nm=cleanName(qm?qm[2]:trimmed);if(!/^\d+$/.test(nm)&&nm.length>=2)out.push(makeProduct(nm,trimmed,qty>1?parseFloat((price/qty).toFixed(2)):price,qty));}}
  }

  function cleanName(raw){return raw.replace(/\d+[.,]\d+\s*kg.*/i,'').replace(/\s*€\/kg.*/i,'').replace(/\s*€\/u.*/i,'').replace(/\)$/,'').trim();}
}

function makeProduct(name,rawName,unitPrice,qty=1){const total=parseFloat((unitPrice*qty).toFixed(2));return{rawName,name:normalizeProdName(name),price:unitPrice,unitPrice,finalPrice:total,discount:0,qty,confidence:name.length>3&&unitPrice>0.1?0.8:0.5,category:guessCategory(name),assignedTo:null,shared:true,pct1:50};}
function normalizeProdName(raw){return raw.replace(/\bLT\b/gi,'litro').replace(/\bKG\b/gi,'kg').replace(/\bGR?\b/gi,'g').replace(/\bUN\b/gi,'unidad').replace(/\bBOT\b/gi,'botella').replace(/\bPK\b/gi,'pack').replace(/\bFRD\b/gi,'fresa').replace(/\bTO\b$/gi,'tomate').replace(/\bSAL\s+TO\b/gi,'salsa tomate').replace(/([a-záéíóúñ])([A-ZÁÉÍÓÚÑ])/g,'$1 $2').toLowerCase().replace(/^\w/,c=>c.toUpperCase()).trim();}
function guessCategory(name){const n=name.toLowerCase();if(/leche|yogur|queso|mantequilla|nata|kefir/.test(n))return 'lácteos';if(/cerveza|agua|refresco|zumo|vino|cava|whisky|ron|gin|vodka/.test(n))return 'bebidas';if(/pollo|carne|ternera|cerdo|salchich|jamón|chorizo|longaniza|pavo|cordero/.test(n))return 'carne';if(/merluza|salmon|atún|bacalao|dorada|lubina|gamba|mejillon|calamar/.test(n))return 'pescado';if(/manzana|pera|naranja|plátano|fresa|uva|melocoton|mandarina|limón|kiwi|lechuga|tomate|patata|cebolla|zanahoria|pimiento|calabacin|espinaca|brócoli/.test(n))return 'fruta';if(/helado|pizza|croqueta|nugget|varitas/.test(n))return 'congelados';if(/gel|champú|jabón|pasta\s*dent|colonia|desodorante|crema|maquillaje|sensodyne|atopic/.test(n))return 'higiene';if(/lejia|suavizante|detergente|fregasuelos|bayeta|estropajo|bolsa\s*basura/.test(n))return 'limpieza';return 'alimentación';}

// ── GROQ ──────────────────────────────────────────────────────
async function callGroq(prompt){const key=DB.groqKey;if(!key)throw new Error('No hay API key de Groq. Ve a Configuración.');const res=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},body:JSON.stringify({model:'llama-3.3-70b-versatile',messages:[{role:'user',content:prompt}],temperature:0.2,max_tokens:1024})}).catch(e=>{throw new Error('Red bloqueada: '+e.message);});if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.error?.message||'Groq HTTP '+res.status);}const data=await res.json();if(!DB.groqStats)DB.groqStats={calls:0,firstCall:null,tokensUsed:0};DB.groqStats.calls=(DB.groqStats.calls||0)+1;DB.groqStats.tokensUsed=(DB.groqStats.tokensUsed||0)+(data.usage?.total_tokens||0);if(!DB.groqStats.firstCall)DB.groqStats.firstCall=new Date().toISOString().slice(0,10);S.set('groqStats',JSON.stringify(DB.groqStats));return data.choices?.[0]?.message?.content||'';}
async function groqParseText(ocrText){const key=DB.groqKey;if(!key)throw new Error('Sin API key Groq');const knownProds=Object.entries(DB.knowledge.products).slice(0,8).map(([k,v])=>`${k}→${v.shared?'común':personName(v.person)}`).join(', ');const prompt=`Analiza este texto de un ticket de supermercado español. Devuelve SOLO JSON sin markdown ni texto extra:\n{"store":"","date":"YYYY-MM-DD o null","time":"HH:MM o null","total":0,"last4":"4 dígitos o null","products":[{"rawName":"texto literal","name":"nombre legible","price":0,"unitPrice":0,"qty":1,"confidence":0.9,"category":"alimentación|higiene|limpieza|bebidas|lácteos|fruta|carne|pescado|congelados|otro"}],"errors":[],"warnings":[]}\nIgnora líneas de IVA, entrega efectivo, devolución, descuentos con %, total, subtotal.\nTexto:\n${ocrText}\n${knownProds?' Conocidos: '+knownProds:''}`;const res=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},body:JSON.stringify({model:'llama-3.3-70b-versatile',messages:[{role:'user',content:prompt}],temperature:0.1,max_tokens:2048})});if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.error?.message||'Groq HTTP '+res.status);}const data=await res.json();const text=data.choices?.[0]?.message?.content||'';const clean=text.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();try{return JSON.parse(clean);}catch{const m=clean.match(/\{[\s\S]*\}/);if(m)return JSON.parse(m[0]);throw new Error('JSON inválido de Groq');}}

// ── PROCESS FILE ──────────────────────────────────────────────
async function processFile(file){
  showOCRLoading('Preparando imagen...');
  try{
    if(file.type==='application/pdf'){hideOCRLoading();showToast('Los PDFs no son compatibles. Usa el modo manual.',4000);openTicketEditor(getEmptyTicket());return;}
    setOCRStatus('Optimizando imagen...');
    const b64=await resizeForOCR(file);
    console.log('Imagen lista:',Math.round(b64.length*0.75/1024),'KB');
    let ocrText='';
    try{setOCRStatus('Leyendo ticket...');ocrText=await googleVisionExtract(b64);window._lastTicketB64=b64;if(!DB.visionStats)DB.visionStats={calls:0,firstCall:null};DB.visionStats.calls=(DB.visionStats.calls||0)+1;if(!DB.visionStats.firstCall)DB.visionStats.firstCall=new Date().toISOString().slice(0,10);S.set('visionStats',JSON.stringify(DB.visionStats));S.set('lastOCR',ocrText.slice(0,3000));}catch(ocrErr){console.warn('Google Vision falló:',ocrErr.message);setOCRStatus('Vision falló...');}
    let result;
    if(ocrText){setOCRStatus('Interpretando ticket...');result=parseTicketText(ocrText);console.log('Parser local:',result.products.length,'productos');}
    else{hideOCRLoading();showToast('No se pudo leer el ticket. Inténtalo manualmente.',4000);openTicketEditor(getEmptyTicket());return;}
    result.products=(result.products||[]).map(p=>applyKnowledgeToProduct(p));
    result.type='ticket';result.id=uid();result.payer=DB.persons[0].id;result.confirmed=false;result.createdAt=new Date().toISOString();
    if(result.last4&&DB.knowledge.cards[result.last4])result.payer=DB.knowledge.cards[result.last4];
    // Guardar imagen comprimida en IndexedDB vinculada al ticket
    if(window._lastTicketB64) await ImgDB.save(result.id, 'data:image/jpeg;base64,'+window._lastTicketB64);
    hideOCRLoading();openTicketEditor(result);
  }catch(err){hideOCRLoading();showToast('Error: '+err.message,5000);console.error('processFile error:',err);openTicketEditor(getEmptyTicket());}
}

function applyKnowledgeToProduct(prod){const rawNorm=normalizeKey(prod.rawName||'');const nameNorm=normalizeKey(prod.name||'');const rawUpper=(prod.rawName||'').trim().toUpperCase();const nameUpper=(prod.name||'').trim().toUpperCase();let match=DB.knowledge.products[rawNorm]||DB.knowledge.products[nameNorm]||Object.values(DB.knowledge.products).find(v=>v.ocr_raw&&(v.ocr_raw.includes(rawUpper)||v.ocr_raw.includes(nameUpper)))||Object.values(DB.knowledge.products).find(v=>v.alias&&(normalizeKey(v.alias)===rawNorm||normalizeKey(v.alias)===nameNorm));if(match){prod.assignedTo=match.shared?null:match.person;prod.shared=!!match.shared;prod.pct1=match.pct1||50;prod.knownMatch=true;if(match.alias&&match.alias!==prod.name)prod.name=match.alias;}else{prod.assignedTo=null;prod.shared=true;prod.pct1=50;}prod.finalPrice=prod.finalPrice??prod.price;return prod;}
function getEmptyTicket(){return{id:uid(),type:'ticket',store:'',date:new Date().toISOString().slice(0,10),total:0,last4:null,payer:DB.persons[0].id,products:[],errors:[],warnings:[],confirmed:false,createdAt:new Date().toISOString()};}

document.getElementById('file-input').addEventListener('change',function(){if(this.files[0])processFile(this.files[0]);this.value='';});
document.getElementById('camera-input').addEventListener('change',function(){if(this.files[0])processFile(this.files[0]);this.value='';});
function triggerCamera(){document.getElementById('camera-input').click();}
function triggerFileGallery(){document.getElementById('file-input').click();}

// ── HOME ──────────────────────────────────────────────────────
function renderHome(){
  const bal=calcBalance();
  const recent=[...DB.tickets,...DB.expenses].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,6);
  document.getElementById('view').innerHTML=`
    <div class="screen-header"><div class="header-brand"><img src="icon.png" class="header-logo" onclick="onLogoTap()" onerror="this.style.display='none'"/><h1>Clarito</h1></div></div>
    <div class="balance-hero">
      <div class="balance-hero-label">Balance actual</div>
      ${bal.amount<0.01
        ?`<div class="balance-hero-amount balance-ok">Cuentas al día</div>`
        :`<div class="balance-hero-amount balance-debt">${fmt(bal.amount)}</div><div class="balance-hero-sub">${personName(bal.owes)} debe a ${personName(bal.owes===DB.persons[0].id?DB.persons[1]?.id:DB.persons[0].id)}</div>`}
      <div class="balance-persons">
        ${DB.persons.map(p=>`<div class="person-row"><div class="person-dot" style="background:${p.color}"></div><div class="person-name">${p.name}</div><div class="person-amount">${fmt(bal.paid[p.id]||0)}</div></div>`).join('')}
      </div>
    </div>
    <div class="quick-actions">
      <button class="qa-btn" onclick="showScreen('tickets')"><svg viewBox="0 0 24 24" fill="none"><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/></svg><span>Subir ticket</span></button>
      <button class="qa-btn" onclick="openManualExpense()"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg><span>Gasto manual</span></button>
      <button class="qa-btn" onclick="showScreen('stats')"><svg viewBox="0 0 24 24" fill="none"><rect x="18" y="3" width="4" height="18"/><rect x="10" y="8" width="4" height="13"/><rect x="2" y="13" width="4" height="8"/></svg><span>Estadísticas</span></button>
      <button class="qa-btn" onclick="showScreen('balance')"><svg viewBox="0 0 24 24" fill="none"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg><span>Balance</span></button>
    </div>
    <div class="recent-label">Últimas actividades</div>
    ${recent.length===0?`<div class="empty-state"><svg viewBox="0 0 24 24" fill="none"><rect x="2" y="3" width="20" height="18" rx="2"/></svg><h3>Sin actividad todavía</h3><p>Sube tu primer ticket o añade un gasto manual</p></div>`:recent.map(renderTicketListItem).join('')}
    ${renderPredictionsWidget()}`;
}

function renderTicketListItem(t){
  const payer=personById(t.payer);const color=payer?.color||'#888';
  const firstProd=t.products&&t.products.length>0?t.products[0].name||t.products[0].rawName||'':'';
  return`<div class="ticket-item" onclick="editItem('${t.id}')">
    <div class="ticket-icon" style="background:${color}22"><svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.7"><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="8" y1="8" x2="16" y2="8"/></svg></div>
    <div class="ticket-info"><div class="ticket-store">${t.store||t.category||t.description||'Gasto'}</div>${firstProd?`<div class="ticket-first-prod">${firstProd}</div>`:''}<div class="ticket-date">${fmtDate(t.date)}</div></div>
    <div class="ticket-right"><div class="ticket-amount">${fmt(t.total)}</div><div class="ticket-payer">${payer?.name||''}</div></div>
  </div>`;
}

function renderPredictionsWidget(){const preds=getPredictions().slice(0,2);if(!preds.length)return'';return`<div class="recent-label">Previsiones</div>${preds.map(p=>`<div class="pred-card"><div class="pred-info"><div class="pred-name">${p.name}</div><div class="pred-detail">${p.detail}</div></div><div class="pred-days">~${p.days}d</div></div>`).join('')}`;}

function calcBalance(){
  const paid={},owedTo={};DB.persons.forEach(p=>{paid[p.id]=0;owedTo[p.id]=0;});
  DB.tickets.filter(t=>t.confirmed&&!t.settled).forEach(t=>{const pid=t.payer;(t.products||[]).forEach(prod=>{const price=parseFloat(prod.finalPrice||prod.price||0);if(isNaN(price)||price<=0)return;paid[pid]=(paid[pid]||0)+price;if(prod.assignedTo){if(prod.assignedTo!==pid)owedTo[pid]=(owedTo[pid]||0)+price;}else{DB.persons.forEach(p=>{if(p.id===pid)return;const pct=p.id===DB.persons[0].id?(prod.pct1||50):100-(prod.pct1||50);owedTo[pid]=(owedTo[pid]||0)+price*pct/100;});}});});
  DB.expenses.filter(e=>e.confirmed&&!e.settled).forEach(e=>{const amt=parseFloat(e.total||0);if(isNaN(amt)||amt<=0)return;const pid=e.payer;paid[pid]=(paid[pid]||0)+amt;DB.persons.forEach((p,i)=>{if(p.id===pid)return;const pct=i===0?e.split1:100-e.split1;owedTo[pid]=(owedTo[pid]||0)+amt*(pct||50)/100;});});
  let owes=null,amount=0;if(DB.persons.length>=2){const n=(owedTo[DB.persons[0].id]||0)-(owedTo[DB.persons[1].id]||0);if(n>0.005){owes=DB.persons[1].id;amount=n;}else if(n<-0.005){owes=DB.persons[0].id;amount=-n;}}
  return{paid,owes,amount};
}

function renderTickets(){
  const all=DB.tickets.slice().reverse();const active=all.filter(t=>!t.settled);const past=all.filter(t=>t.settled);
  document.getElementById('view').innerHTML=`
    <div class="screen-header"><h1>Tickets</h1><p>${active.length} activos</p></div>
    <div class="upload-zone" onclick="triggerFileGallery()"><svg viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="20" height="20" rx="3"/><polyline points="12 8 12 16"/><polyline points="8 12 12 8 16 12"/></svg><h3>Subir ticket</h3></div>
    <div class="upload-actions"><button class="btn-secondary" onclick="triggerCamera()">Cámara</button><button class="btn-secondary" onclick="openManualTicket()">Manual</button></div>
    <div class="list-spacer"></div>
    ${active.length===0?`<div class="empty-state"><svg viewBox="0 0 24 24" fill="none"><rect x="2" y="3" width="20" height="18" rx="2"/></svg><h3>Sin tickets activos</h3><p>Sube una foto para empezar</p></div>`:active.map(renderTicketListItem).join('')}
    ${past.length>0?`<div class="recent-label section-past"><span>Tickets pasados</span><span class="section-count">${past.length}</span></div><div class="past-list">${past.map(renderTicketListItem).join('')}</div>`:''}`;
  const zone=document.querySelector('.upload-zone');
  if(zone){zone.addEventListener('dragover',e=>{e.preventDefault();zone.classList.add('drag')});zone.addEventListener('dragleave',()=>zone.classList.remove('drag'));zone.addEventListener('drop',e=>{e.preventDefault();zone.classList.remove('drag');if(e.dataTransfer.files[0])processFile(e.dataTransfer.files[0]);});}
}

// ── TICKET EDITOR ─────────────────────────────────────────────
let currentTicket=null,_releerMode=false;
function openTicketEditor(ticket){
  currentTicket=JSON.parse(JSON.stringify(ticket));
  renderTicketEditor();
  document.getElementById('ticket-editor').style.display='flex';
  // Cargar imagen desde IndexedDB si existe (tickets ya guardados)
  if(!window._lastTicketB64 && ticket.id){
    ImgDB.get(ticket.id).then(b64=>{
      if(b64){
        window._lastTicketB64=b64.replace('data:image/jpeg;base64,','');
        // Mostrar miniatura si el editor sigue abierto
        const thumb=document.getElementById('ticket-thumb');
        if(thumb){thumb.src=b64;thumb.style.display='block';}
        // Actualizar botón releer
        renderTicketEditor();
      }
    });
  }
}

function renderTicketEditor(){
  const t=currentTicket;
  const errorsHtml=[...(t.errors||[]),...(t.warnings||[])].map(e=>`<div class="error-chip">${e}<button onclick="dismissErrors()">Ignorar</button></div>`).join('');
  const payerBtns=DB.persons.map(p=>`<button onclick="setTicketPayer('${p.id}')" class="payer-btn ${t.payer===p.id?'active':''}" style="--payer-color:${p.color}">${p.name}</button>`).join('');
  document.getElementById('ticket-editor').innerHTML=`
    <div class="te-header"><button onclick="closeTicketEditor()" class="icon-btn"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button><h2>Revisar ticket</h2>
      ${window._lastTicketB64?`<img id="ticket-thumb" src="data:image/jpeg;base64,${window._lastTicketB64}" class="ticket-thumb" onclick="showTicketImage()"/>`:`<img id="ticket-thumb" style="display:none" class="ticket-thumb" onclick="showTicketImage()"/>`}
      <button onclick="deleteCurrentTicket()" class="btn-text-danger">Eliminar</button></div>
    <div class="te-body">
      ${errorsHtml?`<div class="te-section">${errorsHtml}</div>`:''}
      <div class="te-section"><div class="te-section-title">Información</div>
        <div class="card">
          <div class="field-row"><label class="field-label">Supermercado</label><input value="${t.store||''}" placeholder="Ej: Mercadona" oninput="currentTicket.store=this.value"/></div>
          <div class="datetime-row"><div><label class="field-label">Fecha</label><input type="date" value="${t.date||''}" onchange="currentTicket.date=this.value"/></div><div><label class="field-label">Hora</label><input type="time" value="${t.time||''}" onchange="currentTicket.time=this.value"/></div></div>
          <div class="field-row field-row-mt"><label class="field-label">Total</label><input type="text" inputmode="decimal" value="${t.total!=null?(+t.total).toFixed(2):''}" placeholder="0.00" oninput="currentTicket.total=parseFloat(this.value.replace(',','.'))||0"/></div>
          <div class="field-row field-row-mt"><label class="field-label">Últimos 4 dígitos tarjeta</label><input value="${t.last4||''}" placeholder="4821" maxlength="4" oninput="currentTicket.last4=this.value" class="input-card"/></div>
        </div>
      </div>
      <div class="te-section"><div class="te-section-title">¿Quién pagó?</div><div class="payer-btns">${payerBtns}</div></div>
      <div class="te-section"><div class="te-section-title">Productos (${(t.products||[]).length})</div>
        <div id="products-list">${(t.products||[]).map((p,i)=>renderProductRow(p,i)).join('')}</div>
        <button class="btn-ghost btn-add-product" onclick="addEmptyProduct()">+ Añadir producto</button>
      </div>
      <div class="te-spacer"></div>
    </div>
    <div class="te-footer">
      <button class="btn-secondary" onclick="closeTicketEditor()">Cancelar</button>
      ${DB.groqKey&&window._lastTicketB64?(_releerMode?`<button class="btn-secondary" onclick="seleccionarTodoReleer()">Todas</button><button class="btn-primary btn-releer" onclick="enviarReleer()">Enviar</button>`:`<button class="btn-secondary" onclick="activarReleer()">Releer</button>`):''}
      <button class="btn-primary btn-save" onclick="saveTicket()">Guardar</button>
    </div>`;
}

function parsePrice(v){return parseFloat(String(v).replace(',','.'))||0;}

function renderProductRow(prod,i){
  const confClass=prod.confidence>=0.85?'conf-high':prod.confidence>=0.6?'conf-mid':'conf-low';
  const assignedTo=prod.assignedTo;const isShared=!assignedTo;const qty=prod.qty||1;
  const unitPrice=prod.unitPrice??prod.finalPrice??prod.price??0;
  const hasDiscount=prod.discount&&prod.discount>0;
  const total=hasDiscount?parseFloat((prod.finalPrice??0).toFixed(2)):parseFloat((unitPrice*qty).toFixed(2));
  const unitDisplay=unitPrice>0?unitPrice.toFixed(2):'';
  const personBtns=DB.persons.map(p=>`<button class="assign-btn ${assignedTo===p.id?'active':''}" style="--assign-color:${p.color}" onclick="assignProduct(${i},'${p.id}')">${p.name}</button>`).join('');
  if(_releerMode){
    return`<div class="product-row releer-card" id="releer-card-${i}" data-idx="${i}" data-selected="0" onclick="toggleReleerCard(${i})">
      <div class="product-top">
        <div class="confidence-dot ${confClass}"></div>
        <div class="product-name-wrap"><div class="product-name-text">${prod.name||''}</div>${prod.rawName&&prod.rawName!==prod.name?`<div class="product-name-raw">${prod.rawName}</div>`:''}</div>
        <div class="product-price-block">
          <div class="price-unit-row"><span class="price-unit-label">u/</span><span class="price-unit-val">${unitDisplay}</span></div>
          <div class="price-total-row">${qty>1?`<span class="price-qty">${qty}×</span>`:''}<span class="price-final ${hasDiscount?'price-discounted':''}">${total>0?total.toFixed(2)+' €':''}</span></div>
        </div>
      </div>
    </div>`;
  }
  return`<div class="product-row" id="prod-${i}">
    <div class="product-top">
      <div class="confidence-dot ${confClass}"></div>
      <div class="product-name-wrap"><input value="${prod.name||''}" class="product-name-input" oninput="currentTicket.products[${i}].name=this.value" placeholder="Nombre del producto"/>${prod.rawName&&prod.rawName!==prod.name?`<div class="product-name-raw">${prod.rawName}</div>`:''}</div>
      <div class="product-price-block">
        <div class="price-unit-row"><span class="price-unit-label">u/</span><input class="product-price-input" value="${unitDisplay}" placeholder="0,00" inputmode="decimal" onfocus="if(this.value==='0.00'||this.value==='0,00')this.value=''" onblur="if(!this.value)this.value='0.00';updateUnitPrice(${i},this.value)" oninput="updateUnitPrice(${i},this.value)"/></div>
        <div class="price-total-row">
          <button onclick="changeQty(${i},-1)" class="qty-btn">−</button><span id="qty-${i}" class="qty-val">${qty}×</span><button onclick="changeQty(${i},1)" class="qty-btn">+</button>
          ${(hasDiscount||qty>1)?`<span class="price-prev ${hasDiscount?'strikethrough':''}">${hasDiscount?(unitPrice*qty).toFixed(2)+' €':unitPrice.toFixed(2)+' €/u'}</span>`:''}
          <span id="total-${i}" class="price-final ${hasDiscount?'price-discounted':''}">${total>0?total.toFixed(2)+' €':''}</span>
        </div>
      </div>
    </div>
    <div class="product-bottom">
      ${personBtns}
      <button class="assign-btn ${isShared?'shared active':'shared'}" onclick="assignProduct(${i},null)">Común</button>
      ${isShared?`<button class="pct-badge active" onclick="editSplit(${i})">%</button>`:''}
      <button onclick="removeProduct(${i})" class="btn-remove-product">×</button>
    </div>
  </div>`;
}

function assignProduct(i,pid){currentTicket.products[i].assignedTo=pid;currentTicket.products[i].shared=!pid;renderProductsList();}
function updateUnitPrice(i,val){const p=currentTicket.products[i];p.unitPrice=parsePrice(val);p.finalPrice=parseFloat((p.unitPrice*(p.qty||1)).toFixed(2));const el=document.getElementById('total-'+i);if(el)el.textContent=p.finalPrice>0?p.finalPrice.toFixed(2)+' €':'';}
function changeQty(i,delta){const p=currentTicket.products[i];p.qty=Math.max(1,(p.qty||1)+delta);p.finalPrice=parseFloat(((p.unitPrice??p.price??0)*(p.qty)).toFixed(2));const qEl=document.getElementById('qty-'+i);if(qEl)qEl.textContent=p.qty+'×';const tEl=document.getElementById('total-'+i);if(tEl)tEl.textContent=p.finalPrice>0?p.finalPrice.toFixed(2)+' €':'';}
function renderProductsList(){const el=document.getElementById('products-list');if(el)el.innerHTML=(currentTicket.products||[]).map((p,i)=>renderProductRow(p,i)).join('');}
function editSplit(i){const prod=currentTicket.products[i];const p1=DB.persons[0],p2=DB.persons[1]||DB.persons[0];openModal(`<div class="modal-title">Reparto de "${prod.name}"</div><div class="split-row"><div class="split-person"><div class="split-person-label">${p1.name}</div><div class="split-pct" id="sp1" style="color:${p1.color}">${prod.pct1||50}%</div></div><input type="range" class="split-slider" min="0" max="100" value="${prod.pct1||50}" oninput="updateSplitPreview(this.value)" id="split-range"/><div class="split-person"><div class="split-person-label">${p2.name}</div><div class="split-pct" id="sp2" style="color:${p2.color}">${100-(prod.pct1||50)}%</div></div></div><div class="split-presets"><button class="btn-secondary" onclick="setQuickSplit(50)">50/50</button><button class="btn-secondary" onclick="setQuickSplit(70)">70/30</button><button class="btn-secondary" onclick="setQuickSplit(30)">30/70</button></div><button class="btn-primary" onclick="saveSplit(${i})">Aplicar</button>`);}
function updateSplitPreview(v){document.getElementById('sp1').textContent=parseInt(v)+'%';document.getElementById('sp2').textContent=(100-parseInt(v))+'%';}
function setQuickSplit(v){document.getElementById('split-range').value=v;updateSplitPreview(v);}
function saveSplit(i){currentTicket.products[i].pct1=parseInt(document.getElementById('split-range').value);closeModal();renderProductsList();}
function removeProduct(i){currentTicket.products.splice(i,1);renderProductsList();}
function addEmptyProduct(){currentTicket.products.push({rawName:'',name:'',price:0,finalPrice:0,qty:1,confidence:1,category:'otro',assignedTo:null,shared:true,pct1:50});renderProductsList();setTimeout(()=>{const l=document.querySelectorAll('.product-row');if(l.length)l[l.length-1].scrollIntoView({behavior:'smooth'});},100);}
function setTicketPayer(id){currentTicket.payer=id;if(currentTicket.last4)DB.knowledge.cards[currentTicket.last4]=id;renderTicketEditor();}
function dismissErrors(){currentTicket.errors=[];currentTicket.warnings=[];renderTicketEditor();}
function toggleReleerCard(i){const card=document.getElementById('releer-card-'+i);if(!card)return;const sel=card.dataset.selected==='1';card.dataset.selected=sel?'0':'1';card.classList.toggle('selected',!sel);}
function activarReleer(){_releerMode=true;renderTicketEditor();showToast('Toca los productos correctos y pulsa Enviar',3000);}
function seleccionarTodoReleer(){const cards=document.querySelectorAll('[id^="releer-card-"]');const allSel=[...cards].every(c=>c.dataset.selected==='1');cards.forEach(card=>{card.dataset.selected=allSel?'0':'1';card.classList.toggle('selected',!allSel);});}

async function enviarReleer(){
  if(!DB.groqKey||!window._lastTicketB64){showToast('Necesitas Groq Key e imagen del ticket');return;}
  const confirmed=[];document.querySelectorAll('[id^="releer-card-"]').forEach(card=>{if(card.dataset.selected==='1'){const idx=parseInt(card.dataset.idx);const p=currentTicket.products[idx];if(p)confirmed.push(p);}});
  _releerMode=false;renderTicketEditor();showToast('Enviando a Groq...',3000);
  try{
    const cL=confirmed.length?'\n\nProductos ya confirmados (NO los cambies):\n'+confirmed.map(p=>`- ${p.name} (${p.qty}u × ${p.unitPrice.toFixed(2)}€)`).join('\n'):'';
    const res=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+DB.groqKey},body:JSON.stringify({model:'meta-llama/llama-4-scout-17b-16e-instruct',max_tokens:1500,messages:[{role:'user',content:[{type:'image_url',image_url:{url:'data:image/jpeg;base64,'+window._lastTicketB64}},{type:'text',text:'Eres un lector de tickets de supermercado. Extrae TODOS los productos con sus cantidades y precios unitarios.'+cL+'\n\nResponde SOLO con JSON sin markdown: {"store":"nombre","total":0.00,"products":[{"name":"NOMBRE","qty":1,"unitPrice":0.00}]}'}]}]})});
    const d=await res.json();if(!DB.groqStats)DB.groqStats={calls:0,firstCall:null,tokensUsed:0};DB.groqStats.calls=(DB.groqStats.calls||0)+1;DB.groqStats.tokensUsed=(DB.groqStats.tokensUsed||0)+(d.usage?.total_tokens||0);if(!DB.groqStats.firstCall)DB.groqStats.firstCall=new Date().toISOString().slice(0,10);S.set('groqStats',JSON.stringify(DB.groqStats));
    if(d.error){showToast('Error Groq: '+d.error.message,4000);return;}
    const text=(d.choices?.[0]?.message?.content||'').replace(/\`\`\`json|\`\`\`/g,'').trim();const parsed=JSON.parse(text);
    if(parsed.products&&parsed.products.length>0){const cN=new Set(confirmed.map(p=>p.name.toLowerCase()));const gP=parsed.products.filter(p=>!cN.has((p.name||'').toLowerCase())).map(p=>({name:normalizeProdName(p.name||''),rawName:p.name||'',qty:parseInt(p.qty)||1,unitPrice:parseFloat(p.unitPrice)||0,price:parseFloat(p.unitPrice)||0,finalPrice:parseFloat(((parseFloat(p.unitPrice)||0)*(parseInt(p.qty)||1)).toFixed(2)),confidence:0.9}));currentTicket.products=[...confirmed,...gP];if(parsed.store&&!currentTicket.store)currentTicket.store=parsed.store;if(parsed.total&&!currentTicket.total)currentTicket.total=parsed.total;renderTicketEditor();showToast('Groq añadió '+gP.length+' productos · '+confirmed.length+' confirmados',3500);}
    else showToast('Groq no encontró productos adicionales',3000);
  }catch(e){showToast('Error: '+e.message,4000);}
}

function saveTicket(){
  if(window._savingTicket)return;window._savingTicket=true;
  try{const t=currentTicket;if(!t){window._savingTicket=false;return;}try{document.querySelectorAll('.product-price-input').forEach((el,i)=>{if(el.value&&t.products&&t.products[i]){t.products[i].unitPrice=parsePrice(el.value);t.products[i].finalPrice=parseFloat((t.products[i].unitPrice*(t.products[i].qty||1)).toFixed(2));}});}catch(e){}t.confirmed=true;t.createdAt=t.createdAt||new Date().toISOString().slice(0,10);if(!t.total||t.total===0)t.total=(t.products||[]).reduce((s,p)=>s+parseFloat(p.finalPrice||p.price||0),0);learnFromTicket(t);const tS={...t};delete tS._imageB64;const idx=DB.tickets.findIndex(x=>x.id===t.id);if(idx>=0)DB.tickets[idx]=tS;else DB.tickets.push(tS);saveDB();}finally{window._savingTicket=false;}
  closeTicketEditor();showToast('Ticket guardado');const ts=currentScreen==='tickets'?'tickets':'home';currentScreen=ts;({home:renderHome,tickets:renderTickets,balance:renderBalance,stats:renderStats,settings:renderSettings})[ts]?.();
}
function learnFromTicket(t){if(t.last4&&t.payer){DB.knowledge.cards[t.last4]=t.payer;const person=personById(t.payer);if(person){if(!person.cards)person.cards=[];if(!person.cards.includes(t.last4))person.cards.push(t.last4);}}(t.products||[]).forEach(prod=>{const key=normalizeKey(prod.name||'');if(!key)return;const ocrRaw=(prod.rawName||'').trim().toUpperCase();const ex=DB.knowledge.products[key]||{count:0,ocr_raw:[]};DB.knowledge.products[key]={person:prod.assignedTo||null,shared:!prod.assignedTo,pct1:prod.pct1||50,count:(ex.count||0)+1,category:prod.category,alias:prod.name,ocr_raw:ocrRaw&&!(ex.ocr_raw||[]).includes(ocrRaw)?[...(ex.ocr_raw||[]),ocrRaw]:(ex.ocr_raw||[])};const ocrStripped=ocrRaw.replace(/^\d+\s+/,'');[ocrRaw,ocrStripped].filter(Boolean).forEach(raw=>{const rk=normalizeKey(raw);if(rk&&rk!==key)DB.knowledge.products[rk]={...(DB.knowledge.products[rk]||{}),person:prod.assignedTo||null,shared:!prod.assignedTo,pct1:prod.pct1||50,alias:prod.name,ocr_raw:[raw]};});});}
function closeTicketEditor(){document.getElementById('ticket-editor').style.display='none';currentTicket=null;window._lastTicketB64=null;_releerMode=false;}
function deleteCurrentTicket(){if(!currentTicket)return;window._deleteTicketId=currentTicket.id;const t=currentTicket;openModal(`<div class="modal-title">Eliminar ticket</div><p class="modal-body-text">¿Eliminar el ticket de ${t.store||'este supermercado'}?</p><div class="modal-actions"><button class="btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn-danger" onclick="confirmDeleteTicket()">Eliminar</button></div>`);}
function confirmDeleteTicket(){const id=window._deleteTicketId;if(!id){closeModal();return;}const t=DB.tickets.find(tk=>tk.id===id);if(t){DB.tickets=DB.tickets.filter(tk=>tk.id!==id);saveDB();}ImgDB.delete(id);window._deleteTicketId=null;closeModal();closeTicketEditor();showToast('Ticket eliminado');showScreen(currentScreen==='tickets'?'tickets':'home');}
function openManualTicket(){openTicketEditor(getEmptyTicket());}
function editItem(id){const t=DB.tickets.find(x=>x.id===id);if(t){openTicketEditor(t);return;}const e=DB.expenses.find(x=>x.id===id);if(e)openExpenseEditor(e);}

// ── MANUAL EXPENSE ────────────────────────────────────────────
let currentExpense=null;
const EXPENSE_CATS=[{id:'alquiler',label:'Alquiler'},{id:'suministros',label:'Luz/Agua/Gas'},{id:'internet',label:'Internet'},{id:'suscripciones',label:'Suscripciones'},{id:'restaurantes',label:'Restaurantes'},{id:'transporte',label:'Transporte'},{id:'ocio',label:'Ocio'},{id:'salud',label:'Salud'},{id:'ropa',label:'Ropa'},{id:'hogar',label:'Hogar'},{id:'mascotas',label:'Mascotas'},{id:'otro',label:'Otro'}];
function openManualExpense(){currentExpense={id:uid(),type:'expense',store:'',category:'hogar',description:'',total:0,payer:DB.persons[0].id,date:new Date().toISOString().slice(0,10),split1:50,confirmed:false,createdAt:new Date().toISOString()};renderManualExpenseSheet();document.getElementById('me-sheet').style.display='flex';}
function openExpenseEditor(exp){currentExpense=JSON.parse(JSON.stringify(exp));renderManualExpenseSheet();document.getElementById('me-sheet').style.display='flex';}
function renderManualExpenseSheet(){
  const e=currentExpense;
  const catBtns=EXPENSE_CATS.map(c=>`<button onclick="setExpenseCat('${c.id}')" class="cat-btn ${e.category===c.id?'active':''}">${c.label}</button>`).join('');
  const payerBtns=DB.persons.map(p=>`<button onclick="setExpensePayer('${p.id}')" class="payer-btn-lg ${e.payer===p.id?'active':''}" style="--payer-color:${p.color}">${p.name}</button>`).join('');
  const p1=DB.persons[0],p2=DB.persons[1]||DB.persons[0];
  document.getElementById('me-sheet').innerHTML=`
    <div class="me-header"><button onclick="closeManualExpense()" class="icon-btn"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button><h2>Gasto manual</h2>${currentExpense.confirmed?`<button onclick="deleteExpense()" class="btn-text-danger">Eliminar</button>`:'<div class="header-spacer"></div>'}</div>
    <div class="me-body">
      <div class="field-row"><label class="field-label">Importe</label><input type="number" value="${e.total||''}" placeholder="0,00" step="0.01" class="input-amount" oninput="currentExpense.total=parseFloat(this.value)||0"/></div>
      <div class="field-row"><label class="field-label">Descripción</label><input value="${e.description||''}" placeholder="Ej: Alquiler julio" oninput="currentExpense.description=this.value"/></div>
      <div class="field-row"><label class="field-label">Categoría</label><div class="cat-btns-wrap">${catBtns}</div></div>
      <div class="field-row"><label class="field-label">Fecha</label><input type="date" value="${e.date||''}" onchange="currentExpense.date=this.value"/></div>
      <div class="field-row"><label class="field-label">¿Quién pagó?</label><div class="payer-btns-lg">${payerBtns}</div></div>
      <div class="field-row"><label class="field-label">Reparto</label>
        <div class="split-row"><div class="split-person"><div class="split-person-label">${p1.name}</div><div class="split-pct" id="me-sp1" style="color:${p1.color}">${e.split1||50}%</div></div><input type="range" class="split-slider" min="0" max="100" value="${e.split1||50}" id="me-split-range" oninput="updateMeSplit(this.value)"/><div class="split-person"><div class="split-person-label">${p2.name}</div><div class="split-pct" id="me-sp2" style="color:${p2.color}">${100-(e.split1||50)}%</div></div></div>
        <div class="split-presets"><button class="btn-secondary" onclick="setMeQuickSplit(50)">50/50</button><button class="btn-secondary" onclick="setMeQuickSplit(70)">70/30</button><button class="btn-secondary" onclick="setMeQuickSplit(30)">30/70</button></div>
      </div>
    </div>
    <div class="me-footer"><button class="btn-primary" onclick="saveManualExpense()">Guardar gasto</button></div>`;
}
function setExpenseCat(c){currentExpense.category=c;renderManualExpenseSheet();}
function setExpensePayer(id){currentExpense.payer=id;renderManualExpenseSheet();}
function updateMeSplit(v){currentExpense.split1=parseInt(v);document.getElementById('me-sp1').textContent=v+'%';document.getElementById('me-sp2').textContent=(100-parseInt(v))+'%';}
function setMeQuickSplit(v){currentExpense.split1=v;document.getElementById('me-split-range').value=v;updateMeSplit(v);}
function saveManualExpense(){if(!currentExpense.total||currentExpense.total<=0){showToast('Introduce un importe');return;}currentExpense.confirmed=true;currentExpense.store=currentExpense.description||(EXPENSE_CATS.find(c=>c.id===currentExpense.category)||{}).label||'Gasto';const idx=DB.expenses.findIndex(e=>e.id===currentExpense.id);if(idx>=0)DB.expenses[idx]=currentExpense;else DB.expenses.push(currentExpense);saveDB();closeManualExpense();showToast('Gasto guardado');showScreen(currentScreen);}
function deleteExpense(){DB.expenses=DB.expenses.filter(e=>e.id!==currentExpense.id);saveDB();closeManualExpense();showToast('Gasto eliminado');showScreen(currentScreen);}
function closeManualExpense(){document.getElementById('me-sheet').style.display='none';currentExpense=null;}

// ── BALANCE ───────────────────────────────────────────────────
function renderBalance(){
  const {paid,owes,amount}=calcBalance();const creditor=owes?DB.persons.find(p=>p.id!==owes):null;const settlements=DB.settlements.slice().reverse();
  document.getElementById('view').innerHTML=`
    <div class="screen-header"><h1>Balance</h1><p>Deudas y liquidaciones</p></div>
    ${amount<0.01?`<div class="balance-card"><div class="bc-owes settled">Cuentas al día</div><div class="bc-amount bc-ok">Sin deuda</div></div>`:`<div class="balance-card"><div class="bc-owes">${personName(owes)} debe a ${creditor?.name}</div><div class="bc-amount">${fmt(amount)}</div></div><button class="settle-btn" onclick="settleAccounts()">Cuentas saldadas</button>`}
    <div class="balance-persons-grid">${DB.persons.map(p=>`<div class="stat-card stat-card-person" style="--person-color:${p.color}"><div class="stat-label">${p.name}</div><div class="stat-value">${fmt(paid[p.id]||0)}</div></div>`).join('')}</div>
    <div class="recent-label">Historial</div>
    ${settlements.length===0?`<div class="empty-state"><p>Sin liquidaciones todavía</p></div>`:settlements.map(s=>`<div class="history-settle"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg><div class="settle-date">${fmtDate(s.date)}</div><div class="settle-info">${s.msg}</div></div>`).join('')}`;
}
function settleAccounts(){const {owes,amount}=calcBalance();if(amount<0.01){showToast('No hay deuda que saldar');return;}openModal(`<div class="modal-title">¿Está todo Clarito?</div><p class="modal-body-text">Se registrará la liquidación a día de hoy.</p><div class="modal-actions"><button class="btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn-primary" onclick="confirmSettle()">Confirmar</button></div>`);}
function confirmSettle(){const btn=document.querySelector('.btn-primary[onclick="confirmSettle()"]');if(btn){btn.disabled=true;btn.style.opacity='0.5';}const {owes,amount}=calcBalance();if(amount<0.01){closeModal();return;}const creditor=DB.persons.find(p=>p.id!==owes);if(!owes||!creditor){closeModal();return;}DB.settlements.push({id:uid(),date:new Date().toISOString(),msg:`${personName(owes)} pagó ${fmt(amount)} a ${creditor.name}`,amount,owes});DB.tickets.forEach(t=>{if(t.confirmed)t.settled=true;});DB.expenses.forEach(e=>{if(e.confirmed)e.settled=true;});S.set('settledTicketIds',DB.tickets.filter(t=>t.settled).map(t=>t.id));saveDB();closeModal();showToast('Todo está Clarito',3000);currentScreen='balance';renderBalance();}

// ── STATS ─────────────────────────────────────────────────────
function renderStats(){
  const now=new Date();const thisMonth=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;const allT=DB.tickets.filter(t=>t.confirmed);const monthStart=thisMonth+'-01';const monthEnd=new Date(now.getFullYear(),now.getMonth()+1,0).toISOString().slice(0,10);const monthT=allT.filter(t=>t.date&&t.date>=monthStart&&t.date<=monthEnd);const monthTotal=monthT.reduce((s,t)=>s+(parseFloat(t.total)||0),0);
  const monthByPerson={},monthPaidOut={};DB.persons.forEach(p=>{monthByPerson[p.id]=0;monthPaidOut[p.id]=0;});
  monthT.forEach(t=>{monthPaidOut[t.payer]=(monthPaidOut[t.payer]||0)+(parseFloat(t.total)||0);(t.products||[]).forEach(prod=>{const price=parseFloat(prod.finalPrice||prod.price||0);if(!price)return;if(prod.assignedTo)monthByPerson[prod.assignedTo]=(monthByPerson[prod.assignedTo]||0)+price;else DB.persons.forEach(p=>{const pct=p.id===DB.persons[0].id?(prod.pct1||50):100-(prod.pct1||50);monthByPerson[p.id]=(monthByPerson[p.id]||0)+price*pct/100;});});});
  DB.expenses.filter(e=>e.confirmed&&e.date&&e.date>=monthStart&&e.date<=monthEnd).forEach(e=>{const amt=parseFloat(e.total||0);monthPaidOut[e.payer]=(monthPaidOut[e.payer]||0)+amt;DB.persons.forEach((p,i)=>{const pct=i===0?e.split1:100-e.split1;monthByPerson[p.id]=(monthByPerson[p.id]||0)+amt*(pct||50)/100;});});
  const catMap={};allT.forEach(t=>(t.products||[]).forEach(p=>{const c=p.category||'otro';catMap[c]=(catMap[c]||0)+parseFloat(p.finalPrice||p.price||0);}));DB.expenses.filter(e=>e.confirmed).forEach(e=>{const c=e.category||'otro';catMap[c]=(catMap[c]||0)+parseFloat(e.total||0);});
  const catSorted=Object.entries(catMap).sort((a,b)=>b[1]-a[1]).slice(0,6);const catMax=catSorted[0]?catSorted[0][1]:1;
  const storeMap={};allT.forEach(t=>{if(t.store)storeMap[t.store]=(storeMap[t.store]||0)+(parseFloat(t.total)||0);});const storeSorted=Object.entries(storeMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const prodCount={};allT.forEach(t=>(t.products||[]).forEach(p=>{const k=p.name||p.rawName||'';if(!k)return;prodCount[k]=(prodCount[k]||0)+(p.qty||1);}));const topProds=Object.entries(prodCount).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const anomalies=detectAnomalies();
  document.getElementById('view').innerHTML=`
    <div class="screen-header"><h1>Estadísticas</h1><p>Análisis del hogar</p></div>
    <div class="stats-grid"><div class="stat-card"><div class="stat-label">Este mes</div><div class="stat-value">${fmt(monthTotal)}</div></div><div class="stat-card"><div class="stat-label">Tickets totales</div><div class="stat-value">${allT.length}</div></div></div>
    <div class="recent-label">Gasto este mes por persona</div>
    <div class="persons-stats-grid">${DB.persons.map(p=>`<div class="stat-card stat-card-person" style="--person-color:${p.color}"><div class="stat-label">${p.name}</div><div class="stat-value stat-value-person">${fmt(monthByPerson[p.id]||0)}</div><div class="stat-paid-out">Pagó en caja: ${fmt(monthPaidOut[p.id]||0)}</div></div>`).join('')}</div>
    ${anomalies.length?`<div class="anomalies-list">${anomalies.map(a=>`<div class="anomaly-chip">${a}</div>`).join('')}</div>`:''}
    <div class="recent-label">Despensa estimada</div>${renderInventorySection()}
    ${storeSorted.length?`<div class="recent-label">Por supermercado</div><div class="bar-chart">${storeSorted.map(([s,a],i)=>{const cols=['var(--accent)','var(--green)','var(--blue)','var(--amber)','var(--red)'];return`<div class="bar-row"><div class="bar-name">${s}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.round(a/storeSorted[0][1]*100)}%;background:${cols[i]}"></div></div><div class="bar-amt">${fmt(a)}</div></div>`;}).join('')}</div>`:''}
    ${topProds.length?`<details class="stats-details"><summary class="stats-details-summary"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="6 9 12 15 18 9"/></svg>Más estadísticas</summary>${topProds.length?`<div class="recent-label">Productos más comprados</div><div class="bar-chart">${topProds.map(([name,qty])=>`<div class="bar-row"><div class="bar-name">${name}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.round(qty/topProds[0][1]*100)}%;background:var(--accent)"></div></div><div class="bar-amt">${qty}x</div></div>`).join('')}</div>`:''}</details>`:''}`;
  setTimeout(()=>{document.querySelectorAll('.inv-archive-btn').forEach(btn=>{btn.onclick=()=>archiveDespensa(btn.dataset.key);});},0);
}
function detectAnomalies(){const now=new Date(),msgs=[];const thisT=DB.tickets.filter(t=>t.confirmed&&t.date&&new Date(t.date).getMonth()===now.getMonth());const lastT=DB.tickets.filter(t=>t.confirmed&&t.date&&new Date(t.date).getMonth()===(now.getMonth()-1+12)%12);const tT=thisT.reduce((s,t)=>s+parseFloat(t.total||0),0);const lT=lastT.reduce((s,t)=>s+parseFloat(t.total||0),0);if(lT>0&&tT>lT*1.3)msgs.push('Este mes gastáis un '+Math.round((tT/lT-1)*100)+'% más que el mes pasado.');return msgs;}
function renderInventorySection(){
  const preds=getPredictions();
  const archived=DB.knowledge?.archivedDespensa||[];
  const bought=new Set(DB.knowledge?.boughtDespensa||[]);

  const activeSection=preds.length===0
    ?`<div class="empty-state"><p>Añade más tickets para estimar la despensa</p></div>`
    :buildInventoryRows(preds.slice(0,50), bought);

  // Sección de archivados
  let archivedSection='';
  if(archived.length>0){
    const archivedRows=archived.map(key=>{
      const name=DB.knowledge?.archivedNames?.[key]||key;
      return`<div class="inv-row inv-archived-row">
        <div class="inv-name">${name}</div>
        <div style="flex:1"></div>
        <button class="inv-restore-btn" data-key="${key}" title="Restaurar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>
          Restaurar
        </button>
      </div>`;
    }).join('');
    archivedSection=`
      <details class="inv-archived-details">
        <summary class="inv-archived-summary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          Archivados (${archived.length})
        </summary>
        <div class="inv-archived-list">${archivedRows}</div>
      </details>`;
  }

  setTimeout(()=>{
    document.querySelectorAll('.inv-archive-btn').forEach(btn=>{
      btn.onclick=()=>archiveDespensa(btn.dataset.key, btn.dataset.name);
    });
    document.querySelectorAll('.inv-restore-btn').forEach(btn=>{
      btn.onclick=()=>restoreDespensa(btn.dataset.key);
    });
  },0);

  return activeSection+archivedSection;
}

function buildInventoryRows(preds, bought){
  const byStore={};
  preds.forEach(p=>{
    const s=p.store||'Sin supermercado';
    if(!byStore[s]) byStore[s]=[];
    byStore[s].push(p);
  });
  return Object.entries(byStore).map(([storeName,items])=>`
    <div class="inv-store-label">${storeName}</div>
    ${items.map(p=>{
      const pct=Math.max(0,Math.min(100,100-Math.round((p.days/p.freq)*100)));
      const col=pct<30?'var(--red)':pct<60?'var(--amber)':'var(--green)';
      const key=normalizeKey(p.name);
      const isBought=bought.has(key);
      return`<div class="inv-row ${isBought?'inv-bought':''}">
        <input type="checkbox" class="inv-check" ${isBought?'checked':''} data-key="${key}" onchange="toggleBoughtDespensa(this.dataset.key,this.checked)"/>
        <div class="inv-name">${p.name}</div>
        <div class="inv-bar-track"><div class="inv-bar-fill" style="width:${pct}%;background:${col}"></div></div>
        <div class="inv-days">~${p.days}d</div>
        <button class="inv-archive-btn" data-key="${key}" data-name="${p.name.replace(/"/g,'&quot;')}" title="Ocultar de la lista">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
        </button>
      </div>`;
    }).join('')}
  `).join('');
}
function toggleBoughtDespensa(key,checked){
  if(!DB.knowledge) DB.knowledge={products:{},cards:{}};
  if(!DB.knowledge.boughtDespensa) DB.knowledge.boughtDespensa=[];
  if(checked){if(!DB.knowledge.boughtDespensa.includes(key))DB.knowledge.boughtDespensa.push(key);}
  else{DB.knowledge.boughtDespensa=DB.knowledge.boughtDespensa.filter(k=>k!==key);}
  saveDB();
  const row=document.querySelector(`.inv-check[data-key="${key}"]`)?.closest('.inv-row');
  if(row) row.classList.toggle('inv-bought',checked);
  if(checked) showUndoToast('Marcado como comprado',()=>toggleBoughtDespensa(key,false));
}
function showUndoToast(msg,undoFn,dur=4000){
  document.querySelector('.toast')?.remove();
  const t=document.createElement('div');
  t.className='toast toast-undo';
  t.innerHTML=`<span>${msg}</span><button class="toast-undo-btn">Deshacer</button>`;
  document.body.appendChild(t);
  const timer=setTimeout(()=>t.remove(),dur);
  t.querySelector('.toast-undo-btn').onclick=()=>{clearTimeout(timer);t.remove();undoFn();};
}
function archiveDespensa(key,name){
  if(!DB.knowledge) DB.knowledge={products:{},cards:{}};
  if(!DB.knowledge.archivedDespensa) DB.knowledge.archivedDespensa=[];
  if(!DB.knowledge.archivedNames) DB.knowledge.archivedNames={};
  if(!DB.knowledge.archivedDespensa.includes(key)){
    DB.knowledge.archivedDespensa.push(key);
    if(name) DB.knowledge.archivedNames[key]=name;
  }
  saveDB();renderStats();
}
function restoreDespensa(key){
  if(!DB.knowledge?.archivedDespensa) return;
  DB.knowledge.archivedDespensa=DB.knowledge.archivedDespensa.filter(k=>k!==key);
  if(DB.knowledge.archivedNames) delete DB.knowledge.archivedNames[key];
  saveDB();renderStats();
}
function getPredictions(){
  const cT=DB.tickets.filter(t=>t.confirmed&&t.date);
  const archived=new Set(DB.knowledge?.archivedDespensa||[]);
  if(cT.length===0&&DB.knowledge?.cachedDespensa?.length){
    const now=Date.now();
    return DB.knowledge.cachedDespensa
      .filter(p=>!archived.has(normalizeKey(p.name)))
      .map(p=>{const lMs=p.lastDate?new Date(p.lastDate).getTime():now;const dS=(now-lMs)/864e5;const dL=Math.max(0,Math.round(p.freq-dS));return{name:p.name,days:dL,freq:p.freq,detail:'Cada ~'+p.freq+'d · hace '+Math.round(dS)+'d'};})
      .sort((a,b)=>a.days-b.days);
  }
  const ph={};
  cT.forEach(t=>{const d=new Date(t.date).getTime();(t.products||[]).forEach(p=>{const k=normalizeKey(p.name||'');if(!k||archived.has(k))return;if(!ph[k])ph[k]={name:p.name,dates:[],store:t.store||''};ph[k].dates.push(d);if(t.store&&!ph[k].store)ph[k].store=t.store;});});;
  const now=Date.now();
  return Object.values(ph)
    .filter(v=>v.dates.length>=2)
    .map(item=>{
      item.dates.sort((a,b)=>a-b);
      // Dedup same-day entries (mismo producto en ticket del mismo día)
      const uniq=[...new Set(item.dates.map(d=>Math.floor(d/864e5)))].map(d=>d*864e5);
      if(uniq.length<2) return null;
      const gaps=[];for(let i=1;i<uniq.length;i++)gaps.push((uniq[i]-uniq[i-1])/864e5);
      const avgFreq=Math.max(7,gaps.reduce((s,g)=>s+g,0)/gaps.length);
      const daysSince=(now-uniq[uniq.length-1])/864e5;
      const daysLeft=Math.max(0,Math.round(avgFreq-daysSince));
      return{name:item.name,days:daysLeft,freq:Math.round(avgFreq),store:item.store||'',detail:'Cada ~'+Math.round(avgFreq)+'d · hace '+Math.round(daysSince)+'d'};
    })
    .filter(Boolean)
    .sort((a,b)=>a.days-b.days);
}

// ── SETTINGS ──────────────────────────────────────────────────
function renderSettings(){
  document.getElementById('view').innerHTML=`
    <div class="screen-header"><div class="header-brand"><img src="icon.png" class="header-logo" onclick="onLogoTap()" onerror="this.style.display='none'"/><h1>Configuración</h1></div></div>
    <div class="settings-section"><div class="settings-section-title">Personas (${DB.persons.length})</div>
      <div class="settings-group">
        ${DB.persons.map((p,i)=>`<div class="settings-row" onclick="editPerson(${i})"><div class="settings-icon" style="background:${p.color}"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg></div><div class="settings-label">${p.name}</div><div class="settings-value">${p.cards.length} tarjeta(s)</div><div class="settings-arrow">›</div></div>`).join('')}
        <div class="settings-row" onclick="addPerson()"><div class="settings-icon settings-icon-add"><svg viewBox="0 0 24 24" fill="none" stroke="var(--txt1)" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></div><div class="settings-label settings-label-accent">Añadir persona</div></div>
      </div>
    </div>
    ${DB.devMode?renderDevSettings():''}
    <p class="settings-footer">Clarito · Datos guardados localmente</p>`;
}
function renderDevSettings(){return`
  <div class="settings-section"><div class="settings-section-title">APIs</div><div class="settings-group">
    <div class="settings-row" onclick="editVisionKey()"><div class="settings-icon settings-icon-vision"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 8h3M7 12h3M7 16h3M14 8h3M14 12h3M14 16h3"/></svg></div><div class="settings-label">Google Vision Key</div><div class="settings-value">${DB.visionKey?'•••'+DB.visionKey.slice(-4):'No configurada'}</div><div class="settings-arrow">›</div></div>
    ${DB.visionKey?`<div class="settings-row" onclick="showVisionStats()"><div class="settings-icon settings-icon-vision-stats"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/></svg></div><div class="settings-label">Uso de Vision</div><div class="settings-value">${DB.visionStats?.calls||0} lecturas</div><div class="settings-arrow">›</div></div>`:''}
    <div class="settings-row" onclick="editGroqKey()"><div class="settings-icon settings-icon-groq"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div><div class="settings-label">Groq Key (chat IA)</div><div class="settings-value">${DB.groqKey?'•••'+DB.groqKey.slice(-4):'No configurada'}</div><div class="settings-arrow">›</div></div>
    ${DB.groqKey?`<div class="settings-row" onclick="showGroqStats()"><div class="settings-icon settings-icon-groq-stats"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div><div class="settings-label">Uso de Groq</div><div class="settings-value">${DB.groqStats?.calls||0} llamadas · ${Math.round((DB.groqStats?.tokensUsed||0)/1000)}k tokens</div><div class="settings-arrow">›</div></div>`:''}
  </div></div>
  <div class="settings-section"><div class="settings-section-title">Tarjetas conocidas</div><div class="settings-group">
    ${Object.keys(DB.knowledge.cards).length===0?`<div class="settings-row"><div class="settings-label settings-label-empty">Sin tarjetas registradas</div></div>`:Object.entries(DB.knowledge.cards).map(([l4,pid])=>`<div class="settings-row"><div class="settings-icon settings-icon-card"><svg viewBox="0 0 24 24" fill="none"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></div><div class="settings-label">•••• ${l4}</div><div class="settings-value" style="color:${personColor(pid)};font-weight:600">${personName(pid)}</div><button onclick="forgetCard('${l4}')" class="btn-remove-inline">×</button></div>`).join('')}
  </div></div>
  <div class="settings-section"><div class="settings-section-title">Datos</div><div class="settings-group">
    <div class="settings-row" onclick="editKnowledgeProducts()"><div class="settings-label">Productos aprendidos</div><div class="settings-value">${Object.keys(DB.knowledge.products).length}</div><div class="settings-arrow">›</div></div>
    <div class="settings-row" onclick="clearKnowledge()"><div class="settings-label settings-label-danger">Borrar conocimiento IA</div></div>
    <div class="settings-row" onclick="exportData()"><div class="settings-label">Exportar JSON</div><div class="settings-arrow">↓</div></div>
    <div class="settings-row" onclick="resetAll()"><div class="settings-label settings-label-danger">Borrar todos los datos</div></div>
  </div></div>
  <div class="settings-section"><div class="settings-section-title">Estadísticas</div><div class="settings-group">
    <div class="settings-row" onclick="resetStatsConfirm()"><div class="settings-icon settings-icon-reset"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg></div><div class="settings-label">Nuevo mes / Resetear stats</div><div class="settings-arrow">›</div></div>
  </div></div>
  <div class="settings-action-row"><button class="btn-secondary btn-full" onclick="DB.aiConvMessages=[];saveDB();location.reload()">Actualizar app</button></div>
  <div class="settings-action-row"><button class="btn-secondary btn-full btn-muted" onclick="DB.devMode=false;S.set('devMode',false);saveDB();renderSettings();showToast('Modo desarrollador desactivado')">Ocultar opciones de desarrollador</button></div>`;}

function editKnowledgeProducts(){
  // Deduplicar: quedarse con una entrada por alias (la más completa)
  const byAlias={};
  for(const [key,v] of Object.entries(DB.knowledge.products)){
    const alias=(v.alias||key).toLowerCase().trim();
    if(!byAlias[alias]||( v.count||0)>(byAlias[alias].count||0))
      byAlias[alias]={key,v};
  }
  const prods=Object.values(byAlias).sort((a,b)=>(a.v.alias||a.key).localeCompare(b.v.alias||b.key,'es'));
  if(!prods.length){showToast('No hay productos aprendidos todavía');return;}
  const rows=prods.map(({key,v})=>`<div class="knowledge-row"><div class="knowledge-raw">${v.ocr_raw?.[0]||key}</div><div class="knowledge-edit-row"><input value="${v.alias||key}" class="knowledge-name-input" onchange="renameKnowledgeProduct('${key}',this.value)"/><button onclick="deleteKnowledgeProduct('${key}')" class="btn-remove-inline">×</button></div><select onchange="assignKnowledgeProduct('${key}',this.value)" class="knowledge-select"><option value="" ${!v.person?'selected':''}>Común</option>${DB.persons.map(p=>`<option value="${p.id}" ${v.person===p.id?'selected':''}>${p.name}</option>`).join('')}</select></div>`).join('');
  openModal(`<div class="modal-title">Productos aprendidos</div><p class="modal-hint">Edita el nombre, asigna a persona o elimina.</p><div class="knowledge-list">${rows}</div><div class="modal-actions"><button class="btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn-primary" onclick="saveDB();closeModal();showToast('Guardado');renderSettings()">Guardar</button></div>`);
}
function assignKnowledgeProduct(key,pid){if(!DB.knowledge.products[key])return;DB.knowledge.products[key].person=pid||null;DB.knowledge.products[key].shared=!pid;}
function renameKnowledgeProduct(key,newName){if(!newName.trim())return;const entry=DB.knowledge.products[key];if(!entry)return;const trimmed=newName.trim();entry.alias=trimmed;const newKey=normalizeKey(trimmed);if(newKey&&newKey!==key)DB.knowledge.products[newKey]={...entry,alias:trimmed};}
function deleteKnowledgeProduct(key){delete DB.knowledge.products[key];saveDB();editKnowledgeProducts();}
function showVisionStats(){const v=DB.visionStats||{};const calls=v.calls||0;const since=v.firstCall?'desde '+v.firstCall:'';const free=1000;const over=Math.max(0,calls-free);const cost=(over/1000*1.50);const freeLeft=Math.max(0,free-calls);const lastOCR=S.get('lastOCR')||'';openModal(`<div class="modal-title">Uso de Vision IA</div><div class="stats-modal-grid"><div class="stats-modal-card"><div class="stats-modal-label">Lecturas totales ${since}</div><div class="stats-modal-value">${calls}</div></div><div class="stats-modal-card stats-modal-card-row"><div><div class="stats-modal-label">Restantes est.</div><div class="stats-modal-value ${freeLeft>0?'value-green':'value-amber'}">${freeLeft}</div></div><div><div class="stats-modal-label">Gasto est.</div><div class="stats-modal-value ${cost>0?'value-amber':''}">${cost.toFixed(2)}</div></div></div><div class="stats-modal-card"><div class="stats-modal-hint">1.000 lecturas mensuales incluidas · Se renueva cada mes</div></div>${lastOCR?`<div class="stats-modal-card"><div class="stats-modal-ocr-header"><span class="stats-modal-label">Último OCR</span><button onclick="copyLastOCR()" class="btn-copy">Copiar</button></div><pre class="stats-modal-ocr">${lastOCR.replace(/</g,'&lt;')}</pre></div>`:''}</div><div class="modal-actions"><button class="btn-primary" onclick="closeModal()">Cerrar</button></div>`);}
function showGroqStats(){const s=DB.groqStats||{};const calls=s.calls||0;const tokens=s.tokensUsed||0;const since=s.firstCall?'desde '+s.firstCall:'';openModal(`<div class="modal-title">Uso de Groq IA</div><div class="stats-modal-grid"><div class="stats-modal-card"><div class="stats-modal-label">Llamadas totales ${since}</div><div class="stats-modal-value">${calls}</div></div><div class="stats-modal-card"><div class="stats-modal-label">Tokens usados</div><div class="stats-modal-value">${(tokens/1000).toFixed(1)}k</div></div><div class="stats-modal-card"><div class="stats-modal-hint">Plan gratuito · Sin límite mensual · Rate limit: 30 req/min</div></div></div><div class="modal-actions"><button class="btn-primary" onclick="closeModal()">Cerrar</button></div>`);}
function copyLastOCR(){const text=localStorage.getItem('clarito_lastOCR');const raw=text?JSON.parse(text):'';if(!raw){showToast('Sin OCR guardado todavía');return;}navigator.clipboard.writeText(raw).then(()=>showToast('OCR copiado ✓')).catch(()=>showToast('Error al copiar'));}
function addPerson(){const idx=DB.persons.length;DB.persons.push({id:'p'+(idx+1),name:'Persona '+(idx+1),color:PRESET_COLORS[idx%PRESET_COLORS.length],cards:[]});saveDB();renderSettings();editPerson(idx);}
function editPerson(idx){const p=DB.persons[idx];openModal(`<div class="modal-title">Editar ${p.name}</div><div class="field-row"><label class="field-label">Nombre</label><input id="ep-name" value="${p.name}"/></div><div class="field-row"><label class="field-label">Color</label><div class="color-picker-row" id="ep-colors">${PRESET_COLORS.map(c=>`<div class="color-swatch ${p.color===c?'selected':''}" style="background:${c}" onclick="pickPersonColor(${idx},'${c}',this)"></div>`).join('')}</div></div><div class="field-row"><label class="field-label">Tarjetas (últimos 4 dígitos)</label><div id="ep-cards">${(p.cards||[]).map((c,ci)=>`<div class="card-row"><div class="card-row-num">•••• ${c}</div><button onclick="removeCard(${idx},${ci})" class="btn-remove-inline">×</button></div>`).join('')}</div><div class="card-add-row"><input id="ep-card" placeholder="4821" maxlength="4" class="input-card"/><button class="btn-secondary" onclick="addCard(${idx})">Añadir</button></div></div>${DB.persons.length>1?`<button class="btn-danger" onclick="removePerson(${idx})">Eliminar persona</button>`:''}<div class="modal-actions"><button class="btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn-primary" onclick="savePerson(${idx})">Guardar</button></div>`);}
function pickPersonColor(idx,color,el){DB.persons[idx].color=color;document.querySelectorAll('#ep-colors .color-swatch').forEach(s=>s.classList.remove('selected'));el.classList.add('selected');}
function addCard(idx){const v=document.getElementById('ep-card').value.trim();if(v.length!==4||isNaN(v)){showToast('Introduce 4 dígitos');return;}if(!DB.persons[idx].cards)DB.persons[idx].cards=[];DB.persons[idx].cards.push(v);DB.knowledge.cards[v]=DB.persons[idx].id;editPerson(idx);}
function removeCard(idx,ci){const c=DB.persons[idx].cards[ci];DB.persons[idx].cards.splice(ci,1);delete DB.knowledge.cards[c];editPerson(idx);}
function removePerson(idx){if(DB.persons.length<=1){showToast('Debe haber al menos una persona');return;}DB.persons.splice(idx,1);saveDB();closeModal();renderSettings();}
function savePerson(idx){const n=document.getElementById('ep-name').value.trim();if(n)DB.persons[idx].name=n;saveDB();closeModal();renderSettings();}
function forgetCard(l4){delete DB.knowledge.cards[l4];DB.persons.forEach(p=>{if(p.cards)p.cards=p.cards.filter(c=>c!==l4);});saveDB();renderSettings();}
let _devTaps=0,_devTimer=null;
function onLogoTap(){_devTaps++;clearTimeout(_devTimer);if(_devTaps>=13){_devTaps=0;DB.devMode=!DB.devMode;S.set('devMode',DB.devMode);saveDB();renderSettings();showToast(DB.devMode?'Modo desarrollador activado':'Modo desarrollador desactivado',2000);}else{_devTimer=setTimeout(()=>{_devTaps=0;},1200);}}
function clearKnowledge(){openModal(`<div class="modal-title">¿Borrar conocimiento?</div><p class="modal-body-text">Se eliminan los productos aprendidos. Los tickets se conservan.</p><div class="modal-actions"><button class="btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn-danger" onclick="DB.knowledge.products={};saveDB();closeModal();renderSettings();showToast('Borrado')">Borrar</button></div>`);}
function editVisionKey(){openModal(`<div class="modal-title">Google Cloud Vision Key</div><p class="modal-hint">Obtén tu key en <strong class="text-accent">console.cloud.google.com</strong> → APIs → Credenciales</p><input type="password" id="new-visionkey" value="${DB.visionKey||''}" placeholder="AIzaSy..."/><div class="modal-actions"><button class="btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn-primary" onclick="const k=document.getElementById('new-visionkey').value.trim();if(!k)return;DB.visionKey=k;S.set('visionKey',k);saveDB();closeModal();showToast('Guardada');renderSettings()">Guardar</button></div>`);}
function editGroqKey(){openModal(`<div class="modal-title">Groq API Key</div><p class="modal-hint">Key gratuita en <strong class="text-accent">console.groq.com</strong> → API Keys</p><input type="password" id="new-groqkey" value="${DB.groqKey||''}" placeholder="gsk_..."/><div class="modal-actions"><button class="btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn-primary" onclick="const k=document.getElementById('new-groqkey').value.trim();if(!k)return;DB.groqKey=k;S.set('groqKey',k);saveDB();closeModal();showToast('Guardada');renderSettings()">Guardar</button></div>`);}
function exportData(){const b=new Blob([JSON.stringify(DB,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='clarito-'+new Date().toISOString().slice(0,10)+'.json';a.click();}
function resetStatsConfirm(){openModal(`<div class="modal-title">Nuevo mes</div><p class="modal-body-text">Se eliminarán todos los tickets y gastos actuales.</p><label class="modal-checkbox-row"><input type="checkbox" id="keep-despensa" checked> Mantener datos de despensa estimada</label><div class="modal-actions"><button class="btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn-danger" onclick="doResetStats()">Empezar mes nuevo</button></div>`);}
function doResetStats(){const keepDespensa=document.getElementById('keep-despensa')?.checked!==false;if(keepDespensa){const preds=getPredictions();if(!DB.knowledge)DB.knowledge={products:{},cards:{},cachedDespensa:[]};DB.knowledge.cachedDespensa=preds.map(p=>({name:p.name,freq:p.freq,lastDate:new Date().toISOString().slice(0,10)}));}else{if(DB.knowledge)DB.knowledge.cachedDespensa=[];}DB.tickets=[];DB.expenses=[];DB.settlements=[];saveDB();closeModal();showToast('Mes nuevo iniciado');({home:renderHome,tickets:renderTickets,balance:renderBalance,stats:renderStats,settings:renderSettings})[currentScreen]?.();}
function resetAll(){openModal(`<div class="modal-title">¿Borrar todo?</div><p class="modal-body-text">No se puede deshacer.</p><div class="modal-actions"><button class="btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn-danger" onclick="localStorage.clear();location.reload()">Borrar todo</button></div>`);}

// ── AI CHAT ───────────────────────────────────────────────────
function openAIChat(){renderAIChat();document.getElementById('ai-chat-sheet').style.display='flex';}
function closeAIChat(){document.getElementById('ai-chat-sheet').style.display='none';updateAIBadge();}
function renderAIChat(){const pending=DB.aiQuestions.filter(q=>!q.answered);document.getElementById('ai-chat-sheet').innerHTML=`<div class="ai-header"><button onclick="closeAIChat()" class="icon-btn"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button><h2>Asistente IA</h2>${pending.length?`<span class="badge badge-red">${pending.length}</span>`:''}</div><div class="ai-messages" id="ai-messages">${pending.length?`<div class="ai-msg bot">Tengo ${pending.length} pregunta${pending.length>1?'s':''} pendientes:</div>${pending.slice(0,5).map(renderAIQuestion).join('')}`:`<div class="ai-msg bot">¡Hola! Soy tu asistente Clarito. Pregúntame sobre gastos, balances o predicciones.</div>`}${DB.aiConvMessages.slice(-10).map(m=>`<div class="ai-msg ${m.role}">${m.content}</div>`).join('')}</div><div class="ai-input-row"><input id="ai-input" placeholder="Pregunta algo..." onkeydown="if(event.key==='Enter')sendAIMessage()"/><button class="ai-send" onclick="sendAIMessage()"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button></div>`;}
function renderAIQuestion(q){return`<div class="ai-qa" id="qa-${q.id}"><div class="ai-qa-q">${q.question}</div><div class="ai-qa-btns">${(q.options||['Sí','No']).map(opt=>`<button class="ai-qa-btn" onclick="answerAIQuestion('${q.id}','${opt}')">${opt}</button>`).join('')}<button class="ai-qa-btn ai-qa-skip" onclick="answerAIQuestion('${q.id}','skip')">Saltar</button></div></div>`;}
function answerAIQuestion(qid,answer){const q=DB.aiQuestions.find(x=>x.id===qid);if(!q)return;q.answered=true;q.answer=answer;if(q.type==='product_assign'&&answer!=='skip'){const key=normalizeKey(q.productName||'');if(key){const pid=DB.persons.find(p=>p.name===answer)?.id||null;DB.knowledge.products[key]={...(DB.knowledge.products[key]||{}),person:pid,shared:!pid,pct1:50};}}else if(q.type==='card_assign'&&answer!=='skip'){const pid=DB.persons.find(p=>p.name===answer)?.id;if(pid)DB.knowledge.cards[q.last4]=pid;}saveDB();updateAIBadge();const el=document.getElementById('qa-'+qid);if(el){el.style.opacity='.4';el.querySelector('.ai-qa-btns').innerHTML='<span class="qa-answered">Respondido</span>';}}
async function sendAIMessage(){if(window._aiSending)return;const input=document.getElementById('ai-input');const msg=input.value.trim();if(!msg)return;input.value='';window._aiSending=true;DB.aiConvMessages.push({role:'user',content:msg});renderAIChat();
if(/secreto/i.test(msg)){setTimeout(()=>{DB.aiConvMessages.push({role:'bot',content:'🤫 Psst… esta app fue creada con mucho amor de Carli para Dami ♥️'});saveDB();renderAIChat();const msgs=document.getElementById('ai-messages');if(msgs)msgs.scrollTop=msgs.scrollHeight;},600);window._aiSending=false;return;}
const {paid,owes,amount}=calcBalance();const now=new Date();const thisMonth=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;const monthByPerson={};DB.persons.forEach(p=>monthByPerson[p.id]=0);DB.tickets.filter(t=>t.confirmed&&t.date&&t.date.startsWith(thisMonth)).forEach(t=>{(t.products||[]).forEach(prod=>{const price=parseFloat(prod.finalPrice||prod.price||0);if(prod.assignedTo)monthByPerson[prod.assignedTo]=(monthByPerson[prod.assignedTo]||0)+price;else DB.persons.forEach(p=>{const pct=p.id===DB.persons[0].id?(prod.pct1||50):100-(prod.pct1||50);monthByPerson[p.id]=(monthByPerson[p.id]||0)+price*pct/100;});});});
const recentTickets=DB.tickets.filter(t=>t.confirmed).slice(-5).map(t=>`${t.store||'?'} ${t.date} ${fmt(t.total)} (pagó ${personName(t.payer)})`).join('; ');
const ctx=`Eres el asistente de Clarito, app de gastos compartidos del hogar. Responde SIEMPRE con datos concretos.\nDATOS:\n- Personas: ${DB.persons.map(p=>p.name).join(', ')}\n- Balance: ${amount>0.01?personName(owes)+' debe '+fmt(amount):'cuentas al día'}\n- Pagado total: ${DB.persons.map(p=>p.name+' '+fmt(paid[p.id]||0)).join(', ')}\n- Gasto este mes: ${DB.persons.map(p=>p.name+' '+fmt(monthByPerson[p.id]||0)).join(', ')}\n- Tickets: ${DB.tickets.filter(t=>t.confirmed).length}\n- Últimos: ${recentTickets||'ninguno'}\nResponde en español, breve y directo. Pregunta: ${msg}`;
try{const resp=await callGroq(ctx);DB.aiConvMessages.push({role:'bot',content:resp});saveDB();renderAIChat();const msgs=document.getElementById('ai-messages');if(msgs)msgs.scrollTop=msgs.scrollHeight;}
catch(err){const isQ=err.message?.includes('429')||err.message?.includes('quota')||err.message?.includes('rate_limit');DB.aiConvMessages.push({role:'bot',content:isQ?'Se ha excedido la cuota de Groq. Espera un momento.':'Error: '+err.message});renderAIChat();}
finally{window._aiSending=false;const msgs=document.getElementById('ai-messages');if(msgs)msgs.scrollTop=msgs.scrollHeight;}}
function updateAIBadge(){const n=(DB.aiQuestions||[]).filter(q=>!q.answered).length;const b=document.getElementById('ai-badge');if(b){b.style.display=n>0?'flex':'none';b.textContent=n;}}

// ── INDEXEDDB — almacén de imágenes de tickets ────────────────
const ImgDB = {
  _db: null,
  async open(){
    if(this._db) return this._db;
    return new Promise((res,rej)=>{
      const req=indexedDB.open('clarito_imgs',1);
      req.onupgradeneeded=e=>{e.target.result.createObjectStore('images');};
      req.onsuccess=e=>{this._db=e.target.result;res(this._db);};
      req.onerror=()=>rej(req.error);
    });
  },
  async save(ticketId, b64){
    try{const db=await this.open();const tx=db.transaction('images','readwrite');tx.objectStore('images').put(b64,ticketId);}catch(e){console.warn('ImgDB save error:',e);}
  },
  async get(ticketId){
    try{const db=await this.open();return new Promise((res,rej)=>{const req=db.transaction('images').objectStore('images').get(ticketId);req.onsuccess=()=>res(req.result||null);req.onerror=()=>res(null);});}catch{return null;}
  },
  async delete(ticketId){
    try{const db=await this.open();const tx=db.transaction('images','readwrite');tx.objectStore('images').delete(ticketId);}catch(e){}
  }
};

// ── SHARE TARGET — recibir imagen compartida desde galería ────
async function handleShareTarget(){
  if(location.search.includes('share-target')||new URLSearchParams(location.search).has('share-target')) return;
  // Share Target POST: el service worker reenvía el archivo
  // Sin SW, intentamos leer desde sessionStorage (ver sw approach abajo)
  // En iOS la única forma fiable es via SW — registramos uno mínimo
  if('serviceWorker' in navigator){
    navigator.serviceWorker.addEventListener('message', e=>{
      if(e.data?.type==='share-target-file'&&e.data.b64){
        const file=b64ToFile(e.data.b64, e.data.name||'ticket.jpg');
        processFile(file);
      }
    });
  }
}

function b64ToFile(b64, name){
  const arr=b64.split(','); const mime=arr[0].match(/:(.*?);/)[1];
  const bstr=atob(arr[1]); let n=bstr.length; const u8=new Uint8Array(n);
  while(n--) u8[n]=bstr.charCodeAt(n);
  return new File([u8],name,{type:mime});
}

function showTicketImage(){
  const b64=window._lastTicketB64;if(!b64)return;
  openModal(`<div style="text-align:center"><img src="data:image/jpeg;base64,${b64}" style="max-width:100%;max-height:70vh;border-radius:var(--rad-sm);object-fit:contain"/></div><div class="modal-actions"><button class="btn-primary" onclick="closeModal()">Cerrar</button></div>`);
}

// ── BOOT ──────────────────────────────────────────────────────
loadDB();
DB.aiConvMessages=[];
expireOldTickets();
handleShareTarget();
positionHalo();
setTimeout(()=>{
  hideSplash();
  setTimeout(()=>{
    if(!DB.visionKey){startSetup();}
    else{document.getElementById('app').style.display='flex';showScreen('home');updateAIBadge();}
  },100);
},6000);

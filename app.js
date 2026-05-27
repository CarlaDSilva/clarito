// ═══════════════════════════════════════════════════════════════
//  CLARITO — app.js
// ═══════════════════════════════════════════════════════════════

// ── STORAGE ────────────────────────────────────────────────────
const S = {
  get(k){try{const v=localStorage.getItem('clarito_'+k);return v?JSON.parse(v):null}catch{return null}},
  set(k,v){localStorage.setItem('clarito_'+k,JSON.stringify(v))}
};

const PRESET_COLORS = [
  '#ea580c', // naranja oscuro
  '#c2410c', // naranja más oscuro
  '#a855f7', // morado
  '#ec4899', // rosa
  '#f9a8d4', // rosa clarito
  '#38bdf8', // celeste
  '#22c55e', // verde
  '#ef4444', // rojo
  '#3b82f6', // azul
  '#eab308', // amarillo
  '#14b8a6', // turquesa
  '#e879b0', // rosa bebé
  '#fce7f3', // rosa muy clarito
];

let DB = {
  apiKey:'',
  ocrKey:'helloworld',
  visionKey:'',
  groqKey:'',
  groqStats:{calls:0,firstCall:null,tokensUsed:0},
  visionStats:{calls:0,firstCall:null},
  persons:[
    {id:'p1',name:'Persona 1',color:'#7c6ef5',cards:[]},
    {id:'p2',name:'Persona 2',color:'#3ecf8e',cards:[]}
  ],
  tickets:[],expenses:[],settlements:[],
  knowledge:{products:{},cards:{}},
  aiQuestions:[],aiConvMessages:[]
};

function loadDB(){
  const saved=S.get('db');
  if(saved) DB=Object.assign({},DB,saved);
  DB.ocrKey=S.get('ocrKey')||DB.ocrKey||'helloworld';
  DB.visionKey=S.get('visionKey')||DB.visionKey||'';
  DB.groqKey=S.get('groqKey')||DB.groqKey||'';
  try{const gs=S.get('groqStats');if(gs)DB.groqStats=JSON.parse(gs);}catch{}
  try{const vs=S.get('visionStats');if(vs)DB.visionStats=JSON.parse(vs);}catch{}
  if(!DB.knowledge) DB.knowledge={products:{},cards:{}};
  if(!DB.aiQuestions) DB.aiQuestions=[];
  if(!DB.aiConvMessages) DB.aiConvMessages=[];
  DB.persons.forEach(p=>{if(!p.cards)p.cards=[];});
}
function saveDB(){S.set('db',DB);}

// ── HELPERS ────────────────────────────────────────────────────
const fmt=n=>isNaN(n)||n==null?'0,00 €':Number(n).toFixed(2).replace('.',',')+' €';
const fmtDate=d=>{if(!d)return '';const dt=new Date(d);return isNaN(dt)?d:dt.toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric'});};
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2);
const personById=id=>DB.persons.find(p=>p.id===id);
const personColor=id=>personById(id)?.color||'#888';
const personName=id=>personById(id)?.name||'?';
const normalizeKey=n=>n.toLowerCase().replace(/[^a-záéíóúñ0-9]/g,' ').replace(/\s+/g,' ').trim();

function showToast(msg,dur=2500){
  document.querySelector('.toast')?.remove();
  const t=document.createElement('div');
  t.className='toast';t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(),dur);
}
function openModal(html){document.getElementById('modal-content').innerHTML=html;document.getElementById('modal-overlay').style.display='flex';}
function closeModal(){document.getElementById('modal-overlay').style.display='none';}
function showOCRLoading(msg){document.getElementById('ocr-loading').style.display='flex';document.getElementById('ocr-status').textContent=msg;}
function setOCRStatus(msg){document.getElementById('ocr-status').textContent=msg;}
function hideOCRLoading(){document.getElementById('ocr-loading').style.display='none';}

// ── SPLASH ─────────────────────────────────────────────────────
function hideSplash(){
  const s=document.getElementById('splash');
  s.classList.add('hidden');
  setTimeout(()=>s.style.display='none',450);
}

// ── NAVIGATION ─────────────────────────────────────────────────
let currentScreen='home';
function showScreen(name){
  currentScreen=name;
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('nav-'+name)?.classList.add('active');
  document.getElementById('view').scrollTop=0;
  ({home:renderHome,tickets:renderTickets,balance:renderBalance,stats:renderStats,settings:renderSettings})[name]?.();
  updateAIBadge();
}

// ── SETUP WIZARD ───────────────────────────────────────────────
let setupStep=0, setupPersonCount=2;

function startSetup(){
  document.getElementById('setup-screen').style.display='flex';
  setupStep=0;
  renderSetupStep();
}

function renderSetupStep(){
  const el=document.getElementById('setup-content');
  const steps=4;
  const dots=Array.from({length:steps},(_,i)=>`<div class="setup-dot ${i===setupStep?'active':i<setupStep?'done':''}"></div>`).join('');
  let html=`<div class="setup-progress">${dots}</div>`;

  if(setupStep===0){
    html+=`
      <h2>Bienvenido a Clarito</h2>
      <p>Necesitas dos claves gratuitas para que Clarito funcione.</p>
      <div class="field-row">
        <label class="field-label">Google Cloud Vision Key <span style="color:var(--txt3)">(leer tickets)</span></label>
        <input type="password" id="s-visionkey" placeholder="AIzaSy..." value="${DB.visionKey||''}"/>
      </div>
      <p style="font-size:12px;color:var(--txt2);margin-bottom:12px">console.cloud.google.com → APIs → Credenciales</p>
      <div class="field-row">
        <label class="field-label">Groq Key <span style="color:var(--txt3)">(asistente IA)</span></label>
        <input type="password" id="s-groqkey" placeholder="gsk_..." value="${DB.groqKey||''}"/>
      </div>
      <p style="font-size:12px;color:var(--txt2);margin-bottom:20px">console.groq.com → API Keys (gratis)</p>
      <button class="btn-primary" onclick="setupNext0()">Continuar →</button>`;
  } else if(setupStep===1){
    html+=`
      <h2>¿Cuántas personas?</h2>
      <p>¿Cuántas personas comparten gastos en este hogar?</p>
      <div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap">
        ${[2,3,4,5].map(n=>`<button onclick="setupPersonCount=${n};document.querySelectorAll('.pc-btn').forEach(b=>{b.style.background='var(--bg3)';b.style.color='var(--txt1)';b.style.borderColor='var(--brd)'});this.style.background='rgba(124,110,245,.2)';this.style.color='var(--accent)';this.style.borderColor='var(--accent)'" class="btn-secondary pc-btn" style="${setupPersonCount===n?'background:rgba(124,110,245,.2);color:var(--accent);border-color:var(--accent)':''}">${n} personas</button>`).join('')}
      </div>
      <button class="btn-primary" onclick="setupNext1()">Continuar →</button>`;
  } else if(setupStep===2){
    while(DB.persons.length<setupPersonCount) DB.persons.push({id:'p'+(DB.persons.length+1),name:'Persona '+(DB.persons.length+1),color:PRESET_COLORS[DB.persons.length%PRESET_COLORS.length],cards:[]});
    DB.persons=DB.persons.slice(0,setupPersonCount);
    html+=`
      <h2>Nombres y colores</h2>
      <p>Personaliza cada persona del hogar.</p>
      ${DB.persons.map((p,i)=>`
        <div style="background:var(--bg2);border:1px solid var(--brd);border-radius:var(--rad-sm);padding:12px 14px;margin-bottom:10px">
          <div class="field-row"><label class="field-label">Nombre persona ${i+1}</label><input id="s-name-${i}" value="${p.name.startsWith('Persona ')?'':p.name}" placeholder="Nombre..."/></div>
          <div style="margin-top:8px"><label class="field-label">Color</label>
            <div class="color-picker-row" id="cp-${i}">${PRESET_COLORS.map(c=>`<div class="color-swatch ${p.color===c?'selected':''}" style="background:${c}" onclick="pickColor(${i},'${c}',this)"></div>`).join('')}</div>
          </div>
        </div>`).join('')}
      <button class="btn-primary" style="margin-top:10px" onclick="setupNext2()">Continuar →</button>`;
  } else {
    html+=`
      <h2>¡Todo listo!</h2>
      <p>Clarito configurado para <strong>${DB.persons.length} personas</strong>.</p>
      <div style="background:var(--bg2);border:1px solid var(--brd);border-radius:var(--rad);padding:16px;margin-bottom:20px">
        ${DB.persons.map(p=>`<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--brd)"><div style="width:12px;height:12px;border-radius:50%;background:${p.color};flex-shrink:0"></div><div style="font-weight:600">${p.name}</div></div>`).join('')}
      </div>
      <button class="btn-primary" onclick="finishSetup()">Empezar a usar Clarito</button>`;
  }
  el.innerHTML=html;
}

function pickColor(idx,color,el){DB.persons[idx].color=color;document.querySelectorAll(`#cp-${idx} .color-swatch`).forEach(s=>s.classList.remove('selected'));el.classList.add('selected');}
function setupNext0(){
  const vk=document.getElementById('s-visionkey').value.trim();
  const gk=document.getElementById('s-groqkey').value.trim();
  if(!vk){showToast('Introduce tu Google Vision Key');return;}
  DB.visionKey=vk;S.set('visionKey',vk);
  DB.groqKey=gk;S.set('groqKey',gk);
  setupStep=1;renderSetupStep();
}
function setupNext1(){setupStep=2;renderSetupStep();}
function setupNext2(){DB.persons.forEach((p,i)=>{const n=document.getElementById('s-name-'+i)?.value.trim();if(n)p.name=n;});setupStep=3;renderSetupStep();}
function finishSetup(){saveDB();document.getElementById('setup-screen').style.display='none';document.getElementById('app').style.display='flex';showScreen('home');}

// ── IMAGE RESIZE ────────────────────────────────────────────────
// Escala a max 1000px, para OCR.space preferimos JPEG limpio y claro
// Lee orientación EXIF del fichero (para corregir fotos Live/HEIC rotadas)
function readExifOrientation(file){
  return new Promise(res=>{
    const r=new FileReader();
    r.onload=e=>{
      try{
        const v=new DataView(e.target.result);
        if(v.getUint16(0)!==0xFFD8){res(1);return;} // no JPEG
        let off=2;
        while(off<v.byteLength){
          const marker=v.getUint16(off);off+=2;
          const len=v.getUint16(off);
          if(marker===0xFFE1){ // APP1 — EXIF
            if(v.getUint32(off+2)===0x45786966){ // "Exif"
              const tiffOff=off+2+6;
              const le=v.getUint16(tiffOff)===0x4949;
              const ifdOff=tiffOff+(le?v.getUint32(tiffOff+4,le):v.getUint32(tiffOff+4,false));
              const entries=le?v.getUint16(ifdOff,le):v.getUint16(ifdOff,false);
              for(let i=0;i<entries;i++){
                const tag=v.getUint16(ifdOff+2+i*12,le);
                if(tag===0x0112){res(v.getUint16(ifdOff+2+i*12+8,le));return;}
              }
            }
          }
          off+=len;
        }
      }catch{}
      res(1);
    };
    r.readAsArrayBuffer(file.slice(0,64*1024));
  });
}

function resizeForOCR(file){
  return new Promise(async(res,rej)=>{
    // Leer orientación EXIF primero (fotos Live de iPhone vienen rotadas)
    const orient=await readExifOrientation(file).catch(()=>1);
    const url=URL.createObjectURL(file);
    const img=new Image();
    img.onload=()=>{
      URL.revokeObjectURL(url);
      const MAX=1600; // más resolución = mejor OCR en texto pequeño
      let sw=img.naturalWidth,sh=img.naturalHeight;
      // Para orientaciones 5-8 ancho y alto se intercambian
      const swapped=orient>=5&&orient<=8;
      let w=swapped?sh:sw, h=swapped?sw:sh;
      if(w>h){if(w>MAX){h=Math.round(h*MAX/w);w=MAX;}}
      else{if(h>MAX){w=Math.round(w*MAX/h);h=MAX;}}
      const c=document.createElement('canvas');
      c.width=w;c.height=h;
      const ctx=c.getContext('2d');
      ctx.fillStyle='#fff';
      ctx.fillRect(0,0,w,h);
      // Aplicar transformación EXIF antes de dibujar
      ctx.save();
      if(orient===2){ctx.transform(-1,0,0,1,w,0);}
      else if(orient===3){ctx.transform(-1,0,0,-1,w,h);}
      else if(orient===4){ctx.transform(1,0,0,-1,0,h);}
      else if(orient===5){ctx.transform(0,1,1,0,0,0);}
      else if(orient===6){ctx.transform(0,1,-1,0,h,0);}
      else if(orient===7){ctx.transform(0,-1,-1,0,h,w);}
      else if(orient===8){ctx.transform(0,-1,1,0,0,w);}
      const dw=swapped?h:w, dh=swapped?w:h;
      ctx.drawImage(img,0,0,dw,dh);
      ctx.restore();
      // Aumentar contraste para mejor OCR
      const id=ctx.getImageData(0,0,w,h);
      const d=id.data;
      for(let i=0;i<d.length;i+=4){
        const g=Math.round(0.299*d[i]+0.587*d[i+1]+0.114*d[i+2]);
        const v=Math.min(255,Math.max(0,Math.round((g-128)*1.5+128)));
        d[i]=d[i+1]=d[i+2]=v;
      }
      ctx.putImageData(id,0,0);
      res(c.toDataURL('image/jpeg',0.9).split(',')[1]);
    };
    img.onerror=()=>rej(new Error('No se pudo cargar la imagen'));
    img.src=url;
  });
}

// ── GOOGLE CLOUD VISION ────────────────────────────────────────
async function googleVisionExtract(b64){
  const key=DB.visionKey;
  if(!key) throw new Error('Sin Google Vision API key. Configúrala en Ajustes.');

  const body={
    requests:[{
      image:{content:b64},
      features:[{type:'DOCUMENT_TEXT_DETECTION',maxResults:1}]
    }]
  };

  const res=await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${key}`,
    {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}
  );
  if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.error?.message||'Vision HTTP '+res.status);}
  const data=await res.json();
  const text=data.responses?.[0]?.fullTextAnnotation?.text||'';
  if(!text.trim()) throw new Error('No se detectó texto en la imagen');
  console.log('Vision texto extraído:', text.slice(0,400));
  return text;
}

// ── TICKET TEXT PARSER ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
//  PARSER DE TICKETS — arquitectura por formato
//
//  NORMAS GENERALES (todos los formatos):
//  - Ignorar líneas de cabecera (CIF, teléfonos, URLs, nombre tienda)
//  - Ignorar líneas promocionales / publicitarias
//  - Ignorar líneas de IVA, bases, totales de impuestos
//  - Ignorar códigos de barras (8+ dígitos puros)
//  - Ignorar líneas de separación (===, ---, ***)
//  - Cortar en la primera línea de TOTAL / ART. TOTAL A PAGAR
//  - Detectar fecha, hora, tarjeta y total global
//
//  FORMATOS SOPORTADOS:
//  1. MERCADONA — nombre en línea, precio en línea siguiente (con info kg opcionales)
//  2. CARREFOUR — bloques "N x (\nP,PP)\nPrecio_total\nNOMBRE..." y nombres inline
//  3. INLINE    — NOMBRE    PRECIO en la misma línea (Lidl, Aldi, Alcampo…)
//  4. GENÉRICO  — fallback que mezcla los anteriores
// ═══════════════════════════════════════════════════════════════
function parseTicketText(text){
  const rawLines=text.split('\n').map(l=>l.trim());
  // Filtrar líneas completamente vacías pero conservar el orden
  const lines=rawLines.filter(l=>l.length>0);

  // ── Regexes globales ──────────────────────────────────────────
  const PRICE_RX    = /^(\d{1,3}[.,]\d{2})\s*[)€]?\s*$/;          // línea que es solo un precio
  const INLINE_RX   = /^(.+?)\s{2,}(\d{1,3}[.,]\d{2})\s*[A-Z]?\s*$/; // NOMBRE   PRECIO [B/A] (2+ espacios)
  const QTY_OPEN_RX = /^(\d+)\s*[xX]\s*\($/;                       // "3 x (" o "2x ("
  // Formato qty en una sola línea que el OCR a veces produce: "3 x ( 1,29 )" o "X ( 1,29 )"
  const QTY_INLINE_RX = /^(\d+|[xX])\s*[xX]?\s*\(\s*(\d{1,3}[.,]\d{2})\s*\)?$/;
  const BARCODE_RX  = /^\d{7,}$/;
  const SEP_RX      = /^[=\-*_.]{3,}$/;
  const DATE_RX     = [/((\d{2})[\/\-.](\d{2})[\/\-.](\d{2,4}))/,
                       /(\d{1,2})\s+(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\w*\s+(\d{2,4})/i];
  const TIME_RX     = /(\d{1,2}):(\d{2})(?::(\d{2}))?/;
  const KG_RX       = /\d+[.,]\d+\s*kg|€\/kg|eur\/kg/i;
  const WEIGHT_RX   = /^[\d.,]+\s*(g|kg|ml|l|cl|gr?|lt?)\s*$/i;

  // ── SKIP — líneas que nunca son productos ─────────────────────
  // Normas generales para todos los supermercados
  const SKIP_RX=/^(subtotal|iva|base\s*imp|cuota|tipo\s*$|venta\s*$|importe|a\s*pagar|tarjeta|visa|mastercard|maestro|amex|debit|cambio|efectivo|devoluci|entrega|gracias|ticket|n[uú]mero|fecha|hora|caja|operador|factura|simplificada|nif|cif|www\.|https?:|descripci|p\.\s*unit|secc|tel[eé]f|telf|telef|op:|pol\.|s\.a\.|c\.i\.f|bienvenid|hasta\s*pronto|recib|socio|puntos|ahorro|dto\.|descuento\s|premio|bono|cupon|vale|\d+[.,]\d+%|art\.?\s*total|centros\s+comerciales|^lidl$|^aldi$|^idl\)?)/i;

  // Líneas promocionales / publicitarias
  const PROMO_RX = /^(-[A-ZÁÉÍÓÚÑ]|EL\s+CLUB\b|MI\s+DÍA|LLEGA\b|CLUB\b$)/i;

  function isPrice(l)    { return PRICE_RX.test(l); }
  function isSkip(l)     { return SKIP_RX.test(l) || PROMO_RX.test(l) || BARCODE_RX.test(l) || SEP_RX.test(l) || WEIGHT_RX.test(l); }
  function isKgInfo(l)   { return KG_RX.test(l) && !PRICE_RX.test(l); }
  function parsePrice(l) { return parseFloat(l.replace(/[)€]/g,'').replace(',','.').trim()); }

  // ── Detectar tienda ───────────────────────────────────────────
  const STORES=['mercadona','lidl','aldi','carrefour','dia','eroski','alcampo','consum',
    'hipercor','el corte ingles','supercor','spar','froiz','ahorramas','bonarea','decathlon',
    'primark','zara','mediamarkt','fnac','leroy','bricomart','ikea','distribuciones froiz'];
  let store='';
  for(const l of lines.slice(0,6)){
    const low=l.toLowerCase();
    const found=STORES.find(s=>low.includes(s));
    if(found){store=found.charAt(0).toUpperCase()+found.slice(1);break;}
    if(!store&&l.length>3&&l.length<35&&/^[A-ZÁÉÍÓÚÑ\s]+$/.test(l)&&!isSkip(l)) store=l;
  }

  // ── Detectar formato ─────────────────────────────────────────
  // Carrefour: tiene bloques "N x (" en el texto
  const isCarrefour = store.toLowerCase().includes('carrefour') ||
    lines.some(l=>QTY_OPEN_RX.test(l));
  const isFroiz = store.toLowerCase().includes('froiz') ||
    lines.some(l=>/distribuciones froiz/i.test(l));

  // ── Detectar fecha y hora ─────────────────────────────────────
  let date=null, time=null;
  // Primera pasada: buscar hora en línea sola HH:MM:SS (más fiable, al pie del ticket)
  for(const l of lines){
    const t=l.trim();
    const standalone=t.match(/^(\d{1,2}):(\d{2}):\d{2}$/);
    if(standalone){ time=`${standalone[1].padStart(2,'0')}:${standalone[2]}`; break; }
  }
  // Segunda pasada: fecha y hora inline si no se encontró standalone
  for(const l of lines){
    if(!date){
      for(const rx of DATE_RX){
        const m=l.match(rx);
        if(m){
          try{
            let d,mo,y;
            if(rx===DATE_RX[0]){ d=m[2];mo=m[3];y=m[4]; }
            else{ d=String(m[1]).padStart(2,'0');mo='01';y=m[2]; }
            if(y&&y.length===2) y='20'+y;
            const dt=new Date(`${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`);
            if(!isNaN(dt)) date=dt.toISOString().slice(0,10);
          }catch{}
        }
      }
    }
    if(!time){
      // Solo coger hora inline si no hay una standalone ya
      const tm=l.match(/(\d{1,2}):(\d{2}):\d{2}/);
      if(tm) time=`${tm[1].padStart(2,'0')}:${tm[2]}`;
    }
    if(date&&time) break;
  }

  // ── Detectar total global ─────────────────────────────────────
  let total=0;
  // Buscar IMPORTE: / TOTAL A PAGAR / ART. TOTAL / ==== seguido de precio
  const TOTAL_TRIGGER_RX=/^(total\s*a\s*pagar|art\.?[\s.]*total|====+|\*?total\b)/i;
  for(let ti=0;ti<lines.length;ti++){
    const l=lines[ti].trim();
    // Precio inline en la misma línea: "IMPORTE: 11,82 EUR"
    const inlineTotal=l.match(/(?:importe?|\*?total|imp\.|entrega:)[^0-9]*(\d{1,4}[.,]\d{2})\s*(?:eur|€\.?)?/i);
    if(inlineTotal){ const v=parseFloat(inlineTotal[1].replace(',','.')); if(v>0){total=v;break;} }
    if(!TOTAL_TRIGGER_RX.test(l)) continue;
    // Buscar precio en las siguientes líneas no vacías
    for(let k=1;k<=4;k++){
      if(ti+k>=lines.length) break;
      const nxt=lines[ti+k].trim();
      if(!nxt||SEP_RX.test(nxt)) continue;
      const nm=nxt.match(/^(\d{1,4}[.,]\d{2})\s*(?:eur|€)?$/i);
      if(nm){ const v=parseFloat(nm[1].replace(',','.')); if(v>0){total=v;break;} }
      if(!/^\d/.test(nxt)) break;
    }
    if(total) break;
  }
  // Fallback: buscar "11,82" repetido (Carrefour lo repite como confirmación)
  if(!total){
    const allPrices=lines.map(l=>l.match(/^(\d{1,4}[.,]\d{2})$/)).filter(Boolean).map(m=>parseFloat(m[1].replace(',','.')));
    const freq={};
    allPrices.forEach(p=>{ freq[p]=(freq[p]||0)+1; });
    const repeated=Object.entries(freq).filter(([,c])=>c>=2).map(([p])=>parseFloat(p));
    if(repeated.length) total=Math.max(...repeated);
  }

  // ── Detectar tarjeta ─────────────────────────────────────────
  let last4=null;
  for(const l of lines){
    // Formatos de tarjeta enmascarada: "479343XXXXXX0925", "XXXXXXXXXXXX0925", "XXXXXXXXXXXX0925 00"
    // Regla: debe haber al menos 4 X/*/• consecutivas seguidas de exactamente 4 dígitos al final
    const m=l.match(/(?:\d{4,6})?[Xx*•]{4,}(\d{4})\b/)||   // "479343XXXXXX0925" o "XXXX0925"
             l.match(/^[Xx\s*•]+(\d{4})\s*(?:\d{2})?\s*$/)||// "XXXX0925 00"
             l.match(/tarjeta[^\d]*(\d{4})/i)||
             l.match(/(?:visa|mastercard|maestro|amex|debit)\s+\d*[Xx*•]+(\d{4})/i);
    if(m&&m[1]){ last4=m[1]; break; }
  }

  // ── Cortar en línea de total / impuestos ──────────────────────
  // Todo lo que viene después de la primera línea de corte no es producto
  const CUT_RX=/^(total\s*$|art\.?[\s.]*total|total[\s.]*a[\s.]*pagar|tipo\s*$|====+|base\s*$|cuota\s*$)/i;
  // Pre-detectar formato Lidl columnas antes de cortar
  // En Lidl columnas los precios B/A vienen DESPUÉS de TOTAL — no cortar en TOTAL
  // Detectar Lidl columnas inline (sin usar LIDL_PRICE_RX que aún no está declarado)
  const _lidlPriceRx=/^\d{1,3}[.,]\d{2}\s*[A-Z]\s*$/;
  const isLidlColumnFormat=(()=>{
    let totIdx=-1;
    for(let li=0;li<lines.length;li++) if(/^total$/i.test(lines[li].trim())){totIdx=li;break;}
    if(totIdx<0) return false;
    const after=lines.slice(totIdx).filter(l=>_lidlPriceRx.test(l.trim())).length;
    const before=lines.slice(0,totIdx).filter(l=>_lidlPriceRx.test(l.trim())).length;
    return after>=3&&before===0;
  })();
  const CUT_RX_ACTIVE=isLidlColumnFormat
    ?/^(art\.?[\s.]*total|total[\s.]*a[\s.]*pagar|tipo\s*$|====+|base\s*$|cuota\s*$)/i
    :CUT_RX;
  let cutIdx=lines.length;
  for(let ti=0;ti<lines.length;ti++){
    if(CUT_RX_ACTIVE.test(lines[ti].trim())){cutIdx=ti;break;}
  }
  const productLines=lines.slice(0,cutIdx);

  // ── Regexes específicos de formato Lidl ──────────────────────
  const LIDL_PRICE_RX=/^(\d{1,3}[.,]\d{2})\s*[A-Z]\s*$/; // "1,15 B", "3,25 A"
  const MULT_RX=/^[\d.,]+\s*(?:kg\s*)?[xX]\s*[\d.,]+/;   // "1,718 kg x 1,89"
  const UNIT_PRICE_X_RX=/^(\d{1,3}[.,]\d{2})[xX]\s*$/;     // "2,49x"

  // ── PARSEAR PRODUCTOS ─────────────────────────────────────────
  const products=[];

  if(isFroiz){
    parseFroiz(lines, products); // Froiz usa todas las líneas, no solo productLines
  } else if(isCarrefour){
    parseCarrefour(productLines, products);
  } else {
    parseGeneric(productLines, products);
  }

  total=parseFloat(String(total).replace(',','.'));
  return{store,date,time,last4,total,products,errors:[],warnings:[]};

  // ══════════════════════════════════════════════════════════════════
  //  FORMATO FROIZ
  //  Estructura OCR: NOMBRE → CÓDIGO_INTERNO → PRECIO
  //  La sección de IVA empieza con "IMPORTE" — todo lo que sigue son importes fiscales
  //  Particularidades:
  //  - "6 u" en el nombre es contenido del paquete, no cantidad comprada
  //  - El tipo de IVA puede aparecer al final del nombre: "Mantequilla... 10%"
  //  - Un número entero suelto antes del código puede ser qty del producto anterior (pack)
  //  - Precio correcto = primer precio después del código interno
  // ══════════════════════════════════════════════════════════════════
  function parseFroiz(allLines, out){
    const FROIZ_CODE_RX=/^\d{5,}\.?\s*\d*$/;
    const FROIZ_CUT_RX=/^(\*?total\b|entrega:|tarjetas:|a\s+devolver|base\s+c\.iva)/i;

    let headerEnd=0;
    for(let i=0;i<allLines.length;i++){
      const l=allLines[i].trim();
      if(/^descripcion\b/i.test(l)){headerEnd=i+1;break;}
      if(/^nif\b|^cif\b/i.test(l)) headerEnd=i+1;
    }
    let docEnd=allLines.length;
    for(let i=headerEnd;i<allLines.length;i++){
      if(FROIZ_CUT_RX.test(allLines[i].trim())){docEnd=i;break;}
    }
    const body=allLines.slice(headerEnd,docEnd);

    function isFroizName(l){
      if(!l||l.length<3) return false;
      if(FROIZ_CODE_RX.test(l)) return false;
      if(isPrice(l)||isLidlPrice(l)) return false;
      if(/^\d+$/.test(l)) return false;
      if(/^\d+%$/.test(l)) return false;
      // IMPORTE es cabecera de columna en Froiz, no filtrar nombres después de él
      if(isSkip(l)||BARCODE_RX.test(l)||SEP_RX.test(l)) return false;
      if(/^(nif|cif|factura|simplificada|descripcion|cant|p\.v\.p)/i.test(l)) return false;
      return true;
    }

    const names=body.filter(l=>isFroizName(l.trim()));
    const prices=[];
    // Detectar si IMPORTE aparece antes o después de los nombres
    const firstNameIdx=body.findIndex(l=>isFroizName(l.trim()));
    const importeIdx=body.findIndex(l=>/^importe$/i.test(l.trim()));
    const importeIsHeader=importeIdx>=0&&importeIdx<firstNameIdx; // IMPORTE antes de nombres → cabecera
    // Para iPad: prices directamente tras código (antes de IMPORTE)
    // Para iPhone: prices vienen en pares tras 4%: [pvp_unit, importe_total] — tomar el último
    if(!importeIsHeader){
      // iPad: tomar precios inmediatamente después de cada código interno
      // No cortar en IMPORTE — puede haber productos después
      let prevWasCode=false;
      for(const l of body){
        const t=l.trim();
        if(FROIZ_CODE_RX.test(t)){prevWasCode=true;continue;} // check code BEFORE bare integer
        if(/^\d+%$/.test(t)||/^\d+$/.test(t)){prevWasCode=false;continue;}
        if((isPrice(t)||isLidlPrice(t))&&prevWasCode){
          const p=parseLidlPrice(t)||parsePrice(t);
          if(p!=null&&p>0&&p<500) prices.push(p);
          prevWasCode=false; continue;
        }
        if(isPrice(t)||isLidlPrice(t)){prevWasCode=false;continue;} // precio no tras código → ignorar
        prevWasCode=false;
      }
    } else {
      // iPhone Froiz: precios vienen agrupados por tipo IVA
      // Cada grupo de IVA puede tener 1 o 2 precios: [pvp_unit, total_pagado]
      // Si hay 2 precios en el grupo, el segundo es el total (pack).
      // Estructura: 4% → p1a, p1b → 4% → p2a, p2b → 10% → p3a, p3b
      // O sin agrupación clara: contar cuántos nombres hay y tomar esa cantidad de precios
      // en el orden correcto desde el bloque de precios.
      // Estrategia: recoger TODOS los precios en orden y tomar 1 por nombre,
      // eligiendo el total (2º si hay par consecutivo con mismo tipo, o el más grande)
      const allPrices=[];
      for(const l of body){
        const t=l.trim();
        if(/^\d+%$/.test(t)) continue; // separador de IVA
        if(isPrice(t)||isLidlPrice(t)){
          const p=parseLidlPrice(t)||parsePrice(t);
          if(p!=null&&p>0&&p<500) allPrices.push(p);
        }
      }
      // allPrices para el ejemplo: [1.89, 1.89, 1.19, 7.14, 3.69, 3.69]
      // Necesitamos names.length precios, uno por nombre
      // Patrón: cuando hay un precio duplicado consecutivo, usar uno. Cuando hay par diferente, usar el mayor.
      const deduped=[];
      let ai=0;
      while(ai<allPrices.length&&deduped.length<names.length){
        const current=allPrices[ai];
        const next=allPrices[ai+1];
        if(next!==undefined&&next!==current&&next>current){
          // Par diferente: pvp_unit + total_pagado → tomar el total
          deduped.push(next); ai+=2;
        } else if(next!==undefined&&next===current){
          // Precio duplicado: tomar una vez
          deduped.push(current); ai+=2;
        } else {
          deduped.push(current); ai++;
        }
      }
      deduped.forEach(p=>prices.push(p));
    }

    for(let k=0;k<names.length;k++){
      const rawName=names[k].trim().replace(/\s+\d+[.,]?\d*\s*%\s*$/,'').trim();
      const price=prices[k];
      if(!price) continue;
      const nm=cleanName(rawName)
        .replace(/\s+\d+\s*u\b/gi,'')
        .replace(/\s+\d+[.,]\d+\s*(kg|g|l|ml|cl)\b/gi,'')
        .replace(/\s+\d+\s*(kg|g|l|ml|cl)\b/gi,'')
        .replace(/\bbrik\s+\d+(\s+\d+)?\b/gi,'brik')
        .replace(/\s+\d+\s*$/,'').trim();
      if(nm.length<2) continue;
      out.push(makeProduct(nm,rawName,price,1));
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  FORMATO CARREFOUR — estructura confirmada:
  //    NOMBRE           ← nombre del producto
  //    N x (            ← bloque: cantidad N
  //    P,PP)            ← precio unitario
  //    TOTAL            ← precio total bloque (consumir/descartar)
  //
  //  Items unitarios (sin bloque qty):
  //    NOMBRE
  //    P,PP
  // ═══════════════════════════════════════════════════════════════
  function parseCarrefour(pLines, out){
    let i=0;
    while(i<pLines.length){
      const trimmed=pLines[i].trim(); i++;
      if(!trimmed||trimmed.length<2) continue;
      if(isSkip(trimmed)) continue;
      if(BARCODE_RX.test(trimmed)||SEP_RX.test(trimmed)) continue;
      if(/^\d{1,2}[\/.:]\d{2}/.test(trimmed)) continue;
      if(/^\d{1,3}$/.test(trimmed)) continue; // número de artículos (ej: "8", "55")

      // ── Bloque qty "N x (" (multilínea) o "N x ( P,PP )" (una línea) ──────────────────────────────────────
      // El nombre YA está en out como último elemento (procesado justo antes).
      // Actualizamos ese último elemento con qty y unitPrice correctos.
      const qtyInlineM=trimmed.match(QTY_INLINE_RX); // "3 x ( 1,29 )" en una sola línea
      if(qtyInlineM){
        const unitPrice=parseFloat(qtyInlineM[2].replace(',','.'));
        // Inferir qty: si la siguiente línea es el precio total, qty = total / unitPrice
        let qty=parseInt(qtyInlineM[1])||1;
        if(i<pLines.length&&isPrice(pLines[i].trim())){
          const blockTotal=parsePrice(pLines[i].trim());
          const inferred=Math.round(blockTotal/unitPrice);
          if(inferred>=1&&inferred<=20&&Math.abs(inferred*unitPrice-blockTotal)<0.02) qty=inferred;
          i++; // consumir precio total
        }
        if(out.length>0){
          const last=out[out.length-1];
          last.qty=qty; last.unitPrice=unitPrice; last.price=unitPrice;
          last.finalPrice=parseFloat((unitPrice*qty).toFixed(2));
        }
        continue;
      }
      const qtyM=trimmed.match(QTY_OPEN_RX); // "3 x (" multilínea
      if(qtyM){
        const qty=parseInt(qtyM[1]);
        // Leer precio unitario "1,29)"
        let unitPrice=null;
        if(i<pLines.length&&isPrice(pLines[i].trim())){
          unitPrice=parsePrice(pLines[i].trim()); i++;
        }
        // Consumir precio total del bloque "3,87"
        if(i<pLines.length&&isPrice(pLines[i].trim())) i++;
        if(!unitPrice) continue;
        // Parchear el último producto añadido
        if(out.length>0){
          const last=out[out.length-1];
          last.qty=qty; last.unitPrice=unitPrice; last.price=unitPrice;
          last.finalPrice=parseFloat((unitPrice*qty).toFixed(2));
        }
        continue;
      }

      // ── Precio suelto → busca el primer producto sin precio (de atrás hacia adelante) ──
      if(isPrice(trimmed)){
        const pr=parsePrice(trimmed);
        // Buscar hacia atrás el primer producto sin precio asignado aún
        for(let k=out.length-1;k>=Math.max(0,out.length-4);k--){
          const target=out[k];
          if(!target.unitPrice||target.unitPrice===0){
            if(/art.*total|total.*pagar/i.test(target.rawName||'')){out.splice(k,1);break;}
            target.unitPrice=pr; target.price=pr;
            target.finalPrice=parseFloat((pr*(target.qty||1)).toFixed(2));
            break;
          }
        }
        continue;
      }

      // ── Nombre inline con precio (NOMBRE   1,59) ─────────────────
      const inlineM=trimmed.match(INLINE_RX);
      if(inlineM){
        const rawName=inlineM[1].trim();
        const pr=parseFloat(inlineM[2].replace(',','.'));
        if(pr>0&&pr<=500&&rawName.length>=2&&!isSkip(rawName)){
          const nm=cleanName(rawName);
          if(nm.length>=2) out.push(makeProduct(nm,rawName,pr,1));
        }
        continue;
      }

      // ── Nombre solo ──────────────────────────────────────────────
      if(!isKgInfo(trimmed)&&!WEIGHT_RX.test(trimmed)){
        // Doble filtro: rechazar líneas que parezcan totales aunque lleguen aquí
        if(/art.*total|total.*pagar/i.test(trimmed)) continue;
        const nm=cleanName(trimmed);
        if(nm.length>=2) out.push(makeProduct(nm,trimmed,0,1));
      }
    }
    // Eliminar productos que no recibieron precio
    for(let k=out.length-1;k>=0;k--){
      if(!out[k].unitPrice||out[k].unitPrice===0) out.splice(k,1);
    }
  }


  function parseLidlPrice(l){
    const m=l.match(/^(\d{1,3}[.,]\d{2})\s*[A-Z]?\s*$/);
    return m?parseFloat(m[1].replace(',','.')):null;
  }
  function isLidlPrice(l){return LIDL_PRICE_RX.test(l)||isPrice(l);}

  // ══════════════════════════════════════════════════════════════
  //  FORMATO LIDL COLUMNAS (OCR real iPad/WhatsApp)
  //
  //  El OCR de Vision en iPad separa el ticket en dos bloques:
  //  BLOQUE A (antes de TOTAL): nombres de producto + info kg + packs
  //  BLOQUE B (después de IMP./EUR/ooo): precios con sufijo B/A
  //
  //  Estructura confirmada del OCR real:
  //    NOMBRE1, NOMBRE2... GOFRES, 2,49x, 2, PIÑA, 1,718 kg x 1,89, EUR/kg
  //    TOTAL, ENTREGA, [basura OCR], IMP. 18,72 EUR, [más basura]
  //    ooo / EUR / 82 / [basura]
  //    1,15 B, 1,75 B ... 4,98 B, 3,25 A
  //    18,72, 18,72
  //
  //  Pack detectado por: NOMBRE seguido de "P,PPx" y luego un número entero
  //  Fruta por: NOMBRE seguido de "N,NNN kg x P,PP" y "EUR/kg"
  // ══════════════════════════════════════════════════════════════
  function parseLidlColumns(pLines, allLines, out){
    // Recoger nombres y sus metadatos (pack qty, kg info)
    const entries=[]; // {raw, qty, unitPrice, kgInfo}
    let i=0;

    // Buscar fin del bloque de nombres (TOTAL o ENTREGA)
    const totalIdx=pLines.findIndex(l=>/^(total|entrega)$/i.test(l.trim()));
    const nameLines=totalIdx>=0?pLines.slice(0,totalIdx):pLines;

    let j=0;
    // Saltar cabecera buscando NIF como ancla de inicio de productos
    {
      let nifIdx=nameLines.findIndex(l=>/^nif\b/i.test(l.trim()));
      if(nifIdx>=0) j=nifIdx+1;
    }
    while(j<nameLines.length){
      const l=nameLines[j].trim(); j++;
      if(!l||isSkip(l)||BARCODE_RX.test(l)||SEP_RX.test(l)) continue;
      if(/^\d{1,2}[\/.:]\d{2}/.test(l)) continue;
      if(/^(nif|cif|eur\/kg|eur$|entrega|recibo|inicio|folletos|mi\s+cuenta|lidl\s+plus)/i.test(l)) continue;
      if(/calle|avda|plaza|\d{5}/.test(l)) continue;
      if(/s\.a\.u?\.?$|s\.l\.$/i.test(l)) continue;
      if(store&&l.toLowerCase().includes(store.toLowerCase())) continue;
      if(/^(lidl|aldi|dia|mercadona|carrefour)$/i.test(l)) continue;
      if(/^\d+$/.test(l)) continue;
      if(/^(ooo|82$|'|")/i.test(l)) continue;
      if(/^\d+\s+de\s+/i.test(l)||/^(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i.test(l)) continue;
      if(LIDL_PRICE_RX.test(l)||UNIT_PRICE_X_RX.test(l)) continue;
      if(isPrice(l)) continue;

      // Detectar info de kg: siguiente línea es "N,NNN kg x P,PP"
      let kgInfo=null;
      if(j<nameLines.length&&MULT_RX.test(nameLines[j].trim())){
        kgInfo=nameLines[j].trim(); j++;
        // Consumir "EUR/kg" si sigue
        if(j<nameLines.length&&/^eur\/kg/i.test(nameLines[j].trim())) j++;
      }

      // Detectar pack: siguiente línea es "P,PPx" + número entero
      let packQty=1, packUnit=null;
      if(j<nameLines.length&&UNIT_PRICE_X_RX.test(nameLines[j].trim())){
        const upm=nameLines[j].trim().match(/^(\d{1,3}[.,]\d{2})/);
        packUnit=upm?parseFloat(upm[1].replace(',','.')):null;
        j++;
        if(j<nameLines.length&&/^\d+$/.test(nameLines[j].trim())){
          packQty=parseInt(nameLines[j].trim()); j++;
        }
      }

      entries.push({raw:l, qty:packQty, unitPrice:packUnit, kgInfo});
    }

    // Recoger precios del bloque B (después de TOTAL en allLines)
    // Buscar el bloque de precios: aparecen agrupados con sufijo B/A
    // Pueden estar después de "ooo", "EUR", basura OCR
    const prices=[];
    let inPriceBlock=false;
    for(const l of allLines){
      const t=l.trim();
      if(LIDL_PRICE_RX.test(t)){
        const p=parseLidlPrice(t);
        if(p!==null&&p>0) prices.push(p);
        inPriceBlock=true;
      } else if(inPriceBlock&&isPrice(t)){
        // Precio sin sufijo B/A después del bloque (total del ticket)
        break;
      } else if(inPriceBlock&&t&&!/^(18|ooo|eur|82|'|\d{1,2}$)/i.test(t)){
        // Línea de texto real — fin del bloque de precios
        inPriceBlock=false;
      }
    }

    // Parear entradas con precios
    for(let k=0;k<entries.length;k++){
      const e=entries[k];
      const price=prices[k];
      if(price==null) continue;
      const nm=cleanName(e.raw);
      if(nm.length<2) continue;
      if(e.kgInfo){
        // Fruta/verdura: 1 unidad al precio total
        out.push(makeProduct(nm,e.raw,price,1));
      } else if(e.qty>1&&e.unitPrice){
        out.push(makeProduct(nm,e.raw,e.unitPrice,e.qty));
      } else {
        out.push(makeProduct(nm,e.raw,price,1));
      }
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  FORMATO LIDL INLINE (OCR real iPhone)
  //
  //  El OCR de iPhone mezcla nombres y precios pero no siempre inline.
  //  Estructura real:
  //    NOMBRE → precio en línea siguiente (o intercalado)
  //    GOFRES → 2,49x → 2 → 4,98 B  (pack)
  //    PIÑA   → 3,25 A → 1,718 kg x 1,89 → EUR/kg
  //
  //  Hay basura OCR antes: "82", "ooo", "EUR" — filtrar
  // ══════════════════════════════════════════════════════════════
  function parseLidlInline(pLines, out){
    // Estrategia: recoger todos los nombres y todos los precios por separado,
    // luego parearlos por posición en el documento.
    // Esto maneja el caso donde el OCR de iPhone mezcla nombres y precios
    // pero no siempre inline — pueden venir grupos de nombres seguidos de grupos de precios.

    // Empezar después del NIF
    let startIdx=0;
    {
      const nifIdx=pLines.findIndex(l=>/^nif\b/i.test(l.trim()));
      if(nifIdx>=0) startIdx=nifIdx+1;
    }
    const lines=pLines.slice(startIdx);

    function isProductName(l){
      if(!l||l.length<2) return false;
      if(isSkip(l)||BARCODE_RX.test(l)||SEP_RX.test(l)) return false;
      if(/^\d{1,2}[\/.:]\d{2}/.test(l)) return false;
      if(/^(nif|cif|eur\/kg|eur$|entrega|recibo|total|inicio|folletos|mi\s+cuenta|lidl\s+plus|ooo)/i.test(l)) return false;
      if(/calle|avda|plaza|\d{5}/.test(l)) return false;
      if(/s\.a\.u?\.?$|s\.l\.$/i.test(l)) return false;
      if(store&&l.toLowerCase().includes(store.toLowerCase())) return false;
      if(/^(lidl|aldi|dia|mercadona|carrefour)$/i.test(l)) return false;
      if(/^(82|ooo|'|"|eur$)$/i.test(l)) return false;
      if(isLidlPrice(l)||isPrice(l)||UNIT_PRICE_X_RX.test(l)) return false;
      if(/^\d+$/.test(l)) return false;
      if(isKgInfo(l)||WEIGHT_RX.test(l)||MULT_RX.test(l)) return false;
      return true;
    }

    // Recoger entradas: {name, qty, unitP, kgInfo}
    const entries=[];
    let i=0;
    while(i<lines.length){
      const l=lines[i].trim(); i++;
      if(!isProductName(l)) continue;
      let qty=1, unitP=null, kgInfo=null;
      // Mirar si viene pack (2,49x → 2) en las siguientes líneas
      let j=i;
      while(j<lines.length){
        const nxt=lines[j].trim();
        if(UNIT_PRICE_X_RX.test(nxt)){const m=nxt.match(/^(\d{1,3}[.,]\d{2})/);unitP=m?parseFloat(m[1].replace(',','.')):null;j++;
          if(j<lines.length&&/^\d+$/.test(lines[j].trim())){qty=parseInt(lines[j].trim());j++;}
          break;}
        if(MULT_RX.test(nxt)){kgInfo=nxt;j++;if(j<lines.length&&/^eur\/kg/i.test(lines[j].trim()))j++;break;}
        break;
      }
      i=j;
      entries.push({name:l, qty, unitP, kgInfo});
    }

    // Recoger todos los precios en orden de documento
    const prices=[];
    for(const l of lines){
      const t=l.trim();
      if(isLidlPrice(t)){const p=parseLidlPrice(t);if(p!=null&&p>0&&p<500)prices.push(p);}
    }

    // Parear: cada entrada con su precio en posición
    for(let k=0;k<entries.length;k++){
      const e=entries[k];
      const price=prices[k];
      if(price==null) continue;
      const nm=cleanName(e.name);
      if(nm.length<2) continue;
      if(e.kgInfo){out.push(makeProduct(nm,e.name,price,1));}
      else if(e.qty>1&&e.unitP){out.push(makeProduct(nm,e.name,e.unitP,e.qty));}
      else{out.push(makeProduct(nm,e.name,price,1));}
    }
  }

  function parseGeneric(pLines, out){
    // ── Detectar formato Lidl columnas con el OCR real ──
    // Señal: bloque de precios B/A aparece DESPUÉS del bloque de nombres
    // y DESPUÉS de TOTAL/IMP. (no intercalado)
    const hasLidlColumns=isLidlColumnFormat;

    if(hasLidlColumns){
      // Usar todas las líneas originales para encontrar el bloque de precios
      const allProductLines=[...pLines];
      parseLidlColumns(pLines, allProductLines, out);
      return;
    }

    // ── Detectar formato Lidl inline (iPhone) ──
    // Señal: hay precios B/A mezclados con nombres, no todos al final
    const pricesInFirstHalf=pLines.slice(0,Math.ceil(pLines.length/2)).filter(l=>LIDL_PRICE_RX.test(l.trim())).length;
    const isLidlInline=pricesInFirstHalf>0;

    if(isLidlInline){
      parseLidlInline(pLines, out);
      return;
    }

    // ── Formato genérico (Mercadona, otros) ──
    let i=0;
    while(i<pLines.length){
      const trimmed=pLines[i].trim(); i++;
      if(!trimmed||trimmed.length<2) continue;
      if(isSkip(trimmed)) continue;
      if(BARCODE_RX.test(trimmed)||SEP_RX.test(trimmed)) continue;
      if(/^\d{1,2}[\/.:]\d{2}/.test(trimmed)) continue;
      if(MULT_RX.test(trimmed)||UNIT_PRICE_X_RX.test(trimmed)) continue;
      if(isKgInfo(trimmed)||WEIGHT_RX.test(trimmed)) continue;
      if(store&&trimmed.toLowerCase()===store.toLowerCase()) continue;

      const lidlInlineM=trimmed.match(/^(.+?)\s+(\d{1,3}[.,]\d{2})\s*[A-Z]?\s*$/);
      if(lidlInlineM){
        const rawName=lidlInlineM[1].trim();
        const price=parseFloat(lidlInlineM[2].replace(',','.'));
        if(price>0&&price<=500&&rawName.length>=2&&!isSkip(rawName)
           &&!/^total$/i.test(rawName)&&!(store&&rawName.toLowerCase()===store.toLowerCase())){
          const nm=cleanName(rawName);
          if(nm.length>=2) out.push(makeProduct(nm,rawName,price,1));
        }
        continue;
      }

      const inlineM=trimmed.match(INLINE_RX);
      if(inlineM){
        const rawName=inlineM[1].trim();
        const price=parseFloat(inlineM[2].replace(',','.'));
        if(price>0&&price<=500&&rawName.length>=2&&!isSkip(rawName)&&!/^\d/.test(rawName)){
          const qm=rawName.match(/^(\d+)\s+(.+)/);
          const qty=qm?parseInt(qm[1]):1;
          const nm=cleanName(qm?qm[2]:rawName);
          if(nm.length>=2) out.push(makeProduct(nm,rawName,qty>1?parseFloat((price/qty).toFixed(2)):price,qty));
        }
        continue;
      }

      if(isPrice(trimmed)||isLidlPrice(trimmed)) continue;
      if(/^\d/.test(trimmed)) continue;

      const priceLines=[];
      let j=i;
      while(j<pLines.length){
        const next=pLines[j].trim();
        if(!next){j++;continue;}
        if(isPrice(next)||isLidlPrice(next)){priceLines.push(parseLidlPrice(next)||parsePrice(next));j++;}
        else if(isKgInfo(next)||WEIGHT_RX.test(next)||MULT_RX.test(next)){j++;}
        else break;
      }
      if(priceLines.length>0){
        i=j;
        const price=priceLines[priceLines.length-1];
        if(isSkip(trimmed)||trimmed.length<2) continue;
        const qm=trimmed.match(/^(\d+)\s+(.+)/);
        const qty=qm?parseInt(qm[1]):1;
        const nm=cleanName(qm?qm[2]:trimmed);
        if(!/^\d+$/.test(nm)&&nm.length>=2)
          out.push(makeProduct(nm,trimmed,qty>1?parseFloat((price/qty).toFixed(2)):price,qty));
      }
    }
  }
  // ── Helpers ───────────────────────────────────────────────────
  function cleanName(raw){
    return raw
      .replace(/\d+[.,]\d+\s*kg.*/i,'')
      .replace(/\s*€\/kg.*/i,'')
      .replace(/\s*€\/u.*/i,'')
      .replace(/\)$/,'')
      .trim();
  }
}
function makeProduct(name,rawName,unitPrice,qty=1){
  const total=parseFloat((unitPrice*qty).toFixed(2));
  return{
    rawName,
    name:normalizeProdName(name),
    price:unitPrice,
    unitPrice,
    finalPrice:total,
    discount:0,qty,
    confidence:name.length>3&&unitPrice>0.1?0.8:0.5,
    category:guessCategory(name),
    assignedTo:null,shared:true,pct1:50
  };
}

function normalizeProdName(raw){
  // Expande abreviaturas comunes de supermercados españoles
  return raw
    .replace(/\bLT\b/gi,'litro')
    .replace(/\bKG\b/gi,'kg')
    .replace(/\bGR?\b/gi,'g')
    .replace(/\bUN\b/gi,'unidad')
    .replace(/\bBOT\b/gi,'botella')
    .replace(/\bPK\b/gi,'pack')
    .replace(/\bFRD\b/gi,'fresa')
    .replace(/\bTO\b$/gi,'tomate')
    .replace(/\bSAL\s+TO\b/gi,'salsa tomate')
    .replace(/\bMERCAD\b/gi,'Mercadona')
    .replace(/([a-záéíóúñ])([A-ZÁÉÍÓÚÑ])/g,'$1 $2') // CamelCase → palabras
    .toLowerCase()
    .replace(/^\w/,c=>c.toUpperCase())
    .trim();
}

function guessCategory(name){
  const n=name.toLowerCase();
  if(/leche|yogur|queso|mantequilla|nata|kefir/.test(n)) return 'lácteos';
  if(/cerveza|agua|refresco|zumo|vino|cava|whisky|ron|gin|vodka/.test(n)) return 'bebidas';
  if(/pollo|carne|ternera|cerdo|salchich|jamón|chorizo|longaniza|pavo|cordero/.test(n)) return 'carne';
  if(/merluza|salmon|atún|bacalao|dorada|lubina|gamba|mejillon|calamar/.test(n)) return 'pescado';
  if(/manzana|pera|naranja|plátano|fresa|uva|melocoton|mandarina|limón|kiwi/.test(n)) return 'fruta';
  if(/lechuga|tomate|patata|cebolla|zanahoria|pimiento|calabacin|espinaca|brócoli/.test(n)) return 'fruta';
  if(/helado|pizza|croqueta|nugget|varitas/.test(n)) return 'congelados';
  if(/gel|champú|jabón|pasta\s*dent|colonia|desodorante|crema|maquillaje/.test(n)) return 'higiene';
  if(/lejia|suavizante|detergente|fregasuelos|bayeta|estropajo|bolsa\s*basura/.test(n)) return 'limpieza';
  if(/pan|aceite|arroz|pasta|harina|azucar|sal|vinagre|conserva|lata|bote|galleta|chocolate/.test(n)) return 'alimentación';
  return 'alimentación';
}

// ── GEMINI FALLBACK (texto) ─────────────────────────────────────
// Solo se usa si OCR.space falla O si el parser saca <2 productos

// ── GROQ (chat IA + fallback parser) ──────────────────────────
async function callGroq(prompt){
  const key=DB.groqKey;
  if(!key) throw new Error('No hay API key de Groq. Ve a Configuración.');
  const res=await fetch('https://api.groq.com/openai/v1/chat/completions',{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},
    body:JSON.stringify({
      model:'llama-3.1-8b-instant',
      messages:[{role:'user',content:prompt}],
      temperature:0.2,
      max_tokens:1024
    })
  }).catch(e=>{throw new Error('Red bloqueada: '+e.message);});
  if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.error?.message||'Groq HTTP '+res.status);}
  const data=await res.json();
  // Rastrear uso de Groq
  if(!DB.groqStats) DB.groqStats={calls:0,firstCall:null,tokensUsed:0};
  DB.groqStats.calls=(DB.groqStats.calls||0)+1;
  DB.groqStats.tokensUsed=(DB.groqStats.tokensUsed||0)+(data.usage?.total_tokens||0);
  if(!DB.groqStats.firstCall) DB.groqStats.firstCall=new Date().toISOString().slice(0,10);
  S.set('groqStats',JSON.stringify(DB.groqStats));
  return data.choices?.[0]?.message?.content||'';
}

async function groqParseText(ocrText){
  const key=DB.groqKey;
  if(!key) throw new Error('Sin API key Groq');
  const knownProds=Object.entries(DB.knowledge.products).slice(0,8)
    .map(([k,v])=>`${k}→${v.shared?'común':personName(v.person)}`).join(', ');
  const prompt=`Analiza este texto de un ticket de supermercado español. Devuelve SOLO JSON sin markdown ni texto extra:
{"store":"","date":"YYYY-MM-DD o null","time":"HH:MM o null","total":0,"last4":"4 dígitos o null","products":[{"rawName":"texto literal","name":"nombre legible","price":0,"unitPrice":0,"qty":1,"confidence":0.9,"category":"alimentación|higiene|limpieza|bebidas|lácteos|fruta|carne|pescado|congelados|otro"}],"errors":[],"warnings":[]}
Ignora líneas de IVA, entrega efectivo, devolución, descuentos con %, total, subtotal.
Para productos con cantidad (ej: "2 PAN 0,76"), price y unitPrice deben ser el precio unitario (0,38), qty=2.
Texto:
${ocrText}
${knownProds?' Conocidos: '+knownProds:''}`;

  const res=await fetch('https://api.groq.com/openai/v1/chat/completions',{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},
    body:JSON.stringify({
      model:'llama-3.1-8b-instant',
      messages:[{role:'user',content:prompt}],
      temperature:0.1,
      max_tokens:2048
    })
  });
  if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.error?.message||'Groq HTTP '+res.status);}
  const data=await res.json();
  const text=data.choices?.[0]?.message?.content||'';
  const clean=text.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
  try{return JSON.parse(clean);}
  catch{const m=clean.match(/\{[\s\S]*\}/);if(m)return JSON.parse(m[0]);throw new Error('JSON inválido de Groq');}
}

// ── PROCESS FILE ───────────────────────────────────────────────
async function processFile(file){
  showOCRLoading('Preparando imagen...');
  try{
    if(file.type==='application/pdf'){
      hideOCRLoading();
      showToast('Los PDFs no son compatibles. Usa el modo manual.',4000);
      openTicketEditor(getEmptyTicket());
      return;
    }

    setOCRStatus('Optimizando imagen...');
    const b64=await resizeForOCR(file);
    const sizeKB=Math.round(b64.length*0.75/1024);
    console.log('Imagen lista:', sizeKB, 'KB');

    // ── PASO 1: OCR.space extrae texto ──
    let ocrText='';
    try{
      setOCRStatus('Leyendo ticket...');
      ocrText=await googleVisionExtract(b64);
      // Rastrear uso Vision localmente
      if(!DB.visionStats) DB.visionStats={calls:0,firstCall:null};
      DB.visionStats.calls=(DB.visionStats.calls||0)+1;
      if(!DB.visionStats.firstCall) DB.visionStats.firstCall=new Date().toISOString().slice(0,10);
      S.set('visionStats',JSON.stringify(DB.visionStats));
      // Debug: guardar último OCR raw para diagnóstico
      S.set('lastOCR',ocrText.slice(0,3000));
    }catch(ocrErr){
      console.warn('Google Vision falló:', ocrErr.message);
      setOCRStatus('Vision falló...');
    }

    let result;

    if(ocrText){
      // ── PASO 2: Parser local ──
      setOCRStatus('Interpretando ticket...');
      result=parseTicketText(ocrText);
      console.log('Parser local:', result.products.length, 'productos');

      // ── PASO 3: Si el parser saca pocos productos, mejora con Groq ──
      if(result.products.length<1&&DB.groqKey){
        setOCRStatus('Mejorando con IA...');
        try{
          const groqResult=await groqParseText(ocrText);
          if(groqResult.products?.length>result.products.length){
            result.products=groqResult.products.map(p=>({...p,unitPrice:p.unitPrice||p.price,finalPrice:parseFloat(((p.unitPrice||p.price)*(p.qty||1)).toFixed(2))}));
          }
          if(groqResult.store) result.store=groqResult.store;
          if(groqResult.date) result.date=groqResult.date;
          if(groqResult.time) result.time=groqResult.time;
          if(groqResult.total&&groqResult.total>0){const gt=typeof groqResult.total==='string'?parseFloat(groqResult.total.replace(',','.')):groqResult.total;if(gt>0)result.total=gt;}
          if(groqResult.last4&&!result.last4) result.last4=groqResult.last4; // no sobreescribir last4 local
          console.log('Groq mejoró a:', result.products.length, 'productos');
        }catch(groqErr){
          console.warn('Groq fallback falló:', groqErr.message);
          result.warnings.push('IA no disponible: '+groqErr.message);
        }
      }
    } else {
      hideOCRLoading();
      showToast('No se pudo leer el ticket. Inténtalo manualmente.',4000);
      openTicketEditor(getEmptyTicket());
      return;
    }

    // ── Enriquecer con conocimiento previo ──
    result.products=(result.products||[]).map(p=>applyKnowledgeToProduct(p));
    result.type='ticket';
    result.id=uid();
    result.payer=DB.persons[0].id;
    result.confirmed=false;
    result.createdAt=new Date().toISOString();
    if(result.last4&&DB.knowledge.cards[result.last4])
      result.payer=DB.knowledge.cards[result.last4];

    hideOCRLoading();
    openTicketEditor(result);

  }catch(err){
    hideOCRLoading();
    showToast('Error: '+err.message,5000);
    console.error('processFile error:',err);
    openTicketEditor(getEmptyTicket());
  }
}

function applyKnowledgeToProduct(prod){
  const rawNorm=normalizeKey(prod.rawName||'');
  const nameNorm=normalizeKey(prod.name||'');
  const rawUpper=(prod.rawName||'').trim().toUpperCase();
  const nameUpper=(prod.name||'').trim().toUpperCase();

  // Buscar en todos los órdenes de prioridad
  let match=
    DB.knowledge.products[rawNorm] ||          // por rawName normalizado (índice directo)
    DB.knowledge.products[nameNorm] ||         // por nombre normalizado
    Object.values(DB.knowledge.products).find(v=>  // por ocr_raw
      v.ocr_raw&&(v.ocr_raw.includes(rawUpper)||v.ocr_raw.includes(nameUpper))
    ) ||
    Object.values(DB.knowledge.products).find(v=>  // por alias normalizado
      v.alias&&(normalizeKey(v.alias)===rawNorm||normalizeKey(v.alias)===nameNorm)
    );

  if(match){
    prod.assignedTo=match.shared?null:match.person;
    prod.shared=!!match.shared;
    prod.pct1=match.pct1||50;
    prod.knownMatch=true;
    if(match.alias&&match.alias!==prod.name) prod.name=match.alias;
  } else {
    prod.assignedTo=null;prod.shared=true;prod.pct1=50;
  }
  prod.finalPrice=prod.finalPrice??prod.price;
  return prod;
}

function getEmptyTicket(){
  return{id:uid(),type:'ticket',store:'',date:new Date().toISOString().slice(0,10),total:0,last4:null,payer:DB.persons[0].id,products:[],errors:[],warnings:[],confirmed:false,createdAt:new Date().toISOString()};
}

// ── FILE INPUTS ────────────────────────────────────────────────
document.getElementById('file-input').addEventListener('change',function(){if(this.files[0])processFile(this.files[0]);this.value='';});
document.getElementById('camera-input').addEventListener('change',function(){if(this.files[0])processFile(this.files[0]);this.value='';});
function triggerCamera(){document.getElementById('camera-input').click();}
function triggerFileGallery(){
  // Nota iOS: el sistema siempre muestra menú Fotos/Archivos/Cámara — es comportamiento nativo.
  // Elegir "Fotos" en ese menú abre la fototeca. No es posible saltarse el menú desde una PWA.
  document.getElementById('file-input').click();
}

// ── HOME ───────────────────────────────────────────────────────
function renderHome(){
  const bal=calcBalance();
  const recent=[...DB.tickets,...DB.expenses].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,6);
  document.getElementById('view').innerHTML=`
    <div class="screen-header">
      <div style="display:flex;align-items:flex-end;gap:12px">
        <img src="icon.png" style="width:44px;height:44px;border-radius:12px;object-fit:cover;filter:invert(1) brightness(0.87) saturate(0.15) hue-rotate(210deg)" onerror="this.style.display='none'"/>
        <h1 style="padding-bottom:2px">Clarito</h1>
      </div>
    </div>
    <div class="balance-hero">
      <div class="balance-hero-label">Balance actual</div>
      ${bal.amount<0.01
        ?`<div class="balance-hero-amount" style="color:var(--green)">Cuentas al día</div>`
        :`<div class="balance-hero-amount" style="color:var(--amber)">${fmt(bal.amount)}</div>
          <div style="font-size:13px;color:var(--txt1);margin-top:4px">${personName(bal.owes)} debe a ${personName(bal.owes===DB.persons[0].id?DB.persons[1]?.id:DB.persons[0].id)}</div>`}
      <div style="margin-top:14px;border-top:1px solid rgba(255,255,255,.08);padding-top:14px">
        ${DB.persons.map(p=>`<div class="person-row"><div class="person-dot" style="background:${p.color}"></div><div class="person-name">${p.name}</div><div class="person-amount">${fmt(bal.paid[p.id]||0)}</div></div>`).join('')}
      </div>
    </div>
    <div class="quick-actions">
      <button class="qa-btn" onclick="showScreen('tickets')">
        <svg viewBox="0 0 24 24" fill="none"><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
        <span>Subir ticket</span>
      </button>
      <button class="qa-btn" onclick="openManualExpense()">
        <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
        <span>Gasto manual</span>
      </button>
      <button class="qa-btn" onclick="showScreen('stats')">
        <svg viewBox="0 0 24 24" fill="none"><rect x="18" y="3" width="4" height="18"/><rect x="10" y="8" width="4" height="13"/><rect x="2" y="13" width="4" height="8"/></svg>
        <span>Estadísticas</span>
      </button>
      <button class="qa-btn" onclick="showScreen('balance')">
        <svg viewBox="0 0 24 24" fill="none"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
        <span>Balance</span>
      </button>
    </div>
    <div class="recent-label">Últimas actividades</div>
    ${recent.length===0
      ?`<div class="empty-state"><svg viewBox="0 0 24 24" fill="none"><rect x="2" y="3" width="20" height="18" rx="2"/></svg><h3>Sin actividad todavía</h3><p>Sube tu primer ticket o añade un gasto manual</p></div>`
      :recent.map(renderTicketListItem).join('')}
    ${renderPredictionsWidget()}`;
}

function renderTicketListItem(t){
  const payer=personById(t.payer);
  const color=payer?.color||'#888';
  return`<div class="ticket-item" onclick="editItem('${t.id}')">
    <div class="ticket-icon" style="background:${color}22"><svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.7"><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="8" y1="8" x2="16" y2="8"/></svg></div>
    <div class="ticket-info"><div class="ticket-store">${t.store||t.category||t.description||'Gasto'}</div><div class="ticket-date">${fmtDate(t.date)}</div></div>
    <div><div class="ticket-amount">${fmt(t.total)}</div><div class="ticket-payer">${payer?.name||''}</div></div>
  </div>`;
}

function renderPredictionsWidget(){
  const preds=getPredictions().slice(0,2);
  if(!preds.length) return'';
  return`<div class="recent-label" style="margin-top:8px">Previsiones</div>${preds.map(p=>`<div class="pred-card"><div class="pred-info"><div class="pred-name">${p.name}</div><div class="pred-detail">${p.detail}</div></div><div class="pred-days">~${p.days}d</div></div>`).join('')}`;
}

// ── BALANCE CALC ───────────────────────────────────────────────
function calcBalance(){
  const paid={},owedTo={};
  DB.persons.forEach(p=>{paid[p.id]=0;owedTo[p.id]=0;});
  DB.tickets.filter(t=>t.confirmed&&!t.settled).forEach(t=>{
    const pid=t.payer;
    (t.products||[]).forEach(prod=>{
      const price=parseFloat(prod.finalPrice||prod.price||0);
      if(isNaN(price)||price<=0) return;
      paid[pid]=(paid[pid]||0)+price;
      if(prod.assignedTo){
        if(prod.assignedTo!==pid) owedTo[pid]=(owedTo[pid]||0)+price;
      }else{
        DB.persons.forEach(p=>{
          if(p.id===pid) return;
          const pct=p.id===DB.persons[0].id?(prod.pct1||50):100-(prod.pct1||50);
          owedTo[pid]=(owedTo[pid]||0)+price*pct/100;
        });
      }
    });
  });
  DB.expenses.filter(e=>e.confirmed&&!e.settled).forEach(e=>{
    const amt=parseFloat(e.total||0);if(isNaN(amt)||amt<=0) return;
    const pid=e.payer;
    paid[pid]=(paid[pid]||0)+amt;
    DB.persons.forEach((p,i)=>{
      if(p.id===pid) return;
      const pct=i===0?e.split1:100-e.split1;
      owedTo[pid]=(owedTo[pid]||0)+amt*(pct||50)/100;
    });
  });
  let owes=null,amount=0;
  if(DB.persons.length>=2){
    const n=(owedTo[DB.persons[0].id]||0)-(owedTo[DB.persons[1].id]||0);
    if(n>0.005){owes=DB.persons[1].id;amount=n;}
    else if(n<-0.005){owes=DB.persons[0].id;amount=-n;}
  }
  return{paid,owes,amount};
}

// ── TICKETS SCREEN ─────────────────────────────────────────────
function renderTickets(){
  const tickets=DB.tickets.slice().reverse();
  document.getElementById('view').innerHTML=`
    <div class="screen-header"><h1>Tickets</h1><p>${tickets.length} registrados</p></div>
    <div class="upload-zone" onclick="triggerFileGallery()">
      <svg viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="20" height="20" rx="3"/><polyline points="12 8 12 16"/><polyline points="8 12 12 8 16 12"/></svg>
      <h3>Subir ticket</h3>
    </div>
    <div class="upload-actions">
      <button class="btn-secondary" onclick="triggerCamera()">Cámara</button>
      <button class="btn-secondary" onclick="openManualTicket()">Manual</button>
    </div>
    <div style="height:16px"></div>
    ${tickets.length===0
      ?`<div class="empty-state"><svg viewBox="0 0 24 24" fill="none"><rect x="2" y="3" width="20" height="18" rx="2"/></svg><h3>Sin tickets todavía</h3><p>Sube una foto para empezar</p></div>`
      :tickets.map(renderTicketListItem).join('')}`;
  const zone=document.querySelector('.upload-zone');
  if(zone){
    zone.addEventListener('dragover',e=>{e.preventDefault();zone.classList.add('drag')});
    zone.addEventListener('dragleave',()=>zone.classList.remove('drag'));
    zone.addEventListener('drop',e=>{e.preventDefault();zone.classList.remove('drag');if(e.dataTransfer.files[0])processFile(e.dataTransfer.files[0]);});
  }
}

// ── TICKET EDITOR ──────────────────────────────────────────────
let currentTicket=null;
function openTicketEditor(ticket){currentTicket=JSON.parse(JSON.stringify(ticket));renderTicketEditor();document.getElementById('ticket-editor').style.display='flex';}

function renderTicketEditor(){
  const t=currentTicket;
  const errorsHtml=[...(t.errors||[]),...(t.warnings||[])].map(e=>`<div class="error-chip">${e}<button onclick="dismissErrors()">Ignorar</button></div>`).join('');
  const payerBtns=DB.persons.map(p=>`<button onclick="setTicketPayer('${p.id}')" style="padding:8px 12px;border-radius:var(--rad-xs);font-size:13px;font-weight:600;background:${t.payer===p.id?p.color+'33':'var(--bg3)'};color:${t.payer===p.id?p.color:'var(--txt1)'};border:1.5px solid ${t.payer===p.id?p.color:'var(--brd)'};">${p.name}</button>`).join('');
  document.getElementById('ticket-editor').innerHTML=`
    <div class="te-header">
      <button onclick="closeTicketEditor()" style="color:var(--txt1)"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      <h2>Revisar ticket</h2>
      <button onclick="deleteCurrentTicket()" style="color:var(--red);font-size:13px">Eliminar</button>
    </div>
    <div class="te-body">
      ${errorsHtml?`<div class="te-section">${errorsHtml}</div>`:''}
      <div class="te-section">
        <div class="te-section-title">Información</div>
        <div class="card" style="margin:0 0 12px">
          <div class="field-row"><label class="field-label">Supermercado</label><input value="${t.store||''}" placeholder="Ej: Mercadona" oninput="currentTicket.store=this.value"/></div>
          <div class="datetime-row">
            <div><label class="field-label">Fecha</label><input type="date" value="${t.date||''}" onchange="currentTicket.date=this.value" style="font-size:15px"/></div>
            <div><label class="field-label">Hora</label><input type="time" value="${t.time||''}" onchange="currentTicket.time=this.value" style="font-size:15px"/></div>
          </div>
          <div class="field-row" style="margin-top:10px"><label class="field-label">Total</label><input type="text" inputmode="decimal" value="${t.total!=null?(+t.total).toFixed(2):''}" placeholder="0.00" oninput="currentTicket.total=parseFloat(this.value.replace(',','.'))||0"/></div>
          <div class="field-row" style="margin-top:10px"><label class="field-label">Últimos 4 dígitos tarjeta</label><input value="${t.last4||''}" placeholder="4821" maxlength="4" oninput="currentTicket.last4=this.value" style="letter-spacing:3px;font-weight:400"/></div>
        </div>
      </div>
      <div class="te-section">
        <div class="te-section-title">¿Quién pagó?</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:4px">${payerBtns}</div>
      </div>
      <div class="te-section">
        <div class="te-section-title">Productos (${(t.products||[]).length})</div>
        <div id="products-list">${(t.products||[]).map((p,i)=>renderProductRow(p,i)).join('')}</div>
        <button class="btn-ghost" style="margin-top:6px;width:100%;text-align:center" onclick="addEmptyProduct()">+ Añadir producto</button>
      </div>
      <div style="height:20px"></div>
    </div>
    <div class="te-footer">
      <button class="btn-secondary" style="flex:1" onclick="closeTicketEditor()">Cancelar</button>
      <button class="btn-primary" style="flex:2" onclick="saveTicket()">Guardar</button>
    </div>`;
}

function parsePrice(v){return parseFloat(String(v).replace(',','.'))||0;}

function renderProductRow(prod,i){
  const confClass=prod.confidence>=0.85?'conf-high':prod.confidence>=0.6?'conf-mid':'conf-low';
  const assignedTo=prod.assignedTo;
  const isShared=!assignedTo;
  const qty=prod.qty||1;
  // unitPrice es el precio por unidad, finalPrice es el total (unitPrice * qty)
  const unitPrice=prod.unitPrice??prod.finalPrice??prod.price??0;
  const total=parseFloat((unitPrice*qty).toFixed(2));
  const unitDisplay=unitPrice>0?unitPrice.toFixed(2):'';

  const personBtns=DB.persons.map(p=>{
    const active=assignedTo===p.id;
    return`<button class="assign-btn" style="background:${active?p.color+'33':'transparent'};color:${active?p.color:'var(--txt2)'};border-color:${active?p.color:'var(--brd)'};" onclick="assignProduct(${i},'${p.id}')">${p.name}</button>`;
  }).join('');

  return`<div class="product-row" id="prod-${i}">
    <div class="product-top">
      <div class="confidence-dot ${confClass}"></div>
      <div class="product-name-wrap">
        <input value="${prod.name||''}" style="background:transparent;border:none;padding:0;font-size:14px;font-weight:500;color:var(--txt0);width:100%" oninput="currentTicket.products[${i}].name=this.value" placeholder="Nombre del producto"/>
        ${prod.rawName&&prod.rawName!==prod.name?`<div class="product-name-raw">${prod.rawName}</div>`:''}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">
        <div style="display:flex;align-items:center;gap:4px">
          <span style="font-size:11px;color:var(--txt2)">u/</span>
          <input class="product-price-input"
            value="${unitDisplay}"
            placeholder="0,00"
            inputmode="decimal"
            style="width:64px"
            onfocus="if(this.value==='0.00'||this.value==='0,00')this.value=''"
            onblur="if(!this.value)this.value='0.00';updateUnitPrice(${i},this.value)"
            oninput="updateUnitPrice(${i},this.value)"/>
        </div>
        <div style="display:flex;align-items:center;gap:4px">
          <button onclick="changeQty(${i},-1)" style="width:22px;height:22px;border-radius:50%;background:var(--bg4);color:var(--txt1);font-size:14px;line-height:1;display:flex;align-items:center;justify-content:center">−</button>
          <span id="qty-${i}" style="font-size:12px;color:var(--txt2);min-width:20px;text-align:center">${qty}×</span>
          <button onclick="changeQty(${i},1)" style="width:22px;height:22px;border-radius:50%;background:var(--bg4);color:var(--txt1);font-size:14px;line-height:1;display:flex;align-items:center;justify-content:center">+</button>
          <span id="total-${i}" style="font-size:12px;font-weight:700;color:var(--txt0);min-width:38px;text-align:right">${total>0?total.toFixed(2)+' €':''}</span>
        </div>
      </div>
    </div>
    <div class="product-bottom">
      ${personBtns}
      <button class="assign-btn" style="background:${isShared?'rgba(74,158,255,.15)':'transparent'};color:${isShared?'#4a9eff':'var(--txt2)'};border-color:${isShared?'#4a9eff':'var(--brd)'};" onclick="assignProduct(${i},null)">Común</button>
      ${isShared?`<button class="pct-badge active" onclick="editSplit(${i})">%</button>`:''}
      <button onclick="removeProduct(${i})" style="margin-left:auto;color:var(--txt3);font-size:20px;line-height:1">×</button>
    </div>
  </div>`;
}

function assignProduct(i,pid){currentTicket.products[i].assignedTo=pid;currentTicket.products[i].shared=!pid;renderProductsList();}
function updateUnitPrice(i,val){
  const p=currentTicket.products[i];
  p.unitPrice=parsePrice(val);
  p.finalPrice=parseFloat((p.unitPrice*(p.qty||1)).toFixed(2));
  const el=document.getElementById('total-'+i);
  if(el) el.textContent=p.finalPrice>0?p.finalPrice.toFixed(2)+' €':'';
}
function changeQty(i,delta){
  const p=currentTicket.products[i];
  p.qty=Math.max(1,(p.qty||1)+delta);
  p.finalPrice=parseFloat(((p.unitPrice??p.price??0)*(p.qty)).toFixed(2));
  const qEl=document.getElementById('qty-'+i);
  if(qEl) qEl.textContent=p.qty+'×';
  const tEl=document.getElementById('total-'+i);
  if(tEl) tEl.textContent=p.finalPrice>0?p.finalPrice.toFixed(2)+' €':'';
}
function renderProductsList(){const el=document.getElementById('products-list');if(el)el.innerHTML=(currentTicket.products||[]).map((p,i)=>renderProductRow(p,i)).join('');}
function editSplit(i){
  const prod=currentTicket.products[i];
  const p1=DB.persons[0],p2=DB.persons[1]||DB.persons[0];
  openModal(`<div class="modal-title">Reparto de "${prod.name}"</div>
    <div class="split-row" style="margin-bottom:16px">
      <div class="split-person"><div style="font-size:12px;color:var(--txt2)">${p1.name}</div><div class="split-pct" id="sp1" style="color:${p1.color}">${prod.pct1||50}%</div></div>
      <input type="range" class="split-slider" min="0" max="100" value="${prod.pct1||50}" oninput="updateSplitPreview(this.value)" id="split-range"/>
      <div class="split-person"><div style="font-size:12px;color:var(--txt2)">${p2.name}</div><div class="split-pct" id="sp2" style="color:${p2.color}">${100-(prod.pct1||50)}%</div></div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:14px">
      <button class="btn-secondary" style="flex:1;font-size:13px" onclick="setQuickSplit(50)">50/50</button>
      <button class="btn-secondary" style="flex:1;font-size:13px" onclick="setQuickSplit(70)">70/30</button>
      <button class="btn-secondary" style="flex:1;font-size:13px" onclick="setQuickSplit(30)">30/70</button>
    </div>
    <button class="btn-primary" onclick="saveSplit(${i})">Aplicar</button>`);
}
function updateSplitPreview(v){document.getElementById('sp1').textContent=parseInt(v)+'%';document.getElementById('sp2').textContent=(100-parseInt(v))+'%';}
function setQuickSplit(v){document.getElementById('split-range').value=v;updateSplitPreview(v);}
function saveSplit(i){currentTicket.products[i].pct1=parseInt(document.getElementById('split-range').value);closeModal();renderProductsList();}
function removeProduct(i){currentTicket.products.splice(i,1);renderProductsList();}
function addEmptyProduct(){currentTicket.products.push({rawName:'',name:'',price:0,finalPrice:0,qty:1,confidence:1,category:'otro',assignedTo:null,shared:true,pct1:50});renderProductsList();setTimeout(()=>{const l=document.querySelectorAll('.product-row');if(l.length)l[l.length-1].scrollIntoView({behavior:'smooth'});},100);}
function setTicketPayer(id){currentTicket.payer=id;if(currentTicket.last4)DB.knowledge.cards[currentTicket.last4]=id;renderTicketEditor();}
function dismissErrors(){currentTicket.errors=[];currentTicket.warnings=[];renderTicketEditor();}
function saveTicket(){
  const t=currentTicket;t.confirmed=true;
  if(!t.total||t.total===0) t.total=(t.products||[]).reduce((s,p)=>s+parseFloat(p.finalPrice||p.price||0),0);
  learnFromTicket(t);
  const idx=DB.tickets.findIndex(x=>x.id===t.id);
  if(idx>=0) DB.tickets[idx]=t; else DB.tickets.push(t);
  saveDB();
  closeTicketEditor();showToast('Ticket guardado');showScreen(currentScreen==='tickets'?'tickets':'home');
}
function learnFromTicket(t){
  if(t.last4&&t.payer){
    DB.knowledge.cards[t.last4]=t.payer;
    const person=personById(t.payer);
    if(person){
      if(!person.cards) person.cards=[];
      if(!person.cards.includes(t.last4)) person.cards.push(t.last4);
    }
  }
  (t.products||[]).forEach(prod=>{
    const key=normalizeKey(prod.name||'');if(!key) return;
    const ocrRaw=(prod.rawName||'').trim().toUpperCase();
    const ex=DB.knowledge.products[key]||{count:0,ocr_raw:[]};
    // Actualizar entrada principal (clave = nombre normalizado actual)
    DB.knowledge.products[key]={
      person:prod.assignedTo||null,
      shared:!prod.assignedTo,
      pct1:prod.pct1||50,
      count:(ex.count||0)+1,
      category:prod.category,
      alias:prod.name,
      ocr_raw:ocrRaw&&!(ex.ocr_raw||[]).includes(ocrRaw)?[...(ex.ocr_raw||[]),ocrRaw]:(ex.ocr_raw||[])
    };
    // Guardar también índice por rawName normalizado para búsqueda inversa
    const rawKey=normalizeKey(ocrRaw);
    if(rawKey&&rawKey!==key){
      DB.knowledge.products[rawKey]={
        ...(DB.knowledge.products[rawKey]||{}),
        person:prod.assignedTo||null,
        shared:!prod.assignedTo,
        pct1:prod.pct1||50,
        alias:prod.name,
        ocr_raw:[ocrRaw]
      };
    }
  });
}
function closeTicketEditor(){document.getElementById('ticket-editor').style.display='none';currentTicket=null;}
function deleteCurrentTicket(){if(!currentTicket) return;DB.tickets=DB.tickets.filter(t=>t.id!==currentTicket.id);saveDB();closeTicketEditor();showToast('Ticket eliminado');showScreen(currentScreen);}
function openManualTicket(){openTicketEditor(getEmptyTicket());}
function editItem(id){const t=DB.tickets.find(x=>x.id===id);if(t){openTicketEditor(t);return;}const e=DB.expenses.find(x=>x.id===id);if(e) openExpenseEditor(e);}

// ── MANUAL EXPENSE ─────────────────────────────────────────────
let currentExpense=null;
const EXPENSE_CATS=[
  {id:'alquiler',label:'Alquiler',emoji:''},{id:'suministros',label:'Luz/Agua/Gas',emoji:''},
  {id:'internet',label:'Internet',emoji:''},{id:'suscripciones',label:'Suscripciones',emoji:''},
  {id:'restaurantes',label:'Restaurantes',emoji:''},{id:'transporte',label:'Transporte',emoji:''},
  {id:'ocio',label:'Ocio',emoji:''},{id:'salud',label:'Salud',emoji:''},
  {id:'ropa',label:'Ropa',emoji:''},{id:'hogar',label:'Hogar',emoji:''},
  {id:'mascotas',label:'Mascotas',emoji:''},{id:'otro',label:'Otro',emoji:''},
];
function openManualExpense(){currentExpense={id:uid(),type:'expense',store:'',category:'hogar',description:'',total:0,payer:DB.persons[0].id,date:new Date().toISOString().slice(0,10),split1:50,confirmed:false,createdAt:new Date().toISOString()};renderManualExpenseSheet();document.getElementById('me-sheet').style.display='flex';}
function openExpenseEditor(exp){currentExpense=JSON.parse(JSON.stringify(exp));renderManualExpenseSheet();document.getElementById('me-sheet').style.display='flex';}
function renderManualExpenseSheet(){
  const e=currentExpense;
  const catBtns=EXPENSE_CATS.map(c=>`<button onclick="setExpenseCat('${c.id}')" style="padding:7px 11px;border-radius:var(--rad-xs);font-size:12px;background:${e.category===c.id?'var(--accent)33':'var(--bg3)'};color:${e.category===c.id?'var(--accent)':'var(--txt1)'};border:1px solid ${e.category===c.id?'var(--accent)':'var(--brd)'};">${c.label}</button>`).join('');
  const payerBtns=DB.persons.map(p=>`<button onclick="setExpensePayer('${p.id}')" style="flex:1;padding:10px;border-radius:var(--rad-xs);font-size:13px;font-weight:600;background:${e.payer===p.id?p.color+'33':'var(--bg3)'};color:${e.payer===p.id?p.color:'var(--txt1)'};border:1.5px solid ${e.payer===p.id?p.color:'var(--brd)'};">${p.name}</button>`).join('');
  const p1=DB.persons[0],p2=DB.persons[1]||DB.persons[0];
  document.getElementById('me-sheet').innerHTML=`
    <div class="me-header">
      <button onclick="closeManualExpense()" style="color:var(--txt1)"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      <h2>Gasto manual</h2>
      ${currentExpense.confirmed?`<button onclick="deleteExpense()" style="color:var(--red);font-size:13px">Eliminar</button>`:'<div style="width:60px"></div>'}
    </div>
    <div class="me-body">
      <div class="field-row"><label class="field-label">Importe</label><input type="number" value="${e.total||''}" placeholder="0,00" step="0.01" style="font-size:28px;font-weight:800;text-align:center" oninput="currentExpense.total=parseFloat(this.value)||0"/></div>
      <div class="field-row"><label class="field-label">Descripción</label><input value="${e.description||''}" placeholder="Ej: Alquiler julio" oninput="currentExpense.description=this.value"/></div>
      <div class="field-row"><label class="field-label">Categoría</label><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">${catBtns}</div></div>
      <div class="field-row"><label class="field-label">Fecha</label><input type="date" value="${e.date||''}" onchange="currentExpense.date=this.value"/></div>
      <div class="field-row"><label class="field-label">¿Quién pagó?</label><div style="display:flex;gap:8px;flex-wrap:wrap">${payerBtns}</div></div>
      <div class="field-row">
        <label class="field-label">Reparto</label>
        <div class="split-row" style="margin-top:8px">
          <div class="split-person"><div style="font-size:12px;color:var(--txt2)">${p1.name}</div><div class="split-pct" id="me-sp1" style="color:${p1.color}">${e.split1||50}%</div></div>
          <input type="range" class="split-slider" min="0" max="100" value="${e.split1||50}" id="me-split-range" oninput="updateMeSplit(this.value)"/>
          <div class="split-person"><div style="font-size:12px;color:var(--txt2)">${p2.name}</div><div class="split-pct" id="me-sp2" style="color:${p2.color}">${100-(e.split1||50)}%</div></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button class="btn-secondary" style="flex:1;font-size:12px" onclick="setMeQuickSplit(50)">50/50</button>
          <button class="btn-secondary" style="flex:1;font-size:12px" onclick="setMeQuickSplit(70)">70/30</button>
          <button class="btn-secondary" style="flex:1;font-size:12px" onclick="setMeQuickSplit(30)">30/70</button>
        </div>
      </div>
    </div>
    <div class="me-footer"><button class="btn-primary" onclick="saveManualExpense()">Guardar gasto</button></div>`;
}
function setExpenseCat(c){currentExpense.category=c;renderManualExpenseSheet();}
function setExpensePayer(id){currentExpense.payer=id;renderManualExpenseSheet();}
function updateMeSplit(v){currentExpense.split1=parseInt(v);document.getElementById('me-sp1').textContent=v+'%';document.getElementById('me-sp2').textContent=(100-parseInt(v))+'%';}
function setMeQuickSplit(v){currentExpense.split1=v;document.getElementById('me-split-range').value=v;updateMeSplit(v);}
function saveManualExpense(){
  if(!currentExpense.total||currentExpense.total<=0){showToast('Introduce un importe');return;}
  currentExpense.confirmed=true;currentExpense.store=currentExpense.description||(EXPENSE_CATS.find(c=>c.id===currentExpense.category)||{}).label||'Gasto';
  const idx=DB.expenses.findIndex(e=>e.id===currentExpense.id);
  if(idx>=0) DB.expenses[idx]=currentExpense; else DB.expenses.push(currentExpense);
  saveDB();closeManualExpense();showToast('Gasto guardado');showScreen(currentScreen);
}
function deleteExpense(){DB.expenses=DB.expenses.filter(e=>e.id!==currentExpense.id);saveDB();closeManualExpense();showToast('Gasto eliminado');showScreen(currentScreen);}
function closeManualExpense(){document.getElementById('me-sheet').style.display='none';currentExpense=null;}

// ── BALANCE SCREEN ─────────────────────────────────────────────
function renderBalance(){
  const {paid,owes,amount}=calcBalance();
  const creditor=owes?DB.persons.find(p=>p.id!==owes):null;
  const settlements=DB.settlements.slice().reverse();
  document.getElementById('view').innerHTML=`
    <div class="screen-header"><h1>Balance</h1><p>Deudas y liquidaciones</p></div>
    ${amount<0.01
      ?`<div class="balance-card"><div class="bc-owes settled">Cuentas al día</div><div class="bc-amount" style="font-size:28px;color:var(--green)">Sin deuda</div></div>`
      :`<div class="balance-card"><div class="bc-owes">${personName(owes)} debe a ${creditor?.name}</div><div class="bc-amount">${fmt(amount)}</div></div>
        <button class="settle-btn" onclick="settleAccounts()">Cuentas saldadas</button>`}
    <div style="margin:0 16px 14px;display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px">
      ${DB.persons.map(p=>`<div class="stat-card"><div class="stat-label" style="color:${p.color}">${p.name}</div><div class="stat-value" style="color:${p.color}">${fmt(paid[p.id]||0)}</div></div>`).join('')}
    </div>
    <div class="recent-label">Historial</div>
    ${settlements.length===0
      ?`<div class="empty-state" style="padding:30px"><p>Sin liquidaciones todavía</p></div>`
      :settlements.map(s=>`<div class="history-settle"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg><div class="settle-date">${fmtDate(s.date)}</div><div class="settle-info">${s.msg}</div></div>`).join('')}`;
}
function settleAccounts(){
  const {owes,amount}=calcBalance();
  if(amount<0.01){showToast('No hay deuda que saldar');return;}
  openModal(`<div class="modal-title">¿Saldar cuentas?</div>
    <p style="font-size:14px;color:var(--txt1);margin-bottom:20px">Se registrará la liquidación a día de hoy.</p>
    <div style="display:flex;gap:10px"><button class="btn-secondary" style="flex:1" onclick="closeModal()">Cancelar</button><button class="btn-primary" style="flex:2" onclick="confirmSettle()">Confirmar</button></div>`);
}
function confirmSettle(){
  const {owes,amount}=calcBalance();
  const creditor=DB.persons.find(p=>p.id!==owes);
  DB.settlements.push({id:uid(),date:new Date().toISOString(),msg:`${personName(owes)} pagó ${fmt(amount)} a ${creditor?.name}`,amount,owes});
  DB.tickets.forEach(t=>{if(t.confirmed)t.settled=true;});
  DB.expenses.forEach(e=>{if(e.confirmed)e.settled=true;});
  saveDB();closeModal();showToast('Cuentas saldadas',3000);renderBalance();
}

// ── STATS ──────────────────────────────────────────────────────
function renderStats(){
  const now=new Date();
  const thisMonth=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const allT=DB.tickets.filter(t=>t.confirmed);
  const monthStart=thisMonth+'-01';
  const monthEnd=new Date(now.getFullYear(),now.getMonth()+1,0).toISOString().slice(0,10);
  const monthT=allT.filter(t=>t.date&&t.date>=monthStart&&t.date<=monthEnd);
  const monthTotal=monthT.reduce((s,t)=>s+(parseFloat(t.total)||0),0);

  // Gasto real por persona este mes:
  // - Lo que pagaron de su bolsillo (total del ticket si son el pagador)
  // - Su parte proporcional de los gastos comunes
  // - Sus gastos asignados directamente
  const monthByPerson={}; // parte que les corresponde pagar
  const monthPaidOut={}; // lo que realmente pagaron en caja
  DB.persons.forEach(p=>{monthByPerson[p.id]=0;monthPaidOut[p.id]=0;});

  monthT.forEach(t=>{
    // Lo que pagó en caja el pagador
    monthPaidOut[t.payer]=(monthPaidOut[t.payer]||0)+(parseFloat(t.total)||0);
    // Lo que le corresponde a cada uno
    (t.products||[]).forEach(prod=>{
      const price=parseFloat(prod.finalPrice||prod.price||0);
      if(!price) return;
      if(prod.assignedTo){
        monthByPerson[prod.assignedTo]=(monthByPerson[prod.assignedTo]||0)+price;
      } else {
        DB.persons.forEach(p=>{
          const pct=p.id===DB.persons[0].id?(prod.pct1||50):100-(prod.pct1||50);
          monthByPerson[p.id]=(monthByPerson[p.id]||0)+price*pct/100;
        });
      }
    });
  });
  DB.expenses.filter(e=>e.confirmed&&e.date&&e.date>=monthStart&&e.date<=monthEnd).forEach(e=>{
    const amt=parseFloat(e.total||0);
    monthPaidOut[e.payer]=(monthPaidOut[e.payer]||0)+amt;
    DB.persons.forEach((p,i)=>{
      const pct=i===0?e.split1:100-e.split1;
      monthByPerson[p.id]=(monthByPerson[p.id]||0)+amt*(pct||50)/100;
    });
  });

  // Categorías (todo el tiempo)
  const catMap={};
  allT.forEach(t=>(t.products||[]).forEach(p=>{const c=p.category||'otro';catMap[c]=(catMap[c]||0)+parseFloat(p.finalPrice||p.price||0);}));
  DB.expenses.filter(e=>e.confirmed).forEach(e=>{const c=e.category||'otro';catMap[c]=(catMap[c]||0)+parseFloat(e.total||0);});
  const catSorted=Object.entries(catMap).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const catMax=catSorted[0]?catSorted[0][1]:1;

  // Supermercados
  const storeMap={};
  allT.forEach(t=>{if(t.store)storeMap[t.store]=(storeMap[t.store]||0)+(parseFloat(t.total)||0);});
  const storeSorted=Object.entries(storeMap).sort((a,b)=>b[1]-a[1]).slice(0,5);

  // Productos más comprados
  const prodCount={};
  allT.forEach(t=>(t.products||[]).forEach(p=>{
    const k=p.name||p.rawName||'';if(!k)return;
    prodCount[k]=(prodCount[k]||0)+(p.qty||1);
  }));
  const topProds=Object.entries(prodCount).sort((a,b)=>b[1]-a[1]).slice(0,6);

  const anomalies=detectAnomalies();

  document.getElementById('view').innerHTML=`
    <div class="screen-header"><h1>Estadísticas</h1><p>Análisis del hogar</p></div>

    <div class="stats-grid" style="margin-top:16px">
      <div class="stat-card"><div class="stat-label">Este mes total</div><div class="stat-value">${fmt(monthTotal)}</div></div>
      <div class="stat-card"><div class="stat-label">Tickets totales</div><div class="stat-value">${allT.length}</div></div>
    </div>

    <div class="recent-label">Gasto este mes por persona</div>
    <div style="margin:0 16px 14px;display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px">
      ${DB.persons.map(p=>`
        <div class="stat-card" style="border-color:${p.color}33">
          <div class="stat-label" style="color:${p.color}">${p.name}</div>
          <div class="stat-value" style="color:${p.color};font-size:18px">${fmt(monthByPerson[p.id]||0)}</div>
          <div style="font-size:11px;color:var(--txt2);margin-top:4px">Pagó en caja: ${fmt(monthPaidOut[p.id]||0)}</div>
        </div>`).join('')}
    </div>

    ${anomalies.length?`<div style="margin:0 16px 14px">${anomalies.map(a=>`<div style="background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.2);border-radius:var(--rad-sm);padding:10px 12px;margin-bottom:8px;font-size:13px;color:#f59e0b">${a}</div>`).join('')}</div>`:''}

    ${topProds.length?`<div class="recent-label">Productos más comprados</div><div class="bar-chart">${topProds.map(([name,qty])=>`<div class="bar-row" style="gap:8px"><div class="bar-name" style="width:130px">${name}</div><div class="bar-track" style="max-width:120px"><div class="bar-fill" style="width:${Math.round(qty/topProds[0][1]*100)}%;background:var(--accent)"></div></div><div class="bar-amt">${qty}x</div></div>`).join('')}</div>`:''}

    ${catSorted.length?`<div class="recent-label">Por categoría</div><div class="bar-chart">${catSorted.map(([cat,amt])=>{const ci=EXPENSE_CATS.find(c=>c.id===cat)||{label:cat};return`<div class="bar-row" style="gap:8px"><div class="bar-name" style="width:130px">${ci.label||cat}</div><div class="bar-track" style="max-width:120px"><div class="bar-fill" style="width:${Math.round(amt/catMax*100)}%;background:var(--accent)"></div></div><div class="bar-amt">${fmt(amt)}</div></div>`;}).join('')}</div>`:''}

    ${storeSorted.length?`<div class="recent-label">Por supermercado</div><div class="bar-chart">${storeSorted.map(([s,a],i)=>{const cols=['var(--accent)','var(--green)','var(--blue)','var(--amber)','var(--red)'];return`<div class="bar-row" style="gap:8px"><div class="bar-name" style="width:130px">${s}</div><div class="bar-track" style="max-width:120px"><div class="bar-fill" style="width:${Math.round(a/storeSorted[0][1]*100)}%;background:${cols[i]}"></div></div><div class="bar-amt">${fmt(a)}</div></div>`;}).join('')}</div>`:''}

    <div class="recent-label">Despensa estimada</div>${renderInventorySection()}`;
}
function detectAnomalies(){
  const now=new Date(),msgs=[];
  const thisT=DB.tickets.filter(t=>t.confirmed&&t.date&&new Date(t.date).getMonth()===now.getMonth());
  const lastT=DB.tickets.filter(t=>t.confirmed&&t.date&&new Date(t.date).getMonth()===(now.getMonth()-1+12)%12);
  const tT=thisT.reduce((s,t)=>s+parseFloat(t.total||0),0);
  const lT=lastT.reduce((s,t)=>s+parseFloat(t.total||0),0);
  if(lT>0&&tT>lT*1.3) msgs.push('Este mes gastáis un '+Math.round((tT/lT-1)*100)+'% más que el mes pasado.');
  return msgs;
}
function renderInventorySection(){
  const preds=getPredictions();
  if(!preds.length) return`<div class="empty-state" style="padding:20px"><p>Añade más tickets para estimar la despensa</p></div>`;
  return preds.slice(0,8).map(p=>{const pct=Math.max(0,Math.min(100,100-Math.round((p.days/p.freq)*100)));const col=pct<30?'var(--red)':pct<60?'var(--amber)':'var(--green)';return`<div class="inv-row"><div class="inv-name">${p.name}</div><div class="inv-bar-track"><div class="inv-bar-fill" style="width:${pct}%;background:${col}"></div></div><div class="inv-days">~${p.days}d</div></div>`;}).join('');
}
function getPredictions(){
  const ph={};
  DB.tickets.filter(t=>t.confirmed&&t.date).forEach(t=>{const d=new Date(t.date).getTime();(t.products||[]).forEach(p=>{const k=normalizeKey(p.name||'');if(!k)return;if(!ph[k])ph[k]={name:p.name,dates:[],category:p.category||'otro'};ph[k].dates.push(d);});});
  const now=Date.now();
  return Object.values(ph).filter(v=>v.dates.length>=2).map(item=>{item.dates.sort((a,b)=>a-b);const gaps=[];for(let i=1;i<item.dates.length;i++)gaps.push((item.dates[i]-item.dates[i-1])/864e5);const avgFreq=gaps.reduce((s,g)=>s+g,0)/gaps.length;const daysSince=(now-item.dates[item.dates.length-1])/864e5;const daysLeft=Math.max(0,Math.round(avgFreq-daysSince));return{name:item.name,days:daysLeft,freq:Math.round(avgFreq),detail:'Cada ~'+Math.round(avgFreq)+'d · hace '+Math.round(daysSince)+'d'};}).sort((a,b)=>a.days-b.days);
}

// ── SETTINGS ───────────────────────────────────────────────────
function renderSettings(){
  document.getElementById('view').innerHTML=`
    <div class="screen-header"><div style="display:flex;align-items:flex-end;gap:12px"><img src="icon.png" style="width:44px;height:44px;border-radius:12px;object-fit:cover;filter:invert(1) brightness(0.87) saturate(0.15) hue-rotate(210deg)" onerror="this.style.display='none'"/><h1 style="padding-bottom:2px">Configuración</h1></div></div>
    <div style="height:8px"></div>
    <div class="settings-section">
      <div class="settings-section-title">Personas (${DB.persons.length})</div>
      <div style="background:var(--bg1)">
        ${DB.persons.map((p,i)=>`<div class="settings-row" onclick="editPerson(${i})"><div class="settings-icon" style="background:${p.color}"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg></div><div class="settings-label">${p.name}</div><div class="settings-value">${p.cards.length} tarjeta(s)</div><div class="settings-arrow">›</div></div>`).join('')}
        <div class="settings-row" onclick="addPerson()"><div class="settings-icon" style="background:var(--bg4)"><svg viewBox="0 0 24 24" fill="none" stroke="var(--txt1)" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></div><div class="settings-label" style="color:var(--accent)">Añadir persona</div></div>
      </div>
    </div>
    <div class="settings-section">
      <div class="settings-section-title">APIs</div>
      <div style="background:var(--bg1)">
        <div class="settings-row" onclick="editVisionKey()"><div class="settings-icon" style="background:#1a3a2a"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 8h3M7 12h3M7 16h3M14 8h3M14 12h3M14 16h3"/></svg></div><div class="settings-label">Google Vision Key</div><div class="settings-value">${DB.visionKey?'•••'+DB.visionKey.slice(-4):'No configurada'}</div><div class="settings-arrow">›</div></div>
        ${DB.visionKey?('<div class="settings-row" onclick="showVisionStats()" style="cursor:pointer"><div class="settings-icon" style="background:#0a2a1a"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/></svg></div><div class="settings-label">Uso de Vision</div><div class="settings-value">'+(DB.visionStats?.calls||0)+' lecturas</div><div class="settings-arrow">›</div></div>'):''}
        <div class="settings-row" onclick="editGroqKey()"><div class="settings-icon" style="background:#2a1a3a"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div><div class="settings-label">Groq Key (chat IA)</div><div class="settings-value">${DB.groqKey?'•••'+DB.groqKey.slice(-4):'No configurada'}</div><div class="settings-arrow">›</div></div>
        ${DB.groqKey?('<div class="settings-row" onclick="showGroqStats()" style="cursor:pointer"><div class="settings-icon" style="background:#1a2a3a"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8"><polyline points=\'22 12 18 12 15 21 9 3 6 12 2 12\'/></svg></div><div class="settings-label">Uso de Groq</div><div class="settings-value">'+(DB.groqStats?.calls||0)+' llamadas · '+Math.round((DB.groqStats?.tokensUsed||0)/1000)+' k tokens</div><div class="settings-arrow">›</div></div>'):''}
      </div>
    </div>
    <div class="settings-section">
      <div class="settings-section-title">Tarjetas conocidas</div>
      <div style="background:var(--bg1)">
        ${Object.keys(DB.knowledge.cards).length===0
          ?`<div class="settings-row"><div class="settings-label" style="color:var(--txt2)">Sin tarjetas registradas</div></div>`
          :Object.entries(DB.knowledge.cards).map(([l4,pid])=>`<div class="settings-row"><div class="settings-icon" style="background:#1e3a5f"><svg viewBox="0 0 24 24" fill="none"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></div><div class="settings-label">•••• ${l4}</div><div class="settings-value" style="color:${personColor(pid)};font-weight:600">${personName(pid)}</div><button onclick="forgetCard('${l4}')" style="color:var(--red);font-size:20px">×</button></div>`).join('')}
      </div>
    </div>
    <div class="settings-section">
      <div class="settings-section-title">Datos</div>
      <div style="background:var(--bg1)">
        <div class="settings-row" onclick="editKnowledgeProducts()"><div class="settings-label">Productos aprendidos</div><div class="settings-value">${Object.keys(DB.knowledge.products).length}</div><div class="settings-arrow">›</div></div>
        <div class="settings-row" onclick="clearKnowledge()"><div class="settings-label" style="color:var(--red)">Borrar conocimiento IA</div></div>
        <div class="settings-row" onclick="exportData()"><div class="settings-label">Exportar JSON</div><div class="settings-arrow">↓</div></div>
        <div class="settings-row" onclick="resetAll()"><div class="settings-label" style="color:var(--red)">Borrar todos los datos</div></div>
      </div>
    </div>
    <div style="margin:0 16px 16px"><button class="btn-secondary" style="width:100%" onclick="location.reload()">Actualizar app</button></div>
    <p style="text-align:center;font-size:11px;color:var(--txt3);padding:20px">Clarito · Datos guardados localmente</p>`;
}

function editKnowledgeProducts(){
  const prods=Object.entries(DB.knowledge.products).sort((a,b)=>a[0].localeCompare(b[0]));
  if(!prods.length){showToast('No hay productos aprendidos todavía');return;}
  const personOpts=`<option value="">Común</option>`+DB.persons.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  const rows=prods.map(([key,v])=>`
    <div style="padding:10px 0;border-bottom:1px solid var(--brd)">
      <div style="font-size:10px;color:var(--txt3);margin-bottom:4px">Original: ${v.ocr_raw?.[0]||key}</div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <input value="${v.alias||key}"
          style="background:transparent;border:none;border-bottom:1px solid var(--brd);font-size:14px;font-weight:500;color:var(--txt0);flex:1;padding:2px 0"
          onchange="renameKnowledgeProduct('${key}',this.value)"/>
        <button onclick="deleteKnowledgeProduct('${key}')" style="color:var(--red);font-size:18px;flex-shrink:0">×</button>
      </div>
      <select onchange="assignKnowledgeProduct('${key}',this.value)" style="font-size:12px;padding:4px 8px;width:100%;border-radius:var(--rad-xs);background:var(--bg3);color:var(--txt0);border:1px solid var(--brd)">
        <option value="" ${!v.person?'selected':''}>Común</option>
        ${DB.persons.map(p=>`<option value="${p.id}" ${v.person===p.id?'selected':''}>${p.name}</option>`).join('')}
      </select>
    </div>`).join('');
  openModal(`<div class="modal-title">Productos aprendidos</div>
    <p style="font-size:12px;color:var(--txt2);margin-bottom:12px">Edita el nombre, asigna a persona o elimina. Los cambios se aplican en futuros tickets.</p>
    <div style="max-height:55vh;overflow-y:auto">${rows}</div>
    <div style="display:flex;gap:10px;margin-top:14px">
      <button class="btn-secondary" style="flex:1" onclick="closeModal()">Cancelar</button>
      <button class="btn-primary" style="flex:1" onclick="saveDB();closeModal();showToast('Guardado');renderSettings()">Guardar</button>
    </div>`);
}
function assignKnowledgeProduct(key,pid){
  if(!DB.knowledge.products[key]) return;
  DB.knowledge.products[key].person=pid||null;
  DB.knowledge.products[key].shared=!pid;
}
function renameKnowledgeProduct(key,newName){
  if(!newName.trim()) return;
  const entry=DB.knowledge.products[key];
  if(!entry) return;
  const trimmed=newName.trim();
  entry.alias=trimmed;
  // Indexar tambien por nombre normalizado nuevo para que futuros OCR matcheen
  const newKey=normalizeKey(trimmed);
  if(newKey&&newKey!==key) DB.knowledge.products[newKey]={...entry,alias:trimmed};
}
function deleteKnowledgeProduct(key){
  delete DB.knowledge.products[key];
  saveDB();
  editKnowledgeProducts(); // refresca el modal
}
function showVisionStats(){
  const v=DB.visionStats||{};
  const calls=v.calls||0;
  const since=v.firstCall?'desde '+v.firstCall:'';
  // Google Vision: 1000 lecturas/mes gratis, luego $1.50/1000
  const free=1000;
  const over=Math.max(0,calls-free);
  const cost=(over/1000*1.50);
  const freeLeft=Math.max(0,free-calls);
  // Mostrar OCR debug del último ticket
  const lastOCR=S.get('lastOCR')||'';
  openModal(`<div class="modal-title">Uso de Vision IA</div>
    <div style="display:flex;flex-direction:column;gap:12px;margin:16px 0">
      <div style="background:var(--bg3);border-radius:var(--rad-sm);padding:14px">
        <div style="font-size:12px;color:var(--txt2);margin-bottom:2px">Lecturas totales ${since}</div>
        <div style="font-size:28px;font-weight:800">${calls}</div>
      </div>
      <div style="background:var(--bg3);border-radius:var(--rad-sm);padding:14px;display:flex;gap:14px">
        <div style="flex:1">
          <div style="font-size:11px;color:var(--txt2);margin-bottom:2px">Restantes est.</div>
          <div style="font-size:20px;font-weight:800;color:${freeLeft>0?'var(--green)':'var(--amber)'}">${freeLeft}</div>
        </div>
        <div style="flex:1">
          <div style="font-size:11px;color:var(--txt2);margin-bottom:2px">Gasto estimado</div>
          <div style="font-size:20px;font-weight:800;color:${cost>0?'var(--amber)':'var(--txt1)'}">${cost.toFixed(2)}</div>
        </div>
      </div>
      <div style="background:var(--bg3);border-radius:var(--rad-sm);padding:12px">
        <div style="font-size:11px;color:var(--txt2);line-height:1.6">1.000 lecturas mensuales incluidas en el plan · Se renueva cada mes</div>
      </div>
      ${lastOCR?'<div style="background:var(--bg3);border-radius:var(--rad-sm);padding:12px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><span style="font-size:11px;color:var(--txt2)">Último OCR recibido</span><button onclick="copyLastOCR()" style="font-size:11px;padding:3px 8px;border-radius:4px;border:1px solid var(--brd);background:var(--bg2);color:var(--txt1)">Copiar</button></div><pre style="font-size:10px;color:var(--txt1);white-space:pre-wrap;max-height:120px;overflow:auto;margin:0">'+lastOCR.replace(/</g,'&lt;')+'</pre></div>':''}
    </div>
    <div style="display:flex;gap:10px;margin-top:4px">
      <button onclick="consultVisionUsage()" style="flex:1;padding:10px;border-radius:var(--rad-sm);border:1px solid var(--brd);background:var(--bg3);color:var(--txt3);font-size:13px;opacity:0.5;cursor:pointer">Contar</button>
      <button class="btn-primary" style="flex:2" onclick="closeModal()">Cerrar</button>
    </div>`);
}
function showGroqStats(){
  const s=DB.groqStats||{};
  const calls=s.calls||0;
  const tokens=s.tokensUsed||0;
  const since=s.firstCall?'desde '+s.firstCall:'';
  openModal(`<div class="modal-title">Uso de Groq IA</div>
    <div style="display:flex;flex-direction:column;gap:12px;margin:16px 0">
      <div style="background:var(--bg3);border-radius:var(--rad-sm);padding:14px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:12px;color:var(--txt2);margin-bottom:2px">Llamadas totales ${since}</div>
          <div style="font-size:28px;font-weight:800">${calls}</div>
        </div>
      </div>
      <div style="background:var(--bg3);border-radius:var(--rad-sm);padding:14px">
        <div style="font-size:12px;color:var(--txt2);margin-bottom:2px">Tokens usados</div>
        <div style="font-size:28px;font-weight:800">${(tokens/1000).toFixed(1)}k</div>
      </div>
      <div style="background:var(--bg3);border-radius:var(--rad-sm);padding:12px">
        <div style="font-size:12px;color:var(--txt2);line-height:1.6">Plan gratuito · Sin límite mensual · Rate limit: 30 req/min</div>
      </div>
    </div>
    <div style="display:flex;gap:10px;margin-top:4px">
      <button onclick="consultGroqUsage()" style="flex:1;padding:10px;border-radius:var(--rad-sm);border:1px solid var(--brd);background:var(--bg3);color:var(--txt3);font-size:13px;opacity:0.5;cursor:pointer">Contar</button>
      <button class="btn-primary" style="flex:2" onclick="closeModal()">Cerrar</button>
    </div>`);
}
function copyLastOCR(){
  const text=localStorage.getItem('clarito_lastOCR');const raw=text?JSON.parse(text):'';
  if(!raw){showToast('Sin OCR guardado todavía');return;}
  navigator.clipboard.writeText(raw).then(()=>showToast('OCR copiado ✓')).catch(()=>showToast('Error al copiar'));
}
function consultVisionUsage(){
  if(!confirm('Esta acción hace una petición real a Google Cloud Vision para verificar el estado de la cuota.\n\nSolo necesitas pulsarlo si tienes dudas sobre el contador local.\n\nPulsa Cancelar si no es necesario ahora.')){return;}
  // Google Cloud no tiene endpoint público para consultar uso sin OAuth completo.
  // El contador local es la fuente más fiable para uso en PWA.
  showToast('El contador local es el registro más preciso disponible desde una PWA');
}
function consultGroqUsage(){
  if(!confirm('Esta acción hace una petición real a Groq para verificar el estado de tu cuenta.\n\nEl contador local ya refleja tu uso desde esta app.\n\nPulsa Cancelar si no es necesario ahora.')){return;}
  if(!DB.groqKey){showToast('Configura primero tu Groq Key');return;}
  // Groq no expone endpoint de uso por API key sin dashboard OAuth.
  showToast('El contador local es el registro más preciso disponible desde una PWA');
}
function addPerson(){const idx=DB.persons.length;DB.persons.push({id:'p'+(idx+1),name:'Persona '+(idx+1),color:PRESET_COLORS[idx%PRESET_COLORS.length],cards:[]});saveDB();renderSettings();editPerson(idx);}
function editPerson(idx){
  const p=DB.persons[idx];
  openModal(`<div class="modal-title">Editar ${p.name}</div>
    <div class="field-row"><label class="field-label">Nombre</label><input id="ep-name" value="${p.name}"/></div>
    <div class="field-row" style="margin-top:10px"><label class="field-label">Color</label><div class="color-picker-row" id="ep-colors">${PRESET_COLORS.map(c=>`<div class="color-swatch ${p.color===c?'selected':''}" style="background:${c}" onclick="pickPersonColor(${idx},'${c}',this)"></div>`).join('')}</div></div>
    <div style="margin-top:14px"><label class="field-label">Tarjetas (últimos 4 dígitos)</label>
      <div id="ep-cards">${(p.cards||[]).map((c,ci)=>`<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--brd)"><div style="flex:1;font-size:14px">•••• ${c}</div><button onclick="removeCard(${idx},${ci})" style="color:var(--red)">×</button></div>`).join('')}</div>
      <div style="display:flex;gap:8px;margin-top:10px"><input id="ep-card" placeholder="4821" maxlength="4" style="width:90px;letter-spacing:2px"/><button class="btn-secondary" onclick="addCard(${idx})">Añadir</button></div>
    </div>
    ${DB.persons.length>1?`<button class="btn-danger" style="width:100%;margin-top:14px" onclick="removePerson(${idx})">Eliminar persona</button>`:''}
    <div style="display:flex;gap:10px;margin-top:14px">
      <button class="btn-secondary" style="flex:1" onclick="closeModal()">Cancelar</button>
      <button class="btn-primary" style="flex:2" onclick="savePerson(${idx})">Guardar</button>
    </div>`);
}
function pickPersonColor(idx,color,el){DB.persons[idx].color=color;document.querySelectorAll('#ep-colors .color-swatch').forEach(s=>s.classList.remove('selected'));el.classList.add('selected');}
function addCard(idx){const v=document.getElementById('ep-card').value.trim();if(v.length!==4||isNaN(v)){showToast('Introduce 4 dígitos');return;}if(!DB.persons[idx].cards)DB.persons[idx].cards=[];DB.persons[idx].cards.push(v);DB.knowledge.cards[v]=DB.persons[idx].id;editPerson(idx);}
function removeCard(idx,ci){const c=DB.persons[idx].cards[ci];DB.persons[idx].cards.splice(ci,1);delete DB.knowledge.cards[c];editPerson(idx);}
function removePerson(idx){if(DB.persons.length<=1){showToast('Debe haber al menos una persona');return;}DB.persons.splice(idx,1);saveDB();closeModal();renderSettings();}
function savePerson(idx){const n=document.getElementById('ep-name').value.trim();if(n)DB.persons[idx].name=n;saveDB();closeModal();renderSettings();}
function forgetCard(l4){delete DB.knowledge.cards[l4];saveDB();renderSettings();}
function clearKnowledge(){openModal(`<div class="modal-title">¿Borrar conocimiento?</div><p style="font-size:14px;color:var(--txt1);margin-bottom:20px">Se eliminan los productos aprendidos. Los tickets se conservan.</p><div style="display:flex;gap:10px"><button class="btn-secondary" style="flex:1" onclick="closeModal()">Cancelar</button><button class="btn-danger" style="flex:1" onclick="DB.knowledge.products={};saveDB();closeModal();renderSettings();showToast('Borrado')">Borrar</button></div>`);}
function editVisionKey(){openModal(`<div class="modal-title">Google Cloud Vision Key</div><p style="font-size:13px;color:var(--txt2);margin-bottom:12px">Obtén tu key en <strong style="color:var(--accent)">console.cloud.google.com</strong> → APIs y servicios → Credenciales</p><input type="password" id="new-visionkey" value="${DB.visionKey||''}" placeholder="AIzaSy..."/><div style="display:flex;gap:10px;margin-top:16px"><button class="btn-secondary" style="flex:1" onclick="closeModal()">Cancelar</button><button class="btn-primary" style="flex:2" onclick="const k=document.getElementById('new-visionkey').value.trim();if(!k)return;DB.visionKey=k;S.set('visionKey',k);saveDB();closeModal();showToast('Guardada');renderSettings()">Guardar</button></div>`);}
function editGroqKey(){openModal(`<div class="modal-title">Groq API Key</div><p style="font-size:13px;color:var(--txt2);margin-bottom:12px">Key gratuita en <strong style="color:var(--accent)">console.groq.com</strong> → API Keys</p><input type="password" id="new-groqkey" value="${DB.groqKey||''}" placeholder="gsk_..."/><div style="display:flex;gap:10px;margin-top:16px"><button class="btn-secondary" style="flex:1" onclick="closeModal()">Cancelar</button><button class="btn-primary" style="flex:2" onclick="const k=document.getElementById('new-groqkey').value.trim();if(!k)return;DB.groqKey=k;S.set('groqKey',k);saveDB();closeModal();showToast('Guardada');renderSettings()">Guardar</button></div>`);}
function editOcrKey(){openModal(`<div class="modal-title">API Key de OCR.space</div><p style="font-size:13px;color:var(--txt2);margin-bottom:4px">Key gratuita en <strong style="color:var(--accent)">ocr.space/ocrapi</strong></p><p style="font-size:12px;color:var(--txt3);margin-bottom:12px">Deja <em>helloworld</em> para usar la key demo (limitada)</p><input type="password" id="new-ocrkey" value="${DB.ocrKey||'helloworld'}" placeholder="helloworld"/><div style="display:flex;gap:10px;margin-top:16px"><button class="btn-secondary" style="flex:1" onclick="closeModal()">Cancelar</button><button class="btn-primary" style="flex:2" onclick="const k=document.getElementById('new-ocrkey').value.trim()||'helloworld';DB.ocrKey=k;S.set('ocrKey',k);saveDB();closeModal();showToast('Guardada');renderSettings()">Guardar</button></div>`);}

function exportData(){const b=new Blob([JSON.stringify(DB,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='clarito-'+new Date().toISOString().slice(0,10)+'.json';a.click();}
function resetAll(){openModal(`<div class="modal-title">¿Borrar todo?</div><p style="font-size:14px;color:var(--txt1);margin-bottom:20px">No se puede deshacer.</p><div style="display:flex;gap:10px"><button class="btn-secondary" style="flex:1" onclick="closeModal()">Cancelar</button><button class="btn-danger" style="flex:1" onclick="localStorage.clear();location.reload()">Borrar todo</button></div>`);}

// ── AI CHAT ────────────────────────────────────────────────────
function openAIChat(){renderAIChat();document.getElementById('ai-chat-sheet').style.display='flex';}
function closeAIChat(){document.getElementById('ai-chat-sheet').style.display='none';updateAIBadge();}
function renderAIChat(){
  const pending=DB.aiQuestions.filter(q=>!q.answered);
  document.getElementById('ai-chat-sheet').innerHTML=`
    <div class="ai-header">
      <button onclick="closeAIChat()" style="color:var(--txt1)"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      <h2>Asistente IA</h2>
      ${pending.length?`<span class="badge badge-red">${pending.length}</span>`:''}
    </div>
    <div class="ai-messages" id="ai-messages">
      ${pending.length?`<div class="ai-msg bot">Tengo ${pending.length} pregunta${pending.length>1?'s':''} pendientes:</div>${pending.slice(0,5).map(renderAIQuestion).join('')}`:`<div class="ai-msg bot">¡Hola! Soy tu asistente Clarito. Pregúntame sobre gastos, balances o predicciones.</div>`}
      ${DB.aiConvMessages.slice(-10).map(m=>`<div class="ai-msg ${m.role}">${m.content}</div>`).join('')}
    </div>
    <div class="ai-input-row">
      <input id="ai-input" placeholder="Pregunta algo..." onkeydown="if(event.key==='Enter')sendAIMessage()"/>
      <button class="ai-send" onclick="sendAIMessage()"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>
    </div>`;
}
function renderAIQuestion(q){return`<div class="ai-qa" id="qa-${q.id}"><div class="ai-qa-q">${q.question}</div><div class="ai-qa-btns">${(q.options||['Sí','No']).map(opt=>`<button class="ai-qa-btn" onclick="answerAIQuestion('${q.id}','${opt}')">${opt}</button>`).join('')}<button class="ai-qa-btn" onclick="answerAIQuestion('${q.id}','skip')" style="color:var(--txt3)">Saltar</button></div></div>`;}
function answerAIQuestion(qid,answer){
  const q=DB.aiQuestions.find(x=>x.id===qid);if(!q)return;
  q.answered=true;q.answer=answer;
  if(q.type==='product_assign'&&answer!=='skip'){const key=normalizeKey(q.productName||'');if(key){const pid=DB.persons.find(p=>p.name===answer)?.id||null;DB.knowledge.products[key]={...(DB.knowledge.products[key]||{}),person:pid,shared:!pid,pct1:50};}}
  else if(q.type==='card_assign'&&answer!=='skip'){const pid=DB.persons.find(p=>p.name===answer)?.id;if(pid)DB.knowledge.cards[q.last4]=pid;}
  saveDB();updateAIBadge();
  const el=document.getElementById('qa-'+qid);
  if(el){el.style.opacity='.4';el.querySelector('.ai-qa-btns').innerHTML='<span style="font-size:12px;color:var(--txt2)">Respondido</span>';}
}
async function sendAIMessage(){
  const input=document.getElementById('ai-input');
  const msg=input.value.trim();if(!msg)return;
  input.value='';
  DB.aiConvMessages.push({role:'user',content:msg});renderAIChat();
  // 🥚 Easter egg
  if(/secreto/i.test(msg)){
    setTimeout(()=>{
      DB.aiConvMessages.push({role:'bot',content:'🤫 Psst… esta \'app\' fue creada con mucho amor de Carli para Dami ♥️'});
      saveDB();renderAIChat();
      const msgs=document.getElementById('ai-messages');if(msgs)msgs.scrollTop=msgs.scrollHeight;
    },600);
    return;
  }

  // Construir contexto detallado con datos reales
  const {paid,owes,amount}=calcBalance();
  const now=new Date();
  const thisMonth=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

  // Gasto por persona este mes
  const monthByPerson={};
  DB.persons.forEach(p=>monthByPerson[p.id]=0);
  DB.tickets.filter(t=>t.confirmed&&t.date&&t.date.startsWith(thisMonth)).forEach(t=>{
    (t.products||[]).forEach(prod=>{
      const price=parseFloat(prod.finalPrice||prod.price||0);
      if(prod.assignedTo) monthByPerson[prod.assignedTo]=(monthByPerson[prod.assignedTo]||0)+price;
      else DB.persons.forEach(p=>{const pct=p.id===DB.persons[0].id?(prod.pct1||50):100-(prod.pct1||50);monthByPerson[p.id]=(monthByPerson[p.id]||0)+price*pct/100;});
    });
  });
  DB.expenses.filter(e=>e.confirmed&&e.date&&e.date>=monthStart&&e.date<=monthEnd).forEach(e=>{
    const amt=parseFloat(e.total||0);
    DB.persons.forEach((p,i)=>{const pct=i===0?e.split1:100-e.split1;monthByPerson[p.id]=(monthByPerson[p.id]||0)+amt*(pct||50)/100;});
  });

  // Últimos 5 tickets
  const recentTickets=DB.tickets.filter(t=>t.confirmed).slice(-5).map(t=>`${t.store||'?'} ${t.date} ${fmt(t.total)} (pagó ${personName(t.payer)})`).join('; ');

  const ctx=`Eres el asistente de Clarito, app de gastos compartidos del hogar. Responde SIEMPRE con datos concretos, nunca preguntes si quieren ver algo, muestra directamente los números.
DATOS ACTUALES:
- Personas: ${DB.persons.map(p=>p.name).join(', ')}
- Balance total: ${amount>0.01?personName(owes)+' debe '+fmt(amount):'cuentas al día'}
- Pagado en total: ${DB.persons.map(p=>p.name+' '+fmt(paid[p.id]||0)).join(', ')}
- Gasto este mes (${thisMonth}): ${DB.persons.map(p=>p.name+' '+fmt(monthByPerson[p.id]||0)).join(', ')}
- Tickets confirmados: ${DB.tickets.filter(t=>t.confirmed).length}
- Últimos tickets: ${recentTickets||'ninguno'}
Responde en español, breve y directo. Si preguntan cuánto gastó alguien, da el número exacto. Pregunta: ${msg}`;

  try{
    const resp=await callGroq(ctx);
    DB.aiConvMessages.push({role:'bot',content:resp});saveDB();renderAIChat();
    const msgs=document.getElementById('ai-messages');if(msgs)msgs.scrollTop=msgs.scrollHeight;
  }catch(err){
    DB.aiConvMessages.push({role:'bot',content:'Error: '+err.message});renderAIChat();
  }
}
function updateAIBadge(){
  const n=(DB.aiQuestions||[]).filter(q=>!q.answered).length;
  const b=document.getElementById('ai-badge');
  if(b){b.style.display=n>0?'flex':'none';b.textContent=n;}
}
function generateAIQuestions(ticket){
  const qs=[];
  if(ticket.last4&&!DB.knowledge.cards[ticket.last4])
    qs.push({id:uid(),type:'card_assign',answered:false,last4:ticket.last4,question:'¿La tarjeta •••• '+ticket.last4+' pertenece a...?',options:DB.persons.map(p=>p.name)});
  (ticket.products||[]).filter(p=>p.confidence<0.65&&!p.knownMatch).forEach(p=>{
    const key=normalizeKey(p.name||'');
    if(!DB.knowledge.products[key])
      qs.push({id:uid(),type:'product_assign',answered:false,productName:p.name,question:'"'+p.name+'" ('+fmt(p.finalPrice||0)+') · ¿De quién es?',options:[...DB.persons.map(p=>p.name),'Compartido']});
  });
  if(qs.length){DB.aiQuestions.push(...qs);saveDB();updateAIBadge();}
}

// ── BOOT ──────────────────────────────────────────────────────
loadDB();
setTimeout(()=>{
  hideSplash();
  setTimeout(()=>{
    if(!DB.visionKey){
      startSetup();
    }else{
      document.getElementById('app').style.display='flex';
      showScreen('home');
      updateAIBadge();
    }
  },100);
},2500);

// CSS moved to app.css

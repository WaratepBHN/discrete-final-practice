'use strict';
(() => {
  const STORAGE_KEY = 'discrete20.attempt.v1';
  const topics = {'number-theory': 'NUMBER THEORY', relations: 'RELATIONS', graphs: 'GRAPHS'};
  const letters = ['A', 'B', 'C', 'D'];
  let questions = [], state, bankVersion;
  const $ = id => document.getElementById(id);
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const randomSeed = () => globalThis.crypto?.getRandomValues ? crypto.getRandomValues(new Uint32Array(1))[0] : Date.now() >>> 0;
  function shuffle(items, seed) {
    let n = seed >>> 0;
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      n = (n + 0x6D2B79F5) >>> 0;
      let mixed = Math.imul(n ^ n >>> 15, n | 1);
      mixed ^= mixed + Math.imul(mixed ^ mixed >>> 7, mixed | 61);
      const j = Math.floor(((mixed ^ mixed >>> 14) >>> 0) / 4294967296 * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  const freshState = () => ({version: bankVersion, seed: randomSeed(), current: 0, answers: {}});
  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved || saved.version !== bankVersion || !Number.isInteger(saved.seed) || !saved.answers) return freshState();
      const clean = freshState();
      clean.seed = saved.seed;
      clean.current = Number.isInteger(saved.current) && saved.current >= 0 && saved.current < questions.length ? saved.current : 0;
      for (const q of questions) {
        const a = saved.answers[q.id];
        if (a && q.options.some(o => o.id === a.selected)) clean.answers[q.id] = {selected: a.selected, checked: a.checked === true};
      }
      return clean;
    } catch { return freshState(); }
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch { $('save-note').textContent = 'เบราว์เซอร์ไม่อนุญาตให้บันทึก: คำตอบจะอยู่จนกว่าจะปิดหน้านี้'; }
  }
  const orderedOptions = q => shuffle(q.options, state.seed ^ (questions.indexOf(q) + 1) * 2246822519);
  function stats(subset = questions) {
    const checked = subset.filter(q => state.answers[q.id]?.checked);
    return {checked: checked.length, correct: checked.filter(q => state.answers[q.id].selected === q.correct).length};
  }
  function renderSidebar() {
    const s = stats();
    $('progress-text').textContent = `ตรวจแล้ว ${s.checked} / ${questions.length} ข้อ`;
    $('score-mini').textContent = `ถูก ${s.correct} ข้อ`;
    $('progress').value = s.checked;
    $('question-grid').replaceChildren(...questions.map((q, i) => {
      const answer = state.answers[q.id];
      const result = answer?.checked ? (answer.selected === q.correct ? 'done' : 'wrong') : (answer ? 'draft' : '');
      const active = !$('question').hidden && state.current === i;
      const button = el('button', `q-jump ${result} ${active ? 'current' : ''}`, i + 1);
      const status = answer?.checked ? (result === 'done' ? 'ตอบถูก' : 'ตอบผิด') : (answer ? 'เลือกแล้ว ยังไม่ตรวจ' : 'ยังไม่ทำ');
      button.setAttribute('aria-label', `ข้อ ${i + 1} ${status}`);
      if (active) button.setAttribute('aria-current', 'step');
      button.addEventListener('click', () => showQuestion(i));
      return button;
    }));
  }
  function renderTable(data, matrix = false) {
    const wrap = el('div', 'math-table-wrap');
    const table = el('table', `math-table ${matrix ? 'matrix' : ''}`);
    const headers = matrix ? ['แถว/คอลัมน์', ...data.labels] : data.headers;
    const rows = matrix ? data.values.map((row, i) => [data.labels[i], ...row]) : data.rows;
    const head = el('thead'), tr = el('tr');
    headers.forEach(h => {const cell = el('th', '', h); cell.scope = 'col'; tr.append(cell);});
    head.append(tr); table.append(head);
    const body = el('tbody');
    rows.forEach(row => {const r = el('tr'); row.forEach((v, i) => {const cell = el(matrix && i === 0 ? 'th' : 'td', '', v); if (matrix && i === 0) cell.scope = 'row'; r.append(cell);}); body.append(r);});
    table.append(body); wrap.append(table); return wrap;
  }
  function renderDiagram(data, q) {
    const ns = 'http://www.w3.org/2000/svg';
    const svgEl = (tag, attrs = {}) => {const n = document.createElementNS(ns, tag); Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v)); return n;};
    const figure = el('figure', 'graph-figure');
    const svg = svgEl('svg', {viewBox: '0 -12 480 282', role: 'img', 'aria-label': `กราฟประกอบ: ${q.titleThai}`});
    const markerID = `arrow-${q.id}`;
    const defs = svgEl('defs'), marker = svgEl('marker', {id:markerID,viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:6,markerHeight:6,orient:'auto-start-reverse'});
    marker.append(svgEl('path',{d:'M 0 0 L 10 5 L 0 10 z',fill:'#42636b'}));defs.append(marker);svg.append(defs);
    const nodes = new Map(data.nodes.map(n => [String(n.id), n]));
    const groups = new Map();
    data.edges.forEach((edge, index) => {const key = [...edge].map(String).sort().join('|'); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(index);});
    data.edges.forEach((edge, index) => {
      const a = nodes.get(String(edge[0])), b = nodes.get(String(edge[1]));
      if (!a || !b) return;
      const group = groups.get([...edge].map(String).sort().join('|'));
      let d;
      if (a === b) {
        d = `M ${a.x - 5} ${a.y - 6} C ${a.x - 44} ${a.y - 52}, ${a.x + 44} ${a.y - 52}, ${a.x + 5} ${a.y - 6}`;
      } else {
        const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
        const offset = (group.indexOf(index) - (group.length - 1) / 2) * 43;
        const sign = String(a.id) < String(b.id) ? 1 : -1;
        const cx = (a.x + b.x) / 2 - dy / len * offset * sign;
        const cy = (a.y + b.y) / 2 + dx / len * offset * sign;
        const startLen = Math.hypot(cx-a.x, cy-a.y), endLen = Math.hypot(b.x-cx,b.y-cy);
        const sx=a.x+(cx-a.x)/startLen*7, sy=a.y+(cy-a.y)/startLen*7;
        const ex=b.x-(b.x-cx)/endLen*(data.directed ? 10 : 7), ey=b.y-(b.y-cy)/endLen*(data.directed ? 10 : 7);
        d = `M ${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}`;
      }
      const path = svgEl('path',{d,fill:'none',stroke:'#42636b','stroke-width':2});
      if (data.directed) path.setAttribute('marker-end',`url(#${markerID})`);
      svg.append(path);
    });
    data.nodes.forEach(n => {
      svg.append(svgEl('circle',{cx:n.x,cy:n.y,r:6,fill:'#142c34'}));
      const label = svgEl('text',{x:n.x+11,y:n.y+7,fill:'#142c34','font-size':22,'font-family':'Tahoma, sans-serif','paint-order':'stroke',stroke:'#fcfdfa','stroke-width':4,'stroke-linejoin':'round'});
      label.textContent=n.id;svg.append(label);
    });
    figure.append(svg, el('figcaption','','จุดตัดเส้นที่ไม่มีจุดกำกับ ไม่นับเป็น vertex · ใช้รายการเส้นในโจทย์ตรวจร่วมด้วย'));
    return figure;
  }
  function renderFeedback(q, answer, order) {
    const ok = answer.selected === q.correct;
    const box = el('section', `feedback ${ok ? 'correct' : 'incorrect'}`);
    box.setAttribute('aria-labelledby', 'feedback-heading');
    const heading = el('h3', '', ok ? '✓ ถูกต้อง' : '✕ ยังไม่ถูก');heading.id='feedback-heading';heading.tabIndex=-1;
    box.append(heading);
    const chosen = q.options.find(o => o.id === answer.selected);
    const key = order.findIndex(o => o.id === q.correct);
    box.append(el('p', '', chosen.why));
    box.append(el('p','answer-key',`คำตอบที่ถูก: ${letters[key]}. ${q.options.find(o=>o.id===q.correct).text}`));
    box.append(el('h4','','ทำทีละขั้น'));
    const list = el('ol');q.steps.forEach(step=>list.append(el('li','',step)));box.append(list);
    const remember = el('p','remember');remember.append(el('strong','','จำไปใช้: '),document.createTextNode(q.remember));box.append(remember);
    const details=el('details','all-options');details.append(el('summary','','ดูเหตุผลของตัวเลือกทั้ง 4 ข้อ'));
    order.forEach((option,i)=>{const item=el('div','option-reason');item.append(el('strong','',`${letters[i]}. ${option.text}${option.id===q.correct?' ✓':''}`),el('p','',option.why));details.append(item);});
    box.append(details);return box;
  }
  function showQuestion(index, focus = true) {
    state.current=index;save();$('summary').hidden=true;$('question').hidden=false;
    const q=questions[index], answer=state.answers[q.id], order=orderedOptions(q), card=$('question');
    card.replaceChildren();
    const top=el('div','question-top');top.append(el('span',`topic ${q.topic}`,topics[q.topic]),el('span','question-number',`ข้อ ${index+1} / ${questions.length}`));card.append(top);
    card.append(el('h2','',q.titleThai),el('p','prompt',q.promptThai));
    if(q.givens?.length){const given=el('div','givens');q.givens.forEach(text=>given.append(el('p','',text)));card.append(given);}
    if(q.table)card.append(renderTable(q.table));
    if(q.matrix)card.append(renderTable(q.matrix,true));
    if(q.diagram)card.append(renderDiagram(q.diagram,q));
    const field=el('fieldset');field.append(el('legend','','เลือกคำตอบที่ถูกที่สุดเพียงข้อเดียว'));
    const choices=el('div','choices');
    order.forEach((option,i)=>{
      const selected=answer?.selected===option.id;
      const checked=answer?.checked===true;
      const classes=['choice',selected?'selected':'',checked?'locked':'',checked&&option.id===q.correct?'is-correct':'',checked&&selected&&option.id!==q.correct?'is-wrong':''].filter(Boolean).join(' ');
      const label=el('label',classes), input=el('input');
      input.type='radio';input.name='answer';input.value=option.id;input.checked=selected;input.disabled=checked;
      input.addEventListener('change',()=>{state.answers[q.id]={selected:option.id,checked:false};save();choices.querySelectorAll('.choice').forEach(c=>c.classList.toggle('selected',c.querySelector('input').checked));$('check-button').disabled=false;renderSidebar();});
      label.append(input,el('span','letter',letters[i]),el('span','choice-text',option.text));
      if(checked&&(option.id===q.correct||selected)) {const mark=el('span','choice-mark',option.id===q.correct?'✓':'✕');mark.setAttribute('aria-label',option.id===q.correct?'คำตอบถูก':'คำตอบที่เลือกผิด');label.append(mark);}
      choices.append(label);
    });field.append(choices);card.append(field);
    if(!answer?.checked){
      const actions=el('div','answer-actions');actions.append(el('span','action-note','ตรวจแล้วล็อกคำตอบแรกของรอบนี้'));
      const check=el('button','primary','ตรวจคำตอบ');check.id='check-button';check.disabled=!answer;
      check.addEventListener('click',()=>{if(!state.answers[q.id]?.selected||state.answers[q.id].checked)return;state.answers[q.id].checked=true;save();showQuestion(index,false);$('feedback-heading').focus({preventScroll:true});$('feedback-heading').scrollIntoView({behavior:'auto',block:'nearest'});});actions.append(check);card.append(actions);
    }else card.append(renderFeedback(q,answer,order));
    const nav=el('nav','nav-row');nav.setAttribute('aria-label','ไปข้อก่อนหน้าหรือถัดไป');
    const prev=el('button','','← ข้อก่อนหน้า');prev.disabled=index===0;prev.addEventListener('click',()=>showQuestion(index-1));
    const next=el('button','',index===questions.length-1?'ดูผลการฝึก ↗':'ข้อถัดไป →');next.addEventListener('click',()=>index===questions.length-1?showSummary():showQuestion(index+1));nav.append(prev,next);card.append(nav);
    renderSidebar();if(focus){card.focus({preventScroll:true});card.scrollIntoView({block:'start'});}
  }
  function showSummary() {
    $('question').hidden=true;$('summary').hidden=false;
    const area=$('summary');area.replaceChildren();const s=stats(), wrong=questions.filter(q=>state.answers[q.id]?.checked&&state.answers[q.id].selected!==q.correct);
    area.append(el('span','eyebrow','PRACTICE REPORT'),el('h2','',s.checked===questions.length?'จบรอบนี้แล้ว':'เช็กความพร้อมระหว่างทาง'));
    const score=el('div','score-big',s.correct);score.append(el('span','',` / ${questions.length}`));area.append(score);
    area.append(el('p','summary-lead',`คะแนนปัจจุบัน ${s.correct*100/questions.length}% · ตรวจแล้ว ${s.checked} ข้อ · ยังไม่ตรวจ ${questions.length-s.checked} ข้อ`));
    area.append(el('span','target-status',s.correct>=14?'ถึงเป้าฝึก 70% แล้ว':`อีก ${14-s.correct} ข้อที่ตอบถูก จะถึงเป้าฝึก 70%`));
    const breakdown=el('div','breakdowns');Object.entries(topics).forEach(([topic,name])=>{const group=questions.filter(q=>q.topic===topic), result=stats(group), row=el('div','breakdown');row.append(el('span','',name),el('strong','',`${result.correct}/${group.length} · ตรวจแล้ว ${result.checked}`));breakdown.append(row);});area.append(breakdown);
    if(wrong.length){area.append(el('h3','review-heading',`กลับไปดูจุดที่พลาด (${wrong.length} ข้อ)`));const reviews=el('div','review-list');wrong.forEach(q=>{const i=questions.indexOf(q),b=el('button','review-item');b.append(el('strong','',`ข้อ ${i+1} · ${q.titleThai}`),el('span','','อ่านเฉลย →'));b.addEventListener('click',()=>showQuestion(i));reviews.append(b);});area.append(reviews);}
    else area.append(el('p','summary-lead',s.checked?'ยังไม่มีข้อที่ตอบผิดในข้อที่ตรวจแล้ว':'เริ่มทำโจทย์และตรวจคำตอบ เพื่อดูหัวข้อที่ควรทวน'));
    const actions=el('div','summary-actions');const remaining=questions.findIndex(q=>!state.answers[q.id]?.checked);
    const back=el('button','primary',remaining>=0?'ทำข้อที่ยังไม่ตรวจต่อ →':'กลับไปอ่านโจทย์และเฉลย');back.addEventListener('click',()=>showQuestion(remaining>=0?remaining:0));
    const reset=el('button','secondary','เริ่มรอบใหม่');reset.addEventListener('click',()=>openReset());actions.append(back,reset);area.append(actions);renderSidebar();area.focus({preventScroll:true});area.scrollIntoView({block:'start'});
  }
  function openReset(){ $('reset-dialog').showModal(); }
  $('reset-button').addEventListener('click',openReset);
  $('summary-button').addEventListener('click',showSummary);
  $('reset-dialog').addEventListener('close',()=>{if($('reset-dialog').returnValue==='reset'){state=freshState();save();showQuestion(0);} $('reset-dialog').returnValue='';});
  async function init(){
    try{
      const response=await fetch('./questions.json');if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const data=await response.json();questions=data.questions;bankVersion=data.version;
      if(!Array.isArray(questions)||questions.length!==20||questions.some(q=>!q.id||q.options?.length!==4||!q.options.some(o=>o.id===q.correct)))throw new Error('Invalid question bank');
      state=loadState();$('loading').hidden=true;$('app').hidden=false;showQuestion(state.current,false);
      if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
    }catch(error){console.error(error);const box=$('loading');box.replaceChildren(el('p','','เปิดชุดโจทย์ไม่สำเร็จ กรุณาตรวจการเชื่อมต่อแล้วลองอีกครั้ง'));const retry=el('button','primary','ลองเปิดอีกครั้ง');retry.addEventListener('click',()=>location.reload());box.append(retry);}
  }
  init();
})();

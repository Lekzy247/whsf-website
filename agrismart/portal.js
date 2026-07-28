const STORAGE_KEY='agrismart-portal-demo-v1';

const defaultState={
  participants:[
    {name:'Amina Bello',team:'Team A',attendance:96,tasks:'18/20',status:'Active'},
    {name:'Blessing Adeyemi',team:'Team B',attendance:91,tasks:'17/20',status:'Active'},
    {name:'Chiamaka Eze',team:'Team C',attendance:84,tasks:'15/20',status:'Needs attention'},
    {name:'Fatima Yusuf',team:'Team A',attendance:94,tasks:'19/20',status:'Active'},
    {name:'Kemi Oladipo',team:'Team D',attendance:88,tasks:'16/20',status:'Active'},
    {name:'Mary Daniel',team:'Team B',attendance:79,tasks:'14/20',status:'Needs attention'}
  ],
  activities:[
    {title:'Prepare nursery beds',team:'Team A',date:'Today',status:'Planned'},
    {title:'Tomato disease scouting',team:'Teams A-D',date:'Today',status:'In progress'},
    {title:'Update digital farm records',team:'All teams',date:'Today',status:'In progress'},
    {title:'Inspect drip irrigation lines',team:'Farm team',date:'Tomorrow',status:'Planned'},
    {title:'Upload weekly photo evidence',team:'All teams',date:'Friday',status:'Review'},
    {title:'Approve practical assessments',team:'Facilitators',date:'Friday',status:'Review'}
  ],
  plots:Array.from({length:36},(_,index)=>({
    id:`P${String(index+1).padStart(2,'0')}`,
    crop:['Tomato','Maize','Pepper','Okra','Lettuce','Cassava'][index%6],
    team:`Team ${['A','B','C','D'][index%4]}`,
    stage:['Seedling','Vegetative','Flowering','Harvest'][index%4],
    health:index%9===0?'Needs review':index%7===0?'Harvest ready':'Healthy'
  })),
  evidence:[
    {title:'Tomato scouting',team:'Team A',type:'Photo',status:'Approved'},
    {title:'Irrigation inspection',team:'Farm Team',type:'Photo',status:'Pending'},
    {title:'Soil observation sheet',team:'Team C',type:'Report',status:'Approved'},
    {title:'Compost temperature log',team:'Team B',type:'Record',status:'Pending'},
    {title:'Nursery establishment',team:'Team D',type:'Photo',status:'Approved'},
    {title:'Market-day sales summary',team:'Team A',type:'Report',status:'Pending'}
  ]
};

let state=loadState();

function loadState(){
  try{return JSON.parse(localStorage.getItem(STORAGE_KEY))||structuredClone(defaultState);}catch{return structuredClone(defaultState);}
}
function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}
function initials(name){return name.split(' ').map(part=>part[0]).slice(0,2).join('').toUpperCase();}

function showView(name){
  document.querySelectorAll('.view').forEach(view=>view.classList.toggle('active',view.id===`view-${name}`));
  document.querySelectorAll('.nav-item').forEach(item=>item.classList.toggle('active',item.dataset.view===name));
  window.scrollTo({top:0,behavior:'smooth'});
}

document.querySelectorAll('.nav-item').forEach(item=>item.addEventListener('click',()=>showView(item.dataset.view)));
document.querySelectorAll('[data-view-link]').forEach(item=>item.addEventListener('click',()=>showView(item.dataset.viewLink)));

function renderParticipants(filter=''){
  const host=document.querySelector('#participant-rows');
  if(!host)return;
  const query=filter.trim().toLowerCase();
  const rows=state.participants.filter(person=>Object.values(person).join(' ').toLowerCase().includes(query));
  host.innerHTML=rows.map(person=>`<div class="table-row"><span class="participant-cell"><i class="participant-avatar">${initials(person.name)}</i><b>${person.name}</b></span><span>${person.team}</span><span>${person.attendance}%</span><span>${person.tasks}</span><span class="status ${person.status==='Active'?'live':'upcoming'}">${person.status}</span></div>`).join('')||'<p>No participants found.</p>';
}

document.querySelector('#participant-search')?.addEventListener('input',event=>renderParticipants(event.target.value));

function renderActivities(){
  const host=document.querySelector('#activity-board');
  if(!host)return;
  const columns=['Planned','In progress','Review'];
  host.innerHTML=columns.map(status=>{
    const tasks=state.activities.filter(activity=>activity.status===status);
    return `<section class="kanban-column"><h2>${status}<span>${tasks.length}</span></h2>${tasks.map(task=>`<article class="task-card"><b>${task.title}</b><small>${task.team}</small><div class="task-meta"><span>${task.date}</span><button data-complete-task="${task.title}" type="button">${status==='Review'?'Approve':'Advance'}</button></div></article>`).join('')}</section>`;
  }).join('');
  host.querySelectorAll('[data-complete-task]').forEach(button=>button.addEventListener('click',()=>{
    const activity=state.activities.find(item=>item.title===button.dataset.completeTask);
    if(!activity)return;
    activity.status=activity.status==='Planned'?'In progress':activity.status==='In progress'?'Review':'Completed';
    saveState();renderActivities();
  }));
}

function renderPlots(){
  const host=document.querySelector('#farm-map');
  if(!host)return;
  host.innerHTML=state.plots.map(plot=>`<button class="plot-cell ${plot.health==='Needs review'?'warning':plot.health==='Harvest ready'?'harvest':''}" data-plot="${plot.id}" type="button">${plot.id}</button>`).join('');
  host.querySelectorAll('[data-plot]').forEach(button=>button.addEventListener('click',()=>showPlot(button.dataset.plot,button)));
}
function showPlot(id,button){
  document.querySelectorAll('.plot-cell').forEach(cell=>cell.classList.remove('active'));
  button.classList.add('active');
  const plot=state.plots.find(item=>item.id===id);
  const host=document.querySelector('#plot-detail');
  host.innerHTML=`<div class="panel-head"><div><p>Plot details</p><h2>${plot.id} — ${plot.crop}</h2></div><span class="status ${plot.health==='Healthy'?'live':'upcoming'}">${plot.health}</span></div><div class="review-list"><article><span>👥</span><div><b>Assigned team</b><small>${plot.team}</small></div></article><article><span>🌿</span><div><b>Growth stage</b><small>${plot.stage}</small></div></article><article><span>📋</span><div><b>Next action</b><small>${plot.health==='Needs review'?'Facilitator inspection required':'Continue weekly monitoring'}</small></div></article></div>`;
}

function renderEvidence(){
  const host=document.querySelector('#evidence-grid');
  if(!host)return;
  host.innerHTML=state.evidence.map((item,index)=>`<article class="evidence-card"><div class="evidence-photo">${item.type==='Photo'?'📷':item.type==='Report'?'📄':'📊'}</div><div class="evidence-body"><b>${item.title}</b><small>${item.team} • ${item.type}</small><div class="task-meta"><span class="status ${item.status==='Approved'?'live':'upcoming'}">${item.status}</span>${item.status==='Pending'?`<button data-approve="${index}" type="button">Approve</button>`:''}</div></div></article>`).join('');
  host.querySelectorAll('[data-approve]').forEach(button=>button.addEventListener('click',()=>{state.evidence[Number(button.dataset.approve)].status='Approved';saveState();renderEvidence();}));
}

function renderImpact(){
  const host=document.querySelector('#impact-bars');
  if(!host)return;
  const values=[28,36,44,51,63,72,84];
  host.innerHTML=values.map((value,index)=>`<div class="bar-item"><i style="height:${value}%"></i><span>W${index+1}</span></div>`).join('');
}

function wireModals(){
  document.querySelectorAll('[data-modal]').forEach(button=>button.addEventListener('click',()=>document.querySelector(`#${button.dataset.modal}`)?.showModal()));
  document.querySelector('#save-participant')?.addEventListener('click',event=>{
    const form=event.target.closest('form');
    const inputs=form.querySelectorAll('input,select');
    const first=inputs[0].value.trim(),last=inputs[1].value.trim();
    if(!first||!last)return;
    state.participants.unshift({name:`${first} ${last}`,team:inputs[4].value,attendance:100,tasks:'0/20',status:'Active'});
    saveState();renderParticipants();
  });
}

function wireAI(){
  const drawer=document.querySelector('#ai-drawer');
  document.querySelectorAll('[data-open-ai]').forEach(button=>button.addEventListener('click',()=>{drawer.classList.add('open');drawer.setAttribute('aria-hidden','false');}));
  document.querySelectorAll('[data-close-ai]').forEach(button=>button.addEventListener('click',()=>{drawer.classList.remove('open');drawer.setAttribute('aria-hidden','true');}));
  document.querySelector('#ai-form')?.addEventListener('submit',event=>{
    event.preventDefault();
    const input=document.querySelector('#ai-input');
    const question=input.value.trim();if(!question)return;
    const conversation=document.querySelector('#ai-conversation');
    conversation.insertAdjacentHTML('beforeend',`<div class="user-message">${escapeHTML(question)}</div>`);
    input.value='';
    const answer=getAIResponse(question);
    setTimeout(()=>{conversation.insertAdjacentHTML('beforeend',`<div class="ai-message">${answer}</div>`);conversation.scrollTop=conversation.scrollHeight;},350);
  });
}
function getAIResponse(question){
  const q=question.toLowerCase();
  if(q.includes('irrigation')||q.includes('water'))return 'Check soil moisture first, irrigate during cooler hours, and record the duration and plot condition. Avoid watering already saturated soil.';
  if(q.includes('yellow')||q.includes('leaf')||q.includes('disease'))return 'Inspect both sides of affected leaves, photograph the symptoms, check whether the problem is spreading, and ask an agronomist before applying any treatment.';
  if(q.includes('record')||q.includes('data'))return 'Record the date, plot ID, crop, observation, action taken, person responsible, and supporting photo. Keep measurements consistent each week.';
  if(q.includes('robot')||q.includes('transport'))return 'A simple future pilot could test a small autonomous cart for moving tools and harvested produce, measuring time saved, load capacity, safety, and crop damage reduction.';
  return 'Use the field-first method: observe, record evidence, compare with the approved guide, take a safe action, and escalate uncertain cases to the facilitator or agronomist.';
}
function escapeHTML(text){return text.replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));}

function animateCounters(){
  document.querySelectorAll('[data-count]').forEach(element=>{
    const target=Number(element.dataset.count||0),suffix=element.dataset.suffix||'';
    let current=0;const step=Math.max(1,Math.ceil(target/30));
    const timer=setInterval(()=>{current=Math.min(target,current+step);element.textContent=current.toLocaleString()+suffix;if(current===target)clearInterval(timer);},30);
  });
}

renderParticipants();renderActivities();renderPlots();renderEvidence();renderImpact();wireModals();wireAI();animateCounters();

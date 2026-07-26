(()=>{
  const $=(s,c=document)=>c.querySelector(s), $$=(s,c=document)=>[...c.querySelectorAll(s)];
  $$('.portal-menu button').forEach(b=>b.addEventListener('click',()=>{$$('.portal-menu button').forEach(x=>x.classList.remove('active'));$$('.portal-view').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('#portal-'+b.dataset.portal)?.classList.add('active')}));
  $$('.role-switcher button').forEach(b=>b.addEventListener('click',()=>{$$('.role-switcher button').forEach(x=>x.classList.remove('active'));b.classList.add('active');localStorage.setItem('agrilearnDemoRole',b.dataset.role);const el=$('#active-role');if(el)el.textContent=b.textContent}));
  const saved=localStorage.getItem('agrilearnDemoRole');if(saved){const b=$(`.role-switcher button[data-role="${saved}"]`);if(b)b.click()}
  async function load(){
    try{
      const [farms,fields,reviews]=await Promise.all(['data/agrilearn-farms-demo.json','data/agrilearn-fields-demo.json','data/agrilearn-expert-reviews-demo.json'].map(u=>fetch(u).then(r=>r.json())));
      const fg=$('#farm-list');if(fg)fg.innerHTML=farms.map(f=>`<article class="farm-card"><span class="ag-chip">${f.status}</span><h3>${f.name}</h3><p>${f.district}, ${f.state}, ${f.country}</p><p><strong>${f.area} ${f.unit}</strong> · ${f.soilType}</p><button class="ag-btn ag-btn-secondary" data-open-farm="${f.id}">View farm</button></article>`).join('');
      const ft=$('#field-list');if(ft)ft.innerHTML=fields.map(f=>`<div class="field-row"><strong>${f.name}</strong><span>${f.crop}</span><span>${f.growthStage}</span><span>${f.health}</span><button class="ag-btn ag-btn-secondary" data-field="${f.id}">Open</button></div>`).join('');
      const rt=$('#review-list');if(rt)rt.innerHTML=reviews.map(r=>`<div class="review-row"><div><strong>${r.crop}</strong><small>${r.finding}</small></div><span>${Math.round(r.confidence*100)}% confidence</span><span>${r.region}</span><span class="priority-${r.priority}">${r.priority}</span><button class="ag-btn ag-btn-secondary" data-review="${r.id}">Review</button></div>`).join('');
      $('#farm-count')&&($('#farm-count').textContent=farms.length);$('#field-count')&&($('#field-count').textContent=fields.length);$('#review-count')&&($('#review-count').textContent=reviews.length);
    }catch(e){console.warn('Phase 5 demo data unavailable',e)}
  }
  load();
  $('#auth-demo')?.addEventListener('submit',e=>{e.preventDefault();const email=$('#auth-email').value;localStorage.setItem('agrilearnDemoUser',JSON.stringify({email,role:localStorage.getItem('agrilearnDemoRole')||'farmer'}));$('#auth-result').innerHTML='<div class="production-banner"><strong>Demonstration profile created locally.</strong><p>No real account or password was transmitted. Production authentication requires a secured identity provider.</p></div>'});
  $('#farm-form')?.addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(e.target),farm=Object.fromEntries(fd.entries()),items=JSON.parse(localStorage.getItem('agrilearnLocalFarms')||'[]');items.push({...farm,id:'local-'+Date.now()});localStorage.setItem('agrilearnLocalFarms',JSON.stringify(items));$('#farm-form-result').textContent='Farm saved on this device for demonstration.';e.target.reset()});
})();
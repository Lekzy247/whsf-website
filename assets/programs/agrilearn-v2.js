
(()=>{
  const $=(s,c=document)=>c.querySelector(s), $$=(s,c=document)=>[...c.querySelectorAll(s)];
  const menu=$('#ag-menu'), links=$('#ag-links'); if(menu&&links) menu.addEventListener('click',()=>links.classList.toggle('open'));
  const cropSearch=$('#crop-search'), cropList=$('#crop-list'), region=$('#region'), country=$('#country'), cropSelect=$('#crop-select'), cropDetail=$('#crop-detail');
  let crops=[];
  const renderCrops=()=>{
    if(!cropList) return;
    const term=(cropSearch?.value||'').toLowerCase(); const r=region?.value||'All'; const c=country?.value||'All';
    const filtered=crops.filter(x=>(!term||`${x.name} ${x.category} ${x.summary}`.toLowerCase().includes(term))&&(r==='All'||x.regions.includes(r)||x.regions.includes('Global'))&&(c==='All'||x.countries.includes(c)));
    cropList.innerHTML=filtered.map(x=>`<button class="crop-option" data-crop="${x.id}"><strong>${x.name}</strong><small>${x.category} · ${x.regions.join(', ')}</small></button>`).join('')||'<p>No matching crops found.</p>';
    if(cropSelect) cropSelect.innerHTML='<option value="">Choose crop</option>'+filtered.map(x=>`<option value="${x.id}">${x.name}</option>`).join('');
    $$('.crop-option',cropList).forEach(b=>b.addEventListener('click',()=>selectCrop(b.dataset.crop)));
  };
  const selectCrop=id=>{
    const x=crops.find(y=>y.id===id); if(!x)return; if(cropSelect)cropSelect.value=id;
    $$('.crop-option').forEach(b=>b.classList.toggle('active',b.dataset.crop===id));
    if(cropDetail) cropDetail.innerHTML=`<span class="ag-chip">${x.category}</span><h3>${x.name}</h3><p>${x.summary}</p><strong>Common learning topics</strong><ul>${x.risks.map(r=>`<li>${r}</li>`).join('')}</ul><strong>Plant parts</strong><p>${x.parts.join(', ')}</p>`;
  };
  fetch('data/agrilearn-crops.json').then(r=>r.json()).then(d=>{crops=d; const regions=[...new Set(crops.flatMap(x=>x.regions))].sort(); const countries=[...new Set(crops.flatMap(x=>x.countries))].sort(); if(region) region.innerHTML='<option>All</option>'+regions.map(x=>`<option>${x}</option>`).join(''); if(country) country.innerHTML='<option>All</option>'+countries.map(x=>`<option>${x}</option>`).join(''); renderCrops();}).catch(()=>{if(cropList)cropList.innerHTML='<p>Crop data is temporarily unavailable.</p>'});
  [cropSearch,region,country].forEach(el=>el&&el.addEventListener(el===cropSearch?'input':'change',renderCrops)); if(cropSelect) cropSelect.addEventListener('change',()=>selectCrop(cropSelect.value));
  $$('.mode-tabs button').forEach(btn=>btn.addEventListener('click',()=>{$$('.mode-tabs button').forEach(b=>b.classList.remove('active'));btn.classList.add('active');const t=$('#workspace-title');if(t)t.textContent=btn.dataset.title;}));
  const analyze=$('#analyze-btn'); if(analyze) analyze.addEventListener('click',()=>{const id=cropSelect?.value;const x=crops.find(y=>y.id===id);const output=$('#analysis-output');if(!x){output.innerHTML='<div class="legacy-note">Please select a crop before running the prototype.</div>';return;}output.innerHTML=`<span class="ag-chip">Prototype result</span><h2>${x.name} learning assessment</h2><p><strong>Likely issue:</strong> ${x.risks[0]}</p><p><strong>Confidence:</strong> 78% (demonstration only)</p><div class="confidence"><span></span></div><div class="result-card"><h3>What to check</h3><p>Review the affected plant part, recent weather, field pattern and crop history. Compare symptoms with trusted local guidance.</p></div><div class="result-card"><h3>Recommended next step</h3><p>Consult a qualified extension worker or agricultural specialist before treatment. Do not rely on this demonstration for pesticide or high-risk decisions.</p></div>`;});
  const ask=$('#ask-btn'); if(ask) ask.addEventListener('click',()=>{const q=$('#assistant-question');const log=$('#assistant-log');if(!q.value.trim())return;log.innerHTML+=`<div class="bubble user">${q.value}</div><div class="bubble ai">This prototype can organize crop learning guidance. For field decisions, confirm symptoms with a local agricultural professional.</div>`;q.value='';log.scrollTop=log.scrollHeight;});
})();

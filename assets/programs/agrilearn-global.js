
(()=>{
  const q=(s,c=document)=>c.querySelector(s), qa=(s,c=document)=>[...c.querySelectorAll(s)];
  qa('[data-region]').forEach(btn=>btn.addEventListener('click',()=>{
    qa('[data-region]').forEach(b=>b.setAttribute('aria-pressed','false'));
    btn.setAttribute('aria-pressed','true');
    const value=btn.dataset.region;
    qa('[data-crop-region]').forEach(card=>card.hidden=value!=='all'&&!card.dataset.cropRegion.split(' ').includes(value));
  }));
  const search=q('#crop-search');
  if(search) search.addEventListener('input',()=>{const term=search.value.toLowerCase();qa('[data-crop-region]').forEach(card=>{card.hidden=!card.textContent.toLowerCase().includes(term)})});
  qa('[data-lang]').forEach(btn=>btn.addEventListener('click',()=>{
    qa('[data-lang]').forEach(b=>b.setAttribute('aria-pressed','false'));btn.setAttribute('aria-pressed','true');
    const lang=btn.dataset.lang;qa('[data-i18n]').forEach(el=>{const text=el.dataset[lang];if(text)el.textContent=text});
    document.documentElement.lang=lang;
  }));
})();

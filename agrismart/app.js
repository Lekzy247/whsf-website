const toggle=document.querySelector('.menu-toggle');
const nav=document.querySelector('#agrismart-nav');
if(toggle&&nav){
  toggle.addEventListener('click',()=>{
    const open=nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded',String(open));
  });
  nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded','false');
  }));
}

const year=document.querySelector('#year');
if(year)year.textContent=new Date().getFullYear();

const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const revealTargets=document.querySelectorAll('.section-heading,.innovation-grid article,.journey-grid article,.benefit-cards article,.role-grid article,.week-grid article,.station-grid article,.assessment-grid article,.field-cycle article,.facilities-grid>*,.intro-grid>*,.ai-panel>*,.future-panel>*');
revealTargets.forEach(el=>el.classList.add('reveal-ready'));
if(!reduceMotion&&'IntersectionObserver'in window){
  const revealObserver=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        entry.target.classList.add('reveal-in');
        revealObserver.unobserve(entry.target);
      }
    });
  },{threshold:.12,rootMargin:'0px 0px -35px'});
  revealTargets.forEach(el=>revealObserver.observe(el));
}else{
  revealTargets.forEach(el=>el.classList.add('reveal-in'));
}

const counters=document.querySelectorAll('[data-count]');
function animateCounter(el){
  const target=Number(el.dataset.count||0);
  const suffix=el.dataset.suffix||'';
  const duration=1200;
  const started=performance.now();
  const tick=now=>{
    const progress=Math.min((now-started)/duration,1);
    const eased=1-Math.pow(1-progress,3);
    const value=Math.round(target*eased);
    el.textContent=value.toLocaleString()+suffix;
    if(progress<1)requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
if(counters.length){
  if(!reduceMotion&&'IntersectionObserver'in window){
    const counterObserver=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting){animateCounter(entry.target);counterObserver.unobserve(entry.target);}
      });
    },{threshold:.55});
    counters.forEach(el=>counterObserver.observe(el));
  }else counters.forEach(animateCounter);
}

const sectionLinks=[...document.querySelectorAll('.primary-nav a[href^="#"]')];
const sections=sectionLinks.map(link=>document.querySelector(link.getAttribute('href'))).filter(Boolean);
if(sections.length&&'IntersectionObserver'in window){
  const activeObserver=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        sectionLinks.forEach(link=>link.classList.toggle('active',link.getAttribute('href')==='#'+entry.target.id));
      }
    });
  },{rootMargin:'-35% 0px -55%'});
  sections.forEach(section=>activeObserver.observe(section));
}

const hero=document.querySelector('.innovation-hero');
const visual=document.querySelector('.hero-visual');
if(hero&&visual&&!reduceMotion&&window.matchMedia('(pointer:fine)').matches){
  hero.addEventListener('pointermove',event=>{
    const box=hero.getBoundingClientRect();
    const x=(event.clientX-box.left)/box.width-.5;
    const y=(event.clientY-box.top)/box.height-.5;
    visual.style.transform=`translate3d(${x*10}px,${y*8}px,0)`;
  });
  hero.addEventListener('pointerleave',()=>visual.style.transform='translate3d(0,0,0)');
}

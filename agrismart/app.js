const toggle=document.querySelector('.menu-toggle');
const nav=document.querySelector('#agrismart-nav');
if(toggle&&nav){toggle.addEventListener('click',()=>{const open=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open));});nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');toggle.setAttribute('aria-expanded','false');}));}
const year=document.querySelector('#year');if(year)year.textContent=new Date().getFullYear();

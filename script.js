const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('.primary-nav');
const menuLabel = menuButton?.querySelector('.sr-only');

function setMenu(open) {
  if (!menuButton || !navigation) return;
  menuButton.setAttribute('aria-expanded', String(open));
  navigation.classList.toggle('open', open);
  document.body.classList.toggle('menu-open', open);
  if (menuLabel) menuLabel.textContent = open ? 'Close menu' : 'Open menu';
}

menuButton?.addEventListener('click', () => {
  setMenu(menuButton.getAttribute('aria-expanded') !== 'true');
});

navigation?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => setMenu(false));
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') setMenu(false);
});

const fontToggle = document.querySelector('#font-toggle');
const contrastToggle = document.querySelector('#contrast-toggle');

function setPreference(button, className, storageKey) {
  const active = !document.body.classList.contains(className);
  document.body.classList.toggle(className, active);
  button?.setAttribute('aria-pressed', String(active));
  localStorage.setItem(storageKey, String(active));
}

if (localStorage.getItem('whsf-large-text') === 'true') {
  document.body.classList.add('large-text');
  fontToggle?.setAttribute('aria-pressed', 'true');
}
if (localStorage.getItem('whsf-high-contrast') === 'true') {
  document.body.classList.add('high-contrast');
  contrastToggle?.setAttribute('aria-pressed', 'true');
}

fontToggle?.addEventListener('click', () => setPreference(fontToggle, 'large-text', 'whsf-large-text'));
contrastToggle?.addEventListener('click', () => setPreference(contrastToggle, 'high-contrast', 'whsf-high-contrast'));

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);

document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));

const form = document.querySelector('#contact-form');
const formStatus = document.querySelector('#form-status');

form?.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;

  const data = new FormData(form);
  const name = `${data.get('firstName')} ${data.get('lastName')}`.trim();
  const subject = encodeURIComponent(`WHSF enquiry: ${data.get('interest')}`);
  const body = encodeURIComponent(
    `Name: ${name}\nEmail: ${data.get('email')}\nInterest: ${data.get('interest')}\n\n${data.get('message')}`
  );

  if (formStatus) formStatus.textContent = 'Opening your email application…';
  window.location.href = `mailto:info@worldhsfoundation.org?subject=${subject}&body=${body}`;
});

document.querySelector('#year').textContent = new Date().getFullYear();

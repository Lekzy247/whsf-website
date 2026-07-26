(()=>{
  if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("/agrilearn-sw.js").catch(()=>{}));
  let deferred;window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferred=e;const b=document.createElement("button");b.className="ag-btn ag-btn-primary install-app";b.textContent="Install AgriLearn";b.onclick=async()=>{b.remove();deferred.prompt();await deferred.userChoice;deferred=null};document.body.appendChild(b)});
  const output=document.querySelector("#analysis-output"),crop=document.querySelector("#crop-select"),part=document.querySelector("#plant-part"),btn=document.querySelector("#analyze-btn");
  if(btn&&window.AgriLearnAPI){btn.addEventListener("click",()=>setTimeout(()=>{if(!crop.value)return;window.AgriLearnAPI.saveSession({crop:crop.options[crop.selectedIndex].text,plantPart:part.value,result:output?.innerText||"Prototype analysis"});renderSessions()},80))}
  function renderSessions(){const host=document.querySelector("#saved-sessions");if(!host||!window.AgriLearnAPI)return;const items=window.AgriLearnAPI.getSessions();host.innerHTML=items.length?items.slice(0,5).map(x=>`<div class="saved-session"><strong>${x.crop}</strong><small>${new Date(x.savedAt).toLocaleString()} · ${x.plantPart}</small></div>`).join(""):"<p>No saved prototype sessions yet.</p>"}
  renderSessions();
})();
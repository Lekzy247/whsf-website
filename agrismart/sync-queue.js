(() => {
'use strict';
const KEY='agrismart-sync-queue';
const read=()=>JSON.parse(localStorage.getItem(KEY)||'[]');
const write=(q)=>localStorage.setItem(KEY,JSON.stringify(q));
function enqueue(action,payload){const q=read();q.push({id:crypto.randomUUID(),action,payload,createdAt:new Date().toISOString()});write(q);return q.length;}
function dequeue(){const q=read();const item=q.shift()||null;write(q);return item;}
function pending(){return read();}
window.AgriSmartSyncQueue=Object.freeze({enqueue,dequeue,pending});
})();
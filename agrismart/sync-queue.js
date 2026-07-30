(() => {
'use strict';
const KEY='agrismart-sync-queue';
const read=()=>{try{const value=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(value)?value:[];}catch{return [];}};
const write=(q)=>localStorage.setItem(KEY,JSON.stringify(q));
function enqueue(action,payload){
  const q=read();
  const entry={id:crypto.randomUUID(),action,payload,createdAt:new Date().toISOString()};
  if(action==='collection.snapshot'&&payload?.collection){
    const index=q.findIndex(item=>item.action===action&&item.payload?.collection===payload.collection);
    if(index>=0)q[index]=entry;else q.push(entry);
  }else q.push(entry);
  write(q);
  return q.length;
}
function dequeue(){const q=read();const item=q.shift()||null;write(q);return item;}
function pending(){return read();}
window.AgriSmartSyncQueue=Object.freeze({enqueue,dequeue,pending});
})();

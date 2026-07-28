(() => {
'use strict';
const state={provider:null,lastUpdate:null};
async function configure(provider){state.provider=provider||null;return !!state.provider;}
async function getPrices(crops=[]){if(!state.provider) throw new Error('Market provider not configured.');state.lastUpdate=new Date().toISOString();return {updatedAt:state.lastUpdate,prices:crops.map(c=>({crop:c,price:null,currency:'USD'}))};}
function status(){return {...state};}
window.AgriSmartMarket=Object.freeze({configure,getPrices,status});
})();
(() => {
'use strict';
const state={provider:null,lastForecast:null};
async function configure(provider){state.provider=provider||null;return !!state.provider;}
async function forecast(location){if(!state.provider) throw new Error('Weather provider not configured.');return state.lastForecast={location,fetchedAt:new Date().toISOString(),forecast:null};}
function status(){return {...state};}
window.AgriSmartWeather=Object.freeze({configure,forecast,status});
})();
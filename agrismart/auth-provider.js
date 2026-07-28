(() => {
  'use strict';
  const state={user:null};
  async function signIn(){throw new Error('Authentication provider not configured.');}
  async function signOut(){state.user=null;return true;}
  function getCurrentUser(){return state.user;}
  function isAuthenticated(){return !!state.user;}
  window.AgriSmartAuth=Object.freeze({signIn,signOut,getCurrentUser,isAuthenticated});
})();
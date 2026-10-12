// Subscription-only token: no management login and no subscriber session.
(async()=>{
 const progress=document.getElementById('confirmation-progress');
 let timeout;
 try{
  const token=new URLSearchParams(location.hash.slice(1)).get('token')||'';
  history.replaceState(null,'','/subscriptions?confirm=1');
  if(!/^[a-f0-9]{64}$/.test(token)){
   progress.textContent='This page no longer has a valid confirmation token. Reopen the original email link, or request a fresh link below.';return;
  }
  const controller=new AbortController();
  timeout=setTimeout(()=>controller.abort(),20000);
  const response=await fetch('/subscriptions',{method:'POST',credentials:'omit',cache:'no-store',signal:controller.signal,headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({action:'confirm-subscription-link',token})});
  const html=await response.text(),documentResponse=new DOMParser().parseFromString(html,'text/html'),main=documentResponse.querySelector('main');
  if(!main)throw Error('Confirmation unavailable');
  document.querySelector('main').replaceWith(main);document.title=documentResponse.title;
  history.replaceState(null,'','/subscriptions');
 }catch{
  // No token, request body, URL or exception is logged or displayed.
  progress.textContent='Confirmation could not be completed or the request timed out. Reopen the original email link to try again, or request a fresh link below. A repeated visit will not duplicate subscriptions.';
 }finally{if(timeout)clearTimeout(timeout);}
})();

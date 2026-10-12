// Subscription-only token: no management login and no subscriber session.
(async()=>{
 const token=new URLSearchParams(location.hash.slice(1)).get('token')||'';
 history.replaceState(null,'','/subscriptions?confirm=1');
 const progress=document.getElementById('confirmation-progress');
 if(!/^[a-f0-9]{64}$/.test(token)){
  progress.textContent='This confirmation link is missing or invalid. Please request a fresh link.';
  const link=document.createElement('a');link.href='/subscriptions';link.textContent='Request a confirmation link';progress.after(link);return;
 }
 try{
  const response=await fetch('/subscriptions',{method:'POST',credentials:'omit',cache:'no-store',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({action:'confirm-subscription-link',token})});
  const html=await response.text(),documentResponse=new DOMParser().parseFromString(html,'text/html'),main=documentResponse.querySelector('main');
  if(!main)throw Error('Confirmation unavailable');
  document.querySelector('main').replaceWith(main);document.title=documentResponse.title;
  history.replaceState(null,'','/subscriptions');
 }catch{
  progress.textContent='Confirmation could not be completed. Please reopen the original email link to try again. A repeated visit will not duplicate subscriptions.';
 }
})();

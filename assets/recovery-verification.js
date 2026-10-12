(()=>{
 const progress=document.getElementById('verification-progress');
 const restart=document.getElementById('verification-restart');
 restart.href=location.pathname;
 try{
  const params=new URLSearchParams(location.hash.slice(1)),id=params.get('id')||'',token=params.get('token')||'';
  history.replaceState(null,'',location.pathname);
  if(!/^[0-9a-f-]{36}$/.test(id)||! /^[0-9a-f]{64}$/.test(token)){progress.textContent='This link is invalid or no longer available. Reopen your original email or request a new link.';return;}
  document.getElementById('verification-id').value=id;
  document.getElementById('verification-token').value=token;
  const form=document.getElementById('verification-link-form');
  form.hidden=false;
  progress.textContent='Verifying your email. If this does not continue, select Continue or request a new link.';
  form.requestSubmit();
 }catch{progress.textContent='Unable to continue. Reopen the email link, use your fallback code, or request a new link.';}
})();

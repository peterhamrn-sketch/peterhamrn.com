// Progressive enhancement only: all draft and delivery operations remain server-authorized.
for(const form of document.querySelectorAll('.draft-editor')){
 const message=form.querySelector('.message-editor');
 const grow=()=>{message.style.height='auto';message.style.height=Math.max(260,message.scrollHeight+4)+'px';};
 message.addEventListener('input',grow);grow();
 const mode=form.querySelector('[name=mode]'),publication=form.querySelector('.publication-field');
 const toggle=()=>{publication.hidden=mode.value!=='published';};mode.addEventListener('change',toggle);toggle();
 const choices=[...form.querySelectorAll('[name=announcement_topics]')],sender=form.querySelector('[name=sender_topic]');
 const refresh=()=>{const selected=choices.filter(c=>c.checked).map(c=>c.value);for(const option of sender.options)if(option.value)option.disabled=!selected.includes(option.value);if(sender.value&&!selected.includes(sender.value))sender.value='';};
 choices.forEach(c=>c.addEventListener('change',refresh));refresh();
}

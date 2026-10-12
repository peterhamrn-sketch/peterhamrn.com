// Subscription announcements only. Transactional senders remain unchanged.
export const announcementTopics=new Map([
 ['little-mini','Little Mini'],['recovery-tags','Recovery Tags'],['asm-instructor','ASM Instructor'],
 ['classes-basic','Basic ASM Classes'],['classes-advanced','Advanced ASM Classes']
]);
const identities={
 'little-mini':{address:'littlemini@peterhamrn.com',reply_to:'support@peterhamrn.com',label:'Little Mini Updates'},
 'recovery-tags':{address:'recovery@peterhamrn.com',reply_to:'support@peterhamrn.com',label:'Recovery Tags Updates'},
 'asm-instructor':{address:'asm@peterhamrn.com',reply_to:'peter@peterhamrn.com',label:'ASM Instructor Updates'},
 'classes-basic':{address:'classes@peterhamrn.com',reply_to:'classes@peterhamrn.com',label:'Basic ASM Classes'},
 'classes-advanced':{address:'classes@peterhamrn.com',reply_to:'classes@peterhamrn.com',label:'Advanced ASM Classes'}
};
export function announcementIdentity(topics,selected=''){
 if(!topics.length||topics.some(t=>!identities[t]))throw Error('Select a supported subscription audience.');
 if(topics.includes('asm-instructor')&&topics.some(t=>t.startsWith('classes-')))throw Error('ASM Instructor software and Classes announcements must remain separate.');
 if(selected&&!topics.includes(selected))throw Error('Choose a sender identity belonging to the selected audience.');
 const addresses=new Set(topics.map(t=>identities[t].address));
 if(addresses.size>1&&!selected)throw Error('This audience has different sender identities. Explicitly choose one of its topics as the sender.');
 const topic=selected||topics[0],identity=identities[topic];
 const label=topics.length===2&&topics.every(t=>t.startsWith('classes-'))?'ASM Classes Updates':topics.map(t=>identities[t].label).join(' · ');
 return {...identity,topic,label,from:`PeterHamRN.com <${identity.address}>`};
}
export function deliveryExtras(content){
 // Preserve previously frozen payloads, including their original sender, on recovery.
 return {html:content.html,headers:content.headers,...(content.from?{from:content.from,reply_to:content.reply_to}:{})};
}

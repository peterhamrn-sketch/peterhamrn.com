// Portable public display rules. Never mutate lifecycle or publication records.
(function(root){
 'use strict';
 const formatter=new Intl.DateTimeFormat('en-US',{
  timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',
  hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'
 });
 function easternNow(now=new Date()){
  const parts=formatter.formatToParts(now);
  const value=type=>parts.find(part=>part.type===type).value;
  return `${value('year')}-${value('month')}-${value('day')}T${value('hour')}:${value('minute')}:${value('second')}`;
 }
 function classify(item,now=easternNow()){
  // With no published end time, keep the class upcoming through its Eastern date.
  const end=`${item.date}T${item.endTime?item.endTime+':00':'24:00:00'}`;
  const isPast=now>=end;
  const status=item.classStatus===undefined?'scheduled':item.classStatus;
  return {isPast,displayStatus:status==='canceled'?'canceled':status==='completed'?'completed':isPast?'past':'scheduled',calendarAllowed:status==='scheduled'&&!isPast};
 }
 root.ClassPublicDisplay=Object.freeze({easternNow,classify});
})(globalThis);

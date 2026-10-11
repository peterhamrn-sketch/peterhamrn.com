// Private service binding only; the publisher has no public routes or workers.dev URL.
export async function publisherRequest(env,path,input={}){
 if(!env.LITTLE_MINI_PUBLISHER)throw Error('The Little Mini publisher service binding is unavailable.');
 const response=await env.LITTLE_MINI_PUBLISHER.fetch('https://internal'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
 const result=await response.json();
 if(!response.ok)throw Error(result.error||'The publisher could not update its alarm.');
 return result;
}

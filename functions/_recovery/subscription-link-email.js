import {esc} from './subscriptions.js';
// Keep the existing transactional Resend sender; announcement identities are separate.
export function subscriptionLinkEmail(purpose,labels,url){
 const manage=purpose==='manage',button=manage?'Manage My Subscriptions':'Confirm My Subscription';
 const subject=manage?'Your subscription management link':'Confirm your PeterHamRN.com subscriptions';
 const message=manage?'Open the link below, then select Confirm to securely access your subscription preferences. This does not subscribe you to anything.':'Open the link below, then select Confirm to enable only these subscriptions: '+labels.join(', ')+'.';
 const expiry=manage?'30 minutes':'24 hours';
 const text=`${button}\n\n${message}\n\n${button}: ${url}\n\nThis link expires in ${expiry} and can be used only once. Opening it alone changes nothing. No code entry is required.\n\nIf you did not request this link, ignore this email.\nPeterHamRN.com`;
 const html=`<!doctype html><html lang="en"><body style="margin:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#102440"><div style="max-width:600px;margin:24px auto;padding:32px;background:#fff;border-radius:12px"><p style="color:#0b62bf;font-weight:bold">PeterHamRN.com</p><h1 style="font-size:26px;line-height:1.3">${esc(button)}</h1><p style="font-size:17px;line-height:1.6">${esc(message)}</p><p style="margin:28px 0"><a href="${esc(url)}" style="display:inline-block;background:#0b62bf;color:#fff;text-decoration:none;padding:14px 22px;border-radius:7px;font-weight:bold">${esc(button)}</a></p><p style="line-height:1.6">This link expires in ${expiry} and can be used only once. Opening it alone changes nothing. No code entry is required.</p><p style="font-size:13px;color:#526478">If you did not request this link, ignore this email.</p></div></body></html>`;
 return {subject,text,html};
}

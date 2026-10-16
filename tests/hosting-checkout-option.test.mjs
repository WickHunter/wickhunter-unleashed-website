import assert from 'node:assert/strict';
import test from 'node:test';
import {options,response,settle,page,card,click} from './website-fixture.mjs';
function select(ctx,plan){const c=card(ctx,plan),box=c.querySelector('[data-hosting-select]');box.checked=true;box.dispatchEvent(new ctx.dom.window.Event('change',{bubbles:true}));return c.querySelector('[data-software-buy]');}
for(const hosting of [{...options,purchasable:false},{...options,priceIsProposed:true},{...options,maximumConnectedAccounts:0},{...options,combinedCheckoutEnabled:false}]){
 test('hosting eligibility is enforced: '+JSON.stringify(hosting),async()=>{const ctx=await page('index.html',{hosting});try{assert.equal(ctx.dom.window.document.querySelector('[name="hosting"][value="managed"]').disabled,true);for(const key of ['monthly','yearly','lifetime'])assert.equal(card(ctx,key).querySelector('[data-hosting-select]').disabled,true);}finally{ctx.dom.window.close();}});
}
test('ambiguous hosted failure retries the same attempt; a different plan gets a different attempt',async()=>{
 const seen=[];let fail=true;const ctx=await page('index.html',{checkout:body=>{seen.push(body);if(fail){fail=false;throw Error('network');}return response({ok:true,url:'https://checkout.stripe.com/c/pay/hosted'});}});
 try{const monthly=select(ctx,'monthly');click(ctx,monthly);await settle();assert.equal(monthly.getAttribute('aria-disabled'),'false');click(ctx,monthly);await settle();assert.equal(seen[0].attemptId,seen[1].attemptId);click(ctx,select(ctx,'yearly'));await settle();assert.notEqual(seen[1].attemptId,seen[2].attemptId);assert.equal(seen[2].hosting,true);}finally{ctx.dom.window.close();}
});
test('hosted timeout restores retry and retains the same request identity',async()=>{
 const ctx=await page('index.html',{checkout:(_body,init)=>new Promise((_,reject)=>init.signal.addEventListener('abort',()=>reject(Error('aborted'))))});
 try{ctx.dom.window.document.body.setAttribute('data-launch-checkout-timeout-ms','15');const link=select(ctx,'monthly');click(ctx,link);await new Promise(r=>setTimeout(r,35));await settle();assert.equal(link.getAttribute('aria-disabled'),'false');assert.match(card(ctx,'monthly').querySelector('[data-hosting-card-status]').textContent,/could not be opened/);assert.deepEqual(ctx.navigation,[]);}finally{ctx.dom.window.close();}
});
test('invalid or expired hosted sessions show a useful message and never navigate',async()=>{
 for(const [status,data,message] of [[503,{ok:false,code:'HOSTED_CHECKOUT_CAPACITY',retryAfterSeconds:120},/capacity/],[410,{ok:false,code:'HOSTED_CHECKOUT_EXPIRED'},/expired/],[409,{ok:false,code:'HOSTED_CHECKOUT_EXPIRY_PENDING'},/expiry/]]){
  const ctx=await page('index.html',{checkout:()=>response(data,false,status)});try{click(ctx,select(ctx,'monthly'));await settle();assert.match(card(ctx,'monthly').querySelector('[data-hosting-card-status]').textContent,message);assert.deepEqual(ctx.navigation,[]);}finally{ctx.dom.window.close();}
 }
});

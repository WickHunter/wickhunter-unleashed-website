import assert from 'node:assert/strict';
import test from 'node:test';
import {live, options, response, settle, page, card, click} from './website-fixture.mjs';
for(const file of ['index.html','unleashed/index.html']){
 test(file+': all software routes, crypto and hosted checkout use the current billing contract',async()=>{
  const ctx=await page(file,{ref:'partner-42'});try{
   for(const plan of ['monthly','yearly','lifetime']){
    const c=card(ctx,plan),a=c.querySelector('[data-software-buy]');assert.equal(a.getAttribute('aria-disabled'),'false');assert.equal(new URL(a.href).pathname,'/buy');assert.equal(new URL(a.href).searchParams.get('plan'),plan);assert.equal(new URL(a.href).searchParams.get('ref'),'partner-42');
   }
   for(const plan of ['yearly','lifetime']){const link=card(ctx,plan).querySelector('[data-crypto-buy]');assert.equal(link.hidden,false);click(ctx,link);await settle();const call=ctx.calls.filter(x=>x.url.endsWith('/api/billing/checkout')).at(-1);assert.equal(call.url,'https://hub.wickhunterunleashed.com/api/billing/checkout');assert.equal(JSON.parse(call.init.body).payment,'crypto');assert.equal(JSON.parse(call.init.body).plan,plan);assert.equal(call.init.credentials,'omit');assert.equal(ctx.navigation.at(-1),'https://checkout.stripe.com/c/pay/verified');}
   if(file==='index.html'){const radio=ctx.dom.window.document.querySelector('[name="hosting"][value="managed"]');assert.equal(radio.disabled,false);radio.checked=true;radio.dispatchEvent(new ctx.dom.window.Event('change',{bubbles:true}));}
   for(const plan of ['monthly','yearly','lifetime']){
    const c=card(ctx,plan),box=c.querySelector('[data-hosting-select]');assert.equal(box.disabled,false);box.checked=true;box.dispatchEvent(new ctx.dom.window.Event('change',{bubbles:true}));
    click(ctx,c.querySelector('[data-software-buy]'));await settle();const call=ctx.calls.filter(x=>x.url.endsWith('/api/billing/checkout')).at(-1);const body=JSON.parse(call.init.body);assert.equal(body.plan,plan);assert.equal(body.hosting,true);assert.equal(body.payment,'card');assert.equal(body.referral,'partner-42');assert.ok(body.attemptId);assert.equal(ctx.navigation.at(-1),'https://checkout.stripe.com/c/pay/verified');
   }
   assert.equal(card(ctx,'monthly').querySelector('[data-plan-price]').textContent,'119');assert.equal(card(ctx,'yearly').querySelector('[data-plan-price]').textContent,'939');assert.equal(card(ctx,'lifetime').querySelector('[data-plan-price]').textContent,'999');
  }finally{ctx.dom.window.close();}
 });
}
test('unknown or test billing disables purchases and hosting; unavailable hosting does not block software',async()=>{
 for(const billing of [{ok:false},{...live,mode:'test'}]){
 const ctx=await page('index.html',{billing});try{assert.equal(card(ctx,'monthly').querySelector('[data-software-buy]').getAttribute('aria-disabled'),'true');assert.equal(ctx.dom.window.document.querySelector('[name="hosting"][value="managed"]').disabled,true);click(ctx,card(ctx,'monthly').querySelector('[data-software-buy]'));assert.equal(ctx.calls.filter(x=>x.url.endsWith('/api/billing/checkout')).length,0);}finally{ctx.dom.window.close();}}
 const ctx=await page('index.html',{hosting:{ok:false}});try{assert.equal(card(ctx,'monthly').querySelector('[data-software-buy]').getAttribute('aria-disabled'),'false');assert.equal(ctx.dom.window.document.querySelector('[name="hosting"][value="managed"]').disabled,true);}finally{ctx.dom.window.close();}
});
test('failed or unsafe checkout never navigates and retry keeps its idempotent identity',async()=>{
 let attempt=0;const ctx=await page('index.html',{checkout:()=>++attempt===1?response({ok:true,url:'https://attacker.example/pay'}):response({ok:true,url:'https://checkout.stripe.com/c/pay/retry'})});
 try{const c=card(ctx,'yearly');const crypto=c.querySelector('[data-crypto-buy]');click(ctx,crypto);await settle();assert.deepEqual(ctx.navigation,[]);assert.equal(crypto.getAttribute('aria-disabled'),'false');click(ctx,crypto);await settle();const calls=ctx.calls.filter(x=>x.url.endsWith('/api/billing/checkout')).map(x=>JSON.parse(x.init.body));assert.equal(calls[0].attemptId,calls[1].attemptId);assert.deepEqual(ctx.navigation,['https://checkout.stripe.com/c/pay/retry']);}finally{ctx.dom.window.close();}
});
test('redesign exposes customer login, Bybit demo, valid local anchors and functioning bot tabs',async()=>{
 const ctx=await page();try{const d=ctx.dom.window.document;assert.ok(d.querySelectorAll('a[href="/customer"]').length>=3);assert.match(d.body.textContent,/Bybit demo trading/);assert.doesNotMatch(d.body.textContent,/coming soon|DESIGN PREVIEW|purchases disabled|October 15/);for(const a of d.querySelectorAll('a[href^="#"]'))assert.ok(d.getElementById(a.getAttribute('href').slice(1)));d.querySelector('[data-bot="hedge"]').click();assert.match(d.querySelector('#bot-title').textContent,/opposing position/);}finally{ctx.dom.window.close();}
});

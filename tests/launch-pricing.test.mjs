import assert from 'node:assert/strict';
import test from 'node:test';
import {live, page, card} from './website-fixture.mjs';
for(const file of ['index.html','unleashed/index.html']){
 test(file+': retired launch campaigns cannot reappear even when stale Hub data says active',async()=>{
  const ctx=await page(file,{billing:{...live,launch:{...live.launch,active:true,firstPaymentAtMs:Date.parse('2026-10-15T04:00:00Z'),redeemUntilMs:Date.parse('2026-10-16T04:00:00Z')}}});
  try{assert.equal(ctx.dom.window.document.querySelector('[data-free-announcement]'),null);assert.equal(ctx.dom.window.document.querySelector('[data-starter-announcement]'),null);assert.equal(ctx.dom.window.document.querySelector('[data-launch-offer]'),null);assert.doesNotMatch(ctx.dom.window.document.body.textContent,/free until October|new signup.*October/);}finally{ctx.dom.window.close();}
 });
 test(file+': published plan amounts follow current Hub prices, and crypto remains limited to eligible plans',async()=>{
  const billing=structuredClone(live);billing.plans[0].amountCents=10900;billing.plans[1].amountCents=74900;billing.plans[1].cryptoAvailable=false;
  const ctx=await page(file,{billing});try{assert.equal(card(ctx,'monthly').querySelector('[data-plan-price]').textContent,'109');assert.equal(card(ctx,'yearly').querySelector('[data-plan-price]').textContent,'749');assert.equal(card(ctx,'yearly').querySelector('[data-crypto-buy]').hidden,true);assert.equal(card(ctx,'lifetime').querySelector('[data-crypto-buy]').hidden,false);}finally{ctx.dom.window.close();}
 });
}

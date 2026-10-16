import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const site=readFileSync(new URL('../assets/site.js',import.meta.url),'utf8');
const redesign=readFileSync(new URL('../assets/redesign.js',import.meta.url),'utf8');
const live={ok:true,mode:'live',launch:{active:false,cryptoEnabled:true,hostingCheckoutEnabled:true},plans:[{key:'monthly',amountCents:9900},{key:'yearly',amountCents:69900,cryptoAvailable:true},{key:'lifetime',amountCents:99900,cryptoAvailable:true}]};
const options={ok:true,purchasable:true,priceIsProposed:false,monthlyPriceLabel:'$20.00',maximumConnectedAccounts:5,combinedCheckoutEnabled:true,managedBackupsIncluded:false,regions:[{label:'Tokyo'}]};
const response=(data,ok=true,status=200)=>({ok,status,headers:{get:()=>null},json:async()=>data});
const settle=async()=>{await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r));};
async function page(file='index.html',{billing=live,hosting=options,checkout=()=>response({ok:true,url:'https://checkout.stripe.com/c/pay/verified'}),ref=''}={}){
 const html=readFileSync(new URL('../'+file,import.meta.url),'utf8');
 const dom=new JSDOM(html,{url:'https://www.wickhunterunleashed.com/'+(file==='index.html'?'':'unleashed/')+(ref?'?ref='+ref:''),runScripts:'outside-only'});
 const calls=[],navigation=[];
 dom.window.HTMLAnchorElement.prototype.click=function(){navigation.push(this.href);};
 dom.window.fetch=async(url,init={})=>{calls.push({url:String(url),init});if(String(url).endsWith('/api/billing/plans'))return response(billing);if(String(url).endsWith('/api/hosting/options'))return response(hosting);if(String(url).endsWith('/api/billing/checkout'))return checkout(JSON.parse(init.body),init);return response({ok:false},false,404);};
 dom.window.eval(site);if(file==='index.html')dom.window.eval(redesign);await settle();return {dom,calls,navigation};
}
const card=(ctx,key)=>ctx.dom.window.document.querySelector(`[data-plan="${key}"]`);
const click=(ctx,node)=>node.dispatchEvent(new ctx.dom.window.MouseEvent('click',{bubbles:true,cancelable:true}));

export { live, options, response, settle, page, card, click };

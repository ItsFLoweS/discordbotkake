import { setTimeout as delay } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';
import { byId } from './catalog.mjs';
import { getVar, setVar, owner, log } from './store.mjs';
import { action } from './actions.mjs';
const unsafe=new Set(['__proto__','prototype','constructor']);
export function pathGet(obj,path) { return String(path).split('.').reduce((a,k)=>unsafe.has(k)?undefined:a?.[k],obj); }
export function plain(value) { if(value===undefined)return null; if(typeof value==='bigint')return String(value); if(value===null||typeof value!=='object')return value; try{return JSON.parse(JSON.stringify(value,(_,v)=>typeof v==='bigint'?String(v):v));}catch{return String(value);} }
function parse(value) { if(typeof value!=='string')return value; try{return JSON.parse(value);}catch{return value;} }
export function resolveValue(value,ctx) {
 if(typeof value==='string') {
  const lookup=path=>{const [scope,key,...rest]=path.trim().split('.'); if(['global','guildVar','userVar','channelVar'].includes(scope)){const s={global:'global',guildVar:'guild',userVar:'user',channelVar:'channel'}[scope]; const v=getVar(ctx.project.id,s,owner(ctx,s),key);return rest.length?pathGet(v,rest.join('.')):v;}return pathGet(ctx,path.trim());};
  const exact=value.match(/^\{\{\s*([^{}]+?)\s*\}\}$/); if(exact)return lookup(exact[1]);
  return value.replace(/\{\{\s*([^{}]+?)\s*\}\}/g,(_,p)=>{const v=lookup(p); return v==null?'':typeof v==='object'?JSON.stringify(v):String(v);});
 }
 if(Array.isArray(value))return value.map(v=>resolveValue(v,ctx));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!unsafe.has(k)).map(([k,v])=>[k,resolveValue(v,ctx)]));
 return value;
}
export function params(node,ctx) { const result={}; for(const f of byId[node.data.kind].fields){ let v=node.data.params?.[f.key]??f.default; if(f.type==='json')v=parse(v); result[f.key]=resolveValue(v,ctx); if(f.type==='number')result[f.key]=Number(result[f.key]); }return result; }
export const runs=new Map();
class FlowSignal extends Error {constructor(type){super(type);this.type=type;}}
export function cancelRun(id){const r=runs.get(id);if(r){r.controller.abort();r.release?.();}}
export function resumeRun(id,step=false){const r=runs.get(id);if(r){r.step=step;r.skipPause=true;r.release?.();}}
export function inspectRun(id){const r=runs.get(id);if(!r)return null;return {id:r.id,status:r.status,scenario:r.scenario,active:r.active,trace:r.trace.slice(-200),temp:plain(r.ctx.temp),started:r.started,finished:r.finished,error:r.error};}
export function startRun(project,scenario,input,services){
 const r={id:randomUUID(),project:project.id,scenario:scenario.id,status:'running',active:null,trace:[],started:Date.now(),controller:new AbortController(),step:false};
 const ctx={...input,project,temp:{},args:input.args||{},options:input.options||{},locale:input.locale||'ru',services,run:r};r.ctx=ctx;runs.set(r.id,r);
 for(const [id,old] of runs)if(runs.size>100&&old.status!=='running'&&old.status!=='paused')runs.delete(id);
 r.promise=(async()=>{try{await execute(scenario,ctx,{steps:0,depth:0,loop:0});r.status=r.controller.signal.aborted?'stopped':'completed';}catch(e){if(e instanceof FlowSignal&&e.type==='stop')r.status='completed';else if(r.controller.signal.aborted)r.status='stopped';else{r.status='error';r.error=String(e.message);log(project.id,'error',`${scenario.name}: ${r.error}`);}}finally{r.finished=Date.now();r.active=null;}})();return r.id;
}
export async function execute(scenario,ctx,budget) {
 const start=scenario.nodes.find(n=>n.data?.kind?.startsWith('trigger.')); if(!start)throw Error('Сценарий без триггера');
 const next=(id,port='next')=>scenario.edges.find(e=>e.source===id&&(e.sourceHandle||'next')===port)?.target;
 async function walk(id){while(id){
  if(ctx.run.controller.signal.aborted)throw Error('Запуск остановлен');
  if(++budget.steps>10000)throw Error('Превышен лимит 10 000 шагов; проверьте циклы');
  const n=scenario.nodes.find(n=>n.id===id);if(!n)throw Error('Блок не найден');const kind=n.data.kind;const p=params(n,ctx);
  ctx.run.active=n.id;
  if((n.data.breakpoint||ctx.run.step)&&!ctx.run.skipPause){ctx.run.status='paused';await new Promise(resolve=>ctx.run.release=resolve);ctx.run.release=null;ctx.run.status='running';if(ctx.run.controller.signal.aborted)throw Error('Запуск остановлен');}
  ctx.run.skipPause=false;
  const entry={node:n.id,title:byId[kind].title,time:Date.now(),status:'running'};ctx.run.trace.push(entry);
  if(ctx.run.trace.length>500)ctx.run.trace.shift();
  try{
   let port='next',result;
   if(kind.startsWith('trigger.')||kind==='flow.comment'){}
   else if(kind==='flow.wait')await delay(Math.max(0,Math.min(Number(p.ms)||0,86400000)),undefined,{signal:ctx.run.controller.signal});
   else if(kind==='flow.loop'){
    const items=p.mode==='each'?parse(p.items):Array.from({length:Math.max(0,Math.min(10000,p.count||0))},(_,i)=>i);if(!Array.isArray(items))throw Error('Для цикла нужен массив');
    const oldIndex=ctx.temp.index,oldItem=ctx.temp.item;budget.loop++;
    try{for(let i=0;i<items.length;i++){ctx.temp.index=i;ctx.temp.item=items[i];try{await walk(next(n.id,'body'));}catch(e){if(e instanceof FlowSignal&&e.type==='break')break;if(!(e instanceof FlowSignal&&e.type==='continue'))throw e;}}}finally{budget.loop--;ctx.temp.index=oldIndex;ctx.temp.item=oldItem;}port='done';
   }else if(kind==='flow.break'||kind==='flow.continue'){if(!budget.loop)throw Error('Этот блок работает только внутри цикла');throw new FlowSignal(kind.split('.')[1]);}
   else if(kind==='flow.stop')throw new FlowSignal('stop');
   else if(kind==='flow.try'){try{await walk(next(n.id,'body'));}catch(e){if(e instanceof FlowSignal||ctx.run.controller.signal.aborted)throw e;ctx.temp.error={message:e.message};if(!next(n.id,'catch'))throw e;await walk(next(n.id,'catch'));}port='done';}
   else if(kind==='flow.call'){if(budget.depth>=16)throw Error('Слишком глубокие вызовы сценариев');const sub=ctx.project.scenarios.find(s=>s.id===p.scenario);if(!sub)throw Error('Сценарий не найден');const previous=ctx.args;ctx.args=p.args;budget.depth++;try{await execute(sub,ctx,budget);result=ctx.temp.result;}finally{budget.depth--;ctx.args=previous;}}
   else if(kind==='variable.get'){result=p.scope==='temp'?(ctx.temp[p.key]??parse(p.fallback)):getVar(ctx.project.id,p.scope,owner(ctx,p.scope),p.key,parse(p.fallback));}
   else if(kind==='variable.set'){
    if(unsafe.has(p.key))throw Error('Недопустимое имя переменной');let old=p.scope==='temp'?ctx.temp[p.key]:getVar(ctx.project.id,p.scope,owner(ctx,p.scope),p.key);const value=parse(p.value);
    switch(p.operation){case 'set':result=value;break;case 'add':result=Number(old||0)+Number(value);break;case 'subtract':result=Number(old||0)-Number(value);break;case 'multiply':result=Number(old||0)*Number(value);break;case 'divide':if(!Number(value))throw Error('Деление на ноль');result=Number(old||0)/Number(value);break;case 'push':result=[...(Array.isArray(old)?old:[]),value];break;case 'remove':result=(Array.isArray(old)?old:[]).filter(v=>JSON.stringify(v)!==JSON.stringify(value));break;case 'delete':result=undefined;break;}
    if(typeof result==='number'&&!Number.isFinite(result))throw Error('Результат не является конечным числом');if(p.scope==='temp'){if(result===undefined)delete ctx.temp[p.key];else ctx.temp[p.key]=result;}else setVar(ctx.project.id,p.scope,owner(ctx,p.scope),p.key,result);
   }else {result=await action(kind,p,ctx);if(kind.startsWith('condition.'))port=result?'true':'false';}
   if(p.output&&!unsafe.has(p.output))ctx.temp[p.output]=plain(result);entry.status='success';const encoded=JSON.stringify(plain(result));entry.result=encoded?.length>2000?encoded.slice(0,2000)+'…':plain(result);id=next(n.id,port);
  }catch(e){entry.status=e instanceof FlowSignal?'success':'error';entry.error=e.message;throw e;}
 }}
 await walk(start.id);
}

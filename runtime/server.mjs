import readline from 'node:readline';
import { randomUUID } from 'node:crypto';
import { dirname, delimiter } from 'node:path';
import ffmpeg from 'ffmpeg-static';
import { db, listProjects, getProject, saveProject, validateProject, encodeProject, decodeProject, transaction, setVar, projectFolder } from './store.mjs';
import { createProject, templates } from './templates.mjs';
import { catalog } from './catalog.mjs';
import { startBot, stopBot, botState, deployCommands, bots } from './bot.mjs';
import { runs, inspectRun, resumeRun, cancelRun } from './engine.mjs';
if(ffmpeg)process.env.PATH=dirname(ffmpeg)+delimiter+(process.env.PATH||'');
// stdout is the private line-delimited RPC channel to the Rust host.
console.log=(...args)=>console.error(...args);
async function dispatch(op,p){switch(op){
 case 'catalog':return {catalog,templates};
 case 'project.list':return listProjects().map(p=>({...p,bot:botState(p.id)}));
 case 'project.create':return saveProject(createProject(p.name,p.template));
 case 'project.get':return getProject(p.id);
 case 'project.save':return saveProject(p.project);
 case 'project.validate':return validateProject(p.project||getProject(p.id));
 case 'project.export':return encodeProject(getProject(p.id));
 case 'project.import':return decodeProject(p.content);
 case 'project.revisions':return db.prepare('SELECT id,created FROM revisions WHERE project=? ORDER BY created DESC').all(p.id);
 case 'project.restore':{const row=db.prepare('SELECT document FROM revisions WHERE id=? AND project=?').get(p.revision,p.id);if(!row)throw Error('Версия не найдена');return saveProject(JSON.parse(row.document));}
 case 'project.delete':{await stopBot(p.id);transaction(()=>{for(const table of ['variables','warnings','jobs','logs','cooldowns','giveaways','tickets','revisions'])db.prepare(`DELETE FROM ${table} WHERE project=?`).run(p.id);db.prepare('DELETE FROM projects WHERE id=?').run(p.id);});return true;}
 case 'project.files':return {path:projectFolder(p.id)};
 case 'bot.start':return startBot(p.id,p.token);
 case 'bot.stop':return stopBot(p.id);
 case 'bot.status':return botState(p.id);
 case 'bot.deploy':return deployCommands(p.id);
 case 'logs.list':return db.prepare('SELECT id,level,message,created FROM logs WHERE project=? ORDER BY id DESC LIMIT 300').all(p.id);
 case 'logs.clear':db.prepare('DELETE FROM logs WHERE project=?').run(p.id);return true;
 case 'variables.list':return db.prepare('SELECT scope,owner,key,value FROM variables WHERE project=? ORDER BY scope,key LIMIT 2000').all(p.id).map(r=>({...r,value:JSON.parse(r.value)}));
 case 'variables.set':if(!['global','guild','user','channel'].includes(p.scope)||typeof p.key!=='string')throw Error('Неверная переменная');return setVar(p.id,p.scope,String(p.owner||'*'),p.key,p.value);
 case 'variables.delete':return setVar(p.id,p.scope,p.owner,p.key,undefined);
 case 'runs.list':return [...runs.values()].filter(r=>r.project===p.id).slice(-30).reverse().map(r=>inspectRun(r.id));
 case 'runs.resume':resumeRun(p.run,p.step);return true;
 case 'runs.stop':cancelRun(p.run);return true;
 default:throw Error('Неизвестная операция DBK');
}}
const input=readline.createInterface({input:process.stdin,crlfDelay:Infinity});
let chain=Promise.resolve();
input.on('line',line=>{chain=chain.then(async()=>{try{if(line.length>15_000_000)throw Error('Слишком большой запрос');const request=JSON.parse(line);const result=await dispatch(request.op,request.payload||{});process.stdout.write(JSON.stringify({result},(_,v)=>typeof v==='bigint'?String(v):v)+'\n');}catch(e){let message=String(e.message||e);for(const b of bots.values())if(b.token)message=message.replaceAll(b.token,'[TOKEN]');process.stdout.write(JSON.stringify({error:message})+'\n');}});});
input.on('close',async()=>{await Promise.allSettled([...bots.keys()].map(stopBot));db.close();process.exit(0);});
process.on('uncaughtException',e=>{console.error(e);process.exit(1);});
process.on('unhandledRejection',e=>console.error(e));

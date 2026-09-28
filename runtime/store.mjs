import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, realpathSync, existsSync } from 'node:fs';
import { resolve, dirname, sep } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { byId } from './catalog.mjs';
export const dataDir = resolve(process.env.DBK_DATA || './.dbk-data');
mkdirSync(dataDir,{recursive:true});
export const db = new DatabaseSync(resolve(dataDir,'dbk.sqlite'));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY, name TEXT NOT NULL, document TEXT NOT NULL, updated INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS revisions(id TEXT PRIMARY KEY, project TEXT NOT NULL, document TEXT NOT NULL, created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS variables(project TEXT, scope TEXT, owner TEXT, key TEXT, value TEXT, PRIMARY KEY(project,scope,owner,key));
CREATE TABLE IF NOT EXISTS warnings(id TEXT PRIMARY KEY, project TEXT, guild TEXT, user TEXT, reason TEXT, created INTEGER);
CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, project TEXT, kind TEXT, due INTEGER, data TEXT);
CREATE TABLE IF NOT EXISTS logs(id INTEGER PRIMARY KEY AUTOINCREMENT, project TEXT, level TEXT, message TEXT, created INTEGER);
CREATE TABLE IF NOT EXISTS cooldowns(project TEXT, key TEXT, until INTEGER, PRIMARY KEY(project,key));
CREATE TABLE IF NOT EXISTS giveaways(id TEXT, project TEXT, data TEXT, PRIMARY KEY(id,project));
CREATE TABLE IF NOT EXISTS tickets(project TEXT, channel TEXT, owner TEXT, PRIMARY KEY(project,channel));`);
export function transaction(fn) { db.exec('BEGIN IMMEDIATE'); try { const value=fn(); db.exec('COMMIT'); return value; } catch(e) { db.exec('ROLLBACK'); throw e; } }
export function validId(id) { if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw Error('Недопустимый ID'); return id; }
export function projectFolder(id) { const p=resolve(dataDir,'files',validId(id)); mkdirSync(p,{recursive:true}); return p; }
export function safeFile(id,path='') { const base=projectFolder(id); const result=resolve(base,String(path)); if(result!==base&&!result.startsWith(base+sep)) throw Error('Файл вне папки проекта'); let ancestor=result; while(!existsSync(ancestor)) ancestor=dirname(ancestor); const actual=realpathSync(ancestor); const actualBase=realpathSync(base); if(actual!==actualBase&&!actual.startsWith(actualBase+sep)) throw Error('Символические ссылки за пределы проекта запрещены'); return result; }
export function getProject(id) { const row=db.prepare('SELECT document FROM projects WHERE id=?').get(validId(id)); if(!row) throw Error('Проект не найден'); return JSON.parse(row.document); }
export function listProjects() { return db.prepare('SELECT id,name,updated,document FROM projects ORDER BY updated DESC').all().map(r=>{ const p=JSON.parse(r.document); return {id:r.id,name:r.name,updated:r.updated,description:p.description,scenarios:p.scenarios.length}; }); }
export function validateProject(p) {
  const errors=[];
  if(!p||typeof p!=='object'||!Array.isArray(p.scenarios)) return ['Некорректный проект'];
  if(!p.name?.trim()) errors.push('Название проекта пустое');
  if(p.scenarios.length>200) errors.push('Не более 200 сценариев в проекте');
  const scenarioIds=new Set();
  for(const s of p.scenarios) {
    if(scenarioIds.has(s.id)) errors.push('Повторяется ID сценария'); scenarioIds.add(s.id);
    if(!Array.isArray(s.nodes)||!Array.isArray(s.edges)) { errors.push('Некорректный граф'); continue; }
    if(s.nodes.length>2000||s.edges.length>5000) {errors.push(`${s.name}: граф слишком большой`);continue;}
    const ids=new Set(s.nodes.map(n=>n.id));
    if(ids.size!==s.nodes.length) errors.push(`${s.name}: повторяются ID блоков`);
    const triggers=s.nodes.filter(n=>n.data?.kind?.startsWith('trigger.'));
    if(triggers.length!==1) errors.push(`${s.name}: нужен ровно один триггер`);
    const used=new Set();
    for(const n of s.nodes) {
      if(n.type==='group') continue;
      if(!byId[n.data?.kind]) errors.push(`${s.name}: неизвестный блок ${n.data?.kind}`);
      for(const f of byId[n.data?.kind]?.fields||[]) if(f.type==='json') { try { if(typeof n.data.params?.[f.key]==='string'&&!/^\{\{.*\}\}$/.test(n.data.params[f.key])) JSON.parse(n.data.params[f.key]); } catch { errors.push(`${s.name} / ${n.data.kind}: неверный JSON «${f.label}»`); } }
      if(n.data?.kind==='trigger.slash'&&!/^[\p{Ll}\p{Lo}\p{N}_-]{1,32}$/u.test(n.data.params?.name||'')) errors.push(`${s.name}: неверное имя slash-команды`);
      if(n.data?.kind==='flow.call'&&!p.scenarios.some(x=>x.id===n.data.params.scenario)) errors.push(`${s.name}: вызываемый сценарий не найден`);
    }
    for(const e of s.edges) {
      if(!ids.has(e.source)||!ids.has(e.target)) errors.push(`${s.name}: оборванное соединение`);
      const source=s.nodes.find(n=>n.id===e.source),target=s.nodes.find(n=>n.id===e.target);
      if(!(byId[source?.data?.kind]?.ports||[]).includes(e.sourceHandle||'next')) errors.push(`${s.name}: неверный порт`);
      if(target?.data?.kind?.startsWith('trigger.')) errors.push(`${s.name}: нельзя вести связь в триггер`);
      const key=e.source+':'+(e.sourceHandle||'next'); if(used.has(key)) errors.push(`${s.name}: у выхода может быть только одна связь`); used.add(key);
    }
    const visiting=new Set(),visited=new Set();
    function visit(id) { if(visiting.has(id)) return true; if(visited.has(id)) return false; visiting.add(id); for(const e of s.edges.filter(e=>e.source===id)) if(visit(e.target)) return true; visiting.delete(id);visited.add(id);return false; }
    if(s.nodes.some(n=>visit(n.id))) errors.push(`${s.name}: замкнутая связь; используйте блок «Цикл»`);
    const reachable=new Set(); function reach(id) { if(reachable.has(id))return; reachable.add(id);s.edges.filter(e=>e.source===id).forEach(e=>reach(e.target)); }
    triggers.forEach(n=>reach(n.id));
    for(const n of s.nodes) if(n.type!=='group'&&n.data?.kind!=='flow.comment'&&!reachable.has(n.id)) errors.push(`${s.name}: блок ${byId[n.data?.kind]?.title||n.id} не подключён`);
  }
  const names=p.scenarios.filter(s=>s.enabled!==false).map(s=>s.nodes.find(n=>['trigger.slash','trigger.context'].includes(n.data?.kind))).filter(Boolean).map(n=>`${n.data.kind}:${n.data.params.name}`);
  if(new Set(names).size!==names.length) errors.push('Повторяющиеся имена команд');
  return [...new Set(errors)];
}
export function saveProject(p) {
  validId(p.id); if(typeof p.name!=='string'||!Array.isArray(p.scenarios)) throw Error('Некорректный проект');
  if(JSON.stringify(p).length>10_000_000) throw Error('Проект больше 10 МБ');
  const clean={id:p.id,name:p.name.slice(0,100),description:String(p.description||'').slice(0,500),settings:{applicationId:p.settings?.applicationId||'',guildId:p.settings?.guildId||'',intents:p.settings?.intents||['Guilds','GuildMessages','MessageContent','GuildMembers'],status:p.settings?.status||'online',activity:p.settings?.activity||'Создан в DBK'},scenarios:p.scenarios,updated:Date.now()};
  transaction(()=>{ const old=db.prepare('SELECT document FROM projects WHERE id=?').get(p.id); if(old&&old.document!==JSON.stringify(clean)) db.prepare('INSERT INTO revisions VALUES(?,?,?,?)').run(randomUUID(),p.id,old.document,Date.now()); db.prepare('INSERT OR REPLACE INTO projects VALUES(?,?,?,?)').run(p.id,clean.name,JSON.stringify(clean),clean.updated); db.prepare('DELETE FROM revisions WHERE project=? AND id NOT IN (SELECT id FROM revisions WHERE project=? ORDER BY created DESC LIMIT 40)').run(p.id,p.id); });
  return clean;
}
export function owner(ctx,scope) { return scope==='global'?'*':scope==='guild'?ctx.guild?.id:scope==='user'?`${ctx.guild?.id||'dm'}:${ctx.user?.id}`:scope==='channel'?ctx.channel?.id:''; }
export function getVar(project,scope,who,key,fallback=null) { const row=db.prepare('SELECT value FROM variables WHERE project=? AND scope=? AND owner=? AND key=?').get(project,scope,who||'',key); return row?JSON.parse(row.value):fallback; }
export function setVar(project,scope,who,key,value) { if(value===undefined) db.prepare('DELETE FROM variables WHERE project=? AND scope=? AND owner=? AND key=?').run(project,scope,who||'',key); else db.prepare('INSERT OR REPLACE INTO variables VALUES(?,?,?,?,?)').run(project,scope,who||'',key,JSON.stringify(value)); return value??null; }
export function log(project,level,message) { const safe=String(message).slice(0,6000); db.prepare('INSERT INTO logs(project,level,message,created) VALUES(?,?,?,?)').run(project,level,safe,Date.now()); db.prepare('DELETE FROM logs WHERE project=? AND id NOT IN (SELECT id FROM logs WHERE project=? ORDER BY id DESC LIMIT 1500)').run(project,project); }
export function encodeProject(p) { const payload=gzipSync(Buffer.from(JSON.stringify(p))).toString('base64'); return JSON.stringify({format:'DBK',version:1,author:'ItsFloweS',checksum:createHash('sha256').update(payload).digest('hex'),payload},null,2); }
export function decodeProject(content) { if(content.length>14_000_000) throw Error('Файл слишком большой'); const envelope=JSON.parse(content); if(envelope.format!=='DBK'||envelope.version!==1) throw Error('Неподдерживаемый формат DBK'); if(createHash('sha256').update(envelope.payload).digest('hex')!==envelope.checksum) throw Error('Файл повреждён: checksum не совпадает'); const p=JSON.parse(gunzipSync(Buffer.from(envelope.payload,'base64'),{maxOutputLength:10_000_000})); if(!Array.isArray(p.scenarios)||p.scenarios.length>200) throw Error('Некорректный проект'); p.id=randomUUID();p.name=String(p.name||'Импортированный проект'); return saveProject(p); }

import { randomUUID, randomInt } from 'node:crypto';
import { PermissionsBitField } from 'discord.js';
import { db, transaction, getVar, setVar } from './store.mjs';
import { member, channel, send } from './actions.mjs';
const windows=new Map();
function windowCount(key,seconds){const now=Date.now();const timestamps=(windows.get(key)||[]).filter(t=>now-t<seconds*1000);timestamps.push(now);windows.set(key,timestamps);if(windows.size>10000)for(const [k,v] of windows)if(now-v.at(-1)>600000)windows.delete(k);return timestamps.length;}
const balance=(p,g,u)=>Number(getVar(p,'user',`${g}:${u}`,'balance',0));
const money=(p,g,u,v)=>setVar(p,'user',`${g}:${u}`,'balance',v);
export async function finishGiveaway(project,id,client){
 const row=db.prepare('SELECT data FROM giveaways WHERE project=? AND id=?').get(project,id);if(!row)throw Error('Розыгрыш не найден');const data=JSON.parse(row.data);if(data.finished)return data;
 const pool=[...new Set(data.entries)];const winners=[];while(pool.length&&winners.length<data.winners)winners.push(pool.splice(randomInt(pool.length),1)[0]);
 const c=await client.channels.fetch(data.channel);await c.send({content:`Розыгрыш «${data.prize}» завершён. ${winners.length?'Победители: '+winners.map(x=>`<@${x}>`).join(', '):'Нет участников.'}`,allowedMentions:{parse:[]}});
 data.finished=true;data.selected=winners;db.prepare('UPDATE giveaways SET data=? WHERE project=? AND id=?').run(JSON.stringify(data),project,id);return data;
}
export async function system(kind,p,ctx){
 const project=ctx.project.id,guild=ctx.guild?.id,user=p.user||ctx.user?.id;
 if(!guild&&!['system.locale','system.reminder'].includes(kind))throw Error('Этой системе нужен сервер');
 switch(kind){
 case 'system.xp':{
  const result=transaction(()=>{const key=`xp:${guild}:${user}`,row=db.prepare('SELECT until FROM cooldowns WHERE project=? AND key=?').get(project,key);const old=Number(getVar(project,'user',`${guild}:${user}`,'xp',0));if(row?.until>Date.now())return {xp:old,level:Math.floor(Math.sqrt(old/100)),leveledUp:false};const xp=Math.max(0,old+Math.max(0,p.amount));setVar(project,'user',`${guild}:${user}`,'xp',xp);db.prepare('INSERT OR REPLACE INTO cooldowns VALUES(?,?,?)').run(project,key,Date.now()+p.cooldown*1000);const level=Math.floor(Math.sqrt(xp/100));return {xp,level,leveledUp:level>Math.floor(Math.sqrt(old/100))};});
  if(result.leveledUp&&p.rewardRole)await (await member(ctx,user)).roles.add(p.rewardRole);return result;
 }
 case 'system.economy':{
  const amount=Number(p.amount);if(!Number.isSafeInteger(amount)||amount<0)throw Error('Сумма должна быть целым неотрицательным числом');
  let item;if(p.action==='buy'){item=p.shop.find(x=>x.id===p.item);if(!item||!Number.isSafeInteger(item.price)||item.price<0)throw Error('Товар не найден или цена неверна');}
  const result=transaction(()=>{let value=balance(project,guild,user);let message='Баланс получен.';
   if(p.action==='add'){value+=amount;message='Баланс пополнен.';}
   if(p.action==='transfer'){if(!p.recipient||p.recipient===user)throw Error('Укажите другого получателя');if(value<amount)throw Error('Недостаточно средств');const recipientBalance=balance(project,guild,p.recipient)+amount;if(!Number.isSafeInteger(recipientBalance))throw Error('Слишком большой баланс');money(project,guild,p.recipient,recipientBalance);value-=amount;message='Перевод выполнен.';}
   if(p.action==='daily'){const key=`daily:${guild}:${user}`,row=db.prepare('SELECT until FROM cooldowns WHERE project=? AND key=?').get(project,key);if(row?.until>Date.now())return {balance:value,claimed:false,message:`Следующая награда: ${new Date(row.until).toISOString()}.`};db.prepare('INSERT OR REPLACE INTO cooldowns VALUES(?,?,?)').run(project,key,Date.now()+86400000);value+=amount;message='Награда получена!';}
   if(p.action==='buy'){if(value<item.price)throw Error('Недостаточно средств');value-=item.price;const inventory=getVar(project,'user',`${guild}:${user}`,'inventory',[]);setVar(project,'user',`${guild}:${user}`,'inventory',[...inventory,item.id]);message=`Куплено: ${item.name}`;}
   if(!Number.isSafeInteger(value))throw Error('Слишком большой баланс');money(project,guild,user,value);return {balance:value,claimed:true,message,item:item?.id};
  });
  if(item?.roleId){try{await (await member(ctx,user)).roles.add(item.roleId);}catch(e){transaction(()=>{money(project,guild,user,balance(project,guild,user)+item.price);const inventory=getVar(project,'user',`${guild}:${user}`,'inventory',[]);const i=inventory.lastIndexOf(item.id);if(i>=0)inventory.splice(i,1);setVar(project,'user',`${guild}:${user}`,'inventory',inventory);});throw Error(`Не удалось выдать роль; сумма возвращена: ${e.message}`);}}return result;
 }
 case 'system.ticket':{
  if(p.action==='close'){const c=await channel(ctx);const ticket=db.prepare('SELECT owner FROM tickets WHERE project=? AND channel=?').get(project,c.id);if(!ticket)throw Error('Этот канал не является тикетом DBK');const m=await member(ctx);if(ticket.owner!==ctx.user.id&&!m.permissions.has('ManageChannels'))throw Error('Закрыть тикет может автор или модератор');await c.delete('Закрытие тикета DBK');db.prepare('DELETE FROM tickets WHERE project=? AND channel=?').run(project,c.id);return {closed:true};}
  const old=db.prepare('SELECT channel FROM tickets WHERE project=? AND owner=?').get(project,ctx.user.id);if(old){try{const c=await ctx.services.client.channels.fetch(old.channel);if(c)return {id:c.id,existing:true};}catch{}db.prepare('DELETE FROM tickets WHERE project=? AND channel=?').run(project,old.channel);}
  const g=await ctx.services.client.guilds.fetch(guild);const access=['ViewChannel','SendMessages','ReadMessageHistory'];const overwrites=[{id:g.id,deny:['ViewChannel']},{id:ctx.user.id,allow:access},{id:ctx.services.client.user.id,allow:[...access,'ManageChannels']}];if(p.supportRole)overwrites.push({id:p.supportRole,allow:access});const c=await g.channels.create({name:`ticket-${ctx.user.username}`.slice(0,90),type:0,parent:p.category||undefined,permissionOverwrites:overwrites});db.prepare('INSERT INTO tickets VALUES(?,?,?)').run(project,c.id,ctx.user.id);return {id:c.id};
 }
 case 'system.giveaway':{
  if(p.action==='end')return finishGiveaway(project,p.id,ctx.services.client);
  if(p.action==='create'){if(db.prepare('SELECT id FROM giveaways WHERE project=? AND id=?').get(project,p.id))throw Error('Этот ID розыгрыша уже существует');const data={channel:ctx.channel.id,prize:p.prize,winners:Math.max(1,Math.min(100,p.winners)),requiredRole:p.requiredRole,entries:[],finished:false,due:Date.now()+Math.max(1,p.minutes)*60000};transaction(()=>{db.prepare('INSERT INTO giveaways VALUES(?,?,?)').run(p.id,project,JSON.stringify(data));db.prepare('INSERT INTO jobs VALUES(?,?,?,?,?)').run(randomUUID(),project,'giveaway',data.due,JSON.stringify({id:p.id}));});return {id:p.id,...data};}
  const row=db.prepare('SELECT data FROM giveaways WHERE project=? AND id=?').get(project,p.id);if(!row)throw Error('Розыгрыш не найден');const current=JSON.parse(row.data);if(current.finished||current.due<Date.now())throw Error('Розыгрыш завершён');if(current.requiredRole&&!(await member(ctx)).roles.cache.has(current.requiredRole))throw Error('Необходимая роль отсутствует');return transaction(()=>{const data=JSON.parse(db.prepare('SELECT data FROM giveaways WHERE project=? AND id=?').get(project,p.id).data);if(data.finished||data.due<Date.now())throw Error('Розыгрыш завершён');if(!data.entries.includes(ctx.user.id))data.entries.push(ctx.user.id);db.prepare('UPDATE giveaways SET data=? WHERE project=? AND id=?').run(JSON.stringify(data),project,p.id);return {entered:true,participants:data.entries.length};});
 }
 case 'system.roles':{const key=ctx.customId||ctx.values?.[0]||ctx.emoji;const role=p.mapping[key];if(!role)throw Error('Для этого компонента не настроена роль');const m=await member(ctx);const has=m.roles.cache.has(role);await m.roles[has?'remove':'add'](role);return {role,added:!has};}
 case 'system.automod':{const message=ctx.message;if(!message||message.author.bot)return {blocked:false};const count=windowCount(`${project}:spam:${guild}:${message.author.id}`,10);const value=message.content.toLowerCase();const blocked=(p.words||[]).some(w=>value.includes(String(w).toLowerCase()))||(p.links&&/https?:\/\/|discord\.gg\//i.test(value))||count>p.limit;if(blocked){await message.delete();if(p.timeout>0){const m=await member(ctx,message.author.id);if(m.moderatable)await m.timeout(Math.min(40320,p.timeout)*60000,'Автомодерация DBK');}}return {blocked,count};}
 case 'system.antiraid':{const count=windowCount(`${project}:raid:${guild}`,p.seconds);return {raid:count>p.limit,count};}
 case 'system.stats':{const key=`stats:${p.metric}`;const value=Number(getVar(project,'guild',guild,key,0));return {metric:p.metric,value:p.action==='increment'?setVar(project,'guild',guild,key,value+p.amount):value};}
 case 'system.reminder':{const id=randomUUID();db.prepare('INSERT INTO jobs VALUES(?,?,?,?,?)').run(id,project,'reminder',Date.now()+Math.max(1,p.seconds)*1000,JSON.stringify({channel:p.channel||ctx.channel.id,content:p.content}));return {id};}
 case 'system.locale':{const language=String(p.locale||p.fallback).split('-')[0];return p.translations[language]?.[p.key]??p.translations[p.fallback]?.[p.key]??p.key;}
 default:throw Error(`Неизвестная система: ${kind}`);
 }
}

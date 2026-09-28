import { randomUUID } from 'node:crypto';
import { defaults } from './catalog.mjs';
const node=(kind,x,y,params={})=>({id:randomUUID(),type:'block',position:{x,y},data:{kind,params:{...defaults(kind),...params}}});
function scenario(name,items){const nodes=items.map(([kind,p],i)=>node(kind,100+i*330,160,p));return {id:randomUUID(),name,enabled:true,nodes,edges:nodes.slice(1).map((n,i)=>({id:randomUUID(),source:nodes[i].id,target:n.id,sourceHandle:'next',type:'smoothstep'}))};}
export const templates=[
 {id:'blank',name:'Чистый лист',description:'Одна slash-команда. Остальное решаете вы.'},
 {id:'community',name:'Свой сервер',description:'Приветствия, уровни и команда профиля.'},
 {id:'moderation',name:'Модератор',description:'Автомодерация и предупреждения участников.'},
 {id:'economy',name:'Экономика',description:'Баланс и ежедневная награда в SQLite.'},
 {id:'tickets',name:'Поддержка',description:'Панель тикетов и приватные обращения.'}
];
export function createProject(name,template='blank') {
 const hello=scenario('Первая команда',[['trigger.slash',{name:'hello',description:'Поздороваться с ботом'}],['message.send',{content:'Привет, {{user.username}}! Этот бот создан в DBK.'}]]);
 let scenarios=[hello];
 if(template==='community') scenarios=[scenario('Приветствие',[['trigger.event',{event:'member_join'}],['message.send',{mode:'dm',content:'Добро пожаловать на {{guild.name}}, {{user.username}}!'}]]),scenario('Опыт за сообщения',[['trigger.event',{event:'message_create'}],['system.xp',{}]]),scenario('Мой профиль',[['trigger.slash',{name:'profile',description:'Мой профиль'}],['variable.get',{scope:'user',key:'xp',fallback:'0',output:'xp'}],['message.send',{content:'{{user.username}}, у тебя {{temp.xp}} XP.'}]])];
 if(template==='moderation') scenarios=[scenario('Фильтр сообщений',[['trigger.event',{event:'message_create'}],['system.automod',{links:true}]]),scenario('Предупреждение',[['trigger.slash',{name:'warn',description:'Предупредить участника',permission:'ModerateMembers',options:JSON.stringify([{name:'user',description:'Участник',type:6,required:true},{name:'reason',description:'Причина',type:3,required:true}])}],['member.moderate',{action:'warn',user:'{{options.user}}',reason:'{{options.reason}}'}],['message.send',{content:'Предупреждение сохранено.'}]])];
 if(template==='economy') scenarios=[scenario('Баланс',[['trigger.slash',{name:'balance',description:'Мой баланс'}],['system.economy',{action:'balance'}],['message.send',{content:'Твой баланс: {{temp.result.balance}} монет.'}]]),scenario('Ежедневная награда',[['trigger.slash',{name:'daily',description:'Забрать ежедневную награду'}],['system.economy',{action:'daily',amount:100}],['message.send',{content:'{{temp.result.message}} Баланс: {{temp.result.balance}}.'}]])];
 if(template==='tickets') scenarios=[scenario('Панель поддержки',[['trigger.slash',{name:'support',description:'Связаться с поддержкой'}],['message.send',{content:'Нужна помощь? Создай обращение.',components:JSON.stringify([{type:1,components:[{type:2,style:1,label:'Открыть тикет',custom_id:'ticket:open'}]}])}]]),scenario('Открыть тикет',[['trigger.component',{type:'button',customId:'ticket:open'}],['system.ticket',{action:'open'}],['message.send',{content:'Ваш тикет: <#{{temp.result.id}}>',ephemeral:true}]])];
 return {id:randomUUID(),name,description:'Мой Discord-бот',settings:{applicationId:'',guildId:'',intents:['Guilds','GuildMessages','MessageContent','GuildMembers'],activity:'Создан в DBK',status:'online'},scenarios};
}

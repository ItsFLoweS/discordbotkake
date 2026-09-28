import { useLayoutEffect, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MagnifyingGlass, Plus, Copy, Trash, LockSimple, LockSimpleOpen, ArrowsOutCardinal, GearSix, PauseCircle, SquaresFour } from '@phosphor-icons/react';
import { groups } from '../runtime/catalog.mjs';
import { GroupIcon } from './components';
export type CanvasMenuState={x:number;y:number;position:{x:number;y:number};nodeId?:string};
type Props={
 menu:CanvasMenuState;title?:string;frozen:boolean;parentFrozen:boolean;isGroup:boolean;breakpoint:boolean;canGroup:boolean;
 onClose:()=>void;onAdd:(kind:string)=>void;onAction:(action:'settings'|'copy'|'duplicate'|'move'|'freeze'|'breakpoint'|'group'|'delete')=>void;
};
export function CanvasMenu({menu,title,frozen,parentFrozen,isGroup,breakpoint,canGroup,onClose,onAdd,onAction}:Props){
 const ref=useRef<HTMLDivElement>(null);
 const [query,setQuery]=useState('');
 const [position,setPosition]=useState({left:menu.x,top:menu.y});
 const closeRef=useRef(onClose);closeRef.current=onClose;
 useLayoutEffect(()=>{
  const element=ref.current;if(!element)return;
  const rect=element.getBoundingClientRect();
  setPosition({left:Math.max(8,Math.min(menu.x,window.innerWidth-rect.width-8)),top:Math.max(8,Math.min(menu.y,window.innerHeight-rect.height-8))});
  element.querySelector<HTMLElement>('input,button:not(:disabled)')?.focus();
 },[menu.x,menu.y,menu.nodeId]);
 useEffect(()=>{
  const outside=(event:PointerEvent)=>{if(!ref.current?.contains(event.target as Node))closeRef.current();};
  const key=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeRef.current();return;}
   if(!(event.target instanceof HTMLInputElement)&&['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
    const items=Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')||[]);
    if(!items.length)return;event.preventDefault();const index=items.indexOf(document.activeElement as HTMLButtonElement);
    const next=event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;
    items[next]?.focus();
   }
  };
  const close=()=>closeRef.current();
  document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',key,true);window.addEventListener('resize',close);window.addEventListener('blur',close);
  return()=>{document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',key,true);window.removeEventListener('resize',close);window.removeEventListener('blur',close);};
 },[]);
 const filtered=groups.map(g=>({...g,items:g.items.filter(n=>`${n.title} ${n.description} ${n.id}`.toLowerCase().includes(query.toLowerCase()))})).filter(g=>g.items.length);
 return createPortal(
  <div ref={ref} className={`canvas-menu ${menu.nodeId?'node-menu':'create-menu'}`} style={position} role={menu.nodeId?'menu':'dialog'} aria-label={menu.nodeId?'Действия с блоком':'Добавить блок'} onContextMenu={e=>{e.preventDefault();e.stopPropagation();}}>
   <div className="canvas-menu-heading">{menu.nodeId?title||'Блок':'Добавить блок'}</div>
   {menu.nodeId?<>
    <button role="menuitem" onClick={()=>onAction('settings')}><GearSix size={16}/>Настроить</button>
    <button role="menuitem" disabled={frozen||parentFrozen} onClick={()=>onAction('move')} title={parentFrozen?'Сначала разморозьте родительскую группу':frozen?'Сначала разморозьте блок':'Выберите новое место на холсте'}><ArrowsOutCardinal size={16}/>Переместить…</button>
    <button role="menuitem" onClick={()=>onAction('freeze')}>{frozen?<LockSimpleOpen size={16}/>:<LockSimple size={16}/>}<span>{frozen?'Разморозить':'Зафиксировать позицию'}</span></button>
    <div className="canvas-menu-divider" role="separator"/>
    <button role="menuitem" onClick={()=>onAction('copy')}><Copy size={16}/>Копировать<kbd>Ctrl C</kbd></button>
    <button role="menuitem" onClick={()=>onAction('duplicate')}><Plus size={16}/>Дублировать<kbd>Ctrl D</kbd></button>
    {!isGroup&&<button role="menuitem" onClick={()=>onAction('breakpoint')}><PauseCircle size={16}/>{breakpoint?'Убрать точку останова':'Точка останова'}</button>}
    {canGroup&&<button role="menuitem" onClick={()=>onAction('group')}><SquaresFour size={16}/>Сгруппировать выбранные</button>}
    <div className="canvas-menu-divider" role="separator"/>
    <button role="menuitem" className="danger-text" onClick={()=>onAction('delete')}><Trash size={16}/>{isGroup?'Разгруппировать':'Удалить блок'}</button>
   </>:<>
    <div className="search"><MagnifyingGlass size={16}/><input aria-label="Найти блок для добавления" placeholder="Название или действие…" value={query} onChange={e=>setQuery(e.target.value)}/></div>
    <div className="canvas-menu-catalog">{filtered.map(g=><section key={g.id}><div className="canvas-menu-category"><GroupIcon group={g.id} size={15}/>{g.title}</div>{g.items.map(n=><button key={n.id} title={n.description} onClick={()=>onAdd(n.id)}><span>{n.title}</span><Plus size={13}/></button>)}</section>)}{!filtered.length&&<p className="no-results">Блоки не найдены</p>}</div>
   </>}
  </div>,document.body
 );
}

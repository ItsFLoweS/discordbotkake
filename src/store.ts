import { create } from 'zustand';
import { applyNodeChanges, applyEdgeChanges, addEdge, type NodeChange, type EdgeChange, type Connection } from '@xyflow/react';
import { defaults } from '../runtime/catalog.mjs';
import type { Project, BlockNode, Scenario } from './types';
const id=()=>crypto.randomUUID();
export function makeNode(kind:string,x=100,y=120):BlockNode{return {id:id(),type:'block',position:{x,y},data:{kind,params:defaults(kind)}};}
type EditorStore={project:Project|null;scenarioId:string;selected:string|null;dirty:boolean;history:Project[];future:Project[];clipboard:BlockNode[];
 open:(p:Project)=>void;close:()=>void;checkpoint:()=>void;undo:()=>void;redo:()=>void;setScenario:(id:string)=>void;select:(id:string|null)=>void;changeNodes:(c:NodeChange<BlockNode>[])=>void;changeEdges:(c:EdgeChange[])=>void;connect:(c:Connection)=>void;addNode:(kind:string,position?:{x:number;y:number})=>void;updateNode:(id:string,patch:Record<string,unknown>)=>void;renameNode:(id:string,label:string)=>void;toggleBreakpoint:(id:string)=>void;removeNode:(id:string)=>void;newScenario:()=>void;updateScenario:(id:string,patch:Partial<Scenario>)=>void;deleteScenario:(id:string)=>void;updateProject:(patch:Partial<Project>)=>void;markSaved:()=>void;copy:()=>void;paste:()=>void;group:()=>void;
};
export const useEditor=create<EditorStore>((set,get)=>{
 const change=(fn:(p:Project,s:Scenario)=>void,checkpoint=true)=>{const old=get().project;if(!old)return;const p=structuredClone(old),s=p.scenarios.find(s=>s.id===get().scenarioId);if(!s)return;if(checkpoint)get().checkpoint();fn(p,s);set({project:p,dirty:true});};
 return {project:null,scenarioId:'',selected:null,dirty:false,history:[],future:[],clipboard:[],
 open:p=>set({project:p,scenarioId:p.scenarios[0]?.id||'',selected:null,dirty:false,history:[],future:[]}),close:()=>set({project:null,selected:null}),
 checkpoint:()=>{const p=get().project;if(p)set({history:[...get().history.slice(-39),structuredClone(p)],future:[]});},
 undo:()=>{const {history,project,future}=get();if(!history.length||!project)return;const p=history.at(-1)!;set({project:p,history:history.slice(0,-1),future:[project,...future],dirty:true,selected:null,scenarioId:p.scenarios.some(s=>s.id===get().scenarioId)?get().scenarioId:p.scenarios[0]?.id||''});},
 redo:()=>{const {history,project,future}=get();if(!future.length||!project)return;const p=future[0];set({project:p,history:[...history,project],future:future.slice(1),dirty:true,selected:null,scenarioId:p.scenarios.some(s=>s.id===get().scenarioId)?get().scenarioId:p.scenarios[0]?.id||''});},
 setScenario:scenarioId=>set({scenarioId,selected:null}),select:selected=>set({selected}),
 changeNodes:c=>change((_,s)=>{s.nodes=applyNodeChanges(c,s.nodes);s.edges=s.edges.filter(e=>s.nodes.some(n=>n.id===e.source)&&s.nodes.some(n=>n.id===e.target));},c.some(x=>x.type==='remove')),
 changeEdges:c=>change((_,s)=>{s.edges=applyEdgeChanges(c,s.edges);},c.some(x=>x.type==='remove')),
 connect:c=>change((_,s)=>{if(c.source===c.target||s.nodes.find(n=>n.id===c.target)?.data.kind.startsWith('trigger.'))return;s.edges=s.edges.filter(e=>!(e.source===c.source&&(e.sourceHandle||'next')===(c.sourceHandle||'next')));s.edges=addEdge({...c,id:id(),type:'smoothstep'},s.edges);}),
 addNode:(kind,position)=>change((_,s)=>{const n=makeNode(kind,position?.x??160+s.nodes.length*60,position?.y??160+s.nodes.length*40);s.nodes.push(n);set({selected:n.id});}),
 updateNode:(nodeId,patch)=>change((_,s)=>{const n=s.nodes.find(n=>n.id===nodeId);if(n)n.data.params={...n.data.params,...patch};}),
 renameNode:(nodeId,label)=>change((_,s)=>{const n=s.nodes.find(n=>n.id===nodeId);if(n)n.data.label=label;}),
 toggleBreakpoint:nodeId=>change((_,s)=>{const n=s.nodes.find(n=>n.id===nodeId);if(n)n.data.breakpoint=!n.data.breakpoint;}),
 removeNode:nodeId=>change((_,s)=>{const node=s.nodes.find(n=>n.id===nodeId);if(node?.type==='group'){for(const child of s.nodes.filter(n=>n.parentId===nodeId)){child.position={x:child.position.x+node.position.x,y:child.position.y+node.position.y};delete child.parentId;delete child.extent;}}s.nodes=s.nodes.filter(n=>n.id!==nodeId);s.edges=s.edges.filter(e=>e.source!==nodeId&&e.target!==nodeId);set({selected:null});}),
 newScenario:()=>change(p=>{const sid=id();p.scenarios.push({id:sid,name:`Сценарий ${p.scenarios.length+1}`,enabled:true,nodes:[makeNode('trigger.function')],edges:[]});set({scenarioId:sid,selected:null});}),
 updateScenario:(sid,patch)=>change(p=>{const s=p.scenarios.find(s=>s.id===sid);if(s)Object.assign(s,patch);}),
 deleteScenario:sid=>change(p=>{p.scenarios=p.scenarios.filter(s=>s.id!==sid);set({scenarioId:p.scenarios[0]?.id||'',selected:null});}),
 updateProject:patch=>change(p=>{Object.assign(p,patch);}),markSaved:()=>set({dirty:false}),
 copy:()=>{const s=get().project?.scenarios.find(s=>s.id===get().scenarioId);if(s)set({clipboard:structuredClone(s.nodes.filter(n=>(n.selected||n.id===get().selected)&&n.type!=='group'))});},
 paste:()=>change((_,s)=>{const list=get().clipboard;if(!list.length)return;const mapping=new Map(list.map(n=>[n.id,id()]));const source=s.edges.filter(e=>mapping.has(e.source)&&mapping.has(e.target));for(const n of list){const copy=structuredClone(n);copy.id=mapping.get(n.id)!;copy.position={x:n.position.x+60,y:n.position.y+80};delete copy.parentId;delete copy.extent;copy.selected=false;s.nodes.push(copy);}for(const e of source)s.edges.push({...e,id:id(),source:mapping.get(e.source)!,target:mapping.get(e.target)!});}),
 group:()=>change((_,s)=>{const nodes=s.nodes.filter(n=>n.selected&&n.type!=='group'&&!n.parentId);if(!nodes.length)return;const x=Math.min(...nodes.map(n=>n.position.x))-25,y=Math.min(...nodes.map(n=>n.position.y))-50;const width=Math.max(...nodes.map(n=>n.position.x+290))-x+25,height=Math.max(...nodes.map(n=>n.position.y+160))-y+25;const gid=id();s.nodes.unshift({id:gid,type:'group',position:{x,y},style:{width,height},data:{kind:'group',label:'Группа',params:{}}});for(const n of nodes){n.parentId=gid;n.extent='parent';n.position={x:n.position.x-x,y:n.position.y-y};n.selected=false;}})
 };
});

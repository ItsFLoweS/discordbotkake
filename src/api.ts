import { invoke } from '@tauri-apps/api/core';
export const desktop = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
export async function api<T=unknown>(op:string,payload:Record<string,unknown>={}):Promise<T> {
  if(!desktop)throw new Error('Запустите desktop-приложение DBK. Подключение к Discord работает через встроенный Node.js.');
  return invoke<T>('bridge',{op,payload});
}
export const secret=(id:string,token:string)=>invoke('save_secret',{id,token});
export const exportFile=(content:string,name:string)=>invoke<boolean>('export_file',{content,name});
export const importFile=()=>invoke<string|null>('import_file');

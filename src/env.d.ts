declare module '*.mjs' {
  export const catalog: import('./types').Definition[];
  export const groups: {id:string;title:string;hint:string;items:import('./types').Definition[]}[];
  export const byId: Record<string,import('./types').Definition>;
  export function defaults(kind:string):Record<string,unknown>;
}

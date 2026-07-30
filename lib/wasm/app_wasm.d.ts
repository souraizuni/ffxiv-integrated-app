/* tslint:disable */
/* eslint-disable */
export function new_status(attrs: any, recipe: any, stellar_steady_hand_count: number): any;
export function simulate(status: any, actions: any): any;
export function simulate_detail(status: any, actions: any): any;
export function simulate_one_step(status: any, action: any, force_success: any): any;
export function rand_simulation(status: any, actions: any, n: number, ignore_errors: boolean): any;
export function rand_collectables_simulation(status: any, actions: any, n: number, ignore_errors: boolean, collectables_shop_refine: any): any;
export function calc_attributes_scope(status: any, actions: any): any;
export function allowed_list(status: any, skills: any): any;
export function craftpoints_list(status: any, skills: any): any;
export function high_quality_probability(status: any): any;
export function dfs_solve(status: any, depth: number, specialist: boolean): any;
export function nq_solve(status: any, depth: number, specialist: boolean): any;
export function reflect_solve(status: any, use_observe: boolean): any;
export function raphael_solve(status: any, target_quality: number | null | undefined, use_manipultaion: boolean, use_heart_and_soul: boolean, use_quick_innovation: boolean, use_trained_eye: boolean, backload_progress: boolean, adversarial: boolean, stellar_steady_hand_charges: number): any;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly allowed_list: (a: any, b: any) => [number, number, number];
  readonly calc_attributes_scope: (a: any, b: any) => [number, number, number];
  readonly craftpoints_list: (a: any, b: any) => [number, number, number];
  readonly dfs_solve: (a: any, b: number, c: number) => [number, number, number];
  readonly high_quality_probability: (a: any) => [number, number, number];
  readonly new_status: (a: any, b: any, c: number) => [number, number, number];
  readonly nq_solve: (a: any, b: number, c: number) => [number, number, number];
  readonly rand_collectables_simulation: (a: any, b: any, c: number, d: number, e: any) => [number, number, number];
  readonly rand_simulation: (a: any, b: any, c: number, d: number) => [number, number, number];
  readonly raphael_solve: (a: any, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => [number, number, number];
  readonly reflect_solve: (a: any, b: number) => [number, number, number];

  readonly simulate: (a: any, b: any) => [number, number, number];
  readonly simulate_detail: (a: any, b: any) => [number, number, number];
  readonly simulate_one_step: (a: any, b: any, c: any) => [number, number, number];
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_externrefs: WebAssembly.Table;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;

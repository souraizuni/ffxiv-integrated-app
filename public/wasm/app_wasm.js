/* @ts-self-types="./app_wasm.d.ts" */

import * as wasm from "./app_wasm_bg.wasm";
import { __wbg_set_wasm } from "./app_wasm_bg.js";
__wbg_set_wasm(wasm);
wasm.__wbindgen_start();
export {
    allowed_list, calc_attributes_scope, craftpoints_list, dfs_solve, high_quality_probability, new_status, nq_solve, rand_collectables_simulation, rand_simulation, raphael_solve, reflect_solve, simulate, simulate_detail, simulate_one_step
} from "./app_wasm_bg.js";

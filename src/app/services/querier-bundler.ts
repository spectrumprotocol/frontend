import { fromBase64, toBase64 } from '../libs/base64';
import { WasmService } from './api/wasm.service';

interface QueryTask {
  query: ContractQuery;
  ok: (value: any) => void;
  ko: (ex?: any) => void;
}
interface ContractQuery {
  addr: string;
  msg: string;
}

export class QueryBundler {
  private queries: QueryTask[] = [];

  constructor(
    private wasm: WasmService,
    private maxSize = 10
  ) { }

  query(addr: string, msg: any): Promise<any> {
    return new Promise((ok, ko) => {
      this.queries.push({
        query: { addr, msg: toBase64(msg) },
        ok,
        ko
      });
      if (this.queries.length >= this.maxSize) {
        this.flush();
      }
    });
  }

  flush() {
    if (!this.queries.length) {
      return;
    }
    const tasks = this.queries;
    this.queries = [];
    this.wasm.query(this.wasm.terrajs.settings.querier, {
      bundle: {
        queries: tasks.map(it => it.query),
      }
    }).then((results: string[]) => {
      if (tasks.length !== results.length) {
        throw new Error('result not match');
      }
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const task = tasks[i];
        const str = fromBase64(result);
        if (false){ // for debug
          console.log(task.query.addr, fromBase64(task.query.msg), str);
        }
        task.ok(str);
      }
    }).catch(ex => {
      for (const task of tasks) {
        task.ko(ex);
      }
    });
  }
}

import { Idl } from "../idl.js";
import { IdlCoder } from "./idl.js";

export class ConstantCoder {
  public constructor(idl: Idl) {
    if (idl.constants === undefined) {
      throw new Error("IDL constants not defined");
    }
  }
}

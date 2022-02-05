import { Idl } from "../idl";
import { IdlCoder } from "./borsh/idl";

export class ConstantCoder {
  public constructor(idl: Idl) {
    if (idl.constants === undefined) {
      throw new Error("IDL constants not defined");
    }
  }
}

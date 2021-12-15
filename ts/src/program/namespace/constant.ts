import { Idl } from "../../idl.js";
import Coder from "../../coder/index.js";

export default class ConstantFactory {
  public static build<IDL extends Idl>(
    idl: IDL,
    coder: Coder
  ): ConstantNamespace | undefined {
    if (idl.constants === undefined) {
      return undefined;
    }

    return Object.fromEntries(
      idl.constants.map((c) => [c.name as string, c.value])
    );
  }
}

export type ConstantNamespace = {
  [key: string]: any;
};

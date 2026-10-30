"use client";
import { useEffect, useRef } from "react";

/** Uma resposta antiga só pode limpar o rascunho que foi enviado. */
export class DraftGuard {
  private revision = 0;
  edit = () => { this.revision++; };
  capture() {
    const submitted = this.revision;
    return (clear: () => void) => {
      if (this.revision !== submitted) return;
      clear();
      this.edit();
    };
  }
}
export function useDraftGuard() {
  const guard = useRef(new DraftGuard()).current;
  useEffect(() => () => guard.edit(), [guard]);
  return guard;
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { createLocalRepository } from "./local-repository";

export function useLocalRepository<T>(key: string, initial: T, validate: (value: unknown) => value is T) {
  const repository = useMemo(() => createLocalRepository(key, initial, validate), [key, validate]);
  const [value, setValue] = useState(initial);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const refresh = () => {
      try { setValue(repository.read()); setError(""); }
      catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível ler os registros."); }
      finally { setReady(true); }
    };
    refresh();
    return repository.subscribe(refresh);
  }, [repository]);

  function update(updater: (current: T) => T) {
    if (!ready) return false;
    try { setValue(repository.update(updater)); setError(""); return true; }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível guardar."); return false; }
  }

  return { value, ready, error, update };
}

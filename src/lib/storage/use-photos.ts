"use client";
import { useEffect, useState } from "react";
import { photoRepository, PHOTO_EVENT,type StoredPhoto } from "./server-photos";

export type PhotoWithUrl = StoredPhoto;
export function usePhotos() {
  const [photos, setPhotos] = useState<PhotoWithUrl[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true, sequence = 0;
    async function refresh() {
      const request = ++sequence;
      try {
        const items = await photoRepository.list();
        if (!active || request !== sequence) return;
        setPhotos(items); setError("");
      } catch { if (active) setError("Não foi possível carregar as fotos guardadas."); }
      finally { if (active) setReady(true); }
    }
    void refresh();
    window.addEventListener(PHOTO_EVENT, refresh); window.addEventListener("focus", refresh);
    const timer=setInterval(refresh,15000);const channel=typeof BroadcastChannel!=="undefined"?new BroadcastChannel(PHOTO_EVENT):null;if(channel)channel.onmessage=refresh;
    return () => { active = false;clearInterval(timer);channel?.close(); window.removeEventListener(PHOTO_EVENT, refresh); window.removeEventListener("focus", refresh); };
  }, []);
  return { photos, ready, error };
}

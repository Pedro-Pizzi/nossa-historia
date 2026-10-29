"use client";
import { useRef, useState } from "react";
import { photoRepository } from "@/lib/storage/server-photos";
import { useCurrentUser } from "@/features/auth/components/user-session";
import { usePhotos } from "@/lib/storage/use-photos";
import { formatDate } from "@/features/shared/format";
import { DeleteButton, Status } from "@/features/shared/components";
import { StoryPhoto } from "@/features/story/components/story-controls";

export function MomentGallery() {
  const user=useCurrentUser();
  const { photos, ready, error } = usePhotos();
  const [date, setDate] = useState("");
  const [caption, setCaption] = useState("");
  const [status, setStatus] = useState("A data e a frase são opcionais. Só a foto já pode virar uma memória.");
  const [saveError, setSaveError] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  async function add(file?: File) {
    if (!file) return;
    if(file.size>3*1024*1024){setSaveError("Escolha uma imagem de até 3 MB.");return;}
    if (!["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/heic", "image/heif"].includes(file.type)) { setSaveError("Escolha uma imagem JPG, PNG, WebP, GIF, AVIF ou HEIC."); return; }
    setBusy(true); setSaveError(""); setStatus("Guardando esta memória…");
    try { await photoRepository.add({ blob: file, caption: caption.trim(), date, created: new Date().toISOString() }); setCaption(""); setDate(""); setStatus("Memória guardada ♡"); }
    catch(cause) { setSaveError(cause instanceof Error?cause.message:"Não foi possível guardar esta foto."); }
    finally { setBusy(false); if (input.current) input.current.value = ""; }
  }
  return <div className="moment-gallery"><div className="moment-gallery-heading"><span>novas páginas da nossa história</span><h3>Mais momentos para guardar ♡</h3><p>Escolha uma foto que mereça ficar aqui. Se quiser, você também pode guardar a data e uma frase sobre esse momento.</p></div>
    <div className="moment-memory-fields"><label>Data da lembrança (opcional)<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><label>Uma frase sobre esse momento (opcional)<input value={caption} onChange={(event) => setCaption(event.target.value)} /></label></div>
    <label className="moment-upload">＋ Adicionar foto<input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif" disabled={busy || !ready || !!error} onChange={(event) => { void add(event.target.files?.[0]); }} /></label>
    <Status error={error || saveError} message={status} /><p className="moment-storage-note">As fotos ficam guardadas para vocês dois e só abrem com login. Cada imagem pode ter até 3 MB.</p>
    <div className="photo-grid user-photo-grid">{photos.slice().reverse().map((photo) => <div className="saved-photo" key={photo.id}><StoryPhoto src={photo.url} alt={photo.caption || "Uma memória nossa"} className="photo user-photo">{photo.date || photo.caption ? <span className="moment-memory-copy">{photo.date ? <span className="moment-memory-date">{formatDate(photo.date)}</span> : null}{photo.caption ? <span className="moment-memory-phrase">{photo.caption}</span> : null}</span> : null}</StoryPhoto>{photo.author===user.name?<DeleteButton onDelete={() => { void photoRepository.remove(photo.id).catch(() => setSaveError("Não foi possível apagar esta foto.")); }}>Apagar foto</DeleteButton>:null}</div>)}</div>
  </div>;
}

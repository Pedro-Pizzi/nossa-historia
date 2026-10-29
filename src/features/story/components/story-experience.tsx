"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AccountMenu } from "@/features/auth/components/user-session";

export const chapterLinks = [
  ["carta", "01 · Prólogo"], ["memorias", "02 · Memórias"], ["diario", "03 · Diário"],
  ["perguntas", "04 · Sobre nós"], ["sonhos", "05 · Sonhos"], ["biblioteca", "06 · Gostos & afetos"],
  ["acolhimento", "07 · Para os dias ruins"], ["encontros", "08 · Encontros"], ["escolha", "09 · Eu escolho você"],
  ["marcos", "10 · Linha do tempo"], ["checkin", "11 · Recomeçar"], ["lembrar", "12 · Para relembrar"],
  ["neste-dia", "13 · Neste dia…"], ["final", "Os próximos capítulos"],
] as const;

type Photo = { src: string; alt: string };
const StoryContext = createContext<{ navigate: (id: string) => void; restart: () => void; showPhoto: (photo: Photo) => void } | null>(null);
export function useStory() { const story = useContext(StoryContext); if (!story) throw new Error("Controle fora do livro."); return story; }

export function StoryExperience({ cover, children }: { cover: ReactNode; children: ReactNode }) {
  const [opened, setOpened] = useState(false);
  const [menu, setMenu] = useState(false);
  const [active, setActive] = useState<string>("carta");
  const [pending, setPending] = useState<string | null>(null);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLDialogElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  function navigate(id: string) {
    if (!chapterLinks.some(([target]) => target === id)) return;
    setOpened(true); setMenu(false); setPending(id); setActive(id);
    if (window.location.hash !== `#${id}`) window.history.pushState(null, "", `#${id}`);
  }
  function restart() {
    setOpened(false); setMenu(false); setPending(null);
    window.history.pushState(null, "", window.location.pathname);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  useEffect(() => {
    const restore = () => {
      const target = window.location.hash.slice(1);
      const valid = chapterLinks.some(([id]) => id === target);
      setOpened(valid); setMenu(false); setPending(valid ? target : null);
    };
    restore();
    window.addEventListener("popstate", restore); window.addEventListener("hashchange", restore);
    return () => { window.removeEventListener("popstate", restore); window.removeEventListener("hashchange", restore); };
  }, []);
  useEffect(() => {
    if (!opened || !pending) return;
    const request = requestAnimationFrame(() => {
      const section = document.getElementById(pending);
      section?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
      section?.focus({ preventScroll: true });
      setPending(null);
    });
    return () => cancelAnimationFrame(request);
  }, [opened, pending]);
  useEffect(() => {
    if (!opened) return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActive(visible.target.id);
    }, { rootMargin: "-70px 0px -50% 0px", threshold: [0, 0.2, 0.5] });
    chapterLinks.forEach(([id]) => { const node = document.getElementById(id); if (node) observer.observe(node); });
    return () => observer.disconnect();
  }, [opened]);
  useEffect(() => {
    if (photo) { lastFocus.current = document.activeElement as HTMLElement; dialog.current?.showModal(); }
    else { dialog.current?.close(); lastFocus.current?.focus(); }
  }, [photo]);
  useEffect(() => {
    if (menu) drawer.current?.showModal();
    else { drawer.current?.close(); }
  }, [menu]);

  return <StoryContext.Provider value={{ navigate, restart, showPhoto: setPhoto }}>
    {!opened ? <div className="auth-cover-account"><AccountMenu /></div> : null}
    <div hidden={opened}>{cover}</div>
    <section id="app" hidden={!opened}>
      <header className="topbar">
        <button ref={menuButton} className="menu-btn" type="button" aria-label="Abrir índice" aria-expanded={menu} aria-controls="drawer" onClick={() => setMenu(true)}>☰</button>
        <div className="brand">Nossa História</div><AccountMenu />
      </header>
      <div className="progress" aria-label="Progresso da leitura"><span id="progress" style={{ width: `${(chapterLinks.findIndex(([id]) => id === active) + 1) / chapterLinks.length * 100}%` }} /></div>
      <main>{children}</main>
    </section>
    <dialog ref={drawer} id="drawer" className="drawer story-drawer" aria-labelledby="index-title" onCancel={() => setMenu(false)} onClick={(event) => { if (event.target === event.currentTarget) setMenu(false); }} onClose={() => { setMenu(false); menuButton.current?.focus({ preventScroll: true }); }}>
      <div className="drawer-inner"><button className="close" aria-label="Fechar índice" onClick={() => setMenu(false)}>×</button><div className="eyebrow">índice</div><h3 id="index-title">As nossas páginas</h3>
        <nav aria-label="Capítulos">{chapterLinks.map(([id, title], index) => <div key={id}>{index === 0 || index === 9 ? <div className="drawer-section-label">{index === 0 ? "O que guardamos aqui" : "O que continuamos construindo"}</div> : null}<a href={`#${id}`} aria-current={active === id ? "location" : undefined} onClick={(event) => { event.preventDefault(); navigate(id); }}>{title}</a></div>)}</nav>
      </div>
    </dialog>
    <dialog ref={dialog} className="lightbox story-lightbox" aria-label={photo?.alt || "Foto ampliada"} onCancel={() => setPhoto(null)} onClick={(event) => { if (event.target === event.currentTarget) setPhoto(null); }}>
      <button type="button" aria-label="Fechar foto" onClick={() => setPhoto(null)}>×</button>{photo ? <img src={photo.src} alt={photo.alt} /> : null}
    </dialog>
    <MusicPlayer visible={opened} />
  </StoryContext.Provider>;
}

function MusicPlayer({ visible }: { visible: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  function toggle() {
    if (!loaded) setLoaded(true);
    else frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func: playing ? "pauseVideo" : "playVideo", args: [] }), "https://www.youtube.com");
    setPlaying(!playing);
  }
  useEffect(() => { if (!visible) { frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func: "pauseVideo", args: [] }), "https://www.youtube.com"); setPlaying(false); } }, [visible]);
  return <div id="music-player" className={visible ? "show" : ""}>
    <button type="button" aria-label={playing ? "Pausar música" : "Tocar música"} onClick={toggle}>{playing ? "Ⅱ" : "▶"}</button>
    <div id="music-label">Partilhar<small>Rubel + ANAVITÓRIA</small></div>
    {loaded ? <iframe ref={frame} id="music-frame" title="Partilhar, Rubel e ANAVITÓRIA" src="https://www.youtube.com/embed/WkLpoUiasZ8?autoplay=1&controls=0&loop=1&playlist=WkLpoUiasZ8&enablejsapi=1&playsinline=1" allow="autoplay; encrypted-media" /> : null}
  </div>;
}

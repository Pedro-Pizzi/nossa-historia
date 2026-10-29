"use client";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useStory } from "./story-experience";

export function StoryAction({ action, target, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { action: "start" | "go" | "restart"; target?: string; children?: ReactNode }) {
  const { navigate, restart } = useStory();
  return <button {...props} type="button" onClick={() => action === "restart" ? restart() : navigate(action === "start" ? "carta" : target || "carta")}>{children}</button>;
}
export function StoryPhoto({ src, alt, className = "photo", children }: { src: string; alt: string; className?: string; children?: ReactNode }) {
  const { showPhoto } = useStory();
  return <button className={className} type="button" aria-label={`Ampliar foto: ${alt}`} onClick={() => showPhoto({ src, alt })}><img src={src} alt={alt} loading="lazy" />{children}</button>;
}

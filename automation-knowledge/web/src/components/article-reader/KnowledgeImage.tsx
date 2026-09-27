"use client";
import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { AnnotationObject } from "../../knowledge/types";

export function KnowledgeImage({ src, zoomSrc, alt, annotations = [] }: { src: string; zoomSrc?: string; alt: string; annotations?: AnnotationObject[] }) {
  const [expanded, setExpanded] = useState(false);
  const [zoom, setZoom] = useState(1);
  function visual() {
    return <div className="knowledge-image" style={expanded ? { width: `${zoom * 100}%`, maxWidth: "none" } : undefined}>
      <img src={expanded ? zoomSrc ?? src : src} alt={alt} loading="lazy" />
      <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">{annotations.map(item => {
        const stroke = `var(--annotation-${item.color})`;
        if (item.type === "text") return <text key={item.id} x={item.x * 1000} y={item.y * 1000} fill={stroke} fontSize="30">{item.text}</text>;
        if (item.type === "arrow") return <line key={item.id} x1={item.x * 1000} y1={item.y * 1000} x2={(item.x2 ?? item.x + .2) * 1000} y2={(item.y2 ?? item.y + .2) * 1000} stroke={stroke} strokeWidth={item.strokeWidth ?? 3} vectorEffect="non-scaling-stroke" />;
        if (item.type === "freehand") return <polyline key={item.id} points={item.points?.map(point => point * 1000).join(" ")} fill="none" stroke={stroke} strokeWidth={item.strokeWidth ?? 3} vectorEffect="non-scaling-stroke" />;
        return <rect key={item.id} x={item.x * 1000} y={item.y * 1000} width={(item.width ?? .18) * 1000} height={(item.height ?? .12) * 1000} fill="none" stroke={stroke} strokeWidth={item.strokeWidth ?? 3} vectorEffect="non-scaling-stroke" />;
      })}</svg>
    </div>;
  }
  return <figure><Dialog open={expanded} onOpenChange={setExpanded}><DialogTrigger asChild><button type="button" className="image-open" aria-label={`Phóng to: ${alt}`}>{visual()}</button></DialogTrigger><figcaption>{alt}</figcaption><DialogContent aria-describedby={undefined} className="image-viewer" style={{ top: 0, left: 0, transform: "none", maxWidth: "100vw", width: "100vw", height: "100dvh", padding: 0, borderRadius: 0 }}><DialogTitle className="sr-only">{alt}</DialogTitle><div className="image-controls"><button aria-label="Thu nhỏ" onClick={() => setZoom(Math.max(1, zoom - .5))}>−</button><span>{zoom * 100}%</span><button aria-label="Phóng to" onClick={() => setZoom(Math.min(4, zoom + .5))}>+</button></div><div className="image-scroll">{visual()}</div></DialogContent></Dialog></figure>;
}

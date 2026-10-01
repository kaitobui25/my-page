"use client";
import { useState } from "react";
import type { AnnotationObject } from "../../domain/knowledge/types";

type KnowledgeImageProps = {
  src: string;
  zoomSrc?: string;
  alt: string;
  annotations?: AnnotationObject[];
  displayWidth?: number;
  displayHeight?: number;
};

export function KnowledgeImage({ src, zoomSrc, alt, annotations = [], displayWidth, displayHeight }: KnowledgeImageProps) {
  const [expanded, setExpanded] = useState(false);
  const hasDisplaySize = Boolean(displayWidth && displayHeight && displayWidth > 0 && displayHeight > 0);
  const style = expanded
    ? { width: "100%", maxWidth: "100%", ...(hasDisplaySize ? { aspectRatio: `${displayWidth} / ${displayHeight}` } : {}) }
    : hasDisplaySize
      ? { width: `${displayWidth}px`, maxWidth: "100%", aspectRatio: `${displayWidth} / ${displayHeight}` }
      : undefined;

  return (
    <figure>
      <button
        type="button"
        className="image-open"
        data-expanded={expanded}
        aria-label={expanded ? `Thu nhỏ: ${alt}` : `Phóng to: ${alt}`}
        aria-pressed={expanded}
        onClick={() => setExpanded(value => !value)}
      >
        <div className={`knowledge-image${hasDisplaySize ? " knowledge-image-sized" : ""}`} style={style}>
          <img src={expanded ? zoomSrc ?? src : src} alt={alt} loading="lazy" />
      <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">{annotations.map(item => {
        const stroke = `var(--annotation-${item.color})`;
        if (item.type === "text") return <text key={item.id} x={item.x * 1000} y={item.y * 1000} fill={stroke} fontSize="30">{item.text}</text>;
        if (item.type === "arrow") return <line key={item.id} x1={item.x * 1000} y1={item.y * 1000} x2={(item.x2 ?? item.x + .2) * 1000} y2={(item.y2 ?? item.y + .2) * 1000} stroke={stroke} strokeWidth={item.strokeWidth ?? 3} vectorEffect="non-scaling-stroke" />;
        if (item.type === "freehand") return <polyline key={item.id} points={item.points?.map(point => point * 1000).join(" ")} fill="none" stroke={stroke} strokeWidth={item.strokeWidth ?? 3} vectorEffect="non-scaling-stroke" />;
        return <rect key={item.id} x={item.x * 1000} y={item.y * 1000} width={(item.width ?? .18) * 1000} height={(item.height ?? .12) * 1000} fill="none" stroke={stroke} strokeWidth={item.strokeWidth ?? 3} vectorEffect="non-scaling-stroke" />;
      })}</svg>
        </div>
      </button>
    </figure>
  );
}

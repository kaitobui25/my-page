"use client";

import { useEffect, useState, useRef } from "react";
import type Konva from "konva";
import { Group, Image as KonvaImage, Rect, Text, Transformer } from "react-konva";
import type { AnnotationColor, AssetRecord, CanvasObject, LayoutMap } from "../../../domain/knowledge/types";
import { useDocumentStore } from "../store/documentStore";
import { useCanvasThemeTokens } from "../../../components/theme/useCanvasThemeTokens";
const emptyAnnotations: import("../../../domain/knowledge/types").AnnotationObject[] = [];

function useLoadedImage(src?: string) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src) return;
    const next = new Image();
    next.crossOrigin = "anonymous";
    next.onload = () => setImage(next);
    next.src = src;
  }, [src]);
  return image;
}

export function CanvasImage({
  object,
  layout,
  asset,
  nodeRef,
  annotationDrawColor,
  onAnnotationModeEnter,
}: {
  object: CanvasObject;
  layout: LayoutMap[string];
  asset?: AssetRecord;
  nodeRef?: (node: Konva.Group | null) => void;
  annotationDrawColor?: AnnotationColor | null;
  onAnnotationModeEnter?: () => void;
}) {
  const image = useLoadedImage(asset?.previewUrl ?? asset?.optimized1200 ?? asset?.original);
  const selectedId = useDocumentStore((state) => state.selectedId);
  const annotationImageId = useDocumentStore((state) => state.annotationImageId);
  const annotations = useDocumentStore((state) => state.annotations[object.imageId ?? object.id]?.objects ?? emptyAnnotations);
  const setSelected = useDocumentStore((state) => state.setSelected);
  const updateLayout = useDocumentStore((state) => state.updateLayout);
  const enterAnnotationMode = useDocumentStore((state) => state.enterAnnotationMode);
  const updateAnnotation = useDocumentStore((state) => state.updateAnnotation);
  const imageId = object.imageId ?? object.id;
  const inAnnotationMode = annotationImageId === imageId;
  const selectedAnnotationId = useDocumentStore(state => state.selectedAnnotationId);
  const annotationRefs = useRef<Record<string, Konva.Rect>>({});
  const transformer = useRef<Konva.Transformer>(null);
  const drawStart = useRef<{ x: number; y: number } | null>(null);
  const [draftRect, setDraftRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const canvasTheme = useCanvasThemeTokens();
  const annotationColors: Record<AnnotationColor, string | undefined> = {
    red: canvasTheme?.annotationRed,
    blue: canvasTheme?.annotationBlue,
    green: canvasTheme?.annotationGreen,
    yellow: canvasTheme?.annotationYellow,
  };

  function relativePointer(group: Konva.Node) {
    const point = group.getRelativePointerPosition();
    if (!point) return null;
    return {
      x: Math.max(0, Math.min(layout.width, point.x)),
      y: Math.max(0, Math.min(layout.height, point.y)),
    };
  }

  function updateDraft(group: Konva.Node) {
    const start = drawStart.current;
    const point = relativePointer(group);
    if (!start || !point) return null;
    const rect = {
      x: Math.min(start.x, point.x),
      y: Math.min(start.y, point.y),
      width: Math.abs(point.x - start.x),
      height: Math.abs(point.y - start.y),
    };
    setDraftRect(rect);
    return rect;
  }

  function finishDraft(group: Konva.Node) {
    const rect = updateDraft(group) ?? draftRect;
    drawStart.current = null;
    setDraftRect(null);
    if (!rect || !annotationDrawColor || rect.width < 4 || rect.height < 4) return;
    useDocumentStore.getState().addAnnotation(imageId, {
      id: `ann_${crypto.randomUUID()}`,
      type: "rectangle",
      x: rect.x / layout.width,
      y: rect.y / layout.height,
      width: rect.width / layout.width,
      height: rect.height / layout.height,
      color: annotationDrawColor,
      strokeWidth: 3,
    });
  }

  useEffect(() => {
    const node = selectedAnnotationId ? annotationRefs.current[selectedAnnotationId] : null;
    transformer.current?.nodes(inAnnotationMode && node ? [node] : []);
  }, [inAnnotationMode, selectedAnnotationId, annotations.length]);

  return (
    <Group
      ref={nodeRef}
      x={layout.x}
      y={layout.y}
      draggable={!inAnnotationMode}
      onMouseDown={(event) => {
        if (!inAnnotationMode || !annotationDrawColor) return;
        const name = event.target.name();
        if (name === "annotation-rect" || name.includes("_anchor")) return;
        const point = relativePointer(event.currentTarget);
        if (!point) return;
        event.cancelBubble = true;
        useDocumentStore.setState({ selectedAnnotationId: null });
        drawStart.current = point;
        setDraftRect({ x: point.x, y: point.y, width: 0, height: 0 });
      }}
      onMouseMove={(event) => {
        if (inAnnotationMode && annotationDrawColor) {
          const stage = event.target.getStage();
          if (stage) stage.container().style.cursor = "crosshair";
        }
        if (drawStart.current) {
          event.cancelBubble = true;
          updateDraft(event.currentTarget);
        }
      }}
      onMouseUp={(event) => {
        if (!drawStart.current) return;
        event.cancelBubble = true;
        finishDraft(event.currentTarget);
      }}
      onMouseLeave={(event) => {
        const stage = event.target.getStage();
        if (stage) stage.container().style.cursor = "default";
        if (!drawStart.current) return;
        event.cancelBubble = true;
        finishDraft(event.currentTarget);
      }}
      onClick={(event) => {
        event.cancelBubble = true;
        setSelected(object.id);
      }}
      onDblClick={(event) => {
        event.cancelBubble = true;
        onAnnotationModeEnter?.();
        enterAnnotationMode(imageId);
      }}
      onDragEnd={(event) => { if (event.target === event.currentTarget) updateLayout(object.id, { x: event.target.x(), y: event.target.y() }); }}
    >
      <Rect
        name="image-surface"
        width={layout.width}
        height={layout.height}
        fill={canvasTheme?.surface}
        stroke={selectedId === object.id ? canvasTheme?.accent : canvasTheme?.line}
        cornerRadius={8}
      />
      {image ? (
        <KonvaImage name="image-surface" image={image} width={layout.width} height={layout.height} cornerRadius={8} />
      ) : (
        <Text
          width={layout.width}
          height={layout.height}
          align="center"
          verticalAlign="middle"
          text="Uploading image..."
          fill={canvasTheme?.inkSoft}
        />
      )}
      {draftRect && annotationDrawColor ? (
        <Rect
          x={draftRect.x}
          y={draftRect.y}
          width={draftRect.width}
          height={draftRect.height}
          stroke={annotationColors[annotationDrawColor]}
          strokeWidth={3}
          dash={[8, 5]}
          listening={false}
        />
      ) : null}
      {annotations.map((annotation) => (
        <Rect
          key={annotation.id}
          name="annotation-rect"
          ref={node => { if (node) annotationRefs.current[annotation.id] = node; }}
          x={annotation.x * layout.width}
          y={annotation.y * layout.height}
          width={(annotation.width ?? 0.18) * layout.width}
          height={(annotation.height ?? 0.12) * layout.height}
          stroke={annotationColors[annotation.color]}
          strokeWidth={annotation.strokeWidth ?? 3}
          draggable={inAnnotationMode}
          onClick={(event) => {
            event.cancelBubble = true;
            useDocumentStore.setState({ selectedAnnotationId: annotation.id });
          }}
          onDragEnd={(event) => {
            event.cancelBubble = true;
            updateAnnotation(imageId, annotation.id, {
              x: event.target.x() / layout.width,
              y: event.target.y() / layout.height,
            });
          }}
        />
      ))}
      {inAnnotationMode && <Transformer ref={transformer} rotateEnabled={false} flipEnabled={false} onTransformEnd={event => {
        event.cancelBubble = true;
        if (!selectedAnnotationId) return;
        const node = annotationRefs.current[selectedAnnotationId];
        if (!node) return;
        const width = node.width() * node.scaleX() / layout.width;
        const height = node.height() * node.scaleY() / layout.height;
        node.scaleX(1); node.scaleY(1);
        updateAnnotation(imageId, selectedAnnotationId, { x: node.x() / layout.width, y: node.y() / layout.height, width, height });
      }} />}
    </Group>
  );
}

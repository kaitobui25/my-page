"use client";

import { useEffect, useState, useRef } from "react";
import type Konva from "konva";
import { Group, Image as KonvaImage, Rect, Text, Transformer } from "react-konva";
import type { AssetRecord, CanvasObject, LayoutMap } from "../../../knowledge/types";
import { useDocumentStore } from "../store/documentStore";

const annotationColors = {
  red: "#C0392B",
  blue: "#2A6DB0",
  green: "#2E8B57",
  yellow: "#D4A017",
};
const emptyAnnotations: import("../../../knowledge/types").AnnotationObject[] = [];

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
}: {
  object: CanvasObject;
  layout: LayoutMap[string];
  asset?: AssetRecord;
  nodeRef?: (node: Konva.Group | null) => void;
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
      onClick={(event) => {
        event.cancelBubble = true;
        setSelected(object.id);
      }}
      onDblClick={(event) => {
        event.cancelBubble = true;
        enterAnnotationMode(imageId);
      }}
      onDragEnd={(event) => { if (event.target === event.currentTarget) updateLayout(object.id, { x: event.target.x(), y: event.target.y() }); }}
    >
      <Rect
        width={layout.width}
        height={layout.height}
        fill="#fff"
        stroke={selectedId === object.id ? "#0E7A83" : "#D6DADD"}
        cornerRadius={8}
      />
      {image ? (
        <KonvaImage image={image} width={layout.width} height={layout.height} cornerRadius={8} />
      ) : (
        <Text
          width={layout.width}
          height={layout.height}
          align="center"
          verticalAlign="middle"
          text="Uploading image..."
          fill="#4B5560"
        />
      )}
      {annotations.map((annotation) => (
        <Rect
          key={annotation.id}
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

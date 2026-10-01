import { markdownToBlocks } from "../../domain/knowledge/read/markdown";
import { KnowledgeImage } from "./KnowledgeImage";
import type { KnowledgeArticle } from "../../domain/knowledge/types";

export function ArticleBody({ markdown, article }: { markdown: string; article?: KnowledgeArticle }) {
  return <div className="article-body">{markdownToBlocks(markdown).map((block, index) => {
    if (block.type === "h1") return null;
    if (block.type === "h2") return <h2 id={`heading-${index}`} key={index}>{block.text}</h2>;
    if (block.type === "h3") return <h3 id={`heading-${index}`} key={index}>{block.text}</h3>;
    if (block.type === "quote") return <blockquote key={index}>{block.text}</blockquote>;
    if (block.type === "paste") return <blockquote className="article-pasted" key={index}>{block.text}</blockquote>;
    if (block.type === "pasteTable") return (
      <blockquote className="article-table-wrap article-note-table article-pasted" key={index}>
        <table>
          <thead>
            <tr>{block.rows[0]?.map((cell, cellIndex) => <th key={cellIndex}>{cell}</th>)}</tr>
          </thead>
          <tbody>
            {block.rows.slice(1).map((row, rowIndex) => (
              <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </blockquote>
    );
    if (block.type === "noteTable") return (
      <blockquote className="article-table-wrap article-note-table" key={index}>
        <table>
          <thead>
            <tr>{block.rows[0]?.map((cell, cellIndex) => <th key={cellIndex}>{cell}</th>)}</tr>
          </thead>
          <tbody>
            {block.rows.slice(1).map((row, rowIndex) => (
              <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </blockquote>
    );
    if (block.type === "table") return (
      <div className="article-table-wrap" key={index}>
        <table>
          <thead>
            <tr>{block.rows[0]?.map((cell, cellIndex) => <th key={cellIndex}>{cell}</th>)}</tr>
          </thead>
          <tbody>
            {block.rows.slice(1).map((row, rowIndex) => (
              <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    if (block.type === "image") {
      const match = /^!\[(.*)\]\(([^\s]+)\)$/.exec(block.text);
      if (match && match[2].startsWith("/api/assets/")) {
        const [src, fragment = ""] = match[2].split("#", 2);
        const objectId = fragment.startsWith("object=") ? decodeURIComponent(fragment.slice("object=".length)) : "";
        const object = objectId
          ? article?.document.objects.find(object => object.id === objectId && object.type === "image")
          : article?.document.objects.find(object => object.type === "image" && [article.assets[object.assetId ?? ""]?.optimized1200, article.assets[object.assetId ?? ""]?.original].includes(src));
        const asset = article?.assets[object?.assetId ?? ""];
        const imageLayout = object ? article?.layout[object.id] : undefined;
        return <KnowledgeImage key={index} src={src} zoomSrc={asset?.optimized2200 ?? asset?.original} alt={match[1]} annotations={article?.annotations[object?.imageId ?? object?.id ?? ""]?.objects} displayWidth={imageLayout?.width} displayHeight={imageLayout?.height} />;
      }
    }
    return <p style={{ whiteSpace: "pre-wrap" }} key={index}>{block.text}</p>;
  })}</div>;
}

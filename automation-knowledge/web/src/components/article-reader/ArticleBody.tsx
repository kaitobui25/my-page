import { markdownToBlocks } from "../../knowledge/read/markdown";
import { KnowledgeImage } from "./KnowledgeImage";
import type { KnowledgeArticle } from "../../knowledge/types";

export function ArticleBody({ markdown, article }: { markdown: string; article?: KnowledgeArticle }) {
  return <div className="article-body">{markdownToBlocks(markdown).map((block, index) => {
    if (block.type === "h1") return null;
    if (block.type === "h2") return <h2 id={`heading-${index}`} key={index}>{block.text}</h2>;
    if (block.type === "h3") return <h3 id={`heading-${index}`} key={index}>{block.text}</h3>;
    if (block.type === "quote") return <blockquote key={index}>{block.text}</blockquote>;
    if (block.type === "image") {
      const match = /^!\[(.*)\]\(([^\s]+)\)$/.exec(block.text);
      if (match && match[2].startsWith("/api/assets/")) {
        const object = article?.document.objects.find(object => object.type === "image" && [article.assets[object.assetId ?? ""]?.optimized1200, article.assets[object.assetId ?? ""]?.original].includes(match[2]));
        const asset = article?.assets[object?.assetId ?? ""];
        return <KnowledgeImage key={index} src={match[2]} zoomSrc={asset?.optimized2200 ?? asset?.original} alt={match[1]} annotations={article?.annotations[object?.imageId ?? object?.id ?? ""]?.objects} />;
      }
    }
    return <p style={{ whiteSpace: "pre-wrap" }} key={index}>{block.text}</p>;
  })}</div>;
}

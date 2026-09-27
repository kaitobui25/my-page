import { useDocumentStore } from "../store/documentStore";

let queue = Promise.resolve();
export function saveDraft(): Promise<void> {
  const state = useDocumentStore.getState();
  const article = state.toArticle();
  state.setSaveState("saving");
  try { localStorage.setItem(`automation-kb-draft:${article.meta.id}`, JSON.stringify(article)); } catch { /* Server save still works when browser storage is full. */ }
  const operation = queue.catch(() => {}).then(async () => {
    if (Object.values(article.assets).some(asset => asset.original.startsWith("blob:"))) throw new Error("Image upload is not complete");
    const response = await fetch("/api/articles", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(article) });
    if (!response.ok) throw new Error("Save failed");
    const current = useDocumentStore.getState();
    if (current.document === state.document && current.layout === state.layout && current.assets === state.assets && current.annotations === state.annotations) {
      current.markSaved();
      try { localStorage.removeItem(`automation-kb-draft:${article.meta.id}`); } catch { /* Keep the server result. */ }
    }
  });
  queue = operation;
  return operation.catch(error => { useDocumentStore.getState().setSaveState("failed"); throw error; });
}

export function subscribeAutosave() {
  let timer: ReturnType<typeof setTimeout>;
  const unsubscribe = useDocumentStore.subscribe((state, previous) => {
    if (!state.dirty || (state.document === previous.document && state.layout === previous.layout && state.annotations === previous.annotations && state.assets === previous.assets)) return;
    state.setSaveState("saving");
    try { localStorage.setItem(`automation-kb-draft:${state.articleId}`, JSON.stringify(state.toArticle())); } catch { /* Server remains authoritative. */ }
    clearTimeout(timer);
    timer = setTimeout(() => { void saveDraft().catch(() => {}); }, 700);
  });
  const online = () => { if (useDocumentStore.getState().dirty) void saveDraft().catch(() => {}); };
  const unload = (event: BeforeUnloadEvent) => { if (useDocumentStore.getState().dirty) { event.preventDefault(); event.returnValue = ""; } };
  window.addEventListener("online", online);
  window.addEventListener("beforeunload", unload);
  return () => { clearTimeout(timer); unsubscribe(); window.removeEventListener("online", online); window.removeEventListener("beforeunload", unload); };
}

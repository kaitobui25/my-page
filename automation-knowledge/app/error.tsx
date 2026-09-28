"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="topic-main"><h1>Không tải được dữ liệu</h1><p>Dữ liệu chưa khả dụng. Vui lòng thử lại.</p><button className="primary-button" onClick={reset}>Thử lại</button></main>;
}

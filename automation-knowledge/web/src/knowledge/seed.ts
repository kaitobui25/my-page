import type { KnowledgeArticle } from "./types";

export const seedArticles: KnowledgeArticle[] = [
  {
    meta: {
      id: "art_seed_profinet",
      slug: "s7-1500-profinet-et200-disconnect",
      title: "S7-1500 / PROFINET - ET200SP mất connection lúc máy chạy",
      status: "published",
      sourceLanguage: "vi",
      area: "plc",
      vendor: ["Siemens"],
      devices: ["S7-1500", "ET200SP"],
      technologies: ["PROFINET", "EMC"],
      articleType: "Troubleshooting",
      createdAt: "2026-09-27T09:00:00+09:00",
      updatedAt: "2026-09-27T21:00:00+09:00",
      publishedAt: "2026-09-27T21:10:00+09:00",
      lastTested: "TIA Portal V20 - FW V2.9",
      software: ["TIA Portal V20"],
      firmware: ["CPU FW V2.9"],
    },
    document: {
      articleId: "art_seed_profinet",
      title: "S7-1500 / PROFINET - ET200SP mất connection lúc máy chạy",
      objects: [
        { id: "sec_problem", type: "section", title: "Problem", order: 1, readerMode: "auto" },
        {
          id: "txt_problem",
          type: "text",
          sectionId: "sec_problem",
          text: "ET200SP bị drop khỏi PROFINET ngay khi máy đang chạy, không phải lúc khởi động.",
        },
        {
          id: "note_emc",
          type: "note",
          sectionId: "sec_problem",
          text: "Cáp PROFINET và cáp động lực biến tần đi chung máng - nghi nhiễu EMC.",
        },
        { id: "sec_fix", type: "section", title: "Fix", order: 2, readerMode: "auto" },
        {
          id: "txt_fix",
          type: "text",
          sectionId: "sec_fix",
          text: "Route lại cáp PROFINET tách khỏi máng cáp động lực, giữ khoảng cách tối thiểu 20cm hoặc dùng máng riêng có shield.",
        },
      ],
    },
    layout: {
      sec_problem: { x: 80, y: 80, width: 760, height: 280 },
      txt_problem: { x: 120, y: 145, width: 410, height: 96 },
      note_emc: { x: 560, y: 150, width: 250, height: 120 },
      sec_fix: { x: 80, y: 410, width: 760, height: 260 },
      txt_fix: { x: 120, y: 480, width: 560, height: 120 },
    },
    annotations: {},
    assets: {},
    contentVi:
      "# S7-1500 / PROFINET - ET200SP mất connection lúc máy chạy\n\n## Problem\n\nET200SP bị drop khỏi PROFINET ngay khi máy đang chạy, không phải lúc khởi động.\n\n> Cáp PROFINET và cáp động lực biến tần đi chung máng - nghi nhiễu EMC.\n\n## Fix\n\nRoute lại cáp PROFINET tách khỏi máng cáp động lực, giữ khoảng cách tối thiểu 20cm hoặc dùng máng riêng có shield.\n",
    publishedContentVi:
      "# S7-1500 / PROFINET - ET200SP mất connection lúc máy chạy\n\n## Problem\n\nET200SP bị drop khỏi PROFINET ngay khi máy đang chạy, không phải lúc khởi động.\n\n> Cáp PROFINET và cáp động lực biến tần đi chung máng - nghi nhiễu EMC.\n\n## Fix\n\nRoute lại cáp PROFINET tách khỏi máng cáp động lực, giữ khoảng cách tối thiểu 20cm hoặc dùng máng riêng có shield.\n",
  },
];

export const topicLabels: Record<string, string> = {
  plc: "PLC",
  "industrial-network": "Industrial Network",
  motion: "Motion",
  robot: "Robot",
  "python-software": "Python / Software",
};

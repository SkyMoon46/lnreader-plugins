import { Plugin, Novel, Chapter, ChapterContent } from "lnreader-plugin-sdk"; // Gerçekten böyle bir sdk varsa!

const BASE_URL = "https://novelokutr.net";

const searchNovels = async (searchTerm: string): Promise<Novel[]> => {
  const response = await fetch(`${BASE_URL}/?s=${encodeURIComponent(searchTerm)}`);
  const html = await response.text();

  // Burada cheerio veya benzeri bir kütüphane ile html parse edilerek sonuçlar çıkarılır
  const novels: Novel[] = [];
  // ... parse işlemi ve push ...
  return novels;
};

const fetchNovel = async (novelUrl: string): Promise<Novel> => {
  const response = await fetch(novelUrl);
  const html = await response.text();

  // Novel detaylarını parse et
  const novel: Novel = {
    name: "",
    cover: "",
    summary: "",
    author: "",
    status: "",
    genres: [],
    chapters: [],
    url: novelUrl,
  };
  // ... parse işlemi ve alanları doldur ...
  return novel;
};

const fetchChapter = async (chapterUrl: string): Promise<ChapterContent> => {
  const response = await fetch(chapterUrl);
  const html = await response.text();

  // Bölüm içeriğini parse et
  const content: ChapterContent = {
    title: "",
    content: "",
    url: chapterUrl,
  };
  // ... parse işlemi ve alanları doldur ...
  return content;
};

const plugin: Plugin = {
  id: "tr_novelokutr",
  name: "NovelOkutr",
  site: BASE_URL,
  version: "1.0.0",
  searchNovels,
  fetchNovel,
  fetchChapter,
};

export default plugin;

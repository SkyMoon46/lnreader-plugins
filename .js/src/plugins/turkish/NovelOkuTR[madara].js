import cheerio from "cheerio";
import { fetchApi } from "@libs/fetch";
import { NovelStatus } from "@libs/novelStatus";
import defaultCover from "@libs/defaultCover";
import { storage } from "@libs/storage";

function extractChapterNumber(chapterName, chapterObj) {
  const match = chapterName.match(/(\d+)/);
  if (match) chapterObj.chapterNumber = parseInt(match[0]);
}

const novelokutr = new (class {
  constructor() {
    this.id = "novelokutr";
    this.name = "NovelOkuTR";
    this.site = "https://novelokutr.net/novel/";
    this.icon = "multisrc/lightnovelwp/novelokutr/icon.png";
    this.version = "1.1.7";
    this.hideLocked = storage.get("hideLocked");
    this.filters = {
      "genre[]": {
        type: "Checkbox",
        label: "Genre",
        value: [],
        options: [
          { label: "Aksiyon", value: "aksiyon" },
          { label: "Bilim Kurgu", value: "bilim-kurgu" },
          { label: "Büyü", value: "buyu" },
          { label: "Comedy", value: "comedy" },
          { label: "Doğaüstü", value: "dogaustu" },
          { label: "Dövüş Sanatları", value: "dovus-sanatlari" },
          { label: "Dram", value: "dram" },
          { label: "Drama", value: "drama" },
          { label: "Ecchi", value: "ecchi" },
          { label: "Fantastik", value: "fantastik" },
          { label: "Fantasy", value: "fantasy" },
          { label: "Gizem", value: "gizem" },
          { label: "Harem", value: "harem" },
          { label: "Isekai", value: "isekai" },
          { label: "Josei", value: "josei" },
          { label: "Komedi", value: "komedi" },
          { label: "Korku", value: "korku" },
          { label: "Macera", value: "macera" },
          { label: "Mecha", value: "mecha" },
          { label: "Okul", value: "okul" },
          { label: "Oyun", value: "oyun" },
          { label: "Psikoloji", value: "psikoloji" },
          { label: "Psychological", value: "psychological" },
          { label: "Reenkarnasyon", value: "reenkarnasyon" },
          { label: "Romance", value: "romance" },
          { label: "Romantik", value: "romantik" },
          { label: "School Life", value: "school-life" },
          { label: "Sci-fi", value: "sci-fi" },
          { label: "Seinen", value: "seinen" },
          { label: "Shoujo", value: "shoujo" },
          { label: "Shounen", value: "shounen" },
          { label: "Shounen Ai", value: "shounen-ai" },
          { label: "Slice of Life", value: "slice-of-life" },
          { label: "Smut", value: "smut" },
          { label: "Süper Kahraman", value: "super-kahraman" },
          { label: "Supernatural", value: "supernatural" },
          { label: "Tarih", value: "tarih" },
          { label: "Trajedi", value: "trajedi" },
          { label: "Wuxia", value: "wuxia" },
          { label: "Xianxia", value: "xianxia" },
          { label: "Xuanhuan", value: "xuanhuan" },
          { label: "Yaoi", value: "yaoi" },
          { label: "Yetişkin", value: "yetiskin" },
          { label: "Yuri", value: "yuri" },
        ],
      },
      "type[]": {
        type: "Checkbox",
        label: "Tür",
        value: [],
        options: [{ label: "Web Novel", value: "web-novel" }],
      },
      status: {
        type: "Picker",
        label: "Durum",
        value: "",
        options: [
          { label: "Hepsi", value: "" },
          { label: "Devam Ediyor", value: "ongoing" },
          { label: "Askıda", value: "hiatus" },
          { label: "Tamamlanmış", value: "completed" },
        ],
      },
      order: {
        type: "Picker",
        label: "Sıralama",
        value: "",
        options: [
          { label: "Varsayılan", value: "" },
          { label: "A-Z", value: "title" },
          { label: "Z-A", value: "titlereverse" },
          { label: "Latest Update", value: "update" },
          { label: "Latest Added", value: "latest" },
          { label: "Popular", value: "popular" },
        ],
      },
    };
  }

  async safeFetch(url, allowRetry = false) {
    try {
      const res = await fetchApi(url);
      if (!res.ok && !allowRetry) throw new Error(`Siteye erişilemiyor (Status: ${res.status})`);
      const text = await res.text();

      // Basit bot kontrolü veya yönlendirme kontrolü
      const $ = cheerio.load(text);
      const title = $("title").text()?.trim() || "";
      if (
        title.includes("Bot Verification") ||
        title.includes("You are being redirected") ||
        title.includes("Redirecting")
      )
        throw new Error("Captcha veya Bot engeli var, webview'de açınız.");

      return text;
    } catch (e) {
      throw e;
    }
  }

  // Popüler romanları çek
  async popularNovels(page, { filters }) {
    let url = `${this.site}page/${page}/?`;

    // Filtreleri query stringe çevir
    for (const key in filters) {
      const val = filters[key];
      if (Array.isArray(val.value) && val.value.length > 0) {
        for (const v of val.value) {
          url += `${key}=${encodeURIComponent(v)}&`;
        }
      } else if (val.value) {
        url += `${key}=${encodeURIComponent(val.value)}&`;
      }
    }

    const html = await this.safeFetch(url);

    // Roman listesini parse et
    return this.parseNovels(html);
  }

  // Roman listesini html'den çıkar
  parseNovels(html) {
    const $ = cheerio.load(html);
    const novels = [];

    $("article").each((i, el) => {
      const aTag = $(el).find("a[href]").first();
      const name = aTag.attr("title")?.trim() || "";
      let path = aTag.attr("href") || "";
      if (path.startsWith(this.site)) path = path.replace(this.site, "");

      const img = $(el).find("img").first();
      const cover = img.attr("data-src") || img.attr("src") || defaultCover;

      if (name && path) {
        novels.push({ name, path, cover });
      }
    });

    return novels;
  }

  // Tek bir romanın detaylarını ve bölümlerini al
  async parseNovel(novelPath) {
    const url = this.site + novelPath;
    const html = await this.safeFetch(url);

    const novel = {
      path: novelPath,
      name: "",
      cover: "",
      summary: "",
      author: "",
      artist: "",
      status: NovelStatus.Unknown,
      genres: "",
      chapters: [],
    };

    const $ = cheerio.load(html);

    novel.name = $("h1").first().text().trim() || "";
    novel.cover = $("img.ts-post-image").attr("data-src") || $("img.ts-post-image").attr("src") || defaultCover;
    novel.summary = $(".entry-content p, .description, .summary").first().text().trim() || "";
    novel.author = $("div.serl:contains('Author') a").text().trim() || "";
    novel.artist = $("div.serl:contains('Artist') a").text().trim() || "";

    // Status çevirisi
    const statusText = $("div.serl:contains('Status')").text().toLowerCase();
    if (statusText.includes("tamamlandı") || statusText.includes("completed")) novel.status = NovelStatus.Completed;
    else if (statusText.includes("devam ediyor") || statusText.includes("ongoing")) novel.status = NovelStatus.Ongoing;
    else if (statusText.includes("askıda") || statusText.includes("hiatus")) novel.status = NovelStatus.OnHiatus;

    // Türler
    novel.genres = $("div.sertogenre a")
      .map((i, el) => $(el).text().trim())
      .get()
      .join(", ");

    // Bölümler
    const chapters = [];
    $(".eplister li a").each((i, el) => {
      const chapterName = $(el).text().trim();
      let chapterPath = $(el).attr("href") || "";
      if (chapterPath.startsWith(this.site)) chapterPath = chapterPath.replace(this.site, "");

      if (chapterName && chapterPath) {
        const chapter = { name: chapterName, path: chapterPath };
        extractChapterNumber(chapterName, chapter);
        chapters.push(chapter);
      }
    });

    // Ters çevir (bölüm 1 listenin en sonunda olabilir)
    novel.chapters = chapters.reverse();

    return novel;
  }

  // Bölüm içeriğini çek
  async parseChapter(chapterPath) {
    const url = this.site + chapterPath;
    const html = await this.safeFetch(url);

    const $ = cheerio.load(html);

    // Bölüm içeriği çoğunlukla bu class altında
    let content = $(".epcontent, .entry-content, .chapter-content").html();
    if (!content) content = $(".text-left").html() || "";

    return content || "";
  }

  // Arama fonksiyonu
  async searchNovels(searchTerm, page) {
    const url = `${this.site}page/${page}/?s=${encodeURIComponent(searchTerm)}`;

    const html = await this.safeFetch(url);

    return this.parseNovels(html);
  }
})();

export default novelokutr;

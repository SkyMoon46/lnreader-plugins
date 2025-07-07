import { fetchApi } from "@libs/fetch";
import cheerio from "cheerio";
import defaultCover from "@libs/defaultCover";
import { NovelStatus } from "@libs/novelStatus";
import dayjs from "dayjs";
import storage from "@libs/storage";

const containsAny = (text: string, keywords: string[]) =>
  new RegExp(keywords.join("|"), "i").test(text);

export default new (class {
  id = "novelokutr";
  name = "NovelOkuTR";
  icon = "multisrc/madara/novelokutr/icon.png";
  site = "https://novelokutr.net/";
  version = "1.0.0";
  options = { useNewChapterEndpoint: true, lang: "tr" };
  filters = {
    "genre[]": {
      type: "Checkbox",
      label: "Genre",
      value: [],
      options: [
        { label: "Aksiyon", value: "aksiyon" },
        { label: "Bilimkurgu", value: "bilimkurgu" },
        { label: "Doğaüstü", value: "dogaustu" },
        { label: "Dövüş Sanatları", value: "dovus-sanatlari" },
        { label: "Dram", value: "dram" },
        { label: "Ecchi", value: "ecchi" },
        { label: "Fantastik", value: "fantastik" },
        { label: "İsekai", value: "isekai" },
        { label: "Komedi", value: "komedi" },
        { label: "Macera", value: "macera" },
        { label: "Mecha", value: "mecha" },
        { label: "Novel", value: "novel" },
        { label: "Oyun", value: "oyun" },
        { label: "Renkli", value: "renkli" },
        { label: "Romantizm", value: "romantizm" },
      ],
    },
    op: { type: "Switch", label: "having all selected genres", value: false },
    author: { type: "Text", label: "Author", value: "" },
    artist: { type: "Text", label: "Artist", value: "" },
    release: { type: "Text", label: "Year of Released", value: "" },
    adult: {
      type: "Picker",
      label: "Adult content",
      value: "",
      options: [
        { label: "All", value: "" },
        { label: "None adult content", value: "0" },
        { label: "Only adult content", value: "1" },
      ],
    },
    "status[]": {
      type: "Checkbox",
      label: "Status",
      value: [],
      options: [
        { label: "Completed", value: "complete" },
        { label: "Ongoing", value: "on-going" },
        { label: "Canceled", value: "canceled" },
        { label: "On Hold", value: "on-hold" },
      ],
    },
    m_orderby: {
      type: "Picker",
      label: "Order by",
      value: "",
      options: [
        { label: "Relevance", value: "" },
        { label: "Latest", value: "latest" },
        { label: "A-Z", value: "alphabet" },
        { label: "Rating", value: "rating" },
        { label: "Trending", value: "trending" },
        { label: "Most Views", value: "views" },
        { label: "New", value: "new-manga" },
      ],
    },
  };

  hideLocked = storage.get("hideLocked") || false;

  async getCheerio(url: string, throwOnFail = true) {
    const res = await fetchApi(url);
    if (!res.ok && throwOnFail) throw new Error(`Failed to fetch: ${res.status}`);
    const html = await res.text();
    const $ = cheerio.load(html);

    // Captcha check
    const title = $("title").text().trim();
    if (
      this.getHostname(url) !== this.getHostname(res.url) ||
      ["Bot Verification", "You are being redirected...", "Just a moment...", "Redirecting..."].includes(title)
    ) {
      throw new Error("Captcha encountered, please open in webview");
    }

    return $;
  }

  getHostname(url: string) {
    const host = new URL(url).hostname;
    const parts = host.split(".");
    if (parts.length > 2) parts.shift();
    return parts.join(".");
  }

  parseDate(dateStr: string) {
    const now = dayjs();
    const numberMatch = dateStr.match(/\d+/);
    if (!numberMatch) return dateStr;

    const num = parseInt(numberMatch[0], 10);
    if (containsAny(dateStr, ["detik", "segundo", "second", "วินาที"])) return now.subtract(num, "second").format("LL");
    if (containsAny(dateStr, ["menit", "dakika", "min", "minute", "minuto", "นาที", "دقائق"])) return now.subtract(num, "minute").format("LL");
    if (containsAny(dateStr, ["jam", "saat", "heure", "hora", "hour", "ชั่วโมง", "giờ", "ore", "ساعة", "小时"])) return now.subtract(num, "hour").format("LL");
    if (containsAny(dateStr, ["hari", "gün", "jour", "día", "dia", "day", "วัน", "ngày", "giorni", "أيام", "天"])) return now.subtract(num, "day").format("LL");
    if (containsAny(dateStr, ["week", "semana"])) return now.subtract(num, "week").format("LL");
    if (containsAny(dateStr, ["month", "mes"])) return now.subtract(num, "month").format("LL");
    if (containsAny(dateStr, ["year", "año"])) return now.subtract(num, "year").format("LL");
    return dateStr;
  }

  async popularNovels(page = 1, filters = {}) {
    let url = `${this.site}/page/${page}/?s=&post_type=wp-manga`;
    if (filters && filters["m_orderby"]?.value === "latest") url += "&m_orderby=latest";

    if (filters) {
      for (const key in filters) {
        const val = filters[key]?.value;
        if (Array.isArray(val)) {
          val.forEach(v => {
            if (v) url += `&${key}=${v}`;
          });
        } else if (val) {
          url += `&${key}=${val}`;
        }
      }
    }

    const $ = await this.getCheerio(url, page !== 1);
    const novels: { name: string; cover: string; path: string }[] = [];

    $(".page-item-detail, .c-tabs-item__content").each((_, el) => {
      const title = $(el).find(".post-title").text().trim();
      const path = $(el).find(".post-title a").attr("href") || "";
      if (title && path) {
        const img = $(el).find("img");
        const cover =
          img.attr("data-src") || img.attr("src") || img.attr("data-lazy-srcset") || defaultCover;
        novels.push({
          name: title,
          cover,
          path: path.replace(/^https?:\/\/.*?\//, "/"),
        });
      }
    });

    return novels;
  }

  async parseNovel(path: string) {
    const $ = await this.getCheerio(this.site + path);
    $(".manga-title-badges, #manga-title span").remove();

    const novel = {
      path,
      name: $(".post-title h1").text().trim() || $("#manga-title h1").text().trim(),
      cover:
        $(".summary_image > a > img").attr("data-lazy-src") ||
        $(".summary_image > a > img").attr("data-src") ||
        $(".summary_image > a > img").attr("src") ||
        defaultCover,
      genres: "",
      author: "",
      artist: "",
      status: NovelStatus.Unknown,
      summary: "",
      chapters: [] as any[],
    };

    $(".post-content_item, .post-content").each((_, el) => {
      const title = $(el).find("h5").text().trim();
      const content = $(el).find(".summary-content");

      switch (title) {
        case "Genre(s)":
        case "Genre":
        case "Tags(s)":
        case "Tag(s)":
        case "Tags":
        case "Género(s)":
        case "التصنيفات":
          novel.genres = content.find("a").map((_, a) => $(a).text()).get().join(", ");
          break;
        case "Author(s)":
        case "Author":
        case "Autor(es)":
        case "المؤلف":
        case "المؤلف (ين)":
          novel.author = content.text().trim();
          break;
        case "Status":
        case "Novel":
        case "Estado":
          const statusText = content.text().trim().toLowerCase();
          if (statusText.includes("ongoing") || statusText.includes("مستمرة")) {
            novel.status = NovelStatus.Ongoing;
          } else if (statusText.includes("completed") || statusText.includes("tamamlandı")) {
            novel.status = NovelStatus.Completed;
          } else {
            novel.status = NovelStatus.Unknown;
          }
          break;
        case "Artist(s)":
          novel.artist = content.text().trim();
          break;
      }
    });

    if (!novel.author) novel.author = $(".manga-authors").text().trim();

    // Remove scripts, noscript, code blocks inside summary content
    $("div.summary__content .code-block, script, noscript").remove();
    novel.summary =
      $("div.summary__content").text().trim() ||
      $("#tab-manga-about").text().trim() ||
      $('.post-content_item h5:contains("Summary")')
        .next()
        .find("span")
        .map((_, a) => $(a).text())
        .get()
        .join("\n\n")
        .trim() ||
      $(".manga-summary p")
        .map((_, a) => $(a).text())
        .get()
        .join("\n\n")
        .trim() ||
      $(".manga-excerpt p")
        .map((_, a) => $(a).text())
        .get()
        .join("\n\n")
        .trim();

    // Chapters
    let chapters: any[] = [];
    if (this.options.useNewChapterEndpoint) {
      const res = await fetchApi(this.site + path + "ajax/chapters/", {
        method: "POST",
        referrer: this.site + path,
      });
      const text = await res.text();
      if (text !== "0") {
        const $$ = cheerio.load(text);
        chapters = this.parseChapters($$, this.hideLocked);
      }
    } else {
      // fallback legacy chapter fetch
      const $$ = await this.getCheerio(this.site + path);
      chapters = this.parseChapters($$, this.hideLocked);
    }

    novel.chapters = chapters.reverse();

    return novel;
  }

  parseChapters($: cheerio.CheerioAPI, hideLocked: boolean) {
    const chapters: any[] = [];
    $(".wp-manga-chapter").each((_, el) => {
      const name = $(el).find("a").text().trim();
      const locked = $(el).hasClass("premium-block");
      if (locked && hideLocked) return; // skip locked chapters if setting is enabled

      const releaseTimeRaw = $(el).find("span.chapter-release-date").text().trim();
      const releaseTime = releaseTimeRaw ? this.parseDate(releaseTimeRaw) : dayjs().format("LL");

      const path = $(el).find("a").attr("href") || "";

      chapters.push({
        name: locked ? "🔒 " + name : name,
        path: path.replace(/^https?:\/\/.*?\//, "/"),
        releaseTime,
      });
    });
    return chapters;
  }

  async parseChapter(path: string) {
    const $ = await this.getCheerio(this.site + path);
    // Common selectors for chapter content
    let content =
      $(".text-left").html() ||
      $(".text-right").html() ||
      $(".entry-content").html() ||
      $(".c-blog-post > div > div:nth-child(2)").html() ||
      "";

    // Sometimes custom JS transformations needed
    // (implement if your source needs it)

    return content || "";
  }

  async searchNovels(searchTerm: string, page = 1) {
    const url = `${this.site}/page/${page}/?s=${encodeURIComponent(searchTerm)}&post_type=wp-manga`;
    const $ = await this.getCheerio(url);

    return $(".page-item-detail, .c-tabs-item__content")
      .map((_, el) => {
        const title = $(el).find(".post-title").text().trim();
        const path = $(el).find(".post-title a").attr("href") || "";
        if (!title || !path) return null;

        const img = $(el).find("img");
        const cover = img.attr("data-src") || img.attr("src") || img.attr("data-lazy-srcset") || defaultCover;
        return {
          name: title,
          path: path.replace(/^https?:\/\/.*?\//, "/"),
          cover,
        };
      })
      .get()
      .filter(Boolean);
  }
})();

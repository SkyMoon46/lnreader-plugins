const cheerio = require("cheerio");
const htmlparser2 = require("htmlparser2");
const { fetchApi } = require("@libs/fetch");
const { NovelStatus } = require("@libs/novelStatus");
const defaultCover = require("@libs/defaultCover");
const { storage } = require("@libs/storage");

function extractChapterNumber(str, chapter) {
  const match = str.match(/(\d+)$/);
  if (match && match[0]) chapter.chapterNumber = parseInt(match[0]);
}

class NovelOkuTR {
  constructor(config) {
    this.hideLocked = storage.get("hideLocked");
    this.id = config.id;
    this.name = config.sourceName;
    this.icon = `multisrc/lightnovelwp/${config.id.toLowerCase()}/icon.png`;
    this.site = "https://novelokutr.net";
    const versionIncrement = (config.options?.versionIncrements) || 0;
    this.version = `1.1.${7 + versionIncrement}`;
    this.options = config.options || {};
    this.filters = undefined; // disable filters
  }

  getHostname(url) {
    const parts = url.split("/")[2].split(".");
    parts.pop();
    return parts.join(".");
  }

  async safeFecth(url, force) {
    const parts = url.split("://");
    const proto = parts.shift();
    const path = parts[0].replace(/\/\//g, "/");
    const response = await fetchApi(`${proto}://${path}`);

    if (!response.ok && !force) {
      throw new Error(`Could not reach site (${response.status}) try to open in webview.`);
    }

    const html = await response.text();
    const title = html.match(/<title>(.*?)<\/title>/)?.[1]?.trim();

    if (this.getHostname(url) !== this.getHostname(response.url) || [
      "Bot Verification",
      "You are being redirected...",
      "Un instant...",
      "Just a moment...",
      "Redirecting..."
    ].includes(title)) {
      throw new Error("Captcha error, please open in webview (or the website has changed url)");
    }

    return html;
  }

  parseNovels(html) {
    const novels = [];
    const $ = cheerio.load(html);

    $(".page-item-detail").each((_, el) => {
      const name = $(el).find("h3.h5 > a").text().trim();
      const cover = $(el).find("img").attr("data-src") || $(el).find("img").attr("src") || defaultCover;
      const href = $(el).find("h3.h5 > a").attr("href");
      let path = "";

      try {
        path = new URL(href).pathname;
      } catch (e) {
        path = href;
      }

      if (name && path.startsWith("/novel/")) {
        novels.push({ name, cover, path });
      }
    });

    return novels;
  }

  async popularNovels(page, _) {
    const url = `${this.site}/novel/page/${page}`;
    const html = await this.safeFecth(url, false);
    return this.parseNovels(html);
  }

  async searchNovels(searchTerm, page) {
    const url = `${this.site}/?s=${encodeURIComponent(searchTerm)}&post_type=wp-manga&page=${page}`;
    const html = await this.safeFecth(url, true);
    return this.parseNovels(html);
  }

  async parseNovel(novelPath) {
    const url = `${this.site}${novelPath}`;
    const html = await this.safeFecth(url, false);

    const novel = {
      path: novelPath,
      name: "",
      genres: "",
      summary: "",
      author: "",
      artist: "",
      status: NovelStatus.Unknown,
      chapters: [],
    };

    return novel;
  }

  async parseChapter(chapterPath) {
    const html = await this.safeFecth(`${this.site}${chapterPath}`, false);
    const $ = cheerio.load(html);
    const content = $(".epcontent").html();
    return content || "";
  }
}

module.exports = new NovelOkuTR({
  id: "novelokutr",
  sourceSite: "https://novelokutr.net/",
  sourceName: "NovelOkuTR",
  options: { lang: "Turkish" },
});

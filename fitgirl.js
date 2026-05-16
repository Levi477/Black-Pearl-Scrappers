const axios = require("axios");
const cheerio = require("cheerio");

const BASE_URL = "https://fitgirl-repacks.site";

module.exports = {
  name: "FitGirl",
  categories: [
    "Top 50 Repacks",
    "Top 150 Repacks",
    "Pink Paw Award",
    "Hypervisor Bypass",
    "Switch Emulated",
    "PS3 Emulated",
    "All Repacks",
  ],
  capabilities: {
    hasCategoryPagination: true,
    hasSearchPagination: true,
    hasStreaming: true,
  },

  async get_homepage_games(page_number = 1, onGameFound) {
    if (typeof page_number === "function") {
      onGameFound = page_number;
      page_number = 1;
    }
    const url =
      page_number === 1 ? BASE_URL : `${BASE_URL}/page/${page_number}/`;
    return this._scrapeWordPressLoop(url, onGameFound);
  },

  async search_games(query, page_number = 1, onGameFound) {
    if (typeof page_number === "function") {
      onGameFound = page_number;
      page_number = 1;
    }
    const formattedQuery = encodeURIComponent(query);
    const url =
      page_number === 1
        ? `${BASE_URL}/?s=${formattedQuery}`
        : `${BASE_URL}/page/${page_number}/?s=${formattedQuery}`;

    return this._scrapeSearchLoop(url, onGameFound);
  },

  async get_games_by_category(category, page_number = 1, onGameFound) {
    if (typeof page_number === "function") {
      onGameFound = page_number;
      page_number = 1;
    }
    let categoryPath = "";
    switch (category) {
      case "Top 50 Repacks":
        categoryPath = "category/top-50";
        break;
      case "Top 150 Repacks":
        categoryPath = "category/top-150";
        break;
      case "Pink Paw Award":
        categoryPath = "category/pink-paw";
        break;
      case "Hypervisor Bypass":
        categoryPath = "tag/hypervisor";
        break;
      case "Switch Emulated":
        categoryPath = "tag/switch";
        break;
      case "PS3 Emulated":
        categoryPath = "tag/ps3";
        break;
      case "All Repacks":
        categoryPath = "all-my-repacks-a-z";
        break;
      default:
        categoryPath = "all-my-repacks-a-z";
    }

    const url =
      page_number === 1
        ? `${BASE_URL}/${categoryPath}/`
        : `${BASE_URL}/${categoryPath}/page/${page_number}/`;

    return this._scrapeWordPressLoop(url, onGameFound);
  },

  _cleanName(name) {
    return name.includes(" – ") ? name.split(" – ")[0] : name;
  },

  async _scrapeWordPressLoop(url, onGameFound) {
    try {
      const { data } = await axios.get(url);
      const $ = cheerio.load(data);
      const results = [];

      const articles = $("article").toArray();

      for (const article of articles) {
        const titleTag = $(article).find("h1.entry-title a");
        if (!titleTag.length) continue;

        const name = titleTag.text().trim();
        const link = titleTag.attr("href");

        const imgTag = $(article).find(".entry-content p img");
        const thumbnail = imgTag.attr("src") || "";

        const timeTag = $(article).find("time.entry-date");
        const dateStr = timeTag.attr("datetime") || timeTag.text().trim();
        let releaseDate = new Date();
        if (dateStr) {
          releaseDate = new Date(dateStr);
        }

        const game = {
          name: this._cleanName(name),
          thumbnail_link: thumbnail,
          url: link,
          release_date: releaseDate.toISOString(),
          download_links: [],
        };

        if (onGameFound) {
          onGameFound(game);
        } else {
          results.push(game);
        }
      }
      return results;
    } catch (e) {
      return [];
    }
  },

  async _scrapeSearchLoop(url, onGameFound) {
    return this._scrapeWordPressLoop(url, onGameFound);
  },

  async get_game_details(url) {
    try {
      const { data: html } = await axios.get(url);
      const $ = cheerio.load(html);

      const titleTag = $("h1.entry-title");
      const name = titleTag.text().trim();

      const imgTag = $(".entry-content p img").first();
      const thumbnail = imgTag.attr("src") || "";

      const origMatch = html.match(
        /Original Size:\s*<strong>([^<]+)<\/strong>/i,
      );
      const repackMatch = html.match(
        /Repack Size:\s*<strong>([^<]+)<\/strong>/i,
      );
      let size = "";
      if (origMatch && repackMatch)
        size = `${origMatch[1].trim()} (Real) / ${repackMatch[1].trim()} (Compressed)`;

      let tag = "";
      if (
        $("span").filter((_, el) => $(el).text().includes("HYPERVISOR"))
          .length > 0
      )
        tag = "HYPERVISOR";

      const download_links = [];

      $("a[href^='magnet:']").each((_, el) => {
        download_links.push($(el).attr("href"));
      });

      return {
        name: this._cleanName(name),
        thumbnail_link: thumbnail,
        size,
        tag,
        download_links,
      };
    } catch (e) {
      return null;
    }
  },
};

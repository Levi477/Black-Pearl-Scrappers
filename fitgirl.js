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
    return this._scrapeWordPressLoop(url, onGameFound);
  },

  async get_games_by_category(category, page_number = 1, onGameFound) {
    if (typeof page_number === "function") {
      onGameFound = page_number;
      page_number = 1;
    }

    const catMap = {
      "Top 50 Repacks": `${BASE_URL}/pop-repacks/`,
      "Top 150 Repacks": `${BASE_URL}/popular-repacks-of-the-year/`,
      "Pink Paw Award": `${BASE_URL}/games-with-my-personal-pink-paw-award/?lcp_page0=${page_number}#lcp_instance_0`,
      "Hypervisor Bypass": `${BASE_URL}/all-hypervisor-bypassed-repacks-a-z/?lcp_page0=${page_number}#lcp_instance_0`,
      "Switch Emulated": `${BASE_URL}/all-switch-emulated-repacks-a-z/?lcp_page0=${page_number}#lcp_instance_0`,
      "PS3 Emulated": `${BASE_URL}/all-playstation-3-emulated-repacks-a-z/?lcp_page0=${page_number}#lcp_instance_0`,
      "All Repacks": `${BASE_URL}/all-my-repacks-a-z/?lcp_page0=${page_number}#lcp_instance_0`,
    };

    const url = catMap[category];
    if (!url) return [];
    return this._scrapeListPage(url, onGameFound);
  },

  async _scrapeWordPressLoop(url, onGameFound) {
    try {
      const { data } = await axios.get(url);
      const $ = cheerio.load(data);
      const results = [];

      $("article.post").each((_, post) => {
        const titleTag = $(post).find("h1.entry-title a");
        if (!titleTag.length) return;

        const rawName = titleTag.text().trim();
        const cleanName = rawName
          .replace(/FitGirl/i, "")
          .replace(/Repack/i, "")
          .split(/ – | - | \+|,\s|\//)[0]
          .trim();

        if (
          cleanName.toLowerCase().includes("upcoming repacks") ||
          cleanName.toLowerCase().includes("updates digest")
        )
          return;

        const link = titleTag.attr("href");
        const thumbnail =
          $(post).find(".entry-content img").first().attr("src") || "";

        let categories = [];
        $(post)
          .find("p")
          .filter((_, el) => $(el).text().includes("Genres/Tags:"))
          .find("a")
          .each((_, tag) => {
            categories.push($(tag).text().trim().toLowerCase());
          });

        categories = categories.filter((c) => c && c.trim() !== "");

        const html = $(post).find(".entry-content").html() || "";
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
          $(post)
            .find("span")
            .filter((_, el) => $(el).text().includes("HYPERVISOR")).length > 0
        )
          tag = "HYPERVISOR";

        const gameObj = {
          name: cleanName,
          thumbnail_link: thumbnail,
          categories,
          size,
          tag,
          url: link,
          download_links: [],
        };

        if (typeof onGameFound === "function") onGameFound(gameObj);
        results.push(gameObj);
      });
      return results;
    } catch (e) {
      return [];
    }
  },

  async _scrapeListPage(url, onGameFound) {
    try {
      const { data } = await axios.get(url);
      const $ = cheerio.load(data);
      const links = [];

      if ($("div.widget-grid-view-image").length > 0) {
        $("div.widget-grid-view-image a").each((_, el) => {
          const href = $(el).attr("href");
          if (href) links.push(href);
        });
      } else if ($("ul#lcp_instance_0").length > 0) {
        $("ul#lcp_instance_0 li a").each((_, el) => {
          const href = $(el).attr("href");
          if (
            href &&
            href.startsWith(BASE_URL) &&
            !href.includes("/category/") &&
            !href.includes("/tag/") &&
            !href.includes("#")
          ) {
            links.push(href);
          }
        });
      }

      const uniqueLinks = [...new Set(links)];
      const results = [];

      for (let i = 0; i < uniqueLinks.length; i += 5) {
        const batch = uniqueLinks.slice(i, i + 5);
        const batchResults = await Promise.all(
          batch.map(async (link) => {
            const details = await this.get_game_details(link);
            const gameObj = {
              name: details.name || "Unknown",
              thumbnail_link: details.thumbnail_link || "",
              categories: details.categories || [],
              size: details.size || "",
              tag: details.tag || "",
              url: link,
              download_links: details.download_links || [],
            };

            if (typeof onGameFound === "function") onGameFound(gameObj);
            return gameObj;
          }),
        );
        results.push(...batchResults);
      }
      return results;
    } catch (e) {
      return [];
    }
  },

  async get_game_details(url) {
    try {
      const res = await axios.get(url);
      const $ = cheerio.load(res.data);

      const rawName = $("h1.entry-title").text().trim();
      const name = rawName
        .replace(/FitGirl/i, "")
        .replace(/Repack/i, "")
        .split(/ – | - | \+|,\s|\//)[0]
        .trim();

      const thumbnail_link = $(".entry-content img").first().attr("src") || "";

      let categories = [];
      $("p")
        .filter((_, el) => $(el).text().includes("Genres/Tags:"))
        .find("a")
        .each((_, el) => {
          categories.push($(el).text().trim().toLowerCase());
        });
      categories = categories.filter((c) => c && c.trim() !== "");

      const html = $(".entry-content").html() || "";
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

      $(".su-spoiler-content.su-u-clearfix.su-u-trim").each((_, spoilerDiv) => {
        const partLinks = [];
        $(spoilerDiv)
          .find("a")
          .each((_, aTag) => {
            const dl = $(aTag).attr("href");
            if (
              dl &&
              dl.startsWith("http") &&
              !dl.includes("paste.fitgirl") &&
              !dl.includes("internetdownloadmanager") &&
              !dl.includes("jdownloader")
            ) {
              partLinks.push(dl);
            }
          });
        if (partLinks.length > 0) {
          download_links.push(partLinks);
        }
      });

      return {
        name,
        thumbnail_link,
        categories,
        size,
        tag,
        url,
        download_links,
      };
    } catch (err) {
      return { download_links: [] };
    }
  },
};

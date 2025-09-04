// Requires: Node 18+, npm i express puppeteer
import express from "express";

const app = express();
const PORT = 3030;

const MAX_HOPS = 12;
const REQ_TIMEOUT_MS = 12000;
const HTML_SNIFF_LIMIT = 128 * 1024;
const JS_WAIT_MS = 4000;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";

app.use(express.urlencoded({ extended: true, limit: "6mb" }));
app.use(express.json({ limit: "6mb" }));

// ------------ utils ------------
const esc = (s = "") =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        c
      ])
  );
const attr = esc;
const short = (u) => {
  try {
    const { hostname, pathname } = new URL(u);
    return hostname + (pathname && pathname !== "/" ? "/…" : "");
  } catch {
    return u;
  }
};

function getMarkers(u) {
  const sp = new URL(u).searchParams;
  return {
    campaign: sp.get("campaign"),
    campaignMarker: sp.get("campaignMarker"),
  };
}

async function fetchWithTimeout(u) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQ_TIMEOUT_MS);
  try {
    return await fetch(u, {
      method: "GET",
      redirect: "manual",
      headers: { "user-agent": UA },
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(t);
  }
}

async function readHtmlCapped(res, cap = HTML_SNIFF_LIMIT) {
  return (await res.text()).slice(0, cap);
}

function sniffHtml(html, base) {
  const re1 = /http-equiv=["']?refresh["']?[^>]*url=([^"'>\s]+)/i;
  const re2 = /location\.(?:href|replace|assign)\s*=\s*['"]([^'"]+)['"]/i;
  const re3 = /history\.pushState\([^)]*['"]([^'"]+)['"]\s*\)/i;
  const re4 = /https?:\/\/[^\s"'<>]+/gi;
  let m;
  if ((m = html.match(re1))) return new URL(m[1], base).toString();
  if ((m = html.match(re2))) return new URL(m[1], base).toString();
  if ((m = html.match(re3))) return new URL(m[1], base).toString();
  while ((m = re4.exec(html)) !== null) {
    if (/campaign=/.test(m[0]) && /campaignMarker=/.test(m[0])) return m[0];
  }
  return null;
}

// ------------ chain resolver ------------
async function resolveChain(start) {
  let current = new URL(start).toString();
  let lastC = null,
    lastM = null;

  for (let i = 0; i < MAX_HOPS; i++) {
    const m = getMarkers(current);
    if (m.campaign) lastC = m.campaign;
    if (m.campaignMarker) lastM = m.campaignMarker;
    if (lastC && lastM)
      return {
        finalUrl: current,
        campaign: lastC,
        campaignMarker: lastM,
        from: "srv",
      };

    const res = await fetchWithTimeout(current).catch(() => null);
    if (!res) break;

    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location"), current).toString();
      continue;
    }
    if (res.status === 200) {
      const html = await readHtmlCapped(res);
      const next = sniffHtml(html, current);
      if (next) {
        current = next;
        continue;
      }
    }
    break;
  }
  return {
    finalUrl: current,
    campaign: lastC,
    campaignMarker: lastM,
    from: "srv",
  };
}

// ------------ Puppeteer fallback ------------
let puppeteer = null;
let browser = null;

async function ensureBrowser() {
  if (!puppeteer) puppeteer = (await import("puppeteer")).default;
  if (!browser)
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox"],
    });
  return browser;
}

async function resolveWithJS(start) {
  const br = await ensureBrowser();
  const page = await br.newPage();
  await page.setUserAgent(UA);
  let url = start;
  try {
    await page.goto(start, {
      waitUntil: ["domcontentloaded", "networkidle2"],
      timeout: REQ_TIMEOUT_MS,
    });
    url = await page.evaluate(() => location.href);
    const t0 = Date.now();
    while (Date.now() - t0 < JS_WAIT_MS) {
      await page.waitForTimeout(300);
      const now = await page.evaluate(() => location.href);
      if (now !== url) url = now;
    }
  } catch {}
  await page.close();
  const m = getMarkers(url);
  return {
    finalUrl: url,
    campaign: m.campaign,
    campaignMarker: m.campaignMarker,
    from: "JS",
  };
}

// ------------ endpoints ------------
app.post("/view", async (req, res) => {
  let urls = req.body.urls;
  const useJS =
    req.query.js === "1" || req.body.js === "true" || req.body.js === true;
  if (!urls) return res.send("no urls");
  if (!Array.isArray(urls))
    urls = String(urls)
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);

  const out = [];
  for (const raw of urls) {
    try {
      let r = await resolveChain(raw);
      if (!(r.campaign && r.campaignMarker) && useJS) {
        try {
          r = await resolveWithJS(r.finalUrl);
        } catch (e) {
          r = { ...r, error: e.message };
        }
      }
      out.push(r);
    } catch (e) {
      out.push({ finalUrl: raw, error: String(e) });
    }
  }

  const rows = out
    .map((r, i) => {
      if (r.error)
        return `<tr><td>${i + 1}</td><td colspan="4" style="color:red">${esc(
          r.error
        )}</td></tr>`;
      return `<tr>
      <td>${i + 1}</td>
      <td><a href="${attr(r.finalUrl)}" target="_blank">${esc(
        short(r.finalUrl)
      )}</a></td>
      <td>${esc(r.campaign ?? "—")}</td>
      <td>${esc(r.campaignMarker ?? "—")}</td>
      <td>${r.from}</td>
    </tr>`;
    })
    .join("");

  res.type("html").send(`<!doctype html><meta charset="utf-8">
  <style>td,th{padding:4px;border-bottom:1px solid #ccc}.err{color:red}</style><title>Linkredirect</title>
  <table><thead><tr><th>#</th><th>URL</th><th>campaign</th><th>campaignMarker</th><th>src</th></tr></thead><tbody>${rows}</tbody></table>`);
});

app.listen(PORT, () => console.log("READY http://127.0.0.1:" + PORT));

// graceful shutdown
process.on("SIGINT", async () => {
  try {
    if (browser) await browser.close();
  } catch {}
  process.exit(0);
});
process.on("SIGTERM", async () => {
  try {
    if (browser) await browser.close();
  } catch {}
  process.exit(0);
});

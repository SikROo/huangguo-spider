// huangguo_web_spider.js
// 黄果短剧 · 接口版 Spider（FongMi / 影视TV QuickJS）
// 与 huangguo-fongmi 的旧脚本相比：不抓页面 HTML、不依赖 assets 内置 crypto-js，
// 全部走站点已公开的 JSON 接口，源站前端改版不会影响列表与解析。
// 接口来源见 DRDRDRRDDRDR/huangguo-web 的 README。
// v3 新增「黄果吃瓜」板块：/api/chigua?cate=all|remen|yuanchuang，
// 条目 id 形如 archives_123，直链不在 /api/play 里，改从 /api/detail 取。

const API = 'https://huangguo-parser.13681235735.workers.dev'; // 可换成你自建的 Worker
const SITE = 'https://huangguoai.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

let BASE = API;

const CLASSES = [
  { type_id: 'ai-duanju',  type_name: 'AI短剧' },
  { type_id: 'ai-manju',   type_name: 'AI漫剧' },
  { type_id: 'ai-huanlian', type_name: '换脸专区' },
  { type_id: 'ai-mogai',   type_name: '魔改专区' },
  { type_id: 'chigua',            type_name: '吃瓜·全部' },
  { type_id: 'chigua:remen',      type_name: '吃瓜·热门' },
  { type_id: 'chigua:yuanchuang', type_name: '吃瓜·AI原创' },
  { type_id: 'rank:hot',      type_name: '热播榜' },
  { type_id: 'rank:recommend', type_name: '推荐榜' },
  { type_id: 'rank:potential', type_name: '潜力榜' }
];

const SORTS = [
  { n: '最新更新', v: 'latest' },
  { n: '当前热播', v: 'hot' },
  { n: '独家原创', v: 'original' },
  { n: '随机推荐', v: 'random' }
];

function getJson(path) {
  try {
    const r = req(BASE + path, {
      method: 'get',
      headers: { 'User-Agent': UA, 'Referer': SITE + '/' },
      timeout: 15000
    });
    if (!r || Number(r.code) !== 200 || !r.content) return null;
    return JSON.parse(String(r.content));
  } catch (e) {
    return null;
  }
}

function picOf(u) {
  u = String(u || '');
  if (!u) return '';
  return /^https?:\/\//i.test(u) ? u : BASE + u;
}

function toVod(x) {
  const t = Array.isArray(x.vod_tags) ? x.vod_tags.join(' / ') : '';
  return {
    vod_id: String(x.vod_id),
    vod_name: String(x.vod_name || ''),
    vod_pic: picOf(x.vod_pic),
    vod_remarks: String(x.vod_remarks || ''),
    vod_year: String(x.vod_year || ''),
    vod_score: String(x.vod_score || ''),
    vod_content: String(x.vod_desc || ''),
    vod_actor: String(x.vod_author || ''),
    type_name: t
  };
}

function pageOf(tid, pg, sort) {
  const page = Math.max(1, parseInt(pg || '1', 10) || 1);
  const size = 50;
  if (String(tid).indexOf('chigua') === 0) {
    const cate = String(tid).split(':')[1] || 'all';
    return getJson('/api/chigua?cate=' + encodeURIComponent(cate) + '&page=' + page + '&size=' + size);
  }
  if (String(tid).indexOf('rank:') === 0) {
    const kind = String(tid).slice(5) || 'hot';
    return getJson('/api/ranks/' + kind + '?page=' + page + '&size=' + size);
  }
  if (String(tid) === 'search') return getJson('/api/category/ai-duanju?page=1&size=' + size + '&sort=latest');
  return getJson('/api/category/' + encodeURIComponent(tid) + '?page=' + page + '&size=' + size + '&sort=' + (sort || 'latest'));
}

export default {
  init(cfg) {
    this.cfg = cfg || {};
    if (this.cfg.api && /^https?:\/\//i.test(String(this.cfg.api))) BASE = String(this.cfg.api);
  },

  home(filter) {
    return JSON.stringify({ class: CLASSES, filters: {} });
  },

  homeVod() {
    const d = pageOf('ai-duanju', 1, 'latest');
    const list = d && Array.isArray(d.list) ? d.list : [];
    return JSON.stringify({ list: list.map(toVod) });
  },

  category(tid, pg, filter, extend) {
    const page = Math.max(1, parseInt(pg || '1', 10) || 1);
    let sort = 'latest';
    try { if (extend && extend.sort) sort = String(extend.sort); } catch (e) {}
    const d = pageOf(String(tid || 'ai-duanju'), page, sort);
    const list = d && Array.isArray(d.list) ? d.list : [];
    const pages = d && d.pagecount ? Number(d.pagecount) : (list.length ? page + 1 : page);
    return JSON.stringify({
      list: list.map(toVod),
      page: page,
      pagecount: pages,
      limit: list.length,
      total: d && d.total ? Number(d.total) : (pages * list.length)
    });
  },

  search(wd, quick, pg) {
    const key = String(wd || '').trim();
    const page = Math.max(1, parseInt(pg || '1', 10) || 1);
    if (!key) return JSON.stringify({ list: [], page: page, pagecount: page });
    const d = getJson('/api/search/' + encodeURIComponent(key) + '?page=' + page + '&size=50');
    const list = d && Array.isArray(d.list) ? d.list : [];
    return JSON.stringify({
      list: list.map(toVod),
      page: page,
      pagecount: list.length ? page + 1 : page,
      limit: list.length,
      total: list.length ? (page + 1) * list.length : 0
    });
  },

  detail(id) {
    id = String(id || '').trim();
    if (!id) return JSON.stringify({ list: [] });
    const d = getJson('/api/detail/' + encodeURIComponent(id));
    const x = d && Array.isArray(d.list) && d.list.length ? d.list[0] : null;
    if (!x) return JSON.stringify({ list: [] });
    const eps = Array.isArray(x.episodes) ? x.episodes : [];
    const playUrl = eps.map(function (e) {
      const n = String(e.ep || '1');
      const t = String(e.title || '') || ('第' + n + '集');
      return t + '$' + id + '|||' + n;
    }).join('#');
    const vod = toVod(x);
    vod.vod_play_from = '黄果';
    vod.vod_play_url = playUrl;
    return JSON.stringify({ list: [vod] });
  },

  play(flag, id, flags) {
    const raw = String(id || '');
    const parts = raw.split('|||');
    const vid = (parts[0] || '').trim();
    const ep = (parts.length > 1 ? parts[1] : '1') || '1';
    if (!vid) return JSON.stringify({ parse: 0, url: '' });

    // 吃瓜条目（archives_ 前缀）：/api/play 不认这种 id，直链在 /api/detail 的 episodes[0].url
    if (vid.indexOf('archives_') === 0) {
      const dd = getJson('/api/detail/' + encodeURIComponent(vid));
      const xx = dd && Array.isArray(dd.list) && dd.list.length ? dd.list[0] : null;
      const ee = xx && Array.isArray(xx.episodes) ? xx.episodes : [];
      const uu = ee.length ? String(ee[0].url || '') : '';
      if (!uu) return JSON.stringify({ parse: 0, url: '' });
      const out = { parse: 0, url: uu, header: { 'User-Agent': UA, 'Referer': SITE + '/' } };
      if (/\.m3u8/i.test(uu)) out.format = 'application/vnd.apple.mpegurl';
      return JSON.stringify(out);
    }

    const d = getJson('/api/play?url=' + encodeURIComponent(vid) + '&ep=' + encodeURIComponent(ep));
    if (!d || !d.url) return JSON.stringify({ parse: 0, url: '' });
    // 优先直连原始 m3u8：源站按出口 IP 下发片源，走代理只能拿到预览片段
    return JSON.stringify({
      parse: 0,
      url: String(d.url),
      header: { 'User-Agent': UA, 'Referer': SITE + '/' },
      format: 'application/vnd.apple.mpegurl'
    });
  }
};

// huangguo_web_spider.js
// 黄果短剧 · 接口版 Spider（FongMi / 影视TV QuickJS）
// 与 huangguo-fongmi 的旧脚本相比：不抓页面 HTML、不依赖 assets 内置 crypto-js，
// 列表/详情/播放全部走站点的 JSON 接口，源站前端改版不会影响列表与解析。
// 接口来源见 DRDRDRRDDRDR/huangguo-web 的 README 与 worker 源码。
// v3 新增「黄果吃瓜」板块：/api/chigua?cate=all|remen|yuanchuang，
// 条目 id 形如 archives_123，直链不在 /api/play 里，改从 /api/detail 取。
// v4 补齐网页端剩余入口：精选推荐（/api/all）、分类排序（含独家原创 sort=original）、
// 专辑专题（站点 /api/topics 与 /api/topics/{slug} 的 JSON）。

const API = 'https://huangguo-parser.13681235735.workers.dev'; // 可换成你自建的 Worker
const SITE = 'https://huangguoai.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

let BASE = API;

// 分类顺序大致对应网页端导航：全部剧集 → 排行榜 → 专辑专题 → 黄果吃瓜
const CLASSES = [
  { type_id: 'ai-duanju',   type_name: 'AI短剧' },
  { type_id: 'ai-manju',    type_name: 'AI漫剧' },
  { type_id: 'ai-huanlian', type_name: '换脸专区' },
  { type_id: 'ai-mogai',    type_name: '魔改专区' },
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

// 排序筛选：只挂在四个剧集分类上（吃瓜/榜单/专题没有排序参数）
const SORT_FILTER = [{ key: 'sort', name: '排序', value: SORTS.map(function (s) { return { n: s.n, v: s.v }; }) }];
const FILTERS = {
  'ai-duanju': SORT_FILTER,
  'ai-manju': SORT_FILTER,
  'ai-huanlian': SORT_FILTER,
  'ai-mogai': SORT_FILTER
};

function reqJson(url) {
  try {
    const r = req(url, {
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

// Worker 上的接口（走 BASE，可换自建代理）
function getJson(path) {
  return reqJson(BASE + path);
}

// 站点原生 JSON（专辑专题等 Worker 未转发的接口，只能直连源站）
function getSiteJson(path) {
  return reqJson(SITE + path);
}

function picOf(u) {
  u = String(u || '');
  if (!u) return '';
  // 站点原始封面是 AES 加密的二进制，必须经 /media 解密；Worker 返回的已是相对路径
  if (/^https?:\/\//i.test(u)) return BASE + '/media?url=' + encodeURIComponent(u);
  return BASE + u;
}

function toVod(x) {
  const t = Array.isArray(x.vod_tags) ? x.vod_tags.join(' / ') : String(x.vod_type_name || '');
  return {
    vod_id: String(x.vod_id || x.id || ''),
    vod_name: String(x.vod_name || x.title || ''),
    vod_pic: picOf(x.vod_pic || x.cover),
    vod_remarks: String(x.vod_remarks || ''),
    vod_year: String(x.vod_year || ''),
    vod_score: String(x.vod_score || x.score || ''),
    vod_content: String(x.vod_desc || x.description || ''),
    vod_actor: String(x.vod_author || ''),
    type_name: t
  };
}

// 站点 /api/topics/{slug} 里的单条视频
function toSiteVod(x) {
  const eps = Number(x.episode_count || 0);
  const tag = [eps ? eps + '集' : '', x.is_original ? '原创' : '', x.score ? x.score + '分' : ''];
  return {
    vod_id: String(x.id || ''),
    vod_name: String(x.title || ''),
    vod_pic: picOf(x.cover || ''),
    vod_remarks: tag.filter(function (s) { return !!s; }).join(' · '),
    vod_year: '',
    vod_score: String(x.score || ''),
    vod_content: String(x.description || ''),
    vod_actor: '',
    type_name: ''
  };
}

// 专题标签名：把「精品高分AI短剧专辑」压成「精品高分」
function topicShort(title) {
  let t = String(title || '')
    .replace(/AI成人短剧专辑$/, '')
    .replace(/AI短剧专辑$/, '')
    .replace(/AI成人漫剧专辑$/, '')
    .replace(/AI漫剧专辑$/, '')
    .replace(/专辑$/, '')
    .replace(/专题$/, '')
    .replace(/AI/g, '')
    .replace(/成人/g, '')
    .replace(/短剧|漫剧/g, '');
  if (!t) t = String(title || '').replace(/AI/g, '');
  return t.slice(0, 10);
}

// 吃瓜帖 /archives/{pid}/ 的正文里常带一句「作品名称：《xxx》」（链接指向 /video/{id}），
// 用它把吃瓜帖映射到正片；纯图文的帖子没有这个链接，返回空字符串。
function archivesVideoId(pid) {
  const d = getSiteJson('/api/posts/' + encodeURIComponent(pid));
  if (!d || !d.data) return '';
  const txt = String(d.data.content || '');
  const m = txt.match(/\/video\/(\d+)\//);
  return m ? String(m[1]) : '';
}

function listPage(tid, page, sort) {
  const p = Math.max(1, parseInt(page || '1', 10) || 1);
  const size = 50;
  let d = null;
  let list = [];
  let pages = p;
  let total = 0;

  if (String(tid).indexOf('topic:') === 0) {
    const slug = String(tid).slice(6);
    d = getSiteJson('/api/topics/' + encodeURIComponent(slug) + '?page=' + p + '&size=' + size);
    const v = d && d.data && d.data.videos ? d.data.videos : null;
    list = v && Array.isArray(v.items) ? v.items.map(toSiteVod) : [];
    const pg = v && v.pagination ? v.pagination : null;
    pages = pg && pg.pages ? Number(pg.pages) : (list.length ? p + 1 : p);
    total = pg && pg.total ? Number(pg.total) : (pages * list.length);
  } else if (String(tid) === 'recommend') {
    d = getJson('/api/all');
    const sec = d && d.sections && d.sections.recommend ? d.sections.recommend : null;
    list = sec && Array.isArray(sec.list) ? sec.list.map(toVod) : [];
    pages = p;
    total = list.length;
  } else if (String(tid).indexOf('chigua') === 0) {
    const cate = String(tid).split(':')[1] || 'all';
    d = getJson('/api/chigua?cate=' + encodeURIComponent(cate) + '&page=' + p + '&size=' + size);
    list = d && Array.isArray(d.list) ? d.list.map(toVod) : [];
    pages = d && d.pagecount ? Number(d.pagecount) : (list.length ? p + 1 : p);
    total = d && d.total ? Number(d.total) : (pages * list.length);
  } else if (String(tid).indexOf('rank:') === 0) {
    const kind = String(tid).slice(5) || 'hot';
    d = getJson('/api/ranks/' + kind + '?page=' + p + '&size=' + size);
    list = d && Array.isArray(d.list) ? d.list.map(toVod) : [];
    pages = d && d.pagecount ? Number(d.pagecount) : (list.length ? p + 1 : p);
    total = d && d.total ? Number(d.total) : (pages * list.length);
  } else if (String(tid) === 'topics') {
    d = getJson('/api/topics');
    list = d && Array.isArray(d.list) ? d.list.map(toVod) : [];
    pages = p;
    total = list.length;
  } else {
    d = getJson('/api/category/' + encodeURIComponent(tid) + '?page=' + p + '&size=' + size + '&sort=' + (sort || 'latest'));
    list = d && Array.isArray(d.list) ? d.list.map(toVod) : [];
    pages = d && d.pagecount ? Number(d.pagecount) : (list.length ? p + 1 : p);
    total = d && d.total ? Number(d.total) : (pages * list.length);
  }

  return { list: list, page: p, pagecount: pages, total: total, limit: list.length };
}

export default {
  init(cfg) {
    this.cfg = cfg || {};
    if (this.cfg.api && /^https?:\/\//i.test(String(this.cfg.api))) BASE = String(this.cfg.api);
  },

  home(filter) {
    const cls = CLASSES.slice();
    // 专辑专题的 slug 是动态的，加载源时向站点取一次，失败就静默跳过（不影响其它分类）
    try {
      const t = getSiteJson('/api/topics');
      const items = t && t.data && Array.isArray(t.data.items) ? t.data.items : [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (!it || !it.slug) continue;
        cls.push({ type_id: 'topic:' + it.slug, type_name: '专题·' + topicShort(it.title) });
      }
    } catch (e) {}
    return JSON.stringify({ class: cls, filters: FILTERS });
  },

  homeVod() {
    const d = getJson('/api/all');
    const sec = d && d.sections && d.sections.recommend ? d.sections.recommend : null;
    let list = sec && Array.isArray(sec.list) ? sec.list : [];
    if (!list.length) {
      const f = getJson('/api/category/ai-duanju?page=1&size=50&sort=latest');
      list = f && Array.isArray(f.list) ? f.list : [];
    }
    return JSON.stringify({ list: list.map(toVod) });
  },

  category(tid, pg, filter, extend) {
    let sort = 'latest';
    try { if (extend && extend.sort) sort = String(extend.sort); } catch (e) {}
    const d = listPage(String(tid || 'ai-duanju'), pg, sort);
    return JSON.stringify({
      list: d.list,
      page: d.page,
      pagecount: d.pagecount,
      limit: d.limit,
      total: d.total
    });
  },

  search(wd, quick, pg) {
    const key = String(wd || '').trim();
    const page = Math.max(1, parseInt(pg || '1', 10) || 1);
    if (!key) return JSON.stringify({ list: [], page: page, pagecount: page });
    // Worker 的 /api/search/{wd} 目前走 HTML 兜底、经常返回空，
    // 空就退回站点自己的向量搜索接口 /api/search?q=
    const d = getJson('/api/search/' + encodeURIComponent(key) + '?page=' + page + '&size=50');
    let list = d && Array.isArray(d.list) ? d.list.map(toVod) : [];
    let pages = list.length ? page + 1 : page;
    let total = list.length ? (page + 1) * list.length : 0;
    if (!list.length) {
      const s = getSiteJson('/api/search?q=' + encodeURIComponent(key) + '&page=' + page + '&size=50');
      const items = s && s.data && Array.isArray(s.data.items) ? s.data.items : [];
      const pg2 = s && s.data && s.data.pagination ? s.data.pagination : null;
      list = items.map(toSiteVod);
      pages = pg2 && pg2.pages ? Number(pg2.pages) : (list.length ? page + 1 : page);
      total = pg2 && pg2.total ? Number(pg2.total) : (pages * list.length);
    }
    return JSON.stringify({
      list: list,
      page: page,
      pagecount: pages,
      limit: list.length,
      total: total
    });
  },

  detail(id) {
    id = String(id || '').trim();
    if (!id) return JSON.stringify({ list: [] });
    const d = getJson('/api/detail/' + encodeURIComponent(id));
    const x = d && Array.isArray(d.list) && d.list.length ? d.list[0] : null;
    if (!x) return JSON.stringify({ list: [] });
    let eps = Array.isArray(x.episodes) ? x.episodes : [];
    // 吃瓜帖：Worker 的 detail 只在页面里能抓到 m3u8 时才给 episodes，
    // 抓不到时退回「正文里的 /video/{id}」，桥接到正片接口
    if (!eps.length && String(x.vod_id || '').indexOf('archives_') === 0) {
      const vid = archivesVideoId(String(x.vod_id).replace('archives_', ''));
      if (vid) eps = [{ ep: '1', url: '', title: '第1集' }];
    }
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
      if (uu) {
        const out = { parse: 0, url: uu, header: { 'User-Agent': UA, 'Referer': SITE + '/' } };
        if (/\.m3u8/i.test(uu)) out.format = 'application/vnd.apple.mpegurl';
        return JSON.stringify(out);
      }
      // 回退：吃瓜帖正文里的 /video/{id} 就是正片，走普通播放接口
      const target = archivesVideoId(vid.replace('archives_', ''));
      if (!target) return JSON.stringify({ parse: 0, url: '' });
      const pd = getJson('/api/play?url=' + encodeURIComponent(target) + '&ep=' + encodeURIComponent(ep));
      if (!pd || !pd.url) return JSON.stringify({ parse: 0, url: '' });
      return JSON.stringify({
        parse: 0,
        url: String(pd.url),
        header: { 'User-Agent': UA, 'Referer': SITE + '/' },
        format: 'application/vnd.apple.mpegurl'
      });
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

// huangguo_web_spider.js
// 黄果短剧 · 接口版 Spider（FongMi / 影视TV QuickJS）
// v11：适配源站 2026-11 大改版。
//   - 弃用 Cloudflare Worker，直连源站（Worker 已加 sig 签名校验，旧脚本 403）
//   - 旧路径 /api/all、/api/category/{tid}、/api/chigua 全部 404，换成新路径
//   - 新返回结构 {data:{items,pagination},status:1}，不再是 {list,pagecount,total}
//   - 封面已是完整签名 URL（pic.drleao.cn），不再走 Worker /media 中转
//   - 播放地址改为 POST /api/videos/{id}/episodes/{ep}/playback，body 为空 JSON
//   - m3u8 从 data.streams.main 取，CDN 需要带 x-cdn-auth / x-cdn-app header
// 接口均无需登录、无需 Cookie（未登录已实测可拿完整 m3u8）。

const SITE = 'https://huangguoai.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

let BASE = SITE;

// 分类顺序对应网页端导航
const CLASSES = [
  { type_id: 'ai-duanju',   type_name: '短剧' },
  { type_id: 'ai-manju',    type_name: '漫剧' },
  { type_id: 'ai-huanlian', type_name: 'AI换脸' },
  { type_id: 'ai-mogai',    type_name: 'AI魔改' },
  { type_id: 'chigua',          type_name: '吃瓜·推荐' },
  { type_id: 'rank:hot',       type_name: '热播榜' },
  { type_id: 'rank:recommend', type_name: '推荐榜' },
  { type_id: 'rank:potential',  type_name: '潜力榜' }
];

const SORTS = [
  { n: '最新更新', v: 'new' },
  { n: '当前热播', v: 'popular' },
  { n: '正在播放', v: 'watchings' },
  { n: '小蓝原创', v: 'xiaolan' }
];

const SORT_FILTER = [{ key: 'sort', name: '排序', value: SORTS.map(function (s) { return { n: s.n, v: s.v }; }) }];
const FILTERS = {
  'ai-duanju': SORT_FILTER,
  'ai-manju': SORT_FILTER,
  'ai-huanlian': SORT_FILTER,
  'ai-mogai': SORT_FILTER
};

function reqJson(url, method, body) {
  try {
    const opts = {
      method: method || 'get',
      headers: { 'User-Agent': UA, 'Referer': SITE + '/' },
      timeout: 15000
    };
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = (typeof body === 'string') ? body : JSON.stringify(body);
      opts.data = opts.body;
    }
    const r = req(url, opts);
    if (!r || Number(r.code) !== 200 || !r.content) return null;
    return JSON.parse(String(r.content));
  } catch (e) {
    return null;
  }
}

function getJson(path) {
  return reqJson(BASE + path, 'get');
}

function postJson(path, body) {
  return reqJson(BASE + path, 'post', body || {});
}

// 新接口 cover 是完整签名 URL（pic.drleao.cn），但 Content-Type 是 binary/octet-stream，
// FongMi 不识别，通过图片代理中转强制返回 image/jpeg
function picOf(u) {
  u = String(u || '');
  if (!u) return '';
  // 用 images.weserv.nl 公共图片代理，自动识别图片类型
  if (/^https?:\/\//i.test(u)) return 'https://images.weserv.nl/?url=' + encodeURIComponent(u);
  return u;
}

function toVod(x) {
  if (!x) return null;
  const tags = Array.isArray(x.tags) ? x.tags.join(' / ') : String(x.cate_name || '');
  const eps = Number(x.episode_count || x.total_episodes || 0);
  let remark = '';
  if (eps) remark = eps + '集';
  if (Number(x.score) > 0) remark = remark ? (remark + ' · ' + x.score + '分') : (x.score + '分');
  if (x.is_finished === 1 || x.is_finished === true) remark = remark ? (remark + ' · 完结') : '完结';
  const author = x.author && x.author.name ? x.author.name : '';
  // 榜单接口用 video_id 字段，其他用 id
  const vid = String(x.id || x.video_id || '');
  return {
    vod_id: vid,
    vod_name: String(x.title || ''),
    vod_pic: picOf(x.cover),
    vod_remarks: remark,
    vod_year: String(x.created_at || '').slice(0, 4),
    vod_score: String(x.score || ''),
    vod_content: String(x.description || ''),
    vod_actor: String(author),
    type_name: tags
  };
}

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

// 从 {data:{items,pagination}} 响应里取列表和分页
function unwrap(d) {
  const items = (d && d.data && Array.isArray(d.data.items)) ? d.data.items : [];
  const pg = (d && d.data && d.data.pagination) ? d.data.pagination : null;
  return { items: items, pg: pg };
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
    d = getJson('/api/topics/' + encodeURIComponent(slug) + '?page=' + p + '&size=' + size);
    // 专题详情返回 data.videos.items（不是 data.items）
    const v = d && d.data && d.data.videos ? d.data.videos : null;
    const items = v && Array.isArray(v.items) ? v.items : [];
    list = items.map(toVod).filter(function (x) { return !!x; });
    const pg = v && v.pagination ? v.pagination : null;
    pages = pg && pg.pages ? Number(pg.pages) : (list.length ? p + 1 : p);
    total = pg && pg.total ? Number(pg.total) : (pages * list.length);
  } else if (String(tid) === 'chigua') {
    d = getJson('/api/feed/recommend?page=' + p + '&size=' + size);
    const w = unwrap(d);
    list = w.items.map(toVod).filter(function (x) { return !!x; });
    pages = w.pg && w.pg.pages ? Number(w.pg.pages) : (list.length ? p + 1 : p);
    total = w.pg && w.pg.total ? Number(w.pg.total) : (pages * list.length);
  } else if (String(tid).indexOf('rank:') === 0) {
    const kind = String(tid).slice(5) || 'hot';
    d = getJson('/api/ranks/' + encodeURIComponent(kind) + '?page=' + p + '&size=' + size);
    const w = unwrap(d);
    list = w.items.map(toVod).filter(function (x) { return !!x; });
    pages = w.pg && w.pg.pages ? Number(w.pg.pages) : (list.length ? p + 1 : p);
    total = w.pg && w.pg.total ? Number(w.pg.total) : (pages * list.length);
  } else {
    // 视频分类：/api/videos/category/{route}?page=&size=&sort=
    d = getJson('/api/videos/category/' + encodeURIComponent(tid) + '?page=' + p + '&size=' + size + '&sort=' + (sort || 'new'));
    const w = unwrap(d);
    list = w.items.map(toVod).filter(function (x) { return !!x; });
    pages = w.pg && w.pg.pages ? Number(w.pg.pages) : (list.length ? p + 1 : p);
    total = w.pg && w.pg.total ? Number(w.pg.total) : (pages * list.length);
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
    // 动态加载专题（slug 是动态的，加载一次，失败静默跳过）
    try {
      const t = getJson('/api/topics');
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
    const d = getJson('/api/home');
    let arr = [];
    // home 返回 data.latest 直接是数组（不是 {items:[]}）
    if (d && d.data && Array.isArray(d.data.latest)) arr = d.data.latest;
    if (!arr.length && d && d.data && Array.isArray(d.data.featured)) arr = d.data.featured;
    if (!arr.length) {
      // 兜底：取短剧分类第一页
      const f = getJson('/api/videos/category/ai-duanju?page=1&size=50&sort=new');
      if (f && f.data && Array.isArray(f.data.items)) arr = f.data.items;
    }
    return JSON.stringify({ list: arr.map(toVod).filter(function (x) { return !!x; }) });
  },

  category(tid, pg, filter, extend) {
    let sort = 'new';
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
    const d = getJson('/api/search?q=' + encodeURIComponent(key) + '&page=' + page + '&size=50');
    const items = (d && d.data && Array.isArray(d.data.items)) ? d.data.items : [];
    const pg2 = d && d.data && d.data.pagination ? d.data.pagination : null;
    const list = items.map(toVod).filter(function (x) { return !!x; });
    const pages = pg2 && pg2.pages ? Number(pg2.pages) : (list.length ? page + 1 : page);
    const total = pg2 && pg2.total ? Number(pg2.total) : (pages * list.length);
    return JSON.stringify({ list: list, page: page, pagecount: pages, limit: list.length, total: total });
  },

  detail(id) {
    id = String(id || '').trim();
    if (!id) return JSON.stringify({ list: [] });
    const d = getJson('/api/videos/' + encodeURIComponent(id));
    const x = d && d.data ? d.data : null;
    if (!x) return JSON.stringify({ list: [] });
    const vod = toVod(x);
    // 分集
    const eps = Array.isArray(x.episodes) ? x.episodes : [];
    const playUrl = eps.map(function (e) {
      const n = String(e.ep_num || '1');
      const t = String(e.title || '') || ('第' + n + '集');
      return t + '$' + id + '|||' + n;
    }).join('#');
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

    // POST /api/videos/{id}/episodes/{ep}/playback，body 为空 JSON
    const d = postJson('/api/videos/' + encodeURIComponent(vid) + '/episodes/' + encodeURIComponent(ep), {});
    if (!d || !d.data) return JSON.stringify({ parse: 0, url: '' });
    const streams = d.data.streams || {};
    const url = String(streams.main || streams.hevc || streams.preview || '');
    if (!url) return JSON.stringify({ parse: 0, url: '' });

    // CDN 需要带认证 header
    const cdn = d.data.cdn || {};
    const header = { 'User-Agent': UA, 'Referer': SITE + '/' };
    if (cdn.authKey && cdn.authValue) header[cdn.authKey] = cdn.authValue;
    if (cdn.app) header['x-cdn-app'] = cdn.app;

    return JSON.stringify({
      parse: 0,
      url: url,
      header: header,
      format: 'application/vnd.apple.mpegurl'
    });
  }
};

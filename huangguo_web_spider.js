// huangguo_web_spider.js
// 黄果短剧 · 接口版 Spider（FongMi / 影视TV QuickJS）
// 与 huangguo-fongmi 的旧脚本相比：不抓页面 HTML、不依赖 assets 内置 crypto-js，
// 列表/详情/播放全部走站点的 JSON 接口，源站前端改版不会影响列表与解析。
// 接口来源见 DRDRDRRDDRDR/huangguo-web 的 README 与 worker 源码。
// v3 新增「黄果吃瓜」板块：/api/chigua?cate=all|remen|yuanchuang，
// 条目 id 形如 archives_123，直链不在 /api/play 里，改从 /api/detail 取。
// v4 补齐网页端剩余入口：精选推荐（/api/all）、分类排序（含独家原创 sort=original）、
// 专辑专题（站点 /api/topics 与 /api/topics/{slug} 的 JSON）。
// v5 修吃瓜播放：图文帖的直链在 /api/posts/{pid} 的 video_url（已签名 m3u8），
// 原先只找 /api/detail 的 episodes 才取不到。
// v5 同时去掉「精选推荐」分类：它的内容与首页推荐位同源（都是 /api/all 的 sections.recommend），
// 客户端里会和「推荐」重复，首页推荐位仍保留。
// v10.1（在 v10 上修）：
//   - Worker 2026-11-13 加了反爬：必须带 Origin/Referer + X-HG-Ts/X-HG-Sig（HMAC-SHA256，
//     5 分钟窗口），否则 403，列表/详情/播放全空。这里内置纯 JS SHA-256/HMAC 自己签名。
//   - 吃瓜板块：Worker 的 /api/chigua 已失效（pagecount 有值但 list 恒空），改读源站 /api/posts。
//   - 封面：Worker /api/all 返回的是 /media?url=... 相对路径，picOf 补全成 Worker 绝对地址（无需签名）。

const API = 'https://huangguo-parser.13681235735.workers.dev'; // 可换成你自建的 Worker
const SITE = 'https://huangguoai.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

let BASE = API;

// ===== Worker 反爬签名（纯 JS，不依赖运行时 crypto 模块）=====
// 2026-11-13 起 Worker 要求：Origin/Referer 必须是站点来源，且带
// X-HG-Ts（5 分钟窗口起始 epoch 秒）与 X-HG-Sig = HMAC-SHA256(secret, win + "\n" + "/api" + path)。
// 缺任一项返回 403（reason: ua / sig:missing），列表、详情、播放全部拿不到数据。
const HG_SECRET = 'hg-dx150-2026-11-w7Qm4pLz';
const HG_ORIGIN = 'https://drdrdrrddrdr.github.io';
const HG_REFERER = 'https://drdrdrrddrdr.github.io/huangguo-web/';

var HG_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];

function hgRotr(x, n) { return (x >>> n) | (x << (32 - n)); }

function hgUtf8Bytes(s) {
  const out = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xC0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0xD800 || c >= 0xE000) out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else {
      i++;
      const c2 = s.charCodeAt(i);
      const cp = 0x10000 + ((c & 0x3FF) << 10) + (c2 & 0x3FF);
      out.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    }
  }
  return out;
}

function hgSha256(bytes) {
  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const msg = bytes.slice(0);
  const len = bytes.length;
  const bitLo = (len * 8) >>> 0;
  const bitHi = Math.floor(len / 536870912) >>> 0;
  msg.push(0x80);
  while (msg.length % 64 !== 56) msg.push(0);
  msg.push((bitHi >>> 24) & 255, (bitHi >>> 16) & 255, (bitHi >>> 8) & 255, bitHi & 255);
  msg.push((bitLo >>> 24) & 255, (bitLo >>> 16) & 255, (bitLo >>> 8) & 255, bitLo & 255);

  const W = new Array(64);
  for (let off = 0; off < msg.length; off += 64) {
    for (let i = 0; i < 16; i++) {
      W[i] = ((msg[off + i * 4] << 24) | (msg[off + i * 4 + 1] << 16) | (msg[off + i * 4 + 2] << 8) | msg[off + i * 4 + 3]) | 0;
    }
    for (let i = 16; i < 64; i++) {
      const s0 = hgRotr(W[i - 15], 7) ^ hgRotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = hgRotr(W[i - 2], 17) ^ hgRotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
    }
    let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (let i = 0; i < 64; i++) {
      const S1 = hgRotr(e, 6) ^ hgRotr(e, 11) ^ hgRotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + HG_K[i] + W[i]) | 0;
      const S0 = hgRotr(a, 2) ^ hgRotr(a, 13) ^ hgRotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }

  const out = [];
  for (let i = 0; i < 8; i++) out.push((H[i] >>> 24) & 255, (H[i] >>> 16) & 255, (H[i] >>> 8) & 255, H[i] & 255);
  return out;
}

function hgHmacHex(keyStr, msgStr) {
  let key = hgUtf8Bytes(keyStr);
  if (key.length > 64) key = hgSha256(key);
  while (key.length < 64) key.push(0);
  const ipad = [], opad = [];
  for (let i = 0; i < 64; i++) { ipad.push(key[i] ^ 0x36); opad.push(key[i] ^ 0x5c); }
  const inner = hgSha256(ipad.concat(hgUtf8Bytes(msgStr)));
  const outer = hgSha256(opad.concat(inner));
  let hex = '';
  for (let i = 0; i < outer.length; i++) {
    const t = outer[i].toString(16);
    hex += t.length === 1 ? '0' + t : t;
  }
  return hex;
}


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
  const u = String(url || '');
  const signed = u.indexOf(BASE) === 0;
  const pathWithQuery = signed ? u.slice(BASE.length) : '';
  // 手机时钟可能偏几分钟，403 时换相邻时间窗重试；再对丢连接重试一次
  const shifts = signed ? [0, -1, 1] : [0, 0];
  for (let i = 0; i < shifts.length; i++) {
    const headers = { 'User-Agent': UA, 'Accept': 'application/json, text/plain, */*', 'Referer': SITE + '/' };
    if (signed) {
      const win = Math.floor(Date.now() / 1000 / 300) + shifts[i];
      headers['Origin'] = HG_ORIGIN;
      headers['Referer'] = HG_REFERER;
      headers['X-HG-Ts'] = String(win * 300);
      headers['X-HG-Sig'] = hgHmacHex(HG_SECRET, win + '\n' + pathWithQuery);
    }
    try {
      const r = req(u, { method: 'get', headers: headers, timeout: 15000 });
      if (!r || !r.content) continue;
      const code = Number(r.code);
      if (code === 200) {
        try {
          return JSON.parse(String(r.content));
        } catch (e) {
          return null;
        }
      }
      if (!signed || (code !== 403 && code !== 401)) return null;
    } catch (e) {}
  }
  return null;
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

// 源站 /api/posts 的吃瓜帖 → FongMi vod（id 是数字，前面补 archives_ 以复用吃瓜播放分支）
function toPostVod(x) {
  return {
    vod_id: 'archives_' + String(x.id || ''),
    vod_name: String(x.title || ''),
    vod_pic: picOf(x.cover || ''),
    vod_remarks: String(x.created_at || ''),
    vod_year: '',
    vod_score: '',
    vod_content: String(x.desc || ''),
    vod_actor: '',
    type_name: '吃瓜'
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

// 吃瓜帖正文接口 /api/posts/{pid} 里带 video_url（已签名的 m3u8，自带 auth_key，可直接播），
// 这是图文帖唯一能拿到的正片地址；没有 video_url 时再从正文里找 .m3u8 链接。
function archivesVideoUrl(pid) {
  const d = getSiteJson('/api/posts/' + encodeURIComponent(pid));
  if (!d || !d.data) return '';
  const u = String(d.data.video_url || '');
  if (/^https?:/i.test(u)) return u;
  const c = String(d.data.content || '');
  const m = c.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i);
  return m ? m[0].replace(/&amp;/g, '&') : '';
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
    if (!list.length) {
      // Worker 的吃瓜抓取已失效，回退源站 /api/posts（id 补 archives_ 以复用吃瓜播放分支）
      const s = getSiteJson('/api/posts?cate=' + encodeURIComponent(cate) + '&page=' + p + '&size=' + size);
      const items = s && s.data && Array.isArray(s.data.items) ? s.data.items : [];
      list = items.map(toPostVod);
      const pg2 = s && s.data && s.data.pagination ? s.data.pagination : null;
      pages = pg2 && pg2.pages ? Number(pg2.pages) : (list.length ? p + 1 : p);
      total = pg2 && pg2.total ? Number(pg2.total) : (list.length ? pages * list.length : 0);
    }
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
    let x = d && Array.isArray(d.list) && d.list.length ? d.list[0] : null;
    if (!x && id.indexOf('archives_') === 0) {
      const s = getSiteJson('/api/posts/' + encodeURIComponent(id.replace('archives_', '')));
      const pd = s && s.data ? s.data : null;
      if (pd && (pd.title || pd.content)) {
        x = {
          vod_id: id,
          vod_name: String(pd.title || ''),
          vod_pic: pd.cover || '',
          vod_remarks: String(pd.created_at || ''),
          vod_content: String(pd.content || ''),
          episodes: []
        };
      }
    }
    if (!x) return JSON.stringify({ list: [] });
    let eps = Array.isArray(x.episodes) ? x.episodes : [];
    // 吃瓜帖：Worker 的 detail 只在页面里能抓到 m3u8 时才给 episodes，
    // 抓不到时退回「正文里的 /video/{id}」，桥接到正片接口
    if (!eps.length && String(x.vod_id || '').indexOf('archives_') === 0) {
      const pid = String(x.vod_id).replace('archives_', '');
      if (archivesVideoUrl(pid) || archivesVideoId(pid)) eps = [{ ep: '1', url: '', title: '第1集' }];
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
      // 回退一：帖子接口里的 video_url（已签名的 m3u8），图文帖基本都有
      const own = archivesVideoUrl(vid.replace('archives_', ''));
      if (own) {
        return JSON.stringify({
          parse: 0,
          url: own,
          header: { 'User-Agent': UA, 'Referer': SITE + '/' },
          format: 'application/vnd.apple.mpegurl'
        });
      }
      // 回退二：吃瓜帖正文里的 /video/{id} 就是正片，走普通播放接口
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

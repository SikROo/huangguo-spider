# 黄果短剧 接口版源（FongMi / 影视TV）

给 FongMi 用的单站点源脚本，全部走站点 JSON 接口（列表/详情/播放），不解析网页，源站前端改版不影响。

配置里除黄果本站外，还挂了 11 个 🔞 线路站（`type: 1` 的 JSON 接口站，来自 `uzVideo/video_sources_sese.json`），和黄果脚本互不影响：黄果仍是第一个站点（默认打开），🔞 站点按 `sese_*` 独立 key 追加在后面，可在「站点」里切换，或在详情页/播放页用「换源」跨站找片。

分类顺序对齐网页端导航：AI短剧 / AI漫剧 / 换脸专区 / 魔改专区（这四个带排序筛选）→ 吃瓜·全部 / 吃瓜·热门 / 吃瓜·AI原创 → 热播榜 / 推荐榜 / 潜力榜 → 加载源时自动追加的「专题·XX」（目前 9 个专辑专题）。

## 客户端用法

配置地址（锁定 v10.4）：

```
https://cdn.jsdelivr.net/gh/SikROo/huangguo-spider@v10.4/huangguo_web_spider_config.json
```

v10.4：源站把「换脸专区 / 魔改专区」下线了（HTTP 410），分类里已去掉这两项；另 Worker 从 2026-11-13 起要求 Origin/Referer + HMAC 签名，旧版会被 403 挡掉，导致分类下全空；另外吃瓜板块改读源站 /api/posts，封面走 Worker /media。

**站点名带 ⭐ = 不挂 VPN 也能直连**（实测直连返回正常 JSON）；不带 ⭐ = 需要挂 VPN 才连得上。黄果本站走 Cloudflare Worker，国内直连不通，所以没有 ⭐。

前提：安卓 + FongMi + 已启用 QuickJS 模组（设置 → 模组）。

切换源：首页/设置里改「站点」可切到任意 🔞 线路站；看片时在详情页点「换源」或播放页点「线路 / 换源」跨站搜索同名影片。

## 合集版（黄果 + OmniBox 资源库）

`all_sources_config.json` 把黄果本站、JP98 资源、11 个 🔞 线路站，以及 `tianxiaxiao/omnibox-` 里的普通源 / 成人源按接口去重后合成一份，共 71 个站点（重复的只留一次；`http` 和 `https` 同一条接口的也合并成 `https` 那条）。一条地址就能在同一个列表里换源找片：

```
https://cdn.jsdelivr.net/gh/SikROo/huangguo-spider@v10.4/all_sources_config.json
```

`omnibox_sources_config.json` 是只含 OmniBox 那 68 个源的独立版（不含黄果、不含 sese_*），不想混在一起时用。

说明：那批源在 OmniBox 仓库里是 `require("omnibox_sdk")` 的 js 写法，FongMi 的 QuickJS 没有这个模块、跑不了，所以这里取的是每个 js 里写死的采集接口 `SITE_API`，直接按 `type: 1` 用；`omnibox_链接.md` 里有原始的 js 直链（给 OmniBox 客户端用）。

v8 起：所有 `type: 1` 源都逐个实测过（`?ac=videolist&pg=1` 必须返回 JSON），返回 502 / 403 / 反爬 JS 页 / HTML 首页的 12 个源已删除，删掉的清单见 README 末尾。

v9 起：再加一条「直连 / 走代理」双测。同一个接口分别在**不走代理**和**走 `127.0.0.1:7897`** 两种情况下请求，只有直连就返回正常 JSON 的才在站点名后加 ⭐；直连超时 / 连接重置 / 返回被污染的 HTML、但走代理正常的，就是需要 VPN 的，不打星。目前 71 个站点里 44 个带 ⭐。

v10 起：合集第二个站点是 JP98 资源（`https://jp98.vip/api.php/provide/vod/`，国产自拍 / 主播 / 欧美 / 日本无码 / AI短剧，约 3250 条），直连可用、带 ⭐。黄果本站的显示名从「黄果影院（接口版）」改成「黄果短剧」，`key` 仍是 `huangguo_web`，不影响脚本。

## 文件

- `huangguo_web_spider.js` — 爬虫脚本，入口常量 `API` 在第 15 行、站点常量 `SITE` 在第 16 行
- `huangguo_web_spider_config.json` — 站点配置：第一个是黄果本站（`type: 3`，`api` 指向本仓库某个 tag 的脚本），后面 11 个是 🔞 `type: 1` JSON 接口站，可以整段删掉，不影响黄果
- 🔞 站点清单（`sese_*`）：淫水机 / 番号 / 155 / 鸡坤 / 黄AV / 香奶儿 / 美少女 / 白嫖 / 乐播 / 滴滴 / 精品（老鸭 v8 已删：源站 502）。原始列表里同一站的 `/provide/vod/` 与 `/at/json` 两条内容重复，这里只留一条，避免站点列表里出现两个一模一样的名字
- `all_sources_config.json` — 合集版：黄果 + JP98 + 11 个 sese + 68 个 OmniBox 源（去重后 71 个站点），`key` 用 `sese_*` / `ob` 系列，与黄果的 `huangguo_web` 分开
- `omnibox_sources_config.json` — 只含 OmniBox 那 68 个源的独立版
- `omnibox_链接.md` — 上游 `tianxiaxiao/omnibox-` 里 79 个源的原始 js 直链（OmniBox SDK 格式，FongMi 不适用；其中 11 个已失效）

## 首页推荐位

- 网页端 `/api/category/recommend` 是坏的（返回 `total=0`），推荐内容只在 `/api/all` 的 `sections.recommend` 里
- 首页推荐位（客户端打开站点时的第一屏）走 `/api/all` 的 `sections.recommend`，一次 12 条
- 不再单独做「精选推荐」分类：它和首页推荐位同源，客户端里内容会重复（v5 已删）

## 排序筛选（含独家原创）

- 四个剧集分类挂了「排序」筛选：最新更新 `latest` / 当前热播 `hot` / 独家原创 `original` / 随机推荐 `random`
- 对应接口参数 `/api/category/{tid}?page&size&sort=`，`sort=original` 就是网页端的「独家原创」
- 配置里 `filterable` 必须为 `1`，否则 FongMi 不显示筛选按钮

## 专辑专题

- 专题清单是动态的：加载源时向站点 `/api/topics` 取一次，把每个专辑变成独立分类「专题·短名」
- 专辑内的视频走站点 `/api/topics/{slug}?page&size`，用返回的 `videos.pagination` 翻页
- 不走 Worker 的 `/api/topics?slug=`，那条路是解析网页 HTML 的，页面结构一改就失效（现在就是失效状态）
- 站点 `/api/topics` 取不到时静默跳过，不影响其它分类

## 吃瓜板块

- 列表接口 `/api/chigua?cate=all|remen|yuanchuang`，对应三个分类
- 条目 id 形如 `archives_xxx`，直链不在 `/api/play` 里
- 播放顺序：先试 `/api/detail` 的 `episodes[0].url` → 再读站点 `/api/posts/{pid}` 的 `video_url`（已签名的 m3u8，自带 `auth_key`，可直接播；去掉 query 会 403）→ 最后才退回正文里的 `/video/{id}` 再走 `/api/play`
- 纯图文帖既没有 `video_url` 也没有 `/video/` 链接，播放仍会为空，这是帖子本身没有视频

## 搜索

- 先走 Worker 的 `/api/search/{wd}`，它现在常返回空
- 空就退回站点自己的向量搜索 `/api/search?q=`（参数只认 `q`，`wd/keyword/...` 都无效）

## 来源与致谢

本脚本的接口路径照着下面两个仓库的实现改写，没有它们就没有这份源：

- **网页版前端**：[@DRDRDRRDDRDR/huangguo-web](https://github.com/DRDRDRRDDRDR/huangguo-web) —— 站点接口地址、跨域代理与解析 Worker 均出自这里
- **原始 QuickJS 源**：[@jinshengchan/huangguo-fongmi](https://github.com/jinshengchan/huangguo-fongmi) —— 早期版本，靠抓网页取播放地址，源站改版后播放会失败

站点内容版权归源站所有，本仓库只提供访问方式，请自行判断使用边界，不要传播内容。

## 发新版本（改完脚本后照这个顺序做）

1. 改脚本，提交到 `main`
2. 把配置里的 `api` 改成新版本号，例如 `@v6`，提交到 `main`
3. Releases → Draft a new release → 新 tag 填 `v6` → Publish
4. 客户端配置地址改成 `...@v6/huangguo_web_spider_config.json`

## 注意

- 每次都换新 tag 名，不要删掉重发同名 tag：jsdelivr 对 tag 内容近乎永久缓存，同名复用会一直拿到旧内容
- 不要用 `@main` 当长期地址：分支缓存约 12 小时，改完不能立刻生效
- 仓库必须保持 Public，jsdelivr 只服务公开仓库
- 仓库里有个误建的 `v3v3` 标签和同名 Release，内容与 `v3` 相同，忽略即可，请只认最新的 `v10`
- 源站与 Worker 域名在部分网络下被污染，不开代理客户端会连不上数据源

## v8 实测删除的源

逐个请求 `{api}?ac=videolist&pg=1`（https 失败再试 http），返回非 JSON 或 4xx/5xx 的一律删掉：

| 源 | 症状 |
|---|---|
| 老鸭资源 | 502 / TLS 握手失败 |
| 细胞采集 | 502 / TLS 握手失败 |
| 卧龙CC | 502 / TLS 握手失败 |
| 茅台资源 | 502 / TLS 握手失败 |
| 豆瓣资源 | 502 / TLS 握手失败 |
| 百万资源 | 返回混淆过的反爬 JS 页面，不是 JSON |
| 魔爪资源 | 返回混淆过的反爬 JS 页面，不是 JSON |
| 卧龙资源 | 返回域名卡片页（域名已停），不是 JSON |
| 卧龙采集 | 返回域名卡片页（域名已停），不是 JSON |
| 旺旺API | 返回站点 HTML 首页，接口路径已失效 |
| 旺旺短剧 | 返回站点 HTML 首页，接口路径已失效 |
| 飘零资源 | 403 Forbidden |

黄果本站走的是自己的 Worker（`/api/all` 实测 200），不在删除范围内；它依赖 QuickJS 模组，测不到的话先看模组有没有开。

## 需要 VPN 的源（27 个，不打 ⭐）

黄果短剧、番号资源、155资源、鸡坤资源、滴滴资源、91麻豆、奥斯卡资源、奶香香、鲨鱼资源、1080JSON、1080资源库、360资源、U酷资源、iKun资源、天涯海角、天涯资源、如意资源、新浪点播、无尽NET、无尽资源COM、极速资源、百度云资源、红牛资源、豪华资源、金鹰资源、非凡线路1、魔都影视。

这 27 个直连会被超时 / 连接重置 / 注入 HTML 打断，挂上代理就正常返回 JSON，说明源站本身是活的，只是国内直连不通。其余 44 个直连即可用，名字后面带 ⭐。

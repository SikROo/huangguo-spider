# 黄果短剧 接口版源（FongMi / 影视TV）

给 FongMi 用的单站点源脚本，全部走站点 JSON 接口（列表/详情/播放），不解析网页，源站前端改版不影响。

分类顺序对齐网页端导航：AI短剧 / AI漫剧 / 换脸专区 / 魔改专区（这四个带排序筛选）→ 吃瓜·全部 / 吃瓜·热门 / 吃瓜·AI原创 → 热播榜 / 推荐榜 / 潜力榜 → 加载源时自动追加的「专题·XX」（目前 9 个专辑专题）。

## 客户端用法

配置地址（锁定 v5）：

```
https://cdn.jsdelivr.net/gh/SikROo/huangguo-spider@v5/huangguo_web_spider_config.json
```

前提：安卓 + FongMi + 已启用 QuickJS 模组（设置 → 模组）。

## 文件

- `huangguo_web_spider.js` — 爬虫脚本，入口常量 `API` 在第 15 行、站点常量 `SITE` 在第 16 行
- `huangguo_web_spider_config.json` — 单站点配置，`api` 指向本仓库某个 tag 的脚本

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
- 仓库里有个误建的 `v3v3` 标签和同名 Release，内容与 `v3` 相同，忽略即可，请只认 `v5`
- 源站与 Worker 域名在部分网络下被污染，不开代理客户端会连不上数据源

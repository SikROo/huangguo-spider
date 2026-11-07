# 黄果短剧 接口版源（FongMi / 影视TV）

给 FongMi 用的单站点源脚本，全部走站点 JSON 接口（列表/详情/播放），不解析网页，源站前端改版不影响。

分类：AI短剧 / AI漫剧 / 换脸专区 / 魔改专区 / 吃瓜·全部 / 吃瓜·热门 / 吃瓜·AI原创 / 热播榜 / 推荐榜 / 潜力榜。

## 客户端用法

配置地址（锁定 v3）：

```
https://cdn.jsdelivr.net/gh/SikROo/huangguo-spider@v3/huangguo_web_spider_config.json
```

前提：安卓 + FongMi + 已启用 QuickJS 模组（设置 → 模组）。

## 文件

- `huangguo_web_spider.js` — 爬虫脚本，入口常量 `API` 在第 9 行
- `huangguo_web_spider_config.json` — 单站点配置，`api` 指向本仓库某个 tag 的脚本

## 吃瓜板块

- 列表接口 `/api/chigua?cate=all|remen|yuanchuang`，对应三个分类
- 条目 id 形如 `archives_xxx`，直链不在 `/api/play` 里，改从 `/api/detail` 的 `episodes[0].url` 取
- 若某条吃瓜页面里既没有 video 也没有 m3u8/mp4 链接，会解析不出直链，表现为播放为空

## 来源与致谢

本脚本的接口路径照着下面两个仓库的实现改写，没有它们就没有这份源：

- **网页版前端**：[@DRDRDRRDDRDR/huangguo-web](https://github.com/DRDRDRRDDRDR/huangguo-web) —— 站点接口地址、跨域代理与解析 Worker 均出自这里
- **原始 QuickJS 源**：[@jinshengchan/huangguo-fongmi](https://github.com/jinshengchan/huangguo-fongmi) —— 早期版本，靠抓网页取播放地址，源站改版后播放会失败

站点内容版权归源站所有，本仓库只提供访问方式，请自行判断使用边界，不要传播内容。

## 发新版本（改完脚本后照这个顺序做）

1. 改脚本，提交到 `main`
2. 把配置里的 `api` 改成新版本号，例如 `@v4`，提交到 `main`
3. Releases → Draft a new release → 新 tag 填 `v4` → Publish
4. 客户端配置地址改成 `...@v4/huangguo_web_spider_config.json`

## 注意

- 每次都换新 tag 名，不要删掉重发同名 tag：jsdelivr 对 tag 内容近乎永久缓存，同名复用会一直拿到旧内容
- 不要用 `@main` 当长期地址：分支缓存约 12 小时，改完不能立刻生效
- 仓库必须保持 Public，jsdelivr 只服务公开仓库
- 仓库里有个误建的 `v3v3` 标签和同名 Release，内容与 `v3` 相同，忽略即可，请只认 `v3`

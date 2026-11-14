# 黄果短剧 源（FongMi / 影视TV）

给 FongMi / 影视TV 用的源集合：一个黄果短剧的 QuickJS 爬虫脚本，外加一批 `type: 1` 的 JSON 采集站（黄果吃瓜 / 短剧、JP98、🔞 线路站、OmniBox 系列）。

## 用法

合集（推荐，71 站）：

```
https://cdn.jsdelivr.net/gh/SikROo/huangguo-spider@v11.4/all_sources_config.json
```

| 配置 | 站点数 | 内容 |
|---|---|---|
| `all_sources_config.json` | 71 | 黄果短剧 + JP98 + 11 个 🔞 + 68 个 OmniBox 源 |
| `huangguo_web_spider_config.json` | 12 | 只含黄果短剧 + 11 个 🔞 |
| `omnibox_sources_config.json` | 68 | 只含 OmniBox 那批 |

前提：安卓 + FongMi + 已启用 QuickJS 模组（设置 → 模组）。地址走 jsdelivr 的 tag，不要用 `@main`（分支缓存约 12 小时）。

站点名带 ⭐ = 不挂 VPN 直连可用；不带 ⭐ = 需要挂 VPN。目前 71 站里 44 个带 ⭐。

## 文件

- `huangguo_web_spider.js` — 黄果短剧爬虫（QuickJS，入口常量 `API` / `SITE` 在第 15、16 行）
- `huangguo_web_spider_config.json` / `all_sources_config.json` / `omnibox_sources_config.json` — 三份站点配置
- `omnibox_链接.md` — OmniBox 那 79 个源的原始 js 直链（OmniBox SDK 格式，FongMi 不适用）

## 来源

- 黄果网页端：[@DRDRDRRDDRDR/huangguo-web](https://github.com/DRDRDRRDDRDR/huangguo-web) —— 接口地址、跨域代理与解析 Worker 出自这里
- 黄果原始 QuickJS 源：[@jinshengchan/huangguo-fongmi](https://github.com/jinshengchan/huangguo-fongmi) —— 早期版本，靠抓网页取播放地址
- 采集站集合：[@tianxiaxiao/omnibox-](https://github.com/tianxiaxiao/omnibox-) —— 79 个 `omnibox_sdk` 源，取其写死的 `SITE_API` 转成 `type: 1`

站点内容版权归源站所有，本仓库只提供访问方式，请自行判断使用边界。

## 说明

- 完整旧版说明（含接口细节、排序筛选、吃瓜板块、发版流程、v8 删除清单、需要 VPN 的源清单）保留在 [README.full.md](README.full.md)
- 版本 tag 从 `v1` 到 `v10`，客户端地址请认最新 tag

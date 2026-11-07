# 黄果短剧 接口版源（FongMi / 影视TV）

给 FongMi 用的单站点源脚本，全部走站点 JSON 接口（列表/详情/播放），不解析网页，源站前端改版不影响。

## 客户端用法

配置地址（锁定 v2）：

```
https://cdn.jsdelivr.net/gh/SikROo/huangguo-spider@v2/huangguo_web_spider_config.json
```

前提：安卓 + FongMi + 已启用 QuickJS 模组（设置 → 模组）。

## 文件

- `huangguo_web_spider.js` — 爬虫脚本，入口常量 `API` 在第 6 行
- `huangguo_web_spider_config.json` — 单站点配置，`api` 指向本仓库某个 tag 的脚本

## 发新版本（改完脚本后照这个顺序做）

1. 改脚本，提交到 `main`
2. 把配置里的 `api` 改成新版本号，例如 `@v3`，提交到 `main`
3. Releases → Draft a new release → 新 tag 填 `v3` → Publish
4. 客户端配置地址改成 `...@v3/huangguo_web_spider_config.json`

## 注意

- 每次都换新 tag 名，不要删掉重发同名 tag：jsdelivr 对 tag 内容近乎永久缓存，同名复用会一直拿到旧内容
- 不要用 `@main` 当长期地址：分支缓存约 12 小时，改完不能立刻生效
- 仓库必须保持 Public，jsdelivr 只服务公开仓库

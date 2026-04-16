# 日本房价地图 V1.9 Protomaps Same-Origin Delivery SPEC

> 当前状态真相源最终仍以项目根 `README.md` 为准。本 Spec 只服务于本轮连续修复。

## 1. 目标

把当前 `Protomaps` 底图从“浏览器直接请求外部域名”改成“用户只请求当前站点同域资源”，解决用户打开 `https://vps-jp.tail4b5213.ts.net:8443/` 时地图空白的问题；同时保留当前 `关东范围底图 + 东京数据不扩城`。

## 2. 已确认问题

- `8443` 当前已经是最新 bundle，默认视角也已经落到关东范围，不是“代码没部署”。
- 当前前端仍直接请求：
  - `https://data.source.coop/protomaps/openstreetmap/v4.pmtiles`
  - `https://protomaps.github.io/basemaps-assets/...`
- 这意味着最终能否看见底图，取决于用户本机浏览器是否能直接访问这些外部域名；VPS 本地验收通过，不代表用户入口一定可见。

## 3. 本轮范围

### 必做

- 把 Protomaps PMTiles / sprite / glyphs 改成站点同域 URL。
- 在当前 `4173 -> 8443 / Cloudflare` 预览链路里增加同域代理能力。
- 固定验收改成校验同域 Protomaps 请求，而不是只认外部域名。
- README 回写当前真相：
  - 底图已走同域代理
  - 范围仍是关东底图 + 东京数据

### 本轮不做

- 不重建新的日本或关东 PMTiles 切片文件。
- 不扩东京以外城市数据。
- 不替换当前 `Protomaps white` 主题。

## 4. 验收

- 用户入口 `https://vps-jp.tail4b5213.ts.net:8443/` 默认进入关东范围。
- 浏览器对底图的关键请求只需访问当前站点同域路径即可拿到：
  - PMTiles
  - sprite
  - glyphs
- 地图默认态能稳定看到底图与东京站点层。
- `npm test`
- `npm run lint`
- `npm run build`
- `node ./scripts/tokyo_v1_acceptance.mjs --url 'http://127.0.0.1:4173/' --tailnet-url 'https://vps-jp.tail4b5213.ts.net:8443/'`
- README 收口校验通过，仓库最终干净

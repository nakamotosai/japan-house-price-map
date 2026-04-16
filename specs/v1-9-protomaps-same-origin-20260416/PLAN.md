# 日本房价地图 V1.9 Protomaps Same-Origin Delivery PLAN

## 执行顺序

- [ ] Batch A: 改前端底图 URL 为同域
- [ ] Batch B: 增加本地预览静态代理服务
- [ ] Batch C: 改固定验收与 README
- [ ] Batch D: 跑验证并提交推送

## Batch A

- [ ] 定义同域 PMTiles / sprite / glyphs URL
- [ ] 保持现有 `Protomaps white` 和关东范围不变

## Batch B

- [ ] 新增 `dist` 静态服务 + Protomaps 代理脚本
- [ ] `preview:tailnet` 切到新服务
- [ ] `start_tailnet_preview.sh` 继续维持现有 4173 / 8443 入口

## Batch C

- [ ] 固定验收改成识别同域 Protomaps 请求
- [ ] README 同步“同域代理 + 关东范围 + 东京数据”

## Batch D

- [ ] `npm test`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `node ./scripts/tokyo_v1_acceptance.mjs --url 'http://127.0.0.1:4173/' --tailnet-url 'https://vps-jp.tail4b5213.ts.net:8443/'`
- [ ] `python3 scripts/readme_closeout_guard.py /home/ubuntu/codex/日本房价地图 --expect-clean`
- [ ] commit
- [ ] push

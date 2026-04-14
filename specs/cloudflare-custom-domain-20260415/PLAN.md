# 日本房价地图 Cloudflare 自定义域名 PLAN

## Step 1: 识别正式入口路径

- Verify: 当前域名 DNS 托管在 Cloudflare
- Verify: 本机预览服务 `http://127.0.0.1:4173/` 返回 `200`
- Verify: 现有 Tunnel `openclaw-tunnel` 可复用

## Step 2: 绑定正式域名到 Tunnel

- Run: `cloudflared tunnel route dns openclaw-tunnel tokyohouse.saaaai.com`
- Modify: `/etc/cloudflared/config.yml`
- Modify: `~/.cloudflared/config.yml`
- Verify: `cloudflared.service` 重启后配置生效

## Step 3: 修正站点对正式域名的放行

- Modify: `vite.config.ts`
- Verify: `preview.allowedHosts` 覆盖 `tokyohouse.saaaai.com`
- Verify: `curl -I https://tokyohouse.saaaai.com/` 返回 `200`

## Step 4: 回写仓库维护链

- Modify: `scripts/start_tailnet_preview.sh`
- Modify: `scripts/run_tokyo_v1_acceptance.sh`
- Modify: `README.md`
- Verify: 固定验收优先检查正式域名，README 口径与正式域名一致

## Step 5: 跑验证

- Run: `npm test`
- Run: `npm run lint`
- Run: `npm run acceptance:tokyo-v1`
- Verify: 最新验收产物包含 `live-default.png`

## Step 6: 收口

- Run: `git add -A`
- Run: `git commit`
- Run: `git push`
- Run: `python3 scripts/readme_closeout_guard.py /home/ubuntu/codex/日本房价地图 --expect-clean`

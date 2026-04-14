# 日本房价地图 Cloudflare 自定义域名 SPEC

## 目标

把东京房价地图挂到 `saaaai.com` 旗下稳定子域，并把后续维护链补到仓库里。

本轮完成后应满足：

- 正式访问域名可用
- 当前站点内容已发布到该域名
- 仓库里存在明确的正式域名维护方式和 README SOP

## 范围

- 绑定 `saaaai.com` 下一个合适子域
- 复用现有 Cloudflare Tunnel 把正式域名接到本机预览服务
- 做一次当前生产可访问性验证
- 回写仓库文档和验收脚本

## 非目标

- 不改站点业务 UI
- 不迁移到 Workers SSR
- 不替换现有 Tailnet 预览，它继续作为内网验收入口

## 约束

- 只使用当前账户已经具备的 Cloudflare Tunnel / DNS / Pages 能力
- 域名必须挂在 `saaaai.com`
- 以后修复后应有明确可复用的发布步骤

## 验收

- `openclaw-tunnel` 已把 `tokyohouse.saaaai.com` 指到当前站点
- `https://tokyohouse.saaaai.com/` 可返回 `HTTP 200`
- 当前仓库验收脚本会优先探活正式域名
- `README.md` 已回写正式域名、Tunnel 真相源与维护 SOP
- 仓库提交、推送并保持干净

# 日本房价地图 V1.10 WebGL Failure Surface PLAN

## 执行顺序

- [ ] Batch A: 给地图初始化失败补显式错误面
- [ ] Batch B: 做正常 / no-WebGL 双面截图验收
- [ ] Batch C: README 收口与提交推送

## Batch A

- [ ] 捕获 MapLibre runtime 加载失败
- [ ] 捕获 MapLibre 构造期 WebGL 初始化失败
- [ ] 前台显示可理解的失败提示

## Batch B

- [ ] 正常 live 入口截图验收
- [ ] no-WebGL 对照截图取证
- [ ] 记录浏览器错误证据

## Batch C

- [ ] README 回写根因与当前边界
- [ ] `npm test`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `python3 scripts/readme_closeout_guard.py /home/ubuntu/codex/日本房价地图 --expect-clean`
- [ ] commit
- [ ] push

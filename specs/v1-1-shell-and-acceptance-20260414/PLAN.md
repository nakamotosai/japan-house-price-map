# 日本房价地图 V1.1 Shell And Acceptance PLAN

> 当前状态真相源最终仍以项目根 `README.md` 为准。本 Plan 只服务于本轮执行。

## 执行顺序

- [ ] Batch A: 补 V1.1 壳层交互
- [ ] Batch B: 做首屏切片
- [ ] Batch C: 扩固定验收脚本
- [ ] Batch D: 验证并回写 README

## Batch A 壳层交互

- [ ] 把左上菜单改成真实可用的操作菜单
- [ ] 移动端模式区改成单行横向模式带
- [ ] 移动端图例默认折叠
- [ ] 保持重置视角、说明入口、模式切换、选站与空白关闭不退化

## Batch B 首屏切片

- [ ] 把说明弹窗改成懒加载
- [ ] 确认首屏仍不闪屏、不白屏
- [ ] 对比 build 产物，确认主包下降

## Batch C 固定验收脚本

- [ ] 为 7 个模式都记录切换结果和请求摘要
- [ ] 补桌面说明弹窗、搜索零结果、移动端菜单态截图
- [ ] 输出 `console-report.json`
- [ ] 输出 `network-report.json`
- [ ] 输出 `interaction-summary.json`
- [ ] 补 live 入口截图或至少 live DOM 可用性证明

## Batch D 验证与文档

- [ ] `npm test`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npm run acceptance:tokyo-v1`
- [ ] 回写根 `README.md`
- [ ] 检查 `git status --short`

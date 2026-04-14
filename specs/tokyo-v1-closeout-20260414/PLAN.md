# 日本房价地图 Tokyo V1 Closeout PLAN

> 当前状态真相源最终仍以项目根 `README.md` 为准。本 Plan 只服务于本轮执行。

## 执行顺序

- [ ] Batch A: 冻结产品口径并重写站内说明
- [ ] Batch B: 为 schools / convenience 做低缩放 overview 聚合
- [ ] Batch C: 做 UI 与交互回归
- [ ] Batch D: 固化验收、README、预览和 git 收口

## Batch A 产品口径与说明

- [ ] 新增东京 V1 版本常量与页面数据说明文案
- [ ] 重写 `IntroOverlay`
- [ ] 把当前真实口径写清：
  - [ ] 灾害风险当前只含洪水浸水
  - [ ] 生活便利度当前只含医疗 + 公共服务代理
- [ ] 在页面可见位置放版本号和数据更新时间
- [ ] 让说明弹窗同时承载“工具怎么用 / 数据从哪来 / 当前边界”

## Batch B overview 聚合与运行时切换

- [ ] 扩展构建脚本，为 `schools / convenience` 生成 `overview + detail`
- [ ] 更新 runtime `index.json`
- [ ] 更新前端类型与 loader，支持 point 模式多 manifest
- [ ] 低缩放自动走 overview
- [ ] 高缩放自动走 detail
- [ ] 保持缓存和 `AbortController` 行为不退化

## Batch C UI 与交互回归

- [ ] 在地图工具页补轻量的加载状态反馈
- [ ] 统一图例/面板/说明入口口径
- [ ] 回归桌面与移动端布局
- [ ] 确保点模式低缩放视觉更克制
- [ ] 确保空白点击收起、模式切换、搜索选站仍正常

## Batch D 验收与发布收口

- [ ] 新增一键前台验收脚本
- [ ] 跑：
  - [ ] `npm test`
  - [ ] `npm run lint`
  - [ ] `npm run build`
- [ ] 重启 Tailnet 预览
- [ ] 对真实入口做探活
- [ ] 生成桌面/移动端截图和模式请求摘要
- [ ] README 回写为 Tokyo V1 真相源
- [ ] 运行 README closeout guard
- [ ] commit
- [ ] push
- [ ] 验证工作树干净

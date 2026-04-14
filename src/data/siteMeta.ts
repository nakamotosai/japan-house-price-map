import type { ModeId } from '../types'

export const TOKYO_SITE_RELEASE = {
  versionLabel: 'Tokyo V1',
  shortVersionLabel: 'V1',
  scopeLabel: '东京工具版',
  runtimeLabel: 'MapLibre + manifest chunk',
}

export const TOKYO_MODE_METHODS: Record<
  ModeId,
  {
    source: string
    period: string
    method: string
    boundary: string
  }
> = {
  price: {
    source: '国土交通省 不動産情報ライブラリ API',
    period: '2024 年住宅成交',
    method: '按站点近邻成交样本聚合中位总价和中位单价。',
    boundary: '当前只覆盖有足够住宅成交样本的站点。',
  },
  land: {
    source: '国土数值信息 L01-25',
    period: '2025 年公示地价',
    method: '按 1.2km 近邻归属到站点，取中位地价。',
    boundary: '这是土地价格底盘，不等于实际住宅成交价。',
  },
  heat: {
    source: '国土数值信息 S12-24 + 官方车站主表',
    period: '最新公开站别客流',
    method: '结合乘降客数和换乘线路数做站点热度排序。',
    boundary: '热度只反映客流和换乘强度，不代表投资结论。',
  },
  schools: {
    source: '国土数值信息 P29-23',
    period: '当前公开学校点位',
    method: '低缩放先看聚合总览，放大后再加载原始学校坐标。',
    boundary: '这是学校坐标层，不是学区质量评分。',
  },
  convenience: {
    source: '国土数值信息 P04-20 + P05-22',
    period: '医疗机构 + 公共服务点位',
    method: '低缩放先看设施聚合，总分是医疗与公共服务的代理指标。',
    boundary: '当前不是完整生活便利度，只是第一版官方代理口径。',
  },
  hazard: {
    source: '国土数值信息 A31a-24_13_20',
    period: '想定最大规模洪水浸水',
    method: '低缩放看简化总览面，高缩放再看细节面。',
    boundary: '当前正式只做洪水浸水，不含液化和土砂灾害。',
  },
  population: {
    source: '国土数值信息 500m_mesh_2024_13',
    period: '2020 -> 2040 推计人口',
    method: '以 500m mesh 变化率判断增长、稳定或收缩。',
    boundary: '当前只做人口趋势，不做就业和收入面。',
  },
}

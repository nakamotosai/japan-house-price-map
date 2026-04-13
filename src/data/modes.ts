import type { HazardZone, ModeDefinition, ModeId, SchoolPoint } from '../types'

export const MODES: Record<ModeId, ModeDefinition> = {
  price: {
    id: 'price',
    label: '房产均价',
    shortLabel: '价',
    category: 'station',
    description: '按站点周边参考成交带着色，适合先看预算层级。',
    panelTitle: '站点价格摘要',
    legend: [
      { label: '高价带', color: '#d9485f', note: '高于 9000 万日元' },
      { label: '中价带', color: '#f08c4a', note: '6000 到 9000 万日元' },
      { label: '可切入带', color: '#2f855a', note: '低于 6000 万日元' },
    ],
  },
  land: {
    id: 'land',
    label: '公示地价',
    shortLabel: '地',
    category: 'station',
    description: '按站点附近的官方地价基准着色，不直接等于住宅成交价。',
    panelTitle: '站点地价摘要',
    legend: [
      { label: '高强度地价', color: '#8b5cf6', note: '核心区土地价值高' },
      { label: '中位地价', color: '#6366f1', note: '成熟城区常见水平' },
      { label: '相对低位', color: '#3b82f6', note: '外圈或非核心板块' },
    ],
  },
  heat: {
    id: 'heat',
    label: '车站热度',
    shortLabel: '热',
    category: 'station',
    description: '按乘降客数和换乘能力观察车站热度。',
    panelTitle: '站点热度摘要',
    legend: [
      { label: '超高热度', color: '#ef476f', note: '大型枢纽' },
      { label: '强热度', color: '#f4a261', note: '成熟换乘站' },
      { label: '区域热度', color: '#2a9d8f', note: '生活型站点' },
    ],
  },
  schools: {
    id: 'schools',
    label: '学校',
    shortLabel: '学',
    category: 'overlay',
    description: '直接挂学校点位，验证后续设施类坐标数据接入能力。',
    panelTitle: '站点学校摘要',
    legend: [
      { label: '学校点位', color: '#2563eb', note: '首版为种子示例点' },
      { label: '车站锚点', color: '#334155', note: '站点保持弱化显示' },
    ],
  },
  hazard: {
    id: 'hazard',
    label: '灾害风险',
    shortLabel: '险',
    category: 'overlay',
    description: '挂风险面图层并保留车站锚点，适合验证多类空间对象切换。',
    panelTitle: '站点风险摘要',
    legend: [
      { label: '高风险区', color: '#d62828', note: '洪水或液化风险较强' },
      { label: '中风险区', color: '#f77f00', note: '需单独核查' },
      { label: '低风险站点', color: '#2a9d8f', note: '相对更稳' },
    ],
  },
}

export const SCHOOL_POINTS: SchoolPoint[] = [
  {
    id: 'school-1',
    name: '番町小学示例点',
    category: '小学',
    lat: 35.6862,
    lng: 139.7428,
    stationIds: ['tokyo'],
  },
  {
    id: 'school-2',
    name: '新宿区学校示例点',
    category: '中学',
    lat: 35.6945,
    lng: 139.7036,
    stationIds: ['shinjuku'],
  },
  {
    id: 'school-3',
    name: '涩谷学校示例点',
    category: '小学',
    lat: 35.6623,
    lng: 139.7074,
    stationIds: ['shibuya'],
  },
  {
    id: 'school-4',
    name: '上野学校示例点',
    category: '中学',
    lat: 35.7167,
    lng: 139.7812,
    stationIds: ['ueno'],
  },
  {
    id: 'school-5',
    name: '丰洲学校示例点',
    category: '小学',
    lat: 35.6507,
    lng: 139.7995,
    stationIds: ['toyosu'],
  },
  {
    id: 'school-6',
    name: '北千住学校示例点',
    category: '中学',
    lat: 35.7515,
    lng: 139.8012,
    stationIds: ['kitasenju'],
  },
]

export const HAZARD_ZONES: HazardZone[] = [
  {
    id: 'hazard-bay',
    name: '湾岸液化与浸水关注区',
    summary: '湾岸填海地，适合同时提示洪水与液化风险。',
    riskLevel: 'high',
    stationIds: ['toyosu'],
    coordinates: [
      [
        [139.774, 35.664],
        [139.81, 35.664],
        [139.81, 35.642],
        [139.774, 35.642],
        [139.774, 35.664],
      ],
    ],
  },
  {
    id: 'hazard-east',
    name: '东东京低洼带',
    summary: '墨田与荒川沿线区域，适合演示低洼地风险图层。',
    riskLevel: 'high',
    stationIds: ['oshiage', 'kitasenju'],
    coordinates: [
      [
        [139.79, 35.725],
        [139.83, 35.725],
        [139.83, 35.697],
        [139.79, 35.697],
        [139.79, 35.725],
      ],
    ],
  },
  {
    id: 'hazard-shinagawa',
    name: '临海中风险示例区',
    summary: '用于演示商务临海区的中风险面图层。',
    riskLevel: 'medium',
    stationIds: ['shinagawa'],
    coordinates: [
      [
        [139.724, 35.639],
        [139.758, 35.639],
        [139.758, 35.617],
        [139.724, 35.617],
        [139.724, 35.639],
      ],
    ],
  },
]

/** 种植商列表（管理员新建批次时下拉选择） */

export type Grower = {
  id: string
  name: string
  region: string
}

export const mockGrowers: Grower[] = [
  { id: 'g-longxi-qihuang', name: '陇西岐黄种植合作社', region: '甘肃 · 陇西' },
  { id: 'g-chuanzang-bencao', name: '川藏本草种植基地', region: '四川 · 阿坝' },
  { id: 'g-diannan-yaocai', name: '滇南药材种植联社', region: '云南 · 文山' },
  { id: 'g-xiangxi-linxia', name: '湘西林下种植基地', region: '湖南 · 湘西' },
  { id: 'g-huabei-jicheng', name: '华北药材集散种植基地', region: '河北 · 安国' },
  { id: 'g-qinling-bencao', name: '秦岭本草种植合作社', region: '陕西 · 商洛' },
  { id: 'g-taibaishan-daodi', name: '太白山道地药材基地', region: '陕西 · 宝鸡太白' },
  { id: 'g-hanzhong-bencao', name: '汉中本草农业公司', region: '陕西 · 汉中' },
]

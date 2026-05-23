/** 仪表盘 · 最近溯源批次 */

export type BatchRow = {
  key: string
  batchNo: string
  herbName: string
  stage: string
  supplier: string
  updatedAt: string
  status: 'normal' | 'pending' | 'risk'
}

export const mockBatches: BatchRow[] = [
  {
    key: '1',
    batchNo: 'YM-2026-GS-HQ-0318',
    herbName: '黄芪',
    stage: '仓储',
    supplier: '陇西岐黄种植合作社',
    updatedAt: '2026-04-29 09:12',
    status: 'risk',
  },
  {
    key: '2',
    batchNo: 'YM-2026-SC-DG-0297',
    herbName: '当归',
    stage: '加工',
    supplier: '川藏本草加工厂',
    updatedAt: '2026-04-29 08:55',
    status: 'pending',
  },
  {
    key: '3',
    batchNo: 'YM-2026-YN-GC-0441',
    herbName: '甘草',
    stage: '运输',
    supplier: '滇南药材物流',
    updatedAt: '2026-04-28 21:40',
    status: 'risk',
  },
  {
    key: '4',
    batchNo: 'YM-2026-HN-HL-0182',
    herbName: '黄连',
    stage: '种植采收',
    supplier: '湘西林下种植基地',
    updatedAt: '2026-04-28 16:03',
    status: 'normal',
  },
  {
    key: '5',
    batchNo: 'YM-2026-HB-JM-0076',
    herbName: '桔梗',
    stage: '采购入库',
    supplier: '华北药材集散中心',
    updatedAt: '2026-04-28 14:22',
    status: 'normal',
  },
]

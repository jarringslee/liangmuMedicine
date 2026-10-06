/**
 * 小型人工整理知识库，不是药典、不提供剂量和治疗建议。
 * 依据香港浸会大学公开可检索的记录摘要整理；未抓取全文或图片。
 * retrievedAt 是本项目核对日期，不是原站发布时间；来源支持知识背景，不证明某批次质量。
 */
export const KNOWLEDGE_VERSION = 'herb-knowledge-v1'

export type KnowledgeChunk = {
  id: string
  herbName: string
  title: string
  content: string
  url: string
  publisher: string
  retrievedAt: string
}

const entries = [
  {
    herbName: '丹参', pid: 'B00020',
    origin: '丹参属于根及根茎类药材，取自唇形科丹参植物的干燥根和根茎。资料列举的常见产区包括山东、江苏、安徽和四川。',
    appearance: '丹参根部通常细长并略弯，外表偏砖红，表面可见纵向沟纹，质地较脆。这些外观描述用于学习识别，不能替代专业鉴定或质检。',
  },
  {
    herbName: '黄芪', pid: 'B00071',
    origin: '黄芪属于根及根茎类药材，来源涉及豆科蒙古黄芪和膜荚黄芪的干燥根。资料列举的常见产区包括内蒙古、山西和河北。',
    appearance: '黄芪根条通常呈长圆柱形，外表偏浅棕黄色或浅棕褐色，带有纵向纹理，断面可观察到放射状纹理。描述并非某个批次的检测结论。',
  },
  {
    herbName: '当归', pid: 'B00049',
    origin: '当归属于根及根茎类药材，来自伞形科当归植物的干燥根。资料列举的常见产区包括甘肃、云南和青海。',
    appearance: '当归整体可见主根及分出的支根，外表多为黄棕色到棕褐色，带有纵向皱纹，断面偏黄白。外观资料不等于实际批次质量合格。',
  },
  {
    herbName: '甘草', pid: 'B00129',
    origin: '甘草属于根及根茎类药材，该记录介绍豆科甘草植物的干燥根及根茎。资料列举的常见产区包括内蒙古、山西、甘肃、新疆和宁夏。',
    appearance: '甘草根多为圆柱形，表面偏红棕或灰棕并带有纵向纹理，断面偏黄白，根茎可见芽痕。不能仅凭这些资料确认某批次品种或安全性。',
  },
] as const

export const knowledgeChunks: KnowledgeChunk[] = entries.flatMap((entry) =>
  (['origin', 'appearance'] as const).map((section) => ({
    id: `knowledge:${entry.pid}:${section}`,
    herbName: entry.herbName,
    title: `${entry.herbName} · ${section === 'origin' ? '来源、类别与常见产地' : '外观识别资料'}`,
    content: entry[section],
    url: `https://sys01.lib.hkbu.edu.hk/cmed/mmid/detail.php?pid=${entry.pid}&lang=chs`,
    publisher: '香港浸会大学中药材图像数据库（人工摘要）',
    retrievedAt: '2026-10-05',
  })),
)

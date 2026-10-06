import { Button } from 'antd'
import { CommentOutlined } from '@ant-design/icons'
import { useAssistant } from '../../hooks/useAssistant'
import type { HerbBatch } from '../../types/herb'

// 兼容现有详情/预览入口；不再在每个批次各自创建问答会话。
export default function HerbQuestionPanel({ batch }: { batch: HerbBatch }) {
    const { openAssistant } = useAssistant()
    return <Button type="primary" icon={<CommentOutlined />} style={{ marginTop: 16 }}
        onClick={() => openAssistant({ id: batch.id, herbName: batch.herbName, batchNo: batch.batchNo })}>
        问问 AI
    </Button>
}
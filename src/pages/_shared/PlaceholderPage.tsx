import { Button, Card, Typography } from 'antd'
import { Link } from 'react-router-dom'
import { getDefaultHome } from '../../mock/user/credentials'
import { useAuth } from '../../hooks/useAuth'
import '../dashboard/index.less'

const { Paragraph, Title } = Typography

type PlaceholderPageProps = {
  title: string
  description?: string
  backTo?: string
  backLabel?: string
}

export default function PlaceholderPage({
  title,
  description = '功能开发中，当前为占位页。',
  backTo,
  backLabel = '返回',
}: PlaceholderPageProps) {
  const { session } = useAuth()
  const home = session ? getDefaultHome(session.role) : '/login'

  return (
    <div className="admin-dashboard" style={{ minHeight: '100vh', padding: 24 }}>
      <Card style={{ maxWidth: 560, margin: '48px auto' }}>
        <Title level={4}>{title}</Title>
        <Paragraph type="secondary">{description}</Paragraph>
        <Link to={backTo ?? home}>
          <Button type="primary">{backLabel}</Button>
        </Link>
      </Card>
    </div>
  )
}

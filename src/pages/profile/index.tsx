import { useState } from 'react'
import {
  Breadcrumb,
  Button,
  Card,
  Descriptions,
  Flex,
  Form,
  Input,
  Layout,
  Modal,
  Space,
  Tag,
  Typography,
  theme,
} from 'antd'
import type { FormProps } from 'antd'
import {
  ArrowLeftOutlined,
  EditOutlined,
  KeyOutlined,
  LogoutOutlined,
  MedicineBoxOutlined,
  SwapOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import {
  mockAdminProfileDetail,
  mockBuyerProfileDetail,
  type UserProfileDetail,
} from '../../mock/user/profile'
import type { UserRole } from '../../types/auth'
import '../dashboard/index.less'
import './index.less'

const { Header, Content } = Layout
const { Title, Text } = Typography

type EditFormValues = {
  displayName: string
  phone: string
  /** admin 专属 */
  department?: string
  position?: string
  /** buyer 专属 */
  company?: string
}

type PasswordFormValues = {
  oldPassword: string
  newPassword: string
  confirmPassword: string
}

/** 根据登录态选择对应资料 */
function pickProfileDetail(role: UserRole): UserProfileDetail {
  return role === 'buyer' ? mockBuyerProfileDetail : mockAdminProfileDetail
}

/** 路由级返回信息（与采购商 / 管理员端首页一致） */
function backHomeForRole(role: UserRole): {
  path: string
  label: string
  breadcrumbRoot: { path: string; label: string }
} {
  if (role === 'buyer') {
    return {
      path: '/buyer/herbs',
      label: '返回药材列表',
      breadcrumbRoot: { path: '/buyer/herbs', label: '采购商端' },
    }
  }
  return {
    path: '/dashboard',
    label: '返回数据概览',
    breadcrumbRoot: { path: '/dashboard', label: '管理员端' },
  }
}

function maskPhone(phone: string): string {
  return phone.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2')
}

export default function ProfilePage() {
  const { token } = theme.useToken()
  const navigate = useNavigate()
  const { session, logout } = useAuth()
  const role: UserRole = session?.role ?? 'admin'
  const isAdmin = role === 'admin'
  const [detail] = useState<UserProfileDetail>(pickProfileDetail(role))
  const [editOpen, setEditOpen] = useState(false)
  const [pwdOpen, setPwdOpen] = useState(false)
  const [editForm] = Form.useForm<EditFormValues>()
  const [pwdForm] = Form.useForm<PasswordFormValues>()
  const back = backHomeForRole(role)

  const goLogin = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const confirmExit = (title: string) => {
    Modal.confirm({
      title,
      content: '确定后返回登录页',
      okText: '确定',
      cancelText: '取消',
      onOk: goLogin,
    })
  }

  const openEdit = () => {
    editForm.setFieldsValue({
      displayName: detail.displayName,
      phone: detail.phone,
      department: detail.department,
      position: detail.position,
      company: detail.company,
    })
    setEditOpen(true)
  }

  const phoneMasked = maskPhone(detail.phone)

  const onEditFinish: FormProps<EditFormValues>['onFinish'] = () => {
    Modal.success({
      title: '已提交',
      content: '演示环境：个人信息修改请求已记录，实际变更待接口接入后生效。',
    })
    setEditOpen(false)
    editForm.resetFields()
  }

  const onPwdFinish: FormProps<PasswordFormValues>['onFinish'] = () => {
    Modal.success({
      title: '已提交',
      content: '演示环境：密码修改请求已记录，请在后端接入后完成校验与更新。',
    })
    setPwdOpen(false)
    pwdForm.resetFields()
  }

  /** Hero 副标题：admin → 工号；buyer → 所属公司 */
  const heroSubtitle = isAdmin
    ? `工号 ${detail.employeeNo ?? '—'}`
    : `所属公司 ${detail.company ?? '—'}`

  return (
    <Layout className="admin-dashboard profile-page" style={{ minHeight: '100vh' }}>
      <Header className="admin-dashboard__header">
        <Flex align="center" justify="space-between" style={{ width: '100%' }}>
          <Space size="middle" wrap>
            <MedicineBoxOutlined style={{ fontSize: 22, color: token.colorPrimary }} />
            <Title level={4} style={{ margin: 0 }}>
              个人信息
            </Title>
          </Space>
          <Link to={back.path}>
            <Space>
              <ArrowLeftOutlined />
              {back.label}
            </Space>
          </Link>
        </Flex>
      </Header>

      <Content className="admin-dashboard__content profile-page__content">
        <Breadcrumb
          style={{ marginBottom: 16 }}
          items={[
            { title: <Link to={back.breadcrumbRoot.path}>{back.breadcrumbRoot.label}</Link> },
            { title: <span style={{ color: token.colorText }}>个人信息</span> },
          ]}
        />

        <Card className="profile-page__hero" bordered={false}>
          <Flex align="center" gap={20} wrap>
            <div className="profile-page__avatar-wrap">
              <UserOutlined className="profile-page__avatar-icon" />
            </div>
            <div>
              <Title level={4} style={{ margin: '0 0 8px' }}>
                {detail.displayName}
              </Title>
              <Space wrap>
                <Text type="secondary">{detail.roleLabel}</Text>
                <Text type="secondary">·</Text>
                <Text type="secondary">{heroSubtitle}</Text>
              </Space>
            </div>
          </Flex>
        </Card>

        <Card title="基本信息" bordered={false} style={{ marginTop: 16 }}>
          <Descriptions column={{ xs: 1, sm: 1, md: 2 }} bordered size="middle">
            {isAdmin ? (
              <>
                <Descriptions.Item label="姓名">{detail.displayName}</Descriptions.Item>
                <Descriptions.Item label="工号">{detail.employeeNo ?? '—'}</Descriptions.Item>
                <Descriptions.Item label="手机号">{phoneMasked}</Descriptions.Item>
                <Descriptions.Item label="邮箱">{detail.email}</Descriptions.Item>
                <Descriptions.Item label="部门">{detail.department ?? '—'}</Descriptions.Item>
                <Descriptions.Item label="职位">{detail.position ?? '—'}</Descriptions.Item>
                <Descriptions.Item label="角色">{detail.roleLabel}</Descriptions.Item>
                <Descriptions.Item label="最近登录时间">{detail.lastLoginAt}</Descriptions.Item>
                <Descriptions.Item label="登录地点" span={2}>
                  {detail.lastLoginLocation}
                </Descriptions.Item>
              </>
            ) : (
              <>
                <Descriptions.Item label="姓名">{detail.displayName}</Descriptions.Item>
                <Descriptions.Item label="客户编号">{detail.customerNo ?? '—'}</Descriptions.Item>
                <Descriptions.Item label="手机号">{phoneMasked}</Descriptions.Item>
                <Descriptions.Item label="邮箱">{detail.email}</Descriptions.Item>
                <Descriptions.Item label="所属公司">{detail.company ?? '—'}</Descriptions.Item>
                <Descriptions.Item label="合作起始">{detail.cooperationSince ?? '—'}</Descriptions.Item>
                <Descriptions.Item label="角色">{detail.roleLabel}</Descriptions.Item>
                <Descriptions.Item label="最近登录时间">{detail.lastLoginAt}</Descriptions.Item>
                <Descriptions.Item label="偏好采购品类" span={2}>
                  {detail.preferredCategories && detail.preferredCategories.length > 0 ? (
                    <Space size={4} wrap>
                      {detail.preferredCategories.map((c) => (
                        <Tag key={c} color="green" bordered={false}>
                          {c}
                        </Tag>
                      ))}
                    </Space>
                  ) : (
                    '—'
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="登录地点" span={2}>
                  {detail.lastLoginLocation}
                </Descriptions.Item>
              </>
            )}
          </Descriptions>
        </Card>

        <Card bordered={false} style={{ marginTop: 16 }}>
          <Space wrap size="middle">
            <Button type="primary" icon={<EditOutlined />} onClick={openEdit}>
              修改个人信息
            </Button>
            <Button icon={<KeyOutlined />} onClick={() => setPwdOpen(true)}>
              修改密码
            </Button>
            <Button icon={<SwapOutlined />} onClick={() => confirmExit('切换账号？')}>
              切换账号
            </Button>
            <Button danger icon={<LogoutOutlined />} onClick={() => confirmExit('退出登录？')}>
              退出登录
            </Button>
          </Space>
          <ParagraphExtra />
        </Card>
      </Content>

      <Modal
        title="修改个人信息"
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form<EditFormValues> form={editForm} layout="vertical" onFinish={onEditFinish}>
          <Form.Item name="displayName" label="姓名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="手机号" rules={[{ required: true }]}>
            <Input placeholder="11 位手机号" />
          </Form.Item>
          {isAdmin ? (
            <>
              <Form.Item name="department" label="部门" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="position" label="职位" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </>
          ) : (
            <Form.Item
              name="company"
              label="所属公司"
              rules={[{ required: true, message: '请输入所属公司或填写「个体」' }]}
            >
              <Input placeholder="如：西安XX中药材有限公司 或 个体" />
            </Form.Item>
          )}
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                保存（演示）
              </Button>
              <Button onClick={() => setEditOpen(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="修改密码"
        open={pwdOpen}
        onCancel={() => setPwdOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form<PasswordFormValues> form={pwdForm} layout="vertical" onFinish={onPwdFinish}>
          <Form.Item name="oldPassword" label="当前密码" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="newPassword" label="新密码" rules={[{ required: true, min: 6, message: '至少 6 位' }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="确认新密码"
            dependencies={['newPassword']}
            rules={[
              { required: true },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) return Promise.resolve()
                  return Promise.reject(new Error('两次输入不一致'))
                },
              }),
            ]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                提交（演示）
              </Button>
              <Button onClick={() => setPwdOpen(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  )
}

function ParagraphExtra() {
  return (
    <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>
      一切隐私信息和解释权归良木药谷公司所有。
    </Text>
  )
}

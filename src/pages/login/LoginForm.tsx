import { useMemo, useState } from 'react'
import { Button, Flex, Form, Input, message, Segmented, Tabs, Typography } from 'antd'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { loginRoleTabs, type LoginRoleKey } from '../../mock/login/roles'
import { getDefaultHome, verifyStaticLogin } from '../../mock/user/credentials'
import { sanitizeRedirectPath } from '../../utils/auth'

const { Text } = Typography

export type LoginAccountMode = 'username' | 'email'

type FieldValues = {
  account: string
  password: string
}

const ACCOUNT_ERROR = '输入信息错误'

export function LoginForm() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login } = useAuth()
  const [role, setRole] = useState<LoginRoleKey>('admin')
  const [mode, setMode] = useState<LoginAccountMode>('username')
  const [form] = Form.useForm<FieldValues>()

  const accountPlaceholder = mode === 'username' ? '用户名' : '邮箱'

  const tabItems = useMemo(
    () =>
      loginRoleTabs.map((t) => ({
        key: t.key,
        label: t.label,
      })),
    [],
  )

  const onFinish = (values: FieldValues) => {
    const session = verifyStaticLogin(role, mode, values.account ?? '', values.password ?? '')
    if (!session) {
      message.error(ACCOUNT_ERROR)
      return
    }

    login(session)
    message.success(`欢迎，${session.displayName}`)

    const redirect = sanitizeRedirectPath(searchParams.get('redirect'))
    navigate(redirect ?? getDefaultHome(session.role), { replace: true })
  }

  const onForgotPassword = () => {
    message.info('演示环境：请联系系统管理员重置密码。内部账号由管理员统一开通与发放。')
  }

  return (
    <div className="login-page__form-wrap">
      <Tabs
        activeKey={role}
        onChange={(k) => {
          setRole(k as LoginRoleKey)
          form.resetFields()
        }}
        size="small"
        className="login-page__role-tabs"
        items={tabItems}
      />

      <Segmented<LoginAccountMode>
        block
        value={mode}
        onChange={(v) => {
          setMode(v)
          form.setFieldValue('account', '')
        }}
        options={[
          { label: '用户名登录', value: 'username' },
          { label: '邮箱登录', value: 'email' },
        ]}
        className="login-page__mode-segmented"
      />

      <Form<FieldValues>
        form={form}
        layout="vertical"
        requiredMark={false}
        className="login-page__form"
        onFinish={onFinish}
        autoComplete="off"
      >
        <Form.Item name="account" label={accountPlaceholder} rules={[{ required: true, message: `请输入${accountPlaceholder}` }]}>
          <Input allowClear placeholder={`请输入${accountPlaceholder}`} size="large" />
        </Form.Item>

        <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
          <Input.Password placeholder="请输入密码" size="large" visibilityToggle />
        </Form.Item>

        <div className="login-page__pwd-hint">
          <Text type="secondary">首次登录密码默认为用户ID+123</Text>
        </div>

        <Flex justify="flex-end" className="login-page__forgot-row">
          <Button type="link" className="login-page__forgot-btn" onClick={onForgotPassword}>
            忘记密码
          </Button>
        </Flex>

        <Form.Item className="login-page__submit-item">
          <Button type="primary" htmlType="submit" size="large" block>
            登录
          </Button>
        </Form.Item>
      </Form>
    </div>
  )
}

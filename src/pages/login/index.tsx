import { useEffect, useState } from 'react'
import { Card } from 'antd'
import { welcomeSlideIntervalMs, welcomeSlides } from '../../mock/login/welcomeSlides'
import { LoginForm } from './LoginForm'
import './index.less'

const PROJECT_TITLE = '良木药谷 · 中药材全链路智能溯源管理平台'

export default function LoginPage() {
  const [index, setIndex] = useState(0)
  const total = welcomeSlides.length
  const slide = welcomeSlides[index]!

  useEffect(() => {
    const t = window.setInterval(() => {
      setIndex((i) => (i + 1) % total)
    }, welcomeSlideIntervalMs)
    return () => clearInterval(t)
  }, [total])

  return (
    <div className="login-page">
      <section className="login-page__left" aria-labelledby="login-welcome-title">
        <div className="login-page__left-inner">
          <h1 id="login-welcome-title" className="login-page__title">
            <span className="login-page__title-mark" aria-hidden />
            {PROJECT_TITLE}
          </h1>

          <div className="login-page__carousel" role="status" aria-live="polite" aria-atomic="true">
            <div key={slide.id} className="login-page__slide">
              {slide.paragraphs.map((text, i) => (
                <p key={`${slide.id}-p${i}`} className="login-page__para">
                  {text}
                </p>
              ))}
            </div>
          </div>

          <ul className="login-page__dots" aria-hidden="true">
            {welcomeSlides.map((s, i) => (
              <li
                key={s.id}
                className={`login-page__dot ${i === index ? 'is-active' : ''}`}
              />
            ))}
          </ul>
        </div>
      </section>

      <aside className="login-page__right" aria-label="登录">
        <Card className="login-page__card" bordered={false}>
          <LoginForm />
        </Card>
      </aside>
    </div>
  )
}

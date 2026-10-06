// 页面弹窗里，用户输入问题，向这个批次的资料提问 AI；可以随时点停止回答。


import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { isAbortError } from '../services/api'
import { askHerbQuestion } from '../services/herbDataSource'

// 一次提问任务：用户输入的问题 + 中断控制器
type QuestionRun = {
    question: string
    controller: AbortController
}

export function useHerbQuestion(batchId: string) {
    // 用ref保存控制器，ref在组件多次渲染不会丢值
    const controllerRef = useRef<AbortController | null>(null)
    // 是否是用户手动点停止标记
    const [stopped, setStopped] = useState(false)

    // 组件卸载（页面离开/弹窗关闭）时取消等待中的问答请求；上游费用不保证退还
    useEffect(() => {
        return () => {
            // 关闭问答所在的页面/弹窗后，不继续等待模型回答。
            controllerRef.current?.abort()
        }
    }, [])

    const mutation = useMutation({
        mutationKey: ['herb-question', batchId],
        mutationFn: ({ question, controller }: QuestionRun) =>
            askHerbQuestion(batchId, question, controller.signal),
        retry: false,
        // 这是只读问答，不需要 invalidate 批次列表。
    })


    // ask是对外暴露的发起提问方法
    // 1. 先判断：已经有正在跑的问答，直接 return，防重复提交
    // 2. 新建 AbortController，存进 ref，重置 stopped 标记
    // 3. 调用 mutation 发起请求，底层 askHerbQuestion 通过 signal 取消普通 JSON 请求（不是 SSE）
    // 4. finally：不管成功失败，把 ref 清空。
    const ask = async (question: string) => {
        // ref 阻止同一轮渲染内的连续点击；isPending 负责按钮展示。
        if (controllerRef.current || mutation.isPending) return

        const controller = new AbortController()
        controllerRef.current = controller
        setStopped(false)

        try {
            return await mutation.mutateAsync({ question, controller })
        } finally {
            if (controllerRef.current === controller) {
                controllerRef.current = null
            }
        }
    }
    // stop：对外暴露停止回答函数
    // 拿到控制器，标记 stopped=true，执行 abort，取消等待中的请求
    //  stopped 用来给 UI 展示：“已停止回答” 提示
    const stop = () => {
        const controller = controllerRef.current
        if (controller && !controller.signal.aborted) {
            setStopped(true)
            controller.abort()
        }
    }

    return {
        mutation,
        ask,
        stop,
        stopped,
        error: isAbortError(mutation.error) ? null : mutation.error,
    }
}

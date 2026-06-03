/**
 * @file 右下角 AI 快捷入口（站内）。
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, Sparkles, X, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function AiFloatingEntry() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button
        type="button"
        aria-label="AI 助手"
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-violet-600 text-white shadow-lg transition hover:scale-105 md:bottom-6"
      >
        <Sparkles className="h-5 w-5" />
      </button>
    )
  }

  return (
    <div className="fixed bottom-20 right-4 z-40 w-56 rounded-xl border border-sky-200 bg-white p-3 shadow-xl md:bottom-6">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-800">AI 助手</p>
        <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">站内 AI，按调用次数计费</p>
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          size="sm"
          className="justify-start gap-2"
          onClick={() => {
            setOpen(false)
            navigate('/app/ai-assistant')
          }}
        >
          <Bot className="h-4 w-4" />
          AI 智能助手
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="justify-start gap-2"
          onClick={() => {
            setOpen(false)
            navigate('/app/ai-copy')
          }}
        >
          <Sparkles className="h-4 w-4" />
          AI 文案
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="justify-start gap-2"
          onClick={() => {
            setOpen(false)
            navigate('/app/script-library')
          }}
        >
          <MessageSquare className="h-4 w-4" />
          话术库
        </Button>
      </div>
    </div>
  )
}

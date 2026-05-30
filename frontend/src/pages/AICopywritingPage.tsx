/**
 * @file AI 文案生成：调用 POST /api/v1/ai/generate-copy（需登录与 DEEPSEEK_API_KEY 等）。
 */
import { useState } from 'react'
import { Loader2, Copy, Check, Sparkles } from 'lucide-react'
import { postJson } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const styles = [
  { value: '种草', label: '种草（小红书 / 朋友圈）' },
  { value: '专业', label: '专业（B 端 / 企业）' },
  { value: '促销', label: '促销（限时活动）' },
]

export function AICopywritingPage() {
  const [prompt, setPrompt] = useState('')
  const [style, setStyle] = useState('种草')
  const [generatedText, setGeneratedText] = useState('')
  const [loading, setLoading] = useState(false)
  const [posterLoading, setPosterLoading] = useState(false)
  const [posterUrl, setPosterUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    if (!prompt.trim()) {
      setError('请填写产品 / 卖点描述')
      return
    }
    setError(null)
    setLoading(true)
    setGeneratedText('')
    try {
      const data = await postJson<{ text: string }>('/ai/generate-copy', {
        prompt: prompt.trim(),
        style: style || undefined,
      })
      setGeneratedText(data.text)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '生成失败')
    } finally {
      setLoading(false)
    }
  }

  async function handleGeneratePoster() {
    if (!prompt.trim()) {
      setError('请填写产品 / 卖点描述')
      return
    }
    setError(null)
    setPosterLoading(true)
    setPosterUrl('')
    try {
      const data = await postJson<{ poster_data_url: string }>('/ai/generate-poster', {
        prompt: prompt.trim(),
        style: style || undefined,
      })
      setPosterUrl(data.poster_data_url)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '海报生成失败')
    } finally {
      setPosterLoading(false)
    }
  }

  async function handleCopy() {
    if (!generatedText) return
    await navigator.clipboard.writeText(generatedText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI 文案生成</h1>
          <p className="text-sm text-muted-foreground">
            后端需配置 <code className="text-xs">DEEPSEEK_API_KEY</code> 或{' '}
            <code className="text-xs">OPENAI_API_KEY</code>
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">生成设置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>产品 / 卖点描述</Label>
            <textarea
              className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="例如：企业微信渠道活码，支持员工分流、渠道统计、自动打标签……"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>文案风格</Label>
            <select
              className="flex h-9 w-full max-w-xs rounded-md border border-input bg-background px-3 text-sm"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
            >
              {styles.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" className="w-full sm:w-auto" onClick={() => void handleGenerate()} disabled={loading || posterLoading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              一键生成文案
            </Button>
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => void handleGeneratePoster()} disabled={loading || posterLoading}>
              {posterLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              生成营销海报
            </Button>
          </div>
        </CardContent>
      </Card>

      {generatedText ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">生成结果</CardTitle>
            <Button size="sm" variant="outline" type="button" onClick={() => void handleCopy()} className="gap-1">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? '已复制' : '复制'}
            </Button>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap rounded-md border bg-muted/30 p-4 text-sm font-sans">{generatedText}</pre>
          </CardContent>
        </Card>
      ) : null}
      {posterUrl ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">海报预览</CardTitle>
          </CardHeader>
          <CardContent>
            <img src={posterUrl} alt="AI 生成海报" className="mx-auto w-full max-w-xs rounded-md border" />
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

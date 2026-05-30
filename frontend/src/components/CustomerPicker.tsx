/**
 * @file 可搜索的客户选择器（服务台新建工单/订单等）。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchCustomer, formatCustomerLabel, searchCustomers } from '@/api/customers'
import type { CustomerRow } from '@/api/types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type Props = {
  value: number | null
  onChange: (customerId: number | null, customer?: CustomerRow | null) => void
  label?: string
  placeholder?: string
  disabled?: boolean
}

export function CustomerPicker({
  value,
  onChange,
  label = '客户',
  placeholder = '搜索姓名、手机、公司或客户 ID',
  disabled,
}: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [options, setOptions] = useState<CustomerRow[]>([])
  const [selected, setSelected] = useState<CustomerRow | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadSelected = useCallback(async (id: number) => {
    try {
      const row = await fetchCustomer(id)
      setSelected(row)
      setQuery(formatCustomerLabel(row))
    } catch {
      setSelected(null)
      setQuery('')
    }
  }, [])

  useEffect(() => {
    if (value != null && value > 0) {
      if (selected?.id === value) return
      void loadSelected(value)
      return
    }
    setSelected(null)
    if (!open) setQuery('')
  }, [value, selected?.id, loadSelected, open])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  useEffect(() => {
    if (!open) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const kw = query.trim()
    if (selected && kw === formatCustomerLabel(selected)) {
      setOptions([])
      return
    }
    debounceRef.current = setTimeout(() => {
      setLoading(true)
      void searchCustomers({ keyword: kw || undefined, size: 15 })
        .then((res) => setOptions(res.list))
        .catch(() => setOptions([]))
        .finally(() => setLoading(false))
    }, 280)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, open, selected])

  function pick(row: CustomerRow) {
    setSelected(row)
    setQuery(formatCustomerLabel(row))
    onChange(row.id, row)
    setOpen(false)
  }

  function clear() {
    setSelected(null)
    setQuery('')
    setOptions([])
    onChange(null, null)
  }

  return (
    <div ref={rootRef} className="relative space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          onFocus={() => {
            setOpen(true)
            if (!query.trim() && !selected) {
              setLoading(true)
              void searchCustomers({ size: 10 })
                .then((res) => setOptions(res.list))
                .finally(() => setLoading(false))
            }
          }}
          onChange={(e) => {
            const v = e.target.value
            setQuery(v)
            setOpen(true)
            if (selected && v !== formatCustomerLabel(selected)) {
              setSelected(null)
              onChange(null, null)
            }
          }}
        />
        {value ? (
          <button
            type="button"
            className="shrink-0 text-xs text-muted-foreground underline"
            onClick={clear}
            disabled={disabled}
          >
            清除
          </button>
        ) : null}
      </div>
      {value ? (
        <p className="text-xs text-muted-foreground">
          已选 #{value}
          <Link to={`/app/customers/${value}`} className="ml-2 text-primary underline" target="_blank">
            打开客户
          </Link>
        </p>
      ) : null}
      {open ? (
        <ul
          className={cn(
            'absolute z-50 mt-1 max-h-52 w-full overflow-auto rounded-md border bg-card py-1 text-sm shadow-md',
          )}
        >
          {loading ? (
            <li className="px-3 py-2 text-muted-foreground">搜索中…</li>
          ) : options.length === 0 ? (
            <li className="px-3 py-2 text-muted-foreground">
              {query.trim() ? '无匹配客户' : '输入关键词搜索，或从最近客户中选择'}
            </li>
          ) : (
            options.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className={cn(
                    'w-full px-3 py-2 text-left hover:bg-muted',
                    value === row.id && 'bg-muted/80',
                  )}
                  onClick={() => pick(row)}
                >
                  <span className="font-medium">{formatCustomerLabel(row)}</span>
                  <span className="ml-2 text-xs text-muted-foreground">#{row.id}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}

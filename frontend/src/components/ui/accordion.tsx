import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

type AccordionContextType = {
  value: string | null
  setValue: (v: string | null) => void
}
const AccordionContext = React.createContext<AccordionContextType | null>(null)

export function Accordion({
  children,
  type = 'single',
  defaultValue = null,
}: {
  children: React.ReactNode
  type?: 'single'
  defaultValue?: string | null
}) {
  const [value, setValue] = React.useState<string | null>(defaultValue)
  return (
    <AccordionContext.Provider value={{ value, setValue }}>
      <div data-type={type}>{children}</div>
    </AccordionContext.Provider>
  )
}

export function AccordionItem({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('border-b', className)} data-value={value}>
      {children}
    </div>
  )
}

export function AccordionTrigger({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  const ctx = React.useContext(AccordionContext)
  if (!ctx) return null
  const open = ctx.value === value
  return (
    <button
      type="button"
      className={cn('flex w-full items-center justify-between py-3 text-sm font-medium', className)}
      onClick={() => ctx.setValue(open ? null : value)}
    >
      <span>{children}</span>
      <ChevronDown className={cn('h-4 w-4 transition-transform', open ? 'rotate-180' : '')} />
    </button>
  )
}

export function AccordionContent({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  const ctx = React.useContext(AccordionContext)
  if (!ctx || ctx.value !== value) return null
  return <div className={cn('pb-3', className)}>{children}</div>
}

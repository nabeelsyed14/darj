import { Select, Input } from 'antd'

interface ClassSelectorProps {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  style?: React.CSSProperties
  size?: 'small' | 'middle' | 'large'
}

const CLASS_OPTIONS = [
  ...Array.from({ length: 12 }, (_, i) => ({ label: `Class ${i + 1}`, value: `Class ${i + 1}` })),
  { label: 'Custom...', value: '__custom__' }
]

export default function ClassSelector({ value, onChange, placeholder, style, size }: ClassSelectorProps) {
  const isCustom = value && !CLASS_OPTIONS.slice(0, 12).some((o) => o.value === value)
  const displayValue = isCustom ? '__custom__' : value || undefined

  return (
    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', ...style }}>
      <Select
        value={displayValue}
        onChange={(v) => {
          if (v === '__custom__') {
            onChange?.('')
          } else {
            onChange?.(v)
          }
        }}
        placeholder={placeholder || 'Select class'}
        style={{ width: isCustom ? 160 : 200 }}
        size={size}
        options={CLASS_OPTIONS}
      />
      {isCustom && (
        <Input
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder="Enter class name"
          style={{ width: 180 }}
          size={size}
          autoFocus
        />
      )}
    </span>
  )
}

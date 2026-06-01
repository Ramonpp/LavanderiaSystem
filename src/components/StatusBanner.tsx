import type { PropsWithChildren } from 'react'

export function StatusBanner(
  props: PropsWithChildren<{
    kind: 'error' | 'success' | 'info'
    message: string
  }>,
) {
  return (
    <div
      className={`panel`}
      role="note"
      style={{
        padding: '10px 12px',
        borderColor:
          props.kind === 'error'
            ? 'color-mix(in srgb, var(--danger), var(--border) 35%)'
            : props.kind === 'success'
              ? 'color-mix(in srgb, var(--ok), var(--border) 35%)'
              : 'var(--border)',
        marginBottom: 12,
      }}
    >
      <div style={{ fontWeight: 650, marginBottom: 4 }}>{props.message}</div>
      {props.children}
    </div>
  )
}

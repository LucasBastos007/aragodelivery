"use client"

interface Props {
  current: number
  total: number
  labels: string[]
}

export function StepIndicator({ current, total, labels }: Props) {
  return (
    <div className="mb-8">
      <div className="flex gap-1.5 mb-2.5">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className="flex-1 h-1 rounded-full overflow-hidden"
            style={{ background: "rgba(255,255,255,0.08)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                background: "#f97316",
                width: i < current ? "100%" : "0%",
                transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)",
              }}
            />
          </div>
        ))}
      </div>
      <p className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.35)" }}>
        Etapa {current} de {total} · {labels[current - 1]}
      </p>
    </div>
  )
}

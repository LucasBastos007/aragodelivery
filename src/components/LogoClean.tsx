"use client"

export function LogoClean({ height, style }: { height: number; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: "#111",
        borderRadius: 10,
        padding: "4px 10px",
        display: "inline-flex",
        alignItems: "center",
        flexShrink: 0,
        ...style,
      }}
    >
      <img
        src="/logo-original.jpg"
        alt="Chegô"
        style={{ height, width: "auto", objectFit: "contain", display: "block", borderRadius: 6 }}
      />
    </div>
  )
}

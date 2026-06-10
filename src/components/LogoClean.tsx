"use client"

import { useEffect, useState } from "react"

export function LogoClean({ height, style }: { height: number; style?: React.CSSProperties }) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    const img = new Image()
    img.src = "/logo-original.jpg"
    img.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext("2d")!
      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const px = imageData.data
      for (let i = 0; i < px.length; i += 4) {
        if ((px[i] + px[i + 1] + px[i + 2]) / 3 < 20) px[i + 3] = 0
      }
      ctx.putImageData(imageData, 0, 0)
      setSrc(canvas.toDataURL("image/png"))
    }
  }, [])

  if (!src) return <div style={{ height, width: height * 2.5, flexShrink: 0 }} />
  return (
    <img
      src={src}
      alt="Chegô"
      style={{ height, width: "auto", objectFit: "contain", display: "block", ...style }}
    />
  )
}

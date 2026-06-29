/**
 * Valida o tipo real de um arquivo verificando seus magic bytes (primeiros bytes).
 * O `file.type` enviado pelo cliente pode ser forjado — os magic bytes não podem.
 */

export type AllowedFileType = "image/jpeg" | "image/png" | "image/webp" | "image/gif" | "application/pdf" | "image/heic" | "image/heif"

interface MagicSignature {
  bytes: number[]
  mask?: number[]   // se presente, AND com o byte antes de comparar
  offset?: number   // offset de onde começa a assinatura
  mime: AllowedFileType
}

const SIGNATURES: MagicSignature[] = [
  // JPEG: FF D8 FF
  { bytes: [0xFF, 0xD8, 0xFF], mime: "image/jpeg" },
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  { bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], mime: "image/png" },
  // WebP: RIFF????WEBP (bytes 0-3 = RIFF, bytes 8-11 = WEBP)
  { bytes: [0x52, 0x49, 0x46, 0x46], mime: "image/webp" }, // verificação adicional abaixo
  // GIF87a ou GIF89a
  { bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], mime: "image/gif" },
  { bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], mime: "image/gif" },
  // PDF: %PDF
  { bytes: [0x25, 0x50, 0x44, 0x46], mime: "application/pdf" },
  // HEIC/HEIF: ftyp box — bytes 4-7 = "ftyp" + brand
  { bytes: [0x66, 0x74, 0x79, 0x70], offset: 4, mime: "image/heic" },
]

function bytesMatch(buf: Uint8Array, sig: MagicSignature): boolean {
  const offset = sig.offset ?? 0
  if (buf.length < offset + sig.bytes.length) return false
  for (let i = 0; i < sig.bytes.length; i++) {
    const fileByte = buf[offset + i]
    const sigByte  = sig.bytes[i]
    const mask     = sig.mask?.[i] ?? 0xFF
    if ((fileByte & mask) !== (sigByte & mask)) return false
  }
  return true
}

/**
 * Detecta o tipo real do arquivo pelos magic bytes.
 * Retorna o MIME type detectado ou null se não reconhecido.
 */
export function detectMimeType(buf: Uint8Array): AllowedFileType | null {
  for (const sig of SIGNATURES) {
    if (bytesMatch(buf, sig)) {
      // WebP extra: verifica bytes 8-11 = "WEBP"
      if (sig.mime === "image/webp") {
        if (buf.length >= 12 &&
            buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) {
          return "image/webp"
        }
        continue
      }
      // HEIC: verifica brand ftyp (heic, heis, heix, hevc, mif1, etc.)
      if (sig.mime === "image/heic") {
        const brand = String.fromCharCode(buf[8], buf[9], buf[10], buf[11])
        if (brand.startsWith("hei") || brand.startsWith("hev") || brand === "mif1" || brand === "msf1") {
          return "image/heic"
        }
        continue
      }
      return sig.mime
    }
  }
  return null
}

/**
 * Valida um arquivo: verifica magic bytes E confirma que o tipo declarado bate.
 * Lança erro descritivo se inválido.
 */
export async function validateFileType(
  file: File,
  allowedTypes: Set<AllowedFileType>
): Promise<{ realMime: AllowedFileType }> {
  // Lê apenas os primeiros 16 bytes (suficiente para todas as assinaturas)
  const slice = file.slice(0, 16)
  const arrayBuf = await slice.arrayBuffer()
  const buf = new Uint8Array(arrayBuf)

  const realMime = detectMimeType(buf)

  if (!realMime) {
    throw new Error("Tipo de arquivo não reconhecido. Envie uma imagem ou PDF válido.")
  }

  if (!allowedTypes.has(realMime)) {
    throw new Error(`Tipo de arquivo não permitido: ${realMime}`)
  }

  // Opcional: alerta se o tipo declarado difere do real (possível tentativa de bypass)
  if (file.type && file.type !== realMime) {
    // Exceção: heic e heif são equivalentes
    const heicTypes = new Set(["image/heic", "image/heif"])
    if (!(heicTypes.has(file.type) && heicTypes.has(realMime))) {
      console.warn(`[upload] MIME declarado (${file.type}) difere do real (${realMime})`)
    }
  }

  return { realMime }
}

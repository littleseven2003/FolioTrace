import type { JSX } from 'react'
import logoUrl from '../../../../assets/brand/logo.svg'

/**
 * A「文稿留痕」独立标志。旁边已有“文脉 / FolioTrace”名称，
 * 因此使用空 alt + aria-hidden，避免屏幕阅读器重复朗读。
 */
export function BrandMark(): JSX.Element {
  return (
    <img
      className="brand-logo"
      src={logoUrl}
      alt=""
      aria-hidden="true"
      width={30}
      height={31}
      draggable={false}
    />
  )
}

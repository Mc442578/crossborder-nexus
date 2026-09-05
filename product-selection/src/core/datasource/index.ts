import { MockDataSource } from './mock'
import { LiveDataSource } from './live'
import type { DataSource } from './types'

export type { DataSource } from './types'

/**
 * 数据源工厂。切换只改 .env 的 VITE_DATA_SOURCE，代码零改动。
 * 也可以做成混合模式：真实的搜索 + mock 的趋势，逐个接口渐进替换。
 */
export function createDataSource(mode = import.meta.env.VITE_DATA_SOURCE): DataSource {
  return mode === 'live' ? new LiveDataSource() : new MockDataSource()
}

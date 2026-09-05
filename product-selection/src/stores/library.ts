import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { SelectionReport } from '@/types/domain'

const STORAGE_KEY = 'product-picker:reports'

/**
 * 选品结论库 —— "沉淀"这一步的落点。
 * 现在落 localStorage；要换后端只改 load/persist 两个函数。
 */
export const useLibraryStore = defineStore('library', () => {
  const reports = ref<SelectionReport[]>(load())

  function save(report: SelectionReport) {
    reports.value = [report, ...reports.value.filter((r) => r.id !== report.id)]
    persist()
  }

  function remove(id: string) {
    reports.value = reports.value.filter((r) => r.id !== id)
    persist()
  }

  function find(id: string) {
    return reports.value.find((r) => r.id === id) ?? null
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reports.value))
    } catch {
      // 超配额或隐私模式，静默降级为内存态
    }
  }

  return { reports, save, remove, find }
})

function load(): SelectionReport[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

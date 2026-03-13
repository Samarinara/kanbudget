export interface ITxn {
  id?: number
  desc: string
  amount: number
  date: string
  img?: string
  note?: string
  recurring?: {
    freq: "daily" | "weekly" | "monthly"
    interval: number
    end?: string
  }
  templateId?: number
}

export interface IColumn {
  id: string
  title: string
  txnIds: number[]
}

export interface ITxnWithCipher extends ITxn {
  cipher?: ArrayBuffer
}

export const COLUMN_IDS = {
  TODAY: "today",
  WEEK: "week",
  MONTH: "month",
  DONE: "done",
} as const

export const DEFAULT_COLUMNS: IColumn[] = [
  { id: COLUMN_IDS.TODAY, title: "Today", txnIds: [] },
  { id: COLUMN_IDS.WEEK, title: "This Week", txnIds: [] },
  { id: COLUMN_IDS.MONTH, title: "This Month", txnIds: [] },
  { id: COLUMN_IDS.DONE, title: "Done", txnIds: [] },
]

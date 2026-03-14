import Dexie, { type EntityTable } from "dexie"

export interface ITxn {
  id?: number
  desc: string
  amount: number
  date: string
  img?: string
  note?: string
  tags?: string[]
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

const db = new Dexie("KanBudgetDB") as Dexie & {
  txns: EntityTable<ITxnWithCipher, "id">
  columns: EntityTable<IColumn, "id">
  templates: EntityTable<{ id?: number; name: string }, "id">
}

db.version(1).stores({
  txns: "++id, date, amount",
  columns: "id",
  templates: "++id, name",
})

export { db }

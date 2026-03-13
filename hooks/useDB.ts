"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { db, type ITxn, type IColumn } from "@/lib/db"
import {
  deriveKey,
  generateSalt,
  saltToBase64,
  base64ToSalt,
} from "@/lib/crypto"

const SALT_KEY = "kanbudget_salt"

interface UseDBReturn {
  isUnlocked: boolean
  isFirstRun: boolean
  unlock: (passphrase: string) => Promise<void>
  txns: ITxn[]
  columns: IColumn[]
  addTxn: (txn: Omit<ITxn, "id">) => Promise<number>
  updateTxn: (id: number, txn: Partial<ITxn>) => Promise<void>
  deleteTxn: (id: number) => Promise<void>
  moveTxnToColumn: (txnId: number, columnId: string) => Promise<void>
}

export function useDB(): UseDBReturn {
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [isFirstRun, setIsFirstRun] = useState(false)
  const keyRef = useRef<CryptoKey | null>(null)

  const txns = useLiveQuery(() => db.txns.toArray()) ?? []
  const columns = useLiveQuery(() => db.columns.toArray()) ?? []

  useEffect(() => {
    const init = async () => {
      const saltStr = localStorage.getItem(SALT_KEY)
      if (!saltStr) {
        setIsFirstRun(true)
      }
    }
    init()
  }, [])

  useEffect(() => {
    const initColumns = async () => {
      const existing = await db.columns.count()
      if (existing === 0) {
        await db.columns.bulkAdd([
          { id: "today", title: "Today", txnIds: [] },
          { id: "week", title: "This Week", txnIds: [] },
          { id: "month", title: "This Month", txnIds: [] },
          { id: "done", title: "Done", txnIds: [] },
        ])
      }
    }
    initColumns()
  }, [])

  const unlock = useCallback(async (passphrase: string) => {
    let salt = localStorage.getItem(SALT_KEY)
    if (!salt) {
      const newSalt = generateSalt()
      salt = saltToBase64(newSalt)
      localStorage.setItem(SALT_KEY, salt)
      setIsFirstRun(false)
    }

    const key = await deriveKey(passphrase, base64ToSalt(salt))
    keyRef.current = key
    setIsUnlocked(true)
  }, [])

  const getColumnForDate = useCallback((date: string): string => {
    const txnDate = new Date(date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const weekEnd = new Date(today)
    weekEnd.setDate(weekEnd.getDate() + 7)

    const monthEnd = new Date(today)
    monthEnd.setMonth(monthEnd.getMonth() + 1)

    if (txnDate >= today && txnDate < weekEnd) {
      return "today"
    } else if (txnDate >= weekEnd && txnDate < monthEnd) {
      return "week"
    } else if (txnDate >= monthEnd) {
      return "month"
    }
    return "today"
  }, [])

  const addTxn = useCallback(
    async (txn: Omit<ITxn, "id">): Promise<number> => {
      const columnId = getColumnForDate(txn.date)

      const column = await db.columns.get(columnId)
      if (!column) return -1

      const id = await db.txns.add(txn as ITxn)
      if (id === undefined) return -1

      await db.columns.update(columnId, {
        txnIds: [...column.txnIds, id],
      })

      return id
    },
    [getColumnForDate]
  )

  const updateTxn = useCallback(async (id: number, txn: Partial<ITxn>) => {
    await db.txns.update(id, txn)
  }, [])

  const deleteTxn = useCallback(async (id: number) => {
    await db.txns.delete(id)
    const cols = await db.columns.toArray()
    for (const col of cols) {
      if (col.txnIds.includes(id)) {
        await db.columns.update(col.id, {
          txnIds: col.txnIds.filter((tid: number) => tid !== id),
        })
      }
    }
  }, [])

  const moveTxnToColumn = useCallback(
    async (txnId: number, targetColumnId: string) => {
      const txn = await db.txns.get(txnId)
      if (!txn) return

      const cols = await db.columns.toArray()
      for (const col of cols) {
        if (col.txnIds.includes(txnId)) {
          await db.columns.update(col.id, {
            txnIds: col.txnIds.filter((id: number) => id !== txnId),
          })
        }
      }

      const targetCol = await db.columns.get(targetColumnId)
      if (!targetCol) return

      await db.columns.update(targetColumnId, {
        txnIds: [...targetCol.txnIds, txnId],
      })

      const newDate =
        targetColumnId === "done"
          ? txn.date
          : new Date().toISOString().split("T")[0]
      await db.txns.update(txnId, { date: newDate })
    },
    []
  )

  return {
    isUnlocked,
    isFirstRun,
    unlock,
    txns,
    columns,
    addTxn,
    updateTxn,
    deleteTxn,
    moveTxnToColumn,
  }
}

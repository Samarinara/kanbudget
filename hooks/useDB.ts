"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { db, type ITxn, type IColumn, type ITxnWithCipher } from "@/lib/db"
import {
  deriveKey,
  generateSalt,
  saltToBase64,
  base64ToSalt,
  encrypt,
  decrypt,
  exportKeyForRecovery,
} from "@/lib/crypto"

const SALT_KEY = "kanbudget_salt"
const TAGS_KEY = "kanbudget_tags"

const DEFAULT_TAGS = ["business", "groceries", "impulse"]

interface UseDBReturn {
  isUnlocked: boolean
  isFirstRun: boolean
  unlock: (passphrase: string) => Promise<void>
  downloadRecoveryKit: () => Promise<void>
  resetPassword: (
    currentPassphrase: string,
    newPassphrase: string
  ) => Promise<void>
  txns: ITxn[]
  columns: IColumn[]
  tags: string[]
  addTxn: (txn: Omit<ITxn, "id">) => Promise<number>
  updateTxn: (id: number, txn: Partial<ITxn>) => Promise<void>
  deleteTxn: (id: number) => Promise<void>
  moveTxnToColumn: (txnId: number, columnId: string) => Promise<void>
  addTag: (tag: string) => void
}

export function useDB(): UseDBReturn {
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [isFirstRun, setIsFirstRun] = useState(false)
  const [tags, setTags] = useState<string[]>(DEFAULT_TAGS)
  const keyRef = useRef<CryptoKey | null>(null)
  const saltRef = useRef<Uint8Array | null>(null)

  const [decryptedTxns, setDecryptedTxns] = useState<ITxn[]>([])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rawTxns = useLiveQuery(() => db.txns.toArray()) ?? []
  const columns = useLiveQuery(() => db.columns.toArray()) ?? []

  useEffect(() => {
    const decryptTxns = async () => {
      if (!keyRef.current) {
        setDecryptedTxns(rawTxns as ITxn[])
        return
      }

      const decrypted: ITxn[] = []
      for (const txn of rawTxns) {
        if (txn.cipher) {
          const decryptedTxn = await decrypt<ITxn>(txn.cipher, keyRef.current!)
          decrypted.push({ ...decryptedTxn, id: txn.id })
        } else {
          decrypted.push(txn as ITxn)
        }
      }
      setDecryptedTxns(decrypted)
    }
    decryptTxns()
  }, [rawTxns, isUnlocked])

  const txns = decryptedTxns

  useEffect(() => {
    const init = async () => {
      const saltStr = localStorage.getItem(SALT_KEY)
      if (!saltStr) {
        setIsFirstRun(true)
      }

      const storedTags = localStorage.getItem(TAGS_KEY)
      if (storedTags) {
        setTags(JSON.parse(storedTags))
      } else {
        localStorage.setItem(TAGS_KEY, JSON.stringify(DEFAULT_TAGS))
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
      saltRef.current = newSalt
      setIsFirstRun(false)
    } else {
      saltRef.current = base64ToSalt(salt)
    }

    const key = await deriveKey(passphrase, saltRef.current)
    keyRef.current = key
    setIsUnlocked(true)
  }, [])

  const downloadRecoveryKit = useCallback(async () => {
    if (!keyRef.current || !saltRef.current) return

    const recoveryKit = await exportKeyForRecovery(
      keyRef.current,
      saltRef.current
    )
    const blob = new Blob([JSON.stringify(recoveryKit, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "kanbudget-recovery.json"
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const resetPassword = useCallback(
    async (currentPassphrase: string, newPassphrase: string) => {
      if (!saltRef.current) throw new Error("No salt found")

      const currentKey = await deriveKey(currentPassphrase, saltRef.current)
      const currentExported = await crypto.subtle.exportKey("jwk", currentKey)
      const existingExported = await crypto.subtle.exportKey(
        "jwk",
        keyRef.current!
      )
      if (
        JSON.stringify(currentExported.k) !== JSON.stringify(existingExported.k)
      ) {
        throw new Error("Invalid current passphrase")
      }

      const newSalt = generateSalt()
      const newKey = await deriveKey(newPassphrase, newSalt)

      const allTxns = await db.txns.toArray()
      const reEncrypted: ITxnWithCipher[] = []

      for (const txn of allTxns) {
        if (txn.cipher) {
          const decrypted = await decrypt<ITxn>(txn.cipher, currentKey)
          const newCipher = await encrypt(decrypted, newKey)
          reEncrypted.push({
            ...decrypted,
            id: txn.id,
            cipher: newCipher,
          } as ITxnWithCipher)
        } else {
          reEncrypted.push(txn as ITxnWithCipher)
        }
      }

      await db.txns.bulkPut(reEncrypted)

      localStorage.setItem(SALT_KEY, saltToBase64(newSalt))
      saltRef.current = newSalt
      keyRef.current = newKey
    },
    []
  )

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

      let cipher: ArrayBuffer | undefined
      if (keyRef.current) {
        cipher = await encrypt(txn, keyRef.current)
      }

      const id = await db.txns.add({ ...txn, cipher } as ITxnWithCipher)
      if (id === undefined) return -1

      await db.columns.update(columnId, {
        txnIds: [...column.txnIds, id],
      })

      return id
    },
    [getColumnForDate]
  )

  const updateTxn = useCallback(async (id: number, txn: Partial<ITxn>) => {
    let cipher: ArrayBuffer | undefined
    if (keyRef.current) {
      const existing = await db.txns.get(id)
      if (existing) {
        const merged = { ...existing, ...txn } as ITxn
        cipher = await encrypt(merged, keyRef.current)
      }
    }
    await db.txns.update(id, { ...txn, cipher } as Partial<ITxnWithCipher>)
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

      let cipher: ArrayBuffer | undefined
      if (keyRef.current && txn.cipher) {
        const decrypted = await decrypt<ITxn>(txn.cipher, keyRef.current)
        const updated = { ...decrypted, date: newDate, id: txn.id }
        cipher = await encrypt(updated, keyRef.current)
      }

      await db.txns.update(txnId, {
        date: newDate,
        cipher,
      } as Partial<ITxnWithCipher>)
    },
    []
  )

  const addTag = useCallback(
    (tag: string) => {
      const normalizedTag = tag.toLowerCase().trim()
      if (normalizedTag && !tags.includes(normalizedTag)) {
        const newTags = [...tags, normalizedTag]
        setTags(newTags)
        localStorage.setItem(TAGS_KEY, JSON.stringify(newTags))
      }
    },
    [tags]
  )

  return {
    isUnlocked,
    isFirstRun,
    unlock,
    downloadRecoveryKit,
    resetPassword,
    txns,
    columns,
    tags,
    addTxn,
    updateTxn,
    deleteTxn,
    moveTxnToColumn,
    addTag,
  }
}

"use client"

import React, { useState, useMemo } from "react"
import {
  DndContext,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  TouchSensor,
  DragEndEvent,
  DragOverlay,
  defaultDropAnimationSideEffects,
  DropAnimation,
  useDroppable,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { useDB } from "@/hooks/useDB"
import { useVisibleColumns } from "@/hooks/useVisibleColumns"
import { BudgetItemDialog } from "@/components/budget-item-dialog"
import { ITxn } from "@/types"
import { IconPlus, IconTrash } from "@tabler/icons-react"

interface TxnItem {
  id: number
  txn: ITxn
}

const PLACEHOLDER_SUFFIX = "-placeholder"

const createPlaceholderItem = (
  columnKey: string
): { id: string; isPlaceholder: boolean } => ({
  id: `${columnKey}${PLACEHOLDER_SUFFIX}`,
  isPlaceholder: true,
})

function SortableItem({
  id,
  txn,
  onEdit,
  onDelete,
}: {
  id: number
  txn: ITxn
  onEdit: (txn: ITxn) => void
  onDelete: (id: number) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: id.toString() })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const isExpense = txn.amount < 0
  const amountColor = isExpense ? "text-red-500" : "text-green-500"
  const amountPrefix = isExpense ? "-" : "+"

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? "opacity-40" : ""}
      {...attributes}
      {...listeners}
    >
      <Card className="pointer-events-none">
        <CardContent className="pointer-events-auto flex flex-col gap-2 p-4">
          <div className="flex items-start justify-between">
            <button
              type="button"
              className="text-left font-medium hover:underline"
              onClick={(e) => {
                e.stopPropagation()
                onEdit(txn)
              }}
            >
              {txn.desc}
            </button>
            <Button
              variant="ghost"
              size="sm"
              className="ml-2 h-auto flex-shrink-0 p-0 text-zinc-400 hover:text-red-400"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(id)
              }}
            >
              <IconTrash size={14} />
            </Button>
          </div>
          <div className={`font-semibold ${amountColor}`}>
            {amountPrefix}${Math.abs(txn.amount).toFixed(2)}
          </div>
          {txn.note && (
            <div className="line-clamp-2 text-xs text-muted-foreground">
              {txn.note}
            </div>
          )}
          {txn.tags && txn.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {txn.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-secondary px-2 py-0.5 text-xs"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          <div className="text-xs text-muted-foreground">{txn.date}</div>
        </CardContent>
      </Card>
    </div>
  )
}

function CalendarColumn({
  date,
  index,
  items,
  isToday,
  onEditItem,
  onDeleteItem,
}: {
  date: Date
  index: number
  items: TxnItem[]
  isToday: boolean
  onEditItem: (txn: ITxn) => void
  onDeleteItem: (id: number) => void
}) {
  const key = dateToKey(date)
  const { setNodeRef, isOver } = useDroppable({ id: key })

  const placeholderItem = useMemo(() => createPlaceholderItem(key), [key])

  const allItems = useMemo(() => {
    if (items.length === 0) {
      return [placeholderItem]
    }
    return [
      ...items.map((i) => ({ ...i, id: i.id.toString() })),
      placeholderItem,
    ]
  }, [items, placeholderItem])

  return (
    <Card
      ref={setNodeRef}
      data-container-id={key}
      className={`${getColumnVisibility(index)} w-[85vw] min-w-[200px] flex-shrink-0 flex-col md:w-[250px] ${
        isToday ? "ring-2 ring-blue-500" : ""
      } ${isOver ? "ring-2 ring-blue-400" : ""}`}
    >
      <CardHeader className="mb-0 flex flex-row items-center justify-between p-4 pb-2">
        <CardTitle
          className={`text-sm font-semibold ${
            isToday
              ? "text-blue-700 dark:text-blue-300"
              : "text-zinc-700 dark:text-zinc-300"
          }`}
        >
          {formatDateHeader(date)}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 p-4 pt-0">
        <SortableContext
          items={allItems.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-2">
            {items.map((item) => (
              <SortableItem
                key={item.id}
                id={item.id}
                txn={item.txn}
                onEdit={onEditItem}
                onDelete={onDeleteItem}
              />
            ))}
          </div>
        </SortableContext>
        {items.length === 0 && (
          <div className="min-h-[60px] text-center text-xs text-zinc-300 dark:text-zinc-600">
            Drop items here
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const dropAnimation: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: { opacity: "0.5" },
    },
  }),
}

function formatDateHeader(date: Date): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ]
  return `${days[date.getDay()]} ${months[date.getMonth()]} ${date.getDate()}`
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  )
}

function dateToKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function getColumnPeriod(endDate: Date, numColumns: number): Date[] {
  const days: Date[] = []
  for (let i = numColumns - 1; i >= 0; i--) {
    const d = new Date(endDate)
    d.setDate(d.getDate() - i)
    days.push(d)
  }
  return days
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function subtractDays(date: Date, days: number): Date {
  return addDays(date, -days)
}

function getColumnVisibility(index: number): string {
  if (index === 0) return "hidden xl:flex"
  if (index === 1) return "hidden lg:flex"
  if (index === 2) return "hidden md:flex"
  if (index === 3) return "hidden sm:flex"
  return "flex"
}

export default function QuoteApp() {
  const today = useMemo(() => new Date(), [])
  const [endDate, setEndDate] = useState<Date>(new Date(today))
  const visibleColumns = useVisibleColumns()

  const { txns, addTxn, updateTxn, deleteTxn, moveTxnToColumn, tags, addTag } =
    useDB()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ITxn | null>(null)

  const [activeId, setActiveId] = useState<string | null>(null)

  const [localState, setLocalState] = useState<Record<string, TxnItem[]>>({})

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const columnPeriod = useMemo(
    () => getColumnPeriod(endDate, visibleColumns),
    [endDate, visibleColumns]
  )
  const columnKeys = useMemo(() => columnPeriod.map(dateToKey), [columnPeriod])

  const baseState = useMemo(() => {
    const txnMap: Record<string, TxnItem[]> = {}
    columnPeriod.forEach((d: Date) => {
      txnMap[dateToKey(d)] = []
    })

    txns.forEach((txn) => {
      if (txn.id !== undefined) {
        const key = txn.date
        if (txnMap[key]) {
          txnMap[key].push({ id: txn.id, txn })
        }
      }
    })

    return txnMap
  }, [txns, columnPeriod])

  const state = Object.keys(localState).length > 0 ? localState : baseState

  const findContainer = (id: string) => {
    if (typeof id === "string" && id.endsWith(PLACEHOLDER_SUFFIX)) {
      return id.replace(PLACEHOLDER_SUFFIX, "")
    }
    for (const key of columnKeys) {
      if (state[key]?.some((item) => item.id.toString() === id)) {
        return key
      }
    }
    return undefined
  }

  function handleDragStart(event: { active: { id: string | number } }) {
    setActiveId(event.active.id as string)
  }

  function handleDragOver(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return

    const activeContainer = findContainer(active.id as string)
    const overContainer =
      findContainer(over.id as string) ||
      (typeof over.id === "string" && columnKeys.includes(over.id)
        ? over.id
        : null)

    if (
      !activeContainer ||
      !overContainer ||
      activeContainer === overContainer
    ) {
      return
    }

    setLocalState((prev) => {
      const sourceColumn = [...prev[activeContainer]]
      const destColumn = [...prev[overContainer]]
      const activeIndex = sourceColumn.findIndex(
        (i) => i.id.toString() === active.id
      )
      const [movedItem] = sourceColumn.splice(activeIndex, 1)

      const placeholderIndex = destColumn.findIndex((i) =>
        i.id.toString().endsWith(PLACEHOLDER_SUFFIX)
      )
      const overIndex = destColumn.findIndex((i) => i.id.toString() === over.id)

      let insertIndex: number
      if (overIndex >= 0 && placeholderIndex !== overIndex) {
        insertIndex = overIndex
      } else if (placeholderIndex >= 0) {
        insertIndex = placeholderIndex
      } else {
        insertIndex = destColumn.length
      }

      destColumn.splice(insertIndex, 0, movedItem)

      return {
        ...prev,
        [activeContainer]: sourceColumn,
        [overContainer]: destColumn,
      }
    })
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const activeContainer = findContainer(active.id as string)
    const overContainer =
      findContainer(over.id as string) ||
      (typeof over.id === "string" && columnKeys.includes(over.id)
        ? over.id
        : null)

    if (!activeContainer || !overContainer) return

    if (activeContainer === overContainer) {
      const activeIndex = state[activeContainer].findIndex(
        (i) => i.id.toString() === active.id
      )
      const overIndex = state[activeContainer].findIndex(
        (i) => i.id.toString() === over.id
      )
      if (activeIndex !== overIndex && overIndex !== -1) {
        setLocalState((prev) => ({
          ...prev,
          [activeContainer]: arrayMove(
            prev[activeContainer],
            activeIndex,
            overIndex
          ),
        }))
      }
    } else {
      const itemId = parseInt(active.id as string)
      await moveTxnToColumn(itemId, overContainer)
    }
  }

  const handleDeleteItem = async (id: number) => {
    await deleteTxn(id)
  }

  const handleAddItem = () => {
    setEditingItem(null)
    setDialogOpen(true)
  }

  const handleEditItem = (txn: ITxn) => {
    setEditingItem(txn)
    setDialogOpen(true)
  }

  const handleSaveItem = async (txnData: Omit<ITxn, "id">) => {
    if (editingItem?.id) {
      await updateTxn(editingItem.id, txnData)
    } else {
      await addTxn(txnData)
    }
  }

  const navigatePrev = () => {
    setEndDate((prev) => subtractDays(prev, visibleColumns))
  }

  const navigateNext = () => {
    setEndDate((prev) => addDays(prev, visibleColumns))
  }

  const goToToday = () => {
    setEndDate(new Date(today))
  }

  const activeItem = activeId
    ? Object.values(state)
        .flat()
        .find((i) => i.id.toString() === activeId)
    : null

  return (
    <div className="p-2 md:p-4">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={navigatePrev}
            className="flex-1 sm:flex-initial"
          >
            ← Prev
          </Button>
          <Button
            variant="secondary"
            onClick={goToToday}
            className="flex-1 sm:flex-initial"
          >
            Today
          </Button>
          <Button
            variant="secondary"
            onClick={navigateNext}
            className="flex-1 sm:flex-initial"
          >
            Next →
          </Button>
        </div>
        <Button onClick={handleAddItem} className="w-full sm:w-auto">
          <IconPlus size={16} className="mr-1" />
          Add Item
        </Button>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex items-start gap-4 pb-2">
          {columnPeriod.map((date: Date, index: number) => {
            const key = dateToKey(date)
            const items = state[key] || []
            const isToday = isSameDay(date, today)
            return (
              <CalendarColumn
                key={key}
                date={date}
                index={index}
                items={items}
                isToday={isToday}
                onEditItem={handleEditItem}
                onDeleteItem={handleDeleteItem}
              />
            )
          })}
        </div>
        <DragOverlay dropAnimation={dropAnimation}>
          {activeItem ? (
            <Card className="shadow-lg">
              <CardContent className="flex items-center justify-between p-4">
                <span>{activeItem.txn.desc}</span>
              </CardContent>
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>

      <BudgetItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSaveItem}
        editItem={editingItem}
        availableTags={tags}
        onAddTag={addTag}
      />
    </div>
  )
}

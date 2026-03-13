"use client"

import React, { useState, useMemo } from "react"
import {
  DndContext,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
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

interface Item {
  id: string
  content: string
  isPlaceholder?: boolean
}

const PLACEHOLDER_SUFFIX = "-placeholder"

const createPlaceholderItem = (columnKey: string): Item => ({
  id: `${columnKey}${PLACEHOLDER_SUFFIX}`,
  content: "",
  isPlaceholder: true,
})

const getItems = (count: number, offset: number = 0): Item[] =>
  Array.from({ length: count }, (_, k) => ({
    id: `item-${k + offset}`,
    content: `item ${k + offset}`,
  }))

function SortableItem({
  id,
  content,
  index,
  onDelete,
}: {
  id: string
  content: string
  index: number
  onDelete: (index: number) => void
}) {
  const isPlaceholder = id.endsWith(PLACEHOLDER_SUFFIX)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  if (isPlaceholder) {
    return (
      <div
        ref={setNodeRef}
        className="min-h-[60px] text-center text-xs text-zinc-300 dark:text-zinc-600"
      >
        Drop items here
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? "opacity-40" : ""}
      {...attributes}
      {...listeners}
    >
      <Card className="pointer-events-none">
        <CardContent className="pointer-events-auto flex items-center justify-between p-4">
          <span>{content}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto p-0 text-zinc-400 hover:text-red-400"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(index)
            }}
          >
            delete
          </Button>
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
  onAddItem,
  onDeleteItem,
}: {
  date: Date
  index: number
  items: Item[]
  isToday: boolean
  onAddItem: () => void
  onDeleteItem: (containerKey: string, itemIndex: number) => void
}) {
  const key = dateToKey(date)
  const { setNodeRef, isOver } = useDroppable({ id: key })

  return (
    <Card
      ref={setNodeRef}
      data-container-id={key}
      className={`${getColumnVisibility(index)} min-h-[400px] w-[250px] flex-shrink-0 flex-col ${
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
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          onClick={onAddItem}
        >
          +
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 p-4 pt-0">
        <SortableContext
          items={items.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-2">
            {items.map((item, itemIndex) => (
              <SortableItem
                key={item.id}
                id={item.id}
                content={item.content}
                index={itemIndex}
                onDelete={(idx) => onDeleteItem(key, idx)}
              />
            ))}
          </div>
        </SortableContext>
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

function getFiveDayPeriod(endDate: Date): Date[] {
  const days: Date[] = []
  for (let i = 4; i >= 0; i--) {
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
  const itemCounter = React.useRef(0)
  const [state, setState] = useState<Record<string, Item[]>>({})
  const [initialized, setInitialized] = useState(false)

  React.useEffect(() => {
    if (initialized) return
    const period = getFiveDayPeriod(today)
    const initial: Record<string, Item[]> = {}
    let counter = 0
    period.forEach((d) => {
      const key = dateToKey(d)
      initial[key] = [...getItems(2, counter), createPlaceholderItem(key)]
      counter += 2
    })
    itemCounter.current = counter
    setState(initial)
    setInitialized(true)
  }, [today, initialized])

  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const fiveDayPeriod = useMemo(() => getFiveDayPeriod(endDate), [endDate])
  const columnKeys = useMemo(
    () => fiveDayPeriod.map(dateToKey),
    [fiveDayPeriod]
  )
  const todayKey = dateToKey(today)

  React.useEffect(() => {
    setState((prev) => {
      const newState = { ...prev }
      let needsUpdate = false
      for (const date of fiveDayPeriod) {
        const key = dateToKey(date)
        if (!newState[key]) {
          newState[key] = [createPlaceholderItem(key)]
          needsUpdate = true
        } else if (
          !newState[key].some((i) => i.id.endsWith(PLACEHOLDER_SUFFIX))
        ) {
          newState[key] = [...newState[key], createPlaceholderItem(key)]
          needsUpdate = true
        }
      }
      return needsUpdate ? newState : prev
    })
  }, [fiveDayPeriod])

  const findContainer = (id: string) => {
    if (typeof id === "string" && id.endsWith(PLACEHOLDER_SUFFIX)) {
      return id.replace(PLACEHOLDER_SUFFIX, "")
    }
    for (const key of columnKeys) {
      if (state[key]?.some((item) => item.id === id)) {
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

    setState((prev) => {
      const sourceColumn = [...prev[activeContainer]]
      const destColumn = [...prev[overContainer]]
      const activeIndex = sourceColumn.findIndex((i) => i.id === active.id)
      const [movedItem] = sourceColumn.splice(activeIndex, 1)

      const placeholderIndex = destColumn.findIndex((i) =>
        i.id.endsWith(PLACEHOLDER_SUFFIX)
      )
      const overIndex = destColumn.findIndex((i) => i.id === over.id)

      let insertIndex: number
      if (overIndex >= 0 && placeholderIndex !== overIndex) {
        insertIndex = overIndex
      } else if (placeholderIndex >= 0) {
        insertIndex = placeholderIndex
      } else {
        insertIndex = destColumn.length
      }

      destColumn.splice(insertIndex, 0, movedItem)

      if (placeholderIndex >= 0 && placeholderIndex !== destColumn.length - 1) {
        const [placeholder] = destColumn.splice(placeholderIndex, 1)
        destColumn.push(placeholder)
      }

      return {
        ...prev,
        [activeContainer]: sourceColumn,
        [overContainer]: destColumn,
      }
    })
  }

  function handleDragEnd(event: DragEndEvent) {
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
        (i) => i.id === active.id
      )
      const overIndex = state[overContainer].findIndex((i) => i.id === over.id)
      if (activeIndex !== overIndex && overIndex !== -1) {
        setState((prev) => ({
          ...prev,
          [activeContainer]: arrayMove(
            prev[activeContainer],
            activeIndex,
            overIndex
          ),
        }))
      }
    } else {
      setState((prev) => {
        const sourceColumn = [...prev[activeContainer]]
        const destColumn = [...prev[overContainer]]
        const activeIndex = sourceColumn.findIndex((i) => i.id === active.id)
        const [movedItem] = sourceColumn.splice(activeIndex, 1)

        const placeholderIndex = destColumn.findIndex((i) =>
          i.id.endsWith(PLACEHOLDER_SUFFIX)
        )
        const overIndex = destColumn.findIndex((i) => i.id === over.id)

        let insertIndex: number
        if (overIndex >= 0 && placeholderIndex !== overIndex) {
          insertIndex = overIndex
        } else if (placeholderIndex >= 0) {
          insertIndex = placeholderIndex
        } else {
          insertIndex = destColumn.length
        }

        destColumn.splice(insertIndex, 0, movedItem)

        if (
          placeholderIndex >= 0 &&
          placeholderIndex !== destColumn.length - 1
        ) {
          const [placeholder] = destColumn.splice(placeholderIndex, 1)
          destColumn.push(placeholder)
        }

        return {
          ...prev,
          [activeContainer]: sourceColumn,
          [overContainer]: destColumn,
        }
      })
    }
  }

  const handleDeleteItem = (containerKey: string, itemIndex: number) => {
    setState((prev) => {
      const column = prev[containerKey] || []
      const item = column[itemIndex]
      if (!item || item.id.endsWith(PLACEHOLDER_SUFFIX)) {
        return prev
      }
      const newColumn = [...column]
      newColumn.splice(itemIndex, 1)
      return { ...prev, [containerKey]: newColumn }
    })
  }

  const handleAddItem = (containerKey: string) => {
    setState((prev) => {
      const column = prev[containerKey] || []
      const placeholderIndex = column.findIndex((i) =>
        i.id.endsWith(PLACEHOLDER_SUFFIX)
      )
      const newItem: Item = {
        id: `item-${itemCounter.current++}`,
        content: `item ${itemCounter.current}`,
      }
      if (placeholderIndex >= 0) {
        const newColumn = [...column]
        newColumn.splice(placeholderIndex, 0, newItem)
        return { ...prev, [containerKey]: newColumn }
      }
      return {
        ...prev,
        [containerKey]: [...column, newItem],
      }
    })
  }

  const navigatePrev = () => {
    setEndDate((prev) => subtractDays(prev, 5))
  }

  const navigateNext = () => {
    setEndDate((prev) => addDays(prev, 5))
  }

  const goToToday = () => {
    setEndDate(new Date(today))
  }

  const activeItem = activeId
    ? Object.values(state)
        .flat()
        .find((i) => i.id === activeId)
    : null

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex gap-2">
          <Button variant="secondary" onClick={navigatePrev}>
            ← Prev
          </Button>
          <Button variant="secondary" onClick={goToToday}>
            Today
          </Button>
          <Button variant="secondary" onClick={navigateNext}>
            Next →
          </Button>
        </div>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 pb-2">
          {fiveDayPeriod.map((date, index) => {
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
                onAddItem={() => handleAddItem(key)}
                onDeleteItem={handleDeleteItem}
              />
            )
          })}
        </div>
        <DragOverlay dropAnimation={dropAnimation}>
          {activeItem ? (
            <Card className="shadow-lg">
              <CardContent className="flex items-center justify-between p-4">
                <span>{activeItem.content}</span>
              </CardContent>
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

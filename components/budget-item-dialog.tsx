"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ITxn } from "@/types"
import { IconPlus, IconMinus } from "@tabler/icons-react"

interface BudgetItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (txn: Omit<ITxn, "id">) => void
  editItem?: ITxn | null
  availableTags: string[]
  onAddTag: (tag: string) => void
  trigger?: React.ReactNode
}

export function BudgetItemDialog({
  open,
  onOpenChange,
  onSave,
  editItem,
  availableTags,
  onAddTag,
  trigger,
}: BudgetItemDialogProps) {
  const today = new Date().toISOString().split("T")[0]

  const [title, setTitle] = useState(editItem?.desc ?? "")
  const [amount, setAmount] = useState(
    editItem ? Math.abs(editItem.amount).toString() : ""
  )
  const [description, setDescription] = useState(editItem?.note ?? "")
  const [date, setDate] = useState(editItem?.date ?? today)
  const [selectedTags, setSelectedTags] = useState<string[]>(
    editItem?.tags ?? []
  )
  const [isExpense, setIsExpense] = useState(
    editItem ? editItem.amount < 0 : true
  )
  const [tagInput, setTagInput] = useState("")

  const handleAmountChange = (value: string) => {
    if (value.startsWith("-")) {
      setIsExpense(true)
      setAmount(value.slice(1))
    } else {
      setAmount(value)
    }
  }

  const toggleExpense = () => {
    setIsExpense(!isExpense)
  }

  const filteredTags = availableTags.filter(
    (tag) =>
      tag.toLowerCase().includes(tagInput.toLowerCase()) &&
      !selectedTags.includes(tag)
  )

  const handleAddTag = () => {
    const normalizedTag = tagInput.toLowerCase().trim()
    if (normalizedTag && !selectedTags.includes(normalizedTag)) {
      const newTags = [...selectedTags, normalizedTag]
      setSelectedTags(newTags)
      if (!availableTags.includes(normalizedTag)) {
        onAddTag(normalizedTag)
      }
    }
    setTagInput("")
  }

  const removeTag = (tagToRemove: string) => {
    setSelectedTags(selectedTags.filter((tag) => tag !== tagToRemove))
  }

  const handleSave = () => {
    if (!title.trim() || !amount) return

    const finalAmount = isExpense
      ? -Math.abs(parseFloat(amount))
      : Math.abs(parseFloat(amount))

    const txn: Omit<ITxn, "id"> = {
      desc: title.trim(),
      amount: finalAmount,
      date: date || today,
      note: description.trim() || undefined,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
    }

    onSave(txn)
    resetForm()
    onOpenChange(false)
  }

  const resetForm = () => {
    setTitle("")
    setAmount("")
    setDescription("")
    setDate(today)
    setSelectedTags([])
    setIsExpense(true)
    setTagInput("")
  }

  const handleCancel = () => {
    resetForm()
    onOpenChange(false)
  }

  const dialogContent = (
    <DialogContent className="w-full max-w-[95vw] sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>{editItem ? "Edit Item" : "Add New Item"}</DialogTitle>
        <DialogDescription>
          {editItem
            ? "Update the details of your budget item."
            : "Add a new expense or income to your budget."}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Grocery shopping"
            className="text-base"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="amount">Amount *</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={isExpense ? "destructive" : "outline"}
              onClick={toggleExpense}
              className="flex-shrink-0 px-3"
            >
              {isExpense ? <IconMinus size={16} /> : <IconPlus size={16} />}
            </Button>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="0.00"
              className={`text-base ${isExpense ? "text-red-500" : "text-green-500"}`}
              inputMode="decimal"
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {isExpense ? "Expense" : "Income"}
          </span>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description..."
          />
        </div>

        <div className="grid gap-2">
          <Label>Tags</Label>
          <div className="mb-2 flex flex-wrap gap-1">
            {selectedTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-xs"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="hover:text-destructive"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Type to search or add..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && tagInput.trim()) {
                  e.preventDefault()
                  handleAddTag()
                }
              }}
            />
            <Button type="button" onClick={handleAddTag} variant="outline">
              Add
            </Button>
          </div>
          {filteredTags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {filteredTags.slice(0, 5).map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="rounded-full bg-secondary px-2 py-1 text-xs hover:bg-accent"
                  onClick={() => {
                    setSelectedTags([...selectedTags, tag])
                    setTagInput("")
                  }}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={handleCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={!title.trim() || !amount}
        >
          {editItem ? "Save Changes" : "Add Item"}
        </Button>
      </DialogFooter>
    </DialogContent>
  )

  if (trigger) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger>{trigger}</DialogTrigger>
        {dialogContent}
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {dialogContent}
    </Dialog>
  )
}

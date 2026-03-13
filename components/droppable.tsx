import { useDroppable } from "@dnd-kit/react"
import { ReactNode } from "react"

interface DroppableProps {
  id: string
  children: ReactNode
}

export default function Droppable({ id, children }: DroppableProps) {
  const { ref } = useDroppable({
    id,
  })

  return (
    <div ref={ref} style={{ width: 300, height: 300 }}>
      {children}
    </div>
  )
}

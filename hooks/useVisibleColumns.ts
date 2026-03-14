import { useState, useEffect } from "react"

const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
}

function getVisibleColumns(width: number): number {
  if (width >= BREAKPOINTS.xl) return 5
  if (width >= BREAKPOINTS.lg) return 4
  if (width >= BREAKPOINTS.md) return 3
  if (width >= BREAKPOINTS.sm) return 2
  return 1
}

export function useVisibleColumns(): number {
  const [columns, setColumns] = useState(5)

  useEffect(() => {
    function handleResize() {
      setColumns(getVisibleColumns(window.innerWidth))
    }

    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  return columns
}

import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'

const Tabs = TabsPrimitive.Root

// Strong ease-out — starts fast, feels responsive (Emil's --ease-out)
const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)'

/**
 * TabsList renders a sliding pill indicator that travels between tabs
 * instead of each tab independently toggling a background.
 *
 * How it works:
 *  - A <span> pill is positioned absolutely inside the list
 *  - A MutationObserver watches for data-state=active changes on children
 *  - On change, the active trigger is measured and the pill is moved via translateX
 *  - Triggers themselves have no background — the pill creates the illusion
 */
const TabsList = React.forwardRef(({ className, children, ...props }, ref) => {
  const listRef    = React.useRef(null)
  const pillRef    = React.useRef(null)
  const [ready, setReady] = React.useState(false)

  const moveIndicator = React.useCallback(() => {
    const list   = listRef.current
    const pill   = pillRef.current
    if (!list || !pill) return

    const active = list.querySelector('[data-state=active]')
    if (!active) return

    const listRect   = list.getBoundingClientRect()
    const activeRect = active.getBoundingClientRect()

    // 4px = p-1 padding on the list
    const x = activeRect.left - listRect.left - 4
    const w = activeRect.width

    pill.style.width     = `${w}px`
    pill.style.transform = `translateX(${x}px)`

    if (!ready) {
      // First render: snap without animation so it doesn't slide in from 0
      pill.style.transition = 'none'
      setReady(true)
      // Re-enable transition on next frame
      requestAnimationFrame(() => {
        if (pillRef.current) {
          pillRef.current.style.transition =
            `transform 220ms ${EASE_OUT}, width 220ms ${EASE_OUT}`
        }
      })
    }
  }, [ready])

  // Run on mount
  React.useLayoutEffect(() => {
    moveIndicator()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-run whenever a trigger's data-state changes
  React.useEffect(() => {
    const list = listRef.current
    if (!list) return

    const observer = new MutationObserver(moveIndicator)
    observer.observe(list, {
      subtree: true,
      attributes: true,
      attributeFilter: ['data-state'],
    })
    return () => observer.disconnect()
  }, [moveIndicator])

  // Merge refs
  const setListRef = React.useCallback(
    (node) => {
      listRef.current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) ref.current = node
    },
    [ref]
  )

  return (
    <TabsPrimitive.List
      ref={setListRef}
      className={cn(
        'relative inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground',
        className
      )}
      {...props}
    >
      {/* Sliding pill — positioned by JS, animated via CSS transform */}
      <span
        ref={pillRef}
        aria-hidden
        className="pointer-events-none absolute left-1 top-1 bottom-1 rounded-md bg-background shadow"
      />
      {children}
    </TabsPrimitive.List>
  )
})
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      // Remove the background/shadow from the trigger itself — the pill handles it
      // Keep only colour and opacity transitions for the text
      'relative z-10 inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium',
      'ring-offset-background',
      'transition-colors duration-150',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      'disabled:pointer-events-none disabled:opacity-50',
      'data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground',
      'data-[state=inactive]:hover:text-foreground/70',
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-4 ring-offset-background',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      // Animate content in when it mounts — 220ms keeps it snappy (Emil: UI < 300ms)
      'animate-fade-up [animation-duration:220ms]',
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }

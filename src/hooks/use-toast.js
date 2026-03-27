import * as React from 'react'

const TOAST_LIMIT = 3
const TOAST_REMOVE_DELAY = 4000

let count = 0
function genId() { count = (count + 1) % Number.MAX_SAFE_INTEGER; return count.toString() }

const toastTimeouts = new Map()
const listeners = []
let memoryState = { toasts: [] }

function dispatch(action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach(l => l(memoryState))
}

function reducer(state, action) {
  switch (action.type) {
    case 'ADD_TOAST':
      return { ...state, toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT) }
    case 'UPDATE_TOAST':
      return { ...state, toasts: state.toasts.map(t => t.id === action.toast.id ? { ...t, ...action.toast } : t) }
    case 'DISMISS_TOAST': {
      const { toastId } = action
      if (toastId) addRemoveTimeout(toastId)
      else state.toasts.forEach(t => addRemoveTimeout(t.id))
      return { ...state, toasts: state.toasts.map(t => (!toastId || t.id === toastId) ? { ...t, open: false } : t) }
    }
    case 'REMOVE_TOAST':
      return { ...state, toasts: action.toastId === undefined ? [] : state.toasts.filter(t => t.id !== action.toastId) }
  }
}

function addRemoveTimeout(toastId) {
  if (toastTimeouts.has(toastId)) return
  const timeout = setTimeout(() => { toastTimeouts.delete(toastId); dispatch({ type: 'REMOVE_TOAST', toastId }) }, TOAST_REMOVE_DELAY)
  toastTimeouts.set(toastId, timeout)
}

function toast({ ...props }) {
  const id = genId()
  const update  = (p) => dispatch({ type: 'UPDATE_TOAST', toast: { ...p, id } })
  const dismiss = ()  => dispatch({ type: 'DISMISS_TOAST', toastId: id })
  dispatch({ type: 'ADD_TOAST', toast: { ...props, id, open: true, onOpenChange: (open) => { if (!open) dismiss() } } })
  return { id, dismiss, update }
}

function useToast() {
  const [state, setState] = React.useState(memoryState)
  React.useEffect(() => {
    listeners.push(setState)
    return () => { const i = listeners.indexOf(setState); if (i > -1) listeners.splice(i, 1) }
  }, [state])
  return { ...state, toast, dismiss: (id) => dispatch({ type: 'DISMISS_TOAST', toastId: id }) }
}

export { useToast, toast }

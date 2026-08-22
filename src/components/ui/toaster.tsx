"use client"

import { AlertCircle, CheckCircle2, Info } from "lucide-react"

import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

/** A leading icon makes the outcome readable before the copy is. */
const variantIcon = {
  destructive: AlertCircle,
  success: CheckCircle2,
  default: Info,
} as const

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        const Icon =
          variantIcon[(props.variant as keyof typeof variantIcon) ?? "default"] ??
          Info

        return (
          <Toast key={id} {...props}>
            <Icon className="mt-0.5 h-4 w-4 shrink-0 opacity-90" />
            <div className="grid flex-1 gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}

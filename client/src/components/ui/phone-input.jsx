import * as React from "react"
import PhoneInputBase from "react-phone-number-input"
import "react-phone-number-input/style.css"

import { cn } from "@/lib/utils"

function PhoneInput({ className, ...props }) {
  return (
    <PhoneInputBase
      data-slot="input"
      className={cn(
        "flex h-8 w-full min-w-0 items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors",
        "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        "has-[input[aria-invalid=true]]:border-destructive has-[input[aria-invalid=true]]:ring-3 has-[input[aria-invalid=true]]:ring-destructive/20",
        "has-[input:disabled]:pointer-events-none has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-50",
        "md:text-sm dark:bg-input/30 dark:has-[input[aria-invalid=true]]:border-destructive/50 dark:has-[input[aria-invalid=true]]:ring-destructive/40",
        "[&_.PhoneInputInput]:min-w-0 [&_.PhoneInputInput]:flex-1 [&_.PhoneInputInput]:border-0 [&_.PhoneInputInput]:bg-transparent [&_.PhoneInputInput]:p-0 [&_.PhoneInputInput]:outline-none [&_.PhoneInputInput]:placeholder:text-muted-foreground",
        className
      )}
      {...props} />
  )
}

export { PhoneInput }
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import * as zod from "zod";
import { Navigate } from "react-router";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import api from "@/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import useUserStore from "@/store/user";
import { formatDateTime } from "@/utils/date";

const STAFF_ROLES = new Set(["EMPLOYEE", "WARDEN"]);

function createCapacitySchema(slots) {
  const baseShape = {
    startDateTime: zod.string()
      .min(1, "Choose a start date and time.")
      .refine((val) => !Number.isNaN(new Date(val).getTime()), "Choose a valid start date and time."),
    endDateTime: zod.string()
      .min(1, "Choose an end date and time.")
      .refine((val) => !Number.isNaN(new Date(val).getTime()), "Choose a valid end date and time."),
  };

  const manualSchema = zod.object({
    ...baseShape,
    mode: zod.literal("manual"),
    tables: zod.array(
      zod.object({
        tableNumber: zod.coerce.number().int().positive("Enter a positive table number."),
        totalSeats: zod.coerce.number().int().positive("Enter a positive seat count."),
      })
    ).min(1, "Add at least one table."),
  });

  const copySchema = zod.object({
    ...baseShape,
    mode: zod.literal("copy"),
    copyFromTimeSlotId: zod.string().min(1, "Choose an existing slot to copy its table setup."),
  });

  return zod.discriminatedUnion("mode", [manualSchema, copySchema])
    .superRefine((values, context) => {
      const startTime = new Date(values.startDateTime).getTime();
      const endTime = new Date(values.endDateTime).getTime();

      if (!Number.isNaN(startTime) && !Number.isNaN(endTime) && endTime <= startTime) {
        context.addIssue({ code: "custom", path: ["endDateTime"], message: "End must be after the start." });
      }

      if (!Number.isNaN(startTime) && slots.some((slot) => new Date(slot.startDateTime).getTime() === startTime)) {
        context.addIssue({ code: "custom", path: ["startDateTime"], message: "A slot already starts at this time." });
      }

      if (values.mode === "manual") {
        const usedTableNumbers = new Set();
        values.tables.forEach((table, index) => {
          if (usedTableNumbers.has(table.tableNumber)) {
            context.addIssue({ code: "custom", path: ["tables", index, "tableNumber"], message: "Table numbers must be unique." });
          }
          usedTableNumbers.add(table.tableNumber);
        });
      } else if (values.mode === "copy") {
        const sourceExists = slots.some((slot) => String(slot.timeSlotId) === values.copyFromTimeSlotId);
        if (!sourceExists) {
          context.addIssue({ code: "custom", path: ["copyFromTimeSlotId"], message: "Choose an existing slot to copy its table setup." });
        }
      }
    });
}

function PageCapacity() {
  const user = useUserStore((state) => state.user);
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [slotsError, setSlotsError] = useState(false);
  const requestId = useRef(0);

  const loadSlots = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setSlotsLoading(true);
    setSlotsError(false);

    try {
      const response = await api.timeslots.getAll();
      if (currentRequest !== requestId.current) return;

      if (response?.success) {
        setSlots(response.data);
      } else {
        setSlotsError(true);
      }
    } catch {
      if (currentRequest === requestId.current) setSlotsError(true);
    } finally {
      if (currentRequest === requestId.current) setSlotsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSlots();
    return () => { requestId.current += 1; };
  }, [loadSlots]);

  const sortedSlots = useMemo(() => [...slots].sort(
    (a, b) => new Date(b.startDateTime).getTime() - new Date(a.startDateTime).getTime()
  ), [slots]);

  const formSchema = useMemo(() => createCapacitySchema(slots), [slots]);

  const form = useForm({
    resolver: zodResolver(formSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      startDateTime: "",
      endDateTime: "",
      mode: "manual",
      copyFromTimeSlotId: "",
      tables: [{ tableNumber: "1", totalSeats: "" }],
    },
  });

  const { control, handleSubmit, setValue, clearErrors, reset, formState } = form;
  const mode = useWatch({ control, name: "mode" }) ?? "manual";
  const tablesValue = useWatch({ control, name: "tables" }) ?? [];
  const { fields, append, remove } = useFieldArray({ control, name: "tables" });

  const tableCapacity = tablesValue.reduce((sum, table) => sum + (Number(table.totalSeats) || 0), 0);

  if (!user) return <Navigate to="/auth/login" replace />;
  if (!STAFF_ROLES.has(user.role)) return <Navigate to="/" replace />;

  async function handleCreateSlot(values) {
    const response = await api.timeslots.create({
      startDateTime: new Date(values.startDateTime).toISOString(),
      endDateTime: new Date(values.endDateTime).toISOString(),
      ...(values.mode === "copy"
        ? { copyFromTimeSlotId: Number(values.copyFromTimeSlotId) }
        : { tables: values.tables }),
    });

    if (response?.success) {
      toast.success("Time slot capacity saved.");

      reset({
        ...form.getValues(),
        startDateTime: "",
        endDateTime: "",
      });

      await loadSlots();
    }
  }

  return (
    <section className="mx-auto max-w-3xl py-8">
      <Card className="border-white/70 bg-card/95 shadow-xl shadow-black/5 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>New service slot</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(handleCreateSlot)}>
            <fieldset disabled={formState.isSubmitting} className="contents">
              <FieldGroup>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Controller
                    name="startDateTime"
                    control={control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="capacity-start">From</FieldLabel>
                        <Input {...field} id="capacity-start" type="datetime-local" step="60"
                          aria-invalid={fieldState.invalid} />
                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                      </Field>
                    )}
                  />
                  <Controller
                    name="endDateTime"
                    control={control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="capacity-end">To</FieldLabel>
                        <Input {...field} id="capacity-end" type="datetime-local" step="60"
                          aria-invalid={fieldState.invalid} />
                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                      </Field>
                    )}
                  />
                </div>

                <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
                  <div>
                    <p className="font-medium">Table setup</p>
                    <p className="mt-1 text-sm text-muted-foreground">Create a new set or copy one from a previous slot.</p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button type="button" variant={mode === "manual" ? "default" : "outline"} className="justify-start"
                      onClick={() => {
                        setValue("mode", "manual", { shouldDirty: true });
                        clearErrors(["tables", "copyFromTimeSlotId"]);
                      }}>
                      Enter tables
                    </Button>
                    <Button type="button" variant={mode === "copy" ? "default" : "outline"} className="justify-start"
                      onClick={() => {
                        setValue("mode", "copy", { shouldDirty: true });
                        clearErrors("tables");
                      }}>
                      Copy a setup
                    </Button>
                  </div>

                  {mode === "manual" ? (
                    <div className="space-y-3">
                      {fields.map((table, index) => (
                        <div key={table.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-3 rounded-lg border bg-background p-3">
                          <Controller
                            name={`tables.${index}.tableNumber`}
                            control={control}
                            render={({ field, fieldState }) => (
                              <Field data-invalid={fieldState.invalid}>
                                <FieldLabel htmlFor={`table-number-${table.id}`}>Table number</FieldLabel>
                                <Input {...field} id={`table-number-${table.id}`} type="number" min="1" step="1" inputMode="numeric"
                                  placeholder={`${index + 1}`} aria-invalid={fieldState.invalid} />
                                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                              </Field>
                            )}
                          />
                          <Controller
                            name={`tables.${index}.totalSeats`}
                            control={control}
                            render={({ field, fieldState }) => (
                              <Field data-invalid={fieldState.invalid}>
                                <FieldLabel htmlFor={`table-seats-${table.id}`}>Seats</FieldLabel>
                                <Input {...field} id={`table-seats-${table.id}`} type="number" min="1" step="1" inputMode="numeric"
                                  placeholder="e.g. 4" aria-invalid={fieldState.invalid} />
                                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                              </Field>
                            )}
                          />
                          <Button type="button" variant="ghost" size="icon"
                            disabled={fields.length === 1} onClick={() => remove(index)}>
                            <Trash2 className="text-muted-foreground" />
                          </Button>
                        </div>
                      ))}
                      {(formState.errors.tables?.message || formState.errors.tables?.root?.message) && (
                        <FieldError>{formState.errors.tables.message || formState.errors.tables.root.message}</FieldError>
                      )}
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <Button type="button" variant="outline" onClick={() => append({ tableNumber: "", totalSeats: "" })}>
                          <Plus />Add table
                        </Button>
                        <p className="text-sm text-muted-foreground">
                          {fields.length} {fields.length === 1 ? "table" : "tables"} · {tableCapacity} {tableCapacity === 1 ? "seat" : "seats"} total
                        </p>
                      </div>
                    </div>
                  ) : (
                    <Controller
                      name="copyFromTimeSlotId"
                      control={control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor="copy-slot">Copy tables from</FieldLabel>
                          <select {...field} id="copy-slot"
                            disabled={slotsLoading || slotsError || sortedSlots.length === 0}
                            aria-invalid={fieldState.invalid}
                            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50">
                            <option value="">Choose a previous slot</option>
                            {sortedSlots.map((slot) => (
                              <option key={slot.timeSlotId} value={slot.timeSlotId}>
                                {formatDateTime(slot.startDateTime)} – {formatDateTime(slot.endDateTime)}
                              </option>
                            ))}
                          </select>
                          {slotsLoading && <p className="text-sm text-muted-foreground">Loading slots…</p>}
                          {slotsError && (
                            <div className="flex flex-wrap items-center gap-3">
                              <p className="text-sm text-destructive">Existing slots could not be loaded.</p>
                              <Button type="button" variant="outline" size="sm" onClick={loadSlots}>Try again</Button>
                            </div>
                          )}
                          {!slotsLoading && !slotsError && sortedSlots.length === 0 && (
                            <p className="text-sm text-muted-foreground">Create a slot with tables first; you can reuse its setup later.</p>
                          )}
                          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                        </Field>
                      )}
                    />
                  )}
                </div>

                <Button type="submit" size="lg" className="w-full rounded-xl" disabled={formState.isSubmitting || slotsLoading}>
                  {formState.isSubmitting ? "Saving slot…" : "Save slot capacity"}
                </Button>
              </FieldGroup>
            </fieldset>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}

export default PageCapacity;
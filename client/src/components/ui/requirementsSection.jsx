import { Plus, Trash2, Users } from "lucide-react";
import { Controller, useFieldArray } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

function RequirementsSection({ control, emptyItem, errors, addDisabled, disabled }) {
  const { fields, append, remove } = useFieldArray({ control, name: "dietaryRequirements" });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <FieldLabel>Dietary requirements</FieldLabel>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Add dietary requirement"
          disabled={addDisabled || disabled}
          onClick={() => append({ ...emptyItem })}
        >
          <Plus />
        </Button>
      </div>

      {fields.map((item, index) => (
        <div key={item.id} className="flex flex-wrap items-start gap-2">
          <Controller
            name={`dietaryRequirements.${index}.allergies`}
            control={control}
            render={({ field }) => (
              <Field orientation="horizontal" className="h-8 w-auto shrink-0">
                <Checkbox
                  id={`requirement-allergies-${index}`}
                  checked={Boolean(field.value)}
                  disabled={disabled}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                />
                <FieldLabel htmlFor={`requirement-allergies-${index}`}>Allergies</FieldLabel>
              </Field>
            )}
          />

          <Controller
            name={`dietaryRequirements.${index}.people`}
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="w-28 shrink-0">
                <div className="relative">
                  <Users aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    {...field}
                    id={`requirement-people-${index}`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    value={field.value ?? ""}
                    disabled={disabled}
                    className="pl-10"
                    aria-label="Number of people"
                    onChange={(event) => field.onChange(event.target.value === "" ? "" : Number(event.target.value))}
                    aria-invalid={fieldState.invalid}
                  />
                </div>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />

          <Controller
            name={`dietaryRequirements.${index}.description`}
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="min-w-40 flex-1">
                <Input
                  {...field}
                  id={`requirement-description-${index}`}
                  type="text"
                  placeholder="e.g. vegetarian, shellfish allergy"
                  disabled={disabled}
                  aria-label="Requirement description"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Remove dietary requirement"
            disabled={disabled}
            onClick={() => remove(index)}
          >
            <Trash2 className="text-muted-foreground" />
          </Button>
        </div>
      ))}

      {errors.length > 0 && <FieldError errors={errors.map((message) => ({ message }))} />}
    </div>
  );
}

export default RequirementsSection;

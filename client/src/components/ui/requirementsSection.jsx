import { Plus, Trash2, Users } from "lucide-react";
import { Controller, useFieldArray, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

function RequirementsSection({ control, trigger, toggleName, listName, title, placeholder, idPrefix, emptyItem, error, disabled }) {
  const { fields, append, remove } = useFieldArray({ control, name: listName });
  const enabled = useWatch({ control, name: toggleName });

  return (
    <div className="flex flex-col gap-3">
      <Controller
        name={toggleName}
        control={control}
        render={({ field }) => (
          <Field orientation="horizontal">
            <Checkbox
              id={`${idPrefix}-toggle`}
              checked={Boolean(field.value)}
              disabled={disabled}
              onCheckedChange={(checked) => {
                field.onChange(checked === true);
                if (checked !== true) trigger(listName);
              }}
            />
            <FieldLabel htmlFor={`${idPrefix}-toggle`}>{title}</FieldLabel>
          </Field>
        )}
      />

      {fields.map((item, index) => (
        <div key={item.id} className="flex items-start gap-2">
          <Controller
            name={`${listName}.${index}.people`}
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="w-28 shrink-0">
                <div className="relative">
                  <Users aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    {...field}
                    id={`${idPrefix}-people-${index}`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    value={field.value ?? ""}
                    disabled={!enabled || disabled}
                    className="pl-10"
                    aria-label={`${title}: number of people`}
                    onChange={(event) => field.onChange(event.target.value === "" ? "" : Number(event.target.value))}
                    aria-invalid={fieldState.invalid}
                  />
                </div>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />

          <Controller
            name={`${listName}.${index}.name`}
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="min-w-0 flex-1">
                <Input
                  {...field}
                  id={`${idPrefix}-name-${index}`}
                  type="text"
                  placeholder={placeholder}
                  disabled={!enabled || disabled}
                  aria-label={`${title}: description`}
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
            aria-label={`Remove row: ${title}`}
            disabled={fields.length === 1 || !enabled || disabled}
            onClick={() => remove(index)}
          >
            <Trash2 className="text-muted-foreground" />
          </Button>
        </div>
      ))}

      {error && <FieldError>{error}</FieldError>}

      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Add another: ${title}`}
          disabled={!enabled || disabled}
          onClick={() => append({ ...emptyItem })}
        >
          <Plus />
        </Button>
      </div>
    </div>
  );
}

export default RequirementsSection;

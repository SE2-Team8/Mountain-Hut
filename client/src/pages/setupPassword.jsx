import api from "@/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import * as zod from "zod";

const formSchema = zod.object({
  password: zod.string()
    .refine((password) => password.trim().length > 0, "Enter a password")
    .refine((password) => {
      const presentationSequences = password.match(/[^\uFE0E\uFE0F][\uFE0E\uFE0F]/g)?.length ?? 0;
      const length = Array.from(password).length - presentationSequences;
      return length >= 8 && length <= 32;
    }, "Password must be 8 to 32 characters"),
  confirmPassword: zod.string().min(1, "Confirm your password"),
}).refine(({ password, confirmPassword }) => password === confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

function PageSetupPassword() {
  const { hash } = useLocation();
  const token = new URLSearchParams(hash.slice(1)).get("token");
  const hasToken = /^[0-9a-f]{64}$/.test(token ?? "");
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  async function setPassword({ password }) {
    const response = await api.auth.setupPassword({ token, password });
    if (response?.success) {
      toast.success(response.message);
      navigate("/auth/login", { replace: true });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set up your password</CardTitle>
        <CardDescription>
          {hasToken ? "Choose a password with 8 to 32 characters." : "Open the setup link from your Mountain Hut email."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasToken && (
          <form noValidate onSubmit={handleSubmit(setPassword)}>
            <FieldGroup>
              <Field data-invalid={Boolean(errors.password)}>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input id="password" type="password" autoComplete="new-password" required
                  aria-invalid={Boolean(errors.password)} {...register("password", { deps: "confirmPassword" })} />
                <FieldError errors={[errors.password]} />
              </Field>
              <Field data-invalid={Boolean(errors.confirmPassword)}>
                <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
                <Input id="confirmPassword" type="password" autoComplete="new-password" required
                  aria-invalid={Boolean(errors.confirmPassword)} {...register("confirmPassword")} />
                <FieldError errors={[errors.confirmPassword]} />
              </Field>
              <Button type="submit" disabled={isSubmitting}>Save password</Button>
            </FieldGroup>
          </form>
        )}
        <div className="flex flex-row justify-center items-center">
          <Button variant="link" asChild className="mt-3 px-0">
            <Link to="/auth/login">Back to login</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default PageSetupPassword;

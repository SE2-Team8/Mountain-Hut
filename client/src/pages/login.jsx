import api from "@/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Controller, useForm } from "react-hook-form";
import { useNavigate, useSearchParams, Link } from "react-router";
import * as zod from 'zod';
import { zodResolver } from "@hookform/resolvers/zod";
import "../assets/css/auth.css"
import useUserStore from "@/store/user";

function PageLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setUser =  useUserStore((state)=>
      state.setUser
    )
  const formSchema = zod.object({
    //username: zod.string().nonempty("Email is required"),
    username: zod.email("Invalid Email"),
    password: zod.string().nonempty("Password is required")
  });
  const form = useForm({
    resolver: zodResolver(formSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      username: '',
      password: ''
    }
  });
 
  async function handleLogin(data) {
    const response = await api.auth.login(data);
    if (response?.success ){
      setUser(response.data);
      const targetPage = getSafeReturnTo(searchParams.get("returnTo"));
      navigate(targetPage, { replace: true, viewTransition: true });
    }
  }

  return (
    <Card>
      <CardHeader>
		
        <CardTitle>Login to your account</CardTitle>
        <CardDescription>
          Enter your email below to login to your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(handleLogin)}>
          <FieldGroup>

            <Controller
              name='username'
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>

                  <FieldLabel htmlFor='email'>Email</FieldLabel>
                  <Input
                    {...field}
                    id='email'
                    type='text'
                    placeholder="Email"
                    aria-invalid={fieldState.invalid} />
                  {
                    fieldState.invalid
                    &&
                    <FieldError errors={[fieldState.error]} />
                  }

                </Field>
              )} />
            <Controller
              name='password'
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>

                  <FieldLabel htmlFor='password'>Password</FieldLabel>
                  <Input
                    {...field}
                    id='password'
                    type='password'
                    aria-invalid={fieldState.invalid} />
                  {
                    fieldState.invalid
                    &&
                    <FieldError errors={[fieldState.error]} />
                  }

                </Field>
              )} />
            <Field>
              <Button type="submit">Login</Button>
              <Link className = 'link' to = "/auth/signup">Sign Up</Link> 
            </Field>
            
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}

function getSafeReturnTo(returnTo) {
  if (!returnTo?.startsWith("/") || returnTo.startsWith("//")) return "/";

  try {
    const target = new URL(returnTo, window.location.origin);

    if (target.origin !== window.location.origin) return "/";
    
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "/";
  }
}

export default PageLogin;

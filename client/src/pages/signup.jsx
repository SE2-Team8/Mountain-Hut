import api from "@/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isValidPhoneNumber } from "react-phone-number-input";
import { PhoneInput } from "@/components/ui/phone-input"
import "react-phone-number-input/style.css";
import { Field, FieldError, FieldGroup, FieldLabel, MandatoryLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Controller, useForm} from "react-hook-form";
import { useNavigate } from "react-router";
import * as zod from 'zod';
import { zodResolver } from "@hookform/resolvers/zod";
import "../assets/css/auth.css"
import useUserStore from "@/store/user";

function PageSignUp() {
  const navigate = useNavigate();
  const formSchema = zod.object({
    email: zod.email('Invalid Email'),
    fullName: zod.string().min(1, 'Full name is required'),
    phone: zod
      .string()
      .min(1, 'Phone number is required')
      .refine((v) => isValidPhoneNumber(v), 'Invalid phone number'),
    emergencyPhone: zod
      .string()
      .optional()
      .refine((v) => !v || isValidPhoneNumber(v), 'Invalid phone number'),
    notes: zod.string().optional(),
    password: zod.string().min(1, 'Password is required'),
    repeatPassword: zod.string().min(1, 'Repeat your password'),
  })
  .refine((data) => data.password === data.repeatPassword, {
    message: 'Passwords do not match',
    path: ['repeatPassword'],
  });
  const form = useForm({
    resolver: zodResolver(formSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      email: '',
      fullName: '',
      phone: '',
      emergencyPhone: '',
      notes: '',
      password: '',
      repeatPassword: '',
    }
  });

  async function handleSignUp(data) {
    const response = await api.auth.signUp(data);
    if (response.success) {

      navigate('/', {viewTransition: true})
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign Up to Mountain Hut</CardTitle>
        <CardDescription>
          Enter your email below to sign up
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(handleSignUp)}>
          <FieldGroup>

            <Controller
              name='email'
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>

                  <MandatoryLabel htmlFor='email'>Email</MandatoryLabel>
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
              name='fullName'
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>

                  <MandatoryLabel htmlFor='fullName'> Full Name</MandatoryLabel>
                  <Input
                    {...field}
                    id='fullName'
                    type='text'
                    placeholder='John Doe'
                    aria-invalid={fieldState.invalid} />
                  {
                    fieldState.invalid
                    &&
                    <FieldError errors={[fieldState.error]} />
                  }

                </Field>
            )} />
            <Controller
              name='phone'
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>

                  <MandatoryLabel htmlFor='phone'>Phone Number </MandatoryLabel>
                  <PhoneInput
                    {...field}
                    onChange = {(value) => field.onChange (value ?? '')}
                    id='phone'
                    international
                    defaultCountry = 'IT'
                    aria-invalid={fieldState.invalid} />
                  {
                    fieldState.invalid
                    &&
                    <FieldError errors={[fieldState.error]} />
                  }

                </Field>
            )} />
            <Controller
              name='emergencyPhone'
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>

                  <FieldLabel htmlFor='emergencyPhone'>Emergency Phone Number</FieldLabel>
                  <PhoneInput
                    {...field}
                    id='emergencyPhone'
                    onChange = {(value) => field.onChange (value ?? '')}
                    international
                    defaultCountry = 'IT'
                    aria-invalid={fieldState.invalid} />
                  {
                    fieldState.invalid
                    &&
                    <FieldError errors={[fieldState.error]} />
                  }

                </Field>
            )} />
            <Controller
              name='notes'
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>

                  <FieldLabel htmlFor='notes'>Notes</FieldLabel>
                  <Textarea
                    {...field}
                    id='notes'
                    type='textarea'
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

                  <MandatoryLabel htmlFor='password'>Password</MandatoryLabel>
                  <Input
                    {...field}
                    id='password'
                    type='password'
                    placeholder="Password"
                    onChange = {(e)=>{
                        field.onChange(e)
                        if (form.getValues('repeatPassword'))
                            form.trigger('repeatPassword')
                    }}
                    aria-invalid={fieldState.invalid} />
                  {
                    fieldState.invalid
                    &&
                    <FieldError errors={[fieldState.error]} />
                  }

                </Field>
              )} />
            <Controller
              name='repeatPassword'
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>

                  <MandatoryLabel htmlFor='repeatPassword'>Repeat Password</MandatoryLabel>
                  <Input
                    {...field}
                    id='repeatPassword'
                    type='password'
                    placeholder="Repeat Password"
                    onChange = {(e)=>{
                        field.onChange(e)
                        form.trigger('repeatPassword')
                    }}
                    aria-invalid={fieldState.invalid} />
                  {
                    fieldState.invalid
                    &&
                    <FieldError errors={[fieldState.error]} />
                  }

                </Field>
              )} />

            <Field>
              <Button type="submit">Sign Up</Button>
            </Field>
            
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
export default PageSignUp;
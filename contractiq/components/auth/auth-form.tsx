'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { authSchema, type AuthFormValues } from '@/lib/utils/validation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface AuthFormProps {
  mode: 'login' | 'signup'
  onSuccess: () => void
}

export function AuthForm({ mode, onSuccess }: AuthFormProps) {
  const { signIn, signUp } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AuthFormValues>({
    resolver: zodResolver(authSchema),
  })

  const onSubmit = async (values: AuthFormValues) => {
    setFormError(null)
    const action = mode === 'signup' ? signUp : signIn
    const { error } = await action(values.email, values.password)

    if (error) {
      if (mode === 'signup' && /already registered|already exists/i.test(error)) {
        setFormError('An account with this email already exists')
      } else if (mode === 'login' && /invalid login credentials/i.test(error)) {
        setFormError('Invalid email or password')
      } else {
        setFormError(error)
      }
      return
    }

    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-md">
      <div className="flex flex-col gap-xs">
        <label htmlFor="email" className="text-body font-medium text-text-secondary">
          Email
        </label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          error={errors.email?.message}
          {...register('email')}
        />
        {errors.email && (
          <p className="text-small text-error">{errors.email.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-xs">
        <label htmlFor="password" className="text-body font-medium text-text-secondary">
          Password
        </label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            placeholder="At least 8 characters"
            error={errors.password?.message}
            className="pr-11"
            {...register('password')}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-md top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <EyeOff size={18} strokeWidth={1.5} />
            ) : (
              <Eye size={18} strokeWidth={1.5} />
            )}
          </button>
        </div>
        {errors.password && (
          <p className="text-small text-error">{errors.password.message}</p>
        )}
      </div>

      {formError && (
        <p role="alert" className="rounded-input bg-error/10 px-md py-sm text-small text-error">
          {formError}
        </p>
      )}

      <Button type="submit" isLoading={isSubmitting} className="mt-xs w-full">
        {mode === 'signup' ? 'Create account' : 'Sign in'}
      </Button>
    </form>
  )
}

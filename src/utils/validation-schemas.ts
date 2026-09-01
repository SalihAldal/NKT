import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().trim().min(3, 'Kullanıcı adı en az 3 karakter').max(24, 'Kullanıcı adı en fazla 24 karakter'),
  password: z.string().min(8, 'Şifre en az 8 karakter olmalı'),
});

export const registerSchema = z.object({
  username: z.string().trim().min(3, 'Kullanıcı adı en az 3 karakter').max(24, 'Kullanıcı adı en fazla 24 karakter').regex(/^[a-zA-Z0-9_]+$/, 'Sadece harf, rakam ve _'),
  password: z.string().min(8, 'Şifre en az 8 karakter olmalı'),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Tarih formatı YYYY-MM-DD olmalı'),
});

export const questionSchema = z.object({
  text: z.string().min(3, 'Soru en az 3 karakter'),
  type: z.enum(['multiple_choice', 'open_ended']),
});

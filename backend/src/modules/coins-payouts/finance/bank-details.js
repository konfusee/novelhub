import { z } from 'zod'

export const bankDetailsSchema = z
  .object({
    bankName: z.string().trim().min(1).max(120),
    accountNumber: z
      .string()
      .trim()
      .regex(/^\d{6,34}$/),
    accountHolder: z.string().trim().min(1).max(120),
  })
  .strict()

export function validBankDetails(bank) {
  return bankDetailsSchema.safeParse(bank).success
}

export function maskedBankDetails(bank) {
  if (!bank) return null
  return {
    bankName: bank.bankName ?? '',
    accountNumber: bank.accountNumber ? `••••${bank.accountNumber.slice(-4)}` : '',
    accountHolder: bank.accountHolder ?? '',
  }
}

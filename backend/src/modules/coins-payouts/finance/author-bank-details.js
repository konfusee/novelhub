import { Account, AuditEvent } from '../../../models/index.js'
import { HttpError } from '../../../middleware/errors.js'
import { ownerWrite } from '../../reading-community/reading/owner-write.js'

export const BANK_ACCOUNT_NUMBER_PATTERN = /^\d{6,34}$/

function bankDetailsView(details) {
  if (!details) return null

  return {
    bankName: details.bankName,
    accountNumber:
      details.accountNumber && details.accountNumber.length > 4
        ? `••••${details.accountNumber.slice(-4)}`
        : details.accountNumber,
    accountHolder: details.accountHolder,
  }
}

export async function getAuthorBankDetails(accountId) {
  const account = await Account.findOne({
    _id: accountId,
    status: 'active',
  })
    .select('+bankDetails')
    .lean()

  if (!account) {
    throw new HttpError(404, 'account_not_found', 'Không tìm thấy tài khoản.')
  }

  return {
    bankDetails: bankDetailsView(account.bankDetails),
  }
}

export async function updateAuthorBankDetails(req, input) {
  return ownerWrite(req, async (session, account) => {
    account.bankDetails = {
      bankName: input.bankName,
      accountNumber: input.accountNumber,
      accountHolder: input.accountHolder,
    }

    await account.save({ session })

    await AuditEvent.create(
      [
        {
          actorType: 'account',
          actorId: account._id,
          action: 'author.bank-details.updated',
          targetType: 'Account',
          targetId: account._id,
          targetVersion: account.version,
          result: 'committed',
          occurredAt: new Date(),
        },
      ],
      { session },
    )

    return {
      bankDetails: bankDetailsView(account.bankDetails),
    }
  })
}

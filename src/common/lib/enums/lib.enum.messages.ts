// ─── Auth ─────────────────────────────────────────────────────────────────────
export const WELCOME = 'Welcome to Drizzle';
export const ACCOUNT_CREATED = 'Account created successfully';
export const ACCOUNT_EXIST = 'Account already exists';
export const ACCOUNT_NOT_EXIST = (type: string) => `${type} account does not exist`;
export const ACCOUNT_DEACTIVATED = 'Account is deactivated, kindly contact support';
export const USER_LOGIN_SUCCESSFULLY = 'Logged in successfully';
export const SESSION_EXPIRED = 'Session expired';
export const INVALID_AUTHORIZATION = 'Invalid authorization token';
export const NO_AUTHORIZATION = 'Authorization token is required';
export const INVALID_TOKEN = 'Invalid or expired token';
export const EXPIRED_VERIFICATION_TOKEN = 'Verification OTP has expired';
export const INVALID_OTP = 'Invalid or expired OTP';
export const VERIFICATION_OTP_SENT = 'OTP sent successfully';
export const VERIFICATION_OTP_RESENT = 'OTP resent successfully';
export const INVALID_PIN = 'Invalid PIN';
export const CREATE_PIN = 'PIN created successfully';
export const CHANGE_PIN = 'PIN changed successfully';
export const PIN_RESET = 'PIN reset successfully';
export const NEW_DEVICE_DETECTED =
  'New device detected, verify your account with the OTP sent to your phone';
export const INVALID = (text: string) => `Invalid ${text}`;
export const IS_VALID_CREDENTIALS = (type: string) =>
  `New ${type} cannot be the same as the old ${type}`;

// ─── KYC ──────────────────────────────────────────────────────────────────────
export const BVN_PREVIOUSLY_VERIFIED = 'BVN has already been verified';
export const BVN_NOT_PREVIOUSLY_VERIFIED = 'Kindly verify your BVN first';
export const BVN_USED_BY_ANOTHER_USER = 'This BVN is linked to another account';
export const USER_BVN_NOT_MATCHING = 'Your profile details do not match your BVN record';
export const SUCCESSFUL_VERIFICATION = 'BVN information verified';
export const UNABLE_TO_VERIFY_BVN = 'We are unable to verify your information';
export const KYC_PREVIOUSLY_COMPLETED = 'KYC has already been completed';

// ─── Wallet ───────────────────────────────────────────────────────────────────
export const WALLET_FETCHED = 'Wallet details fetched successfully';
export const WALLET_FUNDED = 'Wallet funded successfully';
export const WITHDRAWAL_INITIATED = 'Withdrawal initiated successfully';
export const INSUFFICIENT_BALANCE = 'Insufficient wallet balance';
export const BANK_ACCOUNT_SAVED = 'Bank account saved successfully';
export const BANK_ACCOUNT_VERIFIED = 'Bank account verified successfully';
export const BANK_ACCOUNT_REMOVED = 'Bank account removed successfully';

// ─── Vault ────────────────────────────────────────────────────────────────────
export const VAULT_CREATED = 'Vault created successfully';
export const VAULT_FETCHED = 'Vault details fetched successfully';
export const VAULTS_FETCHED = 'Vaults fetched successfully';
export const VAULT_BROKEN = 'Vault broken, remaining balance disbursed with penalty applied';
export const VAULT_ALREADY_COMPLETED = 'Vault has already completed all drips';
export const VAULT_NOT_ACTIVE = (status: string) =>
  `Vault cannot be modified, current status is ${status}`;

// ─── Disbursement ─────────────────────────────────────────────────────────────
export const DRIP_PROCESSED = 'Drip processed successfully';
export const DRIP_ALREADY_PROCESSED = 'This drip has already been processed';

// ─── Generic ──────────────────────────────────────────────────────────────────
export const ERROR_STATUS = 'Error';
export const SUCCESS_STATUS = 'Success';
export const SERVER_ERROR = 'Internal server error';
export const DEAD_END_MESSAGE = 'Resource not found';
export const SOMETHING_BROKE = 'Something went wrong, please try again';
export const ALREADY_CREATED = (type: string) => `${type} already exists`;
export const ACTION_CANNOT_BE_DONE = (reason: string) =>
  `Action cannot be performed: ${reason}`;

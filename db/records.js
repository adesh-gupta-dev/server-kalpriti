import { randomBytes } from "node:crypto";
export const newId = () => randomBytes(12).toString("hex");
export const publicUser = (user) => {
  if (!user) return null;
  const {
    password,
    resetToken,
    resetTokenExpires,
    otpHash,
    otpExpiresIn,
    sessionVersion,
    ...safe
  } = user;
  return safe;
};
export function userRecord(row) {
  if (!row) return null;
  return {
    _id: row.id,
    name: row.name,
    email: row.email,
    password: row.password,
    role: row.role,
    totalCreation: row.total_creation,
    credits: row.credits,
    resetToken: row.reset_token,
    resetTokenExpires: row.reset_token_expires,
    otpHash: row.otp_hash,
    otpExpiresIn: row.otp_expires_in,
    verified: row.verified,
    sessionVersion: row.session_version ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
export function projectRecord(row) {
  if (!row) return null;
  const versions = row.version_ids || [];
  const index = versions.indexOf(row.current_version_id);
  return {
    _id: row.id,
    name: row.name,
    initial_prompt: row.initial_prompt,
    current_code: row.current_code,
    current_version_index: index >= 0 ? String(index) : "",
    user_Id: row.user_id,
    isPublished: row.is_published,
    conversation: row.conversation_ids || [],
    versions,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
export const versionRecord = (row) =>
  row
    ? {
        _id: row.id,
        projectId: row.project_id,
        code: row.code,
        description: row.description,
        timestamp: row.timestamp,
      }
    : null;
export const conversationRecord = (row) =>
  row
    ? {
        _id: row.id,
        projectId: row.project_id,
        role: row.role,
        content: row.content,
        timestamp: row.timestamp,
      }
    : null;
export const transactionRecord = (row) =>
  row
    ? {
        _id: row.id,
        userId: row.user_id,
        planId: row.plan_id,
        amount: Number(row.amount),
        credits: row.credits,
        isPaid: row.is_paid,
        paymentStatus: row.payment_status,
        paymentProvider: row.payment_provider,
        paymentIntentId: row.payment_intent_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    : null;

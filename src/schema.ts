import { Type, type Static, type TSchema } from 'typebox';
import { Check } from 'typebox/value';

export const Id = Type.String({ pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' });
const Text = Type.String({ minLength: 1, pattern: '\\S' });
const Ref = Type.Object({ uri: Text, label: Text }, { additionalProperties: false });
const extras = { text: Text, refs: Type.Optional(Type.Array(Ref)), corrects: Type.Optional(Id) };
export const MessageInput = Type.Union([
  Type.Object({ to: Id, subject: Text, ...extras }, { additionalProperties: false }),
  Type.Object({ respondTo: Id, ...extras }, { additionalProperties: false }),
]);
export type MessageInput = Static<typeof MessageInput>;
export const PeersInput = Type.Object({ view: Type.Optional(Type.Union([Type.Literal('known'), Type.Literal('all')])), cursor: Type.Optional(Id) }, { additionalProperties: false });
export const InspectInput = Type.Union([
  Type.Object({ message: Id }, { additionalProperties: false }),
  Type.Object({ exchange: Id, cursor: Type.Optional(Id) }, { additionalProperties: false }),
  Type.Object({ queue: Type.Literal('self'), cursor: Type.Optional(Id) }, { additionalProperties: false }),
  Type.Object({ outbox: Type.Literal('self'), cursor: Type.Optional(Id) }, { additionalProperties: false }),
]);
export type InspectInput = Static<typeof InspectInput>;
export const EnvelopeSchema = Type.Object({
  id: Id, exchange: Id, subject: Text, text: Text, refs: Type.Array(Ref),
  replyTo: Type.Union([Id, Type.Null()]), corrects: Type.Union([Id, Type.Null()]),
  createdAt: Type.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}T' }),
}, { additionalProperties: false });
export type Envelope = Static<typeof EnvelopeSchema>;
export const Output = Type.Object({ ok: Type.Boolean(), data: Type.Optional(Type.Unknown()), error: Type.Optional(Type.Object({ code: Type.String(), message: Type.String(), nextAction: Type.String() })), observedAt: Type.String() });
export function validate(schema: TSchema, value: unknown) {
  if (!Check<TSchema, boolean>(schema, value)) throw new Error('INVALID_INPUT');
}
// Below the reused transport's 1 MiB frame bound, including routing metadata.
export const MAX_ENVELOPE_BYTES = 900_000;
export function checkSize(value: unknown) {
  if (Buffer.byteLength(JSON.stringify({ content: { text: JSON.stringify(value) } })) > MAX_ENVELOPE_BYTES) throw new Error('INVALID_INPUT: message exceeds 900000 bytes; send a work-product reference instead');
}

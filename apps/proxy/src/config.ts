export const DUMMY_MODE =
  process.env.DUMMY_MODE === 'true' || process.env.DUMMY_MODE === '1';

export function mockId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 24)}`;
}

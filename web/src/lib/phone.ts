// The phone's bridge (window.phone), typed for what this app uses. Every call fails soft where a feature is optional.
export type Row = Record<string, any>;
export type PhoneError = Error & { code?: string };
type Statement = { sql: string; params?: unknown[] };

interface Phone {
  ready: Promise<unknown>;
  data: {
    query(sql: string, params?: unknown[]): Promise<Row[]>;
    exec(sql: string, params?: unknown[]): Promise<unknown>;
    batch(list: Statement[]): Promise<unknown>;
  };
  haptic(kind: string): Promise<void>;
  widget: { reload(): Promise<void> };
  share(opts: { text: string }): Promise<void>;
  auth: { check(reason: string): Promise<void> };
  on(event: string, fn: (payload: any) => void): void;
}
declare global { interface Window { phone: Phone } }

export const phone = () => window.phone;
export const ready = () => window.phone.ready;
export const q = (sql: string, params: unknown[] = []) => window.phone.data.query(sql, params);
export const exec = (sql: string, params: unknown[] = []) => window.phone.data.exec(sql, params);
export const batch = (list: Statement[]) => window.phone.data.batch(list);
export const share = (text: string) => window.phone.share({ text });
export const authCheck = (reason: string) => window.phone.auth.check(reason);
export const on = (event: string, fn: (payload: any) => void) => window.phone.on(event, fn);

export type Haptic = "success" | "selection";
export const buzz = (kind: Haptic) => { try { window.phone.haptic(kind).catch(() => {}); } catch { /* no haptics here */ } };
export const reloadWidget = () => { try { window.phone.widget.reload().catch(() => {}); } catch { /* no widget here */ } };

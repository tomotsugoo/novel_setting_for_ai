const PASSWORD_HASH = "a217c5f519c05abd47ada368da395d1a9560ec2961a7d8bfd16fcddea6726412";
const SESSION_KEY = "novelsync_auth";

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function login(password: string): Promise<boolean> {
  const hash = await sha256(password);
  if (hash === PASSWORD_HASH) {
    localStorage.setItem(SESSION_KEY, "1");
    return true;
  }
  return false;
}

export function isAuthenticated(): boolean {
  return localStorage.getItem(SESSION_KEY) === "1";
}

export function logout(): void {
  localStorage.removeItem(SESSION_KEY);
}

/* The SSRF guard: which hosts assertPublicUrl refuses, which it allows.
   Literal IPs are checked without touching DNS, so this needs no network. */
import { assertPublicUrl } from "../lib/safefetch.js";

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(`  ${c ? "ok  " : "FAIL"}  ${m}`); };

async function blocked(url) {
  try { await assertPublicUrl(url); return false; } catch { return true; }
}
async function allowed(url) {
  try { await assertPublicUrl(url); return true; } catch (e) { console.log("      (" + e.message + ")"); return false; }
}

console.log("must be blocked:");
for (const u of [
  "http://169.254.169.254/latest/meta-data/",   // cloud metadata
  "http://127.0.0.1:6379/",                       // loopback
  "http://127.1/",                                // short loopback form still parses to 127.x? no -> covered by regex-less path
  "http://10.0.0.1/admin",                        // private
  "http://192.168.1.1/",                          // private
  "http://172.16.5.4/",                           // private
  "http://172.31.255.255/",                       // private top
  "http://0.0.0.0/",                              // this-host
  "http://localhost/",                            // name
  "http://db.internal/",                          // name
  "http://metadata.google.internal/",            // gcp name
  "http://[::1]/",                                // ipv6 loopback
  "http://[fd00::1]/",                            // ipv6 ULA
  "http://[fe80::1]/",                            // ipv6 link-local
  "http://[::ffff:169.254.169.254]/",            // ipv4-mapped metadata
  "ftp://example.com/",                          // wrong scheme
  "file:///etc/passwd",                          // wrong scheme
  "not a url",                                    // unparseable
]) ok(await blocked(u), `blocked  ${u}`);

console.log("\nmust be allowed (public literals, no DNS):");
for (const u of [
  "http://8.8.8.8/",
  "https://1.1.1.1/",
  "https://93.184.216.34/",   // a public address
]) ok(await allowed(u), `allowed  ${u}`);

// 172.15 and 172.32 are public (just outside the private block)
ok(await allowed("http://172.15.0.1/"), "allowed  172.15.0.1 (just below private range)");
ok(await allowed("http://172.32.0.1/"), "allowed  172.32.0.1 (just above private range)");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

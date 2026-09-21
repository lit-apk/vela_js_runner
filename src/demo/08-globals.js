// Probe what the runtime exposes to dynamically compiled code.
const probe = (name) => {
  try {
    return typeof Function("return " + name)()
  } catch (e) {
    return "ReferenceError"
  }
}
const names = [
  "globalThis", "global", "window", "console", "setTimeout", "setInterval",
  "Promise", "Proxy", "BigInt", "WeakRef", "TextEncoder", "ArrayBuffer",
  "$app_require$", "$app_define$", "$app_evaluate$", "eval", "Function"
]
const out = {}
names.forEach((n) => (out[n] = probe(n)))
out["this === globalThis"] = (function () { return this })() === globalThis
return out

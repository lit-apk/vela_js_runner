// Runs arbitrary JS source inside the quick app's QuickJS context and
// captures console output, the completion value and any error.
//
// Execution model:
//   1. Try "expression mode": `return (<src>)` so the value of a bare
//      expression is shown (like a REPL).
//   2. If that is a SyntaxError, fall back to "statement mode": `<src>`
//      is the body of a function, so `return x` reports x as the result.
//   3. If the result is a thenable it is awaited; rejections become errors.
//
// The snippet is compiled with `new Function`, so it runs in global scope
// with these extra bindings injected as parameters:
//   console  -- shim that records output (also forwards to the real console)
//   require  -- `require('@system.xxx')` loads a declared quick app feature
//   print    -- alias of console.log
//   repr     -- format any value as a string (strings quoted, cycle-safe)
//
// Limitations: errors thrown later from timers/callbacks the snippet
// installed cannot be captured (no global error hook is exposed to JS).

const MAX_DEPTH = 4
const MAX_ITEMS = 50
const MAX_STR = 2000

// `$app_require$` is the runtime's module loader; the toolkit's wrapper
// defines it in the enclosing scope of every bundled page (see
// @aiot-toolkit/aiotpack WrapPlugin). Guard in case it is missing.
function appRequire(name) {
  /* global $app_require$ */
  if (typeof $app_require$ !== "function") {
    throw new Error("$app_require$ is not available in this runtime")
  }
  return $app_require$(name)
}

// Mirrors the toolkit's translateRequire plugin:
//   require('@system.vibrator') -> $app_require$('@app-module/system.vibrator')
function requireShim(name) {
  if (typeof name !== "string") {
    throw new TypeError("require() expects a module name string")
  }
  const trimmed = name.trim()
  if (/^@(system|service|hap)\./.test(trimmed)) {
    return appRequire("@app-module/" + trimmed.slice(1))
  }
  throw new Error(
    `Cannot require '${name}': only @system.* / @service.* modules declared in manifest.json are available`
  )
}

export function formatValue(value, depth, seen) {
  depth = depth || 0
  seen = seen || []
  const type = typeof value
  if (value === null) return "null"
  if (type === "undefined") return "undefined"
  if (type === "string") return depth === 0 ? value : JSON.stringify(value)
  if (type === "number" || type === "boolean") return String(value)
  if (type === "bigint") return String(value) + "n"
  if (type === "symbol") return value.toString()
  if (type === "function") {
    const src = Function.prototype.toString.call(value)
    const head = src.split("\n")[0]
    return head.length < src.length ? head + " ... }" : head
  }
  if (value instanceof Error) return formatError(value, false)
  if (value instanceof Date) return isNaN(value.getTime()) ? "Invalid Date" : value.toISOString()
  if (value instanceof RegExp) return value.toString()
  if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView(value)) {
    const name = value.constructor && value.constructor.name ? value.constructor.name : "TypedArray"
    return `${name}(${value.length}) [${Array.prototype.slice.call(value, 0, MAX_ITEMS).join(", ")}${
      value.length > MAX_ITEMS ? ", ..." : ""
    }]`
  }

  if (seen.indexOf(value) >= 0) return "[Circular]"
  if (depth >= MAX_DEPTH) return Array.isArray(value) ? "[Array]" : "[Object]"
  const nextSeen = seen.concat([value])

  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ITEMS).map((v) => formatValue(v, depth + 1, nextSeen))
    if (value.length > MAX_ITEMS) items.push(`... ${value.length - MAX_ITEMS} more`)
    return `[${items.join(", ")}]`
  }

  if (typeof Map !== "undefined" && value instanceof Map) {
    const items = []
    value.forEach((v, k) => {
      if (items.length < MAX_ITEMS) {
        items.push(`${formatValue(k, depth + 1, nextSeen)} => ${formatValue(v, depth + 1, nextSeen)}`)
      }
    })
    return `Map(${value.size}) {${items.join(", ")}}`
  }
  if (typeof Set !== "undefined" && value instanceof Set) {
    const items = []
    value.forEach((v) => {
      if (items.length < MAX_ITEMS) items.push(formatValue(v, depth + 1, nextSeen))
    })
    return `Set(${value.size}) {${items.join(", ")}}`
  }
  if (typeof Promise !== "undefined" && value instanceof Promise) return "Promise {}"

  const keys = Object.keys(value)
  const parts = keys.slice(0, MAX_ITEMS).map((k) => {
    let v
    try {
      v = value[k]
    } catch (e) {
      v = `[Getter threw: ${e && e.message}]`
    }
    return `${/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)}: ${formatValue(v, depth + 1, nextSeen)}`
  })
  if (keys.length > MAX_ITEMS) parts.push(`... ${keys.length - MAX_ITEMS} more`)
  const ctor = value.constructor && value.constructor.name
  const prefix = ctor && ctor !== "Object" ? ctor + " " : ""
  return `${prefix}{${parts.join(", ")}}`
}

// Like formatValue but strings are quoted, i.e. a `repr` rather than `str`.
export function repr(value) {
  return typeof value === "string" ? JSON.stringify(value) : formatValue(value)
}

export function formatError(err, withStack) {
  if (err instanceof Error || (err && typeof err === "object" && "message" in err)) {
    const name = err.name || "Error"
    let text = err.message ? `${name}: ${err.message}` : name
    if (withStack !== false && typeof err.stack === "string" && err.stack.trim()) {
      // QuickJS stacks contain only "    at ..." frames; V8 prepends the
      // "name: message" header. Drop the header if present to avoid repeating it.
      let stack = err.stack.replace(/\s+$/, "")
      if (stack.indexOf(text) === 0) stack = stack.slice(text.length).replace(/^\s*\n/, "")
      if (stack) text += "\n" + stack
    }
    return text
  }
  return "Thrown (non-Error): " + formatValue(err)
}

function truncate(text) {
  if (text.length <= MAX_STR) return text
  return text.slice(0, MAX_STR) + ` ... (${text.length - MAX_STR} more chars)`
}

function makeConsole(logs) {
  const real = typeof console !== "undefined" ? console : null
  function emit(level) {
    return function () {
      const args = Array.prototype.slice.call(arguments)
      const text = truncate(args.map((a) => formatValue(a)).join(" "))
      logs.push({level, text})
      if (real && typeof real.log === "function") {
        real.log(`[runner:${level}] ${text}`)
      }
    }
  }
  return {
    log: emit("log"),
    info: emit("info"),
    debug: emit("debug"),
    warn: emit("warn"),
    error: emit("error")
  }
}

function compile(source, names) {
  // Expression mode first, then statement mode.
  let exprErr
  try {
    return new Function(...names, `return (\n${source}\n);`)
  } catch (e) {
    exprErr = e
  }
  try {
    return new Function(...names, source)
  } catch (e) {
    // Prefer the statement-mode error: it describes the user's code as written.
    throw e instanceof SyntaxError ? e : exprErr
  }
}

/**
 * Runs `source` and resolves (never rejects) with:
 *   { ok, value, error, logs: [{level, text}], durationMs }
 * `value` / `error` are pre-formatted strings (or null).
 */
export function runCode(source) {
  const logs = []
  const start = Date.now()
  const scope = {
    console: makeConsole(logs),
    require: requireShim
  }
  scope.print = scope.console.log
  scope.repr = repr
  const names = Object.keys(scope)
  const values = names.map((k) => scope[k])

  const finish = (ok, value, error) => ({
    ok,
    value: ok ? truncate(formatValue(value)) : null,
    error: ok ? null : truncate(formatError(error)),
    logs,
    durationMs: Date.now() - start
  })

  return new Promise((resolve) => {
    let fn
    try {
      fn = compile(String(source == null ? "" : source), names)
    } catch (e) {
      resolve(finish(false, undefined, e))
      return
    }

    let result
    try {
      result = fn.apply(undefined, values)
    } catch (e) {
      resolve(finish(false, undefined, e))
      return
    }

    if (result && typeof result.then === "function") {
      result.then(
        (v) => resolve(finish(true, v)),
        (e) => resolve(finish(false, undefined, e))
      )
    } else {
      resolve(finish(true, result))
    }
  })
}

// Summarises which system APIs work on this device and, for the supported
// ones, collects their first result.
//
// Each line is:  [status] api_name[: repr(result)]
// where status is a check mark (supported) or a cross mark (unsupported).

const CHECK = "\u2713"
const CROSS = "\u2717"
const TIMEOUT_MS = 4000

// Wraps one API probe.
//   apiName  label for the status line
//   attempt  function(done); it must call done(err, result) exactly once:
//            done(null, result) -> supported, done(err) -> unsupported.
//            A synchronous throw inside `attempt` also counts as unsupported.
// Resolves with {supported: bool, statusLine: String, result, error}.
function probe(apiName, attempt) {
  return new Promise((resolve) => {
    let settled = false
    let timer = null

    const finish = (err, result) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      const supported = !err
      resolve({
        supported,
        statusLine: `[${supported ? CHECK : CROSS}] ${apiName}${supported ? ": " + repr(result) : ""}`,
        result: supported ? result : undefined,
        error: supported ? undefined : describeError(err)
      })
    }

    timer = setTimeout(() => finish(new Error(`no response within ${TIMEOUT_MS} ms`)), TIMEOUT_MS)

    try {
      attempt(finish)
    } catch (e) {
      finish(e)
    }
  })
}

function describeError(err) {
  if (err instanceof Error) return err.message
  if (err && typeof err === "object") return repr(err)
  return String(err)
}

// Standard quick app callback style: fail(data, code) -> Error
const failToError = (done) => (data, code) => done(new Error(`fail code=${code} data=${repr(data)}`))

// ---- individual probes -----------------------------------------------------

const probes = [
  () =>
    probe("network.getType", (done) => {
      const network = require("@system.network")
      network.getType({
        success: (res) => done(null, res),
        fail: failToError(done)
      })
    }),

  () =>
    probe("geolocation.getLocation", (done) => {
      const geolocation = require("@system.geolocation")
      geolocation.getLocation({
        timeout: TIMEOUT_MS - 500,
        success: (res) => done(null, res),
        fail: failToError(done) // 203 = unsupported, 204 = timeout
      })
    }),

  () =>
    probe("sensor.subscribeAccelerometer", (done) => {
      const sensor = require("@system.sensor")
      sensor.subscribeAccelerometer({
        interval: "normal",
        callback: (res) => {
          sensor.unsubscribeAccelerometer()
          done(null, res)
        },
        fail: failToError(done)
      })
    }),

  () =>
    probe("sensor.subscribeCompass", (done) => {
      const sensor = require("@system.sensor")
      sensor.subscribeCompass({
        callback: (res) => {
          sensor.unsubscribeCompass()
          done(null, res)
        },
        fail: failToError(done)
      })
    }),

  () =>
    probe("event.subscribe('usual.event.BATTERY_CHANGED')", (done) => {
      const event = require("@system.event")
      const EVENT_WAIT_MS = 1500
      let evtId
      let waitTimer = null
      const finishWith = (firstEvent) => {
        if (waitTimer) clearTimeout(waitTimer)
        try {
          event.unsubscribe({id: evtId})
        } catch (e) {
          // ignore; best effort
        }
        done(null, {id: evtId, firstEvent})
      }
      evtId = event.subscribe({
        eventName: "usual.event.BATTERY_CHANGED",
        callback: (res) => finishWith(res)
      })
      // Per docs: returns the subscription id, or undefined if it failed.
      if (evtId === undefined) {
        done(new Error("subscribe returned undefined"))
        return
      }
      // Subscribing worked; battery level rarely changes, so only wait briefly.
      waitTimer = setTimeout(() => finishWith(`(no event within ${EVENT_WAIT_MS} ms)`), EVENT_WAIT_MS)
    })
]

// ---- run sequentially, print as we go, return the summary ------------------

return probes
  .reduce(
    (chain, next) =>
      chain.then((lines) =>
        next().then((r) => {
          console.log(r.statusLine)
          if (!r.supported) console.debug("   reason: " + r.error)
          return lines.concat(r.statusLine)
        })
      ),
    Promise.resolve([])
  )
  .then((lines) => {
    const ok = lines.filter((l) => l.indexOf(CHECK) === 1).length
    console.log(`\n${ok}/${lines.length} supported`)
    return lines.join("\n")
  })
